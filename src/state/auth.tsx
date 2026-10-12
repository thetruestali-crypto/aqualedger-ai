// Auth session context: Google OAuth (Supabase) for the SPA.
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
  getOAuthRedirectUrl,
  getSupabaseClient,
  isSupabaseConfigured,
} from '../lib/supabase';

const OFFLINE_FLAG = 'aqualedger_auth_offline';

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
  /** Fresh access token for protected /api calls (null when logged out). */
  getToken: () => Promise<string | null>;
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
  }, []);

  const continueOffline = useCallback(() => {
    try {
      localStorage.setItem(OFFLINE_FLAG, '1');
    } catch {
      // in-memory only when storage is unavailable
    }
    setOfflineMode(true);
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
      getToken,
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
      getToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
