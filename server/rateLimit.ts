// Rate limiting for AI endpoints (Gemini costs money; brute force must be throttled).
import { rateLimit } from 'express-rate-limit';

// 30 AI requests / 10 min / IP — generous for a single technician, stops abuse.
export const aiRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'درخواست‌های شما بیش از حد مجاز است. لطفاً چند دقیقه بعد تلاش کنید.' },
});
