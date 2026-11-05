import { newId } from './ids';
import { cashFlowPerMonth, fixedMonthlyCosts, monthEnd } from './money';
import { createGame } from './newGame';
import type { GameState } from './types';

function gameWithHire(salary: number): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.employees.push({
    id: newId(s, 'e'),
    name: 'Test Hire',
    officeId: s.offices[0].id,
    dept: 'ops',
    isOwner: false,
    salary,
    hiredDay: 0,
    speed: 1,
    capacity: 3,
    winRate: 0.4,
  });
  return s;
}

describe('money', () => {
  it('month end pays salaries and rent', () => {
    const s = gameWithHire(3000);
    s.day = 30;
    const cash = s.cash;
    expect(fixedMonthlyCosts(s)).toEqual({ salaries: 3000, rent: 2000, total: 5000 });

    monthEnd(s);
    expect(s.cash).toBe(cash - 5000);
    expect(s.ended).toBeNull();
    expect(s.pauseReasons).toEqual([]);
    expect(s.log[0]).toEqual({ day: 30, tone: 'info', msg: { key: 'log.payroll', params: { amount: 5000 } } });
  });

  it('cash flow per month nets revenue against costs', () => {
    const s = gameWithHire(3000);
    s.day = 60;
    // The window is the 30 days ending today: at day 60, day 31 is inside and day 30 is not.
    s.stats.revenue.push({ day: 30, amount: 9999 }, { day: 31, amount: 5000 }, { day: 60, amount: 3000 });
    expect(cashFlowPerMonth(s)).toEqual({ revenue: 8000, salaries: 3000, rent: 2000, net: 3000 });
  });

  it('bankrupt when cash ends the month below zero', () => {
    const s = gameWithHire(3000);
    s.day = 30;
    s.cash = 4999;

    monthEnd(s);
    expect(s.cash).toBe(-1);
    expect(s.ended).toEqual({ reason: 'bankrupt', day: 30 });
    expect(s.pauseReasons.filter((r) => r === 'bankrupt')).toHaveLength(1);
    expect(s.log[0]).toEqual({ day: 30, tone: 'bad', msg: { key: 'log.bankrupt' } });

    s.day = 60;
    monthEnd(s);
    expect(s.ended).toEqual({ reason: 'bankrupt', day: 30 });
    expect(s.pauseReasons.filter((r) => r === 'bankrupt')).toHaveLength(1);
  });

  it('zero cash is not bankrupt', () => {
    const s = gameWithHire(3000);
    s.day = 30;
    s.cash = 5000;

    monthEnd(s);
    expect(s.cash).toBe(0);
    expect(s.ended).toBeNull();
    expect(s.pauseReasons).toEqual([]);
  });
});
