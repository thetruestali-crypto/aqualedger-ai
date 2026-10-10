// Netlify Function v2: POST /api/analyze-transaction
// Stateless (no Express, no filesystem, no in-memory rate-limit).
// Shared pipeline with Express via server/analyze.ts — no duplicated logic.
import { analyzeTransactionRequestSchema } from '../../src/types/schemas';
import { analyzeTextWithBudget } from '../../server/analyze';
import { getBearerToken, verifySupabaseToken, UNAUTHORIZED_ERROR } from '../../server/auth';

export const config = { path: '/api/analyze-transaction' };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'متد مجاز نیست.' }, 405);
  }

  const token = getBearerToken(req.headers.get('authorization'));
  if (!token) {
    return json({ error: UNAUTHORIZED_ERROR }, 401);
  }
  const verified = await verifySupabaseToken(token);
  if (!verified.ok) {
    return json({ error: UNAUTHORIZED_ERROR }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'متن ورودی الزامی است.' }, 400);
  }

  const parsed = analyzeTransactionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'متن ورودی الزامی است.' }, 400);
  }

  const { text, context } = parsed.data;
  const result = await analyzeTextWithBudget(text, (context ?? {}) as Record<string, unknown>);
  if (!result.ok || !result.value) {
    return json(
      { error: result.error ?? 'خطا در تحلیل متن ورودی. لطفاً اطلاعات را مجدداً ارسال کنید.' },
      500,
    );
  }
  return json(result.value);
}
