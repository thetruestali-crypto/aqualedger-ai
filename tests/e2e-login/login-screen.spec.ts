import { test, expect } from '@playwright/test';

// The login gate appears when Supabase is configured. Both methods must be
// reachable: Google OAuth and the SMS (phone code) login.
test('login screen offers Google and SMS login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('AquaLedger AI').first()).toBeVisible({ timeout: 15000 });

  await expect(page.getByRole('tab', { name: 'ورود با گوگل' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'ورود با شمارهٔ موبایل' })).toBeVisible();

  // The offline escape hatch always stays available.
  await expect(page.getByRole('button', { name: /ادامه بدون ورود/ })).toBeVisible();

  // Switching to the phone tab reveals the SMS form.
  await page.getByRole('tab', { name: 'ورود با شمارهٔ موبایل' }).click();
  await expect(page.getByRole('button', { name: 'ارسال کد تأیید' })).toBeVisible();
  await expect(page.getByPlaceholder('۰۹۱۲۱۲۳۴۵۶۷')).toBeVisible();
});
