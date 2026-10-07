import { describe, expect, it } from 'vitest';
import { accrualMonthKey, needsMonthlyAccrual, buildSalaryAccrualTx } from '@/src/domain/salary';
import { buildServiceLogFromTransaction } from '@/src/domain/serviceLog';
import { defaultSettings } from '@/src/data/seed';
import type { Transaction } from '@/src/types';

const NOW = '2026-10-07T12:00:00.000Z';

function fieldTx(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: NOW,
    streamType: 'field',
    transactionType: 'client_payment_received',
    party: { role: 'client', name: 'آقای صابری' },
    totalAmount: 1_200_000,
    paidAmount: 1_200_000,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'personal_cash', userBalanceChange: 0 },
    paymentMethod: 'cash',
    category: 'سرویس',
    items: [
      { itemName: 'ممبران', quantity: 1, purchasePrice: 650_000, sellPrice: 950_000 },
      { itemName: 'دستمزد و ایاب ذهاب', quantity: 1, sellPrice: 250_000 },
    ],
    suggestNextServiceMonths: 24,
    description: 'x',
    conversationalSummary: 'x',
    source: 'manual',
    settled: true,
    ...partial,
  };
}

describe('accrualMonthKey', () => {
  it('produces a stable Jalali year/month key', () => {
    const key = accrualMonthKey(NOW);
    expect(key).toMatch(/^\d{4}\/\d{2}$/);
    expect(accrualMonthKey('2026-10-01T00:00:00.000Z')).toBe(key);
    expect(accrualMonthKey('2026-09-01T00:00:00.000Z')).not.toBe(key);
  });
});

describe('needsMonthlyAccrual', () => {
  it('true when no accrual memo exists for the month', () => {
    expect(needsMonthlyAccrual([], NOW)).toBe(true);
    expect(needsMonthlyAccrual([fieldTx()], NOW)).toBe(true);
  });

  it('false once the month memo exists (other months do not count)', () => {
    const memo = buildSalaryAccrualTx(defaultSettings, NOW);
    expect(needsMonthlyAccrual([memo], NOW)).toBe(false);
    expect(needsMonthlyAccrual([{ ...memo, id: 'old', date: '2026-01-01T00:00:00.000Z' }], NOW)).toBe(true);
  });
});

describe('buildSalaryAccrualTx', () => {
  it('builds an excluded-from-sums memo with the accrued amount', () => {
    const tx = buildSalaryAccrualTx(defaultSettings, NOW);
    expect(tx.transactionType).toBe('salary_accrual');
    expect(tx.streamType).toBe('company');
    expect(tx.totalAmount).toBe(24_000_000 - 1_200_000);
    expect(tx.settled).toBe(true);
  });
});

describe('buildServiceLogFromTransaction', () => {
  it('derives parts + labor + next due date', () => {
    const log = buildServiceLogFromTransaction(fieldTx(), 'client-1')!;
    expect(log).not.toBeNull();
    expect(log.clientId).toBe('client-1');
    expect(log.items).toHaveLength(2);
    expect(log.laborFee).toBe(250_000);
    expect(new Date(log.nextServiceDueDate).getTime()).toBeGreaterThan(new Date(NOW).getTime());
  });

  it('returns null for company txs and content-less txs', () => {
    expect(
      buildServiceLogFromTransaction(fieldTx({ streamType: 'company' }), 'c'),
    ).toBeNull();
    expect(buildServiceLogFromTransaction(fieldTx({ items: [] }), 'c')).toBeNull();
  });
});
