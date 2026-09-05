begin;
do $$ begin if exists(select 1 from public.t2_catalog_ingest_command) then raise exception 'PRE_USE_ROLLBACK_ONLY'; end if; end $$;
drop function public.t2_catalog_observation_yoz_v1(bigint,bigint,jsonb,jsonb,uuid);
drop index public.t2_ish_turi_identity_exact_ix;
drop table public.t2_catalog_ingest_command;
alter table public.t2_work_type_observation drop column source_line_key;
alter table public.t2_resource_observation drop column source_line_key;
commit;
