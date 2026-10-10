import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Phase-D: daily AI quota is enforced through the atomic bump_ai_usage() RPC
// under the caller's JWT. Missing infra fails OPEN (Auth phase not landed yet).
const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: rpcMock }),
}));

import { checkAiUsage, AI_DAILY_LIMIT } from '@/server/aiUsage';

describe('checkAiUsage', () => {
  const OLD_URL = process.env.SUPABASE_URL;
  const OLD_ANON = process.env.SUPABASE_ANON_KEY;
  const OLD_VITE_URL = process.env.VITE_SUPABASE_URL;
  const OLD_VITE_ANON = process.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    rpcMock.mockReset();
  });

  afterEach(() => {
    if (OLD_URL !== undefined) process.env.SUPABASE_URL = OLD_URL;
    else delete process.env.SUPABASE_URL;
    if (OLD_ANON !== undefined) process.env.SUPABASE_ANON_KEY = OLD_ANON;
    else delete process.env.SUPABASE_ANON_KEY;
    if (OLD_VITE_URL !== undefined) process.env.VITE_SUPABASE_URL = OLD_VITE_URL;
    else delete process.env.VITE_SUPABASE_URL;
    if (OLD_VITE_ANON !== undefined) process.env.VITE_SUPABASE_ANON_KEY = OLD_VITE_ANON;
    else delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  it(`allows requests under the daily cap (${AI_DAILY_LIMIT})`, async () => {
    rpcMock.mockResolvedValue({ data: 5, error: null });
    const r = await checkAiUsage('test-token');
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(5);
  });

  it('blocks requests over the daily cap', async () => {
    rpcMock.mockResolvedValue({ data: AI_DAILY_LIMIT + 1, error: null });
    const r = await checkAiUsage('test-token');
    expect(r.allowed).toBe(false);
  });

  it('fails open when the RPC errors (table missing)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('relation missing') });
    const r = await checkAiUsage('test-token');
    expect(r.allowed).toBe(true);
  });

  it('fails open when Supabase is unconfigured (no network call)', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    const r = await checkAiUsage('test-token');
    expect(r.allowed).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
