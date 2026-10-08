import { describe, expect, it } from 'vitest';
import { finalizeAnalysis } from '@/server/suspicion';
import { fallbackAnalyzeTransaction } from '@/server/fallbackParser';
import { aiAnalysisResultSchema } from '@/src/types/schemas';
import { typicalAmount } from '@/src/domain/profit';

function base(over: Record<string, unknown> = {}) {
  return {
    success: true,
    streamType: 'company',
    transactionType: 'company_expense_out_of_pocket',
    party: { role: 'boss', name: 'رئیس' },
    totalAmount: 580_000,
    paidAmount: 580_000,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'boss_balance', userBalanceChange: 580_000 },
    paymentMethod: 'card_to_card',
    category: 'خرید تنخواه',
    description: 'x',
    conversationalSummary: 'x',
    ...over,
  };
}

describe('finalizeAnalysis', () => {
  it('passes a clean result through with schema validation', () => {
    const r = finalizeAnalysis(base());
    expect(r.ok).toBe(true);
    expect(r.value.totalAmount).toBe(580_000);
    expect(r.value.remainingDebt).toBe(0);
  });

  it('flags zero amounts', () => {
    const r = finalizeAnalysis(base({ totalAmount: 0, paidAmount: 0 }));
    expect(r.ok).toBe(true);
    expect(r.value.warnings.length).toBeGreaterThan(0);
    expect(r.value.confidence).toBeLessThanOrEqual(0.4);
  });

  it('flags huge amounts', () => {
    const r = finalizeAnalysis(base({ totalAmount: 900_000_000, paidAmount: 900_000_000 }));
    expect(r.ok).toBe(true);
    expect(r.value.warnings.join(' ')).toContain('بسیار بزرگ');
  });

  it('flags >10x typical amounts', () => {
    const r = finalizeAnalysis(base({ totalAmount: 5_000_000 }), { typicalAmount: 400_000 });
    expect(r.ok).toBe(true);
    expect(r.value.warnings.join(' ')).toContain('معمول');
    const ok = finalizeAnalysis(base({ totalAmount: 5_000_000 }), { typicalAmount: 1_000_000 });
    expect(ok.value.warnings).toEqual([]);
  });

  it('clamps paid > total and fixes the remainder', () => {
    const r = finalizeAnalysis(base({ totalAmount: 100_000, paidAmount: 150_000, remainingDebt: 0 }));
    expect(r.ok).toBe(true);
    expect(r.value.paidAmount).toBe(100_000);
    expect(r.value.remainingDebt).toBe(0);
    expect(r.value.warnings.length).toBeGreaterThan(0);
  });

  it('rejects garbage', () => {
    expect(finalizeAnalysis(null).ok).toBe(false);
    expect(finalizeAnalysis({ success: true }).ok).toBe(false);
  });

  it('every fallback output passes the AI schema', () => {
    const samples = [
      'از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت',
      '۲ میلیون مساعده از رئیس گرفتم',
      'تعویض ۳ فیلتر برای آقای صابری ۴۵۰ تومن شد که ۳۵۰ نقد داد و ۱۰۰ موند',
      'سلام چطوری',
    ];
    for (const text of samples) {
      const raw = fallbackAnalyzeTransaction(text, {});
      const v = aiAnalysisResultSchema.safeParse(raw);
      expect(v.success, text).toBe(true);
      expect(finalizeAnalysis(raw).ok, text).toBe(true);
    }
  });
});

describe('typicalAmount', () => {
  const tx = (totalAmount: number) => ({
    id: `${totalAmount}`,
    date: '',
    streamType: 'company',
    transactionType: 'company_expense_out_of_pocket',
    party: { role: 'boss', name: 'x' },
    totalAmount,
    paidAmount: totalAmount,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'boss_balance', userBalanceChange: 0 },
    paymentMethod: 'cash',
    category: 'x',
    description: 'x',
    conversationalSummary: 'x',
    source: 'manual',
    settled: true,
  });

  it('returns the median of recent totals', () => {
    expect(typicalAmount([tx(100), tx(200), tx(300)] as never[])).toBe(200);
    expect(typicalAmount([tx(100), tx(300)] as never[])).toBe(200);
    expect(typicalAmount([])).toBe(0);
  });

  it('ignores non-positive totals and caps the window', () => {
    const many = Array.from({ length: 30 }, (_, i) => tx((i + 1) * 1000));
    expect(typicalAmount(many as never[], 20)).toBe(typicalAmount(many.slice(0, 20) as never[]));
  });
});
