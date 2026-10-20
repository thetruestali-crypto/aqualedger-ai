# AGENTS.md — AquaLedger AI Project Rules

> Persian (fa-IR, RTL) mobile-first offline-first finance/CRM/inventory assistant
> for Iranian water-treatment technicians. All user-facing text in Persian, RTL.
> Code, comments, commit messages in English.

## Commands

- `npm run dev` — Express + Vite middleware (HMR unless DISABLE_HMR=true)
- `npm run build` — `vite build` to `dist/`
- `npm start` — prod server (serves `dist/`)
- `npm run lint` — `tsc --noEmit` (must pass before a phase is done)
- `npm test` — `vitest run` (unit; no real API key needed, Gemini mocked)
- `npm run test:e2e` — Playwright happy path (type -> preview -> confirm -> balance -> reload persists)
- Env: `GEMINI_API_KEY` (server only), `GEMINI_MODEL` (default `gemini-2.5-flash`),
  `PORT` (3000), `NODE_ENV`, `DISABLE_HMR`. See `.env.example`. Never commit secrets.

## Architecture (binding)

- Storage: Dexie (IndexedDB), schema version + migrations from day one.
  Repository interface in `src/data/` so sync can be added later. No cloud data sync
  (auth exists: Google OAuth + SMS/phone code, see `docs/DECISIONS.md` D27-D32).
- AI only from Express server (`server.ts` + `server/`); key never reaches browser.
  Gemini structured output (`responseSchema`) validated with zod; invalid -> retry max 2
  with 600ms backoff -> rule-based Persian fallback parser. App usable offline / without key
  (manual entry always available; queue AI requests with "pending" state when offline).
- Voice: MediaRecorder -> POST audio to `/api/analyze-audio` -> Gemini multimodal ->
  same structured result as text. Fallback: Web Speech API (fa-IR) if available, else clear
  message + text box. One-line privacy notice: audio sent for transcription, not stored.
- Money: integer Toman only (never floats). Display Persian digits + thousands separators.
- Boss balance (Appendix B): `BossNet = (BaseAccrued + OutOfPocket) - (Advances + Payouts)`,
  `BaseAccrued = max(0, Base - Insurance + Overtime - Absence)`.
  Status: `> +500` creditor, `< -500` debtor, else settled.
- State: React Context + useReducer (or Zustand); derived summaries memoized (useMemo);
  persisted via debounced writes to IndexedDB. UI never computes money; it calls `domain/`.

## Layout

- `server.ts` — Express: `/api/health`, `/api/analyze-transaction`, `/api/analyze-audio`,
  `/api/auth/sms/request|verify`, Vite/static
- `server/` — gemini client, zod validators, fallbackParser, rateLimit, smsAuth/sms
  (SMS.ir + Supabase admin; shared with `netlify/functions/`)
- `src/types/` — domain types + zod schemas (single source of truth)
- `src/domain/` — PURE functions: financialEngine, inventory, reminders, profit (no DOM/network, 100% unit-tested)
- `src/data/` — Dexie db, repositories, migrations, export/import, seed
- `src/state/` — context/reducer, selectors, auth (Google OAuth + SMS login)
- `src/lib/` — formatters (toman, Persian digits, Jalali), persian number parsing, phone helpers
- `src/components/`, `src/views/` — UI; `src/pwa/` — SW config, install prompt
- `tests/` — unit + e2e; `docs/` — PRD.md, ARD.md, PLAN.md, DECISIONS.md
- Compat shims: `src/utils/*` re-export from `src/domain/*` / `src/lib/*`. Do not import
  from `src/utils/` in new code.

## Persian number rules (Gemini prompt + fallback + tests)

- Persian/Arabic digits normalized; `هزار` x1_000, `میلیون/ملیون` x1_000_000, `میلیارد` x1e9.
- `نیم` / `و نیم` = +0.5 of preceding unit (e.g. `۲ و نیم میلیون` = 2_500_000).
- `صد تومن` = 100_000 (bare small numbers with تومن imply x1000).
- Casual speech: bare `۵۸۰ تومن` (value < 1000 + تومن, no explicit unit) means 580_000 Toman.
- Word numbers (یک..ده, بیست..نود, صد..نهصد, دویست...) parsed; covered by unit tests.

## Conventions

- TypeScript strict; RTL everywhere (logical CSS properties); Jalali via `Intl fa-IR-u-ca-persian`.
- Dark theme default, high contrast, large touch targets; bottom tabs:
  Dashboard, Company, Clients, Inventory, Settings + prominent quick-entry (mic) button.
- Small reviewable commits (`feat:`, `fix:`, `test:`, `docs:`). No scope creep; no deleting required features.
- Ambiguity: pick the reasonable option, log in `docs/DECISIONS.md`.
- Never fabricate test results; run commands, report real output.
- `metadata.json` untouched unless it breaks something.
