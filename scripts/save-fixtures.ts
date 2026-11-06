/**
 * The scripted runs behind the golden save fixtures (`npm run save-fixtures`). Each one plays the game the way the
 * app does: `createGame`, then `stepDay` with the player's actions in between (job ads, hires, closing the hiring
 * dialog, resuming after a year end, signing agents, opening a second office), with no cash added. The state is then
 * pruned as loading prunes it, so each fixture is what a player who reloaded that day has saved.
 */
import { B } from '../src/rules/balance';
import { coveredRegions, openOffice, signAgent } from '../src/rules/network';
import { createGame } from '../src/rules/newGame';
import { pruneState } from '../src/rules/prune';
import { cancelHiring, hireCandidate, startHiring } from '../src/rules/staff';
import { stepDay } from '../src/rules/step';
import { DEPTS, type Candidate, type DeptKey, type GameState } from '../src/rules/types';
import { PORTS, route, type HomePortId, type PortId } from '../src/rules/world';

/**
 * A department's open tasks at an office per unit of its capacity: above 1, its queue is longer than its staff can
 * take on.
 */
function backlog(s: GameState, officeId: string, dept: DeptKey): number {
  const open = s.tasks.filter((t) => t.officeId === officeId && t.dept === dept).length;
  const capacity = s.employees
    .filter((e) => e.officeId === officeId && e.dept === dept)
    .reduce((sum, e) => sum + e.capacity, 0);
  return open / Math.max(capacity, 1);
}

function busiestDept(s: GameState, officeId: string): DeptKey {
  return DEPTS.reduce((best, d) => (backlog(s, officeId, d) > backlog(s, officeId, best) ? d : best));
}

/** Monthly payroll and rent. */
function monthlyCosts(s: GameState): number {
  return s.employees.reduce((sum, e) => sum + e.salary, 0) + s.offices.reduce((sum, o) => sum + o.rent, 0);
}

/**
 * Posts a job ad for `dept` at an office (the home office unless named) and hires the candidate with the most work
 * per dollar; the dialog stays open unless `close`.
 */
function hireInto(s: GameState, dept: DeptKey, close = true, officeId = s.offices[0].id): void {
  if (!startHiring(s, officeId, dept).ok) return;
  const value = (c: Candidate) => (c.speed * c.capacity) / c.salary;
  const best = s.hiring!.candidates.reduce((a, b) => (value(b) > value(a) ? b : a));
  hireCandidate(s, best.candidateId);
  if (close) cancelHiring(s);
}

/** The uncovered port the shortest sea route away from the home office, if any is left. */
function nearestUncoveredPort(s: GameState): PortId | undefined {
  const home = s.offices[0].portId as PortId;
  const covered = coveredRegions(s);
  const km = (p: PortId) => route(home, p).distanceKm;
  return (Object.keys(PORTS) as PortId[])
    .filter((p) => !covered.has(PORTS[p].regionId))
    .sort((a, b) => km(a) - km(b) || a.localeCompare(b))[0];
}

/** The far-end port of the home office's busiest lane: the one most of its shipments under way go to or come from. */
function busiestLanePort(s: GameState): PortId | undefined {
  const home = s.offices[0];
  const counts = new Map<PortId, number>();
  for (const sh of s.shipments) {
    if (sh.sellingOfficeId !== home.id) continue;
    const far = (sh.fromPortId === home.portId ? sh.toPortId : sh.fromPortId) as PortId;
    counts.set(far, (counts.get(far) ?? 0) + 1);
  }
  return [...counts].sort(([a, m], [b, n]) => n - m || a.localeCompare(b))[0]?.[0];
}

/**
 * Expands at a month end, keeping 6 months of costs: signs an agent at the nearest uncovered port (one a month, so
 * the handling tasks it brings don't swamp the staff), then, once it can afford one, opens a second office at the
 * port of its busiest lane and hires Ops and Sales there.
 */
function expand(s: GameState): void {
  const near = nearestUncoveredPort(s);
  if (near && s.cash > monthlyCosts(s) * 6 + B.agents.signCost) signAgent(s, near);
  if (s.offices.length > 1 || s.cash <= monthlyCosts(s) * 6 + B.offices.openCost) return;
  const port = busiestLanePort(s);
  if (!port || !openOffice(s, port).ok) return;
  const officeId = s.offices[s.offices.length - 1].id;
  hireInto(s, 'ops', true, officeId);
  hireInto(s, 'sales', true, officeId);
}

/**
 * A careful player: at each month end, hires into each office's department whose queue outgrew it, keeping 4 months
 * of costs, then expands.
 */
function manage(s: GameState): void {
  if (s.day % B.daysPerMonth !== 0) return;
  for (const office of s.offices) {
    const dept = busiestDept(s, office.id);
    if (backlog(s, office.id, dept) > 1 && s.cash > monthlyCosts(s) * 4 + 5_000) hireInto(s, dept, true, office.id);
  }
  expand(s);
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

/** A careful player's run from a new game to `day` (or until it ends), pruned as loading prunes it. */
export function carefulRun(seed: number, homePortId: HomePortId, day: number): GameState {
  const s = newGame(seed, homePortId);
  playTo(s, day);
  pruneState(s);
  return s;
}

/** Prunes `s` as loading would; throws unless its run reached `day` and is still going, or `check` fails. */
function fixture(s: GameState, day: number, check?: [string, (s: GameState) => boolean]): GameState {
  if (s.day !== day || s.ended) throw new Error(`the run ended on day ${s.day}, before day ${day}`);
  if (check && !check[1](s)) throw new Error(`day ${day}: ${check[0]}`);
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

  const agentsSigned = newGame(1, 'TPE');
  playTo(agentsSigned, 500);

  const secondOffice = newGame(1, 'SHA');
  playTo(secondOffice, 1500);

  // Seed 2: seed 3 goes bankrupt before day 2000 under the M2 rules.
  const late = newGame(2, 'RTM');
  playTo(late, 2000);

  return {
    'day-0000-new-game': fixture(fresh, 0),
    'day-0040-staff-hired': fixture(early, 40),
    'day-0150-hiring-open': fixture(hiringOpen, 150),
    'day-0360-year-end': fixture(yearEnd, 360),
    'day-0500-agents-signed': fixture(agentsSigned, 500, [
      'no agent signed after the start',
      (s) => s.agents.some((a) => a.signedDay > 0),
    ]),
    'day-1500-second-office': fixture(secondOffice, 1500, [
      'needs a second office, a handling shipment under way and a charges task',
      (s) =>
        s.offices.length === 2 &&
        s.shipments.some((sh) => sh.kind === 'handling' && sh.status !== 'done') &&
        s.tasks.some((t) => t.kind === 'charges'),
    ]),
    'day-2000-late-game': fixture(late, 2000),
  };
}
