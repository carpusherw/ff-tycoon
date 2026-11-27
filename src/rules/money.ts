import { B } from './balance';
import { addLog } from './log';
import type { DayRevenue, GameState } from './types';

export function fixedMonthlyCosts(s: GameState): { salaries: number; rent: number; total: number } {
  const salaries = s.employees.reduce((sum, e) => sum + e.salary, 0);
  const rent = s.offices.reduce((sum, o) => sum + o.rent, 0);
  return { salaries, rent, total: salaries + rent };
}

/** Books money received today in today's revenue entry: a customer's invoice paid, or local charges. */
export function addRevenue(s: GameState, source: 'invoices' | 'charges', amount: number): void {
  let today: DayRevenue | undefined = s.stats.revenue.at(-1);
  if (today?.day !== s.day) {
    today = { day: s.day, invoices: 0, charges: 0 };
    s.stats.revenue.push(today);
  }
  today[source] += amount;
}

/** Money received after day `since`, up to today: invoices paid, local charges and both together. */
export function revenueSince(s: GameState, since: number): { invoices: number; charges: number; total: number } {
  let invoices = 0;
  let charges = 0;
  for (const r of s.stats.revenue) {
    if (r.day <= since) continue;
    invoices += r.invoices;
    charges += r.charges;
  }
  return { invoices, charges, total: invoices + charges };
}

/** Revenue booked in the 30 days ending today (days `s.day - 29` to `s.day`) against this month's fixed costs. */
export function cashFlowPerMonth(s: GameState): { revenue: number; salaries: number; rent: number; net: number } {
  const revenue = revenueSince(s, s.day - B.daysPerMonth).total;
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
