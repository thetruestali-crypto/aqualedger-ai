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
