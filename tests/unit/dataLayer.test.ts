import { describe, expect, it } from 'vitest';
import { validateBackupPayload, backupFileName } from '@/src/data/backup';
import { createMemoryStore } from '@/src/data/memoryStore';
import { readLegacySnapshot, migrateLegacyToTarget, LEGACY_KEYS } from '@/src/data/migrate';
import { defaultSettings } from '@/src/data/seed';
import { normalizeTransaction } from '@/src/data/repository';
import type { CompanySettings } from '@/src/types';

describe('validateBackupPayload', () => {
  it('accepts a store export round-trip', async () => {
    const store = createMemoryStore();
    const backup = await store.exportBackup();
    const check = validateBackupPayload(JSON.parse(JSON.stringify(backup)));
    expect(check.ok).toBe(true);
    expect(check.payload?.version).toBe(1);
  });

  it('rejects wrong version and missing entities', () => {
    expect(validateBackupPayload({ version: 2 }).ok).toBe(false);
    expect(validateBackupPayload({}).ok).toBe(false);
    expect(validateBackupPayload(null).ok).toBe(false);
  });

  it('backupFileName is date-stamped', () => {
    expect(backupFileName(new Date('2026-10-07T00:00:00.000Z'))).toBe(
      'AquaLedger_Backup_2026-10-07.json',
    );
  });
});

describe('memory store backup/restore', () => {
  it('import replaces everything; reset restores seed', async () => {
    const store = createMemoryStore();
    const backup = await store.exportBackup();
    await store.deleteTransaction((await store.getTransactions())[0].id);
    expect((await store.getTransactions()).length).toBe(backup.transactions.length - 1);
    await store.importBackup(backup);
    expect((await store.getTransactions()).length).toBe(backup.transactions.length);

    await store.saveSettings({ ...defaultSettings, bossName: 'تغییر کرده' });
    await store.resetToSeed();
    expect((await store.getSettings()).bossName).toBe(defaultSettings.bossName);
  });

  it('decrementStock is atomic via the store', async () => {
    const store = createMemoryStore(false);
    await store.savePart({
      id: 'p1', name: 'فیلتر', code: 'F', unit: 'عدد', stock: 2,
      purchasePrice: 10, sellPrice: 20, category: 'filter',
    });
    await expect(store.decrementStock([{ partId: 'p1', qty: 5 }])).rejects.toThrow();
    expect((await store.getParts())[0].stock).toBe(2);
    await store.decrementStock([{ partId: 'p1', qty: 2 }]);
    expect((await store.getParts())[0].stock).toBe(0);
  });
});

describe('normalizeTransaction', () => {
  it('fills settled from remainingDebt for legacy rows', () => {
    expect(normalizeTransaction({ id: 'x', remainingDebt: 100 }).settled).toBe(false);
    expect(normalizeTransaction({ id: 'x', remainingDebt: 0 }).settled).toBe(true);
    expect(normalizeTransaction({ id: 'x', settled: true, remainingDebt: 50 }).settled).toBe(true);
  });
});

describe('legacy migration', () => {
  const seedSnapshot = {
    transactions: [],
    clients: [],
    parts: [],
    serviceLogs: [],
    settings: defaultSettings,
  };

  it('reads legacy keys and normalizes rows', () => {
    const reader = (key: string) => {
      if (key === LEGACY_KEYS.TRANSACTIONS)
        return JSON.stringify([{ id: 'old-1', totalAmount: 100 }]);
      return null;
    };
    const snap = readLegacySnapshot(reader, seedSnapshot);
    expect(snap.transactions).toHaveLength(1);
    expect(snap.transactions[0].settled).toBe(true); // remainingDebt defaults 0
    expect(snap.clients).toEqual([]);
    expect(snap.settings.bossName).toBe(defaultSettings.bossName);
  });

  it('falls back to seed on corrupt JSON, never throws', () => {
    const snap = readLegacySnapshot(() => 'not-json{{{', seedSnapshot);
    expect(snap.transactions).toEqual([]);
  });

  it('migrates once; second run is a no-op', async () => {
    const tables = {
      transactions: [] as ReturnType<typeof normalizeTransaction>[],
      clients: [] as never[],
      parts: [] as never[],
      serviceLogs: [] as never[],
      settingsRow: null as null | (CompanySettings & { key: string }),
    };
    const target = {
      transactions: {
        bulkPut: async (rows: typeof tables.transactions) => { tables.transactions.push(...rows); },
        count: async () => tables.transactions.length,
      },
      clients: { bulkPut: async (rows: never[]) => { tables.clients.push(...rows); } },
      parts: { bulkPut: async (rows: never[]) => { tables.parts.push(...rows); } },
      serviceLogs: { bulkPut: async (rows: never[]) => { tables.serviceLogs.push(...rows); } },
      settings: { put: async (row: CompanySettings & { key: string }) => { tables.settingsRow = row; } },
    };
    const snap = readLegacySnapshot(
      (k) => (k === LEGACY_KEYS.TRANSACTIONS ? JSON.stringify([{ id: 'old-1' }]) : null),
      seedSnapshot,
    );
    const first = await migrateLegacyToTarget(snap, target);
    expect(first.migrated).toBe(true);
    expect(first.counts.transactions).toBe(1);
    const second = await migrateLegacyToTarget(snap, target);
    expect(second.migrated).toBe(false);
    expect(tables.transactions).toHaveLength(1);
  });
});
