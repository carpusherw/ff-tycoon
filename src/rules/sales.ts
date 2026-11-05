import { B } from './balance';
import type { Employee } from './types';

/** Chance the salesperson wins a quote at the rough rate, clamped to `B.winClamp`. */
export function winChance(salesperson: Employee): number {
  const [min, max] = B.winClamp;
  return Math.min(max, Math.max(min, salesperson.winRate * B.roughRateFactor));
}
