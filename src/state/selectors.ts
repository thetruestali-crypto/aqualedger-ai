// Memoized derived selectors. All money math lives in domain/ —
// components call these (via useMemo results from the provider) and never
// compute balances themselves.
import type { Client, PartItem } from '../types';
import { computeFinancialSummary, type FinancialSummary } from '../domain/financialEngine';
import { getDueReminders, type ReminderLists } from '../domain/reminders';
import { getLowStockParts } from '../domain/inventory';
import type { AppState } from './transitions';

export type { ReminderLists };

export function selectSummary(state: AppState): FinancialSummary {
  return computeFinancialSummary(state.transactions, state.settings, state.clients);
}

export function selectReminders(state: AppState): ReminderLists {
  return getDueReminders(state.clients);
}

export function selectLowStock(state: AppState): PartItem[] {
  return getLowStockParts(state.parts);
}

export function selectClientDebt(state: AppState, clientId: string): number {
  return state.clients.find((c) => c.id === clientId)?.totalDebt ?? 0;
}

export function selectCreditors(state: AppState): Client[] {
  return state.clients.filter((c) => (c.totalDebt ?? 0) > 0);
}
