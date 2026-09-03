-- Behavioral acceptance for t2_akt_yarat_v2. Run inside a transaction
-- that is ROLLED BACK. Substitute :qator1 / :qator2 / :obyekt with real
-- rows from t2_qator/t2_obyekt in the same company.

do $$
declare
  v jsonb; v_akt bigint;
  v_obyekt bigint := :obyekt;
  v_qator1 bigint := :qator1;
  v_qator2 bigint := :qator2;
begin
  -- 1. missing price with narx_yoq not set -> whole batch rejected,
  -- NOTHING inserted (no smeta-price fallback exists in this function).
  v := public.t2_akt_yarat_v2(v_obyekt, 'f2', '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_qty', 5)),
    null, gen_random_uuid(), 'test', 'test', false);
  if (v->>'code') <> 'MISSING_CERTIFIED_PRICE' then
    raise exception 'FAIL missing price should reject with MISSING_CERTIFIED_PRICE: %', v;
  end if;

  -- 2. narx_yoq=true is honored -- no price required, row still created
  v := public.t2_akt_yarat_v2(v_obyekt, 'f2', '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_qty', 5, 'narx_yoq', true)),
    null, gen_random_uuid(), 'test', 'test', false);
  if (v->>'ok') <> 'true' then raise exception 'FAIL narx_yoq=true row should succeed: %', v; end if;
  v_akt := (v->>'akt_id')::bigint;
  perform 1 from public.t2_akt_qator where akt_id = v_akt and qator_id = v_qator1
    and certified_unit_price is null and narx is null and provenance_status = 'source_certified';
  if not found then raise exception 'FAIL narx_yoq row did not store NULL price correctly'; end if;

  -- 3. THE exact P0 case: certified_amount independently preserved even
  -- though it does not equal certified_qty*certified_price (10*123.45=1234.50).
  v := public.t2_akt_yarat_v2(v_obyekt, 'f2', '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object(
      'qator_id', v_qator2, 'certified_qty', 10, 'certified_price', 123.45, 'certified_amount', 1234.49)),
    null, gen_random_uuid(), 'test', 'test', false);
  if (v->>'ok') <> 'true' then raise exception 'FAIL exact P0 case row should succeed: %', v; end if;
  if (v->>'arithmetic_mismatch_soni')::int <> 1 then
    raise exception 'FAIL should report 1 arithmetic mismatch (1234.50 vs 1234.49): %', v;
  end if;
  perform 1 from public.t2_akt_qator
    where akt_id = (v->>'akt_id')::bigint and qator_id = v_qator2 and certified_amount = 1234.49;
  if not found then raise exception 'FAIL certified_amount 1234.49 was not preserved exactly'; end if;

  -- 4. missing amount (price given, amount not) also rejected
  v := public.t2_akt_yarat_v2(v_obyekt, 'f2', '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_qty', 5, 'certified_price', 100)),
    null, gen_random_uuid(), 'test', 'test', false);
  if (v->>'code') <> 'MISSING_CERTIFIED_AMOUNT' then
    raise exception 'FAIL missing amount should reject with MISSING_CERTIFIED_AMOUNT: %', v;
  end if;

  -- 5. idempotency -- same operation_id replays the cached result
  declare v_opid uuid := gen_random_uuid(); v_first jsonb; v_second jsonb;
  begin
    v_first := public.t2_akt_yarat_v2(v_obyekt, 'fakt', '2026-06-01'::date,
      jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_qty', 1, 'narx_yoq', true)),
      null, v_opid, 'test', 'test', false);
    v_second := public.t2_akt_yarat_v2(v_obyekt, 'fakt', '2026-06-01'::date,
      jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_qty', 1, 'narx_yoq', true)),
      null, v_opid, 'test', 'test', false);
    if (v_second->>'takror') <> 'true' then raise exception 'FAIL replay with same operation_id should be idempotent: %', v_second; end if;
  end;

  raise exception 'T2_AKT_YARAT_V2_ACCEPTANCE_PASS';
end $$;
