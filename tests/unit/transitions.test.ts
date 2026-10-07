import { describe, expect, it } from 'vitest';
import {
  applyAction,
  getClientHistory,
  getClientInvoices,
  matchClientId,
  type AppState,
} from '@/src/state/transitions';
import { defaultSettings } from '@/src/data/seed';
import type { Transaction } from '@/src/types';

const NOW = '2026-10-07T12:00:00.000Z';

const empty: AppState = {
  transactions: [],
  settings: { ...defaultSettings },
  clients: [],
  parts: [],
  serviceLogs: [],
};

function fieldTx(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    date: NOW,
    streamType: 'field',
    transactionType: 'client_payment_received',
    party: { role: 'client', name: 'آقای صابری' },
    totalAmount: 450_000,
    paidAmount: 450_000,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'personal_cash', userBalanceChange: 0 },
    paymentMethod: 'cash',
    category: 'سرویس',
    description: 'x',
    conversationalSummary: 'x',
    source: 'manual',
    settled: true,
    ...partial,
  };
}

describe('RECEIVE_TRANSACTION', () => {
  it('creates a new client from a field transaction', () => {
    const s = applyAction(empty, { type: 'RECEIVE_TRANSACTION', tx: fieldTx() });
    expect(s.transactions).toHaveLength(1);
    expect(s.clients).toHaveLength(1);
    expect(s.clients[0].name).toBe('آقای صابری');
    expect(s.clients[0].totalPaid).toBe(450_000);
  });

  it('updates an existing client and accumulates debt', () => {
    const s1 = applyAction(empty, { type: 'RECEIVE_TRANSACTION', tx: fieldTx() });
    const s2 = applyAction(s1, {
      type: 'RECEIVE_TRANSACTION',
      tx: fieldTx({ totalAmount: 200_000, paidAmount: 0, remainingDebt: 200_000, settled: false }),
    });
    expect(s2.clients).toHaveLength(1);
    expect(s2.clients[0].totalPaid).toBe(450_000);
    expect(s2.clients[0].totalDebt).toBe(200_000);
  });

  it('company transactions do not touch clients', () => {
    const s = applyAction(empty, {
      type: 'RECEIVE_TRANSACTION',
      tx: fieldTx({
        streamType: 'company',
        transactionType: 'company_expense_out_of_pocket',
        party: { role: 'boss', name: 'رئیس' },
      }),
    });
    expect(s.clients).toHaveLength(0);
  });

  it('normalizes legacy transactions missing settled', () => {
    const legacy = { ...fieldTx(), settled: undefined } as unknown as Transaction;
    const s = applyAction(empty, { type: 'RECEIVE_TRANSACTION', tx: legacy });
    expect(s.transactions[0].settled).toBe(true);
  });
});

describe('SETTLE_CLIENT_DEBT', () => {
  it('reduces debt, raises paid, and records a settlement tx', () => {
    const s1 = applyAction(empty, {
      type: 'RECEIVE_TRANSACTION',
      tx: fieldTx({ totalAmount: 500_000, paidAmount: 300_000, remainingDebt: 200_000, settled: false }),
    });
    const clientId = s1.clients[0].id;
    const s2 = applyAction(s1, { type: 'SETTLE_CLIENT_DEBT', clientId, amount: 150_000, nowISO: NOW });
    expect(s2.clients[0].totalDebt).toBe(50_000);
    expect(s2.clients[0].totalPaid).toBe(450_000);
    expect(s2.transactions[0].transactionType).toBe('client_payment_received');
    expect(s2.transactions[0].settled).toBe(true);
  });

  it('clamps overpayment and ignores unknown clients', () => {
    const s1 = applyAction(empty, {
      type: 'RECEIVE_TRANSACTION',
      tx: fieldTx({ totalAmount: 500_000, paidAmount: 300_000, remainingDebt: 200_000, settled: false }),
    });
    const clientId = s1.clients[0].id;
    const s2 = applyAction(s1, { type: 'SETTLE_CLIENT_DEBT', clientId, amount: 999_999_999, nowISO: NOW });
    expect(s2.clients[0].totalDebt).toBe(0);
    expect(applyAction(s1, { type: 'SETTLE_CLIENT_DEBT', clientId: 'nope', amount: 10, nowISO: NOW })).toBe(s1);
  });
});

describe('other actions', () => {
  it('CRUD for parts and service logs', () => {
    const part = {
      id: 'p1', name: 'فیلتر', code: 'F', unit: 'عدد', stock: 5,
      purchasePrice: 10, sellPrice: 20, category: 'filter' as const,
    };
    let s = applyAction(empty, { type: 'ADD_PART', part });
    expect(s.parts).toHaveLength(1);
    s = applyAction(s, { type: 'UPDATE_PART', part: { ...part, stock: 4 } });
    expect(s.parts[0].stock).toBe(4);
    s = applyAction(s, { type: 'DELETE_PART', id: 'p1' });
    expect(s.parts).toHaveLength(0);

    const log = {
      id: 'sl-1', clientId: 'c-1', date: NOW, items: [], laborFee: 0,
      nextServiceDueDate: NOW,
    };
    s = applyAction(s, { type: 'SAVE_SERVICE_LOG', log });
    expect(s.serviceLogs).toHaveLength(1);
    s = applyAction(s, { type: 'DELETE_SERVICE_LOG', id: 'sl-1' });
    expect(s.serviceLogs).toHaveLength(0);
  });

  it('IMPORT_BACKUP replaces the whole state', () => {
    const s = applyAction(empty, {
      type: 'IMPORT_BACKUP',
      backup: {
        version: 1,
        exportedAt: NOW,
        transactions: [fieldTx({ id: 'imp-1' })],
        clients: [],
        parts: [],
        serviceLogs: [],
        settings: { ...defaultSettings, bossName: 'رئیس جدید' },
      },
    });
    expect(s.transactions.map((t) => t.id)).toEqual(['imp-1']);
    expect(s.settings.bossName).toBe('رئیس جدید');
  });
});

describe('SETTLE_INVOICE', () => {
  const invoice = () =>
    fieldTx({
      id: 'inv-1',
      transactionType: 'client_receivable',
      totalAmount: 1_000_000,
      paidAmount: 600_000,
      remainingDebt: 400_000,
      settled: false,
    });

  it('partially settles one invoice and updates its client', () => {
    const s1 = applyAction(empty, { type: 'RECEIVE_TRANSACTION', tx: invoice() });
    const clientId = s1.clients[0].id;
    expect(s1.clients[0].totalDebt).toBe(400_000);
    const s2 = applyAction(s1, { type: 'SETTLE_INVOICE', txId: 'inv-1', amount: 150_000, nowISO: NOW });
    const tx = s2.transactions.find((t) => t.id === 'inv-1')!;
    expect(tx.paidAmount).toBe(750_000);
    expect(tx.remainingDebt).toBe(250_000);
    expect(tx.settled).toBe(false);
    expect(s2.clients.find((c) => c.id === clientId)!.totalDebt).toBe(250_000);
  });

  it('full settle flags the invoice settled; overpay clamps', () => {
    const s1 = applyAction(empty, { type: 'RECEIVE_TRANSACTION', tx: invoice() });
    const s2 = applyAction(s1, { type: 'SETTLE_INVOICE', txId: 'inv-1', amount: 9_999_999, nowISO: NOW });
    const tx = s2.transactions.find((t) => t.id === 'inv-1')!;
    expect(tx.remainingDebt).toBe(0);
    expect(tx.settled).toBe(true);
    expect(s2.clients[0].totalDebt).toBe(0);
  });

  it('ignores unknown invoices and non-positive amounts', () => {
    const s1 = applyAction(empty, { type: 'RECEIVE_TRANSACTION', tx: invoice() });
    expect(applyAction(s1, { type: 'SETTLE_INVOICE', txId: 'nope', amount: 10, nowISO: NOW })).toBe(s1);
    expect(applyAction(s1, { type: 'SETTLE_INVOICE', txId: 'inv-1', amount: 0, nowISO: NOW })).toBe(s1);
  });
});

describe('SETTLE_CLIENT_DEBT allocation', () => {
  const twoInvoices = (): AppState => {
    let s = applyAction(
      empty,
      {
        type: 'RECEIVE_TRANSACTION',
        tx: fieldTx({
          id: 'old',
          date: '2026-01-01T00:00:00.000Z',
          transactionType: 'client_receivable',
          totalAmount: 500_000,
          paidAmount: 300_000,
          remainingDebt: 200_000,
          settled: false,
        }),
      },
    );
    s = applyAction(s, {
      type: 'RECEIVE_TRANSACTION',
      tx: fieldTx({
        id: 'new',
        date: '2026-06-01T00:00:00.000Z',
        transactionType: 'client_receivable',
        totalAmount: 300_000,
        paidAmount: 0,
        remainingDebt: 300_000,
        settled: false,
      }),
    });
    return s;
  };

  it('settles oldest invoices first without extra txs', () => {
    const s1 = twoInvoices();
    const clientId = s1.clients[0].id;
    const s2 = applyAction(s1, { type: 'SETTLE_CLIENT_DEBT', clientId, amount: 350_000, nowISO: NOW });
    const old = s2.transactions.find((t) => t.id === 'old')!;
    const fresh = s2.transactions.find((t) => t.id === 'new')!;
    expect(old.settled).toBe(true);
    expect(old.remainingDebt).toBe(0);
    expect(fresh.remainingDebt).toBe(150_000);
    expect(s2.clients[0].totalDebt).toBe(150_000);
    // No residual settlement tx: cash lives inside the mutated invoices.
    expect(s2.transactions.filter((t) => t.id.startsWith('tx-settle-'))).toHaveLength(0);
  });

  it('records a residual receipt for overpayment', () => {
    const s1 = twoInvoices();
    const clientId = s1.clients[0].id;
    const s2 = applyAction(s1, { type: 'SETTLE_CLIENT_DEBT', clientId, amount: 700_000, nowISO: NOW });
    expect(s2.clients[0].totalDebt).toBe(0);
    const residual = s2.transactions.find((t) => t.id.startsWith('tx-settle-'))!;
    expect(residual.paidAmount).toBe(200_000);
  });
});

describe('invoice selectors', () => {
  it('getClientInvoices returns only open invoices, oldest first', () => {
    let s = applyAction(
      empty,
      {
        type: 'RECEIVE_TRANSACTION',
        tx: fieldTx({ id: 'a', date: '2026-06-01T00:00:00.000Z', transactionType: 'client_receivable', totalAmount: 100, paidAmount: 0, remainingDebt: 100, settled: false }),
      },
    );
    s = applyAction(s, {
      type: 'RECEIVE_TRANSACTION',
      tx: fieldTx({ id: 'b', date: '2026-01-01T00:00:00.000Z', transactionType: 'client_receivable', totalAmount: 100, paidAmount: 0, remainingDebt: 100, settled: false }),
    });
    s = applyAction(s, { type: 'RECEIVE_TRANSACTION', tx: fieldTx({ id: 'c' }) }); // settled, not invoice
    const client = s.clients[0];
    expect(getClientInvoices(s.transactions, client).map((t) => t.id)).toEqual(['b', 'a']);
    expect(getClientHistory(s.transactions, client)).toHaveLength(3);
    expect(matchClientId(s.clients, 'صابری')).toBe(client.id);
    expect(matchClientId(s.clients, 'غریبه')).toBeNull();
  });

  it('SET_PARTS replaces the parts list', () => {
    const s = applyAction(empty, { type: 'SET_PARTS', parts: [] });
    expect(s.parts).toEqual([]);
  });
});
