-- T2-FINAL-CLEAN-CUTOVER P0.2: native Smeta XLSX -> canonical Supabase
-- t2_qator (RZ/BL/RS/resources), off Google Drive/Sheets/GAS entirely.
--
-- SAFETY (no destructive risk): this RPC ONLY populates an EMPTY object
-- (zero existing t2_qator rows). It NEVER replaces/deletes an existing
-- working smeta -- re-importing over a populated object is refused
-- (SMETA_ALREADY_EXISTS). A "replace existing smeta" flow is a distinct,
-- much riskier product decision (what happens to existing Fakt/F2/
-- Additional/Replacement rows referencing the old qator_ids) intentionally
-- NOT attempted here.
--
-- Idempotent via operation_id (t2_onboarding_command_log reuse, same law
-- as t2_azolik_qosh_v1/t2_akt_yarat_v2).

begin;

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
  -- ATAYLAB QAT'IY: bo'sh bo'lmagan obyektga import RAD ETILADI -- mavjud
  -- ish (Fakt/F2/Additional/Replacement) qator_id'larga bog'langan bo'lishi
  -- mumkin, ularni jimgina almashtirish DESTRUCTIVE bo'lardi.
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

  -- 1-PASS: hamma qatorni ota_id'siz yozamiz, id generatsiya qilinadi.
  with kir as (
    select
      (x->>'local_id') as local_id, (x->>'parent_local_id') as parent_local_id,
      (x->>'tur') as tur, nullif(x->>'kod','') as kod, nullif(x->>'nom','') as nom,
      nullif(x->>'birlik','') as birlik,
      nullif(x->>'hajm','')::numeric as hajm, nullif(x->>'narx','')::numeric as narx,
      nullif(x->>'summa','')::numeric as summa,
      (ordinality)::integer as ordinal
    from jsonb_array_elements(p_qatorlar) with ordinality as t(x, ordinality)
  ),
  ins as (
    -- ESLATMA: t2_qator.operation_id ustunida t2_qator_operation_id_uniq
    -- (bitta qatorga bitta operatsiya) bor -- ko'p qatorli bulk importda
    -- BIR XIL p_operation_id'ni har bir qatorga yozib bo'lmaydi (unique
    -- buziladi). Idempotentlik allaqachon t2_onboarding_command_log orqali
    -- butun chaqiruv darajasida ta'minlangan, shu sabab qator darajasida
    -- operation_id null qoldiriladi.
    insert into public.t2_qator(obyekt_id, kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      manba_id, tartib, daraja)
    select p_obyekt_id, p_kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      p_source_document_id, ordinal, 0
    from kir order by ordinal
    returning id, tartib
  )
  insert into t2_smeta_import_map(local_id, id, parent_local_id, ordinal)
  select kir.local_id, ins.id, kir.parent_local_id, kir.ordinal
  from kir join ins on ins.tartib = kir.ordinal;

  -- 2-PASS: ota_id local_id xaritasi orqali bog'lanadi.
  update public.t2_qator q set ota_id = pmap.id
  from t2_smeta_import_map m
  join t2_smeta_import_map pmap on pmap.local_id = m.parent_local_id
  where q.id = m.id and m.parent_local_id is not null;

  -- daraja (chuqurlik) rekursiv hisoblanadi -- 1-pass har bir qator uchun
  -- faqat o'z ota_id'ini bilardi, umumiy chuqurlikni emas.
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
