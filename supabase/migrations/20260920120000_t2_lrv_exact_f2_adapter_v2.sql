-- T2-LRV-EXACT-F2-ADAPTER-003
-- SOURCE ONLY. Existing t2_qator/t2_akt/t2_akt_qator remain canonical.
-- This migration is additive and deliberately does NOT backfill source facts.
begin;

alter table public.t2_akt_qator
  add column if not exists source_certified_hajm numeric,
  add column if not exists source_certified_narx numeric,
  add column if not exists source_certified_summa numeric,
  add column if not exists source_line_id uuid,
  add column if not exists source_line_snapshot jsonb,
  add column if not exists source_provenance text not null default 'legacy_unproven';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='t2_akt_qator_source_provenance_ck') then
    alter table public.t2_akt_qator add constraint t2_akt_qator_source_provenance_ck
      check (source_provenance in ('source_verified','legacy_unproven','price_intentionally_absent'));
  end if;
  if not exists (select 1 from pg_constraint where conname='t2_akt_qator_source_verified_ck') then
    alter table public.t2_akt_qator add constraint t2_akt_qator_source_verified_ck check (
      source_provenance <> 'source_verified' or (
        source_line_id is not null and source_line_snapshot is not null and
        source_certified_hajm is not null and source_certified_narx is not null and source_certified_summa is not null
      )
    );
  end if;
end $$;

comment on column public.t2_akt_qator.source_certified_summa is
  'Immutable F2 source amount. Never backfilled from generated summa; NULL on legacy_unproven rows.';
comment on column public.t2_akt_qator.source_provenance is
  'source_verified = immutable source triplet attached; legacy_unproven = no source evidence; price_intentionally_absent = source explicitly contains no certified price.';

-- Structural enrichment of the existing scope truth; t2_smeta_ozgarish remains
-- the canonical operation/audit/version ledger. No second change engine exists.
alter table public.t2_qator
  add column if not exists replaces_line_id bigint references public.t2_qator(id),
  add column if not exists change_type text,
  add column if not exists change_id bigint references public.t2_smeta_ozgarish(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='t2_qator_change_type_ck') then
    alter table public.t2_qator add constraint t2_qator_change_type_ck
      check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT'));
  end if;
end $$;
create index if not exists t2_qator_replaces_line_ix on public.t2_qator(replaces_line_id) where replaces_line_id is not null;
create index if not exists t2_qator_change_id_ix on public.t2_qator(change_id) where change_id is not null;

-- Prevent changing an approved F2 source triplet. The parent act state, rather
-- than a browser claim, is the authority. Legacy rows remain readable.
create or replace function public.t2_akt_qator_source_freeze_v2()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists (select 1 from public.t2_akt a where a.id=old.akt_id and a.tur='f2' and a.holat='tasdiqlangan')
     and (new.source_certified_hajm, new.source_certified_narx, new.source_certified_summa,
          new.source_line_id, new.source_line_snapshot, new.source_provenance)
         is distinct from
         (old.source_certified_hajm, old.source_certified_narx, old.source_certified_summa,
          old.source_line_id, old.source_line_snapshot, old.source_provenance) then
    raise exception using errcode='23514', message='APPROVED_F2_SOURCE_FROZEN';
  end if;
  return new;
end $$;
drop trigger if exists t2_akt_qator_source_freeze_v2_trg on public.t2_akt_qator;
create trigger t2_akt_qator_source_freeze_v2_trg before update on public.t2_akt_qator
for each row execute function public.t2_akt_qator_source_freeze_v2();

-- v2 is opt-in: v1 remains untouched for legacy callers. F2 never receives a
-- silent q.narx fallback here; each input line must carry source proof.
create or replace function public.t2_akt_yarat_v2(
  p_obyekt_id bigint, p_oy date, p_qatorlar jsonb, p_actor_id bigint,
  p_raqam text default null, p_operation_id uuid default null, p_manba text default 'f2_import_v2')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_result jsonb; v_akt_id bigint;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id=p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp,p_actor_id);
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar)=0 then
    return jsonb_build_object('ok',false,'code','F2_LINES_REQUIRED');
  end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x
             where nullif(x->>'qator_id','') is null or nullif(x->>'source_line_id','') is null) then
    return jsonb_build_object('ok',false,'code','SOURCE_LINE_REQUIRED');
  end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x
             where coalesce(x->>'price_intentionally_absent','false') <> 'true'
               and (nullif(x->>'certified_unit_price','') is null or nullif(x->>'certified_amount','') is null)) then
    return jsonb_build_object('ok',false,'code','MISSING_CERTIFIED_PRICE');
  end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x group by x->>'qator_id' having count(*)>1) then
    return jsonb_build_object('ok',false,'code','DUPLICATE_F2_SOURCE_LINE');
  end if;

  select public.t2_akt_yarat(p_obyekt_id,'f2',p_oy,
    (select jsonb_agg(jsonb_build_object(
      'qator_id',x->>'qator_id','hajm',x->>'certified_quantity',
      'narx',case when coalesce(x->>'price_intentionally_absent','false')='true' then null else x->>'certified_unit_price' end,
      'narx_yoq',coalesce(x->>'price_intentionally_absent','false')='true',
      'izoh',x->>'izoh')) from jsonb_array_elements(p_qatorlar) x),
    p_raqam,p_operation_id,p_manba,'actor:'||p_actor_id,false) into v_result;
  if coalesce((v_result->>'ok')::boolean,false) is not true then return v_result; end if;
  v_akt_id := (v_result->>'akt_id')::bigint;

  update public.t2_akt_qator aq set
    source_certified_hajm = nullif(x->>'certified_quantity','')::numeric,
    source_certified_narx = nullif(x->>'certified_unit_price','')::numeric,
    source_certified_summa = nullif(x->>'certified_amount','')::numeric,
    source_line_id = (x->>'source_line_id')::uuid,
    source_line_snapshot = coalesce(x->'source_line_snapshot', x - 'source_line_snapshot'),
    source_provenance = case when coalesce(x->>'price_intentionally_absent','false')='true'
                             then 'price_intentionally_absent' else 'source_verified' end
  from jsonb_array_elements(p_qatorlar) x
  where aq.akt_id=v_akt_id and aq.qator_id=(x->>'qator_id')::bigint;

  return v_result || jsonb_build_object('contract','EXACT_F2_SOURCE_V2');
end $$;

create or replace function public.t2_f2_exact_qatorlar_v1(p_akt_id bigint, p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_komp bigint;
begin
  select kompaniya_id into v_komp from public.t2_akt where id=p_akt_id and tur='f2';
  if v_komp is null then return jsonb_build_object('ok',false,'code','F2_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp,p_actor_id);
  return jsonb_build_object('ok',true,'qatorlar',coalesce((
    select jsonb_agg(jsonb_build_object(
      'akt_qator_id',aq.id,'qator_id',aq.qator_id,
      'certified_quantity',aq.source_certified_hajm,
      'certified_unit_price',aq.source_certified_narx,
      'certified_amount',aq.source_certified_summa,
      'calculated_amount',aq.summa,
      'amount_mismatch',aq.source_certified_summa is not null and aq.summa is distinct from aq.source_certified_summa,
      'provenance',aq.source_provenance,'source_line_id',aq.source_line_id)
      order by aq.id) from public.t2_akt_qator aq where aq.akt_id=p_akt_id), '[]'::jsonb));
end $$;

revoke all on function public.t2_akt_yarat_v2(bigint,date,jsonb,bigint,text,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_f2_exact_qatorlar_v1(bigint,bigint) from public, anon, authenticated;
commit;
