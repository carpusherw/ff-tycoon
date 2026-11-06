import { render } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nProvider';
import { B } from '../rules/balance';
import { deliveredSince } from '../rules/chain';
import { cashFlowPerMonth } from '../rules/money';
import { createGame } from '../rules/newGame';
import { pruneState } from '../rules/prune';
import { companyValue } from '../rules/score';
import { cancelHiring, hireCandidate, startHiring } from '../rules/staff';
import { stepDay } from '../rules/step';
import { DEPTS, type DeptKey, type GameState } from '../rules/types';
import type { HomePortId } from '../rules/world';
import { TopBar } from '../ui/TopBar';

// `stepDay` prunes through this module. The flag lets one run play without pruning, as the game did before.
const pruning = vi.hoisted(() => ({ on: true }));
vi.mock('../rules/prune', async (importOriginal) => {
  const real = await importOriginal<typeof import('../rules/prune')>();
  return { ...real, pruneState: (s: GameState) => (pruning.on ? real.pruneState(s) : undefined) };
});

/** Hires `n` staff into `dept`, topping cash up first so a job ad is always affordable. */
function hire(s: GameState, dept: DeptKey, n: number): void {
  while (n > 0) {
    if (s.cash < 10_000) s.cash += 50_000;
    startHiring(s, s.offices[0].id, dept);
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

function newGame(homePortId: HomePortId = 'TPE'): GameState {
  const s = createGame({ seed: 1, homePortId, mode: 'normal' });
  policy.start(s);
  return s;
}

/** Plays one day of `s` with pruning on or off, and returns how long `stepDay` took in milliseconds. */
function playDay(s: GameState, prune: boolean): number {
  policy.beforeDay(s);
  pruning.on = prune;
  const t0 = performance.now();
  stepDay(s);
  const ms = performance.now() - t0;
  pruning.on = true;
  policy.afterDay(s);
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

  it.each<HomePortId>(['TPE', 'RTM'])(
    'keeps the save under 500,000 characters at every month end through day 3600 (%s)',
    (port) => {
      const s = newGame(port);
      let largest = 0;
      for (let day = 1; day <= B.runDays; day++) {
        playDay(s, true);
        if (day % B.daysPerMonth !== 0) continue;
        const size = JSON.stringify(s).length;
        largest = Math.max(largest, size);
        expect(size, `day ${day}`).toBeLessThan(500_000);
      }
      expect(s.day).toBe(B.runDays);
      expect(s.employees.length).toBeGreaterThan(12);
      expect(largest).toBeGreaterThan(0);
    },
  );
});
