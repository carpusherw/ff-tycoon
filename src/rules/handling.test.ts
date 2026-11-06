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

/** Rolls agent jobs day by day until one comes in `direction`; jobs in the other direction are dropped. */
function nextJob(s: GameState, direction: Shipment['direction']): Shipment {
  for (let i = 0; i < 2000; i++) {
    s.day += 1;
    const before = s.shipments.length;
    generateHandling(s);
    const fresh = s.shipments.slice(before);
    const job = fresh.find((sh) => sh.direction === direction);
    const dropped = new Set(fresh.filter((sh) => sh !== job).map((sh) => sh.id));
    s.shipments = s.shipments.filter((sh) => !dropped.has(sh.id));
    s.tasks = s.tasks.filter((t) => !dropped.has(t.shipmentId));
    if (job) return job;
  }
  throw new Error(`No ${direction} agent job in 2000 days`);
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
  it('handling export: booking at the office, sails, charges, done once charges are paid and it arrives', () => {
    const { s, agent } = setup();
    moveOwner(s, 'ops');
    const home = s.offices[0];
    const cashStart = s.cash;
    const job = nextJob(s, 'export');
    expect(job).toMatchObject({
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
    expect(Number.isInteger(job.localCharges)).toBe(true);
    expect(job.localCharges).toBeGreaterThanOrEqual(B.handling.fee[0]);
    expect(job.localCharges).toBeLessThanOrEqual(B.handling.fee[1]);
    // Straight to Ops: a booking at the office, no quote.
    expect(openTasks(s, job).map((t) => [t.kind, t.officeId])).toEqual([['booking', home.id]]);

    complete(s, openTask(s, job, 'booking')!);
    expect(job.status).toBe('atSea');
    expect(openTasks(s, job).map((t) => [t.kind, t.officeId])).toEqual([['charges', home.id]]);

    s.day = job.arriveDay!;
    advanceShipments(s);
    expect(job.arrived).toBe(true);
    expect(job.status).toBe('destination');
    expect(openTask(s, job, 'arrival')).toBeUndefined();
    expect(openTask(s, job, 'invoice')).toBeUndefined();

    complete(s, openTask(s, job, 'charges')!);
    expect(job.chargesPaid).toBe(true);
    expect(job.status).toBe('done');
    expect(openTasks(s, job)).toEqual([]);
    expect(s.cash).toBe(cashStart + job.localCharges);
    expect(s.stats.revenue).toEqual([{ day: s.day, amount: job.localCharges }]);
  });

  it('handling import: agent origin, arrival at the office, then charges', () => {
    const { s, agent } = setup();
    moveOwner(s, 'ops');
    const home = s.offices[0];
    const cashStart = s.cash;
    const job = nextJob(s, 'import');
    expect(job).toMatchObject({
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
      agentReadyDay: s.day + B.agents.handlingDays,
    });
    expect(openTasks(s, job)).toEqual([]);

    s.day = job.agentReadyDay!;
    advanceShipments(s);
    expect(job.status).toBe('atSea');
    expect(openTasks(s, job)).toEqual([]);

    s.day = job.arriveDay!;
    advanceShipments(s);
    expect(openTasks(s, job).map((t) => [t.kind, t.officeId])).toEqual([['arrival', home.id]]);

    complete(s, openTask(s, job, 'arrival')!);
    expect(openTasks(s, job).map((t) => [t.kind, t.officeId])).toEqual([['charges', home.id]]);
    expect(job.status).toBe('destination');

    complete(s, openTask(s, job, 'charges')!);
    expect(job.status).toBe('done');
    expect(s.cash).toBe(cashStart + job.localCharges);
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
    const jobs = s.shipments.filter((sh) => sh.kind === 'handling');
    expect(jobs.length).toBeGreaterThan(0);
    const offices = jobs.map((sh) => (sh.origin.kind === 'office' ? sh.origin : sh.destination));
    expect(new Set(offices.map((end) => end.kind === 'office' && end.officeId))).toEqual(new Set([home.id]));
  });

  it('task labels name the agent', () => {
    const { s, agent } = setup();
    moveOwner(s, 'ops');
    const job = nextJob(s, 'export');
    expect(customerName(s, job)).toBe(agent.name);
    expect(s.log[0].msg).toEqual({
      key: 'log.agentJob',
      params: { name: agent.name, city: 'TPE', amount: job.localCharges },
    });

    const booking = openTask(s, job, 'booking')!;
    s.day = booking.deadline + 1;
    handleMissedDeadlines(s);
    expect(s.log[0].msg).toEqual({ key: 'log.opsLate', params: { customer: agent.name, fee: B.penalties.opsMissFee } });
  });

  it('no customer is created and the customer book is unchanged', () => {
    const { s } = setup();
    moveOwner(s, 'ops');
    const before = structuredClone(s.customers);
    nextJob(s, 'export');
    nextJob(s, 'import');
    expect(s.customers).toEqual(before);
  });

  it('agents send jobs during the daily step once an office has Ops', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    moveOwner(s, 'ops');
    let job: Shipment | undefined;
    for (let i = 0; i < 360 && !job; i++) {
      stepDay(s);
      job = s.shipments.find((sh) => sh.kind === 'handling');
    }
    expect(job).toBeDefined();
    expect(s.customers.some((c) => c.id === job!.customerId)).toBe(false);
  });
});
