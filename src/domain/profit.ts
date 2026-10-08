// Profit domain (FR-08): separate merchandise profit from labor fees.
// Per-part profit = (sellPrice - buyPrice) x qty. Labor is reported apart.
import type { ServiceLog, Transaction, TransactionItem } from '../types';
import { computePartProfit } from './financialEngine';

export interface ServiceFinancials {
  /** Revenue from parts sold to the customer. */
  partsRevenue: number;
  /** What the parts cost from stock. */
  partsCost: number;
  /** partsRevenue - partsCost. */
  partProfit: number;
  /** Pure labor fee (دستمزد + ایاب و ذهاب), never mixed into part profit. */
  laborRevenue: number;
  /** partsRevenue + laborRevenue (what the customer pays). */
  totalRevenue: number;
}

export interface PricedLine {
  name: string;
  qty: number;
  sellPrice: number;
  buyPrice: number;
}

/** Split priced service lines + an explicit labor fee into FR-08 buckets. */
export function splitServiceFinancials(lines: PricedLine[], laborFee: number): ServiceFinancials {
  let partsRevenue = 0;
  let partsCost = 0;
  for (const l of lines) {
    const qty = Math.max(0, Math.floor(l.qty));
    partsRevenue += Math.round(l.sellPrice) * qty;
    partsCost += Math.round(l.buyPrice) * qty;
  }
  const labor = Math.max(0, Math.round(laborFee));
  return {
    partsRevenue,
    partsCost,
    partProfit: partsRevenue - partsCost,
    laborRevenue: labor,
    totalRevenue: partsRevenue + labor,
  };
}

/** Financial split of a stored service log. */
export function computeServiceLogFinancials(log: ServiceLog): ServiceFinancials {
  return splitServiceFinancials(
    log.items.map((i) => ({ name: i.name, qty: i.qty, sellPrice: i.sellPrice, buyPrice: i.buyPrice })),
    log.laborFee,
  );
}

/**
 * Derive priced lines from a transaction's items: lines WITH a purchasePrice are
 * merchandise; lines WITHOUT one (pure دستمزد/ایاب‌ذهاب) count as labor.
 */
export function splitTransactionItems(items: TransactionItem[] | undefined): ServiceFinancials {
  const lines: PricedLine[] = [];
  let labor = 0;
  for (const item of items ?? []) {
    const qty = item.quantity ?? 1;
    if (item.purchasePrice !== undefined && item.purchasePrice > 0) {
      lines.push({
        name: item.itemName,
        qty,
        sellPrice: item.sellPrice ?? 0,
        buyPrice: item.purchasePrice,
      });
    } else if (item.sellPrice !== undefined) {
      labor += Math.round(item.sellPrice) * Math.max(0, Math.floor(qty));
    }
  }
  const parts = splitServiceFinancials(lines, 0);
  return { ...parts, laborRevenue: labor, totalRevenue: parts.partsRevenue + labor };
}

export { computePartProfit };

/**
 * Typical amount = median of the most recent totals (default last 20).
 * Sent to the server so it can flag >10x outliers (FR-01). Zero when empty.
 */
export function typicalAmount(transactions: Transaction[], limit = 20): number {
  const totals = transactions
    .slice(0, Math.max(0, limit))
    .map((t) => t.totalAmount)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (totals.length === 0) return 0;
  const mid = Math.floor(totals.length / 2);
  return totals.length % 2 === 1
    ? totals[mid]
    : Math.round((totals[mid - 1] + totals[mid]) / 2);
}
