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
