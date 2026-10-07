// App store: Context + useReducer over pure transitions (transitions.ts),
// memoized derived data (selectors.ts), async Dexie boot with one-time legacy
// migration (data/boot.ts), and debounced persistence back to the driver.
// UI components consume useAppStore() — no props drilling.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { BackupPayload } from '../data/db';
import type { LedgerStore } from '../data/repository';
import { bootStore } from '../data/boot';
import { applyAction, type AppAction, type AppState } from './transitions';
import {
  selectSummary,
  selectReminders,
  selectLowStock,
  type ReminderLists,
} from './selectors';
import type { FinancialSummary } from '../domain/financialEngine';
import type { PartItem } from '../types';

export const PERSIST_DEBOUNCE_MS = 500;

const EMPTY_STATE: AppState = {
  transactions: [],
  settings: {
    companyName: '',
    bossName: '',
    bossPhone: '',
    monthlyBaseSalary: 0,
    salaryPaymentDay: 25,
    overtimeHourlyRate: 0,
    insuranceDeduction: 0,
    autoAccrueSalary: false,
  },
  clients: [],
  parts: [],
  serviceLogs: [],
};

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  summary: FinancialSummary;
  reminders: ReminderLists;
  lowStock: PartItem[];
  ready: boolean;
  driver: 'dexie' | 'local' | null;
  bootFailed: boolean;
  persistError: string | null;
  /** Re-read everything from the driver (used after reset-to-seed). */
  reload: () => Promise<void>;
  /** Direct driver access for backup export / seed reset. */
  driverRef: React.MutableRefObject<LedgerStore | null>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function snapshotOf(state: AppState): Omit<BackupPayload, 'version' | 'exportedAt'> {
  return {
    transactions: state.transactions,
    clients: state.clients,
    parts: state.parts,
    serviceLogs: state.serviceLogs,
    settings: state.settings,
  };
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(applyAction, EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [driverName, setDriverName] = useState<'dexie' | 'local' | null>(null);
  const [bootFailed, setBootFailed] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const driverRef = useRef<LedgerStore | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);

  const reload = useCallback(async () => {
    const driver = driverRef.current;
    if (!driver) return;
    const [transactions, clients, parts, serviceLogs, settings] = await Promise.all([
      driver.getTransactions(),
      driver.getClients(),
      driver.getParts(),
      driver.getServiceLogs(),
      driver.getSettings(),
    ]);
    dispatch({ type: 'HYDRATE', state: { transactions, clients, parts, serviceLogs, settings } });
  }, []);

  // Boot once: pick driver, migrate legacy data, hydrate.
  useEffect(() => {
    let cancelled = false;
    bootStore()
      .then(async ({ store, driver }) => {
        if (cancelled) return;
        driverRef.current = store;
        setDriverName(driver);
        await reload();
        if (cancelled) return;
        readyRef.current = true;
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBootFailed(true);
        setReady(true); // show the app anyway (empty state, local driver failed too)
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Debounced persistence: every committed state is written back whole.
  useEffect(() => {
    if (!readyRef.current || !driverRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const snap = snapshotOf(state);
    timerRef.current = setTimeout(() => {
      driverRef.current
        ?.importBackup({ version: 1, exportedAt: new Date().toISOString(), ...snap })
        .then(() => setPersistError(null))
        .catch(() =>
          setPersistError('خطا در ذخیره‌سازی محلی. داده‌ها فقط در حافظه موقت هستند.'),
        );
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state]);

  const summary = useMemo(
    () => selectSummary(state),
    [state.transactions, state.settings, state.clients],
  );
  const reminders = useMemo(() => selectReminders(state), [state.clients]);
  const lowStock = useMemo(() => selectLowStock(state), [state.parts]);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      dispatch,
      summary,
      reminders,
      lowStock,
      ready,
      driver: driverName,
      bootFailed,
      persistError,
      reload,
      driverRef,
    }),
    [state, dispatch, summary, reminders, lowStock, ready, driverName, bootFailed, persistError, reload],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return ctx;
}
