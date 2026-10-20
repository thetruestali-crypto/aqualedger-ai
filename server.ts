import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeWithGemini, analyzeAudioWithGemini, hasGeminiKey } from './server/gemini';
import { fallbackAnalyzeTransaction } from './server/fallbackParser';
import { finalizeAnalysis } from './server/suspicion';
import { aiRateLimiter, smsRateLimiter } from './server/rateLimit';
import { checkAuthHeader, UNAUTHORIZED_ERROR } from './server/auth';
import { checkAiUsage, AI_QUOTA_ERROR } from './server/aiUsage';
import { requestSmsCode, verifySmsCode } from './server/smsAuth';
import {
  analyzeTransactionRequestSchema,
  analyzeAudioRequestSchema,
} from './src/types/schemas';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Body limits: text endpoint is small; audio endpoint allows up to ~10MB of audio.
app.use('/api/analyze-transaction', express.json({ limit: '100kb' }));
app.use('/api/analyze-audio', express.json({ limit: '15mb' }));
app.use('/api/auth/sms', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '100kb' }));

/**
 * Auth gate for the AI endpoints. Mirrors the Netlify function exactly:
 * a missing or invalid token is a 401 as soon as Supabase is configured, and
 * the check fails open while Supabase is unconfigured (local dev / offline).
 */
async function authenticate(
  req: express.Request,
  res: express.Response,
): Promise<{ ok: true; token: string | null } | { ok: false }> {
  const result = await checkAuthHeader(req.headers.authorization);
  if (!result.ok) {
    res.status(401).json({ error: UNAUTHORIZED_ERROR });
    return { ok: false };
  }
  return { ok: true, token: result.token };
}

// Financial Transaction analysis endpoint for Persian Water Purification Tech
app.post('/api/analyze-transaction', aiRateLimiter, async (req, res) => {
  const auth = await authenticate(req, res);
  if (!auth.ok) return;

  const parsed = analyzeTransactionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'متن ورودی الزامی است.' });
  }
  if (auth.token) {
    const usage = await checkAiUsage(auth.token);
    if (!usage.allowed) {
      return res.status(429).json({ error: AI_QUOTA_ERROR });
    }
  }
  const { text, context } = parsed.data;
  const suspicionCtx = { typicalAmount: context?.typicalAmount };

  // No key -> go straight to the rule-based parser (app stays usable offline/without key).
  if (!hasGeminiKey()) {
    const final = finalizeAnalysis(fallbackAnalyzeTransaction(text, context ?? {}), suspicionCtx);
    if (!final.ok) {
      return res.status(500).json({ error: 'خطا در تحلیل متن ورودی. لطفاً اطلاعات را مجدداً ارسال کنید.' });
    }
    return res.json(final.value);
  }

  try {
    const result = await analyzeWithGemini(text, (context ?? {}) as Record<string, unknown>);
    const final = finalizeAnalysis(result, suspicionCtx);
    if (!final.ok) throw new Error('finalize failed');
    return res.json(final.value);
  } catch (error) {
    console.error('Gemini API call failed, using rule-based fallback parser.');
    try {
      const final = finalizeAnalysis(fallbackAnalyzeTransaction(text, context ?? {}), suspicionCtx);
      if (!final.ok) throw new Error('finalize failed');
      return res.json(final.value);
    } catch {
      return res.status(500).json({
        error: 'خطا در تحلیل متن ورودی. لطفاً اطلاعات را مجدداً ارسال کنید.',
      });
    }
  }
});

// Voice input: MediaRecorder audio -> Gemini multimodal -> same structured result as text.
app.post('/api/analyze-audio', aiRateLimiter, async (req, res) => {
  const auth = await authenticate(req, res);
  if (!auth.ok) return;

  const parsed = analyzeAudioRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'فایل صوتی معتبر ارسال نشده است.' });
  }
  if (auth.token) {
    const usage = await checkAiUsage(auth.token);
    if (!usage.allowed) {
      return res.status(429).json({ error: AI_QUOTA_ERROR });
    }
  }
  if (!hasGeminiKey()) {
    return res.status(503).json({
      error:
        'سرویس تبدیل گفتار فعال نیست (کلید هوش مصنوعی تنظیم نشده). لطفاً متن را تایپ کنید یا از ورودی صوتی مرورگر استفاده کنید.',
    });
  }
  const { audioBase64, mimeType, context } = parsed.data;
  try {
    const result = await analyzeAudioWithGemini(
      audioBase64,
      mimeType,
      (context ?? {}) as Record<string, unknown>,
    );
    const final = finalizeAnalysis(result, { typicalAmount: context?.typicalAmount });
    if (!final.ok) throw new Error('finalize failed');
    return res.json(final.value);
  } catch (error) {
    console.error('Gemini audio analysis failed.');
    return res.status(500).json({
      error: 'خطا در تحلیل فایل صوتی. لطفاً دوباره تلاش کنید یا متن را بنویسید.',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- SMS (phone) login -----------------------------------------------------
// The browser never talks to SMS.ir directly: the API key stays server-side.

app.post('/api/auth/sms/request', smsRateLimiter, async (req, res) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
  const ip = req.ip || req.socket.remoteAddress || '';
  const result = await requestSmsCode({ phone, ip });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.json({
    ok: true,
    expiresIn: result.expiresIn,
    resendAfter: result.resendAfter,
  });
});

app.post('/api/auth/sms/verify', smsRateLimiter, async (req, res) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const ip = req.ip || req.socket.remoteAddress || '';
  const result = await verifySmsCode({ phone, code, ip });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.json({
    ok: true,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
    phone: result.phone,
  });
});

// Malformed JSON bodies must answer with the same Persian JSON contract.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'بدنهٔ درخواست معتبر نیست.' });
  }
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ error: 'حجم درخواست بیش از حد مجاز است.' });
  }
  return next(err);
});

// Configure Vite integration for dev or static serving for prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AquaLedger AI server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
