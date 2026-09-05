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

## Step 1 classification — COMPLETE (2026-09-04, Claude, read-only)

Full `frontend/src/**` sweep of `gas(`/`apiT2` call sites, classified per the
rubric in "Goal for this task" §1 above. Evidence: `grep -rn "gas("` /
`grep -rln "apiT2"` across `frontend/src`, then per-hook/per-page read to
confirm consumer and purpose. No code changed; read-only per this task's own
Step 1 instruction.

### ⭐ Key finding: Nakopitelniy/Workbench is ALREADY GAS-independent

`frontend/src/api/t2-document-control.ts` and
`frontend/src/components/construction-document-control/{NakopitelniyWorkspace,ConstructionDocumentWorkbench}.tsx`
have **zero** `gas()`/`apiF2*` references — confirmed by direct grep. They
call only canonical `t2_nakopitelniy_v1` / `t2_workbench_v1` /
`t2_smeta_ozgarish_*` / `t2_forma3_*` RPCs via `/api/hujjat-nazorat`. **The
GAS-exit risk for F2/Nakopitelniy is entirely upstream**, in the F2
import/matching path that produces the `t2_akt`/`t2_akt_qator` rows
Nakopitelniy reads — not in Nakopitelniy itself.

### A. CORE — must migrate (F2 interactive path, execution today happens inside GAS)

| Site | Notes |
|---|---|
| `admin/sahifalar/F2Import.tsx` | The **canonical `/admin/f2`** route (production, in active use today) |
| `admin/sahifalar/F2Tayyorlash.tsx`, `admin/qismlar/F2Kafolat.tsx`, `admin/qismlar/F2OyTahrir.tsx` | Supporting screens on the same canonical F2 flow |
| `umumiy/ui/F2NavbatChip.tsx` | The queue-status chip — symptom UI for the GAS-timeout workaround (goal §3 target for retirement) |
| `api/hooks.ts` — `useF2AvtoMoslash` | Calls `apiF2AvtoMoslash` → executes `f2MoslashEngine` (`Smeta tizimi/35_F2Moslash.js`) **inside GAS**. This is the matcher itself — the exact thing goal §3 says to port, not rewrite |
| `api/hooks.ts` — `useF2Navbatga` | `apiF2QollaNavbatga` — the F2 write/apply path, routed through the `navbat` queue because GAS can't finish synchronously |
| `api/hooks.ts` — `useF2LokalkaTaklif`, `useF2Lokalkalar`, `useF2FaylYukla`, `useF2Fayllar`, `useF2Varaqlar`, `useF2Ustunlar`, `useF2Daraxt`, `useF2EskiFaylOqi` | File/sheet/column detection — goal §4 (file parsing must exit GAS) |
| `api/hooks.ts` — `useF2OyOchirish`, `useF2Reestr`, `useF2Nazorat`, `useF2QatlamTahlil`, `useF2PriamoyZatrat`, `useF2Bosliqlar`, `useF2BoglanishTikla`, `useF2YozishgaRuxsat`, `useF2OyTafsilot`, `useF2QatorTahrir`, `useF2Undo`, `useF2Muhr`, `useF2MuhrHolat`, `useF2ReestrTikla`, `useF2ReestrHujjatJami`, `useF2JobTozala`, `useF2JobHolat` | Full F2 month/period lifecycle (open/close/seal/undo/reestr) — all GAS-executed today |
| `api/hooks.ts` — `useHolat` (`apiHolatOl`/`apiHolatOlLokalka(lar)`) | Smeta-tree read that F2 matching needs as its scope context |
| `test02/TestF2Import.tsx`, `test02/TestImport.tsx`, `test02/TestOqishOlchov.tsx` | The TIZIM_02-native rebuild — **also still GAS-executed**: `gas('apiT2F2Varaqlar', ...)`, `gas('apiT2F2Korish', ...)` which itself runs `f2MoslashEngine` inside GAS. Confirms "data lives in Supabase" ≠ "execution is GAS-independent" even in the newer rebuild |
| `_shared/navbat.ts` | Generic queue executor (`gas(b.fn, ...b.args)`) — not F2-specific code, but exists *because of* F2's GAS timeout risk; retire F2's use of it once the matcher runs synchronously behind Cloudflare (queue mechanism itself may stay for other genuinely long jobs, per goal §3) |

### B. REPLICA BRIDGE — GAS may remain (Drive/Sheets materialization, per FILE-TRUTH-001's own law)

| Site | Notes |
|---|---|
| `api/t2-storage.ts` — `apiT2CompanyStorageHolat/Bind`, `apiT2ProjectStorageRoyxat`, `apiT2ObjectStorageRoyxat`, `apiT2LoyihaStorageProvision`, `apiT2ObjectStorageProvision`, `apiT2DocumentUpload` | Actual Google Drive folder/file materialization (STOR-001) — the business record lives in Supabase; the Drive-side action is legitimately GAS/Drive-API work |
| `api/supabase.ts` — `apiT2DriveTrash`, `apiT2DriveRename`, `apiT2DriveRestore`, `apiT2DriveHardDelete` | Drive file lifecycle mirroring a Supabase-canonical delete/rename — bridge, not business logic |
| `api/hooks.ts` — `useFakturaDriveHolat` | Invoice Drive-replica status check |

### C. Found incidentally, OUT OF SCOPE for F2/Nakopitelniy (not classified further here — separate future task if pursued)

| Site | Why out of scope |
|---|---|
| `api/hooks.ts` — `apiLockBos`/`apiLockOch` | Object edit-lock, unrelated to F2 matching |
| `_shared/kuzatuv.ts` — `apiXatoYoz` | Client-side JS error/telemetry logging routed through GAS — odd, harmless, unrelated to F2 |
| `useZayavkaHolatYangila`, `useNuqsonHolatYangila` | ERP Zayavka/Nuqson status — legacy Tizim_01 ERP, not F2 |
| `useKeshHolat`, `useTizimHolat`, `useTizimHolatOzgartir` | System cache/settings admin, not F2 |

### ⚠️ Two sites needing an explicit decision (not auto-classified — evidence insufficient to call A or B without the owner/next session reading the actual GAS-side implementation)

- `useF2HujjatYarat` (`apiF2HujjatYarat`) — F2 output/document generation. Unclear from the frontend call site alone whether this produces a Sheets/Docs-templated artifact (legitimate B, Drive/Sheets is the natural home for that template) or a business document that should move to Cloudflare/R2 generation (A). **Read `Smeta tizimi/76_Hujjatlar_M29.js` / wherever `apiF2HujjatYarat` is implemented before deciding.**
- `useAiSmartF2` (`apiAiSmartF2` via `75_AI_SmartF2.js`) — AI-assisted F2 help. This is a *different* migration question than the deterministic matcher (goal §3 is explicit the matcher must stay deterministic, never AI). Whether the AI Gateway itself (`00_AI_Gateway.js`) needs to move off GAS is a separate scoping question, not part of this task's matcher-porting goal — flagging so it isn't silently folded into "port the matcher" scope.

**Step 1 status: DONE.** Next: Step 2 (design doc for where the ported
`f2MoslashEngine` lives and its exact TypeScript interface) — per this
document's own "Suggested next task shape," get that design reviewed before
writing any migration code.

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
  classify each, write the classification into this document. **DONE
  2026-09-04** — see the classification section above.
- Step 2: design doc (architecture contract) for where the ported matcher
  lives and its exact interface — get it reviewed before writing code, per
  Constitution's "Change safety" (additive, evidence-grounded). **DONE
  2026-09-04** — see §Step 2 below.
- Step 3: port + shared-engine implementation, with the legacy GAS path kept
  as a fallback until the new path is proven in production (do not delete
  `f2MoslashEngine` until its replacement has real production evidence).
  **CORE MATCHER PORT DONE 2026-09-04** — see §Step 3 below. File parsing and
  the resumable job model (§4-5 of the owner's requirements above) are NOT
  done — still open, see §Remaining below.
- Step 4: retire the queue/timeout workaround once the new path no longer
  needs it. **NOT STARTED** — depends on Step 3's remaining scope (file
  parsing + job model + real Cloudflare wiring), not just the matcher.

## Step 2 — design doc (2026-09-04, Claude)

**Where the ported engine lives:** `frontend/src/lib/f2-match-engine/`
(`engine.ts` + `types.ts` + `index.ts`), next to the existing pure-domain
modules in `frontend/src/lib/` (`park-document-control/`,
`construction-document-control/`) — same pattern: framework-free TypeScript,
importable by both a Cloudflare Function (server) and a Vitest test (no
network, no Google API, no browser API).

**Interface (stable, matches the GAS source's own I/O shape so a diff against
`35_F2Moslash.js` stays trivial):**
```ts
function f2MatchEngine(
  aktTree: AktNode[] | null | undefined,
  lrvTree: LrvNode[] | null | undefined,
  opts?: F2MatchOptions,
): F2MatchResult
```
`AktNode`/`LrvNode`/`F2MatchResult` mirror the GAS tree shapes field-for-field
(see `types.ts`) — deliberately, so a future Cloudflare Function can accept
the same JSON a client already knows how to build, with zero shape
translation layer to get subtly out of sync.

**Where it will be called from (not implemented yet — this is the plan, not
the state):** a new `frontend/functions/api/f2-moslash.ts` Cloudflare
Function — session → actor → tenant check (same pattern as
`hujjat-nazorat.ts`/`boss-dashboard.ts`) → read `aktTree`/`lrvTree` (from R2
upload + a canonical LRV projection, not from GAS) → call `f2MatchEngine` →
persist to the F2 job/draft tables (§Remaining). This function does not exist
yet; do not assume it is wired into `App.tsx`/`hooks.ts` routing.

**Why not a Postgres function:** the matching logic is recursive tree
traversal over two independently-shaped trees with closures over mutable
per-request indices (`band`, `moslangan`, `byKod`/`byNomBir`/`byKanon`,
section scopes) — expressible in PL/pgSQL but at a real
readability/maintainability cost for logic this rule-dense; a Cloudflare
Function calling a pure TS module keeps parity with the GAS source (also
plain imperative JS) easiest to audit. Revisit only if profiling in
production shows the extra network hop (Worker → Postgres round trip for
tree data) actually matters.

## Step 3 — core matcher port (2026-09-04, Claude) — DONE, verified

Ported: `f2MoslashEngine` (renamed `f2MatchEngine`), every normalizer
(`normNom`/`normBir`/`normKod`/`aynanMi`/`normRz`/`kodKanon`/`rzKodlar`), and
`_f2mLokalkaAniqla` (`f2LokalkaAniqla`) — **every rule preserved**: unit
shield, grade-mismatch gate, strict-mode fuzzy suppression, code
canonicalization, section-scope-first search, orphan-resource rescue,
equivalent-candidate tie-breaking. Two functions defined-but-dead-code in the
GAS source (`findUnique`, `pickQatiy` — confirmed zero call sites by grep
against the live source) were **not** carried forward as reachable code; this
is noted explicitly in `engine.ts` rather than silently reproducing
unreachable code as if it mattered.

**Files:** `frontend/src/lib/f2-match-engine/{types.ts,engine.ts,index.ts,engine.test.ts,engine.perf.test.ts}`.

**Verification (run 2026-09-04, this session):**
| Check | Result |
|---|---|
| Parity tests (18, direct port of `f2MoslashSelfTest()`'s own cases — same inputs, same expected outputs) | ✅ 18/18 pass |
| `npx tsc -b` (whole frontend project) | ✅ exit 0 |
| `npx oxlint src/lib/f2-match-engine/` | ✅ 0 issues |
| `npx vitest run` (whole frontend suite, regression check) | ✅ 132/132 pass (was 112/112 before this change — +18, 0 broken, 0 skipped) |
| Performance (§9 requirement): synthetic mixed match/miss dataset | ~10,560 leaves → **395 ms** (7,920 matched / 2,640 unmatched); ~52,800 leaves → **1,976 ms** (39,600 matched / 13,200 unmatched) — ~5x data → ~5x time (linear, not O(n²)); ~180x headroom under GAS's 6-minute (360,000 ms) synchronous ceiling at 50k-row scale |

**Not yet done (do not report this as "T2_CORE_GAS_INDEPENDENT" — it isn't):**
this is the deterministic matcher only. `f2MatchEngine` is not called from
anywhere in the live app yet — `admin/sahifalar/F2Import.tsx` and
`test02/TestF2Import.tsx` still call GAS. See §Remaining.

## Remaining (not done — real scope, do not understate it)

1. **File parsing off GAS** (owner requirement §4) — **DONE 2026-09-04,
   including the byte-level read.** Two pieces, both in
   `frontend/src/lib/f2-import-parse/`:
   - `treeBuild.ts`/`columnDetect.ts` — the pure tree-building/column-
     detection core of `apiF2FaylOqi`/`_f2UstunAniqla`.
   - `xlsxReader.ts` — **new**, the piece previously marked blocked. A
     dependency-free `.xlsx` reader using only `ArrayBuffer` +
     `DecompressionStream('deflate-raw')` + `TextDecoder` (Cloudflare
     Worker / browser / Node ≥18 — no `fs`, no `child_process`, no
     PowerShell, no npm package). `_f2lab/xlsx.js` (the GAS-side reference)
     does the same job by shelling out to `powershell Expand-Archive`,
     which cannot run in a Worker; this reads the ZIP central directory and
     inflates DEFLATE entries directly instead. The XML/sharedStrings
     regex parsing itself was already platform-agnostic and is ported
     directly from `_f2lab/xlsx.js`.
   **Real-data confirmation (this session, evidence, not claimed):**
   located a real production F2 act (`Амфитеатр.xlsx`, Февраль, 526KB, via
   Google Drive — `search: title contains 'gas'` → `GAS` folder → `_f2lab`
   → sibling `"Для ф2"` folder → `Февраль`), downloaded its raw bytes, and
   ran the **full pipeline end-to-end**: `readXlsx` (real ZIP + real
   DEFLATE, via `DecompressionStream`) → 2998 real rows → `f2FaylOqiCore`
   (marker path, since this file carries literal `rz`/`bl`/`rs` markers) →
   **11 rz sections, 36 bl, 392 rs, zero exceptions**; the known real row
   pair (№378 `bl`, kod `E6-1-26-4`, hajm `0.00525`, 17 children; №378.1
   `rs`, kod `000001`, hajm `8.23935`, summa `202009.91...`) came out of the
   tree exactly as it appears in the source file. **The real file itself
   was NOT committed** (this repo is public; real F2 acts carry real
   contract/pricing data) — `xlsxReader.test.ts` instead builds a complete,
   valid, minimal `.xlsx` byte-for-byte in memory (real ZIP central
   directory/local headers/EOCD, real OOXML parts, shared strings, inline
   strings, merged cells, XML entity decoding) so the committed suite needs
   no external fixture. `treeBuild.test.ts` separately carries two rows
   transcribed verbatim from the real file (see previous commit) as
   real-world regression fixtures.
   **Wiring — DONE 2026-09-04.** `frontend/functions/api/f2-moslash.ts` now
   accepts a real request: `{amal:'fayl_oqi', fileBase64, varaqNom?, colConfig?}`
   decodes the upload, calls `readXlsx` + `f2FaylOqiCore`, and returns the
   same dual-mode shape `apiF2FaylOqi` does (column-preview or built tree);
   `{amal:'moslash', aktTree, lrvTree, opts?}` runs the matcher (unchanged
   from Step 3). 8 tests (`f2-moslash.test.ts`, testing the exported
   handlers directly — the session/auth wrapper reuses the already-covered
   `tekshir()` pattern, not re-tested here). Size guards are explicit
   placeholders (15MB file / 20k LRV leaves) pending real capacity data, not
   measured limits. **Still NOT R2/canonical persistence** — the uploaded
   file is read in memory and discarded, which is fine for read/match but
   not for the eventual canonical-upload path (FILE-TRUTH-001's
   `Browser → Cloudflare → R2`) — that remains separate, undesigned work.
   No `useF2*` hook or page calls this route yet — see §Wiring/cutover below.
   More real files exist under the same Drive tree (other month folders:
   Декабрь/Август/Июнь and others) if more template variety needs
   confirming later (e.g. a `mat`-typed row was not observed in the one
   file checked so far).
2. **50k-row resumable job model** (owner requirement §5) — **DRAFTED, UNAPPLIED,
   UNREVIEWED, UNEXECUTED** 2026-09-04:
   `supabase/migrations/20260914120000_t2_f2_import_job_v1.{sql,rollback.sql,acceptance.sql}`.
   `t2_f2_import_job` (job_id/status/cursor/total|processed|matched|unmatched_rows/
   operation_id/versiya) + `t2_f2_import_draft_qator` (per-uid durable mapping,
   §3 below) + 4 RPCs (`_yarat_v1` idempotent create, `_holat_v1` poll,
   `_ilgarilash_v1` optimistic-locked progress update, `_saqla_v1` per-row draft
   upsert). **This session confirmed the connected Supabase MCP project is the
   real production project (`Smet-01` / `tuoyrzadkgoltpqkdiyx`, matches
   `CURRENT_STATE.md`) — no branch was created and nothing was applied; the
   owner explicitly declined a disposable-branch verification this round
   ("hali tizimga muhim nimadir yuklanmagan" — nothing important loaded yet).**
   The `.acceptance.sql` file is proposed criteria only — it has NOT been run
   against any database. Whoever picks this up next must actually run it
   (disposable branch or otherwise) before treating the design as proven, per
   the Constitution's "a green regex is not proof of runtime behavior."
3. **Durable draft/mapping persistence** (owner requirement §6) — **schema
   drafted** as part of the same migration above (`t2_f2_import_draft_qator`);
   not wired to any UI yet (no autosave call site exists).
4. **The Cloudflare Function endpoint** — **DONE 2026-09-04.**
   `frontend/functions/api/f2-moslash.ts` accepts a real file upload
   (`fayl_oqi`) and runs the matcher (`moslash`), both fully off GAS,
   8 tests passing. **Still open:** no `useF2*` hook or page calls it (see
   item 5), no R2 persistence of the uploaded file, no job-model wiring
   (item 1's job model is drafted but unapplied, so this endpoint enforces
   placeholder size ceilings instead of resuming).
5. **A live, clickable page exists — `/admin/test/f2native`
   (`frontend/src/test02/TestF2Native.tsx`) — DONE 2026-09-04.** Upload an
   `.xlsx`, it calls `/api/f2-moslash` (real Cloudflare, zero GAS), shows
   the parsed tree's node counts, and can run the matcher against a
   hand-pasted LRV tree. This is the first genuinely clickable proof that
   T2-GAS-EXIT-001's ported pipeline works end-to-end for a real user
   action, not just in tests. `npx tsc -b` exit 0, `npm run build` succeeds
   (new chunk `TestF2Native-*.js` present), full suite still 150/150 — nothing
   else changed. **Still NOT the production cutover**: the canonical
   `/admin/f2` route (`F2Import.tsx`) is completely untouched and still
   100% GAS-backed. See item 6 for what changed since.
6. **Supabase write-through — DONE 2026-09-05.** Answers "when does this
   reach Supabase?": until this increment, the answer was "never" — the
   canonical `/admin/f2` GAS path (`apiF2QollaNavbatga` → `_f2FonQadam`)
   writes to Google Sheets rows only and never touches `t2_akt`; a
   separate, already-written GAS function `apiT2F2Import`
   (`Smeta tizimi/T2_F2Import.js`) does call `t2_akt_yarat`, but no
   frontend code calls it (dead code, confirmed by search) — and this
   session's own `TestF2Native` from item 5 stopped at
   match-result-in-memory with a manual-JSON-paste LRV tree (`row` was
   whatever the pasted JSON said, not a real `qator_id`, so it could not be
   written anywhere real).
   `TestF2Native.tsx` now: (a) reads the LRV tree from **canonical
   Supabase** via `sbT2DaraxtOl` (`t2_daraxt`, obyekt-scoped) instead of a
   textarea, building the matcher's `LrvNode[]` with `row` set to the
   REAL `t2_qator.id` (`daraxtdanLrvQur`, ota_id-based nesting) — so a
   match's `F2Match.row` is directly usable as `qator_id`, no separate
   id-mapping layer; (b) after matching, a "Hujjat yaratish" step maps
   `mosliklar` to `{qator_id, hajm, narx}` and calls the existing, already
   -shipped, already-tested `sbT2AktYarat` (`/api/sb-yoz` `akt_yarat` →
   `t2_akt_yarat` RPC — the SAME RPC both the GAS bridge and the manual
   `TestF2.tsx` entry page use; it is not new, only newly reachable from
   this pipeline), with a per-run `operation_id` (`yangiOperationId()`)
   for idempotency. Manual JSON paste is kept as a fallback (labeled and
   disabled from writing, since a hand-typed `row` cannot be trusted as a
   real `qator_id`) — Supabase-sourced trees are labeled and enable the
   write step. `npx tsc -b` exit 0, `oxlint` clean, full suite 150/150
   (nothing in the matcher/parser/endpoint changed — only this page and
   its two new small helpers). **Still NOT the production cutover**:
   `/admin/f2` (`F2Import.tsx`) is untouched; this proves the GAS-free
   upload→parse→match→**Supabase write** loop closes end-to-end in the
   parallel `test02` page, which is the concrete precondition for ever
   attempting the canonical-route cutover (item 7). File upload for the
   canonical route is a separate, still-open architecture question
   (`apiF2FaylOqi` there takes a Drive `fileId`, not raw bytes — see the
   owner Q&A this session).
7. **Canonical `/admin/f2` cutover** — **NOT STARTED, real user-facing
   surgery.** Retiring `navbat.ts`/`kuzatuv.ts`'s F2 queue usage and
   switching the canonical route's `useF2*` hooks to this pipeline needs
   its own design pass (fallback strategy, staged rollout, and — per the
   owner Q&A — a decision on the file-upload architecture: direct-to-R2,
   Drive-intermediate-with-direct-Cloudflare-read, or defer) per owner
   requirement §12's acceptance bar (disabling GAS must not break F2
   import/matching), not a rushed edit.

None of 1-7 should be attempted as a rushed single pass — each carries real
financial-correctness or data-durability risk, and the Constitution's
"Change safety" rule (migrations/production changes need explicit human
approval, evidence over a green regex) applies to every one of them.
