import { describe, expect, it } from 'vitest';
import { parsePersianAmount, extractTomanAmounts, normalizePersianText } from '@/src/lib/persianNumbers';

describe('normalizePersianText', () => {
  it('converts Persian and Arabic digits to ASCII', () => {
    expect(normalizePersianText('۵۸۰ تومن')).toBe('580 تومن');
    expect(normalizePersianText('٥٨٠')).toBe('580');
  });
});

describe('parsePersianAmount', () => {
  it('ARD sample: casual ۵۸۰ تومن means 580_000', () => {
    expect(
      parsePersianAmount('از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت مهندس جلالی'),
    ).toBe(580_000);
  });

  it('handles میلیون / ملیون / هزار', () => {
    expect(parsePersianAmount('۲ میلیون تومن مساعده گرفتم')).toBe(2_000_000);
    expect(parsePersianAmount('2 ملیون دادم')).toBe(2_000_000);
    expect(parsePersianAmount('۳۸۰ هزار تومن دستمزد')).toBe(380_000);
  });

  it('handles نیم and و نیم', () => {
    expect(parsePersianAmount('۲ و نیم میلیون')).toBe(2_500_000);
    expect(parsePersianAmount('نیم میلیون')).toBe(500_000);
  });

  it('handles صد تومن as 100_000', () => {
    expect(parsePersianAmount('صد تومن دادم')).toBe(100_000);
  });

  it('handles word numbers and compounds', () => {
    expect(parsePersianAmount('دویست و پنجاه تومن')).toBe(250_000);
    expect(parsePersianAmount('یک میلیون و دویست هزار')).toBe(1_200_000);
  });

  it('handles میلیارد', () => {
    expect(parsePersianAmount('۱ و نیم میلیارد')).toBe(1_500_000_000);
  });

  it('does not mistake quantities for money', () => {
    expect(parsePersianAmount('تعویض ۳ فیلتر اول')).toBe(0);
  });

  it('extracts multiple marked amounts in order (total, paid, debt)', () => {
    const all = extractTomanAmounts('۴۵۰ تومن شد که ۳۵۰ تومن نقد داد و ۱۰۰ تومنش موند');
    expect(all.map((a) => a.value)).toEqual([450_000, 350_000, 100_000]);
  });

  it('bare numbers without a money marker are NOT extracted (quantity protection)', () => {
    // "۳۵۰ نقد" alone has no marker; paid/debt detection lives in the fallback
    // parser via keyword-anchored search, not here.
    const all = extractTomanAmounts('۴۵۰ تومن شد که ۳۵۰ نقد داد و ۱۰۰ تومنش موند');
    expect(all.map((a) => a.value)).toEqual([450_000, 100_000]);
  });

  it('returns 0 when no money is mentioned', () => {
    expect(parsePersianAmount('سلام چطوری')).toBe(0);
  });
});
