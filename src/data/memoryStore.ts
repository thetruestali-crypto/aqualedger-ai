// In-memory LedgerStore: used by unit tests and (later) E2E seeding.
// No DOM, no network, no IndexedDB.
import type {
  Transaction,
  CompanySettings,
  Client,
  PartItem,
  ServiceLog,
} from '../types';
import type { BackupPayload } from './db';
import { planStockDecrement } from '../domain/inventory';
import { getDbOwner } from './owner';
import {
  defaultTransactions,
  defaultClients,
  defaultParts,
  defaultSettings,
  defaultServiceLogs,
  blankSettings,
} from './seed';
import { normalizeTransaction, type LedgerStore, type StockLine } from './repository';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function createMemoryStore(seed = true): LedgerStore {
  let transactions: Transaction[] = seed ? clone(defaultTransactions) : [];
  let clients: Client[] = seed ? clone(defaultClients) : [];
  let parts: PartItem[] = seed ? clone(defaultParts) : [];
  let serviceLogs: ServiceLog[] = seed ? clone(defaultServiceLogs) : [];
  let settings: CompanySettings = clone(defaultSettings);

  function upsert<T extends { id: string }>(list: T[], row: T): T[] {
    const i = list.findIndex((r) => r.id === row.id);
    if (i >= 0) {
      const next = [...list];
      next[i] = clone(row);
      return next;
    }
    return [clone(row), ...list];
  }

  return {
    async getTransactions() {
      return clone(transactions.map(normalizeTransaction));
    },
    async saveTransaction(tx) {
      transactions = upsert(transactions, normalizeTransaction(tx));
    },
    async deleteTransaction(id) {
      transactions = transactions.filter((t) => t.id !== id);
    },
    async getClients() {
      return clone(clients);
    },
    async saveClient(c) {
      clients = upsert(clients, c);
    },
    async deleteClient(id) {
      clients = clients.filter((c) => c.id !== id);
    },
    async getParts() {
      return clone(parts);
    },
    async savePart(p) {
      parts = upsert(parts, p);
    },
    async deletePart(id) {
      parts = parts.filter((p) => p.id !== id);
    },
    async decrementStock(lines: StockLine[]) {
      const plan = planStockDecrement(parts, lines);
      if (!plan.ok) throw new Error(plan.errors.join('؛ '));
      parts = plan.parts;
      return plan.results;
    },
    async getServiceLogs() {
      return clone(serviceLogs);
    },
    async saveServiceLog(log) {
      serviceLogs = upsert(serviceLogs, log);
    },
    async deleteServiceLog(id) {
      serviceLogs = serviceLogs.filter((l) => l.id !== id);
    },
    async getSettings() {
      return clone(settings);
    },
    async saveSettings(s) {
      settings = clone(s);
    },
    async exportBackup(): Promise<BackupPayload> {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: clone(transactions),
        clients: clone(clients),
        parts: clone(parts),
        serviceLogs: clone(serviceLogs),
        settings: clone(settings),
      };
    },
    async importBackup(b) {
      transactions = clone(b.transactions.map(normalizeTransaction));
      clients = clone(b.clients);
      parts = clone(b.parts);
      serviceLogs = clone(b.serviceLogs);
      settings = clone(b.settings);
    },
    async resetToSeed() {
      // Owner-aware like dexieStore: a logged-in owner resets to a CLEAN
      // database, never to the guest demo seed.
      if (getDbOwner()) {
        transactions = [];
        clients = [];
        parts = [];
        serviceLogs = [];
        settings = clone(blankSettings);
        return;
      }
      transactions = clone(defaultTransactions);
      clients = clone(defaultClients);
      parts = clone(defaultParts);
      serviceLogs = clone(defaultServiceLogs);
      settings = clone(defaultSettings);
    },
  };
}
