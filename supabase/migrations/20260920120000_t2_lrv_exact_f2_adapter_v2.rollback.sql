-- PRE-USE rollback only. Refuses to erase source facts once any v2 line exists.
begin;
do $$ begin
  if exists (select 1 from public.t2_akt_qator where source_provenance <> 'legacy_unproven' or source_line_id is not null) then
    raise exception 'PRE_USE_ROLLBACK_REFUSED: exact F2 source facts already exist';
  end if;
end $$;
drop function if exists public.t2_f2_exact_qatorlar_v1(bigint,bigint);
drop function if exists public.t2_akt_yarat_v2(bigint,date,jsonb,bigint,text,uuid,text);
drop trigger if exists t2_akt_qator_source_freeze_v2_trg on public.t2_akt_qator;
drop function if exists public.t2_akt_qator_source_freeze_v2();
alter table public.t2_qator drop constraint if exists t2_qator_change_type_ck;
alter table public.t2_qator drop column if exists change_id, drop column if exists change_type, drop column if exists replaces_line_id;
alter table public.t2_akt_qator drop constraint if exists t2_akt_qator_source_verified_ck;
alter table public.t2_akt_qator drop constraint if exists t2_akt_qator_source_provenance_ck;
alter table public.t2_akt_qator drop column if exists source_provenance, drop column if exists source_line_snapshot, drop column if exists source_line_id, drop column if exists source_certified_summa, drop column if exists source_certified_narx, drop column if exists source_certified_hajm;
commit;
