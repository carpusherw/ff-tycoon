import { B } from '../rules/balance';
import { createClock } from './clock';

function setup() {
  let t = 1_000_000;
  let days = 0;
  const onDays = vi.fn((n: number) => {
    days += n;
  });
  const clock = createClock({
    now: () => t,
    dayMs: B.dayMs,
    tickMs: B.clock.tickMs,
    maxCatchUpDays: B.clock.maxCatchUpDays,
    maxElapsedMs: B.clock.maxElapsedMs,
    onDays,
  });
  /** Moves real time forward one tick at a time, as a running browser would. */
  const run = (ms: number) => {
    for (let done = 0; done < ms; done += B.clock.tickMs) {
      t += B.clock.tickMs;
      vi.advanceTimersByTime(B.clock.tickMs);
    }
  };
  /** Jumps real time forward without any ticks in between (tab in the background, laptop asleep). */
  const sleep = (ms: number) => {
    t += ms;
  };
  return { clock, onDays, run, sleep, days: () => days };
}

describe('clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1× advances one day per dayMs', () => {
    const { clock, run, days } = setup();
    clock.start();
    clock.setSpeed(1);
    run(2900);
    expect(days()).toBe(10);
    clock.stop();
  });

  it('3× is three times faster', () => {
    const { clock, run, days } = setup();
    clock.start();
    clock.setSpeed(3);
    run(2900);
    expect(days()).toBe(30);
    clock.stop();
  });

  it('paused advances nothing', () => {
    const { clock, onDays, run } = setup();
    clock.start();
    clock.setSpeed(0);
    expect(clock.getSpeed()).toBe(0);
    run(10_000);
    expect(onDays).not.toHaveBeenCalled();
    clock.stop();
  });

  it("a long sleep doesn't burst", () => {
    const { clock, onDays, run, sleep, days } = setup();
    clock.start();
    clock.setSpeed(3);
    run(B.clock.tickMs);
    const before = days();
    onDays.mockClear();

    sleep(600_000);
    vi.advanceTimersByTime(B.clock.tickMs);
    expect(onDays).toHaveBeenCalledTimes(1);
    expect(days() - before).toBeLessThanOrEqual(B.clock.maxCatchUpDays);

    // The skipped time is dropped, not queued up for the next ticks.
    const afterWake = days();
    run(B.clock.tickMs);
    expect(days() - afterWake).toBeLessThanOrEqual(1);
    clock.stop();
  });

  it('fraction is between 0 and 1', () => {
    const { clock, run } = setup();
    clock.start();
    clock.setSpeed(1);
    for (let i = 0; i < 40; i++) {
      run(B.clock.tickMs);
      expect(clock.fraction()).toBeGreaterThanOrEqual(0);
      expect(clock.fraction()).toBeLessThan(1);
    }
    run(B.clock.tickMs * 3);
    expect(clock.fraction()).toBeGreaterThan(0);
    clock.stop();
  });

  it('stop halts ticking', () => {
    const { clock, onDays, run } = setup();
    clock.start();
    clock.setSpeed(3);
    clock.stop();
    run(5000);
    expect(onDays).not.toHaveBeenCalled();
  });
});
