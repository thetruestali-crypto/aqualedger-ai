import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { SmartQuickEntry } from './components/SmartQuickEntry';
import { CompanyLedgerView } from './components/CompanyLedgerView';
import { ClientsLedgerView } from './components/ClientsLedgerView';
import { InventoryView } from './components/InventoryView';
import { SettingsView } from './components/SettingsView';
import { InvoiceExportModal } from './components/InvoiceExportModal';
import { UserGuideModal } from './components/UserGuideModal';

import { Transaction, CompanySettings, Client, PartItem } from './types';
import {
  loadTransactions,
  saveTransactions,
  loadSettings,
  saveSettings,
  loadClients,
  saveClients,
  loadParts,
  saveParts,
  resetToDemoData,
} from './utils/storage';
import { computeFinancialSummary } from './utils/financialEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);
  const [settings, setSettings] = useState<CompanySettings>(loadSettings);
  const [clients, setClients] = useState<Client[]>(loadClients);
  const [parts, setParts] = useState<PartItem[]>(loadParts);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Compute live financial balances
  const summary = computeFinancialSummary(transactions, settings, clients);

  // Handle adding new transaction
  const handleSaveTransaction = (newTx: Transaction) => {
    const updatedTransactions = [newTx, ...transactions];
    setTransactions(updatedTransactions);
    saveTransactions(updatedTransactions);

    // If transaction involves a client, update client's record or add new client
    if (newTx.streamType === 'field' && newTx.party?.role === 'client') {
      const clientName = newTx.party.name;
      const existingClientIndex = clients.findIndex((c) =>
        c.name.toLowerCase().includes(clientName.toLowerCase()) ||
        clientName.toLowerCase().includes(c.name.toLowerCase())
      );

      const suggestMonths = newTx.suggestNextServiceMonths || 6;
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + suggestMonths);

      if (existingClientIndex >= 0) {
        const existing = clients[existingClientIndex];
        const updatedClient: Client = {
          ...existing,
          totalPaid: existing.totalPaid + (newTx.paidAmount || 0),
          totalDebt: existing.totalDebt + (newTx.remainingDebt || 0),
          lastServiceDate: newTx.date,
          nextServiceDueDate: nextDate.toISOString(),
          phone: newTx.party.phone || existing.phone,
          address: newTx.party.address || existing.address,
        };
        const updatedClientsList = [...clients];
        updatedClientsList[existingClientIndex] = updatedClient;
        setClients(updatedClientsList);
        saveClients(updatedClientsList);
      } else {
        // Create new client automatically
        const createdClient: Client = {
          id: `client-${Date.now()}`,
          name: clientName,
          phone: newTx.party.phone || '',
          address: newTx.party.address || '',
          deviceModel: 'دستگاه تصفیه آب خانگی',
          totalPaid: newTx.paidAmount || 0,
          totalDebt: newTx.remainingDebt || 0,
          lastServiceDate: newTx.date,
          nextServiceDueDate: nextDate.toISOString(),
          notes: newTx.description,
        };
        const updatedClientsList = [createdClient, ...clients];
        setClients(updatedClientsList);
        saveClients(updatedClientsList);
      }
    }

    // Switch to appropriate view to see result
    if (newTx.streamType === 'company') {
      setActiveTab('company');
    } else {
      setActiveTab('dashboard');
    }
  };

  // Delete transaction
  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveTransactions(updated);
  };

  // Settings update
  const handleSaveSettings = (newSettings: CompanySettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Client operations
  const handleAddClient = (client: Client) => {
    const updated = [client, ...clients];
    setClients(updated);
    saveClients(updated);
  };

  const handleUpdateClient = (client: Client) => {
    const updated = clients.map((c) => (c.id === client.id ? client : c));
    setClients(updated);
    saveClients(updated);
  };

  const handleSettleClientDebt = (clientId: string, amount: number) => {
    const target = clients.find((c) => c.id === clientId);
    if (!target) return;

    const remaining = Math.max(0, target.totalDebt - amount);
    const updatedClients = clients.map((c) =>
      c.id === clientId
        ? {
            ...c,
            totalPaid: c.totalPaid + amount,
            totalDebt: remaining,
          }
        : c
    );
    setClients(updatedClients);
    saveClients(updatedClients);

    // Register a settlement transaction
    const settleTx: Transaction = {
      id: `tx-settle-${Date.now()}`,
      date: new Date().toISOString(),
      streamType: 'field',
      transactionType: 'client_payment_received',
      party: {
        role: 'client',
        name: target.name,
        phone: target.phone,
      },
      totalAmount: amount,
      paidAmount: amount,
      remainingDebt: 0,
      financialImpact: {
        targetBalance: 'personal_cash',
        userBalanceChange: 0,
      },
      paymentMethod: 'card_to_card',
      category: 'تسویه بدهی معوق',
      description: `تسویه مبلغ بدهی توسط ${target.name}`,
      conversationalSummary: `دریافت ${amount.toLocaleString('fa-IR')} تومان بابت تسویه بدهی ${target.name} ثبت شد.`,
      source: 'manual',
    };
    const updatedTxList = [settleTx, ...transactions];
    setTransactions(updatedTxList);
    saveTransactions(updatedTxList);
  };

  // Parts operations
  const handleAddPart = (part: PartItem) => {
    const updated = [part, ...parts];
    setParts(updated);
    saveParts(updated);
  };

  const handleUpdatePart = (part: PartItem) => {
    const updated = parts.map((p) => (p.id === part.id ? part : p));
    setParts(updated);
    saveParts(updated);
  };

  const handleDeletePart = (id: string) => {
    const updated = parts.filter((p) => p.id !== id);
    setParts(updated);
    saveParts(updated);
  };

  // Reset to initial demo
  const handleResetDemo = () => {
    resetToDemoData();
    setTransactions(loadTransactions());
    setSettings(loadSettings());
    setClients(loadClients());
    setParts(loadParts());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar with tabs and quick indicators */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bossNetBalance={summary.bossNetBalance}
        bossStatus={summary.bossStatus}
        onOpenQuickEntry={() => setActiveTab('quick-entry')}
        onOpenHelp={() => setIsGuideModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            transactions={transactions}
            settings={settings}
            clients={clients}
            onOpenQuickEntry={() => setActiveTab('quick-entry')}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onExportSettlement={() => setIsInvoiceModalOpen(true)}
          />
        )}

        {activeTab === 'quick-entry' && (
          <SmartQuickEntry
            onSaveTransaction={handleSaveTransaction}
            settings={settings}
          />
        )}

        {activeTab === 'company' && (
          <CompanyLedgerView
            summary={summary}
            transactions={transactions}
            settings={settings}
            onAddTransaction={handleSaveTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onExportSettlement={() => setIsInvoiceModalOpen(true)}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsLedgerView
            clients={clients}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onSettleDebt={handleSettleClientDebt}
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

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetDemo={handleResetDemo}
          />
        )}
      </main>

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
