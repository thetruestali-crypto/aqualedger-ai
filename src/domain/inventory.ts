// Inventory domain: pure stock planning + low-stock detection (FR-07).
// Stores apply the plan atomically (all-or-nothing); this module decides it.
import type { PartItem } from '../types';
import type { StockLine, StockResult } from '../data/repository';

export interface StockPlan {
  ok: boolean;
  /** Parts with decrements applied (only meaningful when ok). */
  parts: PartItem[];
  results: StockResult[];
  errors: string[];
}

/** Find a part by id first, then by case-insensitive name match. */
export function findPart(parts: PartItem[], line: StockLine): PartItem | undefined {
  if (line.partId) {
    const byId = parts.find((p) => p.id === line.partId);
    if (byId) return byId;
  }
  const needle = (line.name ?? '').trim().toLowerCase();
  if (!needle) return undefined;
  return parts.find(
    (p) =>
      p.name.toLowerCase().includes(needle) ||
      needle.includes(p.name.toLowerCase()) ||
      p.code.toLowerCase() === needle,
  );
}

/**
 * Plan an atomic stock decrement. Two-phase: validate ALL lines first; only if
 * every line is satisfiable are decrements applied. Never mutates the input.
 */
export function planStockDecrement(parts: PartItem[], lines: StockLine[]): StockPlan {
  const errors: string[] = [];
  const results: StockResult[] = [];
  const deltas = new Map<string, number>();

  for (const line of lines) {
    const qty = Math.floor(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push(`تعداد نامعتبر برای ${line.name ?? line.partId ?? 'قطعه'}`);
      continue;
    }
    const part = findPart(parts, line);
    if (!part) {
      errors.push(`قطعه «${line.name ?? line.partId}» در انبار پیدا نشد`);
      continue;
    }
    const already = deltas.get(part.id) ?? 0;
    if (part.stock < already + qty) {
      errors.push(
        `موجودی «${part.name}» کافی نیست (موجودی ${part.stock}، نیاز ${already + qty})`,
      );
      continue;
    }
    deltas.set(part.id, already + qty);
    results.push({
      partId: part.id,
      name: part.name,
      requested: qty,
      applied: qty,
      remaining: part.stock - (already + qty),
    });
  }

  if (errors.length > 0) {
    return { ok: false, parts, results: [], errors };
  }
  const next = parts.map((p) => {
    const d = deltas.get(p.id) ?? 0;
    return d > 0 ? { ...p, stock: p.stock - d } : p;
  });
  return { ok: true, parts: next, results, errors: [] };
}

/** Parts at or below their low-stock threshold (default threshold 3). */
export function getLowStockParts(parts: PartItem[], defaultThreshold = 3): PartItem[] {
  return parts.filter((p) => {
    const threshold = p.lowStockThreshold ?? defaultThreshold;
    return p.stock <= threshold;
  });
}
