import { B } from './balance';
import { createGame } from './newGame';
import { hireCandidate, moveOwner, startHiring } from './staff';
import { stepDay } from './step';
import { DEPTS, type GameState } from './types';

function newGame(seed = 1): GameState {
  return createGame({ seed, homePortId: 'TPE', mode: 'normal' });
}

function run(s: GameState, days: number): void {
  for (let i = 0; i < days; i++) stepDay(s);
}

describe('stepDay', () => {
  it('a run ends after 3600 days', () => {
    const s = newGame();
    let steps = 0;
    while (!s.ended && steps < B.runDays + 10) {
      stepDay(s);
      steps += 1;
    }
    expect(s.ended).not.toBeNull();
    expect(s.day).toBeLessThanOrEqual(B.runDays);
    expect(s.ended?.day).toBe(s.day);
    if (s.ended?.reason === 'completed') {
      expect(s.day).toBe(B.runDays);
      expect(s.pauseReasons).toContain('runEnded');
    } else {
      expect(s.ended?.reason).toBe('bankrupt');
      expect(s.day).toBeLessThan(B.runDays);
      expect(s.pauseReasons).toContain('bankrupt');
    }
  });

  it('stepping after the end does nothing', () => {
    const s = newGame();
    while (!s.ended) stepDay(s);
    const before = structuredClone(s);
    stepDay(s);
    stepDay(s);
    expect(s).toEqual(before);
  });

  it('an owner-only company completes shipments', () => {
    // Seed 1 loses all three quotes it gets in days 1-10, so seed 2 is used to exercise the full chain.
    const s = newGame(2);
    for (let day = 1; day <= 60; day++) {
      if (day === 11) moveOwner(s, 'ops');
      if (day === 31) moveOwner(s, 'accounting');
      stepDay(s);
    }
    expect(s.day).toBe(60);
    expect(s.stats.quotesWon).toBeGreaterThan(0);
    expect(s.shipments.some((sh) => sh.status === 'done')).toBe(true);
  });

  it('same seed, same run', () => {
    const a = newGame(7);
    const b = newGame(7);
    run(a, 720);
    run(b, 720);
    expect(a).toEqual(b);
  });

  it('pauses and logs at each year end', () => {
    const s = newGame();
    s.cash = 1_000_000;
    run(s, B.daysPerYear);
    expect(s.ended).toBeNull();
    expect(s.pauseReasons).toEqual(['yearEnd']);
    expect(s.log).toContainEqual({ day: B.daysPerYear, tone: 'info', msg: { key: 'log.yearEnd', params: { year: 1 } } });
  });

  it('a solvent run completes on day 3600', () => {
    const s = newGame();
    s.cash = 1_000_000;
    run(s, B.runDays + 5);
    expect(s.day).toBe(B.runDays);
    expect(s.ended).toEqual({ reason: 'completed', day: B.runDays });
    expect(s.pauseReasons.slice(-2)).toEqual(['yearEnd', 'runEnded']);
  });

  it('records a report at each year end, including year 10 on day 3600', () => {
    const s = newGame(2);
    s.cash = 1_000_000;
    s.yearStart.cash = s.cash;
    run(s, B.daysPerYear - 1);
    expect(s.yearReports).toEqual([]);
    run(s, 1);
    expect(s.yearReports.map((r) => r.year)).toEqual([1]);

    run(s, B.runDays);
    expect(s.ended).toEqual({ reason: 'completed', day: B.runDays });
    expect(s.yearReports.map((r) => r.year)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("year reports add up to the run's totals and chain their cash", () => {
    const s = newGame(2);
    s.cash = 1_000_000;
    s.yearStart.cash = s.cash;
    for (let day = 1; day <= B.runDays; day++) {
      // Rotate the owner so every department's work happens and money flows both ways.
      if (day % 40 === 1) moveOwner(s, DEPTS[Math.floor(day / 40) % DEPTS.length]);
      stepDay(s);
    }
    const reports = s.yearReports;
    const sum = (f: (r: (typeof reports)[number]) => number) => reports.reduce((a, r) => a + f(r), 0);

    expect(reports).toHaveLength(10);
    expect(sum((r) => r.revenue)).toBe(s.stats.revenue.reduce((a, r) => a + r.amount, 0));
    expect(sum((r) => r.revenue)).toBeGreaterThan(0);
    expect(sum((r) => r.fees)).toBeGreaterThan(0);
    expect(sum((r) => r.quotesWon)).toBe(s.stats.quotesWon);
    expect(sum((r) => r.quotesLost)).toBe(s.stats.quotesLost);
    expect(sum((r) => r.shipmentsDelivered)).toBe(s.stats.deliveredDays.length);
    expect(reports[0].cashStart).toBe(1_000_000);
    expect(reports[9].cashEnd).toBe(s.cash);
    reports.forEach((r, i) => {
      expect(r.cashEnd - r.cashStart).toBe(r.profit);
      expect(r.profit).toBe(r.revenue - r.salaries - r.rent - r.fees - r.hiring);
      expect(r.hiring).toBe(0);
      expect(r.salaries).toBe(0);
      expect(r.rent).toBe(12 * B.homeRent);
      expect(r.staffEnd).toBe(1);
      if (i > 0) expect(r.cashStart).toBe(reports[i - 1].cashEnd);
    });
  });

  it.each([1, 10])('a payroll bankruptcy at the end of year %i still records that year', (year) => {
    const s = newGame(2);
    s.cash = 1_000_000;
    s.yearStart.cash = s.cash;
    run(s, year * B.daysPerYear - 1);
    expect(s.ended).toBeNull();
    const before = structuredClone(s);
    // A rent no company can pay makes the year's last month end bankrupt it.
    const spike = 100_000_000;
    s.offices[0].rent = spike;

    stepDay(s);

    expect(s.ended).toEqual({ reason: 'bankrupt', day: year * B.daysPerYear });
    expect(s.pauseReasons).toEqual([...before.pauseReasons, 'bankrupt']);
    expect(s.log.some((e) => e.msg.key === 'log.yearEnd' && e.day === s.day)).toBe(false);
    expect(s.yearReports).toHaveLength(year);
    const r = s.yearReports[year - 1];
    const first = (year - 1) * B.daysPerYear;
    const feesToday = s.log
      .filter((e) => e.day === s.day && (e.msg.key === 'log.opsLate' || e.msg.key === 'log.invoiceLate'))
      .reduce((a, e) => a + Number(e.msg.params!.fee), 0);
    expect(r).toEqual({
      year,
      revenue: s.stats.revenue.filter((x) => x.day > first).reduce((a, x) => a + x.amount, 0),
      salaries: 0,
      rent: before.yearTotals.rent + spike,
      fees: before.yearTotals.fees + feesToday,
      hiring: 0,
      profit: s.cash - before.yearStart.cash,
      cashStart: before.yearStart.cash,
      cashEnd: s.cash,
      quotesWon: s.stats.quotesWon - before.yearStart.quotesWon,
      quotesLost: s.stats.quotesLost - before.yearStart.quotesLost,
      shipmentsDelivered: s.stats.deliveredDays.filter((d) => d > first).length,
      staffEnd: 1,
    });
    expect(r.cashEnd).toBeLessThan(0);
    expect(s.yearTotals).toEqual({ salaries: 0, rent: 0, fees: 0, hiring: 0 });
    expect(s.yearStart).toEqual({ cash: s.cash, quotesWon: s.stats.quotesWon, quotesLost: s.stats.quotesLost });
  });

  it('step is fast', () => {
    const s = newGame(3);
    // Enough cash that the run can't end early, so every timed call simulates a real day.
    s.cash = 1e9;
    const officeId = s.offices[0].id;
    for (const dept of DEPTS) {
      for (let i = 0; i < 2; i++) {
        expect(startHiring(s, officeId, dept)).toEqual({ ok: true });
        expect(hireCandidate(s, s.hiring!.candidates[0].candidateId)).toEqual({ ok: true });
      }
    }
    expect(s.employees).toHaveLength(7);

    const start = performance.now();
    for (let i = 0; i < B.runDays; i++) stepDay(s);
    const elapsed = performance.now() - start;
    expect(s.day).toBe(B.runDays);
    expect(s.ended?.reason).toBe('completed');
    expect(elapsed).toBeLessThan(2000);
  });
});
