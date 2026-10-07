import { describe, expect, it } from 'vitest';
import { splitServiceFinancials, computeServiceLogFinancials, splitTransactionItems } from '@/src/domain/profit';
import type { ServiceLog } from '@/src/types';

describe('splitServiceFinancials', () => {
  it('separates part profit from labor (seed tx-3 style)', () => {
    const s = splitServiceFinancials(
      [{ name: 'فیلتر جامبو', qty: 2, sellPrice: 190_000, buyPrice: 100_000 }],
      570_000,
    );
    expect(s.partsRevenue).toBe(380_000);
    expect(s.partsCost).toBe(200_000);
    expect(s.partProfit).toBe(180_000);
    expect(s.laborRevenue).toBe(570_000);
    expect(s.totalRevenue).toBe(950_000);
  });

  it('loss-making parts give negative part profit, labor untouched', () => {
    const s = splitServiceFinancials([{ name: 'x', qty: 1, sellPrice: 100, buyPrice: 150 }], 50);
    expect(s.partProfit).toBe(-50);
    expect(s.laborRevenue).toBe(50);
  });

  it('zero qty and negative labor are clamped', () => {
    const s = splitServiceFinancials([{ name: 'x', qty: 0, sellPrice: 100, buyPrice: 10 }], -5);
    expect(s.partsRevenue).toBe(0);
    expect(s.laborRevenue).toBe(0);
  });
});

describe('computeServiceLogFinancials', () => {
  it('splits a stored service log', () => {
    const log: ServiceLog = {
      id: 'sl-1',
      clientId: 'c-1',
      date: new Date().toISOString(),
      items: [{ name: 'ممبران', qty: 1, sellPrice: 950_000, buyPrice: 650_000 }],
      laborFee: 250_000,
      nextServiceDueDate: new Date().toISOString(),
    };
    const s = computeServiceLogFinancials(log);
    expect(s.partProfit).toBe(300_000);
    expect(s.laborRevenue).toBe(250_000);
    expect(s.totalRevenue).toBe(1_200_000);
  });
});

describe('splitTransactionItems', () => {
  it('lines with purchasePrice are merchandise, others are labor', () => {
    const s = splitTransactionItems([
      { itemName: 'ممبران', quantity: 1, purchasePrice: 650_000, sellPrice: 950_000 },
      { itemName: 'دستمزد و ایاب ذهاب', quantity: 1, sellPrice: 250_000 },
    ]);
    expect(s.partProfit).toBe(300_000);
    expect(s.laborRevenue).toBe(250_000);
    expect(s.totalRevenue).toBe(1_200_000);
  });

  it('undefined items give zeros', () => {
    expect(splitTransactionItems(undefined)).toEqual({
      partsRevenue: 0,
      partsCost: 0,
      partProfit: 0,
      laborRevenue: 0,
      totalRevenue: 0,
    });
  });
});
