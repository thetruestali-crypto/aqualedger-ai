import { describe, expect, it } from 'vitest';
import {
  TOOL_REGISTRY,
  getToolDefinition,
  listToolNames,
  handleRecordBossAdvance,
  handleCheckStockLevel,
  handleGetBossBalance,
  handleCreateCustomerProfile,
  handleAppendCustomerNote,
  handleRestockPart,
  type StoreSnapshot,
} from '@/server/toolRegistry';
import type { Transaction, Client, PartItem, CompanySettings, ServiceLog } from '@/src/types';

const snap: StoreSnapshot = {
  transactions: [
    {
      id: 'tx-1',
      date: '2026-01-01T00:00:00Z',
      streamType: 'company',
      transactionType: 'boss_advance_received',
      party: { role: 'boss', name: 'رئیس', phone: '0912' },
      totalAmount: 1_000_000,
      paidAmount: 1_000_000,
      remainingDebt: 0,
      financialImpact: { targetBalance: 'boss_balance', userBalanceChange: -1_000_000 },
      paymentMethod: 'card_to_card',
      category: 'مساعدة',
      description: 'تست',
      conversationalSummary: 'تست',
      source: 'manual',
      settled: true,
    } as Transaction,
  ],
  clients: [
    {
      id: 'c1',
      name: 'آقای احمدی',
      phone: '09123456789',
      address: 'تهران',
      deviceModel: 'سافت‌واتر ۶ مرحله',
      totalPaid: 500_000,
      totalDebt: 250_000,
      lastServiceDate: '2026-01-01T00:00:00Z',
      nextServiceDueDate: '2026-07-01T00:00:00Z',
      notes: '',
    } as Client,
  ],
  parts: [
    {
      id: 'p1',
      name: 'پک فیلتر ۱۲۳',
      code: 'FL-123',
      unit: 'پک',
      stock: 14,
      purchasePrice: 220_000,
      sellPrice: 380_000,
      category: 'filter',
    } as PartItem,
    {
      id: 'p2',
      name: 'ممبران ۷۵ گالن',
      code: 'MB-75G',
      unit: 'عدد',
      stock: 1,
      purchasePrice: 650_000,
      sellPrice: 950_000,
      category: 'membrane',
      lowStockThreshold: 3,
    } as PartItem,
  ],
  settings: {
    companyName: 'تصفیه آب زلال',
    bossName: 'مهندس جلالی',
    bossPhone: '09121234567',
    technicianName: 'تکنسین',
    companyLogo: '',
    monthlyBaseSalary: 24_000_000,
    salaryPaymentDay: 25,
    overtimeHourlyRate: 140_000,
    insuranceDeduction: 1_200_000,
    autoAccrueSalary: true,
  } as CompanySettings,
  serviceLogs: [],
} as StoreSnapshot;

describe('tool registry', () => {
  it('lists all tool names', () => {
    const names = listToolNames();
    expect(names).toContain('recordBossAdvance');
    expect(names).toContain('getBossBalance');
    expect(names).toContain('checkStockLevel');
    expect(names).toContain('createCustomerProfile');
    expect(names.length).toBeGreaterThan(0);
  });

  it('returns definition for known tool', () => {
    const def = getToolDefinition('getBossBalance');
    expect(def).toBeDefined();
    expect(def?.name).toBe('getBossBalance');
    expect(def?.requiresConfirmation).toBe(false);
  });

  it('returns undefined for unknown tool', () => {
    expect(getToolDefinition('nonexistentTool')).toBeUndefined();
  });
});

describe('handleCheckStockLevel', () => {
  it('returns current stock for existing part', async () => {
    const result = await handleCheckStockLevel(
      { itemName: 'پک فیلتر ۱۲۳' },
      {},
      snap,
    );
    expect(result.status).toBe('ok');
    expect(result.summary).toContain('14');
    expect(result.data).toMatchObject({ part: { id: 'p1' } });
  });

  it('returns error for unknown part', async () => {
    const result = await handleCheckStockLevel(
      { itemName: 'ناموجود' },
      {},
      snap,
    );
    expect(result.status).toBe('error');
    expect(result.error).toBe('part_not_found');
  });

  it('flags low stock part', async () => {
    const result = await handleCheckStockLevel(
      { itemName: 'ممبران ۷۵ گالن' },
      {},
      snap,
    );
    expect(result.status).toBe('ok');
    expect(result.summary).toContain('سطح پایین');
  });
});

describe('handleGetBossBalance', () => {
  it('returns boss balance summary', async () => {
    const result = await handleGetBossBalance({}, {}, snap);
    expect(result.status).toBe('ok');
    expect(result.summary).toContain('تراز شما از رئیس');
    expect(result.data).toHaveProperty('bossNetBalance');
    expect(result.data).toHaveProperty('bossStatus');
  });
});

describe('handleCreateCustomerProfile', () => {
  it('creates a new client', async () => {
    const result = await handleCreateCustomerProfile(
      { name: 'آقای مرادی', phone: '09120000000', address: 'اصفهان', deviceModel: 'فنر ۵ مرحله' },
      {},
      snap,
    );
    expect(result.status).toBe('ok');
    expect(result.preparedClient).toMatchObject({
      name: 'آقای مرادی',
      phone: '09120000000',
      address: 'اصفهان',
      deviceModel: 'فنر ۵ مرحله',
    });
  });

  it('rejects missing name', async () => {
    const result = await handleCreateCustomerProfile(
      { name: '' },
      {},
      snap,
    );
    expect(result.status).toBe('error');
    expect(result.error).toBe('invalid_input');
  });
});

describe('handleAppendCustomerNote', () => {
  it('adds note to existing client', async () => {
    const result = await handleAppendCustomerNote(
      { customerName: 'آقای احمدی', note: 'فشار ورودی ضعیف است' },
      {},
      snap,
    );
    expect(result.status).toBe('ok');
    expect(result.preparedClient).toMatchObject({
      name: 'آقای احمدی',
      notes: 'فشار ورودی ضعیف است',
    });
  });

  it('rejects unknown client', async () => {
    const result = await handleAppendCustomerNote(
      { customerName: 'ناموجود', note: 'تست' },
      {},
      snap,
    );
    expect(result.status).toBe('error');
    expect(result.error).toBe('client_not_found');
  });
});

describe('handleRestockPart', () => {
  it('increments stock for existing part', async () => {
    const result = await handleRestockPart(
      { partName: 'پک فیلتر ۱۲۳', quantity: '۵' },
      {},
      snap,
    );
    expect(result.status).toBe('ok');
    expect(result.preparedPart).toMatchObject({
      id: 'p1',
      stock: 19,
    });
  });

  it('rejects unknown part', async () => {
    const result = await handleRestockPart(
      { partName: 'ناموجود', quantity: '۱' },
      {},
      snap,
    );
    expect(result.status).toBe('error');
    expect(result.error).toBe('part_not_found');
  });

  it('rejects invalid quantity', async () => {
    const result = await handleRestockPart(
      { partName: 'پک فیلتر ۱۲۳', quantity: '۰' },
      {},
      snap,
    );
    expect(result.status).toBe('error');
  });
});

describe('handleRecordBossAdvance', () => {
  it('creates a boss advance transaction', async () => {
    const result = await handleRecordBossAdvance(
      { amount: '۵۰۰ هزار', date: '2026-01-15T00:00:00Z' },
      { bossName: 'مهندس جلالی' },
      snap,
    );
    expect(result.status).toBe('ok');
    expect(result.preparedTransaction).toMatchObject({
      transactionType: 'boss_advance_received',
      totalAmount: 500_000,
      paidAmount: 500_000,
    });
    expect(result.summary).toContain('۵۰۰٬۰۰۰');
  });
});
