-- PRE-USE ONLY. Any source/F2/sync history means forward repair, never drop.
begin;
do $$ begin
 if exists(select 1 from public.t2_lrv_document) or exists(select 1 from public.t2_lrv_approved_f2) then raise exception 'POST_USE: canonical LRV history exists; rollback refused'; end if;
end $$;
drop table if exists public.t2_lrv_sync_conflict, public.t2_lrv_sync_event, public.t2_lrv_approved_f2, public.t2_lrv_entity, public.t2_lrv_recipe_resource, public.t2_lrv_recipe_version, public.t2_lrv_work_alias, public.t2_lrv_work_type, public.t2_lrv_document_line, public.t2_lrv_document_revision, public.t2_lrv_document;
commit;
