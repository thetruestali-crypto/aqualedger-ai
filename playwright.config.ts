import { defineConfig, devices } from '@playwright/test';

// Phase 8 E2E: type -> preview -> edit -> confirm -> balance updates -> reload persists.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
