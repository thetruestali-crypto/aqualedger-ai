import { afterEach, describe, expect, it } from 'vitest';
import {
  dbNameForOwner,
  getDbOwner,
  isUserOwner,
  sanitizeOwnerId,
  setDbOwner,
} from '@/src/data/owner';
import { createMemoryStore } from '@/src/data/memoryStore';
import { blankSettings } from '@/src/data/seed';

// Per-user local databases: guests keep the legacy 'aqualedger' database,
// each logged-in user gets an isolated `aqualedger_u_<id>` database so demo
// seed rows can never leak into a real user's balance.
describe('db owner names', () => {
  afterEach(() => {
    setDbOwner(null);
  });

  it('guest (null/empty) maps to the legacy database name', () => {
    expect(dbNameForOwner(null)).toBe('aqualedger');
    expect(dbNameForOwner(undefined)).toBe('aqualedger');
    expect(dbNameForOwner('')).toBe('aqualedger');
    expect(isUserOwner(null)).toBe(false);
    expect(isUserOwner('')).toBe(false);
  });

  it('user ids map to isolated per-user database names', () => {
    const a = dbNameForOwner('C4A5B6C7-D8E9-4F01-8234-56789ABCDEF0');
    const b = dbNameForOwner('ffffffff-ffff-ffff-ffff-ffffffffffff');
    expect(a.startsWith('aqualedger_u_')).toBe(true);
    expect(a).not.toBe('aqualedger');
    expect(a).not.toBe(b);
    expect(isUserOwner('C4A5B6C7-D8E9-4F01-8234-56789ABCDEF0')).toBe(true);
  });

  it('sanitizes hostile ids into safe database names', () => {
    expect(sanitizeOwnerId('../../etc/passwd')).toMatch(/^[a-z0-9-]+$/);
    expect(dbNameForOwner('../../etc/passwd')).not.toContain('..');
    expect(dbNameForOwner('../../etc/passwd')).not.toContain('/');
    expect(sanitizeOwnerId('')).toBe('user');
  });

  it('tracks the active owner with set/get', () => {
    expect(getDbOwner()).toBeNull();
    setDbOwner('user-1');
    expect(getDbOwner()).toBe('user-1');
    setDbOwner(null);
    expect(getDbOwner()).toBeNull();
  });
});

describe('owner-aware resetToSeed', () => {
  afterEach(() => {
    setDbOwner(null);
  });

  it('guest reset restores the demo seed', async () => {
    setDbOwner(null);
    const store = createMemoryStore(false);
    await store.resetToSeed();
    expect((await store.getTransactions()).length).toBeGreaterThan(0);
    expect((await store.getClients()).length).toBeGreaterThan(0);
    expect((await store.getSettings()).companyName).not.toBe('');
  });

  it('logged-in owner reset produces a clean database, never demo seed', async () => {
    setDbOwner('google-user-123');
    const store = createMemoryStore();
    await store.resetToSeed();
    expect(await store.getTransactions()).toEqual([]);
    expect(await store.getClients()).toEqual([]);
    expect(await store.getParts()).toEqual([]);
    expect(await store.getServiceLogs()).toEqual([]);
    const settings = await store.getSettings();
    expect(settings).toEqual(blankSettings);
    expect(settings.monthlyBaseSalary).toBe(0);
  });
});
