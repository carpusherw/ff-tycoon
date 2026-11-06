import { render } from '@testing-library/react';
import { carefulRun } from '../../scripts/save-fixtures';
import { I18nProvider } from '../i18n/I18nProvider';
import { B } from '../rules/balance';
import { deliveredSince } from '../rules/chain';
import { cashFlowPerMonth } from '../rules/money';
import { coveredRegions, lanesFor, openOffice, signAgent } from '../rules/network';
import { createGame } from '../rules/newGame';
import { pruneState } from '../rules/prune';
import { companyValue } from '../rules/score';
import { cancelHiring, hireCandidate, startHiring } from '../rules/staff';
import { stepDay } from '../rules/step';
import { DEPTS, type DeptKey, type GameState } from '../rules/types';
import { PORTS, type HomePortId, type PortId } from '../rules/world';
import { TopBar } from '../ui/TopBar';

// `stepDay` prunes through this module. The flag lets one run play without pruning, as the game did before.
const pruning = vi.hoisted(() => ({ on: true }));
vi.mock('../rules/prune', async (importOriginal) => {
  const real = await importOriginal<typeof import('../rules/prune')>();
  return { ...real, pruneState: (s: GameState) => (pruning.on ? real.pruneState(s) : undefined) };
});

/** Save budget in characters: browsers keep about 5.2M per site, leaving room for the backup copy. */
const SAVE_BUDGET = 1_500_000;

/**
 * Hires `n` staff into `dept` at an office (the home office unless named), topping cash up first so a job ad is
 * always affordable.
 */
function hire(s: GameState, dept: DeptKey, n: number, officeId = s.offices[0].id): void {
  while (n > 0) {
    if (s.cash < 10_000) s.cash += 50_000;
    startHiring(s, officeId, dept);
    while (n > 0 && s.hiring!.candidates.length > 0) {
      hireCandidate(s, s.hiring!.candidates[0].candidateId);
      n -= 1;
    }
    cancelHiring(s);
  }
}

/**
 * A busy company's 10 years: several staff per department from the start, more whenever a department's open
 * tasks pass 80% of its capacity, and cash topped up so it never goes bankrupt. Only reads what pruning keeps.
 */
const policy = {
  start(s: GameState): void {
    hire(s, 'sales', 4);
    hire(s, 'ops', 4);
    hire(s, 'accounting', 3);
  },
  beforeDay(s: GameState): void {
    const monthly = s.employees.reduce((a, e) => a + e.salary, 0) + s.offices.reduce((a, o) => a + o.rent, 0);
    if (s.cash < monthly * 2 + 10_000) s.cash += monthly * 3 + 20_000;
  },
  afterDay(s: GameState): void {
    s.pauseReasons = [];
    if (s.day % B.daysPerMonth !== 0) return;
    for (const dept of DEPTS) {
      const open = s.tasks.filter((t) => t.dept === dept).length;
      const capacity = s.employees.filter((e) => e.dept === dept).reduce((a, e) => a + e.capacity, 0);
      if (open > capacity * 0.8) hire(s, dept, Math.ceil((open - capacity * 0.8) / 3));
    }
  },
};

/** Hires into each office's departments whose open tasks pass 80% of their capacity. */
function hireToWorkload(s: GameState): void {
  for (const office of s.offices) {
    for (const dept of DEPTS) {
      const open = s.tasks.filter((t) => t.officeId === office.id && t.dept === dept).length;
      const capacity = s.employees
        .filter((e) => e.officeId === office.id && e.dept === dept)
        .reduce((a, e) => a + e.capacity, 0);
      if (open > capacity * 0.8) hire(s, dept, Math.ceil((open - capacity * 0.8) / 3), office.id);
    }
  }
}

/** Where the stress player opens its three other offices: the first three of these outside its home region. */
const STRESS_OFFICE_PORTS: PortId[] = ['LAX', 'RTM', 'SIN', 'SHA'];

/**
 * The busy company growing a full network: an agent signed at a month end until every region is covered (by year
 * 3), then three more offices opened at the end of year 4, so four offices trade on 22 lanes for years 5 to 10, each
 * staffed and hiring to its own workload. Cash is topped up as for the busy company.
 */
const stress = {
  start: policy.start,
  beforeDay: policy.beforeDay,
  afterDay(s: GameState): void {
    s.pauseReasons = [];
    if (s.day % B.daysPerMonth !== 0) return;
    const covered = coveredRegions(s);
    const uncovered = (Object.keys(PORTS) as PortId[]).find((p) => !covered.has(PORTS[p].regionId));
    if (uncovered) {
      if (s.cash < B.agents.signCost) s.cash += 50_000;
      signAgent(s, uncovered);
    }
    if (s.day === B.daysPerYear * 4) {
      const home = s.offices[0].regionId;
      for (const port of STRESS_OFFICE_PORTS.filter((p) => PORTS[p].regionId !== home).slice(0, 3)) {
        if (s.cash < B.offices.openCost) s.cash += 100_000;
        openOffice(s, port);
        const officeId = s.offices[s.offices.length - 1].id;
        hire(s, 'sales', 2, officeId);
        hire(s, 'ops', 2, officeId);
        hire(s, 'accounting', 2, officeId);
      }
    }
    hireToWorkload(s);
  },
};

type Player = typeof policy;

function newGame(homePortId: HomePortId = 'TPE', player: Player = policy): GameState {
  const s = createGame({ seed: 1, homePortId, mode: 'normal' });
  player.start(s);
  return s;
}

/** Plays one day of `s` with pruning on or off, and returns how long `stepDay` took in milliseconds. */
function playDay(s: GameState, prune: boolean, player: Player = policy): number {
  player.beforeDay(s);
  pruning.on = prune;
  const t0 = performance.now();
  stepDay(s);
  const ms = performance.now() - t0;
  pruning.on = true;
  player.afterDay(s);
  return ms;
}

/** What the top bar shows for `s`: cash, cash flow, date, win rate, shipments per operator, staff. */
function topBarText(s: GameState): string {
  const view = render(
    <I18nProvider lang="en">
      <TopBar state={s} speed={1} onSpeed={() => {}} />
    </I18nProvider>,
  );
  const text = view.container.textContent ?? '';
  view.unmount();
  return text;
}

/** Deliveries in the last 30 days, the count behind the top bar's shipments per operator. */
const deliveredThisMonth = (s: GameState) => deliveredSince(s, s.day - B.daysPerMonth);

const TOP_BAR_CHECKPOINTS = new Set([45, 360, 1234, 2520, 2999, 3600]);

describe('a 10-year run with heavy hiring', () => {
  it('scores the same with and without pruning, and plays faster with it', { timeout: 30_000 }, () => {
    const pruned = newGame();
    const full = newGame();
    let prunedMs = 0;
    let fullMs = 0;
    let checks = 0;
    for (let day = 1; day <= B.runDays; day++) {
      prunedMs += playDay(pruned, true);
      fullMs += playDay(full, false);
      expect(pruned.day).toBe(day);
      expect(pruned.ended?.reason ?? 'playing').not.toBe('bankrupt');
      expect(pruned.cash).toBe(full.cash);
      expect(pruned.stats.quotesWon).toBe(full.stats.quotesWon);
      expect(pruned.stats.quotesLost).toBe(full.stats.quotesLost);
      expect(companyValue(pruned)).toEqual(companyValue(full));
      expect(cashFlowPerMonth(pruned)).toEqual(cashFlowPerMonth(full));
      expect(deliveredThisMonth(pruned)).toBe(deliveredThisMonth(full));
      expect(pruned.employees).toEqual(full.employees);
      expect(pruned.tasks).toEqual(full.tasks);
      expect(pruned.rngState).toBe(full.rngState);
      if (TOP_BAR_CHECKPOINTS.has(day)) {
        expect(topBarText(pruned)).toBe(topBarText(full));
        checks += 1;
      }
      if (day % B.daysPerYear === 0) {
        expect(pruned.yearReports).toEqual(full.yearReports);
        // Pruning removes entries and nothing else: the full run pruned now is the pruned run.
        const fullPrunedNow = structuredClone(full);
        pruneState(fullPrunedNow);
        expect(pruned).toEqual(fullPrunedNow);
      }
    }
    expect(checks).toBe(TOP_BAR_CHECKPOINTS.size);
    expect(pruned.ended?.reason).toBe('completed');
    expect(pruned.yearReports).toHaveLength(10);
    // The run was busy enough to matter: thousands of finished shipments without pruning.
    expect(full.shipments.length).toBeGreaterThan(10_000);
    expect(prunedMs).toBeLessThan(fullMs);
  });
});

describe('a 10-year run growing a full network', () => {
  it.each<HomePortId>(['TPE', 'RTM'])(
    'keeps the save within the budget at every month end through day 3600, and steps a day in under 20 ms (%s)',
    { timeout: 60_000 },
    (port) => {
      const s = newGame(port, stress);
      let largest = 0;
      const fullNetworkMs: number[] = [];
      for (let day = 1; day <= B.runDays; day++) {
        const ms = playDay(s, true, stress);
        if (s.offices.length === 4) fullNetworkMs.push(ms);
        if (day === B.daysPerYear * 3) expect(coveredRegions(s).size, 'regions covered by year 3').toBe(23);
        if (day % B.daysPerMonth !== 0) continue;
        const size = JSON.stringify(s).length;
        largest = Math.max(largest, size);
        expect(size, `day ${day}`).toBeLessThan(SAVE_BUDGET);
      }
      expect(s.day).toBe(B.runDays);
      expect(s.agents).toHaveLength(22);
      expect(s.offices).toHaveLength(4);
      for (const office of s.offices) expect(lanesFor(s, office.id)).toHaveLength(22);
      expect(s.shipments.some((sh) => sh.kind === 'handling')).toBe(true);
      expect(largest).toBeGreaterThan(0);
      fullNetworkMs.sort((a, b) => a - b);
      expect(fullNetworkMs[Math.floor(fullNetworkMs.length / 2)]).toBeLessThan(20);
    },
  );
});

describe("the fixture player's 10-year saves", () => {
  it.each<[number, HomePortId]>([
    [1, 'SHA'],
    [1, 'TPE'],
    [2, 'RTM'],
  ])(
    'a careful player with a second office stays within the budget at day 3600 (seed %i, %s)',
    { timeout: 60_000 },
    (seed, port) => {
      const s = carefulRun(seed, port, B.runDays);
      expect(s.day).toBe(B.runDays);
      expect(s.ended?.reason).toBe('completed');
      expect(s.offices).toHaveLength(2);
      expect(JSON.stringify(s).length).toBeLessThan(SAVE_BUDGET);
    },
  );
});
