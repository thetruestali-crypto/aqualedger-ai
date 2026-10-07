// LocalStorage persistence (legacy driver, kept until Phase-3 Dexie cutover).
// Canonical seed data lives in src/data/seed.ts; new code must use the
// LedgerStore interface in src/data/repository.ts instead of these helpers.
import type { Transaction, CompanySettings, Client, PartItem, ServiceLog } from '../types';
import {
  defaultSettings,
  defaultClients,
  defaultParts,
  defaultTransactions,
  defaultServiceLogs,
} from '../data/seed';

export { defaultSettings, defaultClients, defaultParts, defaultTransactions, defaultServiceLogs };

const STORAGE_KEYS = {
  TRANSACTIONS: 'aqualedger_transactions_v1',
  SETTINGS: 'aqualedger_settings_v1',
  CLIENTS: 'aqualedger_clients_v1',
  PARTS: 'aqualedger_parts_v1',
  SERVICE_LOGS: 'aqualedger_service_logs_v1',
  MIGRATED_TO_DEXIE: 'aqualedger_migrated_dexie_v1',
};

export { STORAGE_KEYS };

// Helper functions for persistent state
export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(defaultTransactions));
      return defaultTransactions;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading transactions:', e);
    return defaultTransactions;
  }
}

export function saveTransactions(transactions: Transaction[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    console.error('Error saving transactions:', e);
  }
}

export function loadSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading settings:', e);
    return defaultSettings;
  }
}

export function saveSettings(settings: CompanySettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

export function loadClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(defaultClients));
      return defaultClients;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading clients:', e);
    return defaultClients;
  }
}

export function saveClients(clients: Client[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  } catch (e) {
    console.error('Error saving clients:', e);
  }
}

export function loadParts(): PartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PARTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PARTS, JSON.stringify(defaultParts));
      return defaultParts;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading parts:', e);
    return defaultParts;
  }
}

export function saveParts(parts: PartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PARTS, JSON.stringify(parts));
  } catch (e) {
    console.error('Error saving parts:', e);
  }
}

export function loadServiceLogs(): ServiceLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVICE_LOGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SERVICE_LOGS, JSON.stringify(defaultServiceLogs));
      return defaultServiceLogs;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading service logs:', e);
    return defaultServiceLogs;
  }
}

export function saveServiceLogs(logs: ServiceLog[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.SERVICE_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving service logs:', e);
  }
}

export function isMigratedToDexie(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.MIGRATED_TO_DEXIE) === '1';
  } catch {
    return false;
  }
}

export function markMigratedToDexie() {
  try {
    localStorage.setItem(STORAGE_KEYS.MIGRATED_TO_DEXIE, '1');
  } catch (e) {
    console.error('Error marking migration:', e);
  }
}

export function resetToDemoData() {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(defaultTransactions));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(defaultClients));
  localStorage.setItem(STORAGE_KEYS.PARTS, JSON.stringify(defaultParts));
  localStorage.setItem(STORAGE_KEYS.SERVICE_LOGS, JSON.stringify(defaultServiceLogs));
}
