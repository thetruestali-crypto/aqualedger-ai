// SMS.ir REST client (v1) — no SDK, plain fetch.
// Server-only: the API key and the OTP code never reach the browser.
// Two delivery modes (see docs/DECISIONS.md D30):
//  - /v1/send/verify : needs a panel template (SMSIR_TEMPLATE_ID) — preferred.
//  - /v1/send/bulk   : needs a sender line (SMSIR_SENDER or /v1/line lookup).
import { toNationalPhone } from '../src/lib/phone';

export interface SmsConfig {
  apiKey: string;
  sender: string;
  templateId: string;
  codeParam: string;
  baseUrl: string;
}

export type SmsSendResult = { ok: true } | { ok: false; error: string };

interface SmsPayload {
  status?: number;
  message?: string;
  data?: unknown;
}

interface SmsAttempt {
  ok: boolean;
  error?: string;
  data?: unknown;
  /** True when the panel complained about the recipient number format. */
  mobileFormat?: boolean;
}

/** Panel status codes -> Persian messages shown to the user. */
const SMS_STATUS_MESSAGES: Record<number, string> = {
  0: 'کلید وب‌سرویس پیامک نامعتبر است.',
  10: 'کلید وب‌سرویس پیامک غیرفعال است.',
  11: 'کلید وب‌سرویس پیامک به IP محدود شده است.',
  12: 'حساب پیامک غیرفعال است.',
  13: 'متن پیامک معتبر نیست.',
  14: 'شمارهٔ مقصد معتبر نیست.',
  15: 'خط ارسال‌کننده معتبر نیست.',
  16: 'سقف پیامک روزانه تکمیل شده است.',
  20: 'سرویس پیامک در دسترس نیست.',
  23: 'حساب پیامک فعال نیست.',
  24: 'خطای داخلی سرویس پیامک.',
  101: 'کلید وب‌سرویس پیامک نامعتبر است.',
};

const GENERIC_SEND_ERROR = 'ارسال پیامک ناموفق بود. لطفاً بعداً تلاش کنید.';
const OTP_MESSAGE_PREFIX = 'کد ورود AquaLedger';

/** Cached sender line for the bulk endpoint (per warm instance). */
let cachedLineNumber: number | null = null;

export function getSmsConfig(): SmsConfig {
  const codeParam = (process.env.SMSIR_CODE_PARAM || '').trim();
  const baseUrl = (process.env.SMSIR_BASE_URL || 'https://api.sms.ir/v1').trim();
  return {
    apiKey: (process.env.SMSIR_API_KEY || '').trim(),
    sender: (process.env.SMSIR_SENDER || '').trim(),
    templateId: (process.env.SMSIR_TEMPLATE_ID || '').trim(),
    codeParam: codeParam || 'Code',
    baseUrl: baseUrl.replace(/\/+$/, '') || 'https://api.sms.ir/v1',
  };
}

/** True when SMS.ir credentials are present. */
export function isSmsConfigured(): boolean {
  return Boolean(getSmsConfig().apiKey);
}

/** Forget the cached sender line (tests / configuration changes). */
export function resetSmsLineCache(): void {
  cachedLineNumber = null;
}

function isMobileFormatError(status: number | undefined, message: string | undefined): boolean {
  if (status === 14) return true;
  if (!message) return false;
  return /mobile|شماره|فرمت|number/i.test(message);
}

async function requestSms(
  config: SmsConfig,
  path: string,
  body: unknown,
): Promise<SmsAttempt> {
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد.' };
  }

  if (res.status === 401) {
    return { ok: false, error: 'کلید وب‌سرویس پیامک نامعتبر است.' };
  }
  if (res.status === 429) {
    return { ok: false, error: 'تعداد درخواست پیامک بیش از حد مجاز است.' };
  }
  if (res.status >= 500) {
    return { ok: false, error: 'سرویس پیامک در دسترس نیست.' };
  }

  let payload: SmsPayload | null = null;
  try {
    payload = (await res.json()) as SmsPayload;
  } catch {
    payload = null;
  }
  if (!payload) {
    return res.ok ? { ok: true } : { ok: false, error: GENERIC_SEND_ERROR };
  }

  const status = typeof payload.status === 'number' ? payload.status : undefined;
  const message = typeof payload.message === 'string' ? payload.message : undefined;
  // SMS.ir answers with status 200 on success and with a small set of panel
  // codes (0/10/11/12/...) on failure; any other 2xx is treated as success.
  const succeeded = status === undefined || (status >= 200 && status < 300);
  if (!succeeded) {
    const known = SMS_STATUS_MESSAGES[status as number];
    return {
      ok: false,
      error: known ?? GENERIC_SEND_ERROR,
      mobileFormat: isMobileFormatError(status, message),
    };
  }
  if (!res.ok) {
    return { ok: false, error: GENERIC_SEND_ERROR };
  }
  return { ok: true, data: payload.data };
}

function extractLineNumber(data: unknown): number | null {
  const groups: unknown[] = [];
  if (Array.isArray(data)) {
    groups.push(data);
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.lines)) groups.push(obj.lines);
    else if (Array.isArray(obj.data)) groups.push(obj.data);
    else groups.push(obj);
  }
  for (const group of groups) {
    const list = Array.isArray(group) ? group : [group];
    for (const item of list) {
      if (typeof item === 'number' && Number.isFinite(item)) return item;
      if (typeof item === 'string' && /^\d+$/.test(item)) return Number(item);
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        for (const key of ['line', 'lineNumber', 'number']) {
          const value = rec[key];
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
        }
      }
    }
  }
  return null;
}

async function resolveSenderLine(
  config: SmsConfig,
): Promise<{ ok: true; lineNumber: number } | { ok: false; error: string }> {
  if (config.sender) {
    const lineNumber = Number(config.sender);
    if (Number.isFinite(lineNumber) && lineNumber > 0) return { ok: true, lineNumber };
    return { ok: false, error: 'شمارهٔ خط ارسال پیامک معتبر نیست.' };
  }
  if (cachedLineNumber !== null) return { ok: true, lineNumber: cachedLineNumber };

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/line`, {
      method: 'GET',
      headers: { 'X-API-KEY': config.apiKey, Accept: 'application/json' },
    });
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد.' };
  }
  if (res.status === 401) return { ok: false, error: 'کلید وب‌سرویس پیامک نامعتبر است.' };
  if (res.status === 429) return { ok: false, error: 'تعداد درخواست پیامک بیش از حد مجاز است.' };

  let payload: SmsPayload | null = null;
  try {
    payload = (await res.json()) as SmsPayload;
  } catch {
    payload = null;
  }
  if (!payload) return { ok: false, error: GENERIC_SEND_ERROR };

  const status = typeof payload.status === 'number' ? payload.status : undefined;
  if (status !== undefined && (status < 200 || status >= 300)) {
    return { ok: false, error: SMS_STATUS_MESSAGES[status] ?? GENERIC_SEND_ERROR };
  }
  const lineNumber = extractLineNumber(payload.data);
  if (lineNumber === null) {
    return { ok: false, error: 'خط ارسال‌کننده در پنل پیامک تعریف نشده است.' };
  }
  cachedLineNumber = lineNumber;
  return { ok: true, lineNumber };
}

async function sendViaTemplate(
  config: SmsConfig,
  mobile: string,
  code: string,
): Promise<SmsAttempt> {
  return requestSms(config, '/send/verify', {
    mobile,
    templateId: config.templateId,
    parameters: [{ name: config.codeParam, value: code }],
  });
}

async function sendViaBulk(
  config: SmsConfig,
  mobile: string,
  code: string,
): Promise<SmsAttempt> {
  const line = await resolveSenderLine(config);
  if (!line.ok) return { ok: false, error: line.error };
  return requestSms(config, '/send/bulk', {
    lineNumber: line.lineNumber,
    messageText: `${OTP_MESSAGE_PREFIX}: ${code}`,
    mobiles: [mobile],
  });
}

async function deliver(
  config: SmsConfig,
  mobile: string,
  code: string,
): Promise<SmsAttempt> {
  if (config.templateId) return sendViaTemplate(config, mobile, code);
  return sendViaBulk(config, mobile, code);
}

/**
 * Send the one-time code to an Iranian mobile number.
 * The recipient is tried in the national format first and, only when the panel
 * complains about the number format, once more in the +98 form.
 */
export async function sendOtpSms(phoneE164: string, code: string): Promise<SmsSendResult> {
  const config = getSmsConfig();
  if (!config.apiKey) {
    return { ok: false, error: 'سرویس پیامک فعال نیست. لطفاً با حساب گوگل وارد شوید.' };
  }
  const national = toNationalPhone(phoneE164);
  if (!national) return { ok: false, error: 'شمارهٔ موبایل معتبر نیست.' };

  const first = await deliver(config, national, code);
  if (first.ok || !first.mobileFormat) {
    return first.ok ? { ok: true } : { ok: false, error: first.error ?? GENERIC_SEND_ERROR };
  }
  const retry = await deliver(config, `+98${national.slice(1)}`, code);
  if (retry.ok) return { ok: true };
  return { ok: false, error: retry.error ?? GENERIC_SEND_ERROR };
}
