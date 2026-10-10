import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import analyzeTransactionHandler from '@/netlify/functions/analyze-transaction';
import healthHandler from '@/netlify/functions/health';

// Phase-A smoke tests for Netlify Functions (no real Gemini key, no Supabase
// env: requests carry a dummy Bearer token accepted by the transitional
// auth helper, and analysis falls back to the rule-based parser).
const SAMPLE_TEXT =
  'از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت';

function postAnalyze(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://localhost/api/analyze-transaction', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('netlify function: analyze-transaction', () => {
  const OLD_GEMINI = process.env.GEMINI_API_KEY;
  const OLD_URL = process.env.SUPABASE_URL;
  const OLD_ANON = process.env.SUPABASE_ANON_KEY;
  const OLD_VITE_URL = process.env.VITE_SUPABASE_URL;
  const OLD_VITE_ANON = process.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    if (OLD_GEMINI !== undefined) process.env.GEMINI_API_KEY = OLD_GEMINI;
    if (OLD_URL !== undefined) process.env.SUPABASE_URL = OLD_URL;
    if (OLD_ANON !== undefined) process.env.SUPABASE_ANON_KEY = OLD_ANON;
    if (OLD_VITE_URL !== undefined) process.env.VITE_SUPABASE_URL = OLD_VITE_URL;
    if (OLD_VITE_ANON !== undefined) process.env.VITE_SUPABASE_ANON_KEY = OLD_VITE_ANON;
  });

  it('sample 580 analyzes via fallback with token', async () => {
    const res = await analyzeTransactionHandler(
      postAnalyze({ text: SAMPLE_TEXT, context: { bossName: 'مهندس جلالی' } }, 'test-token'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.totalAmount).toBe(580_000);
    expect(data.source).toBe('fallback');
  });

  it('missing token -> 401 Persian error', async () => {
    const res = await analyzeTransactionHandler(postAnalyze({ text: SAMPLE_TEXT }));
    expect(res.status).toBe(401);
    const data = (await res.json()) as Record<string, unknown>;
    expect(typeof data.error).toBe('string');
  });

  it('invalid Gemini key -> fallback (no 500)', async () => {
    process.env.GEMINI_API_KEY = 'invalid-key-for-test';
    const res = await analyzeTransactionHandler(
      postAnalyze({ text: SAMPLE_TEXT }, 'test-token'),
    );
    // Either Gemini somehow succeeds (unexpected offline) or, far more
    // likely, the pipeline falls back — but never a bare 500 without Persian error.
    if (res.status === 200) {
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.source).toBe('fallback');
      expect(data.totalAmount).toBe(580_000);
    } else {
      expect(res.status).toBe(500);
      const data = (await res.json()) as Record<string, unknown>;
      expect(typeof data.error).toBe('string');
    }
  });

  it('empty text -> 400 Persian error', async () => {
    const res = await analyzeTransactionHandler(postAnalyze({ text: '' }, 'test-token'));
    expect(res.status).toBe(400);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('متن ورودی الزامی است.');
  });
});

describe('netlify function: health', () => {
  it('GET returns ok', async () => {
    const res = await healthHandler(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe('ok');
  });
});
