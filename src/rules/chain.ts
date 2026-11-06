import { B } from './balance';
import { newId } from './ids';
import { addLog } from './log';
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

export function customerName(s: GameState, shipment: Shipment): string {
  return s.customers.find((c) => c.id === shipment.customerId)?.name ?? '';
}

function startOrigin(s: GameState, shipment: Shipment): void {
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
  // Task 6/7: only a sale is invoiced, and a sale always has a selling office.
  if (shipment.direction === 'export') createTask(s, 'invoice', shipment, shipment.sellingOfficeId!);
}

function arrive(s: GameState, shipment: Shipment): void {
  shipment.arrived = true;
  shipment.status = 'destination';
  if (shipment.destination.kind === 'office') {
    createTask(s, 'arrival', shipment, shipment.destination.officeId);
  }
  // Task 6/7: only a sale is invoiced, and a sale always has a selling office.
  if (shipment.direction === 'import') createTask(s, 'invoice', shipment, shipment.sellingOfficeId!);
  maybeFinish(s, shipment);
}

function maybeFinish(s: GameState, shipment: Shipment): void {
  if (shipment.status === 'done') return;
  const destinationDone = shipment.destination.kind === 'agent' || shipment.arrivalDone;
  if (shipment.arrived && shipment.paid && destinationDone) {
    shipment.status = 'done';
    s.stats.deliveredDays.push(s.day);
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
  s.customers.find((c) => c.id === shipment.customerId)?.payments.push({ day: s.day, amount });
  s.stats.revenue.push({ day: s.day, amount });
  shipment.paid = true;
  addLog(s, 'good', { key: 'log.paid', params: { customer: customerName(s, shipment), amount } });
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
      depart(s, shipment);
      break;
    case 'arrival':
      shipment.arrivalDone = true;
      maybeFinish(s, shipment);
      break;
    case 'invoice':
      completeInvoice(s, shipment);
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
