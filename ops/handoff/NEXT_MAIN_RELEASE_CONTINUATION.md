# NEXT-MAIN-RELEASE-V1 — continuation handoff

Context-survival record. If a session ends mid-task, resume from here.

## Exact position

- Branch: `integration/next-main-release-v1`
- HEAD at handoff write: `f7a35eb` (+ this governance commit on top)
- Worktree: `C:\Users\anvar\.claude\worktrees\next-release`
- Base main: `b6db686` (unchanged; verify with `git fetch --all --prune`)
- Status: **READY_FOR_OWNER_APPROVAL**
- Production status: NOTHING applied. No `main` push. No Supabase migration applied.
  No R2 / Cloudflare / GAS mutation. `production_write_allowed = false`.

## Completed phases

1. Boss Panel P0 root cause + canonical read model
   `supabase/migrations/20260903120000_t2_boss_dashboard_read_model_v1.sql`
   (+ `.rollback.sql`), `functions/api/boss-dashboard.ts`, `src/api/t2-boss.ts`,
   `src/admin/sahifalar/BossDashboard.tsx`, `testlar/t2_boss_panel.test.cjs`.
   Verified read-only against prod data (company 1, 2 projects, 8 objects,
   contracts 68.32B, F2 242M, 1342 open signals). No fake numbers in UI.
2. FILE-TRUTH-001 P0 pre-production corrections — done earlier, on main `b6db686`
   and inherited here (private `R2_CANONICAL`, true large-file stream path,
   two-phase reserve/finalize/reconcile, replica worker source, security tests).
3. Codex UI integration into `f7a35eb`: document-center, participant-network,
   system-control, app-identity. `/admin/participants` wired to real
   `t2_loyiha_qatnashchilar_royxat`. `/admin/documents` + `/admin/system-control`
   honest pending-state pages + `/admin/_demo/*` harnesses.
4. App identity: canonical routes, `<PageIdentity/>` per-route titles, favicon,
   manifest. `/admin` index + `/boss` → `/admin/dashboard`; legacy `Umumiy` at
   `/boss/eski`.
5. Governance/branch/roadmap reconciliation:
   `docs/governance/CURRENT_STATE.md`, `ops/ACTIVE_TASKS.json` (NREL-001),
   `ops/handoff/BRANCH_RECONCILIATION_NEXT_RELEASE.md`,
   `docs/architecture/CONSTRUCTION_OS_MASTER_ROADMAP.md`.
6. Production runbook: `ops/releases/NEXT_MAIN_RELEASE_V1.md`.

## Incomplete / deferred (documented, NOT blocking approval)

- PHASE G storage-screen relabel (Drive = replica, not "asosiy storage"):
  confirm the copy in `src/components/storage/*` / `TestSaqlash.tsx`; small
  follow-up commit if not already present.
- CTRL-001 capability-registry backend — DEFERRED-P1 (contract only).
- Company onboarding / director model vertical slice — DEFERRED-P1.
- Document Center real backend wiring — waits on FILE-TRUTH migration apply.
- Drive replica worker deploy + Sheets write-back reference impl — DEFERRED-P1.
- Full security audit items H1/H2/H4/H5 — partial; H3 (private R2) done in source.

## Blockers

- No disposable Supabase branch: acceptance runs on prod inside rolled-back
  transactions only.
- Claude cannot log in to production → authenticated end-to-end smoke
  (upload/download/dashboard) must be run by the Product Owner (runbook §"Owner
  morning smoke").
- Claude cannot mutate Cloudflare env/bindings or create the R2 bucket → runbook
  §3 lists the exact manual dashboard steps.

## Next exact commands (after owner approval only)

```
git fetch --all --prune                 # confirm origin/main still b6db686
cd frontend && npm ci && npm run build && npx tsc -b && npm run test
```
Then follow `ops/releases/NEXT_MAIN_RELEASE_V1.md` sections 0→8 in order.

## Files currently owned by this task

See `ops/ACTIVE_TASKS.json` → `NREL-001.owns`.

## Architecture decisions locked this task

- Boss panel truth = ONE bounded RPC `t2_boss_dashboard_v1(kompaniya, actor)`
  aggregating existing read models. No N+1. No Drive/Sheets/GAS on this path.
  `limit 200` projects, `limit 25` signals. `security definer`, service_role
  only, membership-checked via `t2_actor_kompaniya_azo_tekshir` (boss/rahbar
  allowed — must NOT reuse `t2_mindmap_actor_tekshir`).
- Boss panel finance cards render "Ma'lumot modeli hali ulanmagan" rather than
  zeros when the underlying read model is empty.
- Canonical admin route = `/admin/dashboard`. `/admin/test/*` kept for
  compatibility during transition.

## Production status

APPLIED: nothing from this task. NOT APPLIED: `20260902120000` file-truth,
`20260903120000` boss-dashboard. NOT DONE: private R2 bucket, Cloudflare
bindings/env, frontend deploy, `main` merge, GAS replica worker.

## Next recommended task after this release ships

P1-A: CTRL-001 capability registry + Control Center real wiring
(`claude/ctrl-capability-registry-v1`, task CTRL-001B).
