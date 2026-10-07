// Pure state transitions: every AppState change as a testable pure function.
// No DOM, no network, no Date.now (pass nowISO explicitly). The React provider
// in store.tsx applies these and persists the result (debounced) to a LedgerStore.
import type {
  Transaction,
  CompanySettings,
  Client,
  PartItem,
  ServiceLog,
} from '../types';
import type { BackupPayload } from '../data/db';
import { normalizeTransaction } from '../data/repository';
import { suggestNextServiceMonths, addMonthsISO } from '../domain/reminders';

export interface AppState {
  transactions: Transaction[];
  settings: CompanySettings;
  clients: Client[];
  parts: PartItem[];
  serviceLogs: ServiceLog[];
}

export type AppAction =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'RECEIVE_TRANSACTION'; tx: Transaction }
  | { type: 'DELETE_TRANSACTION'; id: string }
  | { type: 'SAVE_SETTINGS'; settings: CompanySettings }
  | { type: 'ADD_CLIENT'; client: Client }
  | { type: 'UPDATE_CLIENT'; client: Client }
  | { type: 'SETTLE_CLIENT_DEBT'; clientId: string; amount: number; nowISO: string }
  | { type: 'ADD_PART'; part: PartItem }
  | { type: 'UPDATE_PART'; part: PartItem }
  | { type: 'DELETE_PART'; id: string }
  | { type: 'SAVE_SERVICE_LOG'; log: ServiceLog }
  | { type: 'DELETE_SERVICE_LOG'; id: string }
  | { type: 'IMPORT_BACKUP'; backup: BackupPayload };

function upsertById<T extends { id: string }>(list: T[], row: T, prependNew = true): T[] {
  const i = list.findIndex((r) => r.id === row.id);
  if (i >= 0) {
    const next = [...list];
    next[i] = row;
    return next;
  }
  return prependNew ? [row, ...list] : [...list, row];
}

function findClientIndex(clients: Client[], name: string): number {
  const needle = name.trim().toLowerCase();
  return clients.findIndex(
    (c) =>
      c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase()),
  );
}

/** Client upsert derived from a field transaction (mirrors legacy App behavior). */
export function applyFieldTransactionToClients(clients: Client[], tx: Transaction): Client[] {
  const clientName = tx.party.name;
  const months = tx.suggestNextServiceMonths ?? suggestNextServiceMonths(tx.items?.map((i) => i.itemName) ?? []);
  const nextServiceDueDate = addMonthsISO(tx.date, months);
  const idx = findClientIndex(clients, clientName);
  if (idx >= 0) {
    const existing = clients[idx];
    const updated: Client = {
      ...existing,
      totalPaid: existing.totalPaid + (tx.paidAmount || 0),
      totalDebt: existing.totalDebt + (tx.remainingDebt || 0),
      lastServiceDate: tx.date,
      nextServiceDueDate,
      phone: tx.party.phone || existing.phone,
      address: tx.party.address || existing.address,
    };
    const next = [...clients];
    next[idx] = updated;
    return next;
  }
  const created: Client = {
    id: `client-${Date.now()}`,
    name: clientName,
    phone: tx.party.phone || '',
    address: tx.party.address || '',
    deviceModel: 'دستگاه تصفیه آب خانگی',
    totalPaid: tx.paidAmount || 0,
    totalDebt: tx.remainingDebt || 0,
    lastServiceDate: tx.date,
    nextServiceDueDate,
    notes: tx.description,
  };
  return [created, ...clients];
}

export function applyAction(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;
    case 'RECEIVE_TRANSACTION': {
      const tx = normalizeTransaction(action.tx);
      const transactions = [tx, ...state.transactions];
      if (tx.streamType === 'field' && tx.party?.role === 'client') {
        return {
          ...state,
          transactions,
          clients: applyFieldTransactionToClients(state.clients, tx),
        };
      }
      return { ...state, transactions };
    }
    case 'DELETE_TRANSACTION':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
    case 'SAVE_SETTINGS':
      return { ...state, settings: action.settings };
    case 'ADD_CLIENT':
      return { ...state, clients: [action.client, ...state.clients] };
    case 'UPDATE_CLIENT':
      return {
        ...state,
        clients: state.clients.map((c) => (c.id === action.client.id ? action.client : c)),
      };
    case 'SETTLE_CLIENT_DEBT': {
      const target = state.clients.find((c) => c.id === action.clientId);
      if (!target) return state;
      const amount = Math.max(0, Math.min(action.amount, target.totalDebt));
      if (amount <= 0) return state;
      const clients = state.clients.map((c) =>
        c.id === action.clientId
          ? { ...c, totalPaid: c.totalPaid + amount, totalDebt: c.totalDebt - amount }
          : c,
      );
      const settleTx: Transaction = {
        id: `tx-settle-${Date.now()}`,
        date: action.nowISO,
        streamType: 'field',
        transactionType: 'client_payment_received',
        party: { role: 'client', name: target.name, phone: target.phone },
        totalAmount: amount,
        paidAmount: amount,
        remainingDebt: 0,
        financialImpact: { targetBalance: 'personal_cash', userBalanceChange: 0 },
        paymentMethod: 'card_to_card',
        category: 'تسویه بدهی معوق',
        description: `تسویه مبلغ بدهی توسط ${target.name}`,
        conversationalSummary: `دریافت ${amount.toLocaleString('fa-IR')} تومان بابت تسویه بدهی ${target.name} ثبت شد.`,
        source: 'manual',
        settled: true,
      };
      return { ...state, clients, transactions: [settleTx, ...state.transactions] };
    }
    case 'ADD_PART':
      return { ...state, parts: [action.part, ...state.parts] };
    case 'UPDATE_PART':
      return {
        ...state,
        parts: state.parts.map((p) => (p.id === action.part.id ? action.part : p)),
      };
    case 'DELETE_PART':
      return { ...state, parts: state.parts.filter((p) => p.id !== action.id) };
    case 'SAVE_SERVICE_LOG':
      return { ...state, serviceLogs: upsertById(state.serviceLogs, action.log) };
    case 'DELETE_SERVICE_LOG':
      return { ...state, serviceLogs: state.serviceLogs.filter((l) => l.id !== action.id) };
    case 'IMPORT_BACKUP':
      return {
        transactions: action.backup.transactions.map(normalizeTransaction),
        clients: action.backup.clients,
        parts: action.backup.parts,
        serviceLogs: action.backup.serviceLogs,
        settings: action.backup.settings,
      };
  }
}
