# PLAN.md — AquaLedger AI Build Plan

> Source docs: `docs/PRD.md` (WHAT), `docs/ARD.md` (HOW, overridden by master-prompt §2 where they conflict).
> Status legend: `[x]` done · `[ ]` pending. Gate per phase: `npm run lint` + `npm test` + `npm run build` green.

## Phase 0 — Audit of existing codebase (DONE 2026-10-07)

Existing code (Google AI Studio export) already runs: `tsc --noEmit` ✅, `vite build` ✅ (1672 modules,
~334KB JS). Present: React 19 SPA, Tailwind v4, Express+Gemini structured-output endpoint with 2x retry +
rule-based fallback parser, Web Speech API (fa-IR) + text entry with preview/edit screen, company/client
ledgers, inventory view, settings, WhatsApp-ready export modal, user-guide modal, demo seed data,
localStorage persistence (`aqualedger_*_v1`), Jalali/Persian formatters, boss-balance engine with ±500
threshold, sample prompts incl. the ARD fallback sentence.

Gaps vs PRD/master-prompt: localStorage instead of Dexie/IndexedDB (FR-12) · no zod validation ·
no rate-limit/body limits · model id `gemini-3.8-flash` does not exist · no `/api/analyze-audio` (FR-10
server side) · no MediaRecorder upload path · no PWA/service worker/manifest · no offline AI queue ·
no Context/reducer (props drilling, compute-on-render, sync persistence) · no overtime/absence in salary
formula (FR-04) · no service-log entity / atomic stock decrement (FR-07) · no part-profit vs labor split
in reports (FR-08) · no reminders engine/due list (FR-09) · no charts/KPI reports (FR-11) · no JSON
full-backup import (export exists) · no tests at all · `strict` not set in tsconfig · `.env.example`
missing `GEMINI_MODEL/PORT/NODE_ENV/DISABLE_HMR` · scripts missing `test`, `test:e2e`.

## Phase 1 — Audit + upgrade tooling (DONE 2026-10-07)

- [x] Audit + AGENTS.md + PLAN.md + DECISIONS.md
- [x] package.json: `dexie@4.4.6`, `zod@4.6.5`, `vite-plugin-pwa@2.0.0`, `recharts@3.10.1`,
  `express-rate-limit@8.7.1`, `vitest@5.0.3`, `@playwright/test@1.63.0`; scripts `test`, `test:e2e`
- [x] `.env.example`: GEMINI_MODEL, PORT, NODE_ENV, DISABLE_HMR
- [x] `tsconfig.json`: `strict: true` (lint still green)
- [x] Layout: `server/`, `src/types/schemas.ts`, `src/domain/`, `src/lib/`, `src/data/`,
  `src/state/`, `src/pwa/`, `tests/`; `src/utils/*` are re-export shims
- [x] Server hardening: rate-limit (30/10min) + body limits on AI routes, zod request
  validation, `GEMINI_MODEL` env (default `gemini-2.5-flash`), shared Persian-number lib,
  `POST /api/analyze-audio` (400 invalid / 503 w/o key / Gemini multimodal w/ key)
- [x] PWA skeleton: manifest (fa/RTL) + generated SW (`dist/sw.js`, 5 precached entries)
  + `useInstallPrompt` + theme-color meta
- [x] Vitest harness + 27 unit tests (boss balance, Persian numbers, fallback parser).
  Gate verified: `lint` ✅ `test` (27/27) ✅ `build` (+SW) ✅; server smoke-tested
  (`/api/health`, fallback analysis without key, audio validation).

## Phase 2 — Domain + data (DONE 2026-10-07)

- [x] Types/zod: `Transaction.settled`, `ServiceLog`/`ServiceLogItem`, AI `confidence`/`warnings`;
  zod `transaction/client/part/serviceLog/settings/backupPayload` schemas
- [x] Dexie v1 (`src/data/db.ts`) + `LedgerStore` interface (`repository.ts`) with 3 impls:
  `memoryStore` (tests), `localStore` (current UI driver), `dexieStore` (atomic
  `decrementStock` in a Dexie rw-transaction); one-time localStorage import
  (`migrate.ts`, idempotent, reader-injectable); seed moved to `src/data/seed.ts`
- [x] Full JSON backup in Settings: export (all 5 entities) + import (file picker,
  confirm dialog, zod-validated BEFORE state changes); overtime/absence settings
  fields + full `BaseAccrued` preview (FR-04 config complete)
- [x] Pure engines + tests: finance (existing, extended), `profit` (FR-08 split),
  `reminders` (FR-09: 6mo/24mo, due-soon 14d), `inventory` (FR-07 atomic planner),
  Persian numbers + fallback (existing, hardened)
- [x] Gate: `lint` ✅ `test` (55 tests, 7 files) ✅ `build` (+SW) ✅; server smoke test:
  partial-payment sentence → `client_receivable` 450k/350k/100k ✅
- [ ] Deferred (honest): real IndexedDB instantiation untested (no fake-indexeddb yet —
  Dexie paths covered by interface-level tests via memory store); App cutover from
  localStorage to Dexie happens in Phase 3

## Phase 3 — State + app shell (DONE 2026-10-07)

- [x] Pure `transitions.ts` (all AppState changes testable; client auto-create/update,
  clamped debt settlement + settlement tx, backup replace); `selectors.ts` memoized
  in the provider (`useMemo` summaries/reminders/low-stock — no more compute-on-render)
- [x] `AppStoreProvider`: async Dexie boot + one-time legacy migration, debounced
  (500ms) snapshot persistence via `importBackup`, loading splash, local-driver
  fallback when IndexedDB is unavailable; App rewritten thin on the store
- [x] Mobile bottom tab bar (5 tabs + raised mic FAB; desktop keeps top tabs),
  Persian toast stack (success/error/info), confirm dialogs on destructive actions
- [x] Gate: `lint` ✅ `test` (63 unit) ✅ `build` (+SW) ✅ + real-Chromium smoke E2E:
  boot → Dexie migration marker → dashboard + bottom nav, zero console errors ✅
- [ ] Deferred (honest): full happy-path E2E (type→preview→confirm→balance→reload)
  is Phase 8; service-worker offline behavior is Phase 7

## Phase 4 — Ledgers + inventory + reminders (DONE 2026-10-07)

- [x] Company ledger: payout quick-add button, manual salary-accrual memo + auto-accrue
  on boot (FR-04 complete; engine stays settings-driven, memos excluded from sums),
  correct per-type row styling; fixed `transactionType: any`
- [x] Client ledger: per-invoice open/invoice cards with partial settlement
  (`SETTLE_INVOICE` mutates the invoice, no double-counting); aggregate settle
  allocates oldest-first + residual receipt; `ClientDetailModal` (profile edit,
  invoices, parts-used, full history); filters + search kept (FR-05/06)
- [x] Inventory + service: field sales auto-decrement stock via driver (best-effort
  with warning toast) + parts refresh; `ServiceLog` auto-derived per sale;
  per-part low-stock thresholds + row alerts; dashboard overdue/due-soon/low-stock
  banners from memoized selectors (FR-07/08/09)
- [x] Engines: `domain/salary` (Jalali accrual keys), `domain/serviceLog`,
  `selectClientInvoices/History`, `SET_PARTS`
- [x] Gate: `lint` ✅ `test` (76 unit) ✅ `build` (+SW) ✅ + full happy-path E2E
  (type→preview→confirm→balance→reload persists) ✅ — which caught a real durability
  race (reload inside the 500ms debounce), fixed with visibility/pagehide flush
- [ ] Deferred (honest): local Notification reminders → Phase 7 (needs PWA plumbing);
  invoice edit/delete UI; reports/charts → Phase 6

## Phase 5 — AI: flags, override, voice (DONE 2026-10-08)

- [x] Server: deterministic `finalizeAnalysis` on every result (zero / >500M / paid>total
  normalize / >10x `typicalAmount` from client context + confidence penalty); zod re-check;
  retry/rate-limit/fallback already in place
- [x] SmartQuickEntry: stream/type/payment/role override selects with balance recompute,
  warnings box + confidence %, 30s timeout, offline guard, `typicalAmount` in context
- [x] Voice: MediaRecorder primary → `/api/analyze-audio` (same preview/edit flow);
  503/no-key auto-falls-back to Web Speech fa-IR; one-line privacy notice; manual entry
  never blocked
- [x] Gate: `lint` ✅ `test` (85 unit) ✅ `build` ✅ + 2 E2E ✅; server curl-verified
  (10x flag, 400/503 audio gates)
- [ ] Deferred (honest): real Gemini audio path untested (no key in CI); E2E mic
  recording (needs fake media device); offline AI queue → Phase 7

## Phase 6 — Reports & export (FR-11 + extras)

- [ ] Daily/weekly/monthly: company income, field income, expenses, part profit, net profit; charts + KPIs
- [ ] WhatsApp-ready boss statement + client invoice (copy button); user-guide modal; reset-to-demo

## Phase 7 — Offline hardening (FR-12)

- [ ] App-shell caching, IndexedDB data, offline AI queue ("pending" state), local fallback parse,
  install prompt, self-hosted Vazirmatn, migration + backup/restore tests

## Phase 8 — QA & polish

- [ ] Playwright E2E (type → preview → edit → confirm → balance → reload persists)
- [ ] README (setup/env/run/deploy), final PRD checklist review, honest gap list

## FR coverage tracker

| FR | Status | Notes |
|----|--------|-------|
| FR-01 NLP entry | partial | text+WebSpeech+preview exist; needs zod/suspicious flags/tests |
| FR-02 stream split | partial | exists; needs override + tests |
| FR-03 boss ledger | partial | exists; needs Dexie + live header (have) |
| FR-04 salary mgmt | partial | base−insurance only; needs overtime/absence/accrual |
| FR-05 client ledger | partial | exists; needs per-invoice cards/filters/polish |
| FR-06 CRM | partial | exists; needs breakdown history/search polish |
| FR-07 inventory | partial | CRUD exists; needs atomic decrement + alerts + tests |
| FR-08 part profit | missing | needs engine + report split + tests |
| FR-09 reminders | partial | dates exist; needs engine + due list + tests |
| FR-10 voice | partial | WebSpeech only; needs MediaRecorder + `/api/analyze-audio` |
| FR-11 reports | missing | needs charts + KPIs |
| FR-12 offline PWA | missing | needs Dexie + SW + queue + install prompt |
