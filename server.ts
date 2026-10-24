import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeWithGemini, analyzeAudioWithGemini, analyzeToolCall, hasGeminiKey } from './server/gemini';
import { fallbackAnalyzeTransaction } from './server/fallbackParser';
import { finalizeAnalysis } from './server/suspicion';
import { aiRateLimiter, smsRateLimiter } from './server/rateLimit';
import { checkAuthHeader, UNAUTHORIZED_ERROR } from './server/auth';
import { checkAiUsage, AI_QUOTA_ERROR } from './server/aiUsage';
import { requestSmsCode, verifySmsCode } from './server/smsAuth';
import {
  analyzeTransactionRequestSchema,
  analyzeAudioRequestSchema,
  toolCallRequestSchema,
} from './src/types/schemas';
import { TOOL_REGISTRY, getToolDefinition, type StoreSnapshot } from './server/toolRegistry';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Body limits: text endpoint is small; audio endpoint allows up to ~10MB of audio.
app.use('/api/analyze-transaction', express.json({ limit: '100kb' }));
app.use('/api/analyze-audio', express.json({ limit: '15mb' }));
app.use('/api/auth/sms', express.json({ limit: '10kb' }));
app.use('/api/ai-tool-call', express.json({ limit: '100kb' }));
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

// AI Tool Call endpoint: natural language → tool execution
app.post('/api/ai-tool-call', aiRateLimiter, async (req, res) => {
  const auth = await authenticate(req, res);
  if (!auth.ok) return;

  const parsed = toolCallRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'متن ورودی الزامی است.' });
  }
  if (auth.token) {
    const usage = await checkAiUsage(auth.token);
    if (!usage.allowed) {
      return res.status(429).json({ error: AI_QUOTA_ERROR });
    }
  }

  const { text, context, toolCall, confirmed, storeSnapshot } = parsed.data;
  const snap: StoreSnapshot = (storeSnapshot as StoreSnapshot) ?? {
    transactions: [],
    clients: [],
    parts: [],
    settings: { companyName: '', bossName: '', bossPhone: '', technicianName: '', companyLogo: '', monthlyBaseSalary: 0, salaryPaymentDay: 25, overtimeHourlyRate: 0, insuranceDeduction: 0, autoAccrueSalary: false },
    serviceLogs: [],
  };

  // Phase 1: no toolCall yet → ask Gemini to extract one from the text.
  if (!toolCall) {
    const inputText = text || '';
    if (!inputText) {
      return res.status(400).json({ error: 'متن ورودی الزامی است.' });
    }
    if (!hasGeminiKey()) {
      return res.status(503).json({
        error: 'سرویس herramienta فعال نیست (کلید هوش مصنوعی تنظیم نشده). لطفاً متن را به صورت دستی وارد کنید.',
      });
    }
    try {
      const extracted = await analyzeToolCall(inputText, context ?? {});
      if (!extracted || !extracted.name) {
        return res.status(400).json({ error: 'امکان تشخیص تابع مناسب از متن پیدا نشد. لطفاً مشخصات را به وضوح بگویید.' });
      }
      const def = getToolDefinition(extracted.name);
      if (!def) {
        return res.status(400).json({ error: `تابع «${extracted.name}» پشتیبانی نمی‌شود.` });
      }
      // Validate arguments against tool schema.
      const argParse = def.inputSchema.safeParse(extracted.arguments);
      if (!argParse.success) {
        return res.status(400).json({ error: 'آرگومان‌های تابع معتبر نیستند.', details: argParse.error.flatten() });
      }
      // If confirmation required, return pending without executing.
      if (def.requiresConfirmation && !confirmed) {
        const summary = await buildConfirmationSummary(def.name, extracted.arguments, snap);
        return res.json({
          status: 'pending_confirmation',
          toolCall: { name: extracted.name, arguments: argParse.data },
          summary,
        });
      }
      // No confirmation needed (or already confirmed) → execute.
      const result = await def.handler(argParse.data as Record<string, unknown>, context ?? {}, snap);
      return res.json(result);
    } catch (error) {
      console.error('AI tool call extraction failed:', error);
      return res.status(500).json({ error: 'خطا در استخراج تابع از متن. لطفاً دوباره تلاش کنید.' });
    }
  }

  // Phase 2: toolCall provided with confirmed=true → execute.
  if (toolCall && confirmed) {
    const def = getToolDefinition(toolCall.name);
    if (!def) {
      return res.status(400).json({ error: `تابع «${toolCall.name}» پشتیبانی نمی‌شود.` });
    }
    const argParse = def.inputSchema.safeParse(toolCall.arguments);
    if (!argParse.success) {
      return res.status(400).json({ error: 'آرگومان‌های تابع معتبر نیستند.', details: argParse.error.flatten() });
    }
    try {
      const result = await def.handler(argParse.data as Record<string, unknown>, context ?? {}, snap);
      return res.json(result);
    } catch (error) {
      console.error('AI tool call execution failed:', error);
      return res.status(500).json({ error: 'خطا در اجرای تابع. لطفاً دوباره تلاش کنید.' });
    }
  }

  // toolCall provided but not confirmed → return pending.
  if (toolCall && !confirmed) {
    const def = getToolDefinition(toolCall.name);
    if (!def) {
      return res.status(400).json({ error: `تابع «${toolCall.name}» پشتیبانی نمی‌شود.` });
    }
    const summary = await buildConfirmationSummary(def.name, toolCall.arguments, snap);
    return res.json({
      status: 'pending_confirmation',
      toolCall,
      summary,
    });
  }

  return res.status(400).json({ error: 'درخواست نامعتبر است.' });
});

// Helper: build Persian confirmation summary for a tool call.
async function buildConfirmationSummary(
  toolName: string,
  args: Record<string, unknown>,
  snap: StoreSnapshot
): Promise<string> {
  const def = getToolDefinition(toolName);
  if (!def) return 'تابع ناشناخته.';
  switch (toolName) {
    case 'recordBossAdvance':
      return `تایید دریافت ${args.amount} تومان مساعده از رئیس/شرکت؟`;
    case 'recordSalaryPayout':
      return `تایید واریز ${args.amount} تومان حقوق توسط شرکت؟`;
    case 'recordCompanyExpense':
      return `تایید خرید ${args.amount} تومانی از جیب برای شرکت${args.item ? ` (${args.item})` : ''}؟`;
    case 'recordCustomerPayment': {
      const cash = args.cashAmount || 0;
      const pos = args.posAmount || 0;
      const total = Number(cash) + Number(pos);
      return `تایید دریافت ${total} تومان از ${args.customerName || 'مشتری'}؟`;
    }
    case 'settleClientInvoice':
      return `تایید تسویه ${args.amount} تومان بدهی ${args.customerName || 'مشتری'}؟`;
    case 'createCustomerProfile':
      return `تایید ایجاد پرونده مشتری «${args.name || 'نامشخص'}»؟`;
    case 'appendCustomerNote':
      return `تایید افزودن یادداشت به پرونده ${args.customerName || 'مشتری'}؟`;
    case 'restockPart':
      return `تایید افزودن ${args.quantity} عدد «${args.partName}» به انبار؟`;
    case 'deductStock':
      return `تایید کسر موجودی قطعات برای${args.jobLocation ? ` ${args.jobLocation}` : ''}؟`;
    case 'scheduleServiceReminder':
      return `تایید ثبت یادآور «${args.serviceType}» برای ${args.customerName || 'مشتری'} در هر ${args.intervalMonths || 6} ماه؟`;
    default:
      return `تایید اجرای «${toolName}»؟`;
  }
}

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
