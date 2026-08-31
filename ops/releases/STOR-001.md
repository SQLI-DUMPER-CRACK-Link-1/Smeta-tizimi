# STOR-001 — Company storage foundation release package

## What will change

| Layer | Change |
|---|---|
| Postgres | Canonical company workspace, project/object bindings and document registry; actor-bound, idempotent commands; RLS read boundary. |
| GAS | Company/project/object folder resolution uses stored IDs only. Document/F2 uploads use the verified object binding. Root-scoped upload/import facades fail closed; their old implementation is explicit `apiT2Legacy*`. |
| Cloudflare | No change in this package. |

## Database migration

Apply `supabase/migrations/20260830052000_t2_company_storage_foundation_v1.sql` once in a reviewed non-production release. It is additive/idempotent. Production catalog reconciliation (read-only, 2026-08-31): `20260830044354_t2_signal_bulk_import_coalescing` and the equivalent fast-trigger migration already exist; the storage tables do not. The signal migration is therefore not reapplied by this package.

Commands: `t2_company_storage_bind_v1`, `t2_project_storage_provision_v1`, `t2_project_storage_bind_v1`, `t2_object_create_v1`, `t2_object_storage_bind_v1`, `t2_object_create_ready_v1`, `t2_document_registry_upsert_v1`. Each requires a caller operation UUID and validated T2 actor; retries return canonical state and cross-tenant reuse is rejected.

## Rollback

Use `supabase/baseline/pending/20260830052000_t2_company_storage_foundation_v1.rollback.sql` only with human approval. It removes this package's DB structures/functions/policies and never deletes Drive folders or files. Rollback time is bounded by schema locks; schedule outside active writes.

## Acceptance and reconciliation

Run `supabase/tests/t2_company_storage_foundation_v1.acceptance.sql` on a disposable database after migration. Run `supabase/tests/t2_company_storage_foundation_v1.reconciliation.sql` read-only: only `MATCHED` is eligible for an explicit later binding; `AMBIGUOUS` and `MISSING` are never auto-migrated.

## Live smoke plan

1. Create a new test company and bind a writable Drive workspace; verify state is `verified`.
2. Provision a project under that workspace; verify stored project root ID.
3. Create an object with a new operation ID; verify its folder ID/binding and retry the same ID.
4. Upload an F2/document through `apiT2DocumentUpload`/`apiT2F2Upload`; verify registry row, parent folder ID and retry behavior.
5. Attempt Company B access to Company A workspace and stale-version mutations; expect `STORAGE_TENANT_MISMATCH` and `STALE_VERSION`.

## Risks

Drive and Postgres are not one transaction. Commands persist `pending`, `verified` or `failed`; a failure never falls back to TIZIM_01/global Drive roots. The release requires a disposable database for execution evidence before any production approval.
