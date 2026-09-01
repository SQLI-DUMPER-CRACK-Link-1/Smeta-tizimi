# NEXT-MAIN-RELEASE-V1 — continuation handoff

Context-survival record. If a session ends mid-task, resume from here.

## Exact position

- Branch: `integration/next-main-release-v1`
- HEAD: `6a6f0d1` (16 ahead / 0 behind `origin/main` @ `b6db686`)
- Worktree: `C:\Users\anvar\.claude\worktrees\next-release`
- Status: **READY_FOR_OWNER_APPROVAL_V2**
- Production: NOTHING applied. No `main` push. No Supabase migration applied.
  No R2 / Cloudflare / GAS mutation. `production_write_allowed = false`.

## Completed (this + prior session)

1. Boss Panel P0 — canonical `t2_boss_dashboard_v1` + `/admin/dashboard`.
2. FILE-TRUTH-001 pre-production corrections (private R2, two-phase, replica worker).
3. Codex UI integration (document-center, participants, system-control, app-identity).
4. **CTRL-001 real backend** — `20260904120000_t2_capability_registry_v1.sql`
   (+rollback+acceptance): `t2_capability`/`_override`/`t2_job`/
   `t2_integration_health`/`t2_deploy_state`, `t2_capability_effective_v1`
   (precedence + kill-switch), audited commands, `t2_system_control_v1`.
   `functions/api/system-control.ts`, `src/api/t2-control.ts`,
   `src/admin/pages/SystemControlPage.tsx` (real, no demo). Verified:
   `CTRL_ACCEPTANCE_PASS`.
5. **COMPANY/AUTH/DIRECTOR P0** — `20260905120000_t2_company_onboarding_v1.sql`:
   fixed `t2_kirish_royxatga_ol` auto-join-all bug (rollback restores original),
   `t2_kompaniya_yarat_v1`, `t2_men_v1`, director-guarded `t2_azolik_*_v1`,
   `t2_royxat_sorov_qabul_v2`. `functions/api/company.ts`, `src/api/t2-men.ts`,
   `src/admin/pages/KompaniyaPage.tsx` + `/admin/kompaniya`. Verified:
   `ONBOARDING_ACCEPTANCE_PASS`.
6. **Document Center real wiring** — `20260906120000_t2_document_registry_read_v1.sql`:
   `t2_document_registry_v1` bounded/membership-checked read model.
   `functions/api/hujjat-royxat.ts`, `hujjatRoyxatOl` in `t2-hujjat-canonical.ts`,
   `src/admin/pages/DocumentsPage.tsx` renders the real Codex `DocumentCenter`.
   Drive failure never a canonical failure. Verified:
   `DOCUMENT_REGISTRY_ACCEPTANCE_PASS`.
7. **Drive managed-move write-back** — `20260907120000_t2_document_replica_move_v1.sql`:
   `t2_document_replica_move_v1` (re-bind only to KNOWN binding else conflict+review;
   base_version guarded; canonical R2 untouched). MOVE branch added to
   `Smeta tizimi/98_T2ReplicaSync.js` (no global scan). Verified:
   `REPLICA_MOVE_ACCEPTANCE_PASS`.
8. **Sheets write-back reference** — `20260908120000_t2_sheets_writeback_reference_v1.sql`:
   `t2_document_sheets_writeback_v1` (stable id, row number rejected, base_version,
   operation_id). `Smeta tizimi/99_T2SheetsReplica.js` reference worker (row located
   by hidden `t2_entity_id` column). Verified: `SHEETS_WRITEBACK_ACCEPTANCE_PASS`.
9. **SECURITY P0** — `_shared/auth.ts` hardcoded `ZAXIRA` session-key fallback
   REMOVED; fails closed; `api/kirish.ts` returns 503 CONFIG (no cookie) when
   `SESSIYA_KALIT` unset. Audit of R2 privacy / upload validation / lineage
   guards / audit coverage — all pass `t2_security_p0.test.cjs`.
10. Governance: `CURRENT_STATE.md`, `CONSTRUCTION_OS_MASTER_ROADMAP.md`,
    `NEXT_MAIN_RELEASE_V1.md` runbook (7 migrations, security gate), this file,
    `ops/ACTIVE_TASKS.json` (NREL-001).

## Node test suites (all in `frontend/testlar/`, run via `npm run tekshir`)

`t2_boss_panel` (22) · `t2_control` (50) · `t2_company_onboarding` (37) ·
`t2_document_center` (33) · `t2_drive_replica` (30) · `t2_sheets_writeback` (22) ·
`t2_security_p0` (41) — all green + the pre-existing suites.

## Incomplete / DEFERRED (documented, NOT blocking approval)

- Content write-back R2 copy-in (Drive→R2 new revision) — currently a review job
  (GAS cannot S3-sign). P1-B.
- Invite-code onboarding flow + notifications — P1.
- Drive/Sheets GAS worker deployment + triggers + controlled backfill pilot — P1-A
  (needs `REPLICA_SYNC_SECRET`, separate approval for backfill).
- Full security review: H2 (DB-level service-role negative tests), H5 (audit
  completeness), session rotation — P1-C.
- Distinct `director` vs `boss` role label — P2 (`boss` IS the director today).

## Blockers

- No disposable Supabase branch — every migration verified only inside
  `BEGIN … ROLLBACK` on prod.
- Claude cannot log in to prod → authenticated end-to-end smoke is the Product
  Owner's (runbook §"Owner morning smoke", 16 steps).
- Claude cannot mutate Cloudflare env/bindings or create the R2 bucket → runbook §3.
- **SECURITY GATE**: the auth fail-closed change requires `SESSIYA_KALIT` set in
  Cloudflare (Production AND Preview) BEFORE deploy, else total lockout.

## Next exact commands (after owner approval only)

```
git fetch --all --prune                 # confirm origin/main still b6db686
cd frontend && npm ci && npm run build && npx tsc -b && npm run test && npm run tekshir
```
Then follow `ops/releases/NEXT_MAIN_RELEASE_V1.md` sections 0 → 8 in order
(7 migrations, filename order; reverse order for rollback).

## Files owned by this task

See `ops/ACTIVE_TASKS.json` → `NREL-001.owns`.

## Architecture decisions locked

- Control unit = a business capability/command/job/integration, never a per-JS
  toggle. Precedence project>company>global>default; kill-switch + global off =
  hard stop everywhere.
- Company creator becomes `rol='boss'` = the director. superadmin is
  platform-level and never grantable through company commands.
- A new user with zero memberships is a valid state (onboarding), never
  auto-joined to companies.
- Drive/Sheets are replicas: a replica failure is reported as replica health and
  never downgrades the canonical document. Replica identity is a stable id, never
  a Drive folder guess or a Sheets row number. Canonical R2 is never hard-deleted.
- Auth has no shipped fallback secret — fail closed.

## Next recommended task after this release ships

P1-A: deploy the GAS replica workers (`98_T2ReplicaSync.js`, `99_T2SheetsReplica.js`)
+ time-driven triggers + `REPLICA_SYNC_SECRET`, then the controlled Drive backfill
pilot (one row, separate approval).
