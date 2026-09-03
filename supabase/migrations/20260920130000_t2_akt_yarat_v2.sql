-- T2-LRV-EXACT-F2-INTEGRATION-003 -- t2_akt_yarat_v2. SOURCE ONLY.
-- Production freeze active -- NOT applied in this task.
-- See ops/handoff/T2_LRV_EXACT_F2_INTEGRATION_003.md Section 2/7.
--
-- The legacy t2_akt_yarat is UNCHANGED and NOT revoked -- its one known
-- safe caller (Smeta tizimi/T2_F2Import.js, GAS) keeps working exactly as
-- before. This is a NEW, parallel-callable RPC for a caller that can
-- supply the certified triplet directly and wants the smeta-price
-- fallback to be IMPOSSIBLE, not just avoidable via a flag it might
-- forget to set.
--
-- Per row: certified_qty + (certified_price OR narx_yoq=true) are
-- REQUIRED. certified_amount is REQUIRED unless narx_yoq (no meaningful
-- amount without a price). Missing required certified fields -> the
-- WHOLE batch is rejected (MISSING_CERTIFIED_PRICE / MISSING_CERTIFIED_AMOUNT),
-- nothing partially inserted -- no silent smeta-price substitution exists
-- in this function at all (contrast with t2_akt_yarat's
-- coalesce(k.narx_kir, q.narx)).

begin;

create or replace function public.t2_akt_yarat_v2(
  p_obyekt_id bigint,
  p_tur text,
  p_oy date,
  p_qatorlar jsonb,
  p_raqam text default null,
  p_operation_id uuid default null,
  p_manba text default 'frontend',
  p_kim text default null,
  p_majburiy boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_akt_id bigint; v_bor bigint; v_komp bigint;
  v_jami numeric; v_soni int; v_mismatch int; v_actor bigint; v_rev bigint;
  v_missing_price jsonb; v_missing_amount jsonb;
begin
  if p_operation_id is not null then
    select id into v_bor from t2_akt where operation_id = p_operation_id;
    if found then
      return jsonb_build_object('ok', true, 'takror', true, 'akt_id', v_bor,
        'izoh', 'Bu operatsiya allaqachon bajarilgan -- yangi hujjat yaratilmadi.');
    end if;
  end if;
  if p_tur not in ('fakt', 'f2') then
    return jsonb_build_object('ok', false, 'code', 'TUR_INVALID',
      'xabar', 'tur faqat "fakt" yoki "f2" bo''ladi');
  end if;
  if p_oy is null then
    return jsonb_build_object('ok', false, 'code', 'OY_REQUIRED');
  end if;
  if p_qatorlar is null or jsonb_array_length(p_qatorlar) = 0 then
    return jsonb_build_object('ok', false, 'code', 'QATORLAR_BOSH');
  end if;
  select kompaniya_id into v_komp from t2_obyekt where id = p_obyekt_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'OBYEKT_NOT_FOUND');
  end if;

  v_actor := (regexp_match(coalesce(p_kim, ''), '^actor:(\d+)$'))[1]::bigint;
  select id into v_rev from public.t2_smeta_revision where obyekt_id = p_obyekt_id order by seq desc limit 1;

  drop table if exists _kir_v2;
  create temp table _kir_v2 on commit drop as
  select
    (x->>'qator_id')::bigint qator_id,
    t2_son(x->>'certified_qty') certified_qty,
    case when x ? 'certified_price' then t2_son(x->>'certified_price') end certified_price,
    case when x ? 'certified_amount' then t2_son(x->>'certified_amount') end certified_amount,
    coalesce((x->>'narx_yoq')::boolean, false) narx_yoq,
    nullif(btrim(coalesce(x->>'izoh', '')), '') izoh,
    x as raw
  from jsonb_array_elements(p_qatorlar) x;

  if exists (select 1 from _kir_v2 k left join t2_qator q on q.id = k.qator_id and q.obyekt_id = p_obyekt_id where q.id is null) then
    return jsonb_build_object('ok', false, 'code', 'QATOR_INVALID',
      'qatorlar', (select jsonb_agg(k.qator_id) from _kir_v2 k left join t2_qator q on q.id = k.qator_id and q.obyekt_id = p_obyekt_id where q.id is null));
  end if;
  if exists (select 1 from _kir_v2 where certified_qty is null) then
    return jsonb_build_object('ok', false, 'code', 'CERTIFIED_QTY_INVALID',
      'qatorlar', (select jsonb_agg(qator_id) from _kir_v2 where certified_qty is null));
  end if;

  -- THE law: no smeta-price fallback exists here at all. Missing price
  -- (and not explicitly flagged narx_yoq) rejects the WHOLE batch.
  select jsonb_agg(qator_id) into v_missing_price
    from _kir_v2 where not narx_yoq and certified_price is null;
  if v_missing_price is not null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_CERTIFIED_PRICE',
      'xabar', 'Ba''zi qatorlarda F2 hujjatining o''z narxi yo''q va narx_yoq belgilanmagan -- smeta narxiga jim qaytish YO''Q.',
      'qatorlar', v_missing_price);
  end if;
  select jsonb_agg(qator_id) into v_missing_amount
    from _kir_v2 where not narx_yoq and certified_amount is null;
  if v_missing_amount is not null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_CERTIFIED_AMOUNT',
      'xabar', 'Ba''zi qatorlarda F2 hujjatining o''z summasi yuborilmagan.',
      'qatorlar', v_missing_amount);
  end if;

  insert into t2_akt (obyekt_id, kompaniya_id, tur, raqam, oy, holat, operation_id, manba, kim, revision_id)
  values (p_obyekt_id, v_komp, p_tur, p_raqam, date_trunc('month', p_oy)::date,
          'qoralama', p_operation_id, p_manba, p_kim, v_rev)
  returning id into v_akt_id;

  insert into t2_akt_qator (akt_id, qator_id, obyekt_id, kompaniya_id, hajm, narx, izoh,
                            certified_quantity, certified_unit_price, certified_amount,
                            provenance_status, raw_snapshot, revision_id)
  select v_akt_id, k.qator_id, p_obyekt_id, v_komp,
         k.certified_qty,                                  -- hajm (compatibility)
         case when k.narx_yoq then null else k.certified_price end,   -- narx (compatibility) -- NEVER q.narx
         k.izoh,
         k.certified_qty, k.certified_price, k.certified_amount,
         'source_certified', k.raw, v_rev
  from _kir_v2 k;

  select count(*), sum(coalesce(certified_amount, 0)),
         count(*) filter (where certified_amount is not null and certified_quantity is not null
                            and certified_unit_price is not null
                            and abs(certified_quantity * certified_unit_price - certified_amount) > 0.005)
    into v_soni, v_jami, v_mismatch
    from t2_akt_qator where akt_id = v_akt_id;
  update t2_akt set hujjat_jami = v_jami where id = v_akt_id;

  return jsonb_build_object('ok', true, 'takror', false, 'akt_id', v_akt_id, 'tur', p_tur,
    'holat', 'qoralama', 'oy', to_char(date_trunc('month', p_oy), 'YYYY-MM'), 'revision_id', v_rev,
    'qator_soni', v_soni, 'jami', v_jami,
    'arithmetic_mismatch_soni', v_mismatch,
    'izoh', case when v_mismatch > 0
      then v_mismatch || ' qatorda certified_qty*certified_price certified_amountdan farq qiladi -- F2_ARITHMETIC_MISMATCH, certified_amount O''ZGARTIRILMADI.'
      else 'Barcha qator certified, arifmetik nomuvofiqlik yo''q.' end);
end
$function$;

revoke all on function public.t2_akt_yarat_v2(bigint,text,date,jsonb,text,uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.t2_akt_yarat_v2(bigint,text,date,jsonb,text,uuid,text,text,boolean) to service_role;

comment on function public.t2_akt_yarat_v2(bigint,text,date,jsonb,text,uuid,text,text,boolean) is
  'T2-LRV-EXACT-F2-INTEGRATION-003: F2/fakt document creation with independently-stored certified_quantity/unit_price/amount. No smeta-price fallback exists in this function -- MISSING_CERTIFIED_PRICE/MISSING_CERTIFIED_AMOUNT reject the whole batch instead. Legacy t2_akt_yarat is unchanged and still used by Smeta tizimi/T2_F2Import.js.';

commit;
