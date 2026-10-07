// Salary accrual (FR-04): monthly base-salary memo records.
// The financial engine stays settings-driven (single source of truth); accrual
// transactions are audit-trail memos and are EXCLUDED from money sums.
import type { CompanySettings, Transaction } from '../types';
import { computeBaseSalaryAccrued } from './financialEngine';

/** Jalali year-month key, e.g. "1405/07" (ASCII digits for stable comparison). */
export function accrualMonthKey(dateISO: string): string {
  const d = new Date(dateISO);
  const toAscii = (s: string): string =>
    s.replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)));
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(d);
    const year = toAscii(parts.find((p) => p.type === 'year')?.value ?? '');
    const month = toAscii(parts.find((p) => p.type === 'month')?.value ?? '');
    return `${year}/${month}`;
  } catch {
    return `${d.getFullYear()}/${d.getMonth() + 1}`;
  }
}

/** True when no salary_accrual memo exists for the month containing nowISO. */
export function needsMonthlyAccrual(transactions: Transaction[], nowISO: string): boolean {
  const key = accrualMonthKey(nowISO);
  return !transactions.some(
    (t) => t.transactionType === 'salary_accrual' && accrualMonthKey(t.date) === key,
  );
}

export function buildSalaryAccrualTx(
  settings: CompanySettings,
  nowISO: string,
): Transaction {
  const amount = computeBaseSalaryAccrued(settings);
  return {
    id: `tx-accrual-${Date.now()}`,
    date: nowISO,
    streamType: 'company',
    transactionType: 'salary_accrual',
    party: { role: 'boss', name: settings.bossName, phone: settings.bossPhone },
    totalAmount: amount,
    paidAmount: 0,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'boss_balance', userBalanceChange: 0 },
    paymentMethod: 'cash',
    category: 'ثبت حقوق ماهانه',
    description: `حقوق پایه ماه ${accrualMonthKey(nowISO)} (سند یادداشت؛ مبنای تراز از تنظیمات است)`,
    conversationalSummary: 'حقوق این ماه به‌عنوان سند یادداشت ثبت شد.',
    source: 'manual',
    settled: true,
  };
}
