-- Run only after migration on a disposable/live-approved environment.
select relname from pg_class where relname in ('t2_company_storage_workspace','t2_project_storage_binding','t2_object_storage_binding','t2_document_registry');
select indexname from pg_indexes where indexname='t2_company_storage_one_primary_active';
select has_table_privilege('anon','public.t2_company_storage_workspace','select') as anon_must_not_read;
