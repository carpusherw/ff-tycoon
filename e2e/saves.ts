/**
 * Saved games for the end-to-end checks, built in Node with the real rules: `createGame`, then `stepDay` with a
 * careful player's hires, agent signings and second office in between and no cash added, pruned as loading prunes
 * them. The specs seed them into `localStorage`. `fullNetwork`, for layout checks only, sets cash directly.
 */
import type { Page } from '@playwright/test';
import { SAVE_KEY } from '../src/app/persistence';
import { B } from '../src/rules/balance';
import { canSign, coveredRegions, openOffice, signAgent } from '../src/rules/network';
import { createGame } from '../src/rules/newGame';
import { pruneState } from '../src/rules/prune';
import { cancelHiring, hireCandidate, startHiring } from '../src/rules/staff';
import { stepDay } from '../src/rules/step';
import { DEPTS, type Candidate, type DeptKey, type GameState } from '../src/rules/types';
import { PORTS, route, type PortId } from '../src/rules/world';

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

/** Monthly payroll and rent. */
function monthlyCosts(s: GameState): number {
  return s.employees.reduce((sum, e) => sum + e.salary, 0) + s.offices.reduce((sum, o) => sum + o.rent, 0);
}

/** Posts a job ad for `dept` at an office, hires the candidate with the most work per dollar and closes the dialog. */
function hire(s: GameState, dept: DeptKey, officeId: string): void {
  if (!startHiring(s, officeId, dept).ok) return;
  const value = (c: Candidate) => (c.speed * c.capacity) / c.salary;
  const best = s.hiring!.candidates.reduce((a, b) => (value(b) > value(a) ? b : a));
  hireCandidate(s, best.candidateId);
  cancelHiring(s);
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
 * Expands at a month end, keeping 6 months of costs: signs an agent at the nearest uncovered port (one a month),
 * then, once it can afford one, opens a second office at the port of its busiest lane and hires Ops and Sales there.
 */
function expand(s: GameState): void {
  const near = nearestUncoveredPort(s);
  if (near && s.cash > monthlyCosts(s) * 6 + B.agents.signCost) signAgent(s, near);
  if (s.offices.length > 1 || s.cash <= monthlyCosts(s) * 6 + B.offices.openCost) return;
  const port = busiestLanePort(s);
  if (!port || !openOffice(s, port).ok) return;
  const officeId = s.offices[s.offices.length - 1].id;
  hire(s, 'ops', officeId);
  hire(s, 'sales', officeId);
}

/**
 * At each month end, hires into each office's busiest department when its queue outgrew it, keeping 4 months of
 * costs, then expands.
 */
function manage(s: GameState): void {
  if (s.day % B.daysPerMonth !== 0) return;
  for (const office of s.offices) {
    const dept = DEPTS.reduce((best, d) => (backlog(s, office.id, d) > backlog(s, office.id, best) ? d : best));
    if (backlog(s, office.id, dept) > 1 && s.cash > monthlyCosts(s) * 4 + 5_000) hire(s, dept, office.id);
  }
  expand(s);
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

/** Where `fullNetwork` opens its three other offices: a crowded corner each, away from the Southeast Asia cluster. */
const FULL_NETWORK_OFFICES: PortId[] = ['SHA', 'RTM', 'LAX'];

/**
 * The map at its most crowded, for layout checks only: a Taipei company on day 0 with an agent at every other port and
 * offices at Shanghai, Rotterdam and Los Angeles, signed and opened with the real rules. Cash is set directly so it
 * can pay for all of it.
 */
export function fullNetwork(): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.cash = 1_000_000;
  for (const port of Object.keys(PORTS) as PortId[]) if (canSign(s, port).ok) signAgent(s, port);
  for (const port of FULL_NETWORK_OFFICES) {
    const r = openOffice(s, port);
    if (!r.ok) throw new Error(`can't open an office at ${port}: ${r.reason}`);
  }
  if (coveredRegions(s).size !== Object.keys(PORTS).length) throw new Error('a port is left uncovered');
  return s;
}

/**
 * A Taipei company whose home Operations has late tasks (only the owner works there, in Sales), plus a second office
 * at Singapore with nobody in it, so one Operations header has a late badge and the other has none.
 */
export function lateOperations(): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  const home = s.offices[0].id;
  const late = () => s.tasks.some((t) => t.officeId === home && t.dept === 'ops' && t.deadline < s.day);
  while (!late()) {
    if (s.day >= B.daysPerYear) throw new Error('no Operations task went late in a year');
    stepDay(s);
  }
  const r = openOffice(s, 'SIN');
  if (!r.ok) throw new Error(`can't open an office at Singapore: ${r.reason}`);
  pruneState(s);
  return s;
}

/**
 * Stores `state` as the saved game before the page first loads. Only once per tab, so a reload loads what the game
 * itself saved.
 */
export async function seedSave(page: Page, state: GameState): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem('e2e-seeded')) return;
      window.sessionStorage.setItem('e2e-seeded', '1');
      window.localStorage.setItem(key, value);
    },
    [SAVE_KEY, JSON.stringify(state)],
  );
}
