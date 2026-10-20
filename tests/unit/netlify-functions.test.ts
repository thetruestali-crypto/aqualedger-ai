import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import analyzeTransactionHandler from '@/netlify/functions/analyze-transaction';
import healthHandler from '@/netlify/functions/health';
import smsRequestHandler from '@/netlify/functions/sms-request';
import smsVerifyHandler from '@/netlify/functions/sms-verify';

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
// The service-role key gets its own fake (tables + SMS RPCs).
const h = vi.hoisted(() => {
  const supabaseGetUser = vi.fn();
  const supabaseRpc = vi.fn();
  const smsRpc = vi.fn();
  const smsSignIn = vi.fn();
  const smsAdmin = {
    createUser: vi.fn(),
    updateUserById: vi.fn(),
    getUserById: vi.fn(),
  };
  return { supabaseGetUser, supabaseRpc, smsRpc, smsSignIn, smsAdmin };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) => {
    if (key === 'service-role-key') {
      const chain: any = {
        select() {
          return chain;
        },
        insert() {
          return chain;
        },
        delete() {
          return chain;
        },
        eq() {
          return chain;
        },
        lt() {
          return chain;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data: null, error: null }).then(resolve, reject),
      };
      return {
        rpc: h.smsRpc,
        from: () => chain,
        auth: { admin: h.smsAdmin },
      };
    }
    return {
      auth: { getUser: h.supabaseGetUser, signInWithPassword: h.smsSignIn },
      rpc: h.supabaseRpc,
    };
  },
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
    h.supabaseGetUser.mockReset();
    h.supabaseRpc.mockReset();
    h.supabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
    h.supabaseRpc.mockResolvedValue({ data: 1, error: null });
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
    h.supabaseRpc.mockResolvedValueOnce({ data: 201, error: null });
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

describe('netlify functions: sms login', () => {
  const fetchMock = vi.fn();
  const OLD_ENV = { ...process.env };

  function post(path: string, body: unknown): Request {
    return new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, message: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SMSIR_API_KEY = 'test-smsir-key';
    process.env.SMSIR_TEMPLATE_ID = '123456';
    process.env.SMS_OTP_SECRET = 'test-otp-secret';

    h.smsRpc.mockReset();
    h.smsSignIn.mockReset();
    h.smsAdmin.createUser.mockReset();
    h.smsAdmin.updateUserById.mockReset();
    h.smsAdmin.getUserById.mockReset();
    h.smsAdmin.createUser.mockResolvedValue({
      data: { user: { id: 'sms-user-1', email: null, phone: '+989121234567' } },
      error: null,
    });
    h.smsAdmin.updateUserById.mockResolvedValue({
      data: { user: { id: 'sms-user-1' } },
      error: null,
    });
    h.smsAdmin.getUserById.mockResolvedValue({
      data: { user: { id: 'sms-user-1' } },
      error: null,
    });
    h.smsRpc.mockImplementation(async (fn: string) => {
      if (fn === 'sms_otp_stats') {
        return {
          data: { phone_sends: 0, ip_sends: 0, phone_fails: 0, phone_last_at: null },
          error: null,
        };
      }
      if (fn === 'consume_sms_otp') return { data: 'challenge-id', error: null };
      if (fn === 'find_user_by_phone') return { data: null, error: null };
      return { data: null, error: null };
    });
    h.smsSignIn.mockResolvedValue({
      data: {
        session: {
          access_token: 'sms-access-token',
          refresh_token: 'sms-refresh-token',
          expires_at: 1700000000,
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...OLD_ENV };
  });

  it('sms-request sends the code and never returns it', async () => {
    const res = await smsRequestHandler(post('/api/auth/sms/request', { phone: '09121234567' }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.expiresIn).toBe(300);
    expect(data.resendAfter).toBe(60);
    expect(JSON.stringify(data)).not.toMatch(/\d{5}/);
  });

  it('sms-request rejects an invalid phone number', async () => {
    const res = await smsRequestHandler(post('/api/auth/sms/request', { phone: '12' }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('شمارهٔ موبایل معتبر نیست.');
  });

  it('sms-request rejects a non-POST method', async () => {
    const res = await smsRequestHandler(
      new Request('http://localhost/api/auth/sms/request', { method: 'GET' }),
    );
    expect(res.status).toBe(405);
  });

  it('sms-verify returns the session tokens', async () => {
    const res = await smsVerifyHandler(
      post('/api/auth/sms/verify', { phone: '09121234567', code: '12345' }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.accessToken).toBe('sms-access-token');
    expect(data.refreshToken).toBe('sms-refresh-token');
    expect(data.phone).toBe('+989121234567');
  });

  it('sms-verify answers the same message for a wrong code', async () => {
    h.smsRpc.mockImplementation(async (fn: string) => {
      if (fn === 'consume_sms_otp') return { data: null, error: null };
      return { data: null, error: null };
    });
    const res = await smsVerifyHandler(
      post('/api/auth/sms/verify', { phone: '09121234567', code: '00000' }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('کد تأیید نامعتبر یا منقضی شده است.');
  });
});
