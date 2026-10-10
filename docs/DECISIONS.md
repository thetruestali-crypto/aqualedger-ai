# DECISIONS.md — Architecture & Ambiguity Log

> Every non-obvious choice goes here with date + rationale. Newest first.

## 2026-10-09 — Editable company profile (company name, logo, technician name, base salary)

- **D23. New optional settings fields:** `technicianName?: string`, `companyLogo?: string (data-URL)`.
  Optional so old backups/IndexedDB rows keep validating (zod `.optional()`); Dexie needs no
  version bump (settings is a single schemaless row). Seed + empty state default to `''`.
- **D24. Logo storage:** image/* file -> data-URL via FileReader, max ~1.5MB, stored in the same
  settings row (IndexedDB/localStorage) so backup JSON carries it. No server upload, stays offline-first.
  Navbar/Dashboard render `<img>` when present, else default Droplets icon.
- **D25. Salary input UX:** `monthlyBaseSalary` was `type=number` (hard to edit, no fa-digits).
  Now `type=text inputMode=numeric` with `parseTomanInput` (fa/ar->en, strips ٬،, spaces) + live
  `formatToman` preview. Settings form syncs via `useEffect` on async boot hydrate.
- **D26. Visibility:** company/technician/logo shown in Navbar subtitle, Dashboard header
  (with logo thumbnail), Company ledger subtitle, and both invoice texts (boss + client).

## 2026-10-07 — Phase 1 audit + tooling upgrade

- **D1. Gemini model ID:** ARD cites `gemini-3.8-flash`, which does not exist on npm/official docs.
  Decision: model comes from env `GEMINI_MODEL`, default `gemini-2.5-flash` (fast, current Flash tier,
  verified pattern from official docs). Rationale: env-driven so a future rename needs no code change.
- **D2. Real dependency versions (verified via `npm view` on 2026-10-07):**
  `zod@4.6.5`, `dexie@4.4.6`, `vite-plugin-pwa@2.0.0`, `vitest@5.0.3`,
  `express-rate-limit@8.7.1`, `recharts@3.10.1`, `@playwright/test@1.63.0`,
  `@google/genai@2.27.0` (installed). Pinned as `^` ranges in package.json.
- **D3. No rewrite:** existing SPA (React 19 + Express + Gemini structured output + fallback parser +
  localStorage + all ledger views) already passes `lint` and `build`. Evolve it in place; keep
  `src/utils/*` as re-export shims during migration so the app stays runnable after every phase.
- **D4. Storage migration path:** Dexie schema v1 keeps the same entity shapes as current
  localStorage keys (`aqualedger_*_v1`). A one-time import-on-first-run migrates localStorage ->
  IndexedDB; localStorage code stays until Phase 2 cutover is tested. Rationale: zero data loss.
- **D5. Boss formula extension (FR-04):** `BaseAccrued = max(0, Base - Insurance + Overtime - Absence)`
  where `Overtime = overtimeHours * overtimeHourlyRate`, `Absence = absenceDays * absenceDailyRate`.
  New settings fields are optional (default 0) so old stored settings keep working.
- **D6. Persian bare-number rule:** bare value < 1000 followed by تومن/تومن with no explicit
  هزار/میلیون implies x1000 (e.g. `۵۸۰ تومن` = 580_000). Values >= 1000 with تومن are literal.
  Rationale: matches observed technician speech; covered by unit tests + Gemini system instruction.
- **D7. Font offline:** Vazirmatn currently loads from Google Fonts CDN. Self-hosting (npm
  `@fontsource/vazirmatn` or local woff2) deferred to offline-hardening phase; PWA shell + data
  offline comes first because it has higher user value.
- **D8. Audio endpoint limits:** `/api/analyze-audio` caps body at 10MB (~a few minutes of
  compressed audio). Without `GEMINI_API_KEY` it returns 503 with a Persian message instead of
  failing silently, so the client can fall back to Web Speech API / text box.
- **D9. Regex lastIndex bug (found by new unit tests, fixed same day):** the shared amount
  extractor skipped whitespace matches with `re.lastIndex++`, which is only valid for
  zero-length matches (`exec` already advances past consuming matches). Symptom: any leading
  text before the amount (`از جیب ۵۸۰ تومن...`) returned 80_000 instead of 580_000. Fixed to
  `++` only on `m[0] === ''`. Lesson: the old fallback had this latent bug; tests caught it.
- **D10. Store cutover is Phase 3, not Phase 2:** Phase 2 ships the `LedgerStore` interface +
  memory/local/Dexie implementations and a tested one-time migration, but the UI still runs
  on the localStorage driver. Rationale: migration + backup/restore are verifiable without
  risking the working app; cutover happens together with Context + debounced writes.
- **D11. Bare paid/debt numbers live in the fallback, not the extractor:** `extractTomanAmounts`
  requires a money marker (so `۳ فیلتر` never becomes money). Repeats without a marker
  (`۳۵۰ نقد داد`) are resolved by keyword-anchored regexes in `fallbackAnalyzeTransaction`.
- **D12. Persistence = debounced whole-snapshot `importBackup` (500ms):** instead of
  per-entity upserts, every committed reducer state is written back in one Dexie
  rw-transaction. Simple, consistent, and fast enough at this scale (hundreds of rows).
- **D13. Boot never fails:** `bootStore()` tries Dexie (migrate + probe) and falls back to
  the localStorage driver on ANY error; the UI shows a splash, then toasts problems in
  Persian instead of a blank screen. Verified by a real-Chromium E2E (migration marker
  + `aqualedger` IndexedDB present, zero console errors).
- **D14. Settlement accounting (no double-counting):** per-invoice settle mutates the
  invoice tx itself (`paidAmount`/`remainingDebt`/`settled`) + client totals — no extra tx.
  Aggregate settle allocates across open invoices oldest-first; only genuine overpayment
  creates a residual receipt tx. Salary-accrual memos are excluded from engine sums.
- **D15. Stock decrement is best-effort, not blocking:** a field sale tries
  `driver.decrementStock` (atomic inside Dexie); unknown/insufficient parts produce a
  Persian warning toast but never block the sale — the technician fixes stock later.
  Parts state is re-read from the driver after a successful decrement (no stale UI).
- **D16. Durability race (caught by the happy-path E2E):** reloading inside the 500ms
  persist debounce lost the last action. Fixed with a `visibilitychange`/`pagehide`
  flush of the latest snapshot (best-effort) — debounce retained for batching.
- **D17. Suspicion is deterministic and server-side, typical is client-side:** the server
  owns absolute rules (zero, >500M Toman, paid>total normalize) while the >10x rule uses
  a client-computed median (`typicalAmount`) passed in context — the stateless server
  cannot know user history. `finalizeAnalysis` runs on Gemini AND fallback output alike.
- **D18. Voice chain (no dead ends):** MediaRecorder upload → on 503/no-key auto-fallback
  to Web Speech fa-IR → if unsupported, a clear message + the text box stays. Manual entry
  is never gated on AI, network, or microphone.
- **D19. Report accounting (cash view):** net = (companyIn + fieldIn) − (companyOut +
  partsCost + toolExpense); advances/payouts count as companyIn (cash received),
  accrual memos excluded. Month buckets use exact Jalali month starts (day-walked),
  day buckets use the local calendar day (UTC slicing mis-buckets +3:30).
- **D20. recharts needs `react-is`:** the v3 ESM build imports it but npm does not hoist
  it; added explicitly (`react-is@^19.3.0`). Reports stay out of the mobile bottom bar
  (6 slots per spec) — entry is the dashboard button + desktop tab.
- **D21. Offline AI = same pipeline, both sides:** the client bundles `fallbackParser` +
  `suspicion` (both pure, no node APIs) so local parse applies identical rules as the
  server. Failed network requests enqueue the *text* (audio transcription inherently
  needs network); retry is manual and explicit — no surprise AI costs on reconnect.
- **D22. SW takes control immediately:** `skipWaiting` + `clientsClaim` so the first
  offline reload already serves the shell. Fonts are self-hosted (arabic 400/500/700/800
  + latin 400/700); Google Fonts links removed — the UI is now fully offline-capable.
