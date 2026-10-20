import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setSession } = vi.hoisted(() => ({ setSession: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { setSession } }),
}));

import {
  adoptSession,
  bearerHeaders,
  getOAuthRedirectUrl,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/src/lib/supabase';

// Google-OAuth + SMS client helpers: the redirect must be the site origin
// (never a hardcoded host), the Bearer header must be absent when logged out,
// and a server-minted session must be adopted by the browser client.
describe('supabase client helpers', () => {
  const OLD_URL = process.env.VITE_SUPABASE_URL;
  const OLD_ANON = process.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    setSession.mockReset();
  });

  afterEach(() => {
    if (OLD_URL !== undefined) process.env.VITE_SUPABASE_URL = OLD_URL;
    else delete process.env.VITE_SUPABASE_URL;
    if (OLD_ANON !== undefined) process.env.VITE_SUPABASE_ANON_KEY = OLD_ANON;
    else delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  it('reports unconfigured without env and returns no client', () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it('reports configured with env and builds a client', () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseClient()).not.toBeNull();
  });

  it('keeps the OAuth redirect on the site origin', () => {
    expect(getOAuthRedirectUrl('https://extraordinary-profiterole-570583.netlify.app')).toBe(
      'https://extraordinary-profiterole-570583.netlify.app',
    );
    expect(getOAuthRedirectUrl('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('omits Authorization when logged out, sends Bearer when logged in', () => {
    expect(bearerHeaders(null)).toEqual({});
    expect(bearerHeaders(undefined)).toEqual({});
    expect(bearerHeaders('abc123')).toEqual({ Authorization: 'Bearer abc123' });
  });

  it('adopts a server-minted session (SMS login)', async () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    setSession.mockResolvedValue({ data: {}, error: null });

    const adopted = await adoptSession('access-token', 'refresh-token');
    expect(adopted).toBe(true);
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('reports a failed adoption', async () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    setSession.mockResolvedValue({ data: {}, error: { message: 'invalid' } });

    expect(await adoptSession('access-token', 'refresh-token')).toBe(false);
    expect(await adoptSession('', '')).toBe(false);
  });
});
