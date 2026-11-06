import { B } from './balance';
import { newId } from './ids';
import { addLog } from './log';
import { addRevenue } from './money';
import { chance, randRange } from './rng';
import { winChance } from './sales';
import type { DeptKey, GameState, Shipment, Task, TaskKind } from './types';
import { transitDays, type PortId } from './world';

const DEPT_OF: Record<TaskKind, DeptKey> = {
  quote: 'sales',
  booking: 'ops',
  arrival: 'ops',
  invoice: 'accounting',
  charges: 'accounting',
};

export function createTask(s: GameState, kind: TaskKind, shipment: Shipment, officeId: string): Task {
  const spec = B.tasks[kind];
  const task: Task = {
    id: newId(s, 't'),
    kind,
    officeId,
    dept: DEPT_OF[kind],
    shipmentId: shipment.id,
    workload: randRange(s, spec.workload[0], spec.workload[1]),
    progress: 0,
    minDuration: spec.minDuration,
    createdDay: s.day,
    deadline: s.day + spec.deadlineDays,
    assigneeId: null,
    late: false,
  };
  s.tasks.push(task);
  return task;
}

/** Who a shipment is for: its customer, or for a handling shipment the agent that sent it. */
export function customerName(s: GameState, shipment: Shipment): string {
  if (shipment.kind === 'handling') {
    const end = shipment.origin.kind === 'agent' ? shipment.origin : shipment.destination;
    return (end.kind === 'agent' && s.agents.find((a) => a.id === end.agentId)?.name) || '';
  }
  return s.customers.find((c) => c.id === shipment.customerId)?.name ?? '';
}

/** Bills the customer. Only a sale has one, and its selling office sends the invoice. */
function createInvoice(s: GameState, shipment: Shipment): void {
  const officeId = shipment.kind === 'sale' ? shipment.sellingOfficeId : null;
  if (officeId) createTask(s, 'invoice', shipment, officeId);
}

/** A booking or arrival worked by an office that didn't sell the shipment: that office bills its local charges. */
function billFarOffice(s: GameState, task: Task, shipment: Shipment): void {
  if (task.officeId !== shipment.sellingOfficeId) createTask(s, 'charges', shipment, task.officeId);
}

/** Starts a shipment's origin leg: a booking at an own office, or the agent's handling days. */
export function startOrigin(s: GameState, shipment: Shipment): void {
  shipment.status = 'origin';
  if (shipment.origin.kind === 'office') {
    createTask(s, 'booking', shipment, shipment.origin.officeId);
  } else {
    shipment.agentReadyDay = s.day + B.agents.handlingDays;
  }
}

function depart(s: GameState, shipment: Shipment): void {
  shipment.status = 'atSea';
  shipment.departDay = s.day;
  shipment.arriveDay = s.day + transitDays(shipment.fromPortId as PortId, shipment.toPortId as PortId);
  if (shipment.direction === 'export') createInvoice(s, shipment);
}

function arrive(s: GameState, shipment: Shipment): void {
  shipment.arrived = true;
  shipment.status = 'destination';
  if (shipment.destination.kind === 'office') {
    createTask(s, 'arrival', shipment, shipment.destination.officeId);
  }
  if (shipment.direction === 'import') createInvoice(s, shipment);
  maybeFinish(s, shipment);
}

/** Counts a shipment delivered today in today's entry. */
export function recordDelivery(s: GameState): void {
  const today = s.stats.delivered.at(-1);
  if (today?.day === s.day) today.count += 1;
  else s.stats.delivered.push({ day: s.day, count: 1 });
}

/** Shipments delivered after day `since`, up to today. */
export function deliveredSince(s: GameState, since: number): number {
  return s.stats.delivered.reduce((sum, d) => (d.day > since ? sum + d.count : sum), 0);
}

function maybeFinish(s: GameState, shipment: Shipment): void {
  if (shipment.status === 'done') return;
  const paid = shipment.kind === 'handling' || shipment.paid;
  const destinationDone = shipment.destination.kind === 'agent' || shipment.arrivalDone;
  const chargesDone = shipment.localCharges === 0 || shipment.chargesPaid;
  if (shipment.arrived && paid && destinationDone && chargesDone) {
    shipment.status = 'done';
    recordDelivery(s);
  }
}

function completeQuote(s: GameState, task: Task, shipment: Shipment): void {
  const customer = s.customers.find((c) => c.id === shipment.customerId);
  const assignee = s.employees.find((e) => e.id === task.assigneeId);
  const won = assignee !== undefined && chance(s, winChance(assignee));
  const params = { customer: customer?.name ?? '' };
  if (won) {
    if (customer) customer.status = 'active';
    s.stats.quotesWon += 1;
    addLog(s, 'good', { key: 'log.quoteWon', params });
    startOrigin(s, shipment);
  } else {
    loseQuote(s, shipment);
    addLog(s, 'bad', { key: 'log.quoteLost', params });
  }
}

/** Marks a shipment's quote as lost and drops the customer if they were only a prospect. */
export function loseQuote(s: GameState, shipment: Shipment): void {
  shipment.status = 'lost';
  s.stats.quotesLost += 1;
  s.customers = s.customers.filter((c) => c.id !== shipment.customerId || c.status !== 'prospect');
}

function completeInvoice(s: GameState, shipment: Shipment): void {
  const amount = shipment.margin - shipment.agentShare;
  s.cash += amount;
  addRevenue(s, 'invoices', amount);
  shipment.paid = true;
  addLog(s, 'good', { key: 'log.paid', params: { customer: customerName(s, shipment), amount } });
  maybeFinish(s, shipment);
}

function completeCharges(s: GameState, task: Task, shipment: Shipment): void {
  const amount = shipment.localCharges;
  s.cash += amount;
  addRevenue(s, 'charges', amount);
  shipment.chargesPaid = true;
  const city = s.offices.find((o) => o.id === task.officeId)?.portId ?? '';
  addLog(s, 'good', { key: 'log.chargesPaid', params: { city, amount } });
  maybeFinish(s, shipment);
}

/** Moves a shipment along its chain once one of its tasks is finished. */
export function onTaskCompleted(s: GameState, task: Task): void {
  const shipment = s.shipments.find((sh) => sh.id === task.shipmentId);
  if (!shipment) return;
  switch (task.kind) {
    case 'quote':
      completeQuote(s, task, shipment);
      break;
    case 'booking':
      billFarOffice(s, task, shipment);
      depart(s, shipment);
      break;
    case 'arrival':
      shipment.arrivalDone = true;
      billFarOffice(s, task, shipment);
      maybeFinish(s, shipment);
      break;
    case 'invoice':
      completeInvoice(s, shipment);
      break;
    case 'charges':
      completeCharges(s, task, shipment);
      break;
  }
}

/** Sails ships whose origin agent is ready today, and lands ships due today. */
export function advanceShipments(s: GameState): void {
  for (const shipment of s.shipments) {
    if (shipment.agentReadyDay === s.day) depart(s, shipment);
    if (shipment.arriveDay === s.day) arrive(s, shipment);
  }
}
