# AquaLedger AI — دستیار هوشمند مالی تکنسین تصفیه آب

Persian (fa-IR, RTL), mobile-first, offline-first finance / CRM / inventory assistant
for Iranian water-treatment technicians (salaried company shift + freelance field service).
Casual Persian text or voice becomes structured ledger entries via Gemini — with a
rule-based offline fallback, so the app works with no key and no network.

## Run

```bash
npm install --legacy-peer-deps   # esbuild peer conflict (pre-existing) needs the flag
npm run dev          # local Express + Vite middleware, http://localhost:3000
npm run dev:netlify  # local Netlify runtime (static + Functions), needs `netlify-cli`
npm run build        # production bundle to dist/ (PWA service worker included)
npm run verify       # lint + test + build (must be green before every phase)
npm run lint         # tsc --noEmit (must pass)
npm test             # vitest unit suite (no API key needed, Gemini mocked/avoided)
npm run test:e2e     # Playwright (needs a running server: E2E_BASE_URL=http://localhost:3000)
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
| `PORT` / `NODE_ENV` / `DISABLE_HMR` | Local Express dev | Unused on Netlify. |

> NEVER prefix a secret with `VITE_`: anything starting with `VITE_` ships inside
> `dist/` for everyone to read. `GEMINI_API_KEY` and any `service_role` key stay
> server-side only. Netlify's secrets scanner flags the public anon key in the
> bundle — allowlist ONLY `VITE_SUPABASE_ANON_KEY,SUPABASE_ANON_KEY` via the
> `SECRETS_SCAN_OMIT_KEYS` site env var. Never disable the whole scan.

## Deploy (Netlify + Supabase, step by step)

### 1. Supabase project

1. Create a project at supabase.com → copy Project URL + `anon` key.
2. SQL Editor → run `supabase/migrations/0001_ai_usage.sql` (daily AI quota
   table + RLS + atomic `bump_ai_usage()`). Confirm RLS is enabled (the file
   asserts it; no public table is left without RLS).
3. Authentication → URL Configuration:
   - Site URL = your Netlify URL, e.g. `https://aqualedger.netlify.app`.
   - Redirect URLs: add the Netlify URL, your custom domain (if any), and
     `http://localhost:3000` + `http://localhost:8888` (local dev).
   - Deploy Previews use random URLs (`https://deploy-preview-N--site.netlify.app`):
     either add a wildcard pattern if your plan allows, or test auth only on
     the main branch deploy.
4. Future Auth UI rule (binding): never hardcode a redirect host — always build
   callback URLs from `window.location.origin` so previews and custom domains work.

### 2. Netlify site

1. New site from git → build command `npm run build`, publish `dist`,
   functions `netlify/functions` (all already in `netlify.toml`).
2. Site settings → Environment variables:
   `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `SECRETS_SCAN_OMIT_KEYS=VITE_SUPABASE_ANON_KEY,SUPABASE_ANON_KEY`.
3. Deploy. Health check: `GET https://<site>/api/health` → `{"status":"ok"}`.
4. SPA fallback is a 200-rewrite AFTER `/api/*` (Functions keep precedence):
   refresh on `/clients` serves `index.html`, not 404.
5. Caching: `index.html`/`sw.js`/`workbox-*.js` always revalidate (update banner
   appears on new deploys); `/assets/*` immutable for a year.

### 3. Deploy Previews warning

Previews share the site env vars, so a preview build points at the SAME Supabase
project unless you override per-branch vars. Do not run auth/quota tests that
write data from a preview unless the preview has its own Supabase project env.

### 4. Acceptance checklist (on the Netlify URL)

- Signup/login works; refresh on any route never 404s.
- «از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت» analyzes;
  with an invalid Gemini key it still answers via fallback.
- `POST /api/analyze-transaction` without a token → 401.
- `grep -r GEMINI_API_KEY dist/` and `grep -ri service_role dist/` are empty.
- After a new deploy, an old open tab shows the «نسخه جدید آماده است» banner.
- Offline: the app opens and ledger entry works (shell cache + IndexedDB).

## Architecture

- `server.ts` + `server/` — Express: `/api/health`, `/api/analyze-transaction`,
  `/api/analyze-audio`; Gemini structured output validated with zod (retry 2×/600ms),
  `express-rate-limit` + body caps, rule-based Persian fallback parser.
- `src/types/` — domain types + zod schemas (single source of truth).
- `src/domain/` — pure functions: `financialEngine` (boss balance, ±500 status),
  `profit` (part-profit vs labor split), `reminders` (6mo filters / 24mo membrane),
  `inventory` (atomic stock planner), `reports` (daily/weekly/monthly P&L),
  `salary` (Jalali accrual memos), `serviceLog`.
- `src/data/` — Dexie v1 (IndexedDB) behind the `LedgerStore` interface
  (memory/local/Dexie impls), one-time localStorage migration, JSON backup/restore,
  offline AI outbox.
- `src/state/` — Context + useReducer over pure `transitions.ts`, memoized selectors,
  debounced IndexedDB persistence (+ flush on page hide).
- `src/lib/` — Persian number parsing (`۵۸۰ تومن` = 580_000, `نیم`, word numbers),
  Toman/Jalali formatters. `src/utils/` are re-export shims (do not import in new code).
- UI: dark RTL mobile-first shell, bottom tabs + mic FAB, dashboard KPIs, company /
  client ledgers with per-invoice settlement, CRM profiles, inventory, reports
  (recharts), PWA install prompt, Persian toasts.

## FR coverage (see docs/PLAN.md for the honest tracker)

FR-01 NLP entry + suspicious flags · FR-02 stream split with override · FR-03 boss
ledger · FR-04 salary incl. overtime/absence + month-end accrual · FR-05 per-invoice
client settlement · FR-06 CRM · FR-07 inventory with auto-decrement + low-stock alerts ·
FR-08 part-profit vs labor reports · FR-09 reminders (dashboard due/overdue lists) ·
FR-10 voice (MediaRecorder upload, Web Speech fallback, privacy notice) · FR-11
daily/weekly/monthly P&L charts · FR-12 offline-first PWA (shell cache, IndexedDB,
AI request queue, on-device fallback parse).

## Verification (last full run, 2026-10-10, `npm run verify`)

- `npm run lint` ✅ · `npm test` ✅ 108 unit tests, 15 files · `npm run build` ✅ (+SW)
- Netlify Functions smoke tests ✅ (sample ۵۸۰ → fallback 580_000, no-token 401,
  forced Gemini failure → fallback, empty 400, quota 429, health ok).
- Quota unit tests ✅ (under/at/over cap, RPC-error and no-env fail-open).
- PWA banner tests ✅ (hidden on first paint, Persian copy + single action).
- `grep GEMINI_API_KEY dist/` ✅ empty · `grep service_role dist/src/netlify/server` ✅ empty.
- Playwright/Chromium ✅ 3 specs: boot+migrate, happy path
  (type→preview→edit→confirm→balance→reload persists), offline shell+local parse.
- Server smoke-tested with curl (fallback analysis, suspicion flags, audio 400/503 gates).

## Known gaps (honest)

- Real Gemini paths (text/audio) need a key and are untested in CI (mocked/avoided).
- No E2E microphone recording (needs a fake media device); audio offline is out of scope.
- No local-notification reminders, no PDF export, no custom report date ranges.
- Auth UI + full Supabase data sync are future phases (Functions already verify JWT
  when configured; quota/auth fail open until then — see Phase D notes).
