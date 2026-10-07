// Dexie (IndexedDB) database, schema v1. Offline-first persistent store.
// LocalStorage keys (aqualedger_*_v1) are imported once on first run (see migrateFromLocalStorage).
// All money: integer Toman.
import Dexie, { type Table } from 'dexie';
import type { Transaction, CompanySettings, Client, PartItem, ServiceLog } from '../types';

export interface PendingAIRequest {
  id: string;
  createdAt: string; // ISO
  kind: 'text' | 'audio';
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  context?: { bossName?: string; companyName?: string };
  status: 'pending' | 'failed';
}

export const DB_NAME = 'aqualedger';
export const DB_VERSION = 1;

export class AquaLedgerDb extends Dexie {
  transactions!: Table<Transaction, string>;
  clients!: Table<Client, string>;
  parts!: Table<PartItem, string>;
  serviceLogs!: Table<ServiceLog, string>;
  pendingQueue!: Table<PendingAIRequest, string>;
  // Single-row settings stored by fixed key.
  settings!: Table<CompanySettings & { key: string }, string>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      transactions: 'id, streamType, transactionType, date',
      clients: 'id, name',
      parts: 'id, code',
      serviceLogs: 'id, clientId, date, nextServiceDueDate',
      pendingQueue: 'id, createdAt, status',
      settings: 'key',
    });
  }
}

let dbInstance: AquaLedgerDb | null = null;

/** Lazy singleton (avoids touching IndexedDB at import time, e.g. during SSR/tests). */
export function getDb(): AquaLedgerDb {
  if (!dbInstance) dbInstance = new AquaLedgerDb();
  return dbInstance;
}

/** Full-backup export shape (Settings view downloads/uploads this JSON). */
export interface BackupPayload {
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
  clients: Client[];
  parts: PartItem[];
  serviceLogs: ServiceLog[];
  settings: CompanySettings;
}

export async function exportBackup(): Promise<BackupPayload> {
  const db = getDb();
  const [transactions, clients, parts, serviceLogs, settingsRows] = await Promise.all([
    db.transactions.toArray(),
    db.clients.toArray(),
    db.parts.toArray(),
    db.serviceLogs.toArray(),
    db.settings.toArray(),
  ]);
  const settings = settingsRows.find((s) => s.key === 'main');
  if (!settings) throw new Error('Settings row missing');
  const { key: _omit, ...rest } = settings;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    clients,
    parts,
    serviceLogs,
    settings: rest,
  };
}

export async function importBackup(payload: BackupPayload): Promise<void> {
  if (payload.version !== 1) throw new Error('Unsupported backup version');
  const db = getDb();
  await db.transaction(
    'rw',
    [db.transactions, db.clients, db.parts, db.serviceLogs, db.settings],
    async () => {
      await db.transactions.clear();
      await db.clients.clear();
      await db.parts.clear();
      await db.serviceLogs.clear();
      await db.transactions.bulkPut(payload.transactions);
      await db.clients.bulkPut(payload.clients);
      await db.parts.bulkPut(payload.parts);
      await db.serviceLogs.bulkPut(payload.serviceLogs);
      await db.settings.put({ key: 'main', ...payload.settings });
    },
  );
}
