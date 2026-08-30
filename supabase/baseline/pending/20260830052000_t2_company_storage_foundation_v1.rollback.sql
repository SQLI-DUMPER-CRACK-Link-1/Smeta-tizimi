-- Rollback: only remove the new storage foundation. Do not touch Drive or
-- legacy t2_obyekt.drive_id values.
drop view if exists public.t2_storage_reconciliation_v1;
drop table if exists public.t2_document_registry;
drop table if exists public.t2_object_storage_binding;
drop table if exists public.t2_project_storage_binding;
drop table if exists public.t2_company_storage_workspace;
