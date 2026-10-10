import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { BottomTabs } from './components/BottomTabs';
import { ToastStack, type Toast } from './components/Toast';
import { DashboardView } from './components/DashboardView';
import { SmartQuickEntry } from './components/SmartQuickEntry';
import { CompanyLedgerView } from './components/CompanyLedgerView';
import { ClientsLedgerView } from './components/ClientsLedgerView';
import { InventoryView } from './components/InventoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { InvoiceExportModal } from './components/InvoiceExportModal';
import { UserGuideModal } from './components/UserGuideModal';

import type { Transaction, CompanySettings, Client, PartItem } from './types';
import { AppStoreProvider, useAppStore } from './state/store';
import { matchClientId } from './state/transitions';
import { validateBackupPayload, serializeBackup, backupFileName } from './data/backup';
import { toPersianDigits } from './lib/format';
import { typicalAmount } from './domain/profit';
import { buildServiceLogFromTransaction } from './domain/serviceLog';
import { needsMonthlyAccrual, buildSalaryAccrualTx } from './domain/salary';
import type { BackupPayload } from './data/db';

let toastId = 0;

function LoadingSplash({ driver }: { driver: 'dexie' | 'local' | null }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      <p className="text-sm font-bold text-slate-300">در حال بارگذاری دفتر حساب...</p>
      {driver === 'local' && (
        <p className="text-xs text-amber-300">حافظه مرورگر در دسترس نیست؛ از ذخیره موقت استفاده می‌شود.</p>
      )}
    </div>
  );
}

function Shell() {
  const {
    state,
    dispatch,
    summary,
    reminders,
    lowStock,
    ready,
    driver,
    bootFailed,
    persistError,
    reload,
    driverRef,
  } = useAppStore();
  const { transactions, settings, clients, parts } = state;

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const accrualCheckedRef = useRef(false);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (text: string, kind: Toast['kind'] = 'success') => {
      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-2), { id, kind, text }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  useEffect(() => {
    if (persistError) pushToast(persistError, 'error');
  }, [persistError, pushToast]);

  useEffect(() => {
    if (ready && bootFailed) {
      pushToast('بازیابی خودکار ناموفق بود؛ با داده خالی شروع شد.', 'error');
    }
  }, [ready, bootFailed, pushToast]);

  // Automatic month-end salary accrual (FR-04): once per boot, record the memo
  // when autoAccrueSalary is on and this Jalali month has no accrual yet.
  useEffect(() => {
    if (!ready || accrualCheckedRef.current) return;
    accrualCheckedRef.current = true;
    if (state.settings.autoAccrueSalary && needsMonthlyAccrual(state.transactions, new Date().toISOString())) {
      dispatch({
        type: 'RECEIVE_TRANSACTION',
        tx: buildSalaryAccrualTx(state.settings, new Date().toISOString()),
      });
      pushToast('حقوق این ماه به‌صورت خودکار ثبت شد.', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Handle adding new transaction (client upsert lives in the reducer).
  // Afterwards: derive a service log + decrement sold parts from stock (FR-07).
  const handleSaveTransaction = async (newTx: Transaction) => {
    dispatch({ type: 'RECEIVE_TRANSACTION', tx: newTx });
    pushToast('تراکنش با موفقیت در دفتر حساب ثبت شد.');
    if (newTx.streamType === 'company') {
      setActiveTab('company');
    } else {
      setActiveTab('dashboard');
    }

    if (newTx.streamType === 'field' && newTx.items && newTx.items.length > 0) {
      const clientId = matchClientId(state.clients, newTx.party.name);
      if (clientId) {
        const log = buildServiceLogFromTransaction(newTx, clientId);
        if (log) dispatch({ type: 'SAVE_SERVICE_LOG', log });
      }
      const lines = newTx.items
        .filter((i) => (i.quantity ?? 1) > 0)
        .map((i) => ({ name: i.itemName, qty: i.quantity ?? 1 }));
      if (lines.length > 0) {
        try {
          const results = await driverRef.current?.decrementStock(lines);
          if (results && results.length > 0) {
            const refreshed = await driverRef.current?.getParts();
            if (refreshed) dispatch({ type: 'SET_PARTS', parts: refreshed });
            pushToast(`${toPersianDigits(results.length)} قلم از انبار کسر شد.`);
          }
        } catch (e) {
          pushToast(
            `ثبت شد ولی کسر انبار ناموفق بود: ${e instanceof Error ? e.message : 'خطای نامشخص'}`,
            'error',
          );
        }
      }
    }
  };

  // Delete transaction
  const handleDeleteTransaction = (id: string) => {
    if (!window.confirm('این سند حذف شود؟')) return;
    dispatch({ type: 'DELETE_TRANSACTION', id });
    pushToast('سند حذف شد.', 'info');
  };

  // Settings update
  const handleSaveSettings = (newSettings: CompanySettings) => {
    dispatch({ type: 'SAVE_SETTINGS', settings: newSettings });
  };

  // Client operations
  const handleAddClient = (client: Client) => {
    dispatch({ type: 'ADD_CLIENT', client });
    pushToast('مشتری جدید ثبت شد.');
  };

  const handleUpdateClient = (client: Client) => {
    dispatch({ type: 'UPDATE_CLIENT', client });
    pushToast('پرونده مشتری به‌روز شد.', 'info');
  };

  const handleSettleClientDebt = (clientId: string, amount: number) => {
    dispatch({ type: 'SETTLE_CLIENT_DEBT', clientId, amount, nowISO: new Date().toISOString() });
    pushToast('تسویه بدهی مشتری ثبت شد.');
  };

  const handleSettleInvoice = (txId: string, amount: number) => {
    dispatch({ type: 'SETTLE_INVOICE', txId, amount, nowISO: new Date().toISOString() });
    pushToast('تسویه فاکتور ثبت شد.');
  };

  const handleAccrueSalary = () => {
    if (!needsMonthlyAccrual(transactions, new Date().toISOString())) {
      pushToast('حقوق این ماه قبلاً ثبت شده است.', 'info');
      return;
    }
    dispatch({
      type: 'RECEIVE_TRANSACTION',
      tx: buildSalaryAccrualTx(settings, new Date().toISOString()),
    });
    pushToast('سند یادداشت حقوق این ماه ثبت شد.');
  };

  // Parts operations
  const handleAddPart = (part: PartItem) => {
    dispatch({ type: 'ADD_PART', part });
    pushToast('قطعه جدید به انبار اضافه شد.');
  };

  const handleUpdatePart = (part: PartItem) => {
    dispatch({ type: 'UPDATE_PART', part });
  };

  const handleDeletePart = (id: string) => {
    if (!window.confirm('این قطعه از انبار حذف شود؟')) return;
    dispatch({ type: 'DELETE_PART', id });
    pushToast('قطعه حذف شد.', 'info');
  };

  // Full backup export / import
  const handleExportBackup = (): { fileName: string; json: string } => {
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions,
      clients,
      parts,
      serviceLogs: state.serviceLogs,
      settings,
    };
    return { fileName: backupFileName(), json: serializeBackup(payload) };
  };

  const handleImportBackup = (raw: unknown): { ok: boolean; errors: string[] } => {
    const check = validateBackupPayload(raw);
    if (!check.ok || !check.payload) return { ok: false, errors: check.errors };
    dispatch({ type: 'IMPORT_BACKUP', backup: check.payload });
    pushToast('پشتیبان با موفقیت بازگردانی شد.');
    return { ok: true, errors: [] };
  };

  // Reset to initial demo
  const handleResetDemo = async () => {
    await driverRef.current?.resetToSeed();
    await reload();
    pushToast('داده‌های نمونه بازیابی شد.', 'info');
  };

  if (!ready) return <LoadingSplash driver={driver} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Navbar with tabs and quick indicators */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bossNetBalance={summary.bossNetBalance}
        bossStatus={summary.bossStatus}
        settings={settings}
        onOpenQuickEntry={() => setActiveTab('quick-entry')}
        onOpenHelp={() => setIsGuideModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            transactions={transactions}
            settings={settings}
            clients={clients}
            reminders={reminders}
            lowStock={lowStock}
            onOpenQuickEntry={() => setActiveTab('quick-entry')}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onExportSettlement={() => setIsInvoiceModalOpen(true)}
          />
        )}

        {activeTab === 'quick-entry' && (
          <SmartQuickEntry
            onSaveTransaction={(tx) => void handleSaveTransaction(tx)}
            settings={settings}
            typicalAmount={typicalAmount(transactions)}
          />
        )}

        {activeTab === 'company' && (
          <CompanyLedgerView
            summary={summary}
            transactions={transactions}
            settings={settings}
            onAddTransaction={(tx) => void handleSaveTransaction(tx)}
            onDeleteTransaction={handleDeleteTransaction}
            onExportSettlement={() => setIsInvoiceModalOpen(true)}
            onAccrueSalary={handleAccrueSalary}
            accrualRecorded={!needsMonthlyAccrual(transactions, new Date().toISOString())}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsLedgerView
            clients={clients}
            transactions={transactions}
            serviceLogs={state.serviceLogs}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onSettleDebt={handleSettleClientDebt}
            onSettleInvoice={handleSettleInvoice}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            parts={parts}
            onAddPart={handleAddPart}
            onUpdatePart={handleUpdatePart}
            onDeletePart={handleDeletePart}
          />
        )}

        {activeTab === 'reports' && <ReportsView transactions={transactions} />}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetDemo={handleResetDemo}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        )}
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Export & Settlement Modal */}
      <InvoiceExportModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        summary={summary}
        settings={settings}
        transactions={transactions}
        clients={clients}
      />

      {/* Guide & Rules Modal */}
      <UserGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            AquaLedger AI © سیستم اختصاصی حسابداری و مدیریت خدمات تکنسین‌های تصفیه آب ایران
          </span>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>حقوق شرکتی + خدمات میدانی</span>
            <span>•</span>
            <button
              onClick={() => setIsGuideModalOpen(true)}
              className="text-cyan-400 hover:underline"
            >
              راهنما و قوانین محاسباتی
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <Shell />
    </AppStoreProvider>
  );
}
