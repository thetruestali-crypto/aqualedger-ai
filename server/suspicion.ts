// Suspicious-value flags (FR-01): deterministic post-checks applied to EVERY
// AI result (Gemini or fallback) before it leaves the server. Pure.
// Rules: zero amounts, absurd magnitudes, paid > total mismatches, and
// >10x the user's typical amount (client-computed median, passed in context).
import { aiAnalysisResultSchema } from '../src/types/schemas.js';

const HUGE_AMOUNT = 500_000_000; // 500M Toman: plausible ceiling for a water tech job
const TYPICAL_MULTIPLE = 10;

export interface SuspicionContext {
  typicalAmount?: number;
}

export interface FinalizedResult {
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
  error?: string;
}

/** Clamp/normalize + append warnings + adjust confidence. Never throws. */
export function finalizeAnalysis(raw: unknown, ctx: SuspicionContext = {}): FinalizedResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'empty' };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = { ...(raw as any) };
  const warnings: string[] = Array.isArray(r.warnings) ? [...r.warnings] : [];
  let confidence = typeof r.confidence === 'number' ? r.confidence : 0.7;

  const total = Math.max(0, Math.round(Number(r.totalAmount) || 0));
  let paid = Math.max(0, Math.round(Number(r.paidAmount) || 0));
  r.totalAmount = total;

  if (total === 0) {
    warnings.push('مبلغ صفر ثبت شد؛ لطفاً مبلغ را بررسی و اصلاح کنید.');
    confidence = Math.min(confidence, 0.4);
  }
  if (total > HUGE_AMOUNT) {
    warnings.push('مبلغ بسیار بزرگ‌تر از حد معمول است؛ لطفاً رقم را بازبینی کنید.');
    confidence = Math.min(confidence, 0.5);
  }
  if (ctx.typicalAmount && ctx.typicalAmount > 0 && total > ctx.typicalAmount * TYPICAL_MULTIPLE) {
    warnings.push(
      `مبلغ حدود ${Math.round(total / ctx.typicalAmount)} برابر مبالغ معمول شماست؛ بررسی کنید.`,
    );
    confidence = Math.min(confidence, 0.5);
  }
  if (paid > total) {
    warnings.push('مبلغ پرداختی از کل بیشتر بود؛ با مبلغ کل یکسان شد.');
    paid = total;
  }
  r.paidAmount = paid;
  r.remainingDebt = Math.max(0, total - paid);
  r.confidence = Math.max(0, Math.min(1, confidence));
  r.warnings = warnings;

  const validated = aiAnalysisResultSchema.safeParse(r);
  if (!validated.success) return { ok: false, error: 'schema' };
  return { ok: true, value: validated.data };
}
