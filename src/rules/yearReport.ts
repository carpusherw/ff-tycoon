import { B } from './balance';
import type { GameState, YearTotals } from './types';

export function emptyYearTotals(): YearTotals {
  return { salaries: 0, rent: 0, fees: 0 };
}

/**
 * Records the report for the year that ends today, then starts counting the next one.
 * Call it on the year's last day, after that day's month end and penalties.
 */
export function recordYearReport(s: GameState): void {
  const year = s.day / B.daysPerYear;
  const first = s.day - B.daysPerYear;
  const inYear = (day: number) => day > first && day <= s.day;
  const revenue = s.stats.revenue.reduce((sum, r) => (inYear(r.day) ? sum + r.amount : sum), 0);
  const { salaries, rent, fees } = s.yearTotals;

  s.yearReports.push({
    year,
    revenue,
    salaries,
    rent,
    fees,
    profit: revenue - salaries - rent - fees,
    cashStart: s.yearStart.cash,
    cashEnd: s.cash,
    quotesWon: s.stats.quotesWon - s.yearStart.quotesWon,
    quotesLost: s.stats.quotesLost - s.yearStart.quotesLost,
    shipmentsDelivered: s.stats.deliveredDays.filter(inYear).length,
    staffEnd: s.employees.length,
  });

  s.yearStart = { cash: s.cash, quotesWon: s.stats.quotesWon, quotesLost: s.stats.quotesLost };
  s.yearTotals = emptyYearTotals();
}
