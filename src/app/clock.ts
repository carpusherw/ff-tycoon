export type Speed = 0 | 1 | 3 | 5;

export interface ClockOptions {
  now: () => number;
  dayMs: number;
  tickMs: number;
  /** Most in-game days a single tick may play, however much time has passed. */
  maxCatchUpDays: number;
  /** Most real time a single tick counts, so a sleeping tab doesn't come back with a backlog. */
  maxElapsedMs: number;
  onDays: (n: number) => void;
}

export interface Clock {
  start(): void;
  stop(): void;
  setSpeed(v: Speed): void;
  getSpeed(): Speed;
  /** How far the current in-game day has run, from 0 up to (not including) 1. */
  fraction(): number;
}

/** Turns real milliseconds into in-game days. */
export function createClock(opts: ClockOptions): Clock {
  let speed: Speed = 0;
  let acc = 0;
  let last = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    const t = opts.now();
    const elapsed = Math.max(0, Math.min(t - last, opts.maxElapsedMs));
    last = t;
    acc += elapsed * speed;
    const whole = Math.floor(acc / opts.dayMs);
    // Keep only the part-day remainder: whole days beyond the cap are dropped, not queued.
    acc -= whole * opts.dayMs;
    const n = Math.min(whole, opts.maxCatchUpDays);
    if (n > 0) opts.onDays(n);
  };

  return {
    start() {
      if (timer !== null) return;
      last = opts.now();
      timer = setInterval(tick, opts.tickMs);
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
    setSpeed(v) {
      speed = v;
    },
    getSpeed: () => speed,
    fraction: () => acc / opts.dayMs,
  };
}
