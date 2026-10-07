// Canonical formatters (single source of truth). Pure: no DOM, no network.
// Persian digits + thousands separators; Jalali via Intl fa-IR.

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(n: number | string): string {
  if (n === null || n === undefined) return '';
  const str = n.toString();
  return str.replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

export function formatToman(amount: number, withUnit = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return withUnit ? '۰ تومان' : '۰';
  }
  const formatted = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '-' : '';
  const result = `${sign}${toPersianDigits(formatted)}`;
  return withUnit ? `${result} تومان` : result;
}

export function formatTomanCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? 'منفی ' : '';
  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(1);
    return `${sign}${toPersianDigits(val)} میلیارد تومان`;
  }
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1).replace('.0', '');
    return `${sign}${toPersianDigits(val)} میلیون تومان`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toFixed(0);
    return `${sign}${toPersianDigits(val)} هزار تومان`;
  }
  return `${sign}${toPersianDigits(abs)} تومان`;
}

export function toJalaliDate(isoDateString?: string): string {
  const date = isoDateString ? new Date(isoDateString) : new Date();
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return isoDateString || '';
  }
}

export function toJalaliDateTime(isoDateString?: string): string {
  const date = isoDateString ? new Date(isoDateString) : new Date();
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return isoDateString || '';
  }
}

export function getDaysRemainingUntil(targetDateIso: string): number {
  const target = new Date(targetDateIso);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDaysAgo(dateIso: string): number {
  const past = new Date(dateIso);
  const now = new Date();
  const diffTime = now.getTime() - past.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function getRelativeTimeString(dateIso: string): string {
  const daysAgo = getDaysAgo(dateIso);
  if (daysAgo <= 0) return 'امروز';
  if (daysAgo === 1) return 'دیروز';
  if (daysAgo < 7) return `${toPersianDigits(daysAgo)} روز پیش`;
  if (daysAgo < 30) return `${toPersianDigits(Math.floor(daysAgo / 7))} هفته پیش`;
  return `${toPersianDigits(Math.floor(daysAgo / 30))} ماه پیش`;
}
