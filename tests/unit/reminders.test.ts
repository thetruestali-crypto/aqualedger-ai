import { describe, expect, it } from 'vitest';
import {
  suggestNextServiceMonths,
  addMonthsISO,
  daysUntil,
  getDueReminders,
} from '@/src/domain/reminders';
import type { Client } from '@/src/types';

function client(id: string, nextServiceDueDate: string): Client {
  return {
    id,
    name: id,
    phone: '',
    address: '',
    deviceModel: '',
    totalPaid: 0,
    totalDebt: 0,
    lastServiceDate: '',
    nextServiceDueDate,
  };
}

describe('suggestNextServiceMonths', () => {
  it('membrane -> 24 months', () => {
    expect(suggestNextServiceMonths(['فیلتر ممبران ۷۵ گالن'])).toBe(24);
    expect(suggestNextServiceMonths(['membrane replacement'])).toBe(24);
  });

  it('filters and default -> 6 months', () => {
    expect(suggestNextServiceMonths(['پک فیلتر ۱۲۳'])).toBe(6);
    expect(suggestNextServiceMonths([])).toBe(6);
    expect(suggestNextServiceMonths(['پمپ'])).toBe(6);
  });
});

describe('addMonthsISO / daysUntil', () => {
  it('adds calendar months', () => {
    const out = addMonthsISO('2026-01-15T00:00:00.000Z', 6);
    expect(new Date(out).getUTCMonth()).toBe(6); // July
  });

  it('daysUntil is negative for the past', () => {
    expect(daysUntil('2020-01-01T00:00:00.000Z', '2026-10-07T00:00:00.000Z')).toBeLessThan(0);
  });
});

describe('getDueReminders', () => {
  const NOW = '2026-10-07T00:00:00.000Z';
  const day = 24 * 60 * 60 * 1000;
  const iso = (offsetDays: number) => new Date(new Date(NOW).getTime() + offsetDays * day).toISOString();

  it('splits overdue / due-soon / upcoming and sorts ascending', () => {
    const lists = getDueReminders(
      [
        client('past-30', iso(-30)),
        client('past-1', iso(-1)),
        client('today', iso(0)),
        client('soon-5', iso(5)),
        client('later-60', iso(60)),
        client('later-30', iso(30)),
      ],
      NOW,
    );
    expect(lists.overdue.map((r) => r.client.id)).toEqual(['past-30', 'past-1']);
    expect(lists.dueSoon.map((r) => r.client.id)).toEqual(['today', 'soon-5']);
    expect(lists.upcoming.map((r) => r.client.id)).toEqual(['later-30', 'later-60']);
  });

  it('skips clients without a due date', () => {
    const lists = getDueReminders([client('nodate', '')], NOW);
    expect(lists.overdue).toEqual([]);
    expect(lists.dueSoon).toEqual([]);
    expect(lists.upcoming).toEqual([]);
  });
});
