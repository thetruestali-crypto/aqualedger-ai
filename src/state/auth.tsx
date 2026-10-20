// Auth session context: Google OAuth + SMS (phone) login for the SPA.
// Three states: initializing (splash, no flicker) -> session | null.
// When Supabase env is missing the provider is inert and the app behaves as
// before (local/offline-first, no login gate).
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  adoptSession,
  getOAuthRedirectUrl,
  getSupabaseClient,
  isSupabaseConfigured,
} from '../lib/supabase';
import { normalizeIranianPhone } from '../lib/phone';

const OFFLINE_FLAG = 'aqualedger_auth_offline';

export type SmsLoginStage = 'phone' | 'code';

interface AuthContextValue {
  configured: boolean;
  initializing: boolean;
  session: Session | null;
  user: User | null;
  signingIn: boolean;
  signInError: string | null;
  offlineMode: boolean;
  /** True when the login gate must be shown instead of the app. */
  needsLogin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  continueOffline: () => void;
  /** Leave offline mode and show the login gate again. */
  showLogin: () => void;
  /** Fresh access token for protected /api calls (null when logged out). */
  getToken: () => Promise<string | null>;
  // --- SMS (phone) login ---
  smsStage: SmsLoginStage;
  smsLoading: boolean;
  smsError: string | null;
  smsInfo: string | null;
  /** Normalized phone (E.164) of the pending SMS login. */
  smsPhone: string;
  /** Seconds left before another code may be requested. */
  smsCooldown: number;
  requestSmsCode: (phoneInput: string) => Promise<boolean>;
  verifySmsCode: (code: string) => Promise<boolean>;
  resetSmsFlow: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readOfflineFlag(): boolean {
  try {
    return localStorage.getItem(OFFLINE_FLAG) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState<boolean>(() => readOfflineFlag());
  const [smsStage, setSmsStage] = useState<SmsLoginStage>('phone');
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsInfo, setSmsInfo] = useState<string | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCooldown, setSmsCooldown] = useState(0);

  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) {
      setInitializing(false);
      return;
    }
    let alive = true;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setInitializing(false);
      });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Resend countdown: one ticking interval, cleaned up on unmount.
  useEffect(() => {
    const id = setInterval(() => {
      setSmsCooldown((current) => (current > 0 ? current - 1 : current));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) {
      setSignInError('پیکربندی ورود هنوز انجام نشده است.');
      return;
    }
    setSigningIn(true);
    setSignInError(null);
    try {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getOAuthRedirectUrl(window.location.origin) },
      });
      if (error) throw error;
      // Success continues as a full-page redirect to Google; nothing to render.
    } catch (err) {
      setSignInError(
        err instanceof Error && err.message
          ? err.message
          : 'ورود با گوگل ناموفق بود. دوباره تلاش کنید.',
      );
      setSigningIn(false);
    }
  }, []);

  const resetSmsFlow = useCallback(() => {
    setSmsStage('phone');
    setSmsError(null);
    setSmsInfo(null);
    setSmsLoading(false);
  }, []);

  const requestSmsCode = useCallback(async (phoneInput: string): Promise<boolean> => {
    const normalized = normalizeIranianPhone(phoneInput);
    setSmsError(null);
    setSmsInfo(null);
    if (!normalized) {
      setSmsError('شمارهٔ موبایل معتبر نیست.');
      return false;
    }
    setSmsLoading(true);
    try {
      const response = await fetch('/api/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; expiresIn?: number; resendAfter?: number }
        | null;
      if (!response.ok) {
        setSmsError(data?.error ?? 'ارسال کد تأیید ناموفق بود.');
        return false;
      }
      setSmsPhone(normalized);
      setSmsStage('code');
      setSmsInfo('کد تأیید ارسال شد.');
      setSmsCooldown(data?.resendAfter ?? 60);
      return true;
    } catch {
      setSmsError('ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید.');
      return false;
    } finally {
      setSmsLoading(false);
    }
  }, []);

  const verifySmsCode = useCallback(
    async (code: string): Promise<boolean> => {
      setSmsError(null);
      setSmsInfo(null);
      setSmsLoading(true);
      try {
        const response = await fetch('/api/auth/sms/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: smsPhone, code }),
        });
        const data = (await response.json().catch(() => null)) as
          | { error?: string; accessToken?: string; refreshToken?: string }
          | null;
        if (!response.ok) {
          setSmsError(data?.error ?? 'تأیید کد ناموفق بود.');
          return false;
        }
        const adopted = await adoptSession(data?.accessToken ?? '', data?.refreshToken ?? '');
        if (!adopted) {
          setSmsError('ورود با حساب کاربری ناموفق بود. دوباره تلاش کنید.');
          return false;
        }
        setSmsInfo('ورود با موفقیت انجام شد.');
        return true;
      } catch {
        setSmsError('ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید.');
        return false;
      } finally {
        setSmsLoading(false);
      }
    },
    [smsPhone],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabaseClient();
    try {
      await sb?.auth.signOut();
    } catch {
      // Local session is cleared below regardless of network errors.
    }
    setSession(null);
    try {
      localStorage.removeItem(OFFLINE_FLAG);
    } catch {
      // ignore
    }
    setOfflineMode(false);
    resetSmsFlow();
  }, [resetSmsFlow]);

  const continueOffline = useCallback(() => {
    try {
      localStorage.setItem(OFFLINE_FLAG, '1');
    } catch {
      // in-memory only when storage is unavailable
    }
    setOfflineMode(true);
  }, []);

  const showLogin = useCallback(() => {
    try {
      localStorage.removeItem(OFFLINE_FLAG);
    } catch {
      // ignore
    }
    setOfflineMode(false);
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const sb = getSupabaseClient();
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      initializing,
      session,
      user: session?.user ?? null,
      signingIn,
      signInError,
      offlineMode,
      needsLogin: configured && !initializing && !session && !offlineMode,
      signInWithGoogle,
      signOut,
      continueOffline,
      showLogin,
      getToken,
      smsStage,
      smsLoading,
      smsError,
      smsInfo,
      smsPhone,
      smsCooldown,
      requestSmsCode,
      verifySmsCode,
      resetSmsFlow,
    }),
    [
      configured,
      initializing,
      session,
      signingIn,
      signInError,
      offlineMode,
      signInWithGoogle,
      signOut,
      continueOffline,
      showLogin,
      getToken,
      smsStage,
      smsLoading,
      smsError,
      smsInfo,
      smsPhone,
      smsCooldown,
      requestSmsCode,
      verifySmsCode,
      resetSmsFlow,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
