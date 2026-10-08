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

## Phase 6 — Reports & export (DONE 2026-10-08)

- [x] `domain/reports`: daily/weekly/monthly buckets (exact Jalali-month anchors),
  companyIn/Out, fieldIn, partsCost, partProfit vs labor split, toolExpense, net;
  memos excluded, future rows ignored
- [x] `ReportsView` (recharts ComposedChart + stacked part/labor + bucket table + KPIs,
  dark theme, Jalali labels); reachable via dashboard button + desktop navbar tab
  (mobile bottom bar stays at 6 slots by spec)
- [x] Extras already present and kept: WhatsApp-ready export modal, user guide,
  reset-to-demo, full JSON backup/restore
- [x] Gate: `lint` ✅ `test` (90 unit) ✅ `build` ✅ + E2E (reports render) ✅
- [ ] Deferred (honest): PDF export (out of scope); custom date ranges

## Phase 7 — Offline hardening (DONE 2026-10-08)

- [x] App-shell caching (generateSW + `skipWaiting`/`clientsClaim`, 17 precached entries),
  SW registered in `main.tsx`; PWA icons generated + manifest + install card in Settings
  (`useInstallPrompt`); self-hosted Vazirmatn (arabic+latin subsets, Google Fonts removed)
- [x] Offline AI queue (`data/outbox` on the Dexie `pendingQueue`): network failures
  enqueue with visible pending list + manual retry/delete; offline analyze routes to the
  on-device parser automatically (+ always-available "تحلیل محلی" button); local parse
  reuses the same `fallback + finalize` pipeline as the server
- [x] Tests: real-Dexie suite via `fake-indexeddb` (store CRUD, atomic decrement,
  backup round-trip, migration into real Dexie, outbox); offline E2E (kill network →
  reload shell+data → local parse preview)
- [x] Gate: `lint` ✅ `test` (95 unit) ✅ `build` ✅ + 3 E2E ✅
- [ ] Deferred (honest): local Notification reminders (needs UX + timing design, still
  optional per PRD); queued *audio* (text queue only — transcription needs network)

## Phase 8 — QA & polish (DONE 2026-10-08)

- [x] E2E extended with the preview **edit** step (type → preview → edit → confirm →
  balance → reload persists); 3 Chromium specs green
- [x] README rewritten (setup/env/run/deploy, architecture, FR coverage, verification,
  honest gaps)
- [x] Final PRD review + honest gap list (below)
- [x] Gate: `lint` ✅ `test` (95 unit) ✅ `build` ✅ + 3 E2E ✅

## FR coverage tracker (final, verified)

| FR | Status | Evidence |
|----|--------|----------|
| FR-01 NLP entry + flags | ✅ done | text/mic → zod-validated JSON, preview/edit, warnings (zero/huge/10x) |
| FR-02 stream split | ✅ done | auto split + user override (stream/type/payment/role) |
| FR-03 boss ledger | ✅ done | quick-add ×3, live header balance, WhatsApp statement |
| FR-04 salary mgmt | ✅ done | base−insurance+overtime−absence, manual + auto month-end accrual memos |
| FR-05 client ledger | ✅ done* | per-invoice cards, partial settle, aggregate oldest-first, settle action (*no invoice status filter chips) |
| FR-06 CRM | ✅ done | profile edit, device brand, breakdown history, parts used, creditor/due search |
| FR-07 inventory | ✅ done | CRUD, atomic auto-decrement on sale, per-part thresholds + alerts |
| FR-08 part profit | ✅ done | engine split + per-part margins + report charts/table |
| FR-09 reminders | ✅ done* | 6mo/24mo engine, dashboard overdue/due-soon, client badges (*no local Notification) |
| FR-10 voice | ✅ done* | MediaRecorder→server, Web Speech fallback, privacy notice (*live Gemini audio path untested — no key) |
| FR-11 reports | ✅ done* | daily/weekly/monthly, KPIs, cash-flow + part/labor charts, bucket table (*no PDF/custom ranges) |
| FR-12 offline PWA | ✅ done | SW shell + IndexedDB + AI queue/pending + on-device parse, install prompt, self-hosted font; E2E-verified offline |

## Known gaps (honest, all deferred deliberately)

1. Live Gemini text/audio paths need a real key; CI covers fallback + validation only.
2. No E2E microphone recording (fake media device needed); audio is never queued offline.
3. No local-notification reminders, no PDF export, no custom report ranges, no invoice
   status filter chips, no invoice edit/delete UI.
4. No cloud sync / auth / multi-user (out of scope; `LedgerStore` interface is sync-ready).
5. Sub-2s AI latency depends on key/network (fallback path is milliseconds).
