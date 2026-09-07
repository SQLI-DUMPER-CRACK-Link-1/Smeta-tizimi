-- T2-PTO-OWNER-CRITICAL-CLOSURE: resource category (kat = ЧЕЛ/МАШ/МАТ/ОБ/
-- М/К/КАБ) registry, matching what nakrutka (markup) coefficients are
-- actually applied per (transport/ZSR/contractor-fee/insurance differ by
-- category -- confirmed against the T1 GAS source, Smeta tizimi/10_Engine.js
-- SvodkaCoefficients).
--
-- Two real, confirmed findings from studying the T1 GAS engine directly:
--   1. t2_smeta_import_bulk_v1 (native Smeta import) never set `kat` at all
--      -- every freshly-imported row was left NULL, uncategorized, silently
--      breaking any category-based rollup/markup.
--   2. Even the OLD, years-mature GAS engine could NOT reliably auto-detect
--      ОБ/М/К/КАБ from name or unit text alone -- ЧЕЛ/МАШ are unit-text
--      rules (чел-час/маш-час, see t2_kat_birlik, already correct and kept
--      as-is), but ОБ/М/К/КАБ came from a PERSISTENT, user-maintained
--      registry keyed by normalized (nom, birlik) -- a "NARXLAR" reference
--      sheet a PTO specialist tagged once, consulted on every later import
--      (10_Engine.js `_narxlarKatMap`/`reg.kat`). There was no shortcut;
--      this migration ports that exact mechanism natively.
--
-- Precedence on import (mirrors reg.kat's own precedence exactly):
--   1. confirmed registry entry for this (kompaniya, nom, birlik) -> use it
--   2. else t2_kat_birlik(birlik, nom) (ЧЕЛ/МАШ-by-unit, else МАТ)
-- КАБ/М/К are therefore still never guessed on a first import -- they only
-- appear once a user has confirmed that resource once, exactly like the old
-- system. That's a real, honest limitation, not a bug: T1_GAS didn't solve
-- it any other way either.

begin;

create table if not exists public.t2_resurs_kategoriya (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  nom_key text not null,
  birlik_key text not null,
  kategoriya text not null check (kategoriya in ('ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ')),
  actor_id bigint references public.t2_foydalanuvchi(id),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  versiya integer not null default 1,
  unique (kompaniya_id, nom_key, birlik_key)
);
alter table public.t2_resurs_kategoriya enable row level security;
revoke all on table public.t2_resurs_kategoriya from anon, authenticated;
drop policy if exists t2_resurs_kategoriya_tenant_read on public.t2_resurs_kategoriya;
create policy t2_resurs_kategoriya_tenant_read on public.t2_resurs_kategoriya
  for select to authenticated
  using (exists (select 1 from public.t2_azolik a where a.kompaniya_id = t2_resurs_kategoriya.kompaniya_id and a.holat = 'faol'
    and a.foydalanuvchi_id = nullif((select auth.jwt()->'app_metadata'->>'t2_actor_id'),'')::bigint));

-- Normalization mirrors T1's _normNomKey/_normBirlik closely enough for the
-- common case (single-script documents): uppercase, Ё->Е, strip everything
-- but digits/letters for nom; uppercase, ³/²->3/2, strip whitespace/
-- punctuation for birlik. Does not do T1's full Latin<->Cyrillic
-- transliteration table -- a real but narrower gap than having no registry
-- at all.
create or replace function public.t2_resurs_nom_kalit(v text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(replace(upper(coalesce(v,'')), 'Ё', 'Е'), '[^0-9A-ZА-Я]', '', 'g');
$$;
create or replace function public.t2_resurs_birlik_kalit(v text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(replace(replace(upper(coalesce(v,'')), '³', '3'), '²', '2'), '[[:space:][:punct:]]', '', 'g');
$$;

create or replace function public.t2_resurs_kategoriya_belgila_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_nom text, p_birlik text,
  p_kategoriya text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev jsonb; v_rol text; v_row public.t2_resurs_kategoriya;
  v_nom_key text; v_bir_key text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_kategoriya not in ('ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ') then
    return jsonb_build_object('ok',false,'code','KATEGORIYA_INVALID');
  end if;
  v_nom_key := public.t2_resurs_nom_kalit(p_nom);
  v_bir_key := public.t2_resurs_birlik_kalit(p_birlik);
  if v_nom_key = '' or v_bir_key = '' then
    return jsonb_build_object('ok',false,'code','NOM_BIRLIK_REQUIRED');
  end if;

  insert into public.t2_resurs_kategoriya(kompaniya_id, nom_key, birlik_key, kategoriya, actor_id)
    values (p_kompaniya_id, v_nom_key, v_bir_key, p_kategoriya, p_actor_id)
    on conflict (kompaniya_id, nom_key, birlik_key)
    do update set kategoriya = excluded.kategoriya, actor_id = excluded.actor_id,
      yangilandi = now(), versiya = t2_resurs_kategoriya.versiya + 1
    returning * into v_row;

  v_prev := jsonb_build_object('ok',true,'id',v_row.id,'kategoriya',v_row.kategoriya,'versiya',v_row.versiya);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'resurs_kategoriya_belgila', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_resurs_kategoriya_belgila_v1(bigint,bigint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.t2_resurs_kategoriya_belgila_v1(bigint,bigint,text,text,text,uuid) to service_role;

-- ── t2_smeta_import_bulk_v1: registry-aware kat, additive ──────────────────
create or replace function public.t2_smeta_import_bulk_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint,
  p_operation_id uuid, p_source_document_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
      manba_id, tartib, daraja, kat)
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

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bulk','smeta',p_obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,p_source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_import_bulk', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb) to service_role;

commit;
