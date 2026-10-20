import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSmsConfig,
  isSmsConfigured,
  resetSmsLineCache,
  sendOtpSms,
} from '@/server/sms';

// SMS.ir REST client: the request shape must match the panel API, the panel
// error codes must become Persian messages, and the API key must never leave
// the X-API-KEY header.
describe('sms.ir client', () => {
  const fetchMock = vi.fn();
  const OLD_ENV = { ...process.env };

  function okResponse(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    resetSmsLineCache();
    process.env.SMSIR_API_KEY = 'test-api-key';
    process.env.SMSIR_BASE_URL = 'https://api.sms.ir/v1';
    delete process.env.SMSIR_TEMPLATE_ID;
    delete process.env.SMSIR_SENDER;
    process.env.SMSIR_CODE_PARAM = 'Code';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...OLD_ENV };
  });

  it('reads the configuration from the environment', () => {
    expect(isSmsConfigured()).toBe(true);
    const config = getSmsConfig();
    expect(config.apiKey).toBe('test-api-key');
    expect(config.templateId).toBe('');
    expect(config.codeParam).toBe('Code');
  });

  it('is not configured without an API key', () => {
    delete process.env.SMSIR_API_KEY;
    expect(isSmsConfigured()).toBe(false);
  });

  it('sends the code through the verify template endpoint', async () => {
    process.env.SMSIR_TEMPLATE_ID = '123456';
    fetchMock.mockResolvedValue(okResponse({ status: 200, message: 'ok', data: { messageId: 7 } }));

    const result = await sendOtpSms('+989121234567', '43210');
    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sms.ir/v1/send/verify');
    expect(init.method).toBe('POST');
    expect(init.headers['X-API-KEY']).toBe('test-api-key');
    expect(JSON.parse(init.body)).toEqual({
      mobile: '09121234567',
      templateId: '123456',
      parameters: [{ name: 'Code', value: '43210' }],
    });
    expect(init.body).not.toContain('test-api-key');
  });

  it('falls back to the bulk endpoint with the configured line', async () => {
    process.env.SMSIR_SENDER = '30004505000017';
    fetchMock.mockResolvedValue(okResponse({ status: 200, message: 'ok', data: { messageId: 9 } }));

    const result = await sendOtpSms('+989121234567', '43210');
    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sms.ir/v1/send/bulk');
    const body = JSON.parse(init.body);
    expect(body.lineNumber).toBe(30004505000017);
    expect(body.mobiles).toEqual(['09121234567']);
    expect(body.messageText).toContain('43210');
  });

  it('discovers the sender line from /v1/line when none is configured', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ status: 200, data: { lines: [{ line: 30004505000017 }] } }))
      .mockResolvedValueOnce(okResponse({ status: 200, message: 'ok' }));

    const result = await sendOtpSms('+989121234567', '43210');
    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.sms.ir/v1/line');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).lineNumber).toBe(30004505000017);
  });

  it('maps the panel error codes to Persian messages', async () => {
    process.env.SMSIR_TEMPLATE_ID = '123456';
    fetchMock.mockResolvedValue(okResponse({ status: 11, message: 'IP restricted' }));

    const result = await sendOtpSms('+989121234567', '43210');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('کلید وب‌سرویس پیامک به IP محدود شده است.');
    }
  });

  it('maps HTTP 401 and 429 to Persian messages', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const unauthorized = await sendOtpSms('+989121234567', '43210');
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error).toBe('کلید وب‌سرویس پیامک نامعتبر است.');
    }

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const throttled = await sendOtpSms('+989121234567', '43210');
    expect(throttled.ok).toBe(false);
    if (!throttled.ok) {
      expect(throttled.error).toBe('تعداد درخواست پیامک بیش از حد مجاز است.');
    }
  });

  it('retries once with the +98 format when the panel rejects the number', async () => {
    process.env.SMSIR_TEMPLATE_ID = '123456';
    fetchMock
      .mockResolvedValueOnce(okResponse({ status: 14, message: 'invalid mobile' }))
      .mockResolvedValueOnce(okResponse({ status: 200, message: 'ok' }));

    const result = await sendOtpSms('+989121234567', '43210');
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).mobile).toBe('09121234567');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).mobile).toBe('+989121234567');
  });

  it('never sends a request without an API key', async () => {
    delete process.env.SMSIR_API_KEY;
    const result = await sendOtpSms('+989121234567', '43210');
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
