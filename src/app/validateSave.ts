import type {
  Agent,
  Customer,
  DayDeliveries,
  DayRevenue,
  Employee,
  EndRef,
  GameState,
  HiredSlot,
  HiringSession,
  LogEntry,
  Mode,
  Msg,
  Office,
  PauseReason,
  Shipment,
  ShipmentStatus,
  Task,
  TaskKind,
  YearReport,
  YearStart,
  YearTotals,
} from '../rules/types';
import { B } from '../rules/balance';
import { CURRENT_SAVE_VERSION } from './migrations';
import { arrayOf, bool, candidate, dept, isRecord, nullOr, num, oneOf, shape, str, type Guard } from './saveGuards';

export { isRecord } from './saveGuards';

/**
 * Hand-written check for a stored save. It rejects anything the rules or UI could trip over (wrong
 * primitive types, unknown enum values, non-finite numbers, a hiring session whose slots don't add up,
 * a record pointing at one that isn't there, two records sharing an id).
 */

const mode = oneOf<Mode>({ easy: true, normal: true, hardcore: true });
const taskKind = oneOf<TaskKind>({ quote: true, booking: true, arrival: true, invoice: true, charges: true });
const shipmentStatus = oneOf<ShipmentStatus>({
  quoting: true, lost: true, origin: true, atSea: true, destination: true, done: true,
});
const pauseReason = oneOf<PauseReason>({ yearEnd: true, bankrupt: true, runEnded: true });

const dayRevenue = shape<DayRevenue>({ day: num, invoices: num, charges: num });
const dayDeliveries = shape<DayDeliveries>({ day: num, count: num });

const office = shape<Office>({ id: str, portId: str, regionId: str, rent: num });
const agent = shape<Agent>({ id: str, portId: str, regionId: str, name: str, signedDay: num });
const employee = shape<Employee>({
  id: str, name: str, officeId: str, dept, isOwner: bool, salary: num, hiredDay: num,
  speed: num, capacity: num, winRate: num,
});
const hiredSlot = shape<HiredSlot>({ slot: num, name: str, employeeId: str });
// Required: a session from before hired slots existed is cancelled by `migrateSave` before this check.
const hiringSession = shape<HiringSession>({
  officeId: str, dept, candidates: arrayOf(candidate), hired: arrayOf(hiredSlot),
});
const customer = shape<Customer>({
  id: str, name: str, officeId: str, status: oneOf({ prospect: true, active: true }),
});

const endRef: Guard = (v) =>
  isRecord(v) &&
  ((v.kind === 'office' && str(v.officeId)) || (v.kind === 'agent' && str(v.agentId)));

const shipment = shape<Shipment>({
  id: str, kind: oneOf({ sale: true, handling: true }), customerId: nullOr(str), sellingOfficeId: nullOr(str),
  direction: oneOf({ export: true, import: true }),
  fromPortId: str, toPortId: str, origin: endRef, destination: endRef, status: shipmentStatus,
  margin: num, agentShare: num, localCharges: num, chargesPaid: bool,
  departDay: nullOr(num), arriveDay: nullOr(num), agentReadyDay: nullOr(num),
  arrived: bool, paid: bool, arrivalDone: bool,
});

const task = shape<Task>({
  id: str, kind: taskKind, officeId: str, dept, shipmentId: str, workload: num, progress: num,
  minDuration: num, createdDay: num, deadline: num, assigneeId: nullOr(str), late: bool,
});

const msgParams: Guard = (v) =>
  v === undefined || (isRecord(v) && Object.values(v).every((p) => str(p) || num(p)));
const msg = shape<Msg>({ key: str, params: msgParams });
const logEntry = shape<LogEntry>({ day: num, tone: oneOf({ good: true, bad: true, info: true }), msg });

const ended = nullOr(
  shape<NonNullable<GameState['ended']>>({ reason: oneOf({ completed: true, bankrupt: true }), day: num }),
);
const stats = shape<GameState['stats']>({
  quotesWon: num, quotesLost: num, delivered: arrayOf(dayDeliveries), revenue: arrayOf(dayRevenue),
});

const yearReport = shape<YearReport>({
  year: num, revenue: num, salaries: num, rent: num, fees: num, hiring: num, expansion: num, profit: num,
  cashStart: num, cashEnd: num,
  quotesWon: num, quotesLost: num, shipmentsDelivered: num, staffEnd: num,
});
const yearStart = shape<YearStart>({ cash: num, quotesWon: num, quotesLost: num });
const yearTotals = shape<YearTotals>({ salaries: num, rent: num, fees: num, hiring: num, expansion: num });

const gameState = shape<GameState>({
  version: (v) => v === CURRENT_SAVE_VERSION,
  seed: num, rngState: num, mode, day: num, cash: num, nextId: num,
  offices: arrayOf(office), agents: arrayOf(agent), employees: arrayOf(employee), customers: arrayOf(customer),
  shipments: arrayOf(shipment), tasks: arrayOf(task), hiring: nullOr(hiringSession), log: arrayOf(logEntry),
  pauseReasons: arrayOf(pauseReason), ended, stats,
  // Required: a version-1 save from before year reports existed is rejected, and the player starts fresh.
  yearReports: arrayOf(yearReport), yearStart, yearTotals,
});

/**
 * The roll's places add up: exactly one roll's worth of places, each hire in its own whole-numbered place
 * inside the roll (so the candidates still on offer fill the rest), and each hire is a real employee.
 */
function hiringFits(s: GameState): boolean {
  const h = s.hiring;
  if (!h) return true;
  const n = B.hiring.candidatesPerRoll;
  if (h.candidates.length + h.hired.length !== n) return false;
  const places = new Set(h.hired.map((x) => x.slot));
  if (places.size !== h.hired.length) return false;
  if (!h.hired.every((x) => Number.isInteger(x.slot) && x.slot >= 0 && x.slot < n)) return false;
  const employeeIds = new Set(s.employees.map((e) => e.id));
  return h.hired.every((x) => employeeIds.has(x.employeeId));
}

/** The ids of `records`, or null when two of them share one. */
function idsOf(records: readonly { id: string }[]): Set<string> | null {
  const ids = new Set(records.map((r) => r.id));
  return ids.size === records.length ? ids : null;
}

/**
 * Every link between records points at one that's there: the rules look records up by these ids and would
 * otherwise act on nothing (a task whose shipment is gone can never finish). Pruning only drops records
 * nothing under way points at, so a real save always passes.
 */
function linksHold(s: GameState): boolean {
  const offices = idsOf(s.offices);
  const agents = idsOf(s.agents);
  const employees = idsOf(s.employees);
  const customers = idsOf(s.customers);
  const shipments = idsOf(s.shipments);
  if (!offices || !agents || !employees || !customers || !shipments || !idsOf(s.tasks)) return false;
  // A lost quote drops its prospect at once and the shipment at the next month end, so a finished shipment's
  // customer can be gone; nothing reads it any more.
  const finished = (sh: Shipment) => sh.status === 'done' || sh.status === 'lost';
  const endHolds = (end: EndRef) => (end.kind === 'office' ? offices.has(end.officeId) : agents.has(end.agentId));
  // An agent's handling shipment has no customer and no selling office; a sale has both.
  const soldHolds = (sh: Shipment) =>
    sh.kind === 'handling'
      ? sh.customerId === null && sh.sellingOfficeId === null
      : sh.customerId !== null &&
        sh.sellingOfficeId !== null &&
        (finished(sh) || customers.has(sh.customerId)) &&
        offices.has(sh.sellingOfficeId);
  return (
    s.employees.every((e) => offices.has(e.officeId)) &&
    s.customers.every((c) => offices.has(c.officeId)) &&
    s.shipments.every((sh) => soldHolds(sh) && endHolds(sh.origin) && endHolds(sh.destination)) &&
    s.tasks.every(
      (t) =>
        shipments.has(t.shipmentId) && offices.has(t.officeId) && (t.assigneeId === null || employees.has(t.assigneeId)),
    ) &&
    (s.hiring === null || offices.has(s.hiring.officeId))
  );
}

/** Whether `v` is a save in the current format; `migrateSave` brings older ones up to it first. */
export function isValidSave(v: unknown): v is GameState {
  return gameState(v) && hiringFits(v as GameState) && linksHold(v as GameState);
}
