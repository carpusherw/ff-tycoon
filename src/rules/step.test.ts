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
