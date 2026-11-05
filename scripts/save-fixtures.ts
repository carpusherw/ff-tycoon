/**
 * The scripted runs behind the golden save fixtures (`npm run save-fixtures`). Each one plays the game the way the
 * app does: `createGame`, then `stepDay` with the player's actions in between (job ads, hires, closing the hiring
 * dialog, resuming after a year end), with no cash added. The state is then pruned as loading prunes it, so each
 * fixture is what a player who reloaded that day has saved.
 */
import { B } from '../src/rules/balance';
import { createGame } from '../src/rules/newGame';
import { pruneState } from '../src/rules/prune';
import { cancelHiring, hireCandidate, startHiring } from '../src/rules/staff';
import { stepDay } from '../src/rules/step';
import { DEPTS, type Candidate, type DeptKey, type GameState } from '../src/rules/types';
import type { HomePortId } from '../src/rules/world';

/** Open tasks per unit of the department's capacity: above 1, its queue is longer than its staff can take on. */
function backlog(s: GameState, dept: DeptKey): number {
  const open = s.tasks.filter((t) => t.dept === dept).length;
  const capacity = s.employees.filter((e) => e.dept === dept).reduce((sum, e) => sum + e.capacity, 0);
  return open / Math.max(capacity, 1);
}

function busiestDept(s: GameState): DeptKey {
  return DEPTS.reduce((best, d) => (backlog(s, d) > backlog(s, best) ? d : best));
}

/** Monthly payroll and rent. */
function monthlyCosts(s: GameState): number {
  return s.employees.reduce((sum, e) => sum + e.salary, 0) + s.offices.reduce((sum, o) => sum + o.rent, 0);
}

/** Posts a job ad for `dept` and hires the candidate with the most work per dollar; the dialog stays open unless `close`. */
function hireInto(s: GameState, dept: DeptKey, close = true): void {
  if (!startHiring(s, s.offices[0].id, dept).ok) return;
  const value = (c: Candidate) => (c.speed * c.capacity) / c.salary;
  const best = s.hiring!.candidates.reduce((a, b) => (value(b) > value(a) ? b : a));
  hireCandidate(s, best.candidateId);
  if (close) cancelHiring(s);
}

/** A careful player: at each month end, hires into a department whose queue outgrew it, keeping 4 months of costs. */
function manage(s: GameState): void {
  if (s.day % B.daysPerMonth !== 0) return;
  const dept = busiestDept(s);
  if (backlog(s, dept) > 1 && s.cash > monthlyCosts(s) * 4 + 5_000) hireInto(s, dept);
}

/** Plays to `day`, resuming after every year end before it, as a player pressing Resume would. */
function playTo(s: GameState, day: number): void {
  while (s.day < day && !s.ended) {
    stepDay(s);
    if (s.day < day) {
      s.pauseReasons = s.pauseReasons.filter((r) => r !== 'yearEnd');
      manage(s);
    }
  }
}

function newGame(seed: number, homePortId: HomePortId): GameState {
  return createGame({ seed, homePortId, mode: 'normal' });
}

function fixture(s: GameState): GameState {
  pruneState(s);
  return s;
}

/** File name (without `.json`) → state. */
export function buildSaveFixtures(): Record<string, GameState> {
  const fresh = newGame(1, 'TPE');

  const early = newGame(2, 'SHA');
  playTo(early, 3);
  hireInto(early, 'ops');
  playTo(early, 12);
  hireInto(early, 'accounting');
  playTo(early, 40);

  // Mid-run with the hiring dialog open after one hire, so the session has a hired slot and two candidates.
  const hiringOpen = newGame(3, 'SIN');
  playTo(hiringOpen, 150);
  hireInto(hiringOpen, 'sales', false);

  // Day 360 as the year end paused it: its report is written and the Resume banner is up.
  const yearEnd = newGame(2, 'LAX');
  playTo(yearEnd, 360);

  const late = newGame(3, 'RTM');
  playTo(late, 2000);

  return {
    'day-0000-new-game': fixture(fresh),
    'day-0040-staff-hired': fixture(early),
    'day-0150-hiring-open': fixture(hiringOpen),
    'day-0360-year-end': fixture(yearEnd),
    'day-2000-late-game': fixture(late),
  };
}
