// Dexie-backed LedgerStore (offline-first target, Phase-3 cutover).
// Stock decrements run inside a Dexie readwrite transaction: validate everything
// first, then write — atomic all-or-nothing at the storage layer too.
import type { CompanySettings } from '../types';
import { getDb, type BackupPayload } from './db';
import { planStockDecrement } from '../domain/inventory';
import { findPart } from '../domain/inventory';
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

export function createDexieStore(): LedgerStore {
  return {
    async getTransactions() {
      return (await getDb().transactions.toArray()).map(normalizeTransaction);
    },
    async saveTransaction(tx) {
      await getDb().transactions.put(normalizeTransaction(tx));
    },
    async deleteTransaction(id) {
      await getDb().transactions.delete(id);
    },
    async getClients() {
      return getDb().clients.toArray();
    },
    async saveClient(c) {
      await getDb().clients.put(c);
    },
    async deleteClient(id) {
      await getDb().clients.delete(id);
    },
    async getParts() {
      return getDb().parts.toArray();
    },
    async savePart(p) {
      await getDb().parts.put(p);
    },
    async deletePart(id) {
      await getDb().parts.delete(id);
    },
    async decrementStock(lines: StockLine[]) {
      const db = getDb();
      return db.transaction('rw', db.parts, async () => {
        const parts = await db.parts.toArray();
        const plan = planStockDecrement(parts, lines);
        if (!plan.ok) throw new Error(plan.errors.join('؛ '));
        // Resolve applied part ids back to rows for bulkPut.
        const touchedIds = new Set(plan.results.map((r) => r.partId));
        const changed = plan.parts.filter((p) => touchedIds.has(p.id));
        // Double-check against live rows inside the transaction (no lost update).
        for (const c of changed) {
          const live = await db.parts.get(c.id);
          const wanted = lines
            .filter((l) => {
              const match = findPart(parts, l);
              return match?.id === c.id;
            })
            .reduce((acc, l) => acc + Math.floor(l.qty), 0);
          if (!live || live.stock < wanted) {
            throw new Error(`موجودی «${c.name}» کافی نیست`);
          }
        }
        await db.parts.bulkPut(changed);
        return plan.results;
      });
    },
    async getServiceLogs() {
      return getDb().serviceLogs.toArray();
    },
    async saveServiceLog(log) {
      await getDb().serviceLogs.put(log);
    },
    async deleteServiceLog(id) {
      await getDb().serviceLogs.delete(id);
    },
    async getSettings() {
      const row = await getDb().settings.get('main');
      if (!row) {
        await getDb().settings.put({ key: 'main', ...defaultSettings });
        return { ...defaultSettings };
      }
      const { key: _omit, ...rest } = row;
      return rest as CompanySettings;
    },
    async saveSettings(s) {
      await getDb().settings.put({ key: 'main', ...s });
    },
    async exportBackup(): Promise<BackupPayload> {
      const { exportBackup } = await import('./db');
      return exportBackup();
    },
    async importBackup(b) {
      const { importBackup } = await import('./db');
      return importBackup(b);
    },
    async resetToSeed() {
      const db = getDb();
      // For a logged-in owner "reset" means a CLEAN account database (empty +
      // blank settings), never the guest demo seed. Guests keep demo behavior.
      const userOwned = !!getDbOwner();
      await db.transaction(
        'rw',
        [db.transactions, db.clients, db.parts, db.serviceLogs, db.settings],
        async () => {
          await db.transactions.clear();
          await db.clients.clear();
          await db.parts.clear();
          await db.serviceLogs.clear();
          if (userOwned) {
            await db.settings.put({ key: 'main', ...blankSettings });
            return;
          }
          await db.transactions.bulkPut(defaultTransactions);
          await db.clients.bulkPut(defaultClients);
          await db.parts.bulkPut(defaultParts);
          await db.serviceLogs.bulkPut(defaultServiceLogs);
          await db.settings.put({ key: 'main', ...defaultSettings });
        },
      );
    },
  };
}
