# Storage Foundation Contract v1 (FROZEN for STOR-001)

Status: FROZEN 2026-08-31 · Owner: Claude (Chief Architect) · Applies to STOR-001A + STOR-001B

Both engineering lanes implement against this contract without changing it
mid-task. A required change is negotiated via `ops/mailbox/STOR-001/` and applied
to **both** lanes in the same revision.

---

## 1. Identity parameters (every storage command)

| Param | Type | Rule |
|---|---|---|
| `companyId` / `p_kompaniya_id` | bigint | required; tenant root |
| `projectId` / `p_loyiha_id` | bigint | required for project/object/document scope |
| `objectId` / `p_obyekt_id` | bigint | required for object/document scope |
| `operationId` / `p_operation_id` | uuid v1-5 | required for every mutating command; caller-generated; retry-safe |
| `expectedVersion` / `p_expected_version` | int or null | when non-null, mismatch → `STALE_VERSION` |

Name is never an identity input. No command resolves a company/project/object by
title, folder name, or Drive search.

## 2. Canonical resolvers (read, fail-closed) — `Smeta tizimi/97_T2Storage.js`

| Function | Returns on success | Failure |
|---|---|---|
| `resolveCompanyStorage(companyId)` | `{ok:true, workspace:{id,kompaniya_id,provider,mode,drive_id,root_folder_id,root_folder_name,status,legacy}}` | `{ok:false, code, xabar}` |
| `resolveProjectStorage(projectId)` | `{ok:true, binding:{loyiha_id,kompaniya_id,workspace_id,project_root_folder_id,provisioning_status}}` | `{ok:false, code, xabar}` |
| `resolveObjectStorage(objectId)` | `{ok:true, binding:{obyekt_id,kompaniya_id,loyiha_id,workspace_id,folder_id,parent_folder_id,provisioning_status}}` | `{ok:false, code, xabar}` |
| `resolveDocumentStorage(objectId, tur)` | `{ok:true, kompaniya_id, loyiha_id, obyekt_id, folder_id, tur}` | `{ok:false, code, xabar}` |
| `_t2StorageAssertLineage(companyId, projectId, objectId)` | `{ok:true, workspace, project, object}` | `{ok:false, code:'STORAGE_TENANT_MISMATCH'}` |

Resolvers only return rows with `status in (verified,legacy)` (workspace) or
`provisioning_status = verified` (bindings). Anything else is a failure — callers
must NOT fall back.

## 3. Command RPCs (write) — owned by STOR-001A

`t2_company_storage_bind_v1`, `t2_project_storage_provision_v1`,
`t2_project_storage_bind_v1`, `t2_project_storage_failed_v1`,
`t2_object_storage_bind_v1`, `t2_object_create_v1`, `t2_object_create_ready_v1`,
`t2_object_create_failed_v1`, `t2_document_registry_upsert_v1`.

Each: authenticate → tenant/project check → state check → `expected_version` →
`operation_id` idempotency → minimal transaction → audit → canonical result
`{ok, code?, ...}`.

## 4. Storage state machine

```
workspace: pending -> verified | revoked ; legacy (allowlist only)
project binding / object binding: pending -> verified | failed
t2_obyekt.storage_status: pending -> ready | failed
document registry: active -> superseded | deleted | failed
```

`failed` never degrades to a global/legacy root. Retry with the same
`operation_id` recovers the canonical row.

## 5. Document registry write contract

Caller resolves the canonical folder via §2, creates the Drive file under
`binding.folder_id` (never a searched folder), then calls
`t2_document_registry_upsert_v1` with `p_external_file_id`,
`p_external_parent_id = folder_id`, `p_document_type`, `p_operation_id`,
`p_revision?`, `p_created_by`. Duplicate `(kompaniya_id, operation_id)` returns
the existing row.

## 6. Error codes (stable; UI translates)

`STORAGE_WORKSPACE_NOT_CONFIGURED`, `PROJECT_STORAGE_NOT_BOUND`,
`PROJECT_COMPANY_MISMATCH`, `OBJECT_STORAGE_NOT_PROVISIONED`,
`STORAGE_TENANT_MISMATCH`, `STORAGE_PERMISSION_DENIED`, `STORAGE_ROOT_INVALID`,
`STORAGE_ROOT_NOT_WRITABLE`, `STORAGE_MODE_MISMATCH`, `STALE_VERSION`,
`OPERATION_ID_REQUIRED` / `PROJECT_CONTEXT_REQUIRED`, `LEGACY_WORKSPACE_FORBIDDEN`.

## 7. Legacy / global fallback prohibition

- No T2 storage caller may use `sozAsosiy().rootId` / `ROOT_FOLDER_ID` /
  `DriveApp.getRootFolder()` / `getFoldersByName(<title>)` to locate a T2
  company/project/object/document folder.
- The single global `Tizim_02` folder and `Tizim_02/_MANBA` pattern are retired
  for canonical flows.
- Legacy access is only via a `t2_company_storage_workspace` row with
  `status='legacy'` for a company present in `t2_company_storage_legacy_allowlist`.
- A T2 company with no verified/legacy workspace gets a fail-closed error, never
  an implicit folder.

## 8. Lane ownership (no file edited by both)

**STOR-001A — Codex (storage core):**
`supabase/migrations/20260830052000_t2_company_storage_foundation_v1*.sql`,
`supabase/migrations/20260830044354_t2_signal_bulk_import_coalescing.sql`,
`supabase/tests/*storage*`, `Smeta tizimi/97_T2Storage.js`,
`Smeta tizimi/06_ObyektPapka.js`,
`frontend/testlar/t2_company_storage.test.cjs`,
`frontend/testlar/t2_project_storage.test.cjs`,
`frontend/testlar/t2_object_create.test.cjs`.

**STOR-001B — Claude (storage integration):**
`Smeta tizimi/T2_Kozgu.js`, `Smeta tizimi/T2_Yuklash.js`,
`Smeta tizimi/T2_Import.js`, `Smeta tizimi/T2_F2Import.js`,
`Smeta tizimi/95_ObyektHujjat.js`, `Smeta tizimi/76_Hujjatlar_M29.js`,
`Smeta tizimi/37_F2TezYoz.js`, `Smeta tizimi/39_F2Reestr.js`,
`Smeta tizimi/35_F2Moslash.js`, `Smeta tizimi/30_Panel.js` (T2 storage/F2 flow only),
`frontend/testlar/t2_document_upload.test.cjs`,
`frontend/testlar/t2_storage_integration.test.cjs` (new),
`frontend/testlar/t2_no_global_root.test.cjs` (new),
`frontend/testlar/hammasi.cjs`, `docs/architecture/STORAGE_FOUNDATION_CONTRACT_V1.md`,
`docs/reviews/STOR-001-release-review.md`, `ops/releases/STOR-001.md`.

**Shared read-only:** both lanes read this contract and `97_T2Storage.js`'s
public resolver signatures. If a resolver signature must change, STOR-001A
proposes it in `ops/mailbox/STOR-001/`, Claude updates §2 + STOR-001B together.

## 9. Integration (Claude, Lead Engineer, after both lanes DONE)

Branch `integration/storage-foundation-final` ← merge STOR-001A + STOR-001B →
full verification per `docs/reviews/STOR-001-release-review.md` → single
`ops/releases/STOR-001.md` package → one human approval → deploy (DB + GAS).
No separate per-lane production deploy.
