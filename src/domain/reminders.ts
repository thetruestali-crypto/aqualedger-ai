// Reminders domain (FR-09): next-service suggestion + due/overdue lists.
// Rules: 6 months for filters 1-2-3 (and default), 24 months for membranes.
// Pure: the "now" instant is injectable for tests.
import type { Client } from '../types';

export const FILTER_SERVICE_MONTHS = 6;
export const MEMBRANE_SERVICE_MONTHS = 24;
export const DUE_SOON_DAYS = 14;

const MEMBRANE_KEYWORDS = ['ممبران', 'membrane', 'ro', 'اسمز'];

/** Suggest next-service months from item names (membrane -> 24, else 6). */
export function suggestNextServiceMonths(itemNames: string[]): number {
  const joined = itemNames.join(' ').toLowerCase();
  if (MEMBRANE_KEYWORDS.some((k) => joined.includes(k))) return MEMBRANE_SERVICE_MONTHS;
  return FILTER_SERVICE_MONTHS;
}

export function addMonthsISO(dateISO: string, months: number): string {
  const d = new Date(dateISO);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function daysUntil(targetISO: string, nowISO?: string): number {
  const now = nowISO ? new Date(nowISO).getTime() : Date.now();
  const diff = new Date(targetISO).getTime() - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export interface ClientReminder {
  client: Client;
  daysLeft: number;
}

export interface ReminderLists {
  /** Service date already passed. */
  overdue: ClientReminder[];
  /** Due within DUE_SOON_DAYS (including today). */
  dueSoon: ClientReminder[];
  /** Everything else with a valid future date, sorted ascending. */
  upcoming: ClientReminder[];
}

/** Split clients into overdue / due-soon / upcoming by nextServiceDueDate. */
export function getDueReminders(clients: Client[], nowISO?: string): ReminderLists {
  const overdue: ClientReminder[] = [];
  const dueSoon: ClientReminder[] = [];
  const upcoming: ClientReminder[] = [];
  for (const client of clients) {
    if (!client.nextServiceDueDate) continue;
    const daysLeft = daysUntil(client.nextServiceDueDate, nowISO);
    if (Number.isNaN(daysLeft)) continue;
    const entry = { client, daysLeft };
    if (daysLeft < 0) overdue.push(entry);
    else if (daysLeft <= DUE_SOON_DAYS) dueSoon.push(entry);
    else upcoming.push(entry);
  }
  const byDays = (a: ClientReminder, b: ClientReminder) => a.daysLeft - b.daysLeft;
  overdue.sort(byDays);
  dueSoon.sort(byDays);
  upcoming.sort(byDays);
  return { overdue, dueSoon, upcoming };
}
