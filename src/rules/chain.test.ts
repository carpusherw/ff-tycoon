import { advanceShipments, createTask, customerName, onTaskCompleted } from './chain';
import { generateRequests } from './demand';
import { newId } from './ids';
import { openOffice } from './network';
import { createGame } from './newGame';
import type { Agent, Customer, Employee, GameState, Shipment, Task, TaskKind } from './types';
import { transitDays, type PortId } from './world';

function setup(): { s: GameState; owner: Employee; agent: Agent } {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  const owner = s.employees.find((e) => e.isOwner)!;
  const agent = s.agents[0];
  return { s, owner, agent };
}

function addCustomer(s: GameState, status: Customer['status']): Customer {
  const customer: Customer = { id: newId(s, 'c'), name: 'Test Co', officeId: 'o1', status, payments: [] };
  s.customers.push(customer);
  return customer;
}

function addShipment(s: GameState, customer: Customer, direction: Shipment['direction'], agent: Agent): Shipment {
  const home = s.offices[0];
  const office = { kind: 'office', officeId: home.id } as const;
  const partner = { kind: 'agent', agentId: agent.id } as const;
  const isExport = direction === 'export';
  const shipment: Shipment = {
    id: newId(s, 'sh'),
    kind: 'sale',
    customerId: customer.id,
    sellingOfficeId: home.id,
    direction,
    fromPortId: isExport ? home.portId : agent.portId,
    toPortId: isExport ? agent.portId : home.portId,
    origin: isExport ? office : partner,
    destination: isExport ? partner : office,
    status: 'quoting',
    margin: 2000,
    agentShare: 500,
    localCharges: 0,
    chargesPaid: false,
    departDay: null,
    arriveDay: null,
    agentReadyDay: null,
    arrived: false,
    paid: false,
    arrivalDone: false,
  };
  s.shipments.push(shipment);
  return shipment;
}

/** A sale from the home office to its own office in Los Angeles: no agent share, local charges billed there. */
function addOfficeShipment(s: GameState, customer: Customer, direction: Shipment['direction']): Shipment {
  expect(openOffice(s, 'LAX')).toEqual({ ok: true });
  const [home, lax] = s.offices;
  const homeEnd = { kind: 'office', officeId: home.id } as const;
  const laxEnd = { kind: 'office', officeId: lax.id } as const;
  const isExport = direction === 'export';
  const shipment: Shipment = {
    id: newId(s, 'sh'),
    kind: 'sale',
    customerId: customer.id,
    sellingOfficeId: home.id,
    direction,
    fromPortId: isExport ? home.portId : lax.portId,
    toPortId: isExport ? lax.portId : home.portId,
    origin: isExport ? homeEnd : laxEnd,
    destination: isExport ? laxEnd : homeEnd,
    status: 'quoting',
    margin: 2000,
    agentShare: 0,
    localCharges: 300,
    chargesPaid: false,
    departDay: null,
    arriveDay: null,
    agentReadyDay: null,
    arrived: false,
    paid: false,
    arrivalDone: false,
  };
  s.shipments.push(shipment);
  return shipment;
}

/** Finishes a task the way the daily loop does: off the board, then into the chain. */
function complete(s: GameState, task: Task, assigneeId: string | null = task.assigneeId): void {
  task.assigneeId = assigneeId;
  s.tasks = s.tasks.filter((t) => t !== task);
  onTaskCompleted(s, task);
}

function openTask(s: GameState, shipment: Shipment, kind: TaskKind): Task | undefined {
  return s.tasks.find((t) => t.shipmentId === shipment.id && t.kind === kind);
}

/**
 * Works a quote with a fixed roll: rngState 1 draws 0.627 next, so winRate 2 (95%) wins
 * and winRate 0.01 (5%) loses.
 */
function quote(s: GameState, shipment: Shipment, owner: Employee, winRate: number): void {
  owner.winRate = winRate;
  const task = createTask(s, 'quote', shipment, shipment.sellingOfficeId!);
  s.rngState = 1;
  complete(s, task, owner.id);
}

describe('task chain', () => {
  it('export: booking → sails → invoice at departure → done on arrival and payment', () => {
    const { s, owner, agent } = setup();
    const customer = addCustomer(s, 'prospect');
    const shipment = addShipment(s, customer, 'export', agent);

    s.day = 2;
    quote(s, shipment, owner, 2);
    expect(shipment.status).toBe('origin');
    expect(customer.status).toBe('active');
    expect(s.stats.quotesWon).toBe(1);
    const booking = openTask(s, shipment, 'booking')!;
    expect(booking).toMatchObject({ officeId: 'o1', dept: 'ops', createdDay: 2 });

    s.day = 7;
    complete(s, booking);
    expect(shipment.status).toBe('atSea');
    expect(shipment.departDay).toBe(7);
    const days = transitDays(shipment.fromPortId as PortId, shipment.toPortId as PortId);
    expect(shipment.arriveDay).toBe(7 + days);
    const invoice = openTask(s, shipment, 'invoice')!;
    expect(invoice).toMatchObject({ officeId: 'o1', dept: 'accounting', createdDay: 7 });

    s.day = 9;
    const cashBefore = s.cash;
    complete(s, invoice);
    expect(shipment.paid).toBe(true);
    expect(s.cash).toBe(cashBefore + 2000 - 500);
    expect(customer.payments).toEqual([{ day: 9, amount: 1500 }]);
    expect(s.stats.revenue).toEqual([{ day: 9, amount: 1500 }]);
    expect(s.log[0].msg).toEqual({ key: 'log.paid', params: { customer: 'Test Co', amount: 1500 } });
    expect(shipment.status).toBe('atSea');

    s.day = 6 + days;
    advanceShipments(s);
    expect(shipment.status).toBe('atSea');

    s.day = 7 + days;
    advanceShipments(s);
    expect(shipment.arrived).toBe(true);
    expect(shipment.status).toBe('done');
    expect(s.stats.deliveredDays).toEqual([7 + days]);
    expect(s.tasks.filter((t) => t.shipmentId === shipment.id)).toEqual([]);
  });

  it('import: origin agent → sails → arrival and invoice tasks on arrival', () => {
    const { s, owner, agent } = setup();
    const customer = addCustomer(s, 'prospect');
    const shipment = addShipment(s, customer, 'import', agent);

    s.day = 10;
    quote(s, shipment, owner, 2);
    expect(shipment.status).toBe('origin');
    expect(shipment.agentReadyDay).toBe(15);
    expect(s.tasks.filter((t) => t.shipmentId === shipment.id)).toEqual([]);

    s.day = 14;
    advanceShipments(s);
    expect(shipment.status).toBe('origin');

    s.day = 15;
    advanceShipments(s);
    expect(shipment.status).toBe('atSea');
    expect(shipment.departDay).toBe(15);
    expect(openTask(s, shipment, 'booking')).toBeUndefined();
    expect(openTask(s, shipment, 'invoice')).toBeUndefined();

    s.day = shipment.arriveDay!;
    advanceShipments(s);
    expect(shipment.status).toBe('destination');
    const arrival = openTask(s, shipment, 'arrival')!;
    const invoice = openTask(s, shipment, 'invoice')!;
    expect(arrival).toMatchObject({ officeId: 'o1', dept: 'ops', createdDay: s.day });
    expect(invoice).toMatchObject({ officeId: 'o1', dept: 'accounting', createdDay: s.day });

    s.day += 1;
    complete(s, invoice);
    expect(shipment.paid).toBe(true);
    expect(shipment.status).toBe('destination');

    s.day += 3;
    complete(s, arrival);
    expect(shipment.arrivalDone).toBe(true);
    expect(shipment.status).toBe('done');
    expect(s.stats.deliveredDays).toEqual([s.day]);
  });

  it('lost quote removes a prospect', () => {
    const { s, owner, agent } = setup();
    const customer = addCustomer(s, 'prospect');
    const shipment = addShipment(s, customer, 'export', agent);

    quote(s, shipment, owner, 0.01);
    expect(shipment.status).toBe('lost');
    expect(s.stats.quotesLost).toBe(1);
    expect(s.customers).not.toContain(customer);
    expect(s.tasks).toEqual([]);
    expect(s.log[0].msg).toEqual({ key: 'log.quoteLost', params: { customer: 'Test Co' } });
  });

  it('a quote with no assignee is lost', () => {
    const { s, agent } = setup();
    const customer = addCustomer(s, 'active');
    const shipment = addShipment(s, customer, 'export', agent);

    complete(s, createTask(s, 'quote', shipment, 'o1'), null);
    expect(shipment.status).toBe('lost');
    expect(s.customers).toContain(customer);
  });

  it("every created task's deadline leaves room for its minimum duration", () => {
    const { s, owner } = setup();
    owner.winRate = 2;
    const seen: Task[] = [];
    for (let day = 1; day <= 2000 && seen.length < 200; day++) {
      s.day = day;
      generateRequests(s);
      advanceShipments(s);
      const created = [...s.tasks];
      seen.push(...created);
      for (const task of created) complete(s, task, owner.id);
    }

    expect(seen.length).toBeGreaterThanOrEqual(200);
    expect(new Set(seen.map((t) => t.kind))).toEqual(new Set(['quote', 'booking', 'arrival', 'invoice']));
    for (const task of seen) expect(task.deadline - task.createdDay).toBeGreaterThanOrEqual(task.minDuration);
  });

  it('export to an own far office: arrival there, then charges there, done after invoice and charges are paid', () => {
    const { s, owner } = setup();
    s.cash = 100000;
    const customer = addCustomer(s, 'active');
    const shipment = addOfficeShipment(s, customer, 'export');
    const lax = s.offices[1];
    const cashStart = s.cash;

    s.day = 2;
    quote(s, shipment, owner, 2);
    const booking = openTask(s, shipment, 'booking')!;
    expect(booking.officeId).toBe('o1');

    s.day = 7;
    complete(s, booking);
    expect(shipment.status).toBe('atSea');
    expect(openTask(s, shipment, 'charges')).toBeUndefined();
    const invoice = openTask(s, shipment, 'invoice')!;
    expect(invoice.officeId).toBe('o1');

    s.day = shipment.arriveDay!;
    advanceShipments(s);
    expect(shipment.status).toBe('destination');
    const arrival = openTask(s, shipment, 'arrival')!;
    expect(arrival).toMatchObject({ officeId: lax.id, dept: 'ops' });
    expect(openTask(s, shipment, 'charges')).toBeUndefined();

    s.day += 1;
    complete(s, invoice);
    expect(shipment.paid).toBe(true);
    expect(s.cash).toBe(cashStart + 2000);

    s.day += 2;
    complete(s, arrival);
    expect(shipment.arrivalDone).toBe(true);
    expect(shipment.status).toBe('destination');
    const charges = openTask(s, shipment, 'charges')!;
    expect(charges).toMatchObject({ officeId: lax.id, dept: 'accounting', createdDay: s.day });

    s.day += 1;
    complete(s, charges);
    expect(shipment.chargesPaid).toBe(true);
    expect(shipment.status).toBe('done');
    expect(s.stats.deliveredDays).toEqual([s.day]);
    expect(s.cash).toBe(cashStart + 2000 + 300);
    expect(s.stats.revenue.map((r) => r.amount)).toEqual([2000, 300]);
    expect(customer.payments).toEqual([{ day: s.day - 3, amount: 2000 }]);
    expect(s.log[0]).toMatchObject({
      tone: 'good',
      msg: { key: 'log.chargesPaid', params: { city: 'LAX', amount: 300 } },
    });
    expect(s.tasks.filter((t) => t.shipmentId === shipment.id)).toEqual([]);
  });

  it('import from an own far office: booking at the far office creates charges there; the ship sails on booking', () => {
    const { s, owner } = setup();
    s.cash = 100000;
    const customer = addCustomer(s, 'active');
    const shipment = addOfficeShipment(s, customer, 'import');
    const lax = s.offices[1];
    const cashStart = s.cash;

    s.day = 10;
    quote(s, shipment, owner, 2);
    expect(shipment.status).toBe('origin');
    expect(shipment.agentReadyDay).toBeNull();
    const booking = openTask(s, shipment, 'booking')!;
    expect(booking).toMatchObject({ officeId: lax.id, dept: 'ops' });

    s.day = 14;
    complete(s, booking);
    expect(shipment.status).toBe('atSea');
    expect(shipment.departDay).toBe(14);
    const charges = openTask(s, shipment, 'charges')!;
    expect(charges).toMatchObject({ officeId: lax.id, dept: 'accounting', createdDay: 14 });
    expect(openTask(s, shipment, 'invoice')).toBeUndefined();

    s.day = 15;
    complete(s, charges);
    expect(shipment.chargesPaid).toBe(true);
    expect(s.cash).toBe(cashStart + 300);

    s.day = shipment.arriveDay!;
    advanceShipments(s);
    const arrival = openTask(s, shipment, 'arrival')!;
    const invoice = openTask(s, shipment, 'invoice')!;
    expect(arrival.officeId).toBe('o1');
    expect(invoice.officeId).toBe('o1');
    complete(s, arrival);
    expect(openTask(s, shipment, 'charges')).toBeUndefined();
    expect(shipment.status).toBe('destination');
    complete(s, invoice);
    expect(shipment.status).toBe('done');
    expect(s.cash).toBe(cashStart + 2000 + 300);
  });

  it('a shipment with local charges is not done until they are paid', () => {
    const { s, owner } = setup();
    s.cash = 100000;
    const customer = addCustomer(s, 'active');
    const shipment = addOfficeShipment(s, customer, 'export');
    quote(s, shipment, owner, 2);
    complete(s, openTask(s, shipment, 'booking')!);
    complete(s, openTask(s, shipment, 'invoice')!);
    s.day = shipment.arriveDay!;
    advanceShipments(s);
    complete(s, openTask(s, shipment, 'arrival')!);
    expect(shipment).toMatchObject({ arrived: true, paid: true, arrivalDone: true, chargesPaid: false });
    expect(shipment.status).toBe('destination');
  });

  it("a handling shipment is named after its agent and is never invoiced", () => {
    const { s, agent } = setup();
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    const lax = s.offices[1];
    const shipment: Shipment = {
      id: newId(s, 'sh'),
      kind: 'handling',
      customerId: null,
      sellingOfficeId: null,
      direction: 'import',
      fromPortId: agent.portId,
      toPortId: lax.portId,
      origin: { kind: 'agent', agentId: agent.id },
      destination: { kind: 'office', officeId: lax.id },
      status: 'atSea',
      margin: 0,
      agentShare: 0,
      localCharges: 400,
      chargesPaid: false,
      departDay: 1,
      arriveDay: 5,
      agentReadyDay: null,
      arrived: false,
      paid: false,
      arrivalDone: false,
    };
    s.shipments.push(shipment);
    expect(customerName(s, shipment)).toBe(agent.name);

    s.day = 5;
    advanceShipments(s);
    expect(openTask(s, shipment, 'invoice')).toBeUndefined();
    complete(s, openTask(s, shipment, 'arrival')!);
    const charges = openTask(s, shipment, 'charges')!;
    expect(charges.officeId).toBe(lax.id);
    complete(s, charges);
    expect(shipment.status).toBe('done');
  });
});
