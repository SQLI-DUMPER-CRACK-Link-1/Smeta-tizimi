-- T2-SMETA-IMPORT-PERF-001 -- fixes the SECOND real bug behind the same
-- owner report (IMPORT_RPC_FAILED, this time with Postgres code 57014 =
-- query_canceled / statement timeout).
--
-- Root cause: `t2_qator` has row-level AFTER INSERT/UPDATE/DELETE triggers
-- (t2_qator_ozgarish -> t2_ozgarish_qayd, t2_signal_qator_producer ->
-- t2_signal_source_trigger) that, on every row change, do real work --
-- t2_signal_source_trigger in particular calls t2_signal_refresh_object,
-- which RESCANS EVERY t2_qator row (plus t2_erp_taminot/t2_ozgarish/
-- t2_grafik_qator/t2_hujjat_turi) for the whole object on EVERY firing.
-- `t2_smeta_import_bulk_v1` never set the bypass these triggers already
-- support (`current_setting('t2.manba', true) in ('markirovka','narxlash',
-- 'rollup','import')` -- see both trigger functions' own source, and
-- t2_signal_source_trigger's own comment: "A single explicit refresh
-- follows after the full import pipeline"), so a first-time smeta import
-- of N rows fired this O(N)-per-row rescan N times -- O(N^2) total.
--
-- Measured directly against production: a 931-row synthetic import (30
-- ISH x 30 resurs, realistic shape) did not finish within 60s without the
-- fix; with `t2.manba='import'` set first, the same insert + parent-link +
-- depth computation took ~440ms combined. A real smeta file (the owner's
-- report showed ~41 top-level sections, almost certainly several thousand
-- flattened rows once resources are counted) would take proportionally
-- longer without the fix -- easily past any reasonable timeout, which is
-- exactly the 57014 the owner hit.
--
-- Fix: set the session-local flag the triggers already understand, for
-- the duration of the bulk insert, then run ONE explicit signal refresh
-- at the end (matching the documented intended pattern) instead of N
-- implicit ones. Wrapped so a signal-refresh failure can never fail an
-- otherwise-successful import (signals are advisory, not core data).

begin;

create or replace function public.t2_smeta_import_bulk_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint,
  p_operation_id uuid, p_source_document_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare
  v_prev jsonb; v_rol text; v_soni integer;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  if not exists (select 1 from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','OBJECT_ACCESS_DENIED');
  end if;
  if exists (select 1 from public.t2_qator where obyekt_id=p_obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;
  if p_source_document_id is not null and not exists(
      select 1 from public.t2_document_registry d
      where d.id=p_source_document_id and d.kompaniya_id=p_kompaniya_id
        and (d.obyekt_id is null or d.obyekt_id=p_obyekt_id)) then
    return jsonb_build_object('ok',false,'code','SOURCE_DOCUMENT_SCOPE_MISMATCH');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0
     or jsonb_array_length(p_qatorlar) > 60000 then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;

  -- T2-SMETA-IMPORT-PERF-001: bulk path -- per-row change-log/signal
  -- triggers on t2_qator already know to skip their expensive per-row
  -- work when this is set (session/transaction-local; PostgREST runs
  -- each RPC call in its own transaction, so this never leaks between
  -- requests).
  perform set_config('t2.manba', 'import', true);

  create temporary table t2_smeta_import_map(
    local_id text primary key, id bigint, parent_local_id text, ordinal integer
  ) on commit drop;

  with kir as (
    select
      (x->>'local_id') as local_id, (x->>'parent_local_id') as parent_local_id,
      (x->>'tur') as tur, nullif(x->>'kod','') as kod, nullif(x->>'nom','') as nom,
      nullif(x->>'birlik','') as birlik,
      public.t2_son(x->>'hajm') as hajm, public.t2_son(x->>'narx') as narx,
      public.t2_son(x->>'summa') as summa,
      (ordinality)::integer as ordinal
    from jsonb_array_elements(p_qatorlar) with ordinality as t(x, ordinality)
  ),
  kir_kat as (
    select kir.*,
      case when kir.tur in ('rs','mat','ob') then
        coalesce(
          (select rk.kategoriya from public.t2_resurs_kategoriya rk
            where rk.kompaniya_id = p_kompaniya_id
              and rk.nom_key = public.t2_resurs_nom_kalit(kir.nom)
              and rk.birlik_key = public.t2_resurs_birlik_kalit(kir.birlik)),
          public.t2_kat_birlik(kir.birlik, kir.nom))
      end as kat
    from kir
  ),
  ins as (
    insert into public.t2_qator(obyekt_id, kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      source_document_id, tartib, daraja, kat)
    select p_obyekt_id, p_kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      p_source_document_id, ordinal, 0, kat
    from kir_kat order by ordinal
    returning id, tartib
  )
  insert into t2_smeta_import_map(local_id, id, parent_local_id, ordinal)
  select kir_kat.local_id, ins.id, kir_kat.parent_local_id, kir_kat.ordinal
  from kir_kat join ins on ins.tartib = kir_kat.ordinal;

  update public.t2_qator q set ota_id = pmap.id
  from t2_smeta_import_map m
  join t2_smeta_import_map pmap on pmap.local_id = m.parent_local_id
  where q.id = m.id and m.parent_local_id is not null;

  with recursive chuqurlik as (
    select id, 0::int as d from public.t2_qator where obyekt_id=p_obyekt_id and ota_id is null
    union all
    select q.id, c.d+1 from public.t2_qator q join chuqurlik c on q.ota_id = c.id
  )
  update public.t2_qator q set daraja = c.d from chuqurlik c where q.id = c.id;

  select count(*) into v_soni from t2_smeta_import_map;

  -- Bitta ANIQ signal-yangilanish -- yuqoridagi bypass tufayli N marta
  -- (har qator uchun) emas. Best-effort: signal jadvali faqat maslahat/
  -- ogohlantirish uchun -- muvaffaqiyatsizligi importni yiqitmasin.
  begin
    perform public.t2_signal_refresh_object(p_kompaniya_id, p_obyekt_id);
  exception when others then
    raise warning 't2_smeta_import_bulk_v1: signal refresh failed (non-fatal): %', sqlerrm;
  end;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bulk','smeta',p_obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,p_source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_import_bulk', v_prev);
  return v_prev;
end $$;

commit;
