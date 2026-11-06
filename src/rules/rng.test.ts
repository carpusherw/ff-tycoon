import { chance, nextFloat, pick, randInt, randRange } from './rng';

describe('rng', () => {
  it('same seed gives the same sequence', () => {
    const a = { rngState: 42 };
    const b = { rngState: 42 };
    const seqA = Array.from({ length: 5 }, () => nextFloat(a));
    const seqB = Array.from({ length: 5 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
    expect(a.rngState).toBe(b.rngState);
    expect(a.rngState).not.toBe(42);
  });

  it('nextFloat stays in [0,1)', () => {
    const s = { rngState: 7 };
    for (let i = 0; i < 10_000; i++) {
      const v = nextFloat(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt is inclusive', () => {
    const s = { rngState: 123 };
    const seen = new Set<number>();
    for (let i = 0; i < 1_000; i++) seen.add(randInt(s, 1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('randRange stays in [min, max) and covers the range', () => {
    const s = { rngState: 9 };
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 10_000; i++) {
      const v = randRange(s, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(5);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeLessThan(2.01);
    expect(hi).toBeGreaterThan(4.99);
    expect(randRange({ rngState: 1 }, 3, 3)).toBe(3);
  });

  it('chance is never true at 0, always true at 1, and close to p in between', () => {
    const s = { rngState: 11 };
    let hits = 0;
    for (let i = 0; i < 10_000; i++) {
      expect(chance(s, 0)).toBe(false);
      expect(chance(s, 1)).toBe(true);
      if (chance(s, 0.3)) hits += 1;
    }
    expect(hits / 10_000).toBeGreaterThan(0.28);
    expect(hits / 10_000).toBeLessThan(0.32);
  });

  it('pick returns every item over time, and the only item of a one-item list', () => {
    const s = { rngState: 5 };
    const seen = new Set<string>();
    for (let i = 0; i < 1_000; i++) seen.add(pick(s, ['a', 'b', 'c']));
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
    expect(pick(s, ['only'])).toBe('only');
  });

  it('pick([]) throws instead of returning undefined, and leaves the stream where it was', () => {
    const s = { rngState: 5 };
    expect(() => pick(s, [])).toThrow('pick() needs at least one item');
    expect(s.rngState).toBe(5);
  });
});
