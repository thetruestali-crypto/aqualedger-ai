import { describe, expect, it } from 'vitest';
import {
  formatIranianPhone,
  isKnownIranianOperator,
  maskPhone,
  normalizeIranianPhone,
  toNationalPhone,
} from '@/src/lib/phone';

// Iranian phone normalization is the entry point of the SMS login: the same
// helper runs on the client (fast feedback) and on the server (authority).
describe('normalizeIranianPhone', () => {
  it('accepts the national format', () => {
    expect(normalizeIranianPhone('09121234567')).toBe('+989121234567');
  });

  it('accepts the +98, 0098, 98 and bare-9 forms', () => {
    expect(normalizeIranianPhone('+989121234567')).toBe('+989121234567');
    expect(normalizeIranianPhone('00989121234567')).toBe('+989121234567');
    expect(normalizeIranianPhone('989121234567')).toBe('+989121234567');
    expect(normalizeIranianPhone('9121234567')).toBe('+989121234567');
  });

  it('accepts Persian and Arabic digits plus separators', () => {
    expect(normalizeIranianPhone('۰۹۱۲ ۱۲۳ ۴۵۶۷')).toBe('+989121234567');
    expect(normalizeIranianPhone('٠٩١٢-١٢٣-٤٥٦٧')).toBe('+989121234567');
    expect(normalizeIranianPhone('0912-123-4567')).toBe('+989121234567');
    expect(normalizeIranianPhone('(+98) 912 123 4567')).toBe('+989121234567');
  });

  it('rejects everything that is not an Iranian mobile number', () => {
    expect(normalizeIranianPhone('')).toBeNull();
    expect(normalizeIranianPhone('0912345')).toBeNull();
    expect(normalizeIranianPhone('0812345678')).toBeNull();
    expect(normalizeIranianPhone('+14155551234')).toBeNull();
    expect(normalizeIranianPhone('0912123456a')).toBeNull();
    expect(normalizeIranianPhone('091212345678')).toBeNull();
    expect(normalizeIranianPhone('91212345')).toBeNull();
  });
});

describe('phone formatting', () => {
  it('renders the national number with Persian digits', () => {
    expect(toNationalPhone('+989121234567')).toBe('09121234567');
    expect(formatIranianPhone('+989121234567')).toBe('۰۹۱۲ ۱۲۳ ۴۵۶۷');
    expect(formatIranianPhone('09121234567')).toBe('۰۹۱۲ ۱۲۳ ۴۵۶۷');
  });

  it('masks the middle digits', () => {
    expect(maskPhone('+989121234567')).toBe('۰۹۱۲ *** ۴۵۶۷');
    expect(maskPhone('nonsense')).toBe('');
  });

  it('knows the operator prefixes', () => {
    expect(isKnownIranianOperator('09121234567')).toBe(true);
    expect(isKnownIranianOperator('09901234567')).toBe(true);
    expect(isKnownIranianOperator('0812345678')).toBe(false);
  });
});
