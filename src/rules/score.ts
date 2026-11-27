import { B } from './balance';
import { revenueSince } from './money';
import type { GameState } from './types';

/**
 * The run's score: cash, plus a fixed value per office and agent, plus what customers paid on their invoices in the
 * 360 days ending today (days `s.day - 359` to `s.day`). Only an active customer is ever invoiced, and an active
 * customer is never dropped, so this is what the active customers paid. Local charges don't count.
 */
export function companyValue(s: GameState): { cash: number; network: number; customerBook: number; total: number } {
  const network = B.score.officeValue * s.offices.length + B.score.agentContractValue * s.agents.length;
  const customerBook = revenueSince(s, s.day - B.daysPerYear).invoices;
  return { cash: s.cash, network, customerBook, total: s.cash + network + customerBook };
}
