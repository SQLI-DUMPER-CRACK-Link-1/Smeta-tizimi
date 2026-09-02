# T2-GAS-EXIT-001 — core TIZIM_02 GAS dependency inventory + exit plan

Status: **PLANNED — NOT started in this release.** This is a scoping/continuation
document only, written during NEXT-MAIN-RELEASE-V1 per an explicit owner
correction: the remaining GAS dependency in the F2 interactive path is
**incomplete migration**, not intentional final architecture. Do not read the
current GAS-in-the-loop state as accepted design.

## Canonical law (unchanged, restated for this task)

- Supabase/Postgres = canonical business truth.
- Cloudflare R2 = canonical binary truth (FILE-TRUTH-001).
- Cloudflare Workers/Pages = API + deterministic execution.
- GAS = Drive/Sheets **async sync bridge only** — never a request-path
  dependency for a canonical interactive command.

Today's real source still violates the last line for the F2 interactive
import/match path. That gap is what this task is for.

## Inventory (read-only, gathered 2026-09-02, not exhaustive — first pass)

Frontend request-path GAS calls, still live on `main`/`integration/next-main-release-v1`:

- `frontend/src/admin/sahifalar/F2Import.tsx` — the **canonical** `/admin/f2`
  route's import/matching screen. Calls the `useF2*` hooks below directly on
  the interactive request path.
- `frontend/src/admin/store/useF2Store.ts`, `frontend/src/api/hooks.ts` —
  `useF2*` hooks that call `gas()` (`frontend/src/api/client.ts`) for file
  read + matching, not Supabase RPCs.
- `frontend/src/test02/TestF2Import.tsx` — the TIZIM_02-native rebuild of the
  same flow (used by `/admin/test/f2import` and referenced by this release's
  P0 fix, see below) — also calls `gas()` for `apiT2F2Korish` / file read and
  `f2MoslashEngine` matching.
- `Smeta tizimi/T2_F2Import.js` (Apps Script) — `apiT2F2Korish` and the file
  read/matching implementation itself (`f2MoslashEngine`, `35_F2Moslash.js`)
  live entirely in GAS today. This is the mature, evidence-grounded matcher
  (unit-mismatch gate, hierarchical BL-scoped scoring) — see
  [[f2-import-ierarxik-moslashtirish]] / [[f2-daraxt-tezlik-qoidalari]] memory.
- `frontend/src/_shared/navbat.ts`, `frontend/src/_shared/kuzatuv.ts`,
  `frontend/src/umumiy/ui/F2NavbatChip.tsx` — the queue/poll (`navbat`) +
  timeout-workaround (`kuzatuv`) infrastructure that exists specifically
  because GAS's 6-minute execution limit and cold-start latency make
  synchronous F2 matching unreliable from a Cloudflare Worker. This
  infrastructure is itself evidence the GAS dependency is a load-bearing
  reliability problem, not a stable design choice.

Not yet inventoried (do first in this task, before writing any migration
code): every other `gas()` call site across `frontend/src/**` — `grep -rn
"gas("`/`"apiT2"` is the starting point — and which of those are genuinely
Drive/Sheets replica-only (fine, keep) vs. canonical-business-logic-through-GAS
(must move).

## Why this is not "GAS is the final layer"

The queue/timeout/retry scaffolding (`navbat.ts`, `kuzatuv.ts`,
`F2NavbatChip.tsx`) is a symptom: it exists to paper over GAS's own execution
model (synchronous 6-minute cap, cold starts, per-script quota) inside what is
supposed to be a canonical interactive command path. A canonical path with a
"queue in case the backend times out" wrapper is not deterministic-execution
architecture — it is a compatibility bridge that outlived its migration.

## Goal for this task (when it is picked up)

1. **Inventory** every core TIZIM_02 `gas()` dependency (not GAS-as-Drive/Sheets-bridge
   calls — those are fine and should stay) and classify each as
   canonical-logic-through-GAS (must migrate) vs. legitimate replica bridge
   (keep, per FILE-TRUTH-001's own "GAS = bridge only" law).
2. **Do not build a second, weaker F2 matcher.** The GAS-side `f2MoslashEngine`
   (`Smeta tizimi/35_F2Moslash.js`) is the mature implementation — hierarchical
   BL-scoped scoring, explicit unit-mismatch gate, evidence-grounded (see
   [[f2-import-ierarxik-moslashtirish]]). Port/extract that logic into **one**
   shared deterministic engine and execute it behind the Cloudflare/Supabase
   boundary (a Cloudflare Function calling a pure TS module, or a Postgres
   function if the matching can be expressed set-based) — not a second,
   independently-maintained frontend or Worker reimplementation with its own
   scoring rules. [[f2-import-ierarxik-moslashtirish]] explicitly warns against
   writing a second matcher (last unit-mismatch caused a 1000x error the last
   time frontend had its own scoring).
3. Once the matcher runs outside GAS: retire `navbat.ts`/`kuzatuv.ts`'s
   F2-specific timeout/queue workaround (the queue mechanism itself may still
   be useful for genuinely long-running work, but F2 matching should no longer
   need it if it runs synchronously behind Cloudflare/Supabase).
4. GAS keeps: Drive/Sheets replica read/write-back (`98_T2ReplicaSync.js`,
   `99_T2SheetsReplica.js`), and any other confirmed replica-only bridge work.

## Explicit non-goals for THIS release (NREL-001)

- Do NOT start the GAS migration itself inside NEXT-MAIN-RELEASE-V1.
- Do NOT touch `Smeta tizimi/T2_F2Import.js` / `35_F2Moslash.js` in this
  release beyond what NREL-001 already owns.
- The only F2-path change THIS release makes is the P0 positional-mapping fix
  below — a frontend-only safety fix, not a step toward the GAS exit.

## P0 fix landed in NEXT-MAIN-RELEASE-V1 (done, not part of the GAS exit itself)

`frontend/src/test02/TestF2Import.tsx`'s `forceMapBlChildren` performed
unmatched-child auto-binding by array **position** — no name/code/unit gate —
inside an already-matched parent block, and ran silently on every file load
via `dvigatelniQolla(true)`. Removed entirely; binding now flows only through
`applyEngineBinds` (`frontend/src/test02/f2-import-bind.ts`), which binds a row
iff the deterministic engine marked it `holat==='moslandi'`. Regression tests:
`frontend/src/test02/f2-import-bind.test.ts`.

## Owner P0 escalation (2026-09-02, same day as inventory above)

The owner reviewed this document and escalated: for real projects with
**50,000-row estimates and hours of manual F2 work**, a GAS 6-minute timeout
must never lose or restart that work — this makes full GAS independence for
the F2 core path a **release-blocking P0**, not deferred debt. The owner then
separately agreed (see decision below) to decouple NREL-001 (unrelated to the
F2/GAS execution path) from this work rather than block it. The detailed
requirements below are the owner's own words, kept verbatim/near-verbatim so
no requirement gets lost between sessions — do not start coding against this
without first re-reading [[f2lab-deploysiz-sinov-stendi]] and testing every
matcher change in the F2 LAB sandbox first, per that memory's own rule.

**Decision (2026-09-02): NREL-001 ships independently.** It does not touch or
worsen the F2/GAS execution path, so it was not held back for this work. This
document is the standalone scope for the dedicated follow-up effort.

### 1. Architecture law (restated, non-negotiable)
- Supabase/Postgres = canonical business truth **+ durable jobs/drafts/checkpoints**.
- Cloudflare = API + deterministic execution.
- R2 = canonical file bytes.
- GAS = ONLY Google Drive / Google Sheets asynchronous replica bridge.
- No core interactive TIZIM_02 workflow may require GAS.

### 2. Inventory targets (do this exhaustively before writing code)
Audit every active TIZIM_02 route/hook, especially: `/admin/f2`, `F2Import`,
`TestF2Import`, `useF2*`, `apiT2F2Korish`, `apiT2F2Import`, `apiF2FaylOqi`,
`apiF2VaraklarOl`, `f2MoslashEngine`, `apiHolatOl*`, `apiF2LokalkaTaklif`, T2
smeta/F2 writes, long-running recalculation flows. Classify each as:
**A. CORE — must migrate now**, **B. REPLICA BRIDGE — GAS may remain**,
**C. LEGACY TIZIM_01 — not part of TIZIM_02 runtime**. "Data lives in
Supabase" is not the same claim as "execution is independent of GAS" — check
execution, not just storage.

### 3. Port the mature F2 engine — do not rewrite it weaker
Preserve every one of these TIZIM_01 matching semantics when porting
`f2MoslashEngine` (`Smeta tizimi/35_F2Moslash.js`) into one shared
deterministic TypeScript engine (pure domain logic, usable by both Cloudflare
and tests — no second independent matcher, ever):
unit shield · code canonicalization · grade/dimension distinction ·
razdel/group scope · ambiguity rejection · orphan handling · no invented
match · no invented price · unmatched-reason diagnostics. TIZIM_02 must stop
calling GAS to execute this engine.

### 4. F2 file parsing must exit GAS
Port the useful behavior of `apiF2FaylOqi` (workbook/sheet detection,
supported-template detection, column detection, newline/header
normalization, F/E quantity rules, total/header row filtering, safe XLSX
value reads — see [[xlsx-ref-faqat-qiymat]], explicit ambiguous-column
configuration) into TIZIM_02. Canonical upload path becomes
**Browser → Cloudflare → R2**; no base64 whole-file upload through GAS.

### 5. 50k-row resumable job model (do NOT solve with one huge sync request)
Durable Supabase job state, minimum fields: `job_id`, company/project/object,
`operation_id`, `source_document_id`, `status`, `cursor`/chunk,
`total_rows`, `processed_rows`, `matched_rows`, `unmatched_rows`,
`started_at`, `updated_at`, `last_error`, `base_version`. Processing must be
bounded, checkpointed, retryable, idempotent, resumable — a failure at row
32,000 resumes near the checkpoint, never restarts from row 1. No GAS
6-minute dependency; no Cloudflare giant-single-request dependency either.

### 6. User work must be durable
Manual F2 matching/corrections are real business work — never rely on
`localStorage` alone. Persist working draft/mapping state into Supabase with
stable IDs, `base_version`, `operation_id`, optimistic locking, incremental
autosave. After a page refresh, PC restart, browser crash, network loss, or a
failed worker step, the user must recover the same draft. `localStorage` may
remain only as a secondary convenience cache.

### 7. Positional auto-mapping (already fixed in NREL-001, restated here as the standing rule)
`forceMapBlChildren`'s `unmatchedF2[index] -> unmatchedSmeta[index]` binding
without deterministic evidence is permanently disallowed, including on silent
initial load. Only a deterministic-matcher result or explicit manual user
binding may bind a row; see `frontend/src/test02/f2-import-bind.ts` +
`.test.ts` for the current enforcement and regression coverage — any future
engine port must preserve this contract, not reintroduce a positional
fallback.

### 8. F2 financial invariants (already law project-wide, restated for this task)
`certified amount = certified quantity × certified unit price`. Keep
baseline/reference price, certified F2 price, actual procurement price, and
approved change price strictly separate (see
`docs/architecture/SMETA_F2_NAKOPITELNIY_CHANGE_CONTROL_V1.md`, already
shipped in NREL-001). Historical approved F2 stays frozen. No invented price,
ever. No pending/rejected change may enter an approved cumulative.

### 9. Performance
Test realistic datasets at 10k and 50k rows; measure parse / normalize /
match / projection / validation separately. No O(n²) matcher step (see
[[f2-daraxt-tezlik-qoidalari]] for the prior 8-cause slowness table on this
exact codebase). Interactive UI must never block on Drive/Sheets/GAS.

### 10. Legacy TIZIM_01
Do not delete it — it stays as reference/archive/regression oracle. Behavior
may be ported; the runtime dependency must disappear from TIZIM_02.

### 11. Where GAS may still remain
Drive secondary replica, Sheets secondary replica, managed rename/move/
content detection, replica sync worker — all asynchronous. A GAS outage may
degrade Drive/Sheets sync; canonical TIZIM_02 must stay healthy regardless.

### 12. Release acceptance for THIS task (when it ships)
Prove: disabling/making GAS unavailable does NOT break TIZIM_02 F2 import,
F2 matching, Smeta canonical read, F2 draft recovery, F2 finalization,
Workbench, or Nakopitelniy — a GAS outage affects only replica sync. A 50k
test completes or resumes safely. Manual mappings survive a simulated
refresh/restart. The positional-mapping regression test fails closed.
`BUG_FOUND=0`.

### 13. Agent coordination
Codex may act as an independent auditor/test owner where useful, but the two
agents must not independently modify the same engine implementation at the
same time — Claude remains release/integration owner for this task same as
NREL-001.

### 14. Final success shape for this task
Not "SOURCE_READY". The bar is **`T2_CORE_GAS_INDEPENDENT`**, reported
alongside (or ahead of) any subsequent main/production release it unblocks.

## Suggested next task shape (for whoever picks this up)

- New branch, e.g. `claude/t2-gas-exit-001` or `codex/t2-gas-exit-001`.
- Step 1 (read-only): finish the `gas()`/`apiT2*` call-site inventory above,
  classify each, write the classification into this document.
- Step 2: design doc (architecture contract) for where the ported matcher
  lives and its exact interface — get it reviewed before writing code, per
  Constitution's "Change safety" (additive, evidence-grounded).
- Step 3: port + shared-engine implementation, with the legacy GAS path kept
  as a fallback until the new path is proven in production (do not delete
  `f2MoslashEngine` until its replacement has real production evidence).
- Step 4: retire the queue/timeout workaround once the new path no longer
  needs it.
