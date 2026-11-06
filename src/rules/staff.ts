import { B } from './balance';
import { newId } from './ids';
import { addLog } from './log';
import { PERSON_NAMES } from './names';
import { pick, randInt, randRange } from './rng';
import type { Candidate, DeptKey, GameState, HiringSession, Result } from './types';
import { unassignAll } from './work';
import { COUNTRIES, REGIONS } from './world';

function officePool(s: GameState, officeId: string): { salaryMult: number; skillMult: number } {
  const office = s.offices.find((o) => o.id === officeId);
  if (!office) throw new Error(`Unknown office ${officeId}`);
  return COUNTRIES[REGIONS[office.regionId].country].pool;
}

function position(value: number, min: number, max: number): number {
  return max === min ? 0 : (value - min) / (max - min);
}

/**
 * Rolls one candidate from the office's country pool. Speed and win rate are scaled by the
 * pool's `skillMult`; capacity is an integer drawn from the department's range, unscaled.
 * The asking salary rises with quality: the mean position of each rolled stat in its range.
 */
export function rollCandidate(s: GameState, officeId: string, dept: DeptKey): Candidate {
  const { salaryMult, skillMult } = officePool(s, officeId);
  const h = B.hiring;

  const [sMin, sMax] = [h.speed[0] * skillMult, h.speed[1] * skillMult];
  const speed = randRange(s, sMin, sMax);
  const [cMin, cMax] = h.capacity[dept];
  const capacity = randInt(s, cMin, cMax);
  const parts = [position(speed, sMin, sMax), position(capacity, cMin, cMax)];

  let winRate = 0;
  if (dept === 'sales') {
    const [wMin, wMax] = [h.winRate[0] * skillMult, h.winRate[1] * skillMult];
    winRate = randRange(s, wMin, wMax);
    parts.push(position(winRate, wMin, wMax));
  }

  const quality = parts.reduce((a, b) => a + b, 0) / parts.length;
  const salary = Math.round(h.baseSalary[dept] * salaryMult * (0.75 + 0.5 * quality));
  return { candidateId: newId(s, 'k'), name: pick(s, PERSON_NAMES), speed, capacity, winRate, salary };
}

function rollAll(s: GameState, officeId: string, dept: DeptKey): Candidate[] {
  return Array.from({ length: B.hiring.candidatesPerRoll }, () => rollCandidate(s, officeId, dept));
}

/** Pays for a job ad and opens a hiring session with a fresh roll of candidates; one session at a time. */
export function startHiring(s: GameState, officeId: string, dept: DeptKey): Result {
  if (s.hiring) return { ok: false, reason: 'error.hiringOpen' };
  if (s.cash < B.hiring.jobAdCost) return { ok: false, reason: 'error.cannotAfford' };
  s.cash -= B.hiring.jobAdCost;
  s.yearTotals.hiring += B.hiring.jobAdCost;
  s.hiring = { officeId, dept, candidates: rollAll(s, officeId, dept), hired: [] };
  return { ok: true };
}

export type HiringSlot =
  | { kind: 'open'; candidate: Candidate }
  | { kind: 'hired'; name: string; employeeId: string };

/**
 * The roll in the order it was rolled: each place holds a candidate still on offer or the one hired there.
 * Loading checks that the places add up; if they ever don't, every candidate on offer is still listed once
 * (any left over go at the end) and a hire that has no place left is dropped.
 */
export function hiringSlots(session: HiringSession): HiringSlot[] {
  const total = session.candidates.length + session.hired.length;
  const slots: HiringSlot[] = [];
  let next = 0;
  for (let slot = 0; slot < total; slot++) {
    const hired = session.hired.find((h) => h.slot === slot);
    if (hired) slots.push({ kind: 'hired', name: hired.name, employeeId: hired.employeeId });
    else if (next < session.candidates.length) slots.push({ kind: 'open', candidate: session.candidates[next++] });
  }
  for (; next < session.candidates.length; next++) slots.push({ kind: 'open', candidate: session.candidates[next] });
  return slots;
}

/** Pays to replace every candidate in the open session. */
export function rerollCandidates(s: GameState): Result {
  const session = s.hiring;
  if (!session) return { ok: false, reason: 'error.noHiring' };
  if (s.cash < B.hiring.rerollCost) return { ok: false, reason: 'error.cannotAfford' };
  s.cash -= B.hiring.rerollCost;
  s.yearTotals.hiring += B.hiring.rerollCost;
  session.candidates = rollAll(s, session.officeId, session.dept);
  session.hired = [];
  return { ok: true };
}

/**
 * Hires a candidate from the open session into its office and department. The rest of the roll stays
 * on offer. Hiring the last one leaves the session open with every slot hired, so the player can still
 * re-roll; only `cancelHiring` ends it.
 */
export function hireCandidate(s: GameState, candidateId: string): Result {
  const session = s.hiring;
  if (!session) return { ok: false, reason: 'error.noHiring' };
  const c = session.candidates.find((x) => x.candidateId === candidateId);
  if (!c) return { ok: false, reason: 'error.noCandidate' };
  const slot = hiringSlots(session).findIndex((x) => x.kind === 'open' && x.candidate === c);
  const employeeId = newId(s, 'e');
  s.employees.push({
    id: employeeId,
    name: c.name,
    officeId: session.officeId,
    dept: session.dept,
    isOwner: false,
    salary: c.salary,
    hiredDay: s.day,
    speed: c.speed,
    capacity: c.capacity,
    winRate: c.winRate,
  });
  session.candidates = session.candidates.filter((x) => x !== c);
  session.hired.push({ slot, name: c.name, employeeId });
  addLog(s, 'good', { key: 'log.hired', params: { name: c.name } });
  return { ok: true };
}

/** Closes the hiring session; the money already spent is not refunded. */
export function cancelHiring(s: GameState): void {
  s.hiring = null;
}

/** Moves the owner to another department; their open tasks go back to the queue with progress kept. */
export function moveOwner(s: GameState, dept: DeptKey): void {
  const owner = s.employees.find((e) => e.isOwner);
  if (!owner) return;
  unassignAll(s, owner.id);
  owner.dept = dept;
}
