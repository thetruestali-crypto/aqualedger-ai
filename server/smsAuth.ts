// SMS (phone) authentication service — shared by Express and Netlify Functions.
// No Express, no Netlify, no in-memory state: everything that must survive
// between the "request code" and the "verify code" calls lives in Supabase
// (public.sms_otp_challenges / public.sms_accounts).
// The OTP code itself is never stored raw (HMAC-SHA256) and never logged.
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePersianText } from '../src/lib/persianNumbers';
import { toPersianDigits } from '../src/lib/format';
import { normalizeIranianPhone } from '../src/lib/phone';
import { getPublicClient, getServiceClient } from './supabaseAdmin';
import { isSmsConfigured, sendOtpSms } from './sms';

const DEFAULT_OTP_LENGTH = 5;
const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_RESEND_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_PER_HOUR_PER_PHONE = 5;
const DEFAULT_MAX_PER_HOUR_PER_IP = 20;
const CHALLENGE_CLEANUP_AGE_HOURS = 48;
const SYNTHETIC_EMAIL_DOMAIN = 'phone.aqualedger.app';

export const SMS_ERRORS = {
  invalidPhone: 'شمارهٔ موبایل معتبر نیست.',
  notConfigured: 'سرویس پیامک فعال نیست. لطفاً با حساب گوگل وارد شوید.',
  unavailable: 'سرویس پیامک در دسترس نیست. لطفاً بعداً تلاش کنید.',
  rateLimited: 'تعداد درخواست کد بیش از حد مجاز است.',
  invalidCode: 'کد تأیید نامعتبر یا منقضی شده است.',
  accountFailed: 'ساخت حساب کاربری ناموفق بود. لطفاً دوباره تلاش کنید.',
  signInFailed: 'ورود با حساب کاربری ناموفق بود. لطفاً دوباره تلاش کنید.',
} as const;

export interface SmsRequestInput {
  phone: string;
  ip?: string;
}

export interface SmsRequestSuccess {
  ok: true;
  expiresIn: number;
  resendAfter: number;
}

export interface SmsRequestFailure {
  ok: false;
  status: number;
  error: string;
}

export type SmsRequestResult = SmsRequestSuccess | SmsRequestFailure;

export interface SmsVerifyInput {
  phone: string;
  code: string;
  ip?: string;
}

export interface SmsVerifySuccess {
  ok: true;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  phone: string;
}

export interface SmsVerifyFailure {
  ok: false;
  status: number;
  error: string;
}

export type SmsVerifyResult = SmsVerifySuccess | SmsVerifyFailure;

interface SmsAccount {
  userId: string;
  identityKind: 'phone' | 'email';
  email: string | null;
  phone: string;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getOtpSecret(): string | null {
  const secret = (process.env.SMS_OTP_SECRET || '').trim();
  return secret ? secret : null;
}

function getOtpLength(): number {
  return Math.min(10, Math.max(4, envInt('SMS_OTP_LENGTH', DEFAULT_OTP_LENGTH)));
}

function getTtlSeconds(): number {
  return envInt('SMS_OTP_TTL_SECONDS', DEFAULT_TTL_SECONDS);
}

function getResendSeconds(): number {
  return envInt('SMS_OTP_RESEND_SECONDS', DEFAULT_RESEND_SECONDS);
}

function getMaxAttempts(): number {
  return envInt('SMS_OTP_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS);
}

function getMaxPerHourPerPhone(): number {
  return envInt('SMS_OTP_MAX_PER_HOUR_PER_PHONE', DEFAULT_MAX_PER_HOUR_PER_PHONE);
}

function getMaxPerHourPerIp(): number {
  return envInt('SMS_OTP_MAX_PER_HOUR_PER_IP', DEFAULT_MAX_PER_HOUR_PER_IP);
}

/** Cryptographically random numeric code, zero padded to the configured length. */
function generateOtpCode(length: number): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, '0');
}

/** HMAC-SHA256 of the code; the raw code is never persisted. */
function hashOtp(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

/** Accept Persian digits and separators; only digits survive. */
function normalizeOtpCode(raw: string): string {
  if (typeof raw !== 'string') return '';
  const digits = normalizePersianText(raw).replace(/\D/g, '');
  return digits.length === getOtpLength() ? digits : '';
}

function cooldownError(resendSeconds: number): string {
  return `لطفاً ${toPersianDigits(resendSeconds)} ثانیه دیگر صبر کنید.`;
}

function syntheticEmailFor(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '').replace(/^98/, '');
  return `sms+${digits}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

function isPhoneProviderDisabled(error: { message?: string } | null | undefined): boolean {
  const message = (error?.message ?? '').toLowerCase();
  if (!message) return false;
  const mentionsPhone = /phone|telephone|otp|شماره/.test(message);
  const mentionsDisabled = /disabled|not enabled|not allowed|unsupported|turned off|off\b/.test(
    message,
  );
  return mentionsPhone && mentionsDisabled;
}

function isAlreadyRegistered(error: { message?: string } | null | undefined): boolean {
  const message = (error?.message ?? '').toLowerCase();
  if (!message) return false;
  return /already been registered|already registered|already exists|duplicate/.test(message);
}

async function readUserEmail(
  service: SupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await service.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

async function cleanupOldChallenges(service: SupabaseClient): Promise<void> {
  try {
    const cutoff = new Date(
      Date.now() - CHALLENGE_CLEANUP_AGE_HOURS * 3600 * 1000,
    ).toISOString();
    await service.from('sms_otp_challenges').delete().lt('created_at', cutoff);
  } catch {
    // best effort cleanup
  }
}

/**
 * Resolve (or create) the Supabase user behind a phone number.
 * The stored mapping wins, so the phone -> identity decision is made once and
 * reused on every later login.
 */
async function ensureSmsAccount(
  service: SupabaseClient,
  phoneE164: string,
): Promise<{ ok: true; account: SmsAccount } | { ok: false; status: number; error: string }> {
  const { data: stored, error: storedError } = await service
    .from('sms_accounts')
    .select('user_id, identity_kind, email')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  if (storedError) {
    return { ok: false, status: 503, error: SMS_ERRORS.unavailable };
  }
  if (stored) {
    const row = stored as { user_id: string; identity_kind: string; email: string | null };
    return {
      ok: true,
      account: {
        userId: row.user_id,
        identityKind: row.identity_kind === 'email' ? 'email' : 'phone',
        email: row.email ?? null,
        phone: phoneE164,
      },
    };
  }

  // An existing Supabase user that already carries this phone (e.g. a Google
  // account with the number attached) is reused instead of creating a duplicate.
  const { data: foundByPhone } = await service.rpc('find_user_by_phone', {
    p_phone: phoneE164,
  });
  if (typeof foundByPhone === 'string' && foundByPhone) {
    return {
      ok: true,
      account: {
        userId: foundByPhone,
        identityKind: 'phone',
        email: await readUserEmail(service, foundByPhone),
        phone: phoneE164,
      },
    };
  }

  const password = randomBytes(36).toString('base64url');
  const userMetadata = { phone: phoneE164, auth_method: 'sms' };

  const { data: created, error: createError } = await service.auth.admin.createUser({
    phone: phoneE164,
    phone_confirm: true,
    password,
    user_metadata: userMetadata,
  });
  if (created?.user?.id) {
    return {
      ok: true,
      account: {
        userId: created.user.id,
        identityKind: 'phone',
        email: created.user.email ?? null,
        phone: phoneE164,
      },
    };
  }

  if (isPhoneProviderDisabled(createError)) {
    // The Supabase phone provider is off: fall back to a synthetic email identity.
    const syntheticEmail = syntheticEmailFor(phoneE164);
    const { data: emailCreated, error: emailError } = await service.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      password,
      user_metadata: userMetadata,
    });
    if (emailCreated?.user?.id) {
      return {
        ok: true,
        account: {
          userId: emailCreated.user.id,
          identityKind: 'email',
          email: syntheticEmail,
          phone: phoneE164,
        },
      };
    }
    if (isAlreadyRegistered(emailError)) {
      const { data: foundByEmail } = await service.rpc('find_user_by_email', {
        p_email: syntheticEmail,
      });
      if (typeof foundByEmail === 'string' && foundByEmail) {
        return {
          ok: true,
          account: {
            userId: foundByEmail,
            identityKind: 'email',
            email: syntheticEmail,
            phone: phoneE164,
          },
        };
      }
    }
    return { ok: false, status: 502, error: SMS_ERRORS.accountFailed };
  }

  if (isAlreadyRegistered(createError)) {
    const { data: retryPhone } = await service.rpc('find_user_by_phone', {
      p_phone: phoneE164,
    });
    if (typeof retryPhone === 'string' && retryPhone) {
      return {
        ok: true,
        account: {
          userId: retryPhone,
          identityKind: 'phone',
          email: await readUserEmail(service, retryPhone),
          phone: phoneE164,
        },
      };
    }
  }

  return { ok: false, status: 502, error: SMS_ERRORS.accountFailed };
}

/** Mint a real Supabase session with the (just rotated) random password. */
async function signInWithPassword(
  publicClient: SupabaseClient,
  account: SmsAccount,
  password: string,
): Promise<
  | { ok: true; accessToken: string; refreshToken: string; expiresAt: number }
  | { ok: false; error: string }
> {
  const attempts: Array<{ phone: string; password: string } | { email: string; password: string }> =
    [];
  if (account.identityKind === 'phone') {
    attempts.push({ phone: account.phone, password });
    if (account.email) attempts.push({ email: account.email, password });
  } else if (account.email) {
    attempts.push({ email: account.email, password });
  }
  if (attempts.length === 0) return { ok: false, error: SMS_ERRORS.signInFailed };

  for (const credentials of attempts) {
    try {
      const { data, error } = await publicClient.auth.signInWithPassword(credentials);
      const session = data?.session;
      if (!error && session?.access_token && session?.refresh_token) {
        const expiresAt =
          typeof session.expires_at === 'number'
            ? session.expires_at
            : Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600);
        return {
          ok: true,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt,
        };
      }
    } catch {
      // try the next credential shape
    }
  }
  return { ok: false, error: SMS_ERRORS.signInFailed };
}

/**
 * Step 1: normalize the number, enforce the rate limits, store the hashed
 * code and send the SMS.
 */
export async function requestSmsCode(input: SmsRequestInput): Promise<SmsRequestResult> {
  const phoneE164 = normalizeIranianPhone(input.phone);
  if (!phoneE164) return { ok: false, status: 400, error: SMS_ERRORS.invalidPhone };

  const secret = getOtpSecret();
  if (!isSmsConfigured() || !secret) {
    return { ok: false, status: 503, error: SMS_ERRORS.notConfigured };
  }
  const service = getServiceClient();
  if (!service) {
    return { ok: false, status: 503, error: SMS_ERRORS.notConfigured };
  }

  const ip = (input.ip ?? '').trim();
  const resendAfter = getResendSeconds();
  const { data: stats, error: statsError } = await service.rpc('sms_otp_stats', {
    p_phone: phoneE164,
    p_ip: ip || null,
  });
  if (statsError || !stats) {
    return { ok: false, status: 503, error: SMS_ERRORS.unavailable };
  }

  const counters = stats as Record<string, unknown>;
  const phoneSends = Number(counters.phone_sends ?? 0);
  const ipSends = Number(counters.ip_sends ?? 0);
  const lastAt = counters.phone_last_at ? Date.parse(String(counters.phone_last_at)) : 0;
  if (lastAt && Date.now() - lastAt < resendAfter * 1000) {
    return { ok: false, status: 429, error: cooldownError(resendAfter) };
  }
  if (phoneSends >= getMaxPerHourPerPhone() || ipSends >= getMaxPerHourPerIp()) {
    return { ok: false, status: 429, error: SMS_ERRORS.rateLimited };
  }

  const code = generateOtpCode(getOtpLength());
  const codeHash = hashOtp(code, secret);
  const ttlSeconds = getTtlSeconds();
  const { error: insertError } = await service.from('sms_otp_challenges').insert({
    phone_e164: phoneE164,
    code_hash: codeHash,
    attempts: 0,
    max_attempts: getMaxAttempts(),
    ip: ip || null,
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  });
  if (insertError) {
    return { ok: false, status: 503, error: SMS_ERRORS.unavailable };
  }

  const sent = await sendOtpSms(phoneE164, code);
  if (!sent.ok) {
    await service
      .from('sms_otp_challenges')
      .delete()
      .eq('phone_e164', phoneE164)
      .eq('code_hash', codeHash);
    return { ok: false, status: 502, error: sent.error };
  }

  void cleanupOldChallenges(service);

  return { ok: true, expiresIn: ttlSeconds, resendAfter };
}

/**
 * Step 2: consume the code atomically, resolve the user and mint a session.
 * Wrong, expired and unknown codes always produce the same Persian message.
 */
export async function verifySmsCode(input: SmsVerifyInput): Promise<SmsVerifyResult> {
  const phoneE164 = normalizeIranianPhone(input.phone);
  if (!phoneE164) return { ok: false, status: 400, error: SMS_ERRORS.invalidPhone };

  const secret = getOtpSecret();
  if (!isSmsConfigured() || !secret) {
    return { ok: false, status: 503, error: SMS_ERRORS.notConfigured };
  }
  const service = getServiceClient();
  const publicClient = getPublicClient();
  if (!service || !publicClient) {
    return { ok: false, status: 503, error: SMS_ERRORS.notConfigured };
  }

  const code = normalizeOtpCode(input.code);
  if (!code) return { ok: false, status: 400, error: SMS_ERRORS.invalidCode };

  const { data: consumed, error: consumeError } = await service.rpc('consume_sms_otp', {
    p_phone: phoneE164,
    p_code_hash: hashOtp(code, secret),
  });
  if (consumeError) {
    return { ok: false, status: 503, error: SMS_ERRORS.unavailable };
  }
  if (!consumed) {
    return { ok: false, status: 400, error: SMS_ERRORS.invalidCode };
  }

  const resolved = await ensureSmsAccount(service, phoneE164);
  if (!resolved.ok) {
    return { ok: false, status: resolved.status, error: resolved.error };
  }

  // Rotate the credential on every successful verification: the random
  // password is never stored, never sent to the client and is dead afterwards.
  const randomPassword = randomBytes(36).toString('base64url');
  const { error: updateError } = await service.auth.admin.updateUserById(
    resolved.account.userId,
    { password: randomPassword },
  );
  if (updateError) {
    return { ok: false, status: 502, error: SMS_ERRORS.signInFailed };
  }

  const signedIn = await signInWithPassword(publicClient, resolved.account, randomPassword);
  if (!signedIn.ok) {
    return { ok: false, status: 401, error: signedIn.error };
  }

  await service.rpc('sms_account_upsert', {
    p_phone: phoneE164,
    p_user_id: resolved.account.userId,
    p_identity_kind: resolved.account.identityKind,
    p_email: resolved.account.email ?? null,
  });

  return {
    ok: true,
    accessToken: signedIn.accessToken,
    refreshToken: signedIn.refreshToken,
    expiresAt: signedIn.expiresAt,
    phone: phoneE164,
  };
}
