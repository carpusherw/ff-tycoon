import { B } from './balance';
import { customerName, loseQuote } from './chain';
import { addLog } from './log';
import type { GameState } from './types';

/**
 * Applies the penalty for every task past its deadline that hasn't been penalised yet:
 * an expired quote is lost, a late Ops or invoice task is charged a fee once and stays.
 */
export function handleMissedDeadlines(s: GameState): void {
  const missed = s.tasks.filter((t) => t.deadline < s.day && !t.late);
  for (const task of missed) {
    const shipment = s.shipments.find((sh) => sh.id === task.shipmentId);
    const customer = shipment ? customerName(s, shipment) : '';
    if (task.kind === 'quote') {
      s.tasks = s.tasks.filter((t) => t !== task);
      if (shipment) loseQuote(s, shipment);
      addLog(s, 'bad', { key: 'log.quoteExpired', params: { customer } });
      continue;
    }
    const isInvoice = task.kind === 'invoice';
    const fee = isInvoice ? B.penalties.invoiceLateFee : B.penalties.opsMissFee;
    s.cash -= fee;
    s.yearTotals.fees += fee;
    task.late = true;
    addLog(s, 'bad', { key: isInvoice ? 'log.invoiceLate' : 'log.opsLate', params: { customer, fee } });
  }
}
