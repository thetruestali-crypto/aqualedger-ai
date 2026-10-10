// Shared analysis pipeline: single source of truth for text -> structured
// transaction. Used by BOTH Express (server.ts) and Netlify Functions.
// No Express, no filesystem, no in-memory state here — pure orchestration
// with a serverless-friendly time budget (~10s Function limit).
import { analyzeWithGemini, hasGeminiKey } from './gemini';
import { fallbackAnalyzeTransaction } from './fallbackParser';
import { finalizeAnalysis } from './suspicion';

export type AnalysisSource = 'gemini' | 'fallback';

export interface AnalyzeTextResult {
  ok: boolean;
  value?: Record<string, unknown>;
  source?: AnalysisSource;
  error?: string;
}

/**
 * Analyze Persian technician text within a serverless budget.
 * - No Gemini key -> straight to rule-based fallback (source: fallback).
 * - Gemini success -> source: gemini.
 * - Gemini timeout/error/invalid -> rule-based fallback (source: fallback).
 * Never throws; Persian error strings match the Express behavior.
 */
export async function analyzeTextWithBudget(
  text: string,
  context: Record<string, unknown> = {},
): Promise<AnalyzeTextResult> {
  const suspicionCtx = {
    typicalAmount:
      typeof context.typicalAmount === 'number' ? (context.typicalAmount as number) : undefined,
  };

  if (!hasGeminiKey()) {
    const final = finalizeAnalysis(fallbackAnalyzeTransaction(text, context), suspicionCtx);
    if (!final.ok || !final.value) {
      return { ok: false, error: 'خطا در تحلیل متن ورودی. لطفاً اطلاعات را مجدداً ارسال کنید.' };
    }
    return { ok: true, value: { ...final.value, source: 'fallback' as const }, source: 'fallback' };
  }

  try {
    const result = await analyzeWithGemini(text, context);
    const final = finalizeAnalysis(result, suspicionCtx);
    if (!final.ok || !final.value) throw new Error('finalize failed');
    return { ok: true, value: { ...final.value, source: 'gemini' as const }, source: 'gemini' };
  } catch {
    try {
      const final = finalizeAnalysis(fallbackAnalyzeTransaction(text, context), suspicionCtx);
      if (!final.ok || !final.value) throw new Error('finalize failed');
      return {
        ok: true,
        value: { ...final.value, source: 'fallback' as const },
        source: 'fallback',
      };
    } catch {
      return { ok: false, error: 'خطا در تحلیل متن ورودی. لطفاً اطلاعات را مجدداً ارسال کنید.' };
    }
  }
}
