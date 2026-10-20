// Persian login screen: Google OAuth + SMS (phone) code.
// LoginCard is presentational (unit-tested with renderToString); LoginView
// wires it to the auth context.
import React, { useState } from 'react';
import { Loader2, AlertCircle, WifiOff, Droplets } from 'lucide-react';
import { useAuth } from '../state/auth';
import { SmsLoginForm, type SmsLoginStage } from './SmsLoginForm';

export type LoginMethod = 'google' | 'sms';

interface LoginCardProps {
  loading: boolean;
  error: string | null;
  onGoogleSignIn: () => void;
  onContinueOffline: () => void;
  /** Controlled method switch; when omitted the card manages it internally. */
  method?: LoginMethod;
  onMethodChange?: (method: LoginMethod) => void;
  smsStage?: SmsLoginStage;
  smsPhone?: string;
  smsCode?: string;
  smsLoading?: boolean;
  smsError?: string | null;
  smsInfo?: string | null;
  smsCooldown?: number;
  onSmsPhoneChange?: (value: string) => void;
  onSmsCodeChange?: (value: string) => void;
  onSmsRequest?: () => void;
  onSmsVerify?: () => void;
  onSmsResend?: () => void;
  onSmsBack?: () => void;
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"
      />
    </svg>
  );
}

export const LoginCard: React.FC<LoginCardProps> = ({
  loading,
  error,
  onGoogleSignIn,
  onContinueOffline,
  method,
  onMethodChange,
  smsStage = 'phone',
  smsPhone = '',
  smsCode = '',
  smsLoading = false,
  smsError = null,
  smsInfo = null,
  smsCooldown = 0,
  onSmsPhoneChange,
  onSmsCodeChange,
  onSmsRequest,
  onSmsVerify,
  onSmsResend,
  onSmsBack,
}) => {
  const [internalMethod, setInternalMethod] = useState<LoginMethod>('google');
  const activeMethod = method ?? internalMethod;
  const selectMethod = (next: LoginMethod) => {
    if (method === undefined) setInternalMethod(next);
    onMethodChange?.(next);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Droplets className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-lg font-black text-white">
          Aqua<span className="text-cyan-400">Ledger</span> AI
        </h1>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
          برای همگام‌سازی امن و استفاده از هوش مصنوعی، با حساب گوگل یا شمارهٔ موبایل خود وارد شوید.
        </p>

        <div
          role="tablist"
          aria-label="روش ورود"
          className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeMethod === 'google'}
            onClick={() => selectMethod('google')}
            className={`min-h-[44px] rounded-lg px-2 py-2 text-xs font-extrabold transition-colors ${
              activeMethod === 'google'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ورود با گوگل
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMethod === 'sms'}
            onClick={() => selectMethod('sms')}
            className={`min-h-[44px] rounded-lg px-2 py-2 text-xs font-extrabold transition-colors ${
              activeMethod === 'sms'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ورود با شمارهٔ موبایل
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-xs font-bold text-rose-300 text-right"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {activeMethod === 'google' ? (
          <>
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ورود...</span>
                </>
              ) : (
                <>
                  <GoogleG />
                  <span>ورود با حساب گوگل</span>
                </>
              )}
            </button>
            <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
              ورود با گوگل، حساب شما را به همین دستگاه متصل می‌کند.
            </p>
          </>
        ) : (
          <SmsLoginForm
            stage={smsStage}
            phone={smsPhone}
            code={smsCode}
            loading={smsLoading}
            error={smsError}
            info={smsInfo}
            cooldownSeconds={smsCooldown}
            onPhoneChange={(value) => onSmsPhoneChange?.(value)}
            onCodeChange={(value) => onSmsCodeChange?.(value)}
            onRequest={() => onSmsRequest?.()}
            onVerify={() => onSmsVerify?.()}
            onResend={() => onSmsResend?.()}
            onBack={() => onSmsBack?.()}
          />
        )}

        <button
          type="button"
          onClick={onContinueOffline}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <WifiOff className="w-4 h-4" />
          <span>ادامه بدون ورود (آفلاین)</span>
        </button>
        <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
          در حالت آفلاین، تحلیل محلی و ثبت دستی بدون اینترنت کار می‌کند.
        </p>
      </div>
    </div>
  );
};

export const LoginView: React.FC = () => {
  const {
    signInWithGoogle,
    continueOffline,
    signingIn,
    signInError,
    smsStage,
    smsPhone,
    smsLoading,
    smsError,
    smsInfo,
    smsCooldown,
    requestSmsCode,
    verifySmsCode,
    resetSmsFlow,
  } = useAuth();
  const [smsPhoneInput, setSmsPhoneInput] = useState('');
  const [smsCodeInput, setSmsCodeInput] = useState('');

  return (
    <LoginCard
      loading={signingIn}
      error={signInError}
      onGoogleSignIn={() => void signInWithGoogle()}
      onContinueOffline={continueOffline}
      smsStage={smsStage}
      smsPhone={smsPhoneInput}
      smsCode={smsCodeInput}
      smsLoading={smsLoading}
      smsError={smsError}
      smsInfo={smsInfo}
      smsCooldown={smsCooldown}
      onSmsPhoneChange={setSmsPhoneInput}
      onSmsCodeChange={setSmsCodeInput}
      onSmsRequest={() => void requestSmsCode(smsPhoneInput)}
      onSmsVerify={() => void verifySmsCode(smsCodeInput)}
      onSmsResend={() => void requestSmsCode(smsPhoneInput)}
      onSmsBack={() => {
        setSmsCodeInput('');
        resetSmsFlow();
      }}
    />
  );
};
