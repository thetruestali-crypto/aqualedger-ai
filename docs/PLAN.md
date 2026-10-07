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

## Phase 3 — State + app shell

- [ ] Context + useReducer (+ selectors), `useMemo` summaries, debounced IndexedDB writes
- [ ] Bottom tabs (Dashboard, Company, Clients, Inventory, Settings) + quick-entry mic button
- [ ] Navbar live boss balance; dashboard KPIs; empty states; Persian error toasts; confirm dialogs

## Phase 4 — Ledgers + inventory + reminders (FR-03..FR-09)

- [ ] Company ledger: quick-add (out-of-pocket/advance/payout), salary config + month-end accrual
- [ ] Client ledger: per-invoice debt/settle cards, partial payments, filters, settle action
- [ ] CRM: profile, device brand, breakdown history, parts used, search (creditors, service-due)
- [ ] Inventory CRUD + atomic decrement on service/sale + low-stock alerts; ServiceLogs
- [ ] Reminders due/overdue list on dashboard (+ optional local Notification)

## Phase 5 — AI (FR-01/02/10)

- [ ] Server: Gemini schema + system instruction (Persian number rules), zod validate, retry 2x/600ms,
  fallback parser, rate limiting; suspicious-value flags (>10x typical, zero)
- [ ] SmartQuickEntry: text + mic, stream split w/ override, preview/edit, optimistic <2s UX
- [ ] Voice: MediaRecorder → `/api/analyze-audio` → same result; Web Speech fa-IR fallback;
  privacy notice (sent for transcription, not stored); manual entry never blocked

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
