// Browser Supabase client (singleton) + tiny pure auth helpers.
// Server Functions NEVER import this file (they use server/auth.ts instead).
// Env comes from import.meta.env (Vite) with a process.env fallback so unit
// tests can drive it without a browser.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(name: string): string | undefined {
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (meta && meta[name]) return meta[name];
  } catch {
    // import.meta unavailable (plain node) — fall through to process.env.
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return undefined;
}

export function getSupabasePublicEnv(): { url?: string; anonKey?: string } {
  return { url: readEnv('VITE_SUPABASE_URL'), anonKey: readEnv('VITE_SUPABASE_ANON_KEY') };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabasePublicEnv();
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/** Shared browser client, or null when Supabase env is missing (local dev). */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) return null;
  client = createClient(url, anonKey);
  return client;
}

/**
 * OAuth redirect target. MUST be the site origin (never a hardcoded host) so
 * Netlify subdomains, Deploy Previews and custom domains all work.
 */
export function getOAuthRedirectUrl(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/** Authorization header for protected endpoints; empty when logged out. */
export function bearerHeaders(token: string | null | undefined): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Fresh access token from the persisted session (auto-refreshed by supabase-js). */
export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Adopt a session minted by our own backend (SMS login).
 * The session is a regular Supabase session, so onAuthStateChange fires and
 * every downstream feature (Bearer token, quota, per-user local db) works
 * without any special casing.
 */
export async function adoptSession(
  accessToken: string,
  refreshToken: string,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb || !accessToken || !refreshToken) return false;
  try {
    const { error } = await sb.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return !error;
  } catch {
    return false;
  }
}
