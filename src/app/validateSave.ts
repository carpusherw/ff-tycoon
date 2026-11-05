import type {
  Agent,
  Candidate,
  Customer,
  DeptKey,
  Employee,
  EndRef,
  GameState,
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

/**
 * Hand-written structural check for a stored save. It rejects anything the rules or UI could trip over
 * (wrong primitive types, unknown enum values, non-finite numbers). It does not check cross-references.
 */
type Guard = (v: unknown) => boolean;

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** `spec` must name every field of `T`, so a field added to a type can't be skipped here. */
function shape<T>(spec: { [K in keyof T]-?: Guard }): Guard {
  const entries = Object.entries(spec) as [string, Guard][];
  return (v) => isRecord(v) && entries.every(([key, guard]) => guard(v[key]));
}

function oneOf<T extends string>(allowed: Record<T, true>): Guard {
  return (v) => typeof v === 'string' && Object.hasOwn(allowed, v);
}

const arrayOf = (guard: Guard): Guard => (v) => Array.isArray(v) && v.every(guard);
const nullOr = (guard: Guard): Guard => (v) => v === null || guard(v);
const num: Guard = (v) => typeof v === 'number' && Number.isFinite(v);
const str: Guard = (v) => typeof v === 'string';
const bool: Guard = (v) => typeof v === 'boolean';

const mode = oneOf<Mode>({ easy: true, normal: true, hardcore: true });
const dept = oneOf<DeptKey>({ sales: true, ops: true, accounting: true });
const taskKind = oneOf<TaskKind>({ quote: true, booking: true, arrival: true, invoice: true });
const shipmentStatus = oneOf<ShipmentStatus>({
  quoting: true, lost: true, origin: true, atSea: true, destination: true, done: true,
});
const pauseReason = oneOf<PauseReason>({ yearEnd: true, bankrupt: true, runEnded: true });

const dayAmount = shape<{ day: number; amount: number }>({ day: num, amount: num });

const office = shape<Office>({ id: str, portId: str, regionId: str, rent: num });
const agent = shape<Agent>({ id: str, portId: str, regionId: str });
const employee = shape<Employee>({
  id: str, name: str, officeId: str, dept, isOwner: bool, salary: num, hiredDay: num,
  speed: num, capacity: num, winRate: num,
});
const candidate = shape<Candidate>({
  candidateId: str, name: str, salary: num, speed: num, capacity: num, winRate: num,
});
const hiringSession = shape<HiringSession>({ officeId: str, dept, candidates: arrayOf(candidate) });
const customer = shape<Customer>({
  id: str, name: str, officeId: str, status: oneOf({ prospect: true, active: true }), payments: arrayOf(dayAmount),
});

const endRef: Guard = (v) =>
  isRecord(v) &&
  ((v.kind === 'office' && str(v.officeId)) || (v.kind === 'agent' && str(v.agentId)));

const shipment = shape<Shipment>({
  id: str, customerId: str, sellingOfficeId: str, direction: oneOf({ export: true, import: true }),
  fromPortId: str, toPortId: str, origin: endRef, destination: endRef, status: shipmentStatus,
  margin: num, agentShare: num, departDay: nullOr(num), arriveDay: nullOr(num), agentReadyDay: nullOr(num),
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
  quotesWon: num, quotesLost: num, deliveredDays: arrayOf(num), revenue: arrayOf(dayAmount),
});

const yearReport = shape<YearReport>({
  year: num, revenue: num, salaries: num, rent: num, fees: num, profit: num, cashStart: num, cashEnd: num,
  quotesWon: num, quotesLost: num, shipmentsDelivered: num, staffEnd: num,
});
const yearStart = shape<YearStart>({ cash: num, quotesWon: num, quotesLost: num });
const yearTotals = shape<YearTotals>({ salaries: num, rent: num, fees: num });

const gameState = shape<GameState>({
  version: (v) => v === 1,
  seed: num, rngState: num, mode, day: num, cash: num, nextId: num,
  offices: arrayOf(office), agents: arrayOf(agent), employees: arrayOf(employee), customers: arrayOf(customer),
  shipments: arrayOf(shipment), tasks: arrayOf(task), hiring: nullOr(hiringSession), log: arrayOf(logEntry),
  pauseReasons: arrayOf(pauseReason), ended, stats,
  // Required: a version-1 save from before year reports existed is rejected, and the player starts fresh.
  yearReports: arrayOf(yearReport), yearStart, yearTotals,
});

export function isValidSave(v: unknown): v is GameState {
  return gameState(v);
}
