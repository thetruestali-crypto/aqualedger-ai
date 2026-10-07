# DECISIONS.md — Architecture & Ambiguity Log

> Every non-obvious choice goes here with date + rationale. Newest first.

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
