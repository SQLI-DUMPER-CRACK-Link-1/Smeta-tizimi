# STOR-001 — Claude release review gate

Status: **NOT READY** — Codex work in progress. Claude completes every checkbox
here (with evidence) before requesting the single consolidated PROD approval.
Codex fills the operational release package at `ops/releases/STOR-001.md`;
this file is Claude's independent verification of it.

Milestone: Multi-company storage foundation.
Work branch: `codex/company-storage-foundation-v1` (rebased on `origin/main @ 37e5f0e`).

---

## 0. Release status model (fill on review)

| Stage | State |
|---|---|
| SOURCE READY | branch +9/-0 vs main — YES (pre-Codex) |
| REBASED ON MAIN | pending Codex |
| TESTED | pending |
| BRANCH PUSHED | pending Codex |
| CLAUDE REVIEW PASS | pending |
| MERGED TO MAIN | blocked on human approval |
| DB MIGRATION APPLIED | blocked on human approval |
| GAS DEPLOYED | blocked on human approval |
| CLOUDFLARE DEPLOYED | N/A this milestone (no `frontend/src` change) — confirm |
| LIVE SMOKE VERIFIED | pending |

---

## 1. Claude review checklist (each must be CONFIRMED with evidence)

### Architecture invariants
- [ ] New T2 company never inherits `ROOT_FOLDER_ID` / TIZIM_01 root / another
      company's workspace. Legacy only via `t2_company_storage_legacy_allowlist`
      + `status='legacy'`.
- [ ] Name ≠ identity. Folder/file resolution only by stored
      `root_folder_id` / `folder_id` / `external_file_id`. No global root scan,
      no object-name global search. **Evidence: grep of `Smeta tizimi/*.js`.**
- [ ] `06_ObyektPapka.js` global-search path removed (diff shows ~215→~50 lines);
      residual fallback = 0 outside explicit legacy-only code.

### Tenant isolation
- [ ] Company A cannot write into Company B workspace — behavioral test present
      and green (`t2_company_storage.test.cjs`).
- [ ] RLS on `t2_company_storage_workspace`, `t2_project_storage_binding`,
      `t2_object_storage_binding`, `t2_document_registry` reflects company
      membership + project participation.
- [ ] `service_role` bypasses RLS → command functions (`SECURITY DEFINER`)
      enforce tenant/project invariants themselves. Reviewed line by line.
- [ ] Function `GRANT`s minimal; no broad `execute to public` on command RPCs.

### Idempotency & concurrency
- [ ] `operation_id` (caller uuid) — retry with same id returns original canonical
      result, does NOT create a 2nd object/folder/document. Unique partial
      indexes present (`t2_obyekt_operation_id_uniq`, `..._registry_operation_uq`,
      `..._project_storage_operation_uq`). Behavioral test green.
- [ ] `versiya` / `expected_version` — stale mutation rejected with
      `STALE_VERSION`. Behavioral test green.

### Distributed storage state
- [ ] `pending → verified` / `failed` modelled explicitly; `failed` has NO
      fallback to old/global root.
- [ ] `t2_obyekt.storage_status` (`pending`/`ready`/`failed`) + `storage_error`
      present; object-create interactive path stays O(1) (no new sync O(n) scan;
      signal bulk-import coalescing not regressed).

### Migration / rollback / acceptance / reconciliation
- [ ] `20260830052000_t2_company_storage_foundation_v1.sql` fully idempotent
      (`create table/index if not exists`, `add column if not exists`) — safe
      against current prod catalog.
- [ ] `.rollback.sql` drops every object the forward migration creates
      (4 tables + allowlist + indexes + added columns on `t2_obyekt`).
- [ ] `.acceptance.sql` asserts expected post-state with explicit expected rows.
- [ ] `.reconciliation.sql` classifies legacy Drive as MATCHED / AMBIGUOUS /
      MISSING; only MATCHED becomes a canonical binding; nothing auto-moved.

### Tests
- [ ] `t2_company_storage / t2_project_storage / t2_object_create /
      t2_document_upload` cjs tests — behavioral, not "function exists".
- [ ] Static regression guard: global `ROOT_FOLDER_ID` fallback pattern only in
      legacy-only file.
- [ ] `node frontend/testlar/hammasi.cjs` green.
- [ ] `node ops/governance-check.cjs` green (only STOR-001 `owns` paths touched).

### Drift (source vs production) — VERIFY, do not assume
- [ ] Prod already has `t2_signal_bulk_import_coalescing` (`20260830044354`) and
      `t2_signal_trigger_keep_object_create_fast` (`20260830040816`). Confirm the
      repo copies are content-equivalent / idempotent no-ops on prod.
- [ ] Prod does NOT have `t2_company_storage_foundation_v1` — this is the net new
      apply.
- [ ] **Separate main drift (NOT STOR-001 scope, but record):** repo `main` has
      `20260830030000_t2_resource_command_v2` and
      `20260830031000_t2_mindmap_request_identity_v2` with no matching prod
      `schema_migrations.version` by name. Verify against live catalog
      (functions/tables), open a follow-up task if genuinely unapplied.

---

## 2. What will change (fill from final diff)

- DB: `+4 tables` (`t2_company_storage_workspace`, `t2_project_storage_binding`,
  `t2_object_storage_binding`, `t2_document_registry`) + `t2_company_storage_legacy_allowlist`
  + columns on `t2_obyekt` + RLS + command functions.
- GAS: `97_T2Storage.js` (new), `06_ObyektPapka.js` (rewritten), `95_ObyektHujjat.js`,
  `30_Panel.js`, `T2_Import.js`, `T2_Yuklash.js`.
- Frontend: none expected (confirm — `TestImport.tsx` touch on branch is test-only).

## 3. Deployment order

1. Merge `codex/company-storage-foundation-v1` → `main` (approval).
2. Apply `20260830052000_t2_company_storage_foundation_v1.sql` to prod
   (`tuoyrzadkgoltpqkdiyx`) (approval).
3. Deploy GAS (`clasp push` / bound script) (approval).
4. No Cloudflare deploy (confirm).

## 4. Rollback

- DB: run `.rollback.sql` (drops new tables/columns; existing data untouched
  because storage columns are additive with defaults).
- GAS: redeploy previous script version.
- Est. rollback time: < 15 min.

## 5. Live smoke plan (post-deploy)

1. New test company → `bind_company_storage` → workspace `verified`.
2. New project under it → `provision_project_storage` → binding `verified`,
   `project_root_folder_id` set.
3. Create object → `t2_object_storage_binding.folder_id` written, storage_status
   `ready`, **no global Drive search in logs**.
4. Upload a document → `t2_document_registry` row `active`.
5. Retry step 3 with same `operation_id` → same object id, no duplicate.
6. Company A user attempts read/write on Company B workspace → denied.

## 6. Risk summary

| Risk | Mitigation |
|---|---|
| Migration collides with prod catalog drift | idempotent DDL; acceptance SQL; review §1 drift |
| GAS `06_ObyektPapka.js` rewrite breaks existing object creation | behavioral test + smoke step 3; rollback = redeploy prev version |
| Legacy companies lose Drive access | legacy allowlist + reconciliation MATCHED-only binding; no auto-move |
| service_role over-reach | line-by-line SECURITY DEFINER review in §1 |

## 7. Human approval

Requested **once**, only when every §1 box is CONFIRMED and §0 shows
CLAUDE REVIEW PASS. Single message: "STOR-001 PROD READY — APPROVE?"
