// AI tool registry: maps tool name -> zod schema -> handler.
// Handlers are pure / server-executable and return prepared domain objects
// or computed data. The client applies state changes via its own store.
import { z } from 'zod';
import type {
  Transaction,
  CompanySettings,
  Client,
  PartItem,
  ServiceLog,
  TransactionType,
  StreamType,
  PaymentMethod,
} from '../src/types';
import { normalizeTransaction } from '../src/data/repository';
import {
  computeFinancialSummary,
  computeBaseSalaryAccrued,
} from '../src/domain/financialEngine';
import { buildReport } from '../src/domain/reports';
import { getLowStockParts } from '../src/domain/inventory';
import { suggestNextServiceMonths, addMonthsISO } from '../src/domain/reminders';
import { splitTransactionItems } from '../src/domain/profit';
import { parsePersianAmount, extractTomanAmounts } from '../src/lib/persianNumbers';
import { toJalaliDate } from '../src/lib/format';

export interface StoreSnapshot {
  transactions: Transaction[];
  clients: Client[];
  parts: PartItem[];
  settings: CompanySettings;
  serviceLogs: ServiceLog[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  requiresConfirmation: boolean;
  handler: (
    args: Record<string, unknown>,
    context: ToolContext,
    snap: StoreSnapshot
  ) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  status: 'ok' | 'pending_confirmation' | 'error';
  toolCall: { name: string; arguments: Record<string, unknown> };
  summary: string;
  data?: unknown;
  error?: string;
  // Prepared domain object for client-side store dispatch (writes only).
  preparedTransaction?: Transaction;
  preparedClient?: Client;
  preparedPart?: PartItem;
  preparedServiceLog?: ServiceLog;
  warnings?: string[];
}

interface ToolContext {
  bossName?: string;
  companyName?: string;
  typicalAmount?: number;
}

function nowISO(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function moneyFromArg(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') {
    const amounts = extractTomanAmounts(value);
    if (amounts.length > 0) return amounts[0].value;
    // Normalize Persian/Arabic digits before parseFloat.
    const normalized = value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const n = parseFloat(normalized);
    if (!Number.isNaN(n)) return n < 1000 ? Math.round(n * 1000) : Math.round(n);
  }
  return fallback;
}

function findClientByName(clients: Client[], name: string): Client | undefined {
  const needle = name.trim().toLowerCase();
  return clients.find(
    (c) =>
      c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase())
  );
}

function findPartByName(parts: PartItem[], name: string): PartItem | undefined {
  const needle = name.trim().toLowerCase();
  return parts.find(
    (p) =>
      p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase()) ||
      p.code.toLowerCase() === needle
  );
}

// ---------------------------------------------------------------------------
// Tool: recordBossAdvance
// ---------------------------------------------------------------------------

const recordBossAdvanceSchema = z.object({
  amount: z.string().describe('مبلغ مساعده یا علی‌الحساب به تومان (مثل "۵۰۰ هزار")'),
  date: z.string().optional().describe('تاریخ (ISO)، پیش‌فرض امروز'),
  description: z.string().optional(),
});

async function handleRecordBossAdvance(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = recordBossAdvanceSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'recordBossAdvance', arguments: args },
      summary: 'مبلغ معتبر تشخیص داده نشد.',
      error: 'invalid_amount',
    };
  }
  const amount = moneyFromArg(parsed.data.amount);
  if (amount <= 0) {
    return {
      status: 'error',
      toolCall: { name: 'recordBossAdvance', arguments: args },
      summary: 'مبلغ باید بیش از صفر باشد.',
      error: 'invalid_amount',
    };
  }
  const date = (parsed.data.date as string | undefined) || nowISO();
  const bossName = ctx.bossName || 'رئیس / شرکت';
  const tx: Transaction = normalizeTransaction({
    id: generateId('tx'),
    date,
    jalaliDate: toJalaliDate(date),
    streamType: 'company',
    transactionType: 'boss_advance_received',
    party: { role: 'boss', name: bossName, phone: ctx.bossName ? undefined : undefined },
    totalAmount: amount,
    paidAmount: amount,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'boss_balance',
      userBalanceChange: -amount,
    },
    paymentMethod: 'card_to_card',
    category: 'مساعده',
    description:
      parsed.data.description || `دریافت ${amount.toLocaleString('fa-IR')} تومانی مساعده از ${bossName}`,
    conversationalSummary: `دریافت ${amount.toLocaleString('fa-IR')} تومانی مساعده از ${bossName} ثبت شد (از طلب شما کسر گردید).`,
    source: 'ai_voice',
    settled: true,
  });
  return {
    status: 'ok',
    toolCall: { name: 'recordBossAdvance', arguments: args },
    preparedTransaction: tx,
    summary: tx.conversationalSummary,
  };
}

// ---------------------------------------------------------------------------
// Tool: recordSalaryPayout
// ---------------------------------------------------------------------------

const recordSalaryPayoutSchema = z.object({
  amount: z.string().describe('مبلغ واریز حقوق به تومان'),
  date: z.string().optional(),
  description: z.string().optional(),
});

async function handleRecordSalaryPayout(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = recordSalaryPayoutSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'recordSalaryPayout', arguments: args },
      summary: 'مبلغ معتبر تشخیص داده نشد.',
      error: 'invalid_amount',
    };
  }
  const amount = moneyFromArg(parsed.data.amount);
  if (amount <= 0) {
    return {
      status: 'error',
      toolCall: { name: 'recordSalaryPayout', arguments: args },
      summary: 'مبلغ باید بیش از صفر باشد.',
      error: 'invalid_amount',
    };
  }
  const date = (parsed.data.date as string | undefined) || nowISO();
  const bossName = ctx.bossName || 'رئیس / شرکت';
  const tx: Transaction = normalizeTransaction({
    id: generateId('tx'),
    date,
    jalaliDate: toJalaliDate(date),
    streamType: 'company',
    transactionType: 'salary_payout',
    party: { role: 'boss', name: bossName },
    totalAmount: amount,
    paidAmount: amount,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'boss_balance',
      userBalanceChange: -amount,
    },
    paymentMethod: 'card_to_card',
    category: 'واریز حقوق',
    description: parsed.data.description || `واریز حقوق ${amount.toLocaleString('fa-IR')} تومانی`,
    conversationalSummary: `واریز حقوق ${amount.toLocaleString('fa-IR')} تومانی توسط ${bossName} ثبت شد.`,
    source: 'ai_voice',
    settled: true,
  });
  return {
    status: 'ok',
    toolCall: { name: 'recordSalaryPayout', arguments: args },
    preparedTransaction: tx,
    summary: tx.conversationalSummary,
  };
}

// ---------------------------------------------------------------------------
// Tool: recordCompanyExpense
// ---------------------------------------------------------------------------

const recordCompanyExpenseSchema = z.object({
  amount: z.string().describe('مبلغ خرید از جیب برای شرکت به تومان'),
  item: z.string().optional().describe('نام کالا یا خدمت'),
  date: z.string().optional(),
  description: z.string().optional(),
});

async function handleRecordCompanyExpense(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = recordCompanyExpenseSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'recordCompanyExpense', arguments: args },
      summary: 'مبلغ معتبر تشخیص داده نشد.',
      error: 'invalid_amount',
    };
  }
  const amount = moneyFromArg(parsed.data.amount);
  if (amount <= 0) {
    return {
      status: 'error',
      toolCall: { name: 'recordCompanyExpense', arguments: args },
      summary: 'مبلغ باید بیش از صفر باشد.',
      error: 'invalid_amount',
    };
  }
  const date = (parsed.data.date as string | undefined) || nowISO();
  const bossName = ctx.bossName || 'رئیس / شرکت';
  const tx: Transaction = normalizeTransaction({
    id: generateId('tx'),
    date,
    jalaliDate: toJalaliDate(date),
    streamType: 'company',
    transactionType: 'company_expense_out_of_pocket',
    party: { role: 'boss', name: bossName },
    totalAmount: amount,
    paidAmount: amount,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'boss_balance',
      userBalanceChange: amount,
    },
    paymentMethod: 'cash',
    category: 'خرید تنخواه',
    items: parsed.data.item ? [{ itemName: parsed.data.item as string, quantity: 1, purchasePrice: amount }] : undefined,
    description: parsed.data.description || `خرید ${amount.toLocaleString('fa-IR')} تومانی از جیب برای شرکت`,
    conversationalSummary: `خرید ${amount.toLocaleString('fa-IR')} تومانی از جیب برای شرکت ثبت شد (به طلب شما از رئیس اضافه شد).`,
    source: 'ai_voice',
    settled: true,
  });
  return {
    status: 'ok',
    toolCall: { name: 'recordCompanyExpense', arguments: args },
    preparedTransaction: tx,
    summary: tx.conversationalSummary,
  };
}

// ---------------------------------------------------------------------------
// Tool: recordCustomerPayment
// ---------------------------------------------------------------------------

const recordCustomerPaymentSchema = z.object({
  customerName: z.string().describe('نام مشتری'),
  cashAmount: z.string().optional().describe('مبلغ نقد به تومان'),
  posAmount: z.string().optional().describe('مبلغ پایس/کارت به کارت به تومان'),
  reason: z.string().optional().describe('دلیل یا توضیحات خدمات'),
  date: z.string().optional(),
});

async function handleRecordCustomerPayment(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = recordCustomerPaymentSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'recordCustomerPayment', arguments: args },
      summary: 'اطلاعات مشتری یا مبلغ معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const customerName = (parsed.data.customerName as string) || 'مشتری نامشخص';
  const cash = moneyFromArg(parsed.data.cashAmount, 0);
  const pos = moneyFromArg(parsed.data.posAmount, 0);
  const total = cash + pos;
  if (total <= 0) {
    return {
      status: 'error',
      toolCall: { name: 'recordCustomerPayment', arguments: args },
      summary: 'مبلغ کل باید بیش از صفر باشد.',
      error: 'invalid_amount',
    };
  }
  const date = (parsed.data.date as string | undefined) || nowISO();
  const paymentMethod: PaymentMethod = pos > 0 && cash > 0 ? 'card_to_card' : pos > 0 ? 'pos' : 'cash';
  const tx: Transaction = normalizeTransaction({
    id: generateId('tx'),
    date,
    jalaliDate: toJalaliDate(date),
    streamType: 'field',
    transactionType: 'client_payment_received',
    party: { role: 'client', name: customerName },
    totalAmount: total,
    paidAmount: total,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'personal_cash',
      userBalanceChange: 0,
    },
    paymentMethod,
    category: parsed.data.reason ? (parsed.data.reason as string) : 'سرویس مشتری',
    description: parsed.data.reason
      ? `دریافت ${total.toLocaleString('fa-IR')} تومانی از ${customerName} بابت ${parsed.data.reason}`
      : `دریافت ${total.toLocaleString('fa-IR')} تومانی از ${customerName}`,
    conversationalSummary: `دریافت ${total.toLocaleString('fa-IR')} تومانی از ${customerName} ثبت شد.`,
    source: 'ai_voice',
    settled: true,
  });
  const client: Client = {
    id: generateId('client'),
    name: customerName,
    phone: '',
    address: '',
    deviceModel: 'دستگاه تصفیه آب خانگی',
    totalPaid: total,
    totalDebt: 0,
    lastServiceDate: date,
    nextServiceDueDate: addMonthsISO(date, 6),
    notes: parsed.data.reason ? (parsed.data.reason as string) : undefined,
  };
  return {
    status: 'ok',
    toolCall: { name: 'recordCustomerPayment', arguments: args },
    preparedTransaction: tx,
    preparedClient: client,
    summary: tx.conversationalSummary,
  };
}

// ---------------------------------------------------------------------------
// Tool: settleClientInvoice
// ---------------------------------------------------------------------------

const settleClientInvoiceSchema = z.object({
  customerName: z.string().describe('نام مشتری'),
  amount: z.string().describe('مبلغ تسویه به تومان'),
  date: z.string().optional(),
});

async function handleSettleClientInvoice(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = settleClientInvoiceSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'settleClientInvoice', arguments: args },
      summary: 'نام مشتری یا مبلغ معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const customerName = (parsed.data.customerName as string) || '';
  const amount = moneyFromArg(parsed.data.amount);
  if (!customerName || amount <= 0) {
    return {
      status: 'error',
      toolCall: { name: 'recordCustomerPayment', arguments: args },
      summary: 'نام مشتری و مبلغ معتبر باید باشند.',
      error: 'invalid_input',
    };
  }
  const client = findClientByName(snap.clients, customerName);
  if (!client) {
    return {
      status: 'error',
      toolCall: { name: 'settleClientInvoice', arguments: args },
      summary: `مشتری «${customerName}» یافت نشد.`,
      error: 'client_not_found',
    };
  }
  const date = (parsed.data.date as string | undefined) || nowISO();
  const tx: Transaction = normalizeTransaction({
    id: generateId('tx'),
    date,
    jalaliDate: toJalaliDate(date),
    streamType: 'field',
    transactionType: 'client_payment_received',
    party: { role: 'client', name: client.name, phone: client.phone },
    totalAmount: amount,
    paidAmount: amount,
    remainingDebt: 0,
    financialImpact: { targetBalance: 'personal_cash', userBalanceChange: 0 },
    paymentMethod: 'card_to_card',
    category: 'تسویه بدهی معوق',
    description: `تسویه مبلغ بدهی توسط ${client.name}`,
    conversationalSummary: `تسویه ${amount.toLocaleString('fa-IR')} تومان بابت بدهی ${client.name} ثبت شد.`,
    source: 'ai_voice',
    settled: true,
  });
  return {
    status: 'ok',
    toolCall: { name: 'settleClientInvoice', arguments: args },
    preparedTransaction: tx,
    summary: tx.conversationalSummary,
  };
}

// ---------------------------------------------------------------------------
// Tool: createCustomerProfile
// ---------------------------------------------------------------------------

const createCustomerProfileSchema = z.object({
  name: z.string().describe('نام مشتری'),
  phone: z.string().optional().describe('شماره تماس'),
  address: z.string().optional().describe('آدرس'),
  deviceModel: z.string().optional().describe('مدل دستگاه'),
});

async function handleCreateCustomerProfile(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = createCustomerProfileSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'createCustomerProfile', arguments: args },
      summary: 'نام مشتری الزامی است.',
      error: 'invalid_input',
    };
  }
  const name = (parsed.data.name as string) || '';
  if (!name) {
    return {
      status: 'error',
      toolCall: { name: 'createCustomerProfile', arguments: args },
      summary: 'نام مشتری الزامی است.',
      error: 'invalid_input',
    };
  }
  const date = nowISO();
  const client: Client = {
    id: generateId('client'),
    name,
    phone: (parsed.data.phone as string) || '',
    address: (parsed.data.address as string) || '',
    deviceModel: (parsed.data.deviceModel as string) || 'دستگاه تصفیه آب خانگی',
    totalPaid: 0,
    totalDebt: 0,
    lastServiceDate: date,
    nextServiceDueDate: addMonthsISO(date, 6),
    notes: undefined,
  };
  return {
    status: 'ok',
    toolCall: { name: 'createCustomerProfile', arguments: args },
    preparedClient: client,
    summary: `پرونده مشتری «${name}» با شماره ${client.phone || 'بدون شماره'} ثبت شد.`,
  };
}

// ---------------------------------------------------------------------------
// Tool: appendCustomerNote
// ---------------------------------------------------------------------------

const appendCustomerNoteSchema = z.object({
  customerName: z.string().describe('نام مشتری'),
  note: z.string().describe('متن یادداشت'),
});

async function handleAppendCustomerNote(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = appendCustomerNoteSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'appendCustomerNote', arguments: args },
      summary: 'متن یادداشت یا نام مشتری معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const customerName = (parsed.data.customerName as string) || '';
  const note = (parsed.data.note as string) || '';
  if (!customerName || !note) {
    return {
      status: 'error',
      toolCall: { name: 'appendCustomerNote', arguments: args },
      summary: 'نام مشتری و متن یادداشت الزامی است.',
      error: 'invalid_input',
    };
  }
  const client = findClientByName(snap.clients, customerName);
  if (!client) {
    return {
      status: 'error',
      toolCall: { name: 'appendCustomerNote', arguments: args },
      summary: `مشتری «${customerName}» یافت نشد.`,
      error: 'client_not_found',
    };
  }
  const updated: Client = { ...client, notes: note };
  return {
    status: 'ok',
    toolCall: { name: 'appendCustomerNote', arguments: args },
    preparedClient: updated,
    summary: `یادداشت برای «${customerName}» ثبت شد: ${note}`,
  };
}

// ---------------------------------------------------------------------------
// Tool: restockPart
// ---------------------------------------------------------------------------

const restockPartSchema = z.object({
  partName: z.string().describe('نام قطعه یا کد آن'),
  quantity: z.string().describe('تعداد اضافه‌شده به انبار'),
  purchasePrice: z.string().optional().describe('قیمت خرید هر عدد به تومان'),
  sellPrice: z.string().optional().describe('قیمت فروش هر عدد به تومان'),
  category: z.string().optional().describe('دسته‌بندی'),
});

async function handleRestockPart(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = restockPartSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'restockPart', arguments: args },
      summary: 'نام قطعه یا تعداد معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const partName = (parsed.data.partName as string) || '';
  const quantityRaw = (parsed.data.quantity as string) || '';
  const quantity = moneyFromArg(quantityRaw, 0);
  if (!partName || quantity <= 0) {
    return {
      status: 'error',
      toolCall: { name: 'restockPart', arguments: args },
      summary: 'نام قطعه و تعداد معتبر باید باشند.',
      error: 'invalid_input',
    };
  }
  const existing = findPartByName(snap.parts, partName);
  if (!existing) {
    return {
      status: 'error',
      toolCall: { name: 'restockPart', arguments: args },
      summary: `قطعه «${partName}» در انبار یافت نشد. ابتدا قطعه را ثبت کنید.`,
      error: 'part_not_found',
    };
  }
  const purchasePrice = moneyFromArg(parsed.data.purchasePrice, existing.purchasePrice);
  const sellPrice = moneyFromArg(parsed.data.sellPrice, existing.sellPrice);
  const part: PartItem = {
    ...existing,
    stock: existing.stock + quantity,
    purchasePrice,
    sellPrice,
  };
  return {
    status: 'ok',
    toolCall: { name: 'restockPart', arguments: args },
    preparedPart: part,
    summary: `${quantity} عدد «${existing.name}» به انبار اضافه شد. موجودی جدید: ${part.stock} عدد.`,
  };
}

// ---------------------------------------------------------------------------
// Tool: deductStock
// ---------------------------------------------------------------------------

const deductStockSchema = z.object({
  jobLocation: z.string().optional().describe('مکان پروژه یا مشتری'),
  items: z
    .array(
      z.object({
        partName: z.string(),
        quantity: z.string(),
      })
    )
    .describe('لیست قطعات و تعداد مصرف‌شده'),
});

async function handleDeductStock(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = deductStockSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'deductStock', arguments: args },
      summary: 'لیست قطعات معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const items = (parsed.data.items as Array<{ partName: string; quantity: string }>) || [];
  if (items.length === 0) {
    return {
      status: 'error',
      toolCall: { name: 'deductStock', arguments: args },
      summary: 'هیچ قطعه‌ای برای کسر مشخص نشده است.',
      error: 'invalid_input',
    };
  }
  const lines = items.map((it) => ({
    name: it.partName,
    qty: moneyFromArg(it.quantity, 0),
  }));
  const plan = await import('../src/domain/inventory').then((m) =>
    m.planStockDecrement(snap.parts, lines)
  );
  if (!plan.ok) {
    return {
      status: 'error',
      toolCall: { name: 'deductStock', arguments: args },
      summary: plan.errors.join('؛ '),
      error: 'insufficient_stock',
    };
  }
  return {
    status: 'ok',
    toolCall: { name: 'deductStock', arguments: args },
    data: { parts: plan.parts, results: plan.results },
    summary: `کسر موجودی برای ${plan.results.length} قطعه در ${ctx.companyName || 'انبار'} انجام شد.`,
  };
}

// ---------------------------------------------------------------------------
// Tool: checkStockLevel
// ---------------------------------------------------------------------------

const checkStockLevelSchema = z.object({
  itemName: z.string().describe('نام قطعه'),
});

async function handleCheckStockLevel(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = checkStockLevelSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'checkStockLevel', arguments: args },
      summary: 'نام قطعه معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const itemName = (parsed.data.itemName as string) || '';
  const part = findPartByName(snap.parts, itemName);
  if (!part) {
    return {
      status: 'error',
      toolCall: { name: 'checkStockLevel', arguments: args },
      summary: `قطعه «${itemName}» در انبار یافت نشد.`,
      error: 'part_not_found',
    };
  }
  const low = part.stock <= (part.lowStockThreshold ?? 3);
  return {
    status: 'ok',
    toolCall: { name: 'checkStockLevel', arguments: args },
    data: { part },
    summary: low
      ? `در حال حاضر ${part.stock} عدد «${part.name}» در انبار دارید (سطح پایین، نیاز به سفارش).`
      : `در حال حاضر ${part.stock} عدد «${part.name}» در انبار دارید.`,
  };
}

// ---------------------------------------------------------------------------
// Tool: getFinancialReport
// ---------------------------------------------------------------------------

const getFinancialReportSchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().describe('دوره: روزانه، هفتگی، ماهانه'),
  count: z.number().int().min(1).max(24).optional().describe('تعداد دوره‌ها'),
});

async function handleGetFinancialReport(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = getFinancialReportSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'getFinancialReport', arguments: args },
      summary: 'دوره گزارش معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const period = (parsed.data.period as 'day' | 'week' | 'month') || 'month';
  const count = (parsed.data.count as number) || 6;
  const now = nowISO();
  const report = buildReport(snap.transactions, period, now, count);
  const summary = `
دوره ${report.period}: کل یکत्रه ${report.txCount} تراکنش.
ورود شرکت: ${report.companyIn.toLocaleString('fa-IR')} تومان
خروج شرکت: ${report.companyOut.toLocaleString('fa-IR')} تومان
ورود میدانی: ${report.fieldIn.toLocaleString('fa-IR')} تومان
هزینه قطعات: ${report.partsCost.toLocaleString('fa-IR')} تومان
سود قطعات: ${report.partProfit.toLocaleString('fa-IR')} تومان
مزد فنی: ${report.labor.toLocaleString('fa-IR')} تومان
خروجی خالص: ${report.net.toLocaleString('fa-IR')} تومان
`.trim();
  return {
    status: 'ok',
    toolCall: { name: 'getFinancialReport', arguments: args },
    data: report,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Tool: getBossBalance
// ---------------------------------------------------------------------------

const getBossBalanceSchema = z.object({});

async function handleGetBossBalance(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const summary = computeFinancialSummary(snap.transactions, snap.settings, snap.clients);
  const statusLabel =
    summary.bossStatus === 'creditor'
      ? 'بدهکار شما (درخواستدار)'
      : summary.bossStatus === 'debtor'
        ? 'بدهکار به رئیس'
        : 'تسویه‌شده';
  return {
    status: 'ok',
    toolCall: { name: 'getBossBalance', arguments: args },
    data: summary,
    summary: `تراز شما از رئیس: ${summary.bossNetBalance.toLocaleString('fa-IR')} تومان (${statusLabel}).`,
  };
}

// ---------------------------------------------------------------------------
// Tool: scheduleServiceReminder
// ---------------------------------------------------------------------------

const scheduleServiceReminderSchema = z.object({
  customerName: z.string().describe('نام مشتری'),
  serviceType: z.string().describe('نوع سرویس (مثل تعویض فیلتر)'),
  intervalMonths: z.number().int().min(1).max(60).optional().describe('فاصله به ماه'),
});

async function handleScheduleServiceReminder(
  args: Record<string, unknown>,
  ctx: ToolContext,
  snap: StoreSnapshot
): Promise<ToolExecutionResult> {
  const parsed = scheduleServiceReminderSchema.safeParse(args);
  if (!parsed.success) {
    return {
      status: 'error',
      toolCall: { name: 'scheduleServiceReminder', arguments: args },
      summary: 'نام مشتری یا نوع سرویس معتبر نیست.',
      error: 'invalid_input',
    };
  }
  const customerName = (parsed.data.customerName as string) || '';
  const serviceType = (parsed.data.serviceType as string) || '';
  const intervalMonths = (parsed.data.intervalMonths as number | undefined) || 6;
  if (!customerName || !serviceType) {
    return {
      status: 'error',
      toolCall: { name: 'scheduleServiceReminder', arguments: args },
      summary: 'نام مشتری و نوع سرویس الزامی است.',
      error: 'invalid_input',
    };
  }
  const client = findClientByName(snap.clients, customerName);
  const date = nowISO();
  const nextDue = addMonthsISO(date, intervalMonths);
  let preparedClient: Client | undefined;
  if (client) {
    preparedClient = { ...client, nextServiceDueDate: nextDue };
  } else {
    preparedClient = {
      id: generateId('client'),
      name: customerName,
      phone: '',
      address: '',
      deviceModel: 'دستگاه تصفیه آب خانگی',
      totalPaid: 0,
      totalDebt: 0,
      lastServiceDate: date,
      nextServiceDueDate: nextDue,
      notes: `یادآور: ${serviceType}`,
    };
  }
  return {
    status: 'ok',
    toolCall: { name: 'scheduleServiceReminder', arguments: args },
    preparedClient,
    summary: `یادآور «${serviceType}» برای «${customerName}» در ${toJalaliDate(nextDue)} ثبت شد.`,
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  recordBossAdvance: {
    name: 'recordBossAdvance',
    description: 'ثبت دریافت مساعده یا علی‌الحساب از رئیس/شرکت',
    inputSchema: recordBossAdvanceSchema,
    requiresConfirmation: true,
    handler: handleRecordBossAdvance,
  },
  recordSalaryPayout: {
    name: 'recordSalaryPayout',
    description: 'ثبت واریز حقوق توسط شرکت',
    inputSchema: recordSalaryPayoutSchema,
    requiresConfirmation: true,
    handler: handleRecordSalaryPayout,
  },
  recordCompanyExpense: {
    name: 'recordCompanyExpense',
    description: 'ثبت خرید از جیب برای شرکت/مغازه',
    inputSchema: recordCompanyExpenseSchema,
    requiresConfirmation: true,
    handler: handleRecordCompanyExpense,
  },
  recordCustomerPayment: {
    name: 'recordCustomerPayment',
    description: 'ثبت دریافت وجه نقد یا پایس از مشتری',
    inputSchema: recordCustomerPaymentSchema,
    requiresConfirmation: true,
    handler: handleRecordCustomerPayment,
  },
  settleClientInvoice: {
    name: 'settleClientInvoice',
    description: 'تسویه بدهی معوق یک مشتری',
    inputSchema: settleClientInvoiceSchema,
    requiresConfirmation: true,
    handler: handleSettleClientInvoice,
  },
  createCustomerProfile: {
    name: 'createCustomerProfile',
    description: 'ایجاد پرونده مشتری جدید',
    inputSchema: createCustomerProfileSchema,
    requiresConfirmation: true,
    handler: handleCreateCustomerProfile,
  },
  appendCustomerNote: {
    name: 'appendCustomerNote',
    description: 'افزودن یادداشت فنی به پرونده مشتری',
    inputSchema: appendCustomerNoteSchema,
    requiresConfirmation: false,
    handler: handleAppendCustomerNote,
  },
  restockPart: {
    name: 'restockPart',
    description: 'افزودن موجودی یک قطعه به انبار',
    inputSchema: restockPartSchema,
    requiresConfirmation: true,
    handler: handleRestockPart,
  },
  deductStock: {
    name: 'deductStock',
    description: 'کسر قطعات از انبار طی یک مأموریت',
    inputSchema: deductStockSchema,
    requiresConfirmation: true,
    handler: handleDeductStock,
  },
  checkStockLevel: {
    name: 'checkStockLevel',
    description: 'استعلام موجودی یک قطعه در انبار',
    inputSchema: checkStockLevelSchema,
    requiresConfirmation: false,
    handler: handleCheckStockLevel,
  },
  getFinancialReport: {
    name: 'getFinancialReport',
    description: 'گزارش finanzi دوره‌ای (روزانه/هفتگی/ماهانه)',
    inputSchema: getFinancialReportSchema,
    requiresConfirmation: false,
    handler: handleGetFinancialReport,
  },
  getBossBalance: {
    name: 'getBossBalance',
    description: 'نمایش تراز شما از رئیس/شرکت',
    inputSchema: getBossBalanceSchema,
    requiresConfirmation: false,
    handler: handleGetBossBalance,
  },
  scheduleServiceReminder: {
    name: 'scheduleServiceReminder',
    description: 'ثبت یادآور سرویس دوره‌ای برای مشتری',
    inputSchema: scheduleServiceReminderSchema,
    requiresConfirmation: true,
    handler: handleScheduleServiceReminder,
  },
};

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[name];
}

export function listToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

export {
  handleRecordBossAdvance,
  handleRecordSalaryPayout,
  handleRecordCompanyExpense,
  handleRecordCustomerPayment,
  handleSettleClientInvoice,
  handleCreateCustomerProfile,
  handleAppendCustomerNote,
  handleRestockPart,
  handleDeductStock,
  handleCheckStockLevel,
  handleGetFinancialReport,
  handleGetBossBalance,
  handleScheduleServiceReminder,
};
