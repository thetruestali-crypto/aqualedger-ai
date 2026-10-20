import { defineConfig, devices } from '@playwright/test';

// Login-screen E2E: the login gate only renders when Supabase is configured,
// so this config boots a dedicated server with dummy PUBLIC env values
// (the anon key is public by design — RLS is the real protection).
// The regular specs in playwright.config.ts keep running without Supabase.
export default defineConfig({
  testDir: './tests/e2e-login',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3001',
  },
  webServer: {
    command:
      'PORT=3001 VITE_SUPABASE_URL=https://dummy.supabase.co VITE_SUPABASE_ANON_KEY=dummy-anon-key npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
