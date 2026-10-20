// Supabase JWT verification, shared by Express and Netlify Functions.
// No Express, no filesystem, no in-memory state — safe for serverless.
import { createClient } from '@supabase/supabase-js';

export function getBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  return token ? token : null;
}

export function getSupabaseEnv(): { url?: string; anonKey?: string } {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || undefined;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || undefined;
  return { url, anonKey };
}

export function isSupabaseAuthConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}

/**
 * Service-role key: server-only, NEVER a VITE_ variable and never shipped to
 * the browser. Used to mint sessions for phone (SMS) users.
 */
export function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

/**
 * Verify a Supabase access token via supabase.auth.getUser(token).
 * Transitional Phase-A behavior: when SUPABASE_URL/ANON_KEY are NOT set
 * (local dev before the Auth phase lands), any non-empty token is accepted
 * so existing flows keep working. Once env is set, verification is strict.
 * Missing token is always rejected by the caller (401) — never here.
 */
export async function verifySupabaseToken(
  token: string,
): Promise<{ ok: boolean; userId?: string }> {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return { ok: true };
  try {
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return { ok: false };
    return { ok: true, userId: data.user.id };
  } catch {
    return { ok: false };
  }
}

export const UNAUTHORIZED_ERROR = 'برای استفاده از هوش مصنوعی وارد حساب کاربری شوید.';

export interface AuthCheckResult {
  /** True when the caller may use the endpoint. */
  ok: boolean;
  /** The verified token, or null when Supabase is not configured (fail open). */
  token: string | null;
}

/**
 * Auth gate for the AI endpoints (Express + Netlify, identical behavior).
 * When Supabase is NOT configured the check fails open, so local dev and the
 * offline flow keep working; once Supabase is configured a missing or invalid
 * token is rejected with 401.
 */
export async function checkAuthHeader(
  authHeader: string | null | undefined,
): Promise<AuthCheckResult> {
  if (!isSupabaseAuthConfigured()) return { ok: true, token: null };
  const token = getBearerToken(authHeader);
  if (!token) return { ok: false, token: null };
  const verified = await verifySupabaseToken(token);
  if (!verified.ok) return { ok: false, token: null };
  return { ok: true, token };
}
