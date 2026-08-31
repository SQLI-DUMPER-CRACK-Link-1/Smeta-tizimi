# STOR-001 + Visible Slice — Production release package

Status: **CODE COMPLETE — NOT APPLIED.** One blocker on acceptance execution
(§6). Awaiting one consolidated human approval.

Final branch: `integration/storage-visible-final`
Final commit: `8770f11`
Base: `origin/main @ 37e5f0e` via `codex/company-storage-foundation-v1 @ 5cf51c0`
+ `codex/storage-visible-components-v1 @ 20415b4`.

---

## 1. What will change

### DB (Supabase `tuoyrzadkgoltpqkdiyx`) — NOT YET APPLIED
| Migration | Purpose | Rollback |
|---|---|---|
| `20260830052000_t2_company_storage_foundation_v1.sql` | 4 storage tables + legacy allowlist + `t2_obyekt` storage columns + RLS + actor-bound idempotent command RPCs (Codex, STOR-001A) | `...rollback.sql` |
| `20260831190000_t2_storage_legacy_write_policy_v1.sql` | Flag A: `LEGACY_WORKSPACE_FORBIDDEN` fail-closed on legacy write | `...rollback.sql` |
| `20260831191000_t2_storage_reconciliation_v2.sql` | Flag B: deterministic reconciliation view | `...rollback.sql` |

`20260830044354_t2_signal_bulk_import_coalescing.sql` is already in prod under
this name — idempotent no-op on apply.

### GAS (`Smeta tizimi/`) — NOT YET DEPLOYED
`97_T2Storage.js`, `06_ObyektPapka.js` (Codex), `96_T2Papka.js` (Claude:
company folder root from `resolveCompanyStorage()` verified workspace, fail
closed — global config root removed), `T2_Yuklash.js` (root-scoped upload/import
quarantined as `apiT2Legacy*`), `30_Panel.js` (`apiT2F2Upload`),
`95_ObyektHujjat.js` (`apiT2DocumentUpload`), `T2_Import.js`.

### Frontend (Cloudflare Pages) — NEW, low risk
`frontend/src/components/storage/*` (Codex components + 8 passing tests),
`frontend/src/api/t2-storage.ts`, `frontend/src/test02/TestSaqlash.tsx`,
route in `App.tsx`, nav entry in `admin/AdminShell.tsx`. Existing screens
untouched. Degrades gracefully (fail-closed error states) until backend is live.

---

## 2. Deployment order

1. Apply the 3 DB migrations in filename order.
2. Run acceptance (§6).
3. `clasp push` GAS.
4. Deploy frontend (or ship frontend first — safe).

## 3. Rollback

Three `*.rollback.sql` in reverse order; `t2_obyekt` storage columns are additive
with defaults so existing rows are unaffected. GAS: redeploy previous version.
Frontend: revert Pages deploy. No Drive folder/file is ever deleted. ~20 min.

## 4. Legacy policy — CANONICAL

TIZIM_01 root = explicit legacy compatibility only. A company whose primary
workspace is `status='legacy'` (and in `t2_company_storage_legacy_allowlist`):
read + reconcile only; `t2_project_storage_provision_v1`, `t2_object_create_v1`,
object bind and document register all return `LEGACY_WORKSPACE_FORBIDDEN`. New
T2 companies are never implicitly legacy. No silent global-root fallback anywhere
(guarded by `frontend/testlar/t2_no_global_root.test.cjs`).

## 5. Reconciliation policy — CANONICAL

`t2_storage_reconciliation_v2` classifies by exact external-ID evidence only:
`MATCHED` (binding.folder_id = object.drive_id), `BOUND_NEW`, `CONFLICT_CHECK`
(human decision), `PENDING`, `NONE`. Name similarity is never used; nothing is
MATCHED on a guess. v1 view kept as a compatibility alias.

## 6. Acceptance — RELEASE BLOCKER

`supabase/tests/t2_company_storage_foundation_v1.acceptance.sql` has **not been
executed**. The Supabase project has only `main` (verified via `list_branches`);
a disposable/preview branch needs a paid `create_branch` (explicit cost
approval), and there is no local Postgres on the workstation.

Owner choice:
- **(a)** approve a temporary Supabase preview branch → migrate + acceptance +
  rollback there, then apply to prod; or
- **(b)** accept the risk, apply to prod and run acceptance immediately after
  with rollback scripts staged.

## 7. Live smoke plan (post-deploy)

1. New test company → bind workspace (verified) via `/admin/test/saqlash`.
2. Project → provision → verified, `project_root_folder_id` set.
3. Object → `storage_status='ready'`, `folder_id` written, **no global Drive
   search in GAS logs**.
4. Upload document → `t2_document_registry` row `active`.
5. Retry step 3 same operation_id → same object id, no duplicate.
6. Company A → Company B workspace → `STORAGE_TENANT_MISMATCH`.
7. Legacy-allowlisted company → provision → `LEGACY_WORKSPACE_FORBIDDEN`.

## 8. Verification status

| Check | Result |
|---|---|
| `vite build` / `tsc -b` | PASS |
| `tsc --noEmit` | PASS |
| `oxlint` (new files) | PASS |
| `frontend/testlar/hammasi.cjs` (17 suites) | PASS |
| Codex storage component tests | 8/8 PASS |
| `ops/governance-check.cjs` | PASS |
| `git diff --check` | clean |
| Browser preview (READY / NOT CONFIGURED / FAILED / PENDING / LEGACY) | PASS |
| Acceptance SQL on disposable DB | **BLOCKED (§6)** |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Acceptance not run pre-apply | §6 owner decision; rollbacks staged |
| GAS `06`/`96` rewrite breaks folder creation | behavioral cjs tests + smoke 2–3; rollback = prev script |
| Prod catalog drift (`t2_resource_command_v2`, `t2_mindmap_request_identity_v2` absent by name) | out of STOR-001 scope; tracked in `docs/reviews/2026-08-30_SCHEMA_DRIFT_RECONCILIATION.md` |
| service_role over-reach | every command re-validates actor via `t2_storage_actor_require_v1` |

## 10. Human approval

One request: **"STOR-001 + VISIBLE SLICE — PROD READY. APPROVE with §6 (a) or (b)?"**
