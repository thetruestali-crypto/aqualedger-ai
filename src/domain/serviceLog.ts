// Service-log derivation (FR-06/07/08): a field transaction with priced items
// becomes a ServiceLog (parts + separated labor fee + next due date). Pure.
import type { ServiceLog, Transaction } from '../types';
import { splitTransactionItems } from './profit';
import { suggestNextServiceMonths, addMonthsISO } from './reminders';

/** Build a service log from a field transaction; null when there is nothing to log. */
export function buildServiceLogFromTransaction(tx: Transaction, clientId: string): ServiceLog | null {
  if (tx.streamType !== 'field') return null;
  const split = splitTransactionItems(tx.items);
  const itemNames = (tx.items ?? []).map((i) => i.itemName);
  const months = tx.suggestNextServiceMonths ?? suggestNextServiceMonths(itemNames);
  const hasContent =
    split.partsRevenue > 0 || split.partsCost > 0 || split.laborRevenue > 0;
  if (!hasContent) return null;
  return {
    id: `sl-${Date.now()}`,
    clientId,
    date: tx.date,
    items: (tx.items ?? [])
      .filter((i) => (i.purchasePrice ?? 0) > 0 || (i.sellPrice ?? 0) > 0)
      .map((i) => ({
        name: i.itemName,
        qty: i.quantity ?? 1,
        sellPrice: Math.round(i.sellPrice ?? 0),
        buyPrice: Math.round(i.purchasePrice ?? 0),
      })),
    laborFee: split.laborRevenue,
    nextServiceDueDate: addMonthsISO(tx.date, months),
    notes: tx.description,
  };
}
