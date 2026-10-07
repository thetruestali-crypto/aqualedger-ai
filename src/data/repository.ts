// Repository interface: the ONLY contract the UI/state layer may depend on.
// Implementations: memoryStore (tests), localStore (legacy driver until Phase 3),
// dexieStore (IndexedDB, offline-first target). Cloud sync can be added later as
// another implementation — no UI changes required.
import type {
  Transaction,
  CompanySettings,
  Client,
  PartItem,
  ServiceLog,
} from '../types';
import type { BackupPayload } from './db';

export interface StockLine {
  partId?: string;
  name?: string;
  qty: number;
}

export interface StockResult {
  partId: string;
  name: string;
  requested: number;
  applied: number;
  remaining: number;
}

export interface LedgerStore {
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  saveTransaction(tx: Transaction): Promise<void>; // upsert
  deleteTransaction(id: string): Promise<void>;
  // Clients
  getClients(): Promise<Client[]>;
  saveClient(c: Client): Promise<void>; // upsert
  deleteClient(id: string): Promise<void>;
  // Parts
  getParts(): Promise<PartItem[]>;
  savePart(p: PartItem): Promise<void>; // upsert
  deletePart(id: string): Promise<void>;
  /** Atomic all-or-nothing stock decrement (FR-07). Throws on insufficient stock. */
  decrementStock(lines: StockLine[]): Promise<StockResult[]>;
  // Service logs
  getServiceLogs(): Promise<ServiceLog[]>;
  saveServiceLog(log: ServiceLog): Promise<void>; // upsert
  deleteServiceLog(id: string): Promise<void>;
  // Settings (single row)
  getSettings(): Promise<CompanySettings>;
  saveSettings(s: CompanySettings): Promise<void>;
  // Backup / seed
  exportBackup(): Promise<BackupPayload>;
  importBackup(b: BackupPayload): Promise<void>;
  resetToSeed(): Promise<void>;
}

/** Fill defaults for rows stored before a schema addition (e.g. `settled`). Pure. */
export function normalizeTransaction(raw: unknown): Transaction {
  const t = raw as Partial<Transaction>;
  return {
    id: String(t.id ?? `tx-${Date.now()}`),
    date: String(t.date ?? new Date().toISOString()),
    jalaliDate: t.jalaliDate,
    streamType: t.streamType === 'field' ? 'field' : 'company',
    transactionType: t.transactionType ?? 'other',
    party: {
      role: t.party?.role ?? 'boss',
      name: t.party?.name ?? 'نامشخص',
      phone: t.party?.phone,
      address: t.party?.address,
    },
    totalAmount: Math.round(t.totalAmount ?? 0),
    paidAmount: Math.round(t.paidAmount ?? 0),
    remainingDebt: Math.round(t.remainingDebt ?? 0),
    financialImpact: {
      targetBalance: t.financialImpact?.targetBalance ?? 'boss_balance',
      userBalanceChange: Math.round(t.financialImpact?.userBalanceChange ?? 0),
      profitAmount:
        t.financialImpact?.profitAmount !== undefined
          ? Math.round(t.financialImpact.profitAmount)
          : undefined,
    },
    paymentMethod: t.paymentMethod ?? 'cash',
    category: t.category ?? 'سایر',
    items: t.items,
    suggestNextServiceMonths: t.suggestNextServiceMonths,
    description: t.description ?? '',
    conversationalSummary: t.conversationalSummary ?? '',
    source: t.source === 'ai_voice' || t.source === 'ai_text' ? t.source : 'manual',
    settled: t.settled ?? (t.remainingDebt ?? 0) <= 0,
  };
}
