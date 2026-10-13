// Store boot: pick the persistence driver (Dexie preferred, localStorage fallback),
// run the one-time legacy migration, and probe IndexedDB availability.
// Browser-only; every failure falls back to the local driver — the app must boot.
import { getDb } from './db';
import { createDexieStore } from './dexieStore';
import { createLocalStore } from './localStore';
import { readLegacySnapshot, migrateLegacyToTarget, type MigrationTarget } from './migrate';
import { setDbOwner, isUserOwner } from './owner';
import {
  defaultTransactions,
  defaultClients,
  defaultParts,
  defaultSettings,
  defaultServiceLogs,
  blankSettings,
} from './seed';
import { isMigratedToDexie, markMigratedToDexie } from '../utils/storage';
import type { LedgerStore } from './repository';

export interface BootResult {
  store: LedgerStore;
  driver: 'dexie' | 'local';
  migrated: boolean;
}

function dexieTarget(): MigrationTarget {
  const db = getDb();
  return {
    transactions: {
      bulkPut: (rows) => db.transactions.bulkPut(rows).then(() => undefined),
      count: () => db.transactions.count(),
    },
    clients: { bulkPut: (rows) => db.clients.bulkPut(rows).then(() => undefined) },
    parts: { bulkPut: (rows) => db.parts.bulkPut(rows).then(() => undefined) },
    serviceLogs: { bulkPut: (rows) => db.serviceLogs.bulkPut(rows).then(() => undefined) },
    settings: { put: (row) => db.settings.put(row).then(() => undefined) },
  };
}

export async function bootStore(ownerId: string | null = null): Promise<BootResult> {
  setDbOwner(ownerId);
  try {
    if (typeof localStorage === 'undefined') throw new Error('no localStorage');
    const store = createDexieStore();
    if (isUserOwner(ownerId)) {
      // A logged-in user gets a CLEAN database: no legacy migration, no demo
      // seed. Only ensure a blank settings row exists for the salary engine.
      const existing = await getDb().settings.get('main');
      if (!existing) {
        await getDb().settings.put({ key: 'main', ...blankSettings });
      }
      await store.getSettings(); // probe IndexedDB (throws when unavailable)
      return { store, driver: 'dexie', migrated: false };
    }
    let migrated = isMigratedToDexie();
    if (!migrated) {
      const snapshot = readLegacySnapshot(
        (key) => localStorage.getItem(key),
        {
          transactions: defaultTransactions,
          clients: defaultClients,
          parts: defaultParts,
          serviceLogs: defaultServiceLogs,
          settings: defaultSettings,
        },
      );
      const result = await migrateLegacyToTarget(snapshot, dexieTarget());
      migrated = result.migrated;
      markMigratedToDexie();
    }
    await store.getSettings(); // probe IndexedDB (throws when unavailable)
    return { store, driver: 'dexie', migrated };
  } catch {
    return { store: createLocalStore(), driver: 'local', migrated: false };
  }
}
