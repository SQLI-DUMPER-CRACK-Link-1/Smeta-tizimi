-- STOR-001 acceptance gate. Run after the migration only on a disposable
-- branch database or an explicitly human-approved environment.
do $$
declare missing text;
begin
  select string_agg(x.name, ', ' order by x.name) into missing
  from (values
    ('t2_company_storage_workspace'),('t2_project_storage_binding'),
    ('t2_object_storage_binding'),('t2_document_registry')) x(name)
  where to_regclass('public.'||x.name) is null;
  if missing is not null then raise exception 'missing storage tables: %', missing; end if;
  select string_agg(x.name, ', ' order by x.name) into missing
  from (values ('t2_company_storage_bind_v1'),('t2_project_storage_provision_v1'),
    ('t2_project_storage_bind_v1'),('t2_project_storage_failed_v1'),
    ('t2_object_create_v1'),('t2_object_storage_bind_v1'),
    ('t2_object_create_ready_v1'),('t2_object_create_failed_v1'),
    ('t2_document_registry_upsert_v1'),('t2_storage_reconciliation_v1')) x(name)
  where not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=x.name);
  if missing is not null then raise exception 'missing storage functions/views: %', missing; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 't2_%storage%_v1' and has_function_privilege('anon',p.oid,'execute')) then raise exception 'anon may execute a storage command'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('t2_company_storage_workspace','t2_project_storage_binding','t2_object_storage_binding','t2_document_registry') and c.relrowsecurity is false) then raise exception 'storage table without RLS'; end if;
end $$;

-- Behavioral recipe: A bind/retry returns the same ID; B reuse returns
-- STORAGE_TENANT_MISMATCH; absent workspace fails closed; stale versions return
-- STALE_VERSION; a document whose parent is not the bound object folder fails.
