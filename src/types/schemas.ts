// Zod schemas: single source of truth for runtime validation (server requests,
// Gemini structured output). Mirrors src/types/index.ts.
import { z } from 'zod';

export const streamTypeSchema = z.enum(['company', 'field']);

export const transactionTypeSchema = z.enum([
  'company_expense_out_of_pocket',
  'boss_advance_received',
  'salary_accrual',
  'salary_payout',
  'client_payment_received',
  'client_receivable',
  'client_part_cost',
  'technician_tool_expense',
  'other',
]);

export const paymentMethodSchema = z.enum(['cash', 'card_to_card', 'credit', 'pos', 'cheque']);

export const partyRoleSchema = z.enum(['boss', 'client', 'self']);

export const transactionPartySchema = z.object({
  role: partyRoleSchema,
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
});

export const financialImpactSchema = z.object({
  targetBalance: z.enum(['boss_balance', 'client_receivable', 'personal_cash']),
  userBalanceChange: z.number().int(),
  profitAmount: z.number().int().optional(),
});

export const transactionItemSchema = z.object({
  itemName: z.string().min(1).max(300),
  quantity: z.number().positive().optional(),
  purchasePrice: z.number().int().nonnegative().optional(),
  sellPrice: z.number().int().nonnegative().optional(),
});

export const aiAnalysisResultSchema = z.object({
  success: z.boolean(),
  streamType: streamTypeSchema,
  transactionType: transactionTypeSchema,
  party: transactionPartySchema,
  totalAmount: z.number().int().nonnegative(),
  paidAmount: z.number().int().nonnegative(),
  remainingDebt: z.number().int().nonnegative(),
  financialImpact: financialImpactSchema,
  paymentMethod: paymentMethodSchema,
  category: z.string().max(200),
  items: z.array(transactionItemSchema).optional(),
  suggestNextServiceMonths: z.number().int().positive().max(60).optional(),
  description: z.string().max(2000),
  conversationalSummary: z.string().max(1000),
  confidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string().max(300)).optional(),
});

export type AIAnalysisResultValidated = z.infer<typeof aiAnalysisResultSchema>;

// --- Stored-entity schemas (backup validation, Dexie writes) ---

export const transactionSchema = z.object({
  id: z.string().min(1).max(100),
  date: z.string().datetime({ offset: true }).or(z.string().min(1)),
  jalaliDate: z.string().max(50).optional(),
  streamType: streamTypeSchema,
  transactionType: transactionTypeSchema,
  party: transactionPartySchema,
  totalAmount: z.number().int().nonnegative(),
  paidAmount: z.number().int().nonnegative(),
  remainingDebt: z.number().int().nonnegative(),
  financialImpact: financialImpactSchema,
  paymentMethod: paymentMethodSchema,
  category: z.string().max(200),
  items: z.array(transactionItemSchema).optional(),
  suggestNextServiceMonths: z.number().int().positive().max(60).optional(),
  description: z.string().max(2000),
  conversationalSummary: z.string().max(1000),
  source: z.enum(['ai_voice', 'ai_text', 'manual']),
  settled: z.boolean().default(false),
});

export const clientSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  phone: z.string().max(30),
  address: z.string().max(500),
  deviceModel: z.string().max(300),
  totalPaid: z.number().int().nonnegative(),
  totalDebt: z.number().int().nonnegative(),
  lastServiceDate: z.string().min(1).max(100),
  nextServiceDueDate: z.string().min(1).max(100),
  notes: z.string().max(2000).optional(),
});

export const partSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  code: z.string().max(50),
  unit: z.string().max(50),
  stock: z.number().int().nonnegative(),
  purchasePrice: z.number().int().nonnegative(),
  sellPrice: z.number().int().nonnegative(),
  category: z.enum(['filter', 'membrane', 'pump', 'switch', 'housing', 'fitting', 'tool']),
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export const serviceLogItemSchema = z.object({
  partId: z.string().max(100).optional(),
  name: z.string().min(1).max(300),
  qty: z.number().int().positive(),
  sellPrice: z.number().int().nonnegative(),
  buyPrice: z.number().int().nonnegative(),
});

export const serviceLogSchema = z.object({
  id: z.string().min(1).max(100),
  clientId: z.string().min(1).max(100),
  date: z.string().min(1).max(100),
  items: z.array(serviceLogItemSchema),
  laborFee: z.number().int().nonnegative(),
  nextServiceDueDate: z.string().min(1).max(100),
  notes: z.string().max(2000).optional(),
});

export const settingsSchema = z.object({
  companyName: z.string().max(200),
  bossName: z.string().max(200),
  bossPhone: z.string().max(30),
  monthlyBaseSalary: z.number().int().nonnegative(),
  salaryPaymentDay: z.number().int().min(1).max(31),
  overtimeHourlyRate: z.number().int().nonnegative(),
  insuranceDeduction: z.number().int().nonnegative(),
  autoAccrueSalary: z.boolean(),
  overtimeHours: z.number().nonnegative().optional(),
  absenceDays: z.number().nonnegative().optional(),
  absenceDailyRate: z.number().int().nonnegative().optional(),
  commissionPct: z.number().min(0).max(100).optional(),
});

export const backupPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().min(1),
  transactions: z.array(transactionSchema),
  clients: z.array(clientSchema),
  parts: z.array(partSchema),
  serviceLogs: z.array(serviceLogSchema),
  settings: settingsSchema,
});

export type BackupPayloadValidated = z.infer<typeof backupPayloadSchema>;

// --- Request schemas ---

export const analyzeTransactionRequestSchema = z.object({
  text: z.string().trim().min(1, 'متن ورودی الزامی است.').max(2000),
  context: z
    .object({
      bossName: z.string().max(200).optional(),
      companyName: z.string().max(200).optional(),
    })
    .optional(),
});

export const analyzeAudioRequestSchema = z.object({
  // Base64-encoded audio (MediaRecorder, e.g. audio/webm). 10MB body cap enforced by Express.
  audioBase64: z.string().min(100).max(14_000_000),
  mimeType: z.string().max(100).default('audio/webm'),
  context: z
    .object({
      bossName: z.string().max(200).optional(),
      companyName: z.string().max(200).optional(),
    })
    .optional(),
});
