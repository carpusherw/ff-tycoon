import { B } from './balance';
import { revenueSince } from './money';
import type { GameState, YearTotals } from './types';

export function emptyYearTotals(): YearTotals {
  return { salaries: 0, rent: 0, fees: 0, hiring: 0, expansion: 0 };
}

/**
 * Records the report for the year that ends today, then starts counting the next one.
 * Call it on the year's last day, after that day's month end and penalties.
 */
export function recordYearReport(s: GameState): void {
  const year = s.day / B.daysPerYear;
  const first = s.day - B.daysPerYear;
  const inYear = (day: number) => day > first && day <= s.day;
  const revenue = revenueSince(s, first).total;
  const { salaries, rent, fees, hiring, expansion } = s.yearTotals;

  s.yearReports.push({
    year,
    revenue,
    salaries,
    rent,
    fees,
    hiring,
    expansion,
    profit: revenue - salaries - rent - fees - hiring - expansion,
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
