# AquaLedger AI — دستیار هوشمند مالی تکنسین تصفیه آب

Persian (fa-IR, RTL), mobile-first, offline-first finance / CRM / inventory assistant
for Iranian water-treatment technicians (salaried company shift + freelance field service).
Casual Persian text or voice becomes structured ledger entries via Gemini — with a
rule-based offline fallback, so the app works with no key and no network.

## Run

```bash
npm install --legacy-peer-deps
npm run dev      # Express + Vite middleware, http://localhost:3000
npm run build    # production bundle to dist/ (PWA service worker included)
npm start        # serve dist/ (set NODE_ENV=production)
npm run lint     # tsc --noEmit (must pass)
npm test         # vitest unit suite (no API key needed, Gemini mocked/avoided)
npm run test:e2e  # Playwright (needs a running server: E2E_BASE_URL=http://localhost:3000)
```

## Env (.env — never commit; see .env.example)

| Var | Default | Notes |
|-----|---------|-------|
| `GEMINI_API_KEY` | — | Server only, never in the client bundle. Without it the rule-based parser answers. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Override without code changes. |
| `PORT` | `3000` | Express port. |
| `NODE_ENV` | — | `production` serves `dist/` statically. |
| `DISABLE_HMR` | — | `true` disables Vite HMR/file-watching. |

## Deploy

Any Node host: `npm install --legacy-peer-deps && npm run build && NODE_ENV=production PORT=3000 npm start`.
Health check: `GET /api/health`. Data lives in the browser (IndexedDB) — nothing to back up
server-side; users export JSON backups from Settings.

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

## Verification (last full run, 2026-10-08)

- `npm run lint` ✅ · `npm test` ✅ 95 unit tests, 12 files · `npm run build` ✅ (+SW)
- Playwright/Chromium ✅ 3 specs: boot+migrate, happy path
  (type→preview→edit→confirm→balance→reload persists), offline shell+local parse.
- Server smoke-tested with curl (fallback analysis, suspicion flags, audio 400/503 gates).

## Known gaps (honest)

- Real Gemini paths (text/audio) need a key and are untested in CI (mocked/avoided).
- No E2E microphone recording (needs a fake media device); audio offline is out of scope.
- No local-notification reminders, no PDF export, no custom report date ranges.
- No cloud sync / auth / multi-user (out of scope by design; repository interface ready).
