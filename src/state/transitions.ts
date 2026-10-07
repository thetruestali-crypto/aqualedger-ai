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
  | { type: 'SETTLE_INVOICE'; txId: string; amount: number; nowISO: string }
  | { type: 'SET_PARTS'; parts: PartItem[] }
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

/** Public matcher: client record for a transaction party name (or null). */
export function matchClientId(clients: Client[], partyName: string): string | null {
  const idx = findClientIndex(clients, partyName);
  return idx >= 0 ? clients[idx].id : null;
}

const INVOICE_TYPES: Transaction['transactionType'][] = ['client_receivable', 'client_part_cost'];

/** Open (unsettled) invoice transactions of a client, oldest first. */
export function getClientInvoices(transactions: Transaction[], client: Client): Transaction[] {
  const needle = client.name.trim().toLowerCase();
  return transactions
    .filter(
      (t) =>
        INVOICE_TYPES.includes(t.transactionType) &&
        t.party?.role === 'client' &&
        (t.party.name.toLowerCase().includes(needle) ||
          needle.includes(t.party.name.toLowerCase())) &&
        (t.remainingDebt ?? 0) > 0,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** All transactions of a client (history), newest first. */
export function getClientHistory(transactions: Transaction[], client: Client): Transaction[] {
  const needle = client.name.trim().toLowerCase();
  return transactions
    .filter(
      (t) =>
        t.party?.role === 'client' &&
        (t.party.name.toLowerCase().includes(needle) ||
          needle.includes(t.party.name.toLowerCase())),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      // Allocate across the client's open invoices (oldest first); any amount
      // beyond all open invoices is recorded as a residual settlement receipt.
      const target = state.clients.find((c) => c.id === action.clientId);
      if (!target) return state;
      if (!(action.amount > 0)) return state;
      let rest = Math.round(action.amount);
      let transactions = state.transactions;
      let paidTotal = 0;

      const applyToInvoice = (tx: Transaction, apply: number): Transaction => {
        const paid = Math.min(apply, tx.remainingDebt);
        const paidAmount = tx.paidAmount + paid;
        const remainingDebt = tx.remainingDebt - paid;
        return { ...tx, paidAmount, remainingDebt, settled: remainingDebt <= 0 };
      };

      for (const inv of getClientInvoices(state.transactions, target)) {
        if (rest <= 0) break;
        const apply = Math.min(rest, inv.remainingDebt);
        if (apply <= 0) continue;
        transactions = transactions.map((t) => (t.id === inv.id ? applyToInvoice(t, apply) : t));
        rest -= apply;
        paidTotal += apply;
      }

      let clients = state.clients.map((c) =>
        c.id === action.clientId
          ? {
              ...c,
              totalPaid: c.totalPaid + paidTotal,
              totalDebt: Math.max(0, c.totalDebt - paidTotal),
            }
          : c,
      );

      if (rest > 0) {
        // Residual (overpayment / payment without a matching invoice).
        const settleTx: Transaction = {
          id: `tx-settle-${Date.now()}`,
          date: action.nowISO,
          streamType: 'field',
          transactionType: 'client_payment_received',
          party: { role: 'client', name: target.name, phone: target.phone },
          totalAmount: rest,
          paidAmount: rest,
          remainingDebt: 0,
          financialImpact: { targetBalance: 'personal_cash', userBalanceChange: 0 },
          paymentMethod: 'card_to_card',
          category: 'تسویه بدهی معوق',
          description: `تسویه مبلغ بدهی توسط ${target.name}`,
          conversationalSummary: `دریافت ${rest.toLocaleString('fa-IR')} تومان بابت تسویه بدهی ${target.name} ثبت شد.`,
          source: 'manual',
          settled: true,
        };
        transactions = [settleTx, ...transactions];
        clients = clients.map((c) =>
          c.id === action.clientId
            ? {
                ...c,
                totalPaid: c.totalPaid + rest,
                totalDebt: Math.max(0, c.totalDebt - rest),
              }
            : c,
        );
      }
      return { ...state, clients, transactions };
    }
    case 'SETTLE_INVOICE': {
      // Settle (fully or partially) ONE invoice: mutate it, update its client.
      if (!(action.amount > 0)) return state;
      const inv = state.transactions.find((t) => t.id === action.txId);
      if (!inv || (inv.remainingDebt ?? 0) <= 0) return state;
      const apply = Math.min(Math.round(action.amount), inv.remainingDebt);
      const transactions = state.transactions.map((t) =>
        t.id === action.txId
          ? {
              ...t,
              paidAmount: t.paidAmount + apply,
              remainingDebt: t.remainingDebt - apply,
              settled: t.remainingDebt - apply <= 0,
            }
          : t,
      );
      const clientId = matchClientId(state.clients, inv.party.name);
      const clients =
        clientId === null
          ? state.clients
          : state.clients.map((c) =>
              c.id === clientId
                ? {
                    ...c,
                    totalPaid: c.totalPaid + apply,
                    totalDebt: Math.max(0, c.totalDebt - apply),
                  }
                : c,
            );
      return { ...state, transactions, clients };
    }
    case 'SET_PARTS':
      return { ...state, parts: action.parts };
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
