import { createGame } from './newGame';
import { winChance } from './sales';
import type { Employee } from './types';

function salesperson(winRate: number): Employee {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  return { ...s.employees[0], winRate };
}

describe('winChance', () => {
  it('rough rate scales the salesperson', () => {
    expect(winChance(salesperson(0.5))).toBeCloseTo(0.3, 10);
  });

  it('clamped high', () => {
    expect(winChance(salesperson(2))).toBe(0.95);
  });

  it('clamped low', () => {
    expect(winChance(salesperson(0.01))).toBe(0.05);
  });
});
