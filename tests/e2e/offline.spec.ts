import { test, expect } from '@playwright/test';

// FR-12 offline: cached app shell + IndexedDB data render with zero network,
// and the local parser still produces a transaction preview.
test.use({ viewport: { width: 390, height: 844 } });

test('offline reload serves shell with data; local parse works', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('داشبورد مالی و تراز تکنسین')).toBeVisible({ timeout: 15000 });
  // Service worker must control the page before we cut the network.
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, {
    timeout: 20000,
  });

  await context.setOffline(true);
  await page.reload();
  // Shell + persisted seed data render with no network at all.
  await expect(page.getByText('داشبورد مالی و تراز تکنسین')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('main').getByText('تصفیه آب زلال گستر')).toBeVisible();

  // Offline AI: the on-device parser still produces a preview.
  await page.locator('main').getByRole('button', { name: 'ثبت هوشمند تراکنش' }).click();
  await page.locator('textarea').first().fill('از جیب ۵۸۰ تومن دادم پک فیلتر برای شرکت');
  await page.getByRole('button', { name: 'تحلیل و استخراج تراکنش' }).click();
  await expect(page.getByText('نتیجه تحلیل سند مالی')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('تحلیل محلی آفلاین').first()).toBeVisible();
});
