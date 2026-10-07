import { describe, expect, it } from 'vitest';
import { applyAction, type AppState } from '@/src/state/transitions';
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
