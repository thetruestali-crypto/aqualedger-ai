// Canonical financial engine. PURE: no DOM, no network, no Date.now side effects.
// UI must call these functions instead of computing money itself.
// Money unit: integer Toman. Boss status thresholds: +/-500 (see docs/DECISIONS.md).

import type { Transaction, CompanySettings, Client } from '../types';

export interface FinancialSummary {
  // Company stream
  outOfPocketExpenses: number;
  advancesReceived: number;
  baseSalaryAccrued: number;
  overtimeAmount: number;
  absenceDeduction: number;
  salaryPayouts: number;
  bossNetBalance: number;
  bossStatus: 'creditor' | 'debtor' | 'settled';

  // Field stream
  fieldTotalVolume: number;
  fieldCashCollected: number;
  fieldPartsCost: number;
  fieldNetProfit: number;
  clientsTotalDebt: number;

  // Overall
  totalPersonalNetIncome: number;
  activeTransactionsCount: number;
}

export const BOSS_STATUS_THRESHOLD = 500;

export function computeBaseSalaryAccrued(settings: CompanySettings): number {
  const overtimeHours = settings.overtimeHours ?? 0;
  const absenceDays = settings.absenceDays ?? 0;
  const absenceDailyRate = settings.absenceDailyRate ?? 0;
  const overtime = overtimeHours * settings.overtimeHourlyRate;
  const absence = absenceDays * absenceDailyRate;
  return Math.max(0, settings.monthlyBaseSalary - settings.insuranceDeduction + overtime - absence);
}

export function getBossStatus(balance: number): 'creditor' | 'debtor' | 'settled' {
  if (balance > BOSS_STATUS_THRESHOLD) return 'creditor';
  if (balance < -BOSS_STATUS_THRESHOLD) return 'debtor';
  return 'settled';
}

/** Per-part profit: (sellPrice - buyPrice) x qty. Labor fees are NOT part profit. */
export function computePartProfit(sellPrice: number, buyPrice: number, qty: number): number {
  return Math.round((sellPrice - buyPrice) * qty);
}

export function computeFinancialSummary(
  transactions: Transaction[],
  settings: CompanySettings,
  clients: Client[],
): FinancialSummary {
  let outOfPocketExpenses = 0;
  let advancesReceived = 0;
  let salaryPayouts = 0;
  let fieldTotalVolume = 0;
  let fieldCashCollected = 0;
  let fieldPartsCost = 0;
  let fieldNetProfit = 0;

  for (const tx of transactions) {
    if (tx.streamType === 'company') {
      if (tx.transactionType === 'company_expense_out_of_pocket') {
        outOfPocketExpenses += tx.totalAmount;
      } else if (tx.transactionType === 'boss_advance_received') {
        advancesReceived += tx.totalAmount;
      } else if (tx.transactionType === 'salary_payout') {
        salaryPayouts += tx.paidAmount;
      }
    } else if (tx.streamType === 'field') {
      fieldTotalVolume += tx.totalAmount;
      fieldCashCollected += tx.paidAmount;

      let calculatedPartCost = 0;
      if (tx.items && tx.items.length > 0) {
        for (const item of tx.items) {
          if (item.purchasePrice && item.quantity) {
            calculatedPartCost += item.purchasePrice * item.quantity;
          }
        }
      }
      fieldPartsCost += calculatedPartCost;

      if (tx.financialImpact?.profitAmount !== undefined && tx.financialImpact.profitAmount > 0) {
        fieldNetProfit += tx.financialImpact.profitAmount;
      } else {
        fieldNetProfit += Math.max(0, tx.paidAmount - calculatedPartCost);
      }
    }
  }

  const baseSalaryAccrued = computeBaseSalaryAccrued(settings);
  const overtimeAmount = (settings.overtimeHours ?? 0) * settings.overtimeHourlyRate;
  const absenceDeduction = (settings.absenceDays ?? 0) * (settings.absenceDailyRate ?? 0);

  // BossNetBalance = (BaseSalaryAccrued + OutOfPocketExpenses) - (AdvancesReceived + SalaryPayouts)
  const bossNetBalance =
    baseSalaryAccrued + outOfPocketExpenses - (advancesReceived + salaryPayouts);

  const bossStatus = getBossStatus(bossNetBalance);
  const clientsTotalDebt = clients.reduce((acc, c) => acc + (c.totalDebt || 0), 0);
  const totalPersonalNetIncome = baseSalaryAccrued + fieldNetProfit;

  return {
    outOfPocketExpenses,
    advancesReceived,
    baseSalaryAccrued,
    overtimeAmount,
    absenceDeduction,
    salaryPayouts,
    bossNetBalance,
    bossStatus,
    fieldTotalVolume,
    fieldCashCollected,
    fieldPartsCost,
    fieldNetProfit,
    clientsTotalDebt,
    totalPersonalNetIncome,
    activeTransactionsCount: transactions.length,
  };
}
