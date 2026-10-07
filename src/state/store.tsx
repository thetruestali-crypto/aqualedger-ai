// App state: Context + useReducer (replaces props-drilling in App.tsx).
// Derived summaries are memoized; persistence is debounced into IndexedDB.
// NOTE (Phase 1): scaffold only — wiring into <App/> happens in Phase 3.
import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { Transaction, CompanySettings, Client, PartItem } from '../types';
import { computeFinancialSummary, type FinancialSummary } from '../domain/financialEngine';

export interface AppState {
  transactions: Transaction[];
  settings: CompanySettings;
  clients: Client[];
  parts: PartItem[];
}

export type AppAction =
  | { type: 'ADD_TRANSACTION'; tx: Transaction }
  | { type: 'DELETE_TRANSACTION'; id: string }
  | { type: 'SAVE_SETTINGS'; settings: CompanySettings }
  | { type: 'ADD_CLIENT'; client: Client }
  | { type: 'UPDATE_CLIENT'; client: Client }
  | { type: 'ADD_PART'; part: PartItem }
  | { type: 'UPDATE_PART'; part: PartItem }
  | { type: 'DELETE_PART'; id: string }
  | { type: 'HYDRATE'; state: AppState };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_TRANSACTION':
      return { ...state, transactions: [action.tx, ...state.transactions] };
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
    case 'ADD_PART':
      return { ...state, parts: [action.part, ...state.parts] };
    case 'UPDATE_PART':
      return {
        ...state,
        parts: state.parts.map((p) => (p.id === action.part.id ? action.part : p)),
      };
    case 'DELETE_PART':
      return { ...state, parts: state.parts.filter((p) => p.id !== action.id) };
    case 'HYDRATE':
      return action.state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  summary: FinancialSummary;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function AppStoreProvider({
  initial,
  children,
}: {
  initial: AppState;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(appReducer, initial);
  const summary = useMemo(
    () => computeFinancialSummary(state.transactions, state.settings, state.clients),
    [state.transactions, state.settings, state.clients],
  );
  const value = useMemo(() => ({ state, dispatch, summary }), [state, dispatch, summary]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return ctx;
}
