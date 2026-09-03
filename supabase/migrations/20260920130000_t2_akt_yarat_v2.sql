-- T2-LRV-EXACT-F2-INTEGRATION-003 -- t2_akt_yarat_v2.
-- Revised in T2-REAL-PARK-LRV-VERTICAL-SLICE-004 to reconcile with
-- codex/t2-lrv-exact-f2-adapter-v1 (3591e37) -- see
-- ops/handoff/T2_REAL_PARK_LRV_VERTICAL_SLICE_004.md Section 0.
-- SOURCE ONLY. Production freeze active -- NOT applied in this task.
--
-- The legacy t2_akt_yarat is UNCHANGED and NOT revoked -- its one known
-- safe caller (Smeta tizimi/T2_F2Import.js, GAS) keeps working exactly as
-- before.
--
-- Reconciliation: this branch's first draft duplicated t2_akt_yarat's
-- whole insert path (idempotency, invariant checks, majburiy-check).
-- Codex's adapter instead DELEGATES to the existing t2_akt_yarat for the
-- actual akt/row creation, then UPDATEs the certified_* columns
-- afterward -- less duplicate logic, one place that owns akt-creation
-- semantics. Adopted (ACCEPT_CODEX). Also adopted: an explicit actor
-- authorization check (this branch's first draft had NONE -- a real gap)
-- and a duplicate-source-line guard. KEPT from this branch's first draft
-- (REJECT on Codex's side, which merged them into one code): distinct
-- MISSING_CERTIFIED_PRICE vs MISSING_CERTIFIED_AMOUNT codes -- more
-- precise for the caller. ADAPTED from Codex: scoped to F2 only (tur is
-- always 'f2', no p_tur param) -- "certified" is an F2-approval concept
-- per T2_REAL_PARK_LRV_VERTICAL_SLICE_004.md Section 5 (FAKT is
-- draft/at-risk, never "certified"); Codex had already made this same
-- call independently.

begin;

create or replace function public.t2_akt_yarat_v2(
  p_obyekt_id bigint,
  p_oy date,
  p_qatorlar jsonb,
  p_actor_id bigint,
  p_raqam text default null,
  p_operation_id uuid default null,
  p_manba text default 'f2_import_v2'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_komp bigint; v_result jsonb; v_akt_id bigint;
  v_missing_price jsonb; v_missing_amount jsonb;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then
    return jsonb_build_object('ok', false, 'code', 'OBYEKT_NOT_FOUND');
  end if;
  -- Actor authorization -- the first draft of this function had no such
  -- check at all. p_actor_id must be a real, active member of the
  -- object's company (raises on failure, same as every other canonical
  -- write path in this codebase).
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  if p_operation_id is null then
    return jsonb_build_object('ok', false, 'code', 'OPERATION_ID_REQUIRED');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0 then
    return jsonb_build_object('ok', false, 'code', 'F2_LINES_REQUIRED');
  end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x where nullif(x->>'qator_id', '') is null) then
    return jsonb_build_object('ok', false, 'code', 'QATOR_ID_REQUIRED');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x
    group by x->>'qator_id' having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_F2_SOURCE_LINE');
  end if;

  -- THE law: no smeta-price fallback exists anywhere in this function.
  -- price_intentionally_absent must be explicit; missing certified_qty is
  -- always rejected (there is no meaningful F2 line without a quantity).
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x where nullif(x->>'certified_quantity', '') is null) then
    return jsonb_build_object('ok', false, 'code', 'CERTIFIED_QTY_INVALID',
      'qatorlar', (select jsonb_agg(x->>'qator_id') from jsonb_array_elements(p_qatorlar) x where nullif(x->>'certified_quantity', '') is null));
  end if;
  select jsonb_agg(x->>'qator_id') into v_missing_price from jsonb_array_elements(p_qatorlar) x
    where coalesce((x->>'price_intentionally_absent')::boolean, false) is not true
      and nullif(x->>'certified_unit_price', '') is null;
  if v_missing_price is not null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_CERTIFIED_PRICE',
      'xabar', 'Ba''zi qatorlarda F2 hujjatining o''z narxi yo''q va price_intentionally_absent belgilanmagan -- smeta narxiga jim qaytish YO''Q.',
      'qatorlar', v_missing_price);
  end if;
  select jsonb_agg(x->>'qator_id') into v_missing_amount from jsonb_array_elements(p_qatorlar) x
    where coalesce((x->>'price_intentionally_absent')::boolean, false) is not true
      and nullif(x->>'certified_amount', '') is null;
  if v_missing_amount is not null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_CERTIFIED_AMOUNT',
      'xabar', 'Ba''zi qatorlarda F2 hujjatining o''z summasi yuborilmagan.',
      'qatorlar', v_missing_amount);
  end if;

  -- Delegate the actual akt/row creation to the existing, already-tested
  -- t2_akt_yarat (idempotency, invariant checks, majburiy-guard all reused
  -- as-is -- not duplicated here). hajm/narx (compatibility, GENERATED
  -- summa) get the SAME certified values -- never a smeta fallback,
  -- because narx_yoq is set whenever price_intentionally_absent is true.
  select public.t2_akt_yarat(
    p_obyekt_id, 'f2', p_oy,
    (select jsonb_agg(jsonb_build_object(
       'qator_id', (x->>'qator_id')::bigint,
       'hajm', (x->>'certified_quantity')::numeric,
       'narx', case when coalesce((x->>'price_intentionally_absent')::boolean, false) then null
                    else (x->>'certified_unit_price')::numeric end,
       'narx_yoq', coalesce((x->>'price_intentionally_absent')::boolean, false),
       'izoh', x->>'izoh'
     )) from jsonb_array_elements(p_qatorlar) x),
    p_raqam, p_operation_id, p_manba, 'actor:' || p_actor_id, false
  ) into v_result;

  if coalesce((v_result->>'ok')::boolean, false) is not true then
    return v_result;
  end if;
  if (v_result->>'takror')::boolean is true then
    -- Idempotent replay: certified_* were already written on the first
    -- call (or this akt predates v2 -- either way, do not re-write).
    return v_result || jsonb_build_object('contract', 'CERTIFIED_F2_V2');
  end if;
  v_akt_id := (v_result->>'akt_id')::bigint;

  update public.t2_akt_qator aq set
    certified_quantity = (x->>'certified_quantity')::numeric,
    certified_unit_price = case when coalesce((x->>'price_intentionally_absent')::boolean, false) then null
                                 else (x->>'certified_unit_price')::numeric end,
    certified_amount = case when coalesce((x->>'price_intentionally_absent')::boolean, false) then null
                             else (x->>'certified_amount')::numeric end,
    certified_source_hash = nullif(x->>'certified_source_hash', ''),
    raw_snapshot = coalesce(x->'raw_snapshot', x),
    provenance_status = case when coalesce((x->>'price_intentionally_absent')::boolean, false)
                              then 'price_intentionally_absent' else 'source_certified' end
  from jsonb_array_elements(p_qatorlar) x
  where aq.akt_id = v_akt_id and aq.qator_id = (x->>'qator_id')::bigint;

  return v_result || jsonb_build_object('contract', 'CERTIFIED_F2_V2',
    'arithmetic_mismatch_soni', (
      select count(*) from public.t2_akt_qator
      where akt_id = v_akt_id and certified_amount is not null
        and certified_quantity is not null and certified_unit_price is not null
        and abs(certified_quantity * certified_unit_price - certified_amount) > 0.005
    ));
end
$function$;

-- Read model: exact certified triplet + calculated_amount + mismatch flag
-- + provenance, per approved-or-draft F2 act. Adopted from Codex
-- verbatim (adapted to this branch's column names) -- this is exactly
-- what the Price Control read model (Section 2/3 of the vertical slice)
-- and the F2 pre-approval warning panel need.
create or replace function public.t2_f2_exact_qatorlar_v1(p_akt_id bigint, p_actor_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_komp bigint;
begin
  select kompaniya_id into v_komp from public.t2_akt where id = p_akt_id and tur = 'f2';
  if v_komp is null then
    return jsonb_build_object('ok', false, 'code', 'F2_NOT_FOUND');
  end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
  return jsonb_build_object('ok', true, 'qatorlar', coalesce((
    select jsonb_agg(jsonb_build_object(
      'akt_qator_id', aq.id, 'qator_id', aq.qator_id,
      'certified_quantity', aq.certified_quantity,
      'certified_unit_price', aq.certified_unit_price,
      'certified_amount', aq.certified_amount,
      'calculated_amount', case when aq.certified_quantity is not null and aq.certified_unit_price is not null
                                 then aq.certified_quantity * aq.certified_unit_price end,
      'amount_mismatch', aq.certified_amount is not null and aq.certified_quantity is not null
                          and aq.certified_unit_price is not null
                          and abs(aq.certified_quantity * aq.certified_unit_price - aq.certified_amount) > 0.005,
      'provenance', aq.provenance_status
    ) order by aq.id)
    from public.t2_akt_qator aq where aq.akt_id = p_akt_id
  ), '[]'::jsonb));
end
$function$;

revoke all on function public.t2_akt_yarat_v2(bigint,date,jsonb,bigint,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.t2_akt_yarat_v2(bigint,date,jsonb,bigint,text,uuid,text) to service_role;
revoke all on function public.t2_f2_exact_qatorlar_v1(bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_f2_exact_qatorlar_v1(bigint,bigint) to service_role;

comment on function public.t2_akt_yarat_v2(bigint,date,jsonb,bigint,text,uuid,text) is
  'T2-LRV-EXACT-F2-INTEGRATION-003 (reconciled with codex/t2-lrv-exact-f2-adapter-v1): F2 document creation with independently-stored certified_quantity/unit_price/amount. No smeta-price fallback exists in this function. Delegates row creation to legacy t2_akt_yarat, then writes certified_* -- frozen once the parent act is approved (t2_akt_qator_certified_freeze_v1_trg).';
comment on function public.t2_f2_exact_qatorlar_v1(bigint,bigint) is
  'T2-REAL-PARK-LRV-VERTICAL-SLICE-004: exact certified F2 read model for one act -- feeds Price Control and the F2 pre-approval warning panel.';

commit;
