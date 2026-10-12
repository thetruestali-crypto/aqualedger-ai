import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bearerHeaders,
  getOAuthRedirectUrl,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/src/lib/supabase';

// Google-OAuth client helpers: redirect must be the site origin (never a
// hardcoded host) and the Bearer header must be absent when logged out.
describe('supabase client helpers', () => {
  const OLD_URL = process.env.VITE_SUPABASE_URL;
  const OLD_ANON = process.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
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
});
