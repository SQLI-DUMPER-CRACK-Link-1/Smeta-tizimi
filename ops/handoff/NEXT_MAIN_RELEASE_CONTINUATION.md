# NEXT-MAIN-RELEASE-V1 — continuation handoff

Context-survival record. If a session ends mid-task, resume from here.

## Exact position

- Branch: `integration/next-main-release-v1`
- HEAD: `640b6c3` (26 ahead / 0 behind `origin/main` @ `b6db686`, pushed)
- Worktree: `C:\Users\anvar\.claude\worktrees\next-release`
- Status: **RELEASE_BLOCKED_WITH_EXACT_CONTINUATION** (all local gates green; blockers all owner-only)
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
    `NEXT_MAIN_RELEASE_V1.md` runbook (10 migrations, security gate), this file,
    `ops/ACTIVE_TASKS.json` (NREL-001).
11. **SMETA/F2/NAKOPITELNIY (3 migrations, acceptance-verified on prod 2026-09-02):**
    - `20260910120000_t2_f2_baseline_price_v1.sql` (+rollback PRE-USE +acceptance
      `PARK_F2_BASELINE_ACCEPTANCE_PASS`): price facts A/B/C/D never collapsed;
      `t2_smeta_revision` seq-0 original baseline (lazy-sealed, never drifts);
      `t2_akt_yarat` freezes `baseline_narx`/stamps `revision_id`;
      `t2_nakopitelniy_v1` STABLE, no temp table, bounded detail + one aggregate,
      cumulative = approved F2 only, draft/pending shown separately.
    - `20260911120000_t2_smeta_change_control_v1.sql` (+rollback PRE-USE +acceptance
      `SMETA_CHANGE_CONTROL_ACCEPTANCE_PASS`): `t2_smeta_ozgarish` governed layer
      over `t2_qator` (reuses `t2_qator_tahrir`/`t2_qator_qosh`). ATOMIC approval —
      PHASE 1 preflight validates every line (`FOR UPDATE` locked), returns
      `CHANGE_PREFLIGHT_FAILED` with ZERO mutation; PHASE 2 applies; post-preflight
      race → `raise exception` (never partial commit). Approved-change reversal =
      `t2_smeta_ozgarish_qaytar_v1` compensating revision (restore frozen values,
      soft-remove added rows `hajm=0`, never DELETE, never history destruction).
    - `20260912120000_t2_forma3_closeout_v1.sql` (+rollback PRE-USE +acceptance
      `FORMA3_CLOSEOUT_WORKBENCH_ACCEPTANCE_PASS`): `t2_forma3` thin period
      container — `FORMA3_RULE_UNRESOLVED` until verified evidence; NO markup/tax/
      payment/legal-total column or formula; only numeric = `bajarilgan_f2_summa`
      (a FACT). `t2_yakunlash_talab` data-driven closeout pack (project>company>
      global). `t2_obyekt_yakunlash_v1` + `t2_workbench_v1` → generic
      `ConstructionDocumentControlReadModel`.
12. **Codex takeover + integration:** merged `codex/park-regression-lab-v1`
    (`f6d04c3`), `codex/park-closeout-lab-v1` (`769c06b`),
    `codex/construction-document-control-workbench-v1` (`5586eb5`). Codex
    uncommitted worktree work checkpointed as `87b2b31` and pushed before
    integration. Unrelated Commercial/Procurement/Schedule V3 NOT merged.
    Engine O(n²) period/change rescan fixed (`640b6c3`) — 10k-row valuation
    3.35s → ~35ms. Regression gate `generateParkLegacyCompatibilityReport()` =
    MATCH:1 / INTENTIONAL_CHANGE:2 / UNRESOLVED:1 / **BUG_FOUND:0**.
13. Guard test `frontend/testlar/t2_smeta_f2_nakopitelniy.test.cjs` (66 checks),
    wired into `hammasi.cjs`. Architecture doc renamed/generalized
    `docs/architecture/SMETA_F2_NAKOPITELNIY_CHANGE_CONTROL_V1.md`.

## Node test suites (all in `frontend/testlar/`, run via `npm run tekshir`)

`t2_boss_panel` (22) · `t2_control` (50) · `t2_company_onboarding` (37) ·
`t2_document_center` (33) · `t2_drive_replica` (30) · `t2_sheets_writeback` (22) ·
`t2_security_p0` (41) — all green + the pre-existing suites.

## SMETA/F2 — next build step (NOT blocking the migration release; do after)

The valuation/change/closeout backend is complete and acceptance-verified. What is
left to make it a visible product route:

1. Cloudflare functions (actor from session, membership-checked):
   `GET /api/workbench` → `t2_workbench_v1`; `GET /api/nakopitelniy` →
   `t2_nakopitelniy_v1`; `GET/POST /api/smeta-ozgarish` → `t2_smeta_ozgarish_royxat_v1`
   / `_yarat_v1` / `_tasdiqlash_v1` / `_qaytar_v1`; `GET/POST /api/forma3` →
   `t2_forma3_royxat_v1` / `_yarat_v1` / `_qoida_belgila_v1`; `GET /api/closeout` →
   `t2_obyekt_yakunlash_v1`.
2. Canonical adapters in `frontend/src/api/` implementing the 4 Codex ports
   (`ConstructionDocumentControlPort`, `ProgressValuationReadPort`,
   `ChangeControlCommandPort`, `ProjectCloseoutPort`) against those functions.
   Generalize `src/api/t2-park-document-control.ts` → `t2-document-control.ts`.
3. `/admin/hujjat-nazorat` page rendering the Codex `<ConstructionDocumentWorkbench>`
   fed by real canonical data. Add to `App.tsx` + `AdminShell` nav + `pageTitle.ts`.
4. Sheets document projection + F2 document-fidelity acceptance (A–L) — **needs
   real Drive Forma-2 / Smeta template examples** (Claude has no Drive access).
   The contract is locked: additional/replacement carried by marker +
   `t2_smeta_ozgarish_qator` relation + hidden system columns; NEVER a banner row,
   NEVER text appended to NAIMENOVANIE, NEVER canonical identity in the row number.

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
(10 migrations, filename order; reverse order for rollback — `…10/11/12` are
PRE-USE ONLY and refuse once business data exists).

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
