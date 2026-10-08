import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { DB_NAME, getDb, exportBackup, importBackup } from '@/src/data/db';
import { createDexieStore } from '@/src/data/dexieStore';
import { migrateLegacyToTarget, readLegacySnapshot } from '@/src/data/migrate';
import { enqueueAIRequest, listAIQueue, removeAIRequest } from '@/src/data/outbox';
import { defaultSettings } from '@/src/data/seed';

beforeEach(async () => {
  await Dexie.delete(DB_NAME);
});

describe('dexieStore', () => {
  it('CRUD + seed defaults + reset', async () => {
    const store = createDexieStore();
    expect((await store.getSettings()).bossName).toBe(defaultSettings.bossName);
    expect((await store.getTransactions()).length).toBe(0); // empty until seeded/reset

    await store.resetToSeed();
    expect((await store.getTransactions()).length).toBeGreaterThan(0);
    expect((await store.getParts()).length).toBeGreaterThan(0);

    const txs = await store.getTransactions();
    await store.deleteTransaction(txs[0].id);
    expect((await store.getTransactions()).length).toBe(txs.length - 1);
  });

  it('decrementStock is atomic (all-or-nothing in one rw transaction)', async () => {
    const store = createDexieStore();
    await store.savePart({
      id: 'p1', name: 'فیلتر', code: 'F', unit: 'عدد', stock: 2,
      purchasePrice: 10, sellPrice: 20, category: 'filter',
    });
    await expect(store.decrementStock([{ partId: 'p1', qty: 5 }])).rejects.toThrow();
    expect((await store.getParts()).find((p) => p.id === 'p1')!.stock).toBe(2);
    const res = await store.decrementStock([{ partId: 'p1', qty: 2 }]);
    expect(res[0].remaining).toBe(0);
    expect((await store.getParts()).find((p) => p.id === 'p1')!.stock).toBe(0);
  });

  it('backup export/import round-trips through real IndexedDB', async () => {
    const store = createDexieStore();
    await store.resetToSeed();
    const backup = await exportBackup();
    expect(backup.version).toBe(1);
    await getDb().transactions.clear();
    expect(await getDb().transactions.count()).toBe(0);
    await importBackup(backup);
    expect(await getDb().transactions.count()).toBe(backup.transactions.length);
  });
});

describe('migration into real Dexie', () => {
  it('imports legacy snapshot once, skips on re-run', async () => {
    const db = getDb();
    const target = {
      transactions: {
        bulkPut: (rows: Parameters<typeof db.transactions.bulkPut>[0]) =>
          db.transactions.bulkPut(rows).then(() => undefined),
        count: () => db.transactions.count(),
      },
      clients: { bulkPut: (rows: Parameters<typeof db.clients.bulkPut>[0]) => db.clients.bulkPut(rows).then(() => undefined) },
      parts: { bulkPut: (rows: Parameters<typeof db.parts.bulkPut>[0]) => db.parts.bulkPut(rows).then(() => undefined) },
      serviceLogs: { bulkPut: (rows: Parameters<typeof db.serviceLogs.bulkPut>[0]) => db.serviceLogs.bulkPut(rows).then(() => undefined) },
      settings: { put: (row: { key: string } & typeof defaultSettings) => db.settings.put(row).then(() => undefined) },
    };
    const snap = readLegacySnapshot(
      (k) => (k === 'aqualedger_transactions_v1' ? JSON.stringify([{ id: 'old-1' }]) : null),
      { transactions: [], clients: [], parts: [], serviceLogs: [], settings: defaultSettings },
    );
    const first = await migrateLegacyToTarget(snap, target);
    expect(first.migrated).toBe(true);
    expect(await db.transactions.count()).toBe(1);
    const second = await migrateLegacyToTarget(snap, target);
    expect(second.migrated).toBe(false);
  });
});

describe('offline AI outbox', () => {
  it('enqueue -> list -> remove', async () => {
    expect(await listAIQueue()).toEqual([]);
    const row = await enqueueAIRequest('از جیب ۱۰۰ تومن دادم', { bossName: 'رئیس' });
    const list = await listAIQueue();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(row.id);
    expect(list[0].text).toContain('۱۰۰ تومن');
    await removeAIRequest(row.id);
    expect(await listAIQueue()).toEqual([]);
  });
});
