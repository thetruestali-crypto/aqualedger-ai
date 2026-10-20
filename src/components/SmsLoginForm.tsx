// Persian SMS (phone) login form — presentational (unit-tested with
// renderToString). Stage 1 asks for the mobile number, stage 2 asks for the
// 5-digit code. All state lives in the auth context.
import React from 'react';
import { Loader2, MessageSquare, Smartphone, RefreshCw, ArrowRight } from 'lucide-react';
import { toPersianDigits } from '../lib/format';
import { normalizePersianText } from '../lib/persianNumbers';
import { maskPhone } from '../lib/phone';

export type SmsLoginStage = 'phone' | 'code';

interface SmsLoginFormProps {
  stage: SmsLoginStage;
  phone: string;
  code: string;
  loading: boolean;
  error: string | null;
  info: string | null;
  cooldownSeconds: number;
  onPhoneChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onRequest: () => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}

export const SmsLoginForm: React.FC<SmsLoginFormProps> = ({
  stage,
  phone,
  code,
  loading,
  error,
  info,
  cooldownSeconds,
  onPhoneChange,
  onCodeChange,
  onRequest,
  onVerify,
  onResend,
  onBack,
}) => {
  const canResend = cooldownSeconds <= 0 && !loading;

  return (
    <div className="mt-4" dir="rtl">
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-xs font-bold text-rose-300 text-right"
        >
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div
          role="status"
          className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-300 text-right"
        >
          <span>{info}</span>
        </div>
      )}

      {stage === 'phone' ? (
        <>
          <label
            htmlFor="sms-phone"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>شمارهٔ موبایل</span>
          </label>
          <input
            id="sms-phone"
            type="tel"
            inputMode="numeric"
            dir="rtl"
            autoComplete="tel"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
            className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-base font-bold text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
          />
          <p className="mt-1.5 text-[11px] text-slate-500">شماره را با ۰۹ شروع کنید.</p>

          <button
            type="button"
            onClick={onRequest}
            disabled={loading}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-cyan-500 to-blue-600 px-4 py-3 text-sm font-extrabold text-white transition-all hover:from-cyan-400 hover:to-blue-500 active:scale-95 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال ارسال...</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                <span>ارسال کد تأیید</span>
              </>
            )}
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-center text-xs font-bold text-slate-300">
            کد تأیید ارسال شد به{' '}
            <span className="text-cyan-300">{maskPhone(phone) || phone}</span>
          </p>

          <label
            htmlFor="sms-code"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span>کد تأیید ۵ رقمی</span>
          </label>
          <input
            id="sms-code"
            type="tel"
            inputMode="numeric"
            dir="ltr"
            autoComplete="one-time-code"
            maxLength={5}
            value={toPersianDigits(code)}
            onChange={(event) =>
              onCodeChange(normalizePersianText(event.target.value).replace(/\D/g, ''))
            }
            placeholder="۱۲۳۴۵"
            className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-center text-xl font-black tracking-[0.4em] text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
          />

          <button
            type="button"
            onClick={onVerify}
            disabled={loading}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-cyan-500 to-blue-600 px-4 py-3 text-sm font-extrabold text-white transition-all hover:from-cyan-400 hover:to-blue-500 active:scale-95 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال تأیید...</span>
              </>
            ) : (
              <span>تأیید و ورود</span>
            )}
          </button>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-60"
            >
              <ArrowRight className="w-4 h-4" />
              <span>تغییر شماره</span>
            </button>
            <button
              type="button"
              onClick={onResend}
              disabled={!canResend}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              <span>
                {cooldownSeconds > 0
                  ? `ارسال مجدد تا ${toPersianDigits(cooldownSeconds)} ثانیه دیگر`
                  : 'ارسال مجدد کد'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
