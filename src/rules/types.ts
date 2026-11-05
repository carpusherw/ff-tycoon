import type { MsgKey } from '../i18n/en';
export type Mode = 'easy' | 'normal' | 'hardcore';
export type DeptKey = 'sales' | 'ops' | 'accounting';
export const DEPTS: readonly DeptKey[] = ['sales', 'ops', 'accounting'];
export type TaskKind = 'quote' | 'booking' | 'arrival' | 'invoice';
export type ShipmentStatus = 'quoting' | 'lost' | 'origin' | 'atSea' | 'destination' | 'done';
export type EndRef = { kind: 'office'; officeId: string } | { kind: 'agent'; agentId: string };
export type Msg = { key: MsgKey; params?: Record<string, string | number> };
export type Result = { ok: true } | { ok: false; reason: MsgKey };
export interface Stats3 { speed: number; capacity: number; winRate: number }
export interface Employee extends Stats3 { id: string; name: string; officeId: string; dept: DeptKey;
  isOwner: boolean; salary: number; hiredDay: number }
export interface Candidate extends Stats3 { candidateId: string; name: string; salary: number }
export interface HiringSession { officeId: string; dept: DeptKey; candidates: Candidate[] }
export interface Office { id: string; portId: string; regionId: string; rent: number }
export interface Agent { id: string; portId: string; regionId: string }
export interface Customer { id: string; name: string; officeId: string; status: 'prospect' | 'active';
  payments: { day: number; amount: number }[] }
export interface Shipment { id: string; customerId: string; sellingOfficeId: string; direction: 'export' | 'import';
  fromPortId: string; toPortId: string; origin: EndRef; destination: EndRef; status: ShipmentStatus;
  margin: number; agentShare: number; departDay: number | null; arriveDay: number | null;
  agentReadyDay: number | null; arrived: boolean; paid: boolean; arrivalDone: boolean }
export interface Task { id: string; kind: TaskKind; officeId: string; dept: DeptKey; shipmentId: string;
  workload: number; progress: number; minDuration: number; createdDay: number; deadline: number;
  assigneeId: string | null; late: boolean }
export type PauseReason = 'yearEnd' | 'bankrupt' | 'runEnded';
export interface LogEntry { day: number; tone: 'good' | 'bad' | 'info'; msg: Msg }
/** One finished year's figures, covering days `(year - 1) * 360 + 1` to `year * 360`. */
export interface YearReport { year: number; revenue: number; salaries: number; rent: number; fees: number;
  /** Job ads and re-rolls. */ hiring: number; profit: number; cashStart: number; cashEnd: number; quotesWon: number; quotesLost: number;
  shipmentsDelivered: number; staffEnd: number }
/** Figures at the start of the current year, so its report can count only that year. */
export interface YearStart { cash: number; quotesWon: number; quotesLost: number }
/** Costs paid so far in the current year. */
export interface YearTotals { salaries: number; rent: number; fees: number; hiring: number }
export interface GameState { version: 1; seed: number; rngState: number; mode: Mode; day: number; cash: number;
  nextId: number; offices: Office[]; agents: Agent[]; employees: Employee[]; customers: Customer[];
  shipments: Shipment[]; tasks: Task[]; hiring: HiringSession | null; log: LogEntry[];
  pauseReasons: PauseReason[]; ended: null | { reason: 'completed' | 'bankrupt'; day: number };
  stats: { quotesWon: number; quotesLost: number; deliveredDays: number[]; revenue: { day: number; amount: number }[] };
  yearReports: YearReport[]; yearStart: YearStart; yearTotals: YearTotals }
