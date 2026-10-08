import { describe, expect, it } from 'vitest';
import { buildReport, bucketDefs } from '@/src/domain/reports';
import type { Transaction } from '@/src/types';

const NOW = '2026-10-08T12:00:00.000Z'; // Mehr 1405

function tx(partial: Partial<Transaction> & { id: string }): Transaction {
  return {
    date: NOW,
    streamType: 'field',
    transactionType: 'client_payment_received',
    party: { role: 'client', name: 'x' },
    totalAmount: 0,
    paidAmount: 0,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'personal_cash', userBalanceChange: 0 },
    paymentMethod: 'cash',
    category: 'x',
    description: 'x',
    conversationalSummary: 'x',
    source: 'manual',
    settled: true,
    ...partial,
  } as Transaction;
}

describe('bucketDefs', () => {
  it('day buckets are ordered oldest-first ending today', () => {
    const defs = bucketDefs('day', NOW, 7);
    expect(defs).toHaveLength(7);
    expect(new Date(defs[6].startISO).getTime()).toBeLessThanOrEqual(new Date(NOW).getTime());
    expect(new Date(defs[0].startISO).getTime()).toBeLessThan(new Date(defs[6].startISO).getTime());
  });

  it('month buckets follow the Jalali calendar (Mehr 1405 has 30 days)', () => {
    const defs = bucketDefs('month', NOW, 3);
    expect(defs).toHaveLength(3);
    // Keys are Jalali year/month.
    expect(defs[2].key).toBe('1405/07');
    expect(defs[1].key).toBe('1405/06');
    expect(defs[0].key).toBe('1405/05');
    // Shahrivar has 31 days: bucket length differs from Mehr (30).
    const shahrivarDays =
      (new Date(defs[1].endISO).getTime() - new Date(defs[1].startISO).getTime()) / 86400000;
    const mehrDays =
      (new Date(defs[2].endISO).getTime() - new Date(defs[1].endISO).getTime()) / 86400000;
    expect(shahrivarDays).toBe(31);
    expect(mehrDays).toBeGreaterThanOrEqual(1);
    expect(defs[2].label).toContain('مهر');
  });
});

describe('buildReport', () => {
  const data: Transaction[] = [
    tx({ id: 'a', date: NOW, totalAmount: 1_200_000, paidAmount: 1_200_000, items: [
      { itemName: 'ممبران', quantity: 1, purchasePrice: 650_000, sellPrice: 950_000 },
      { itemName: 'دستمزد', quantity: 1, sellPrice: 250_000 },
    ] }),
    tx({ id: 'b', date: '2026-10-01T10:00:00.000Z', streamType: 'company', transactionType: 'company_expense_out_of_pocket', party: { role: 'boss', name: 'r' }, totalAmount: 500_000, paidAmount: 500_000 }),
    tx({ id: 'c', date: '2026-10-01T10:00:00.000Z', streamType: 'company', transactionType: 'boss_advance_received', party: { role: 'boss', name: 'r' }, totalAmount: 2_000_000, paidAmount: 2_000_000 }),
    tx({ id: 'd', date: '2026-10-01T10:00:00.000Z', streamType: 'company', transactionType: 'salary_accrual', party: { role: 'boss', name: 'r' }, totalAmount: 22_800_000, paidAmount: 0 }),
    tx({ id: 'e', date: '2026-08-01T10:00:00.000Z', totalAmount: 999_000, paidAmount: 999_000 }), // outside weekly window
    tx({ id: 'f', date: '2027-01-01T00:00:00.000Z', totalAmount: 5, paidAmount: 5 }), // future: ignored
  ];

  it('day report sums the window and splits part/labor profit', () => {
    // 7-day window (Oct 2..8): only tx 'a'.
    const r7 = buildReport(data, 'day', NOW, 7);
    expect(r7.txCount).toBe(1);
    expect(r7.fieldIn).toBe(1_200_000);
    expect(r7.partsCost).toBe(650_000);
    expect(r7.partProfit).toBe(300_000);
    expect(r7.labor).toBe(250_000);
    expect(r7.net).toBe(1_200_000 - 650_000);
    // 10-day window (Sep 29..Oct 8): + company txs; Aug + future excluded.
    const r10 = buildReport(data, 'day', NOW, 10);
    expect(r10.txCount).toBe(4); // a, b, c, d (e too old, f in future)
    expect(r10.companyIn).toBe(2_000_000);
    expect(r10.companyOut).toBe(500_000);
    expect(r10.net).toBe(2_000_000 + 1_200_000 - (500_000 + 650_000));
  });

  it('month report spans Jalali months; memos excluded', () => {
    const r = buildReport(data, 'month', NOW, 6);
    expect(r.companyIn).toBe(2_000_000); // accrual memo (22.8M) must NOT appear
    expect(r.companyOut).toBe(500_000);
    expect(r.buckets).toHaveLength(6);
    expect(r.buckets.reduce((a, b) => a + b.txCount, 0)).toBe(r.txCount);
  });

  it('empty input gives zero buckets', () => {
    const r = buildReport([], 'week', NOW, 8);
    expect(r.net).toBe(0);
    expect(r.buckets.every((b) => b.txCount === 0)).toBe(true);
  });
});
