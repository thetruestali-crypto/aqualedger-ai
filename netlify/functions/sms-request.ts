// Netlify Function v2: POST /api/auth/sms/request
// Stateless (no Express, no filesystem, no in-memory rate-limit).
// All logic lives in server/smsAuth.ts — no duplicated business rules.
import { requestSmsCode } from '../../server/smsAuth';

export const config = { path: '/api/auth/sms/request' };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function clientIp(req: Request): string {
  const direct = req.headers.get('x-nf-client-connection-ip');
  if (direct) return direct.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '';
  return '';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'متد مجاز نیست.' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'بدنهٔ درخواست معتبر نیست.' }, 400);
  }

  const phone =
    body && typeof body === 'object' && typeof (body as { phone?: unknown }).phone === 'string'
      ? (body as { phone: string }).phone
      : '';

  const result = await requestSmsCode({ phone, ip: clientIp(req) });
  if (!result.ok) {
    return json({ error: result.error }, result.status);
  }
  return json({ ok: true, expiresIn: result.expiresIn, resendAfter: result.resendAfter });
}
