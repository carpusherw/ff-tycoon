import { B } from './balance';
import { addLog } from './log';
import type { GameState } from './types';

export function fixedMonthlyCosts(s: GameState): { salaries: number; rent: number; total: number } {
  const salaries = s.employees.reduce((sum, e) => sum + e.salary, 0);
  const rent = s.offices.reduce((sum, o) => sum + o.rent, 0);
  return { salaries, rent, total: salaries + rent };
}

/** Revenue booked in the 30 days ending today (days `s.day - 29` to `s.day`) against this month's fixed costs. */
export function cashFlowPerMonth(s: GameState): { revenue: number; salaries: number; rent: number; net: number } {
  const since = s.day - B.daysPerMonth;
  const revenue = s.stats.revenue.reduce((sum, r) => (r.day > since ? sum + r.amount : sum), 0);
  const { salaries, rent, total } = fixedMonthlyCosts(s);
  return { revenue, salaries, rent, net: revenue - total };
}

/** Pays salaries and rent. A month that ends with cash below zero bankrupts the company, once. */
export function monthEnd(s: GameState): void {
  const { salaries, rent, total } = fixedMonthlyCosts(s);
  s.cash -= total;
  s.yearTotals.salaries += salaries;
  s.yearTotals.rent += rent;
  addLog(s, 'info', { key: 'log.payroll', params: { amount: total } });
  if (s.cash >= 0 || s.ended) return;
  s.ended = { reason: 'bankrupt', day: s.day };
  if (!s.pauseReasons.includes('bankrupt')) s.pauseReasons.push('bankrupt');
  addLog(s, 'bad', { key: 'log.bankrupt' });
}
