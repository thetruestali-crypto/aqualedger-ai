// Netlify Function v2: POST /api/auth/sms/verify
// Stateless (no Express, no filesystem, no in-memory rate-limit).
// All logic lives in server/smsAuth.ts — no duplicated business rules.
import { verifySmsCode } from '../../server/smsAuth';

export const config = { path: '/api/auth/sms/verify' };

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

  const record = (body && typeof body === 'object' ? body : {}) as { phone?: unknown; code?: unknown };
  const phone = typeof record.phone === 'string' ? record.phone : '';
  const code = typeof record.code === 'string' ? record.code : '';

  const result = await verifySmsCode({ phone, code, ip: clientIp(req) });
  if (!result.ok) {
    return json({ error: result.error }, result.status);
  }
  return json({
    ok: true,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
    phone: result.phone,
  });
}
