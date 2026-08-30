-- Run only after migration on a disposable/live-approved environment.
do $$
declare missing text;
begin
  select string_agg(x.name, ', ' order by x.name) into missing
  from (values
    ('t2_company_storage_workspace'),('t2_project_storage_binding'),
    ('t2_object_storage_binding'),('t2_document_registry'),
    ('t2_object_create_v1'),('t2_object_storage_bind_v1'),
    ('t2_object_create_ready_v1'),('t2_object_create_failed_v1'),
    ('t2_project_storage_provision_v1'),('t2_project_storage_bind_v1'),
    ('t2_project_storage_failed_v1'),
    ('t2_company_storage_bind_v1'),
    ('t2_storage_reconciliation_v1')) x(name)
  where not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=x.name
  );
  if missing is not null then raise exception 'missing storage contract objects: %', missing; end if;
end $$;
select indexname from pg_indexes where indexname='t2_company_storage_one_primary_active';
select has_table_privilege('anon','public.t2_company_storage_workspace','select') as anon_must_not_read;
