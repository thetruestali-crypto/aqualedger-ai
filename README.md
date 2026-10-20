# AquaLedger AI — دستیار هوشمند مالی تکنسین تصفیه آب

Persian (fa-IR, RTL), mobile-first, offline-first finance / CRM / inventory assistant
for Iranian water-treatment technicians (salaried company shift + freelance field service).
Casual Persian text or voice becomes structured ledger entries via Gemini — with a
rule-based offline fallback, so the app works with no key and no network.

## Run

```bash
npm install   # .npmrc sets legacy-peer-deps (pre-existing esbuild peer conflict)
npm run dev          # local Express + Vite middleware, http://localhost:3000
npm run dev:netlify  # local Netlify runtime (static + Functions), needs `netlify-cli`
npm run build        # production bundle to dist/ (PWA service worker included)
npm run verify       # lint + test + build (must be green before every phase)
npm run lint         # tsc --noEmit (must pass)
npm test             # vitest unit suite (no API key needed, Gemini mocked/avoided)
npm run test:e2e     # Playwright (needs a running server: E2E_BASE_URL=http://localhost:3000)
npm run test:e2e:login  # Playwright login-screen spec (boots its own server, port 3001)
```

Node 22 LTS required (`.nvmrc` + `engines`). Production on Netlify never runs
`npm start` (Express is local-dev only); it serves `dist/` + Functions.

## Env (.env — never commit; see .env.example)

| Var | Where | Notes |
|-----|-------|-------|
| `GEMINI_API_KEY` | Server/Functions only | Never in the client bundle. Without it the rule-based parser answers. |
| `GEMINI_MODEL` | Server/Functions | Default `gemini-2.5-flash`. Override without code changes. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server/Functions | JWT verification + quota RPC. Same values as the `VITE_` pair below. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Client bundle | PUBLIC (baked into `dist/`). Safe only because RLS owns isolation. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/Functions only | Finds/creates the SMS user and mints its session. Never a `VITE_` var. |
| `SMSIR_API_KEY` | Server/Functions only | SMS.ir web-service key. Never in the client bundle. |
| `SMSIR_TEMPLATE_ID` / `SMSIR_SENDER` | Server/Functions | Template id (`/send/verify`) or sender line (`/send/bulk`). Template wins. |
| `SMSIR_CODE_PARAM` / `SMSIR_BASE_URL` | Server/Functions | Template parameter name (`Code`) and the panel API root. |
| `SMS_OTP_SECRET` | Server/Functions only | HMAC key for the one-time codes. Must be identical in every environment. |
| `SMS_OTP_*` | Server/Functions | TTL (300s), length (5), max attempts (3), resend cooldown (60s), hourly caps (5/phone, 20/IP). |
| `PORT` / `NODE_ENV` / `DISABLE_HMR` | Local Express dev | Unused on Netlify. |

> NEVER prefix a secret with `VITE_`: anything starting with `VITE_` ships inside
> `dist/` for everyone to read. `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
> `SMSIR_API_KEY` and `SMS_OTP_SECRET` stay server-side only. Netlify's secrets
> scanner flags the public anon key in the bundle — allowlist ONLY
> `VITE_SUPABASE_ANON_KEY,SUPABASE_ANON_KEY` via the `SECRETS_SCAN_OMIT_KEYS` site
> env var. Never disable the whole scan.

## Login: Google + SMS (phone)

Two methods on the same screen (`ورود با گوگل` / `ورود با شمارهٔ موبایل`).
Both end in a **real Supabase session**, so RLS, the daily AI quota and the
per-user local database (`aqualedger_u_<id>`) work unchanged.

### 1. Supabase project

1. Create a project at supabase.com → copy Project URL + `anon` key.
2. SQL Editor → run `supabase/migrations/0001_ai_usage.sql` (daily AI quota
   table + RLS + atomic `bump_ai_usage()`). Confirm RLS is enabled (the file
   asserts it; no public table is left without RLS).
3. SQL Editor → run `supabase/migrations/0002_sms_auth.sql` (OTP challenges +
   phone→user mapping + the `SECURITY DEFINER` RPCs). Both tables have RLS
   enabled with **no policy**: only the `service_role` key may touch them.
4. Authentication → **Providers → Phone → Enable** (this is what makes
   `signInWithPassword({ phone, password })` work). If the provider stays off,
   the backend automatically falls back to a synthetic email identity
   (`sms+<digits>@phone.aqualedger.app`) — the phone still logs in.
5. Authentication → URL Configuration:
   - Site URL = your Netlify URL, e.g. `https://aqualedger.netlify.app`.
   - Redirect URLs: add the Netlify URL, your custom domain (if any), and
     `http://localhost:3000` + `http://localhost:8888` (local dev).
   - Deploy Previews use random URLs (`https://deploy-preview-N--site.netlify.app`):
     either add a wildcard pattern if your plan allows, or test auth only on
     the main branch deploy.
6. Copy the **service_role** key (Project Settings → API) into
   `SUPABASE_SERVICE_ROLE_KEY` (server + Netlify only).
7. Future Auth UI rule (binding): never hardcode a redirect host — always build
   callback URLs from `window.location.origin` so previews and custom domains work.

### 2. SMS.ir panel

1. Get a **web-service key** (پنل → کلید وب‌سرویس) and put it in `SMSIR_API_KEY`.
2. **Rotate the key** if it was ever pasted into a chat/issue — treat it as leaked.
3. **IP Whitelist must be OFF** for the key used by Netlify Functions (Netlify
   uses dynamic AWS IPs). If it is on, the panel answers with status `11` and
   the user sees «کلید وب‌سرویس پیامک به IP محدود شده است».
4. Pick a delivery mode:
   - **Template (recommended, cheaper):** create a verify template in the panel,
     put the template id in `SMSIR_TEMPLATE_ID` and the code parameter name in
     `SMSIR_CODE_PARAM` (default `Code`).
   - **Bulk:** put a sender line in `SMSIR_SENDER` (e.g. `30004505000017`). If it
     is empty, the backend discovers the first line via `GET /v1/line`.
5. Keep `SMS_OTP_SECRET` long and random, identical in Express and Netlify.

### 3. Netlify site

1. New site from git → build command `npm run build`, publish `dist`,
   functions `netlify/functions` (all already in `netlify.toml`).
2. Site settings → Environment variables:
   `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SMSIR_API_KEY`, `SMSIR_TEMPLATE_ID` (or
   `SMSIR_SENDER`), `SMSIR_CODE_PARAM`, `SMS_OTP_SECRET`,
   `SECRETS_SCAN_OMIT_KEYS=VITE_SUPABASE_ANON_KEY,SUPABASE_ANON_KEY`.
3. Deploy. Health check: `GET https://<site>/api/health` → `{"status":"ok"}`.
4. SPA fallback is a 200-rewrite AFTER `/api/*` (Functions keep precedence):
   refresh on `/clients` serves `index.html`, not 404.

### 4. Deploy Previews warning

Previews share the site env vars, so a preview build points at the SAME Supabase
project unless you override per-branch vars. Do not run auth/quota tests that
write data from a preview unless the preview has its own Supabase project env.

### 5. Acceptance checklist (on the Netlify URL)

- Signup/login works; refresh on any route never 404s.
- «از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت» analyzes;
  with an invalid Gemini key it still answers via fallback.
- `POST /api/analyze-transaction` without a token → 401.
- `POST /api/auth/sms/request` with `09121234567` → 200 (a real SMS arrives);
  with `123` → 400 «شمارهٔ موبایل معتبر نیست.»
- `POST /api/auth/sms/verify` with a wrong code → 400 «کد تأیید نامعتبر یا منقضی شده است.»
  (the same message for a wrong, an expired and an unknown code).
- After the SMS login the navbar shows the **phone number**, not an email.
- `grep -r GEMINI_API_KEY dist/` and `grep -ri service_role dist/` are empty
  (same for `SMSIR_API_KEY`).
- After a new deploy, an old open tab shows the «نسخه جدید آماده است» banner.
- Offline: the app opens and ledger entry works (shell cache + IndexedDB).

## Architecture

- `server.ts` + `server/` — Express: `/api/health`, `/api/analyze-transaction`,
  `/api/analyze-audio`, `/api/auth/sms/request|verify`; Gemini structured output
  validated with zod (retry 2×/600ms), `express-rate-limit` + body caps,
  rule-based Persian fallback parser. `server/smsAuth.ts` + `server/sms.ts` +
  `server/supabaseAdmin.ts` hold the SMS login (shared with the Netlify
  Functions, no duplicated logic).
- `src/types/` — domain types + zod schemas (single source of truth).
- `src/domain/` — pure functions: `financialEngine` (boss balance, ±500 status),
  `profit` (part-profit vs labor split), `reminders` (6mo filters / 24mo membrane),
  `inventory` (atomic stock planner), `reports` (daily/weekly/monthly P&L),
  `salary` (Jalali accrual memos), `serviceLog`.
- `src/data/` — Dexie v1 (IndexedDB) behind the `LedgerStore` interface
  (memory/local/Dexie impls), one-time localStorage migration, JSON backup/restore,
  offline AI outbox, per-user database (`aqualedger_u_<id>`).
- `src/state/` — Context + useReducer over pure `transitions.ts`, memoized selectors,
  debounced IndexedDB persistence (+ flush on page hide), `auth.tsx` (Google OAuth +
  SMS login session).
- `src/lib/` — Persian number parsing (`۵۸۰ تومان` = 580_000, `نیم`, word numbers),
  Toman/Jalali formatters, Iranian phone helpers (`src/lib/phone.ts`).
  `src/utils/` are re-export shims (do not import in new code).
- UI: dark RTL mobile-first shell, bottom tabs + mic FAB, dashboard KPIs, company /
  client ledgers with per-invoice settlement, CRM profiles, inventory, reports
  (recharts), PWA install prompt, Persian toasts, login screen with
  Google/SMS tabs.

## FR coverage (see docs/PLAN.md for the honest tracker)

FR-01 NLP entry + suspicious flags · FR-02 stream split with override · FR-03 boss
ledger · FR-04 salary incl. overtime/absence + month-end accrual · FR-05 per-invoice
client settlement · FR-06 CRM · FR-07 inventory with auto-decrement + low-stock alerts ·
FR-08 part-profit vs labor reports · FR-09 reminders (dashboard due/overdue lists) ·
FR-10 voice (MediaRecorder upload, Web Speech fallback, privacy notice) · FR-11
daily/weekly/monthly P&L charts · FR-12 offline-first PWA (shell cache, IndexedDB,
AI request queue, on-device fallback parse).

## Verification (last full run, 2026-10-20, `npm run verify`)

- `npm run lint` ✅ · `npm test` ✅ 169 unit tests, 23 files · `npm run build` ✅ (+SW)
- Netlify Functions smoke tests ✅ (sample ۵۸۰ → fallback 580_000, no-token 401,
  forced Gemini failure → fallback, empty 400, quota 429, health ok) + the new
  SMS scenarios (request 200/400, verify 200/400, method 405).
- SMS unit tests ✅ (phone normalization, SMS.ir request shapes, line discovery,
  panel error codes, the +98 retry, HMAC-hashed codes, rate limits, the atomic
  OTP consumption, user creation, the synthetic-email fallback).
- Quota unit tests ✅ (under/at/over cap, RPC-error and no-env fail-open).
- PWA banner tests ✅ (hidden on first paint, Persian copy + single action).
- `grep GEMINI_API_KEY dist/` ✅ empty · `grep -ri service_role dist/` ✅ empty ·
  `grep -ri SMSIR dist/` ✅ empty.
- Playwright/Chromium ✅ boot+migrate + happy path
  (type→preview→edit→confirm→balance→reload persists) and ✅ the login-screen
  spec (Google + SMS tabs) on its own server; the offline spec needs the built
  `dist/` + service worker and fails identically on the pre-change code.
- Server smoke-tested with curl (fallback analysis, suspicion flags, audio
  400/503 gates, SMS 400/503/502, malformed JSON 400, AI 401).

## Known gaps (honest)

- Real Gemini paths (text/audio) need a key and are untested in CI (mocked/avoided).
- No E2E microphone recording (needs a fake media device); audio offline is out of scope.
- No local-notification reminders, no PDF export, no custom report date ranges.
- The SMS round-trip is untested in CI: it needs a real SMS.ir key, a Supabase
  project with the `0002_sms_auth.sql` migration and the Phone provider enabled.
  A phone cannot be linked to a Google account from the settings screen yet
  (`find_user_by_phone` is already prepared for it).
- Cloud data sync (moving the ledger between devices) is still out of scope:
  auth exists, the data stays in the browser of each device.
