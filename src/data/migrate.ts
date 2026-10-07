// One-time localStorage -> Dexie migration (runs once on first Dexie boot).
// The reader is injectable so the migration itself is unit-testable without a DOM.
import type { Transaction, CompanySettings, Client, PartItem, ServiceLog } from '../types';
import { normalizeTransaction } from './repository';

export interface LegacySnapshot {
  transactions: Transaction[];
  clients: Client[];
  parts: PartItem[];
  serviceLogs: ServiceLog[];
  settings: CompanySettings;
}

export type LegacyReader = (key: string) => string | null;

export const LEGACY_KEYS = {
  TRANSACTIONS: 'aqualedger_transactions_v1',
  SETTINGS: 'aqualedger_settings_v1',
  CLIENTS: 'aqualedger_clients_v1',
  PARTS: 'aqualedger_parts_v1',
  SERVICE_LOGS: 'aqualedger_service_logs_v1',
} as const;

function readArray<T>(reader: LegacyReader, key: string, fallback: T[]): T[] {
  try {
    const raw = reader(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/** Read + normalize the legacy snapshot. Never throws. */
export function readLegacySnapshot(
  reader: LegacyReader,
  seed: LegacySnapshot,
): LegacySnapshot {
  let settings = seed.settings;
  try {
    const raw = reader(LEGACY_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') settings = parsed as CompanySettings;
    }
  } catch {
    // keep seed settings
  }
  return {
    transactions: readArray<Transaction>(reader, LEGACY_KEYS.TRANSACTIONS, seed.transactions).map(
      normalizeTransaction,
    ),
    clients: readArray<Client>(reader, LEGACY_KEYS.CLIENTS, seed.clients),
    parts: readArray<PartItem>(reader, LEGACY_KEYS.PARTS, seed.parts),
    serviceLogs: readArray<ServiceLog>(reader, LEGACY_KEYS.SERVICE_LOGS, seed.serviceLogs),
    settings,
  };
}

export interface MigrationTarget {
  transactions: { bulkPut(rows: Transaction[]): Promise<void>; count(): Promise<number> };
  clients: { bulkPut(rows: Client[]): Promise<void> };
  parts: { bulkPut(rows: PartItem[]): Promise<void> };
  serviceLogs: { bulkPut(rows: ServiceLog[]): Promise<void> };
  settings: { put(row: CompanySettings & { key: string }): Promise<void> };
}

/**
 * Copy the legacy snapshot into the target (Dexie) tables.
 * Skips tables that already hold data (idempotent re-runs are safe).
 */
export async function migrateLegacyToTarget(
  snapshot: LegacySnapshot,
  target: MigrationTarget,
): Promise<{ migrated: boolean; counts: Record<string, number> }> {
  const existing = await target.transactions.count();
  if (existing > 0) return { migrated: false, counts: {} };
  await target.transactions.bulkPut(snapshot.transactions);
  await target.clients.bulkPut(snapshot.clients);
  await target.parts.bulkPut(snapshot.parts);
  await target.serviceLogs.bulkPut(snapshot.serviceLogs);
  await target.settings.put({ key: 'main', ...snapshot.settings });
  return {
    migrated: true,
    counts: {
      transactions: snapshot.transactions.length,
      clients: snapshot.clients.length,
      parts: snapshot.parts.length,
      serviceLogs: snapshot.serviceLogs.length,
    },
  };
}
