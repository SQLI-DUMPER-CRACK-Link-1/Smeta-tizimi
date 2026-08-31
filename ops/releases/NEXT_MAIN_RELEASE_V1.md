# NEXT-MAIN-RELEASE-V1 — production runbook

Status: **READY_FOR_OWNER_APPROVAL.** PRODUCTION: NOT APPLIED. MAIN: NOT PUSHED.

- Current main: `b6db686`
- Release candidate: `integration/next-main-release-v1 @ f7a35eb`
- Supabase project: `tuoyrzadkgoltpqkdiyx`
- Frontend: Cloudflare Pages `smeta-tizimi.pages.dev` (git-integration auto-build on `main`)
- GAS: script `1fcGIysm…`; 20 versioned deployments + 1 HEAD

## What this release contains (source)

| Area | Change | Deploy gate |
|---|---|---|
| Boss panel (P0) | `t2_boss_dashboard_v1` canonical read model; `/admin/dashboard`; `/boss` + `/admin` index redirect there; legacy `Umumiy` at `/boss/eski` | migration + frontend |
| FILE-TRUTH-001 | private `R2_CANONICAL`, two-phase reserve/finalize/reconcile, `/api/hujjat-yukla|ol|r2`, `t2_document_registry` canonical cols, `t2_replica_sync_job`, `98_T2ReplicaSync.js` | migration + R2 binding + Cloudflare + GAS |
| App identity | favicon.svg, manifest.webmanifest, `<PageIdentity/>` per-route titles, canonical routes, `/admin/_demo/*` | frontend |
| Participants | `/admin/participants` real read from `t2_loyiha_qatnashchilar_royxat` | frontend |
| Document Center / Control Center | honest "not applied / DEFERRED-P1" pages + demo harnesses | frontend |
| Storage screen | (relabel Drive as replica — see PHASE G note; small follow-up commit if not in `f7a35eb`) | frontend |

## Ordered production plan

### 0. PRECHECK
- `git fetch --all --prune`; confirm `origin/main` unchanged from `b6db686`.
- Confirm `f7a35eb` builds: `cd frontend && npm ci && npm run build && npx tsc -b`.
- Snapshot: note current GAS live deployment version; Supabase point-in-time
  recovery is enabled (Supabase default) — no manual DB backup needed for
  additive migrations, but record the pre-migration `list_migrations` tail.
- **Stop condition:** any build/typecheck failure.

### 1. Supabase migrations (in filename order)
Apply via `apply_migration`:
1. `20260902120000_t2_file_truth_r2_canonical_v1.sql`
2. `20260903120000_t2_boss_dashboard_read_model_v1.sql`
- **Expected:** `{"success":true}` for each.
- **Verify:** `list_migrations` tail shows both; `get_advisors security` shows no
  new critical (a WARN on `t2_storage_actor_company_access_v1`-style RLS helpers
  is expected/acceptable).
- **Rollback:** run the paired `*.rollback.sql` in reverse order (additive-only;
  no data loss).
- **Stop condition:** migration error, or advisor CRITICAL introduced.

### 2. SQL acceptance (rolled-back transaction — writes nothing)
- Run `supabase/migrations/20260902120000_t2_file_truth_r2_canonical_v1.acceptance.sql`
  (substitute a real company/actor/project/object). Expect it to raise
  `FILE_TRUTH_ACCEPTANCE_PASS`.
- Run `select public.t2_boss_dashboard_v1(<co>, <actor>);` — expect `ok:true`
  with real project/finance/F2/signal sections.
- **Stop condition:** any acceptance step raises other than the PASS sentinel.

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
- Canonical upload leaves a `reserved` row that reconcile cannot resolve.
- Any anonymous path can read a canonical R2 object.
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
10. `/admin/system-control` → real Supabase/Cloudflare probes; separate
    core-vs-replica health language.
11. Browser tab title changes per route (`… | SMETA TIZIM 02`); favicon present.
12. `/admin/test/saqlash` still works (compatibility); `/boss` redirects to
    `/admin/dashboard`.
13. Large file: > `CANONICAL_MAX_UPLOAD_BYTES` → deterministic 413 with a clear
    message.

## Consolidated production approval request

See the session final report for the exact one-paragraph approval text.
