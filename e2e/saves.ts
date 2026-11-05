/**
 * Saved games for the end-to-end checks, built in Node with the real rules: `createGame`, then `stepDay` with a
 * careful player's hires in between and no cash added, pruned as loading prunes them. The specs seed them into
 * `localStorage`.
 */
import { B } from '../src/rules/balance';
import { createGame } from '../src/rules/newGame';
import { pruneState } from '../src/rules/prune';
import { cancelHiring, hireCandidate, startHiring } from '../src/rules/staff';
import { stepDay } from '../src/rules/step';
import { DEPTS, type Candidate, type DeptKey, type GameState } from '../src/rules/types';

/** Open tasks per unit of the department's capacity: above 1, its queue is longer than its staff can take on. */
function backlog(s: GameState, dept: DeptKey): number {
  const open = s.tasks.filter((t) => t.dept === dept).length;
  const capacity = s.employees.filter((e) => e.dept === dept).reduce((sum, e) => sum + e.capacity, 0);
  return open / Math.max(capacity, 1);
}

/** Monthly payroll and rent. */
function monthlyCosts(s: GameState): number {
  return s.employees.reduce((sum, e) => sum + e.salary, 0) + s.offices.reduce((sum, o) => sum + o.rent, 0);
}

/** Posts a job ad for `dept`, hires the candidate with the most work per dollar and closes the dialog. */
function hire(s: GameState, dept: DeptKey): void {
  if (!startHiring(s, s.offices[0].id, dept).ok) return;
  const value = (c: Candidate) => (c.speed * c.capacity) / c.salary;
  const best = s.hiring!.candidates.reduce((a, b) => (value(b) > value(a) ? b : a));
  hireCandidate(s, best.candidateId);
  cancelHiring(s);
}

/** At each month end, hires into the busiest department when its queue outgrew it, keeping 4 months of costs. */
function manage(s: GameState): void {
  if (s.day % B.daysPerMonth !== 0) return;
  const dept = DEPTS.reduce((best, d) => (backlog(s, d) > backlog(s, best) ? d : best));
  if (backlog(s, dept) > 1 && s.cash > monthlyCosts(s) * 4 + 5_000) hire(s, dept);
}

/**
 * A Shanghai company (seed 1) played to `day`, resuming after every year end on the way. Shanghai, because this
 * player keeps it solvent for all ten years, so the last day can be seeded without adding cash.
 */
export function savedGame(day: number): GameState {
  const s = createGame({ seed: 1, homePortId: 'SHA', mode: 'normal' });
  while (s.day < day && !s.ended) {
    stepDay(s);
    s.pauseReasons = s.pauseReasons.filter((r) => r !== 'yearEnd');
    manage(s);
  }
  if (s.day !== day) throw new Error(`the run ended on day ${s.day}, before day ${day}`);
  pruneState(s);
  return s;
}
