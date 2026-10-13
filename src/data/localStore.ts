// LocalStorage-backed LedgerStore (legacy driver; used by the UI until the
// Phase-3 Dexie cutover, and as the migration SOURCE). Browser only.
import type {
  Transaction,
  CompanySettings,
  Client,
  PartItem,
  ServiceLog,
} from '../types';
import type { BackupPayload } from './db';
import { planStockDecrement } from '../domain/inventory';
import {
  loadTransactions,
  saveTransactions,
  loadSettings,
  saveSettings,
  loadClients,
  saveClients,
  loadParts,
  saveParts,
  loadServiceLogs,
  saveServiceLogs,
  resetToDemoData,
} from '../utils/storage';
import { normalizeTransaction, type LedgerStore, type StockLine } from './repository';
import { getDbOwner } from './owner';
import { blankSettings } from './seed';

function upsert<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((r) => r.id === row.id);
  if (i >= 0) {
    const next = [...list];
    next[i] = row;
    return next;
  }
  return [row, ...list];
}

export function createLocalStore(): LedgerStore {
  return {
    async getTransactions() {
      return loadTransactions().map(normalizeTransaction);
    },
    async saveTransaction(tx) {
      saveTransactions(upsert(loadTransactions(), normalizeTransaction(tx)));
    },
    async deleteTransaction(id) {
      saveTransactions(loadTransactions().filter((t) => t.id !== id));
    },
    async getClients() {
      return loadClients();
    },
    async saveClient(c) {
      saveClients(upsert(loadClients(), c));
    },
    async deleteClient(id) {
      saveClients(loadClients().filter((c) => c.id !== id));
    },
    async getParts() {
      return loadParts();
    },
    async savePart(p) {
      saveParts(upsert(loadParts(), p));
    },
    async deletePart(id) {
      saveParts(loadParts().filter((p) => p.id !== id));
    },
    async decrementStock(lines: StockLine[]) {
      const plan = planStockDecrement(loadParts(), lines);
      if (!plan.ok) throw new Error(plan.errors.join('؛ '));
      saveParts(plan.parts);
      return plan.results;
    },
    async getServiceLogs() {
      return loadServiceLogs();
    },
    async saveServiceLog(log) {
      saveServiceLogs(upsert(loadServiceLogs(), log));
    },
    async deleteServiceLog(id) {
      saveServiceLogs(loadServiceLogs().filter((l) => l.id !== id));
    },
    async getSettings() {
      return loadSettings();
    },
    async saveSettings(s: CompanySettings) {
      saveSettings(s);
    },
    async exportBackup(): Promise<BackupPayload> {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: loadTransactions(),
        clients: loadClients(),
        parts: loadParts(),
        serviceLogs: loadServiceLogs(),
        settings: loadSettings(),
      };
    },
    async importBackup(b) {
      saveTransactions(b.transactions.map(normalizeTransaction));
      saveClients(b.clients);
      saveParts(b.parts);
      saveServiceLogs(b.serviceLogs);
      saveSettings(b.settings);
    },
    async resetToSeed() {
      // Owner-aware like dexieStore: a logged-in owner resets to CLEAN.
      if (getDbOwner()) {
        saveTransactions([]);
        saveClients([]);
        saveParts([]);
        saveServiceLogs([]);
        saveSettings({ ...blankSettings });
        return;
      }
      resetToDemoData();
    },
  };
}
