// Reports domain (FR-11): daily/weekly/monthly aggregation of cash flow with
// part-profit vs labor split (FR-08 data). Pure; Jalali-aware month buckets.
// Money unit: integer Toman.
//
// Accounting (cash technician view):
//   companyIn   = advances + salary payouts received (money from the boss)
//   companyOut  = out-of-pocket purchases for the company
//   fieldIn     = cash collected from field clients (paidAmount)
//   partsCost   = buy-price cost of parts sold + client_part_cost outlays
//   partProfit  = sum of (sell-buy) x qty  |  labor = دستمزد/ایاب‌ذهاب lines
//   toolExpense = personal tool purchases
//   net         = (companyIn + fieldIn) - (companyOut + partsCost + toolExpense)
// Salary-accrual memos move no cash and are excluded.
import type { Transaction } from '../types';
import { toJalaliDate } from '../lib/format';
import { splitTransactionItems } from './profit';

export type ReportPeriod = 'day' | 'week' | 'month';

export interface ReportBucket {
  key: string;
  label: string;
  startISO: string;
  endISO: string;
  companyIn: number;
  companyOut: number;
  fieldIn: number;
  partsCost: number;
  partProfit: number;
  labor: number;
  toolExpense: number;
  net: number;
  txCount: number;
}

export interface ReportSummary extends Omit<ReportBucket, 'key' | 'label' | 'startISO' | 'endISO'> {
  buckets: ReportBucket[];
  period: ReportPeriod;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function asciiDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)));
}

function jalaliParts(dateISO: string): { jy: string; jm: string } {
  const d = new Date(dateISO);
  const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  return {
    jy: asciiDigits(parts.find((p) => p.type === 'year')?.value ?? ''),
    jm: asciiDigits(parts.find((p) => p.type === 'month')?.value ?? ''),
  };
}

function jalaliMonthLabel(dateISO: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric' }).format(
      new Date(dateISO),
    );
  } catch {
    return dateISO.slice(0, 7);
  }
}

function startOfDayISO(d: Date): string {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.toISOString();
}

function dayKey(dateISO: string): string {
  // Local calendar day (UTC slicing would shift buckets in +3:30).
  const d = new Date(dateISO);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function prevJalaliMonthStart(monthStartISO: string): string {
  // Step one day back, then rewind to that Jalali month's first day (00:00).
  let c = new Date(new Date(monthStartISO).getTime() - DAY_MS);
  const cur = jalaliParts(c.toISOString());
  for (let i = 0; i < 32; i++) {
    const prev = new Date(c.getTime() - DAY_MS);
    const pp = jalaliParts(prev.toISOString());
    if (pp.jy !== cur.jy || pp.jm !== cur.jm) break;
    c = prev;
  }
  return startOfDayISO(c);
}

export interface BucketDef {
  key: string;
  label: string;
  startISO: string;
  endISO: string;
}

/** Ordered bucket definitions ending at now (oldest first). */
export function bucketDefs(period: ReportPeriod, nowISO: string, count: number): BucketDef[] {
  const now = new Date(nowISO);
  if (period === 'day') {
    const out: BucketDef[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * DAY_MS);
      const start = startOfDayISO(day);
      out.push({
        key: dayKey(start),
        label: toJalaliDate(start),
        startISO: start,
        endISO: new Date(new Date(start).getTime() + DAY_MS).toISOString(),
      });
    }
    return out;
  }
  if (period === 'week') {
    const out: BucketDef[] = [];
    const anchor = new Date(startOfDayISO(now).valueOf());
    for (let i = count - 1; i >= 0; i--) {
      const end = new Date(anchor.getTime() - i * 7 * DAY_MS);
      const start = new Date(end.getTime() - 6 * DAY_MS);
      out.push({
        key: `w-${start.toISOString().slice(0, 10)}`,
        label: `هفته ${toJalaliDate(start.toISOString())}`,
        startISO: startOfDayISO(start),
        endISO: new Date(new Date(startOfDayISO(start)).getTime() + 7 * DAY_MS).toISOString(),
      });
    }
    return out;
  }
  // month: Jalali calendar months with exact start anchors, current month last.
  const curKey = jalaliParts(nowISO);
  let cursor = new Date(startOfDayISO(now).valueOf());
  for (let i = 0; i < 32; i++) {
    const prev = new Date(cursor.getTime() - DAY_MS);
    const p = jalaliParts(prev.toISOString());
    if (p.jy !== curKey.jy || p.jm !== curKey.jm) break;
    cursor = prev;
  }
  const starts: string[] = [cursor.toISOString()];
  for (let i = 1; i < count; i++) {
    starts.unshift(prevJalaliMonthStart(starts[0]));
  }
  return starts.map((startISO, i) => {
    const { jy, jm } = jalaliParts(startISO);
    return {
      key: `${jy}/${jm}`,
      label: jalaliMonthLabel(startISO),
      startISO,
      endISO: i + 1 < starts.length ? starts[i + 1] : nowISO,
    };
  });
}

function emptyBucket(def: BucketDef): ReportBucket {
  return {
    ...def,
    companyIn: 0,
    companyOut: 0,
    fieldIn: 0,
    partsCost: 0,
    partProfit: 0,
    labor: 0,
    toolExpense: 0,
    net: 0,
    txCount: 0,
  };
}

/** Aggregate transactions into ordered buckets. Pure. */
export function buildReport(
  transactions: Transaction[],
  period: ReportPeriod,
  nowISO: string,
  bucketCount: number,
): ReportSummary {
  const defs = bucketDefs(period, nowISO, bucketCount);
  const buckets = defs.map(emptyBucket);
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const tx of transactions) {
    const t = new Date(tx.date).getTime();
    if (Number.isNaN(t)) continue;
    if (t > new Date(nowISO).getTime()) continue; // ignore future-dated rows
    let bucket: ReportBucket | undefined;
    if (period === 'day') {
      const oldest = new Date(new Date(nowISO).getTime() - (bucketCount - 1) * DAY_MS);
      if (t < new Date(startOfDayISO(oldest)).getTime()) continue;
      bucket = byKey.get(dayKey(tx.date));
    } else {
      // week + month buckets carry exact [startISO, endISO) ranges.
      bucket = buckets.find((b) => {
        const s = new Date(b.startISO).getTime();
        const e = new Date(b.endISO).getTime();
        return t >= s && t < e;
      });
    }
    if (!bucket) continue;
    bucket.txCount += 1;

    if (tx.streamType === 'company') {
      if (tx.transactionType === 'boss_advance_received') bucket.companyIn += tx.totalAmount;
      else if (tx.transactionType === 'salary_payout') bucket.companyIn += tx.paidAmount;
      else if (tx.transactionType === 'company_expense_out_of_pocket') {
        bucket.companyOut += tx.totalAmount;
      }
      // salary_accrual: memo, no cash movement.
    } else {
      if (tx.transactionType === 'technician_tool_expense') {
        bucket.toolExpense += tx.totalAmount;
      } else if (tx.transactionType === 'client_part_cost') {
        bucket.partsCost += tx.totalAmount;
      } else {
        bucket.fieldIn += tx.paidAmount;
        const split = splitTransactionItems(tx.items);
        bucket.partsCost += split.partsCost;
        bucket.partProfit += split.partProfit;
        bucket.labor += split.laborRevenue;
      }
    }
  }

  for (const b of buckets) {
    b.net = b.companyIn + b.fieldIn - (b.companyOut + b.partsCost + b.toolExpense);
  }

  const sum = (f: (b: ReportBucket) => number) => buckets.reduce((a, b) => a + f(b), 0);
  return {
    buckets,
    period,
    companyIn: sum((b) => b.companyIn),
    companyOut: sum((b) => b.companyOut),
    fieldIn: sum((b) => b.fieldIn),
    partsCost: sum((b) => b.partsCost),
    partProfit: sum((b) => b.partProfit),
    labor: sum((b) => b.labor),
    toolExpense: sum((b) => b.toolExpense),
    net: sum((b) => b.net),
    txCount: sum((b) => b.txCount),
  };
}

export const REPORT_PERIODS: Array<{ id: ReportPeriod; label: string; count: number }> = [
  { id: 'day', label: 'روزانه (۷ روز)', count: 7 },
  { id: 'week', label: 'هفتگی (۸ هفته)', count: 8 },
  { id: 'month', label: 'ماهانه (۶ ماه)', count: 6 },
];
