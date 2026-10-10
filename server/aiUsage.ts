// Daily AI quota (serverless replacement for in-memory express-rate-limit).
// Counts via the atomic public.bump_ai_usage() RPC under the CALLER's JWT,
// so RLS (user_id = auth.uid()) applies and races are impossible.
// Fail-open when Supabase is unconfigured or the table is missing: the Auth
// phase has not landed yet, so local dev must keep working. Once configured,
// over-quota callers get a Persian 429.
import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './auth';

/** Max AI analyses per user per day. */
export const AI_DAILY_LIMIT = 200;

export const AI_QUOTA_ERROR = 'سهمیه روزانه هوش مصنوعی تمام شد. لطفاً فردا تلاش کنید.';

export async function checkAiUsage(token: string): Promise<{ allowed: boolean; count?: number }> {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return { allowed: true };
  try {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.rpc('bump_ai_usage');
    if (error || typeof data !== 'number') return { allowed: true };
    return { allowed: data <= AI_DAILY_LIMIT, count: data };
  } catch {
    return { allowed: true };
  }
}
