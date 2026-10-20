// Server-side Supabase clients (Express + Netlify Functions).
// The browser singleton in src/lib/supabase.ts is NEVER used here:
//  - getServiceClient(): service-role key, for admin calls (create/find users).
//  - getPublicClient(): anon key, for signing a session in (password grant).
// Both are stateless (no persisted session, no token refresh) because the
// server only needs a short-lived access token.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleKey, getSupabaseEnv } from './auth';

const SERVER_AUTH_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

let serviceClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

/** Service-role client (admin API). Null when the key is not configured. */
export function getServiceClient(): SupabaseClient | null {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = getServiceRoleKey();
  if (!url || !serviceRoleKey) return null;
  if (!serviceClient) {
    serviceClient = createClient(url, serviceRoleKey, SERVER_AUTH_OPTIONS);
  }
  return serviceClient;
}

/** Anon client used for the password grant (session minting). */
export function getPublicClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;
  if (!publicClient) {
    publicClient = createClient(url, anonKey, SERVER_AUTH_OPTIONS);
  }
  return publicClient;
}

/** Drop cached clients (tests that change env between cases). */
export function resetSupabaseAdminClients(): void {
  serviceClient = null;
  publicClient = null;
}
