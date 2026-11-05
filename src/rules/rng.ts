type RngHolder = { rngState: number };

/** mulberry32: returns a value in [0, 1) and advances `s.rngState`. */
export function nextFloat(s: RngHolder): number {
  let t = (s.rngState = (s.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A float in [min, max). */
export function randRange(s: RngHolder, min: number, max: number): number {
  return min + nextFloat(s) * (max - min);
}

/** An integer in [min, max], both ends inclusive. */
export function randInt(s: RngHolder, min: number, max: number): number {
  return Math.floor(randRange(s, min, max + 1));
}

export function chance(s: RngHolder, p: number): boolean {
  return nextFloat(s) < p;
}

export function pick<T>(s: RngHolder, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() needs at least one item');
  return items[randInt(s, 0, items.length - 1)];
}
