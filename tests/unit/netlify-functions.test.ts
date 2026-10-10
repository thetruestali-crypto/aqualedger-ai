import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import analyzeTransactionHandler from '@/netlify/functions/analyze-transaction';
import healthHandler from '@/netlify/functions/health';

// Simulate Gemini failure without touching the network: the pipeline must
// fall back to the rule-based parser (source: fallback) instead of 500.
vi.mock('@/server/gemini', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/server/gemini')>();
  return {
    ...orig,
    hasGeminiKey: () => true,
    analyzeWithGemini: async () => {
      throw new Error('mocked Gemini failure');
    },
  };
});

// Mock Supabase: strict auth accepts the test token, quota RPC is controllable.
const { supabaseGetUser, supabaseRpc } = vi.hoisted(() => ({
  supabaseGetUser: vi.fn(),
  supabaseRpc: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: supabaseGetUser }, rpc: supabaseRpc }),
}));

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
    // Strict paths: configured Supabase with a mocked client.
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    supabaseGetUser.mockReset();
    supabaseRpc.mockReset();
    supabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
    supabaseRpc.mockResolvedValue({ data: 1, error: null });
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

  it('Gemini failure -> fallback (no 500, mocked, no network)', async () => {
    const res = await analyzeTransactionHandler(
      postAnalyze({ text: SAMPLE_TEXT }, 'test-token'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.source).toBe('fallback');
    expect(data.totalAmount).toBe(580_000);
  });

  it('empty text -> 400 Persian error', async () => {
    const res = await analyzeTransactionHandler(postAnalyze({ text: '' }, 'test-token'));
    expect(res.status).toBe(400);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('متن ورودی الزامی است.');
  });

  it('over daily quota -> 429 Persian error', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: 201, error: null });
    const res = await analyzeTransactionHandler(
      postAnalyze({ text: SAMPLE_TEXT }, 'test-token'),
    );
    expect(res.status).toBe(429);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('سهمیه روزانه هوش مصنوعی تمام شد. لطفاً فردا تلاش کنید.');
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
