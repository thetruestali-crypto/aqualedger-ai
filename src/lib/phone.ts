// Iranian mobile number helpers (client + server shared). Pure: no DOM, no network.
// Canonical form is E.164 (`+98912XXXXXXXX`); the national form (`09XXXXXXXXX`)
// is what SMS.ir expects as a recipient.
import { normalizePersianText } from './persianNumbers';
import { toPersianDigits } from './format';

/**
 * Known Iranian mobile operator prefixes (the three digits after the leading
 * zero). Informational only: validation stays lenient so a valid but newly
 * allocated number is never rejected.
 */
export const IRANIAN_MOBILE_PREFIXES = ['090', '091', '092', '093', '094', '099'] as const;

const E164_COUNTRY = '+98';
const CLEANUP_RE = /[\s\-()._]/g;

/**
 * Normalize any Iranian mobile input to E.164.
 * Accepts `09XXXXXXXXX`, `+989XXXXXXXXX`, `00989XXXXXXXXX`, `989XXXXXXXXX`
 * and `9XXXXXXXXX` (Persian/Arabic digits and separators are tolerated).
 * Returns null for anything that is not a valid Iranian mobile number.
 */
export function normalizeIranianPhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = normalizePersianText(raw).replace(CLEANUP_RE, '');
  if (!/^\+?\d+$/.test(cleaned)) return null;
  let digits = cleaned.replace(/\+/g, '');
  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^9\d{9}$/.test(digits)) return null;
  return `${E164_COUNTRY}${digits}`;
}

/** National form (`09XXXXXXXXX`) for SMS.ir; empty string when invalid. */
export function toNationalPhone(phone: string): string {
  const e164 = normalizeIranianPhone(phone);
  if (!e164) return '';
  return `0${e164.slice(E164_COUNTRY.length)}`;
}

/** Pretty national form with Persian digits: `۰۹۱۲ ۱۲۳ ۴۵۶۷`. */
export function formatIranianPhone(phone: string): string {
  const national = toNationalPhone(phone);
  if (!national) return typeof phone === 'string' ? phone : '';
  return toPersianDigits(
    `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`,
  );
}

/** Masked national form for display/logs: `۰۹۱۲ *** ۴۵۶۷`. */
export function maskPhone(phone: string): string {
  const national = toNationalPhone(phone);
  if (!national) return '';
  return toPersianDigits(`${national.slice(0, 4)} *** ${national.slice(7)}`);
}

/** True when the number belongs to a known Iranian mobile operator prefix. */
export function isKnownIranianOperator(phone: string): boolean {
  const national = toNationalPhone(phone);
  if (!national) return false;
  return (IRANIAN_MOBILE_PREFIXES as readonly string[]).includes(national.slice(0, 3));
}
