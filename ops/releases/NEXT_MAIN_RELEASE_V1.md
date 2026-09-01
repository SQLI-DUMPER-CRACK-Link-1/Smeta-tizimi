# NEXT-MAIN-RELEASE-V1 — production runbook

Status: **RELEASE_BLOCKED_WITH_EXACT_CONTINUATION.** PRODUCTION: NOT APPLIED. MAIN: NOT PUSHED.
Blockers (all owner-only): SESSIYA_KALIT confirmation in Cloudflare Production+Preview,
Cloudflare Pages deploy, authenticated post-deploy smoke tests, real Drive Forma-2/Smeta
template study for the Sheets projection. All local release gates are green (see §0).

- Current main: `b6db686`
- Release candidate: `integration/next-main-release-v1 @ 640b6c3` (26 ahead / 0 behind main, pushed)
- Supabase project: `tuoyrzadkgoltpqkdiyx`
- Frontend: Cloudflare Pages `smeta-tizimi.pages.dev` (git-integration auto-build on `main`)
- GAS: script `1fcGIysm…`; 20 versioned deployments + 1 HEAD

## What this release contains (source)

| Area | Change | Deploy gate |
|---|---|---|
| Boss panel (P0) | `t2_boss_dashboard_v1` canonical read model; `/admin/dashboard`; `/boss` + `/admin` index redirect there; legacy `Umumiy` at `/boss/eski` | migration + frontend |
| CTRL-001 (real) | capability registry + precedence resolver + kill-switch + jobs + deploy-state + `t2_system_control_v1` aggregate; `/api/system-control`; `/admin/system-control` wired to real data | migration + frontend |
| COMPANY/AUTH/DIRECTOR (P0) | multi-tenant fix (no auto-join-all); `t2_kompaniya_yarat_v1`, `t2_men_v1`, director-guarded `t2_azolik_*_v1`, `t2_royxat_sorov_qabul_v2`; `/api/company`; `/admin/kompaniya` | migration + frontend |
| FILE-TRUTH-001 | private `R2_CANONICAL`, two-phase reserve/finalize/reconcile, `/api/hujjat-yukla\|ol\|r2`, `t2_document_registry` canonical cols, `t2_replica_sync_job`, `98_T2ReplicaSync.js` (+ Drive **managed-move** write-back) | migration + R2 binding + Cloudflare + GAS |
| Document Center (real) | `t2_document_registry_v1` read model; `/api/hujjat-royxat`; `/admin/documents` renders real Codex `DocumentCenter`; download → private R2 | migration + frontend |
| Sheets write-back reference | `t2_document_sheets_writeback_v1` (stable id + base_version + operation_id); `99_T2SheetsReplica.js` reference worker | migration + GAS (optional) |
| SMETA/F2/NAKOPITELNIY | `20260910120000` F2 price-fact split (A `baseline_narx` frozen / B `narx` certified / C `actual_narx` NULL-when-unknown / D change price) + `t2_smeta_revision` original-baseline ledger + `t2_nakopitelniy_v1` bounded STABLE period-aware cumulative (approved-F2-only). `20260911120000` governed `t2_smeta_ozgarish` change control: atomic preflight-then-apply (zero partial mutation), compensating-revision reversal, optimistic lock, pre-use-only rollback. `20260912120000` `t2_forma3` UNRESOLVED boundary (no legal/tax/payment total or column) + `t2_yakunlash_talab` data-driven closeout pack + `t2_obyekt_yakunlash_v1` + `t2_workbench_v1` (→ `ConstructionDocumentControlReadModel`). Codex generic engine + 4 ports + validators + UI merged; O(n²) rescan fixed. | migration + frontend (workbench route + adapters still TODO — see continuation) |
| SECURITY P0 | hardcoded `ZAXIRA` session-key fallback removed; `_shared/auth.ts` fails closed; login → 503 when `SESSIYA_KALIT` unset | frontend — **gated on SESSIYA_KALIT confirmed set** |
| App identity | favicon.svg, manifest.webmanifest, `<PageIdentity/>` per-route titles, canonical routes, `/admin/_demo/*` | frontend |
| Participants | `/admin/participants` real read from `t2_loyiha_qatnashchilar_royxat` | frontend |

## Ordered production plan

### 0. PRECHECK
- `git fetch --all --prune`; confirm `origin/main` unchanged from `b6db686`.
- Confirm the candidate builds: `cd frontend && npm ci && npm run build && npx tsc -b && npm run test && npm run tekshir`.
- **SECURITY GATE:** confirm `SESSIYA_KALIT` is set in Cloudflare Pages for BOTH
  Production and Preview (check `/api/sessiya` → `zaxira_kalit: false`). The
  auth fail-closed change locks everyone out if it is unset.
- Snapshot: note current GAS live deployment version; record the pre-migration
  `list_migrations` tail (Supabase PITR is on — additive migrations, no manual backup).
- **Stop condition:** any build/typecheck/test failure, or `zaxira_kalit: true`.

### 1. Supabase migrations (in filename order, via `apply_migration`)
1. `20260902120000_t2_file_truth_r2_canonical_v1.sql`
2. `20260903120000_t2_boss_dashboard_read_model_v1.sql`
3. `20260904120000_t2_capability_registry_v1.sql`
4. `20260905120000_t2_company_onboarding_v1.sql`
5. `20260906120000_t2_document_registry_read_v1.sql`
6. `20260907120000_t2_document_replica_move_v1.sql`
7. `20260908120000_t2_sheets_writeback_reference_v1.sql`
8. `20260910120000_t2_f2_baseline_price_v1.sql`
9. `20260911120000_t2_smeta_change_control_v1.sql` (depends on 8)
10. `20260912120000_t2_forma3_closeout_v1.sql` (depends on 8 + 9)
- **Expected:** `{"success":true}` for each.
- **Verify:** `list_migrations` tail shows all ten; `get_advisors security` shows
  no new CRITICAL (WARN on `SECURITY DEFINER` RLS helpers is expected/acceptable).
- **Rollback:** run the paired `*.rollback.sql` in **reverse** order (10→1). All
  additive; `20260905120000.rollback.sql` restores the original
  `t2_kirish_royxatga_ol` body verbatim. `20260910/11/12120000.rollback.sql` are
  **PRE-USE ONLY** — each `raise exception` if post-use business data exists
  (a sealed revision / an approved change / a Forma-3 certificate); post-use
  correction is a forward compensating event (`t2_smeta_ozgarish_qaytar_v1`),
  never history destruction. No business-data loss.
- **Stop condition:** migration error, or advisor CRITICAL introduced.

### 2. SQL acceptance (each inside a rolled-back transaction — writes nothing)
Run each `*.acceptance.sql` (substitute real company/actor/project/object ids);
each must raise its PASS sentinel:
- `20260902120000…acceptance.sql` → `FILE_TRUTH_ACCEPTANCE_PASS`
- `20260904120000…acceptance.sql` → `CTRL_ACCEPTANCE_PASS`
- `20260905120000…acceptance.sql` → `ONBOARDING_ACCEPTANCE_PASS`
- `20260906120000…acceptance.sql` → `DOCUMENT_REGISTRY_ACCEPTANCE_PASS`
- `20260907120000…acceptance.sql` → `REPLICA_MOVE_ACCEPTANCE_PASS`
- `20260908120000…acceptance.sql` → `SHEETS_WRITEBACK_ACCEPTANCE_PASS`
- `20260910120000…acceptance.sql` → `PARK_F2_BASELINE_ACCEPTANCE_PASS`
- `20260911120000…acceptance.sql` → `SMETA_CHANGE_CONTROL_ACCEPTANCE_PASS`
- `20260912120000…acceptance.sql` → `FORMA3_CLOSEOUT_WORKBENCH_ACCEPTANCE_PASS`
- `select public.t2_boss_dashboard_v1(<co>,<actor>);` → `ok:true` with real sections
- `select public.t2_system_control_v1(<co>,<actor>,null);` → `ok:true`, capabilities non-empty
- **Stop condition:** any step raises anything other than its PASS sentinel.
- (The first 8 were run green against prod on 2026-09-01; `20260910/11/12120000`
  were run green against prod on 2026-09-02 inside `BEGIN … ROLLBACK` — Unit C
  composed on top of Units A+B with a synthesized approved F2 on object 8.)

### 3. Private canonical R2 (Cloudflare dashboard — MANUAL, owner or admin)
- Create a **new R2 bucket** (e.g. `smeta-canonical`), **no public access, no
  custom domain**.
- Pages project → Settings → Functions → R2 bindings: add `R2_CANONICAL` → that
  bucket.
- Pages env vars: `REPLICA_SYNC_SECRET` (32+ random), `CANONICAL_HASH_INLINE_LIMIT=26214400`,
  `CANONICAL_MAX_UPLOAD_BYTES=536870912`.
- **Verify:** after deploy, `GET /api/hujjat-ol?id=1` returns `401`/`404`
  (not `CONFIG`).
- **Rollback:** remove the `R2_CANONICAL` binding → the endpoints fail closed
  (`CONFIG` 500); no existing route affected. Delete the bucket only if empty.
- **Stop condition:** cannot create a private bucket / binding.

### 4. Frontend / main deploy
- Merge `integration/next-main-release-v1` → `main` (`git merge --no-ff`), push
  `main`. **No force.**
- Cloudflare Pages auto-builds `main`. Watch the deployment to "Success".
- **Verify:** `smeta-tizimi.pages.dev/admin/dashboard` chunk present; `/api/boss-dashboard`
  returns `401` unauthenticated (endpoint live).
- **Rollback:** Cloudflare Pages → redeploy the previous `main` deployment;
  `git revert` the merge on `main`.
- **Stop condition:** Pages build fails.

### 5. GAS replica worker (only if shipping replica sync now — else DEFER)
- `clasp push` from `Smeta tizimi/`, `clasp version`, redeploy all versioned
  deployments to the new version (script in earlier STOR-001 runbook).
- Script Properties: `REPLICA_SYNC_SECRET` (same value as Cloudflare),
  `R2_INTERNAL_URL=https://smeta-tizimi.pages.dev/api/hujjat-r2`.
- Time-driven trigger: `ScriptApp.newTrigger('apiT2ReplicaSyncTick').timeBased().everyMinutes(5).create()`.
- **Verify:** upload a doc via `/api/hujjat-yukla`; within 5 min the
  `t2_replica_sync_job` row → `synced` and `drive_sync_status='synced'`.
- **Rollback:** delete the trigger; jobs stay `pending` (canonical unaffected).
- **Stop condition:** internal R2 read returns 403 (secret mismatch).

### 6. Controlled Drive backfill pilot (optional, later approval)
- Pick ONE known `t2_document_registry` row with `external_file_id` and no
  `r2_key`. GAS fetches that exact file by id, sha256, PUT to `R2_CANONICAL`,
  `t2_document_canonical_backfill_v1`.
- **Verify:** row `canonical_storage_status='stored'`, `drive_sync_status='synced'`,
  download from `/api/hujjat-ol` returns the same bytes/hash.
- **No global name search. AMBIGUOUS/MISSING → review job, do not bind.**

### 7. Smoke tests
Run `ops/releases/NEXT_MAIN_RELEASE_V1.md` §"Owner morning smoke" below.

### 8. Rollback criteria (abort the release if ANY)
- Migration error or new advisor CRITICAL.
- `/admin/dashboard` blank or `/api/boss-dashboard` 5xx for a real session.
- `/api/system-control` or `/api/company?me=1` 5xx for a real session.
- A brand-new login lands with memberships it should not have (multi-tenant regression).
- Canonical upload leaves a `reserved` row that reconcile cannot resolve.
- Any anonymous path can read a canonical R2 object.
- `zaxira_kalit: true` after deploy (auth key not actually set → everyone locked out).
- Existing routes (`/admin/test/*`, storage, mindmap) regress.

## Owner morning smoke (exact)

1. Login → land on `/admin/dashboard`.
2. Correct company context (top selector).
3. Boss panel: real project count, contracts total, F2 total, open signals.
   Finance cards honest ("ulanmagan" if `t2_bux_umumiy` empty).
4. `/admin/storage` shows **Supabase + R2 = canonical**, Drive = replica.
5. Select company/project/object → upload a small PDF → UI reaches
   `CANONICAL READY` (RESERVING→UPLOADING→FINALIZING).
6. Download the same PDF (`/api/hujjat-ol`) — byte-identical, `X-Canonical-Source: r2`.
7. Drive replica row PENDING→SYNCED (or honest FAILED) — canonical unaffected.
8. Simulate Drive failure (revoke folder) → the file still downloads from R2.
9. `/admin/participants` → real project parties from `t2_loyiha_qatnashchilar_royxat`.
10. `/admin/system-control` → real capability list; toggle a non-kill-switch
    capability off at company scope, confirm the audit row + effective state;
    toggle back. Kill-switch a kill-switchable capability, confirm hard-stop, release it.
11. `/admin/kompaniya` → your real memberships with the director crown; the
    "onboarding" banner is absent (you are a member). Do NOT create a throwaway
    company on prod unless you want it.
12. `/admin/documents` → real registry list (or the honest "not applied" banner
    if migrations were skipped); a doc with a failed Drive replica still shows
    `CANONICAL READY` + a replica-only warning.
13. Browser tab title changes per route (`… | SMETA TIZIM 02`); favicon present.
14. `/admin/test/saqlash` still works (compatibility); `/boss` → `/admin/dashboard`.
15. Large file: > `CANONICAL_MAX_UPLOAD_BYTES` → deterministic 413.
16. Log out, hit `/api/sessiya` → `zaxira_kalit: false`.

## Consolidated production approval request

> **APPROVED?** Apply, in filename order, migrations `20260902120000` …
> `20260912120000` (ten total) to Supabase `tuoyrzadkgoltpqkdiyx` (all additive;
> paired rollbacks ready — `…10/11/12` are PRE-USE ONLY; all 11 acceptance
> scripts already passed on prod inside rolled-back transactions). In Cloudflare Pages: create a **new private** R2
> bucket + `R2_CANONICAL` binding, add `REPLICA_SYNC_SECRET`,
> `CANONICAL_HASH_INLINE_LIMIT=26214400`, `CANONICAL_MAX_UPLOAD_BYTES=536870912`,
> and confirm `SESSIYA_KALIT` is set for **Production AND Preview**. Merge
> `integration/next-main-release-v1` → `main` (`--no-ff`, no force) and let Pages
> auto-deploy. Optionally deploy the GAS replica workers (`98_T2ReplicaSync.js`
> + `99_T2SheetsReplica.js`) with their triggers. After each step run the §8
> rollback checks; ANY trip → roll that step back and report the exact cause.
> This approval covers the NEXT-MAIN-RELEASE-V1 + SMETA/F2/NAKOPITELNIY scope only.
> Do NOT run the Drive backfill pilot yet (separate approval).
>
> **Still open after this release (do not block on them):** the SMETA/F2 workbench
> is backend-complete and acceptance-verified but has no visible route yet —
> `/api/workbench|nakopitelniy|smeta-ozgarish|forma3|closeout` Cloudflare functions,
> the 4 canonical port adapters, and an `/admin/hujjat-nazorat` page wiring the
> Codex `<ConstructionDocumentWorkbench>` are the next build step. The Sheets
> document-projection (marker + canonical relation + hidden system columns, never
> banner rows or NAIMENOVANIE edits) and the F2 document-fidelity acceptance
> (A–L) need real Drive Forma-2 / Smeta template examples to finish.
