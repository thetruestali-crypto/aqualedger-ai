import { describe, expect, it } from 'vitest';
import {
  computeBaseSalaryAccrued,
  computeFinancialSummary,
  computePartProfit,
  getBossStatus,
} from '@/src/domain/financialEngine';
import type { Client, CompanySettings, Transaction } from '@/src/types';

const baseSettings: CompanySettings = {
  companyName: 'c',
  bossName: 'b',
  bossPhone: '',
  monthlyBaseSalary: 24_000_000,
  salaryPaymentDay: 25,
  overtimeHourlyRate: 140_000,
  insuranceDeduction: 1_200_000,
  autoAccrueSalary: true,
};

function tx(partial: Partial<Transaction> & { id: string }): Transaction {
  return {
    date: new Date().toISOString(),
    streamType: 'company',
    transactionType: 'company_expense_out_of_pocket',
    party: { role: 'boss', name: 'boss' },
    totalAmount: 0,
    paidAmount: 0,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'boss_balance', userBalanceChange: 0 },
    paymentMethod: 'cash',
    category: 'x',
    description: 'x',
    conversationalSummary: 'x',
    source: 'manual',
    ...partial,
  } as Transaction;
}

describe('computeBaseSalaryAccrued', () => {
  it('base minus insurance', () => {
    expect(computeBaseSalaryAccrued(baseSettings)).toBe(22_800_000);
  });

  it('adds overtime and subtracts absence', () => {
    expect(
      computeBaseSalaryAccrued({
        ...baseSettings,
        overtimeHours: 10,
        absenceDays: 2,
        absenceDailyRate: 800_000,
      }),
    ).toBe(24_000_000 - 1_200_000 + 1_400_000 - 1_600_000);
  });

  it('never negative', () => {
    expect(
      computeBaseSalaryAccrued({ ...baseSettings, monthlyBaseSalary: 1_000, insuranceDeduction: 5_000 }),
    ).toBe(0);
  });

  it('old settings without new fields still work', () => {
    expect(computeBaseSalaryAccrued(baseSettings)).toBe(22_800_000);
  });
});

describe('getBossStatus', () => {
  it('applies the ±500 threshold', () => {
    expect(getBossStatus(501)).toBe('creditor');
    expect(getBossStatus(500)).toBe('settled');
    expect(getBossStatus(-500)).toBe('settled');
    expect(getBossStatus(-501)).toBe('debtor');
    expect(getBossStatus(0)).toBe('settled');
  });
});

describe('computeFinancialSummary', () => {
  it('boss balance = (base + out-of-pocket) - (advances + payouts)', () => {
    const s = computeFinancialSummary(
      [
        tx({ id: 'a', transactionType: 'company_expense_out_of_pocket', totalAmount: 680_000, paidAmount: 680_000 }),
        tx({ id: 'b', transactionType: 'boss_advance_received', totalAmount: 4_000_000, paidAmount: 4_000_000 }),
      ],
      baseSettings,
      [],
    );
    expect(s.bossNetBalance).toBe(22_800_000 + 680_000 - 4_000_000);
    expect(s.bossStatus).toBe('creditor');
  });

  it('zero amounts do not break the summary', () => {
    const s = computeFinancialSummary([tx({ id: 'z' })], baseSettings, []);
    expect(s.bossNetBalance).toBe(22_800_000);
    expect(s.fieldNetProfit).toBe(0);
  });

  it('field profit falls back to paid - partsCost when Gemini profit missing', () => {
    const s = computeFinancialSummary(
      [
        tx({
          id: 'f',
          streamType: 'field',
          transactionType: 'client_payment_received',
          totalAmount: 950_000,
          paidAmount: 950_000,
          items: [{ itemName: 'filter', quantity: 2, purchasePrice: 200_000, sellPrice: 380_000 }],
        }),
      ],
      baseSettings,
      [],
    );
    expect(s.fieldNetProfit).toBe(950_000 - 400_000);
  });

  it('sums client debts', () => {
    const clients: Client[] = [
      { id: '1', name: 'a', phone: '', address: '', deviceModel: '', totalPaid: 0, totalDebt: 250_000, lastServiceDate: '', nextServiceDueDate: '' },
    ];
    const s = computeFinancialSummary([], baseSettings, clients);
    expect(s.clientsTotalDebt).toBe(250_000);
  });
});

describe('computePartProfit', () => {
  it('sell minus buy times qty', () => {
    expect(computePartProfit(380_000, 220_000, 2)).toBe(320_000);
    expect(computePartProfit(100, 150, 1)).toBe(-50);
  });
});
