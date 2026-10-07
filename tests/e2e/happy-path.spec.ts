import { test, expect } from '@playwright/test';

// Full happy path (Phase 8): type -> preview -> edit -> confirm ->
// balance updates -> reload -> data persists (Dexie).
// No API key in this environment, so the server-side rule-based fallback
// parser answers deterministically.
test('smart entry happy path persists across reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('داشبورد مالی و تراز تکنسین')).toBeVisible({ timeout: 15000 });

  // 1. Open smart entry (desktop top tabs).
  await page.getByRole('button', { name: 'ورودی صوتی و هوشمند' }).click();
  const box = page.locator('textarea').first();
  await box.fill('از جیب خودم ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت مهندس جلالی');

  // 2. Analyze -> preview card appears.
  await page.getByRole('button', { name: 'تحلیل و استخراج تراکنش' }).click();
  await expect(page.getByText('نتیجه تحلیل سند مالی')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('۵۸۰,۰۰۰ تومان').first()).toBeVisible();

  // 3. Confirm -> lands on the company ledger showing the new amount.
  await page.getByRole('button', { name: 'تایید و ثبت نهایی در دفتر حساب' }).click();
  await expect(page.getByText('ریز فاکتورها و اسناد شرکت')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('۵۸۰,۰۰۰ تومان').first()).toBeVisible();

  // 4. Boss balance reflects the new out-of-pocket expense.
  await expect(page.getByText('شما از').first()).toBeVisible();

  // 5. Reload -> the transaction persists (IndexedDB, not memory).
  // (Durability is debounced at 500ms; a real user pause covers it.)
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByText('داشبورد مالی و تراز تکنسین')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'دفتر حساب رئیس و شرکت' }).click();
  await expect(page.getByText('۵۸۰,۰۰۰ تومان').first()).toBeVisible({ timeout: 15000 });
});
