import { describe, expect, it } from 'vitest';
import { fallbackAnalyzeTransaction } from '@/server/fallbackParser';

describe('fallbackAnalyzeTransaction', () => {
  it('ARD sample -> company_expense_out_of_pocket, 580000', () => {
    const r = fallbackAnalyzeTransaction(
      'از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت مهندس جلالی',
      { bossName: 'مهندس جلالی' },
    );
    expect(r.transactionType).toBe('company_expense_out_of_pocket');
    expect(r.streamType).toBe('company');
    expect(r.totalAmount).toBe(580_000);
    expect(r.financialImpact.userBalanceChange).toBe(580_000);
  });

  it('advance from boss reduces user balance', () => {
    const r = fallbackAnalyzeTransaction('۲ میلیون تومن مساعده علی‌الحساب نقدی از رئیس گرفتم');
    expect(r.transactionType).toBe('boss_advance_received');
    expect(r.totalAmount).toBe(2_000_000);
    expect(r.financialImpact.userBalanceChange).toBe(-2_000_000);
  });

  it('client partial payment with bare paid number (sample-prompt sentence)', () => {
    const r = fallbackAnalyzeTransaction(
      'تعویض ۳ فیلتر اول برای آقای صابری انجام شد؛ ۴۵۰ تومن شد که ۳۵۰ نقد داد و ۱۰۰ تومنش موند',
    );
    expect(r.streamType).toBe('field');
    expect(r.transactionType).toBe('client_receivable');
    expect(r.totalAmount).toBe(450_000);
    expect(r.paidAmount).toBe(350_000);
    expect(r.remainingDebt).toBe(100_000);
  });

  it('client full payment stays received', () => {
    const r = fallbackAnalyzeTransaction(
      'خرید ممبران فیلمتک برای خانم موسوی ۷۰۰ تومن که فاکتور کردم ۱ میلیون و تمامش رو کارت به کارت زد',
    );
    expect(r.streamType).toBe('field');
    expect(r.totalAmount).toBe(700_000);
    expect(r.remainingDebt).toBe(0);
  });

  it('membrane suggests 24 months, filters 6', () => {
    expect(fallbackAnalyzeTransaction('ممبران عوض کردم برای مشتری ۹۰۰ تومن').suggestNextServiceMonths).toBe(24);
    expect(fallbackAnalyzeTransaction('پک فیلتر ۱۲۳ برای مشتری ۴۰۰ تومن').suggestNextServiceMonths).toBe(6);
  });

  it('unknown text gets a warning and a default amount', () => {
    const r = fallbackAnalyzeTransaction('سلام چطوری');
    expect(r.success).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
