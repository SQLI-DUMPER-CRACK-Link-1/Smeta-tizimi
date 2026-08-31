-- Rollback: only remove the new storage foundation. Do not touch Drive or
-- legacy t2_obyekt.drive_id values.
drop policy if exists t2_storage_tenant_read_v1 on public.t2_company_storage_workspace;
drop policy if exists t2_storage_tenant_read_v1 on public.t2_company_storage_legacy_allowlist;
drop policy if exists t2_storage_tenant_read_v1 on public.t2_project_storage_binding;
drop policy if exists t2_storage_tenant_read_v1 on public.t2_object_storage_binding;
drop policy if exists t2_storage_tenant_read_v1 on public.t2_document_registry;
drop function if exists public.t2_storage_actor_company_access_v1(bigint);
drop function if exists public.t2_storage_actor_require_v1(bigint,bigint);
drop function if exists public.t2_object_create_failed_v1(bigint,bigint,bigint,uuid,text);
drop function if exists public.t2_project_storage_failed_v1(bigint,bigint,bigint,uuid,text);
drop function if exists public.t2_company_storage_bind_v1(bigint,bigint,text,text,text,text,text,uuid,integer,boolean);
drop function if exists public.t2_document_registry_upsert_v1(bigint,bigint,bigint,bigint,text,text,text,text,text,uuid,text);
drop function if exists public.t2_project_storage_bind_v1(bigint,bigint,bigint,bigint,text,uuid,integer);
drop function if exists public.t2_project_storage_provision_v1(bigint,bigint,bigint,uuid,integer);
drop function if exists public.t2_object_create_ready_v1(bigint,bigint,bigint,uuid,integer);
drop function if exists public.t2_object_storage_bind_v1(bigint,bigint,bigint,bigint,bigint,text,text,uuid,integer);
drop function if exists public.t2_object_create_v1(bigint,bigint,bigint,text,uuid,integer);
drop view if exists public.t2_storage_reconciliation_v1;
drop index if exists public.t2_obyekt_operation_id_uniq;
drop index if exists public.t2_company_storage_operation_uq;
drop index if exists public.t2_object_storage_operation_uq;
drop index if exists public.t2_project_storage_operation_uq;
drop table if exists public.t2_document_registry;
drop table if exists public.t2_company_storage_legacy_allowlist;
drop table if exists public.t2_object_storage_binding;
drop table if exists public.t2_project_storage_binding;
drop table if exists public.t2_company_storage_workspace;
-- These columns are owned by this migration only when they did not exist before.
-- If a pre-existing deployment already had them, retain them during rollback.
do $$ begin
  if exists (select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='t2_obyekt' and a.attname='storage_status') then
    execute 'alter table public.t2_obyekt drop column if exists storage_error';
    execute 'alter table public.t2_obyekt drop column if exists operation_id';
    execute 'alter table public.t2_obyekt drop column if exists storage_status';
  end if;
end $$;
