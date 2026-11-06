import { B } from './balance';
import type { GameState } from './types';

/**
 * The run's score: cash, plus a fixed value per office and agent, plus what active customers
 * paid in the 360 days ending today (days `s.day - 359` to `s.day`).
 */
export function companyValue(s: GameState): { cash: number; network: number; customerBook: number; total: number } {
  const network = B.score.officeValue * s.offices.length + B.score.agentContractValue * s.agents.length;
  const since = s.day - B.daysPerYear;
  let customerBook = 0;
  for (const customer of s.customers) {
    if (customer.status !== 'active') continue;
    for (const p of customer.payments) if (p.day > since) customerBook += p.amount;
  }
  return { cash: s.cash, network, customerBook, total: s.cash + network + customerBook };
}
