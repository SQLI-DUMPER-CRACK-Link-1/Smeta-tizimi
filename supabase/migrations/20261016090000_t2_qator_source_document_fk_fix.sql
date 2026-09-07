-- T2-SMETA-IMPORT-FK-BUG-001 -- fixes a real, blocking bug: EVERY native
-- Smeta import through the real upload flow (SmetaYuklaNative.tsx always
-- reserves a canonical R2 document via /api/hujjat-yukla first, which
-- returns a `t2_document_registry.id`) was failing with a generic
-- IMPORT_RPC_FAILED, because `t2_smeta_import_bulk_v1` wrote that id into
-- `t2_qator.manba_id` -- a column whose FOREIGN KEY targets `t2_manba`,
-- a DIFFERENT, older (Google-Drive-era) table. `t2_manba.id` and
-- `t2_document_registry.id` are unrelated sequences (observed: manba
-- 22-39, registry 2-23) -- passing a registry id into manba_id almost
-- always violates the FK, an unhandled Postgres exception the Function
-- (smeta-yukla.ts) then collapses into the opaque generic error the
-- owner hit ("Import bajarilmadi (IMPORT_RPC_FAILED)"), with the whole
-- import transaction rolled back (hence "Bu obyektda kanonik smeta
-- qatorlari yo'q" even after upload).
--
-- The RPC's OWN validation already checks `p_source_document_id` against
-- `t2_document_registry` (not t2_manba) -- so the intent was always to
-- link to the registry; `manba_id`/`t2_manba` is a separate, unrelated
-- legacy concept with 17k+ EXISTING rows that must not be touched or
-- reinterpreted.
--
-- Fix: a new, properly-FK'd column (`source_document_id`, same name
-- already used for this exact purpose in `t2_f2_import_job`) replaces
-- `manba_id` in this RPC's insert. `manba_id` itself is untouched --
-- still there, still meaning what it meant, for legacy rows/paths.

begin;

alter table public.t2_qator
  add column if not exists source_document_id bigint references public.t2_document_registry(id);

comment on column public.t2_qator.source_document_id is
  'Which canonical R2 document (t2_document_registry) this row was imported from -- t2_smeta_import_bulk_v1 and later native import RPCs. Distinct from the legacy `manba_id` (-> t2_manba, Google-Drive-era imports); do not conflate the two.';

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

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bulk','smeta',p_obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,p_source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_import_bulk', v_prev);
  return v_prev;
end $$;

commit;
