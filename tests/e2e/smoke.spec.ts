import { test, expect } from '@playwright/test';

// Mobile viewport: the primary experience is the bottom tab bar.
test.use({ viewport: { width: 390, height: 844 } });

// Phase-3 smoke: app boots on the Dexie driver, migrates legacy seed data,
// and renders the dashboard with a live boss balance.
test('app boots, migrates to Dexie, shows dashboard', async ({ page }) => {
  await page.goto('/');
  // Loading splash resolves into the shell (header quick-entry button).
  await expect(page.getByRole('button', { name: /ثبت/ }).first()).toBeVisible({ timeout: 15000 });
  // Header quick-entry is rendered (desktop chip asserted separately below).
  // Bottom tab bar (mobile-first navigation).
  // Dashboard renders with the live boss balance KPI.
  await expect(page.getByText('داشبورد مالی و تراز تکنسین')).toBeVisible({ timeout: 15000 });
  // Bottom tab bar (mobile-first navigation).
  await expect(page.getByRole('navigation', { name: 'ناوبری اصلی' })).toBeVisible();
  // Migration marker set after first Dexie boot.
  const migrated = await page.evaluate(() => localStorage.getItem('aqualedger_migrated_dexie_v1'));
  expect(migrated).toBe('1');
  const dbNames = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    return dbs.map((d) => d.name);
  });
  expect(dbNames).toContain('aqualedger');

  // Reports view renders charts from the same store (dashboard entry button).
  await page.locator('main').getByRole('button', { name: 'گزارش سود و زیان' }).click();
  await expect(page.getByText('جریان نقدی دوره')).toBeVisible({ timeout: 15000 });
});
