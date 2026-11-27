import { B } from './balance';
import type { GameState } from './types';

/**
 * Drops history nothing reads any more, so the state (and the save) stays small over a 10-year run:
 * - finished shipments (done or lost) that no task points at. Only shipments under way are advanced by the
 *   rules or drawn on the map, and a finished shipment has no task left.
 * - revenue and deliveries older than a year. The longest window anything reads is the last 360 days
 *   (company value); the year report reads the year ending today, cash flow and shipments per operator the last
 *   30 days.
 * - prospects no shipment points at.
 * The quote counters, year reports and log are kept as they are.
 */
export function pruneState(s: GameState): void {
  const since = s.day - B.daysPerYear;
  const tasked = new Set(s.tasks.map((t) => t.shipmentId));
  s.shipments = s.shipments.filter((sh) => (sh.status !== 'done' && sh.status !== 'lost') || tasked.has(sh.id));
  const quoted = new Set(s.shipments.map((sh) => sh.customerId));
  s.customers = s.customers.filter((c) => c.status === 'active' || quoted.has(c.id));
  s.stats.revenue = s.stats.revenue.filter((r) => r.day > since);
  s.stats.delivered = s.stats.delivered.filter((d) => d.day > since);
}
