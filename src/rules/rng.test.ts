import { nextFloat, randInt } from './rng';

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
});
