import { B } from './balance';
import { advanceShipments, customerName, onTaskCompleted } from './chain';
import { handleMissedDeadlines } from './deadlines';
import { generateHandling } from './handling';
import { newId } from './ids';
import { addAgent, openOffice } from './network';
import { createGame } from './newGame';
import { moveOwner } from './staff';
import { stepDay } from './step';
import type { Agent, DeptKey, Employee, GameState, Shipment, Task, TaskKind } from './types';

/** The home office in Taipei with one agent in Rotterdam. The owner starts in Sales, so no office has Ops yet. */
function setup(): { s: GameState; agent: Agent } {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.cash = 200000;
  s.agents = [];
  const agent = addAgent(s, 'RTM');
  return { s, agent };
}

function addEmployee(s: GameState, officeId: string, dept: DeptKey): Employee {
  const employee: Employee = { id: newId(s, 'e'), name: 'Test Staff', officeId, dept, isOwner: false, salary: 3000,
    hiredDay: s.day, speed: 1, capacity: 3, winRate: 0.4 };
  s.employees.push(employee);
  return employee;
}

/** Rolls handling requests day by day until one comes in `direction`; requests in the other direction are dropped. */
function nextRequest(s: GameState, direction: Shipment['direction']): Shipment {
  for (let i = 0; i < 2000; i++) {
    s.day += 1;
    const before = s.shipments.length;
    generateHandling(s);
    const fresh = s.shipments.slice(before);
    const request = fresh.find((sh) => sh.direction === direction);
    const dropped = new Set(fresh.filter((sh) => sh !== request).map((sh) => sh.id));
    s.shipments = s.shipments.filter((sh) => !dropped.has(sh.id));
    s.tasks = s.tasks.filter((t) => !dropped.has(t.shipmentId));
    if (request) return request;
  }
  throw new Error(`No ${direction} handling request in 2000 days`);
}

function openTasks(s: GameState, shipment: Shipment): Task[] {
  return s.tasks.filter((t) => t.shipmentId === shipment.id);
}

function openTask(s: GameState, shipment: Shipment, kind: TaskKind): Task | undefined {
  return openTasks(s, shipment).find((t) => t.kind === kind);
}

/** Finishes a task the way the daily loop does: off the board, then into the chain. */
function complete(s: GameState, task: Task): void {
  s.tasks = s.tasks.filter((t) => t !== task);
  onTaskCompleted(s, task);
}

describe('agent handling tasks', () => {
  it("uses the plan's numbers", () => {
    expect(B.handling).toEqual({ requestPerAgentPerDay: 0.08, fee: [300, 500], exportShare: 0.5 });
    expect(B.agents.handlingDays).toBe(5);
  });

  it('handling export: booking at the office, sails, charges, done once charges are paid and it arrives', () => {
    const { s, agent } = setup();
    moveOwner(s, 'ops');
    const home = s.offices[0];
    const cashStart = s.cash;
    const request = nextRequest(s, 'export');
    expect(request).toMatchObject({
      kind: 'handling',
      customerId: null,
      sellingOfficeId: null,
      direction: 'export',
      fromPortId: 'TPE',
      toPortId: 'RTM',
      origin: { kind: 'office', officeId: home.id },
      destination: { kind: 'agent', agentId: agent.id },
      status: 'origin',
      margin: 0,
      agentShare: 0,
      chargesPaid: false,
      agentReadyDay: null,
    });
    expect(Number.isInteger(request.localCharges)).toBe(true);
    expect(request.localCharges).toBeGreaterThanOrEqual(300);
    expect(request.localCharges).toBeLessThanOrEqual(500);
    // Straight to Ops: a booking at the office, no quote.
    expect(openTasks(s, request).map((t) => [t.kind, t.officeId])).toEqual([['booking', home.id]]);

    complete(s, openTask(s, request, 'booking')!);
    expect(request.status).toBe('atSea');
    expect(openTasks(s, request).map((t) => [t.kind, t.officeId])).toEqual([['charges', home.id]]);

    s.day = request.arriveDay!;
    advanceShipments(s);
    expect(request.arrived).toBe(true);
    expect(request.status).toBe('destination');
    expect(openTask(s, request, 'arrival')).toBeUndefined();
    expect(openTask(s, request, 'invoice')).toBeUndefined();

    complete(s, openTask(s, request, 'charges')!);
    expect(request.chargesPaid).toBe(true);
    expect(request.status).toBe('done');
    expect(openTasks(s, request)).toEqual([]);
    expect(s.cash).toBe(cashStart + request.localCharges);
    expect(s.stats.revenue).toEqual([{ day: s.day, invoices: 0, charges: request.localCharges }]);
  });

  it('handling import: agent origin, arrival at the office, then charges', () => {
    const { s, agent } = setup();
    moveOwner(s, 'ops');
    const home = s.offices[0];
    const cashStart = s.cash;
    const request = nextRequest(s, 'import');
    expect(request).toMatchObject({
      kind: 'handling',
      customerId: null,
      sellingOfficeId: null,
      direction: 'import',
      fromPortId: 'RTM',
      toPortId: 'TPE',
      origin: { kind: 'agent', agentId: agent.id },
      destination: { kind: 'office', officeId: home.id },
      status: 'origin',
      margin: 0,
      agentShare: 0,
      agentReadyDay: s.day + 5,
    });
    expect(openTasks(s, request)).toEqual([]);

    s.day = request.agentReadyDay!;
    advanceShipments(s);
    expect(request.status).toBe('atSea');
    expect(openTasks(s, request)).toEqual([]);

    s.day = request.arriveDay!;
    advanceShipments(s);
    expect(openTasks(s, request).map((t) => [t.kind, t.officeId])).toEqual([['arrival', home.id]]);

    complete(s, openTask(s, request, 'arrival')!);
    expect(openTasks(s, request).map((t) => [t.kind, t.officeId])).toEqual([['charges', home.id]]);
    expect(request.status).toBe('destination');

    complete(s, openTask(s, request, 'charges')!);
    expect(request.status).toBe('done');
    expect(s.cash).toBe(cashStart + request.localCharges);
  });

  it("never sent to an office without Ops staff, or to an office in the agent's own region", () => {
    const { s } = setup();
    s.agents = [];
    addAgent(s, 'LAX');
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    expect(openOffice(s, 'SIN')).toEqual({ ok: true });
    const [home, lax, sin] = s.offices;
    addEmployee(s, lax.id, 'ops');
    addEmployee(s, sin.id, 'sales');
    addEmployee(s, sin.id, 'accounting');
    // Taipei has only the owner, in Sales; Singapore has staff but nobody in Ops; Los Angeles is the agent's region.
    for (let i = 0; i < 1000; i++) {
      s.day += 1;
      generateHandling(s);
    }
    expect(s.shipments.filter((sh) => sh.kind === 'handling')).toEqual([]);

    moveOwner(s, 'ops');
    for (let i = 0; i < 1000; i++) {
      s.day += 1;
      generateHandling(s);
    }
    const requests = s.shipments.filter((sh) => sh.kind === 'handling');
    expect(requests.length).toBeGreaterThan(0);
    const offices = requests.map((sh) => (sh.origin.kind === 'office' ? sh.origin : sh.destination));
    expect(new Set(offices.map((end) => end.kind === 'office' && end.officeId))).toEqual(new Set([home.id]));
  });

  it('requests are spread evenly over the eligible offices', () => {
    const { s } = setup();
    moveOwner(s, 'ops');
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    expect(openOffice(s, 'SIN')).toEqual({ ok: true });
    for (const office of s.offices.slice(1)) addEmployee(s, office.id, 'ops');
    for (let i = 0; i < 3000; i++) {
      s.day += 1;
      generateHandling(s);
    }
    const counts = new Map(s.offices.map((o) => [o.id, 0]));
    for (const sh of s.shipments) {
      const end = sh.origin.kind === 'office' ? sh.origin : sh.destination;
      if (end.kind === 'office') counts.set(end.officeId, counts.get(end.officeId)! + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    // 3000 days at 8% a day is about 240 requests, about 80 per office.
    expect(total).toBeGreaterThan(180);
    for (const n of counts.values()) {
      expect(n / total).toBeGreaterThan(0.25);
      expect(n / total).toBeLessThan(0.42);
    }
  });

  it('task labels name the agent', () => {
    const { s, agent } = setup();
    moveOwner(s, 'ops');
    const request = nextRequest(s, 'export');
    expect(customerName(s, request)).toBe(agent.name);
    expect(s.log[0].msg).toEqual({
      key: 'log.handlingRequest',
      params: { agent: agent.name, from: 'TPE', to: 'RTM' },
    });

    const booking = openTask(s, request, 'booking')!;
    s.day = booking.deadline + 1;
    handleMissedDeadlines(s);
    expect(s.log[0].msg).toEqual({ key: 'log.opsLate', params: { customer: agent.name, fee: B.penalties.opsMissFee } });
  });

  it('no customer is created and the customer book is unchanged', () => {
    const { s } = setup();
    moveOwner(s, 'ops');
    const before = structuredClone(s.customers);
    nextRequest(s, 'export');
    nextRequest(s, 'import');
    expect(s.customers).toEqual(before);
  });

  it('agents send handling requests during the daily step once an office has Ops', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    moveOwner(s, 'ops');
    let request: Shipment | undefined;
    for (let i = 0; i < 360 && !request; i++) {
      stepDay(s);
      request = s.shipments.find((sh) => sh.kind === 'handling');
    }
    expect(request).toBeDefined();
    expect(s.customers.some((c) => c.id === request!.customerId)).toBe(false);
  });
});
