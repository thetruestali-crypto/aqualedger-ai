// Client-side AI tool orchestration: call /api/ai-tool-call, handle
// two-phase confirmation, and return results for store dispatch.
import { z } from 'zod';
import type { toolCallRequestSchema, toolResultSchema } from '../types/schemas';

type ToolCallRequest = z.infer<typeof toolCallRequestSchema>;
type ToolResult = z.infer<typeof toolResultSchema>;

const API_BASE = import.meta.env.VITE_API_BASE || '';

/** Send text to the AI tool endpoint. Returns the parsed tool result. */
export async function callAiTool(
  text: string,
  context?: { bossName?: string; companyName?: string; typicalAmount?: number },
  storeSnapshot?: Record<string, unknown>,
): Promise<ToolResult> {
  const body: ToolCallRequest = { text };
  if (context) body.context = context;
  if (storeSnapshot) body.storeSnapshot = storeSnapshot as any;
  const res = await fetch(`${API_BASE}/api/ai-tool-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'خطای نامعتبر از سرور' }));
    return { status: 'error', toolCall: { name: '', arguments: {} }, summary: '', error: err.error || 'خطا در ارتباط با سرور' };
  }
  return (await res.json()) as ToolResult;
}

/** Execute a confirmed tool call (second phase of confirmation). */
export async function executeAiTool(
  toolCall: { name: string; arguments: Record<string, unknown> },
  confirmed: boolean,
  context?: { bossName?: string; companyName?: string; typicalAmount?: number },
  storeSnapshot?: Record<string, unknown>,
): Promise<ToolResult> {
  const body: ToolCallRequest = { toolCall, confirmed, text: '' };
  if (context) body.context = context;
  if (storeSnapshot) body.storeSnapshot = storeSnapshot as any;
  const res = await fetch(`${API_BASE}/api/ai-tool-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'خطای نامعتبر از سرور' }));
    return { status: 'error', toolCall, summary: '', error: err.error || 'خطا در انجام عملیات' };
  }
  return (await res.json()) as ToolResult;
}

/** List available tool names (for UI hints). */
export function listAvailableTools(): string[] {
  return [
    'recordBossAdvance',
    'recordSalaryPayout',
    'recordCompanyExpense',
    'recordCustomerPayment',
    'settleClientInvoice',
    'createCustomerProfile',
    'appendCustomerNote',
    'restockPart',
    'deductStock',
    'checkStockLevel',
    'getFinancialReport',
    'getBossBalance',
    'scheduleServiceReminder',
  ];
}
