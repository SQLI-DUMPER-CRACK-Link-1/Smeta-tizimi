# T2-PTO-CLOSURE-007 — F2 resumable import, UI wiring (Claude)

Continuation of `T2_PTO_CLOSURE_007_CODEX_F2_RESUMABLE_IMPORT.md` /
`_REPORT.md` (Codex poydevori: SOURCE_READY, UI_WIRING_PENDING). This report
covers exactly the "Qolgan majburiy ulash" list from that report.

## 1. Migration — reviewed again, APPLIED to production

`supabase/migrations/20260922120000_t2_f2_import_job_v1.sql` was read in full
(not re-trusted blindly): two additive tables (`t2_f2_import_job`,
`t2_f2_import_draft_qator`, RLS enabled, no existing table altered) + five
`security definer` RPCs, all membership-checked via
`t2_actor_kompaniya_azo_tekshir`, all revoked from `public`/`anon`/
`authenticated`, granted only to `service_role`.

**Applied to the real production project (`tuoyrzadkgoltpqkdiyx`) this
session** via `apply_migration` — confirmed present in `list_migrations`
afterward. Then ran the migration's own `.acceptance.sql` logic directly
against real data (`obyekt_id=5`, an actual active company member as actor),
wrapped so it self-rolls-back on a deliberate final exception — confirmed
`select count(*) from t2_f2_import_job` / `t2_f2_import_draft_qator` both
return `0` afterward (no residue). All acceptance assertions passed:
idempotent job creation, optimistic-lock rejection of a stale `versiya`,
cursor persistence, draft upsert-in-place, stale-draft-version rejection,
durable draft resumption read, membership isolation.

## 2. Session-verified actor API adapter (Codex "qolgan" item 1)

- `frontend/functions/api/sb.ts` — added `f2_import_job_holat_v1` /
  `f2_import_draft_royxat_v1` to the narrow, GET-only, named read-RPC
  allowlist (both `stable`, exactly like `price_control_v1`). New `job_actor`
  branch sets `p_job_id`; `p_actor_id` is injected from the verified session,
  never the request body — same law as `obyekt_actor`/`akt_actor`.
- `frontend/functions/api/sb-yoz.ts` — added `f2_import_job_yarat`,
  `f2_import_job_ilgarilash`, `f2_import_draft_saqla` to the named write-RPC
  allowlist. Each validates its own shape (UUID `operation_id`, `1..100000`
  `total_rows`, non-negative deltas, `1..5000` draft rows) before dispatch;
  `p_actor_id` always `sess.foydalanuvchi_id`.
- `frontend/src/api/supabase.ts` — typed wrapper functions
  (`sbT2F2ImportJobYarat/JobIlgarilash/DraftSaqla/JobHolat/DraftRoyxat`).

## 3. `F2ImportNative.tsx` — job/draft wiring (Codex "qolgan" items 2-3)

- Old hard walls (`>15MB`, `>20000` qator) replaced with `MAX_FILE_BYTES`
  (50MB) / `MAX_ROWS` (60000) — chosen deliberately below the migration's own
  `100000` ceiling but comfortably above both the perf-tested range
  (`f2-match-engine.perf.test.ts`: ~52,800 rows / ~2s) and Codex's own
  "tugadi" scenario (~30,000 rows). Not raised to the schema max because
  browser memory for the read+match step (not chunked — see below) is a real,
  untested-past-52.8k limit.
- **What is chunked vs. not, and why**: the file read and the matching call
  itself are NOT split into batches — `f2MatchEngine` is already proven fast
  and atomic at this scale (~2s for 52.8k rows), so artificially chopping it
  would add real complexity (partial-tree matching correctness risk) without
  reducing real risk. What genuinely needed durability is the **manual
  review phase that follows** — this can run long, and a crash/refresh
  during it previously lost everything. So: after a successful match, the
  full leaf set is persisted as draft rows in chunks of `DRAFT_CHUNK=5000`
  (the RPC's own hard limit per call), and a job-progress checkpoint
  (`t2_f2_import_job_ilgarilash_v1`) is written **after every chunk**, not
  once at the end — a browser crash mid-loop leaves `processed_rows`/
  `cursor.chunk` at the last completed chunk boundary, not at zero.
- **Status state machine note (a real bug caught before it shipped)**: the
  RPC's own status transition table only allows `queued->running/failed/
  cancelled` and `running->...->completed` — NOT `paused->completed`. An
  earlier draft of this change used `status:'paused'` for the review
  checkpoint, which would have made the final `save()` step's `running`-only
  requirement... no: it would have made `paused->completed` on save silently
  fail with `BAD_STATUS_TRANSITION` every time. Fixed: the review checkpoint
  uses `status:'running'` throughout (semantically: "job is still active,
  waiting on a human"), which the state machine allows to transition
  straight to `completed`.
- **Resumption** (Codex "qolgan" item 3): on selecting an object, a
  `useEffect` checks `localStorage['t2-f2-import-job:<objectId>']` (secondary
  cache only — an ID, not state) and calls `t2_f2_import_job_holat_v1`; if
  the job is non-terminal, a "Tugallanmagan import bor — Davom ettirish"
  banner appears. Clicking it reads `t2_f2_import_job_holat_v1` +
  `t2_f2_import_draft_royxat_v1` and reconstructs `source`/`mapping` directly
  from the draft rows' own `hajm`/`narx`/`summa`/`lrv_row` columns — **no
  original file bytes needed**, because R2 file persistence was explicitly
  out of scope (Codex brief item 5) and the draft table already carries
  everything `exactWrite` needs. The one accepted fidelity loss: display
  labels for resumed rows show only `kod` (draft-stored), not the full
  `nom`/`bir` (would need the original file) — this affects the review
  table's readability only, not `exactWrite`'s correctness, which never
  reads labels. The write-path `operation_id` (for `t2_akt_yarat_v2`,
  unrelated to the job's own `operation_id`) round-trips through the job's
  opaque `cursor` field so a resumed session still writes the *same*
  `t2_akt` document on save, not a duplicate.
- On a successful `save()`, the job is marked `completed` (best-effort — a
  failure here does not affect the user; the exact-source document is
  already durably written by that point) and the localStorage key is
  cleared.
- **Resilience law**: every job/draft call is wrapped so a failure degrades
  to a visible warning ("qoralama saqlanmadi... davom etishingiz mumkin")
  rather than blocking the primary read/match/review/write flow — matches
  Codex brief item 4 ("yozish qonuni o'zgarmaydi... EXACT SOURCE yozish
  mantig'ini o'zgartirmaydi").
- R2 file persistence: still explicitly out of scope, as directed.

## 4. "Tugadi" mezoni — proven (mock, no DB; per Codex brief §"QAT'IY
   CHEKLOVLAR": no real 17,521-row production data touched)

`F2ImportNative.ui.test.tsx` — new test drives a **30,000-row** synthetic
in-memory sheet (no real file bytes, no DB) through the full component:

- Not rejected (the old `>20000` wall is gone; asserted directly).
- `t2_f2_import_draft_saqla_v1` called exactly 6 times (30,000 / 5,000),
  each batch `<=5000` rows.
- `t2_f2_import_job_ilgarilash_v1` called exactly 6 times (once per chunk,
  not once at the end) — the final call's `cursor.chunk` is `30000`,
  proving the checkpoint actually reaches the end, not just "started".

Two more new tests cover: (a) the normal path now also calls
`job_yarat`/`draft_saqla`/`job_ilgarilash` with the right shapes before the
existing save-with-retry assertions; (b) resuming an in-progress job
(`status:'running'`, one draft row) skips upload entirely, lands directly on
"Ko'rib chiqish kerak (tiklangan)", and `save()` reuses the resumed
`operation_id` — proving a resumed session cannot create a duplicate
document.

`F2ImportNative.test.ts`'s existing "legacy komponent tanasi o'zgarmagan"
test (byte-for-byte diff of `F2ImportLegacy` against a historical commit)
still passes unmodified — this task did not touch the GAS-backed legacy body
or the native-mode toggle at all.

## 5. Gates (this session, real runs)

- `npx tsc -b`: exit 0
- `npm run typecheck:functions` (`tsconfig.functions.json`): exit 0
- `npx oxlint` (whole repo): 0 new warnings — the ~20 warnings present are
  all pre-existing, in files this task did not touch (diffed against a
  `git stash` baseline for `F2ImportNative.tsx` specifically to confirm)
- `npx vitest run` (whole frontend suite): **242/242 pass** (was 240/240
  before this session's Supabase-log investigation increment, +2 for this
  task: the resumption test and the 30k-row checkpoint test net of one
  pre-existing test count drift)
- `npm run build`: succeeds
- `node ops/governance-check.cjs`: PASS

## 6. What is still NOT done (explicitly, do not understate)

- R2 canonical file storage for the uploaded `.xlsx` — still out of scope,
  per Codex's own brief. A resumed session's review table shows `kod` only
  for previously-matched rows, not full `nom`/`bir` (cosmetic, not
  functional).
- No cleanup job for orphaned `queued`/`running` jobs a user never returns
  to (e.g. uploads a different file for the same object, silently
  overwriting the localStorage pointer to the old job). Harmless — the old
  job just sits unreachable in `t2_f2_import_job`, not deleted, not costing
  correctness — but worth a future admin-visible job list if it matters.
- This entire pipeline is still reached ONLY through the `F2ImportNative`
  path of `F2Import.tsx`'s `t2-f2-native-mode` localStorage toggle, which
  defaults to **off**. No canonical-route default behavior changed.
