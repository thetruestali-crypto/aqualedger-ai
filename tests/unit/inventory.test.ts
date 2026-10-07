import { describe, expect, it } from 'vitest';
import { planStockDecrement, getLowStockParts, findPart } from '@/src/domain/inventory';
import type { PartItem } from '@/src/types';

const parts: PartItem[] = [
  { id: 'p1', name: 'پک فیلتر ۱۲۳', code: 'FL-123', unit: 'پک', stock: 14, purchasePrice: 220_000, sellPrice: 380_000, category: 'filter' },
  { id: 'p2', name: 'ممبران ۷۵ گالن', code: 'MB-75G', unit: 'عدد', stock: 1, purchasePrice: 650_000, sellPrice: 950_000, category: 'membrane' },
];

describe('findPart', () => {
  it('matches by id first, then by name/code', () => {
    expect(findPart(parts, { partId: 'p2', qty: 1 })?.id).toBe('p2');
    expect(findPart(parts, { name: 'ممبران', qty: 1 })?.id).toBe('p2');
    expect(findPart(parts, { name: 'mb-75g', qty: 1 })?.id).toBe('p2');
    expect(findPart(parts, { name: 'ناموجود', qty: 1 })).toBeUndefined();
  });
});

describe('planStockDecrement', () => {
  it('applies valid decrements without mutating input', () => {
    const before = JSON.stringify(parts);
    const plan = planStockDecrement(parts, [{ partId: 'p1', qty: 2 }]);
    expect(plan.ok).toBe(true);
    expect(plan.parts.find((p) => p.id === 'p1')?.stock).toBe(12);
    expect(plan.results[0]).toMatchObject({ partId: 'p1', applied: 2, remaining: 12 });
    expect(JSON.stringify(parts)).toBe(before);
  });

  it('aggregates multiple lines for the same part', () => {
    const plan = planStockDecrement(parts, [
      { partId: 'p1', qty: 10 },
      { partId: 'p1', qty: 4 },
    ]);
    expect(plan.ok).toBe(true);
    expect(plan.parts.find((p) => p.id === 'p1')?.stock).toBe(0);
  });

  it('fails atomically: nothing applied when any line is short', () => {
    const plan = planStockDecrement(parts, [
      { partId: 'p1', qty: 1 },
      { partId: 'p2', qty: 5 }, // only 1 in stock
    ]);
    expect(plan.ok).toBe(false);
    expect(plan.parts).toBe(parts); // untouched reference
    expect(plan.errors.length).toBeGreaterThan(0);
  });

  it('rejects unknown parts and invalid qty', () => {
    expect(planStockDecrement(parts, [{ name: 'ناموجود', qty: 1 }]).ok).toBe(false);
    expect(planStockDecrement(parts, [{ partId: 'p1', qty: 0 }]).ok).toBe(false);
    expect(planStockDecrement(parts, [{ partId: 'p1', qty: -2 }]).ok).toBe(false);
  });
});

describe('getLowStockParts', () => {
  it('flags parts at or below threshold', () => {
    expect(getLowStockParts(parts).map((p) => p.id)).toEqual(['p2']);
    expect(getLowStockParts(parts, 0)).toEqual([]);
  });

  it('respects per-part threshold', () => {
    const withThreshold: PartItem[] = [
      { ...parts[0], lowStockThreshold: 20 },
      { ...parts[1], lowStockThreshold: 0 },
    ];
    expect(getLowStockParts(withThreshold).map((p) => p.id)).toEqual(['p1']);
  });
});
