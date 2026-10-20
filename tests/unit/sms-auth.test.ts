import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake Supabase clients: the service-role client owns the tables/RPCs, the
// anon client mints the session. Everything is in-memory — no network.
const h = vi.hoisted(() => {
  const state = {
    rpcHandlers: {} as Record<string, (args: any) => { data: any; error: any }>,
    calls: [] as Array<{ kind: string; detail?: any }>,
    selectResult: null as any,
    selectError: null as any,
    insertError: null as any,
    deleteError: null as any,
    createUserData: null as any,
    createUserError: null as any,
    emailCreateUserError: null as any,
    updateUserError: null as any,
    getUserData: null as any,
    signInData: null as any,
    signInError: null as any,
  };

  function applyOp(chain: any) {
    if (chain._op === 'insert') {
      state.calls.push({ kind: 'insert', detail: chain._payload });
      return { data: null, error: state.insertError };
    }
    if (chain._op === 'delete') {
      state.calls.push({ kind: 'delete', detail: chain._filters });
      return { data: null, error: state.deleteError };
    }
    state.calls.push({ kind: 'select', detail: chain._filters });
    return { data: state.selectResult, error: state.selectError };
  }

  const serviceClient: any = {
    rpc: (fn: string, args?: any) => {
      state.calls.push({ kind: 'rpc', detail: { fn, args } });
      const handler = state.rpcHandlers[fn];
      if (!handler) {
        return Promise.resolve({ data: null, error: { message: `unhandled rpc ${fn}` } });
      }
      return Promise.resolve(handler(args));
    },
    from: (name: string) => {
      const chain: any = {
        _op: 'select',
        _table: name,
        _payload: undefined,
        _filters: [] as any[],
        select() {
          chain._op = 'select';
          return chain;
        },
        insert(payload: any) {
          chain._op = 'insert';
          chain._payload = payload;
          return chain;
        },
        delete() {
          chain._op = 'delete';
          return chain;
        },
        eq(col: string, value: any) {
          chain._filters.push([col, value]);
          return chain;
        },
        lt(col: string, value: any) {
          chain._filters.push(['<', col, value]);
          return chain;
        },
        maybeSingle() {
          return Promise.resolve(applyOp(chain));
        },
        then(resolve: any, reject: any) {
          return Promise.resolve(applyOp(chain)).then(resolve, reject);
        },
      };
      return chain;
    },
    auth: {
      admin: {
        createUser: async (payload: any) => {
          state.calls.push({ kind: 'createUser', detail: payload });
          const phoneAttempt = typeof payload.phone === 'string';
          if (phoneAttempt && state.createUserError) {
            return { data: null, error: state.createUserError };
          }
          if (!phoneAttempt && state.emailCreateUserError) {
            return { data: null, error: state.emailCreateUserError };
          }
          return {
            data: state.createUserData ? { user: state.createUserData } : null,
            error: null,
          };
        },
        updateUserById: async (id: string, payload: any) => {
          state.calls.push({ kind: 'updateUserById', detail: { id, payload } });
          return { data: { user: { id } }, error: state.updateUserError };
        },
        getUserById: async (id: string) => {
          state.calls.push({ kind: 'getUserById', detail: id });
          return { data: state.getUserData ? { user: state.getUserData } : null, error: null };
        },
      },
    },
  };

  const publicClient: any = {
    auth: {
      signInWithPassword: async (credentials: any) => {
        state.calls.push({ kind: 'signInWithPassword', detail: credentials });
        return {
          data: state.signInData ? { session: state.signInData } : null,
          error: state.signInError,
        };
      },
    },
  };

  return { state, serviceClient, publicClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) =>
    key === 'service-role-key' ? h.serviceClient : h.publicClient,
}));

import { requestSmsCode, verifySmsCode } from '@/server/smsAuth';

const fetchMock = vi.fn();
const OLD_ENV = { ...process.env };

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function callsOf(kind: string) {
  return h.state.calls.filter((call) => call.kind === kind);
}

describe('sms auth service', () => {
  beforeEach(() => {
    h.state.rpcHandlers = {};
    h.state.calls = [];
    h.state.selectResult = null;
    h.state.selectError = null;
    h.state.insertError = null;
    h.state.deleteError = null;
    h.state.createUserData = null;
    h.state.createUserError = null;
    h.state.emailCreateUserError = null;
    h.state.updateUserError = null;
    h.state.getUserData = null;
    h.state.signInData = null;
    h.state.signInError = null;

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse({ status: 200, message: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SMSIR_API_KEY = 'test-api-key';
    process.env.SMSIR_TEMPLATE_ID = '123456';
    process.env.SMS_OTP_SECRET = 'test-otp-secret';
    delete process.env.SMSIR_SENDER;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...OLD_ENV };
  });

  it('rejects an invalid phone number without touching the database', async () => {
    const result = await requestSmsCode({ phone: '12345' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe('شمارهٔ موبایل معتبر نیست.');
    }
    expect(h.state.calls).toHaveLength(0);
  });

  it('answers 503 when the SMS service is not configured', async () => {
    delete process.env.SMSIR_API_KEY;
    const result = await requestSmsCode({ phone: '09121234567' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe('سرویس پیامک فعال نیست. لطفاً با حساب گوگل وارد شوید.');
    }
  });

  it('enforces the 60 second resend cooldown', async () => {
    h.state.rpcHandlers.sms_otp_stats = () => ({
      data: { phone_sends: 1, ip_sends: 1, phone_fails: 0, phone_last_at: new Date().toISOString() },
      error: null,
    });
    const result = await requestSmsCode({ phone: '09121234567' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error).toContain('ثانیه دیگر صبر کنید');
    }
  });

  it('enforces the hourly send limits', async () => {
    h.state.rpcHandlers.sms_otp_stats = () => ({
      data: { phone_sends: 5, ip_sends: 1, phone_fails: 0, phone_last_at: null },
      error: null,
    });
    const result = await requestSmsCode({ phone: '09121234567' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error).toBe('تعداد درخواست کد بیش از حد مجاز است.');
    }
  });

  it('stores the hashed code and sends the plain code by SMS', async () => {
    h.state.rpcHandlers.sms_otp_stats = () => ({
      data: { phone_sends: 0, ip_sends: 0, phone_fails: 0, phone_last_at: null },
      error: null,
    });

    const result = await requestSmsCode({ phone: '09121234567', ip: '1.2.3.4' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expiresIn).toBe(300);
      expect(result.resendAfter).toBe(60);
    }

    const insert = callsOf('insert')[0]?.detail as Record<string, any>;
    expect(insert.phone_e164).toBe('+989121234567');
    expect(insert.ip).toBe('1.2.3.4');
    expect(insert.max_attempts).toBe(3);
    expect(insert.code_hash).toMatch(/^[0-9a-f]{64}$/);

    // The SMS body carries the plain code; the database never stores it.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const plainCode = body.parameters[0].value;
    expect(plainCode).toMatch(/^\d{5}$/);
    expect(insert.code_hash).toBe(
      createHmac('sha256', 'test-otp-secret').update(plainCode).digest('hex'),
    );
    expect(insert.code_hash).not.toBe(plainCode);
  });

  it('removes the challenge when the SMS could not be sent', async () => {
    h.state.rpcHandlers.sms_otp_stats = () => ({
      data: { phone_sends: 0, ip_sends: 0, phone_fails: 0, phone_last_at: null },
      error: null,
    });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 11, message: 'ip' }) });

    const result = await requestSmsCode({ phone: '09121234567' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error).toBe('کلید وب‌سرویس پیامک به IP محدود شده است.');
    }
    expect(callsOf('delete')).toHaveLength(1);
  });

  it('rejects a wrong code with a single generic Persian message', async () => {
    h.state.rpcHandlers.consume_sms_otp = () => ({ data: null, error: null });
    const result = await verifySmsCode({ phone: '09121234567', code: '00000' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe('کد تأیید نامعتبر یا منقضی شده است.');
    }
  });

  it('rejects a malformed code before touching the database', async () => {
    const result = await verifySmsCode({ phone: '09121234567', code: '12' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe('کد تأیید نامعتبر یا منقضی شده است.');
    }
    expect(callsOf('rpc')).toHaveLength(0);
  });

  it('creates the user and mints a real session', async () => {
    h.state.rpcHandlers.consume_sms_otp = () => ({ data: 'challenge-id', error: null });
    h.state.rpcHandlers.find_user_by_phone = () => ({ data: null, error: null });
    h.state.rpcHandlers.sms_account_upsert = () => ({ data: null, error: null });
    h.state.createUserData = { id: 'user-1', email: null, phone: '+989121234567' };
    h.state.signInData = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 1700000000,
    };

    const result = await verifySmsCode({ phone: '09121234567', code: '12345' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.expiresAt).toBe(1700000000);
      expect(result.phone).toBe('+989121234567');
    }

    const create = callsOf('createUser')[0]?.detail as Record<string, any>;
    expect(create.phone).toBe('+989121234567');
    expect(create.phone_confirm).toBe(true);
    expect(create.user_metadata.auth_method).toBe('sms');

    // The password is rotated on every verification and never returned.
    const update = callsOf('updateUserById')[0]?.detail as { id: string; payload: any };
    expect(update.id).toBe('user-1');
    expect(typeof update.payload.password).toBe('string');
    expect(update.payload.password.length).toBeGreaterThanOrEqual(32);

    const signIn = callsOf('signInWithPassword')[0]?.detail as Record<string, any>;
    expect(signIn.phone).toBe('+989121234567');
    expect(signIn.password).toBe(update.payload.password);
  });

  it('reuses the stored mapping instead of creating a second account', async () => {
    h.state.rpcHandlers.consume_sms_otp = () => ({ data: 'challenge-id', error: null });
    h.state.rpcHandlers.sms_account_upsert = () => ({ data: null, error: null });
    h.state.selectResult = { user_id: 'user-9', identity_kind: 'email', email: 'sms+1@x.app' };
    h.state.signInData = { access_token: 'a', refresh_token: 'r', expires_at: 1 };

    const result = await verifySmsCode({ phone: '09121234567', code: '12345' });
    expect(result.ok).toBe(true);
    expect(callsOf('createUser')).toHaveLength(0);
    const signIn = callsOf('signInWithPassword')[0]?.detail as Record<string, any>;
    expect(signIn.email).toBe('sms+1@x.app');
  });

  it('falls back to a synthetic email identity when the phone provider is disabled', async () => {
    h.state.rpcHandlers.consume_sms_otp = () => ({ data: 'challenge-id', error: null });
    h.state.rpcHandlers.find_user_by_phone = () => ({ data: null, error: null });
    h.state.rpcHandlers.sms_account_upsert = () => ({ data: null, error: null });
    h.state.createUserError = { message: 'Phone logins are disabled for this project' };
    h.state.createUserData = { id: 'user-2', email: 'sms+9121234567@phone.aqualedger.app' };
    h.state.signInData = { access_token: 'a', refresh_token: 'r', expires_at: 1 };

    const result = await verifySmsCode({ phone: '09121234567', code: '12345' });
    expect(result.ok).toBe(true);
    const creates = callsOf('createUser');
    expect(creates).toHaveLength(2);
    const fallback = creates[1].detail as Record<string, any>;
    expect(fallback.email).toBe('sms+9121234567@phone.aqualedger.app');
    expect(fallback.email_confirm).toBe(true);
    const signIn = callsOf('signInWithPassword')[0]?.detail as Record<string, any>;
    expect(signIn.email).toBe('sms+9121234567@phone.aqualedger.app');
  });

  it('answers 503 when the service-role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await verifySmsCode({ phone: '09121234567', code: '12345' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
  });
});
