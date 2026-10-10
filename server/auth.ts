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
