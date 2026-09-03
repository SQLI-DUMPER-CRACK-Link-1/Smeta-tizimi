-- Behavioral acceptance for Price Control. Run inside a transaction that
-- is ROLLED BACK. Substitute :obyekt / :actor / :qA .. :qE with 5
-- distinct real t2_qator rows (same company) whose current smeta narx
-- (t2_qator.narx) is exactly 100 for this test to match the worked
-- examples verbatim -- if narx differs, the script overrides it locally
-- inside the transaction before creating F2 acts (never touching real
-- committed data, since the whole thing rolls back).

do $$
declare
  v jsonb; v_obyekt bigint := :obyekt; v_actor bigint := :actor;
  v_qA bigint := :qA; v_qB bigint := :qB; v_qC bigint := :qC; v_qD bigint := :qD; v_qE bigint := :qE;
  v_row jsonb;
begin
  -- fixture: all 5 lines priced at reference=100 in the smeta right now
  update public.t2_qator set narx = 100 where id in (v_qA, v_qB, v_qC, v_qD, v_qE);

  -- CASE 1: reference=100, F2=80, qty=500 -> frozen = (100-80)*500 = 10000
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qA, 'certified_quantity', 500, 'certified_unit_price', 80, 'certified_amount', 40000)),
    v_actor, 'PC-1', gen_random_uuid(), 'test');
  if (v->>'ok') <> 'true' then raise exception 'FAIL case1 create: %', v; end if;
  update public.t2_akt set holat = 'tasdiqlangan' where id = (v->>'akt_id')::bigint;

  -- CASE 2: reference=100, F2=100 -> normal
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qB, 'certified_quantity', 10, 'certified_unit_price', 100, 'certified_amount', 1000)),
    v_actor, 'PC-2', gen_random_uuid(), 'test');
  update public.t2_akt set holat = 'tasdiqlangan' where id = (v->>'akt_id')::bigint;

  -- CASE 3: protocol approves 120 for qC, F2=120 -> justified
  perform public.t2_price_basis_yarat_v1(v_actor, (select kompaniya_id from t2_obyekt where id=v_obyekt),
    'PRICE_AGREEMENT_PROTOCOL', jsonb_build_array(jsonb_build_object('qator_id', v_qC, 'approved_price', 120)),
    null, gen_random_uuid());
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qC, 'certified_quantity', 10, 'certified_unit_price', 120, 'certified_amount', 1200)),
    v_actor, 'PC-3', gen_random_uuid(), 'test');
  update public.t2_akt set holat = 'tasdiqlangan' where id = (v->>'akt_id')::bigint;

  -- CASE 4: no protocol, F2=120 -> basis missing
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qD, 'certified_quantity', 10, 'certified_unit_price', 120, 'certified_amount', 1200)),
    v_actor, 'PC-4', gen_random_uuid(), 'test');
  update public.t2_akt set holat = 'tasdiqlangan' where id = (v->>'akt_id')::bigint;

  -- CASE 5: protocol approves 115 for qE, F2=120 -> exceeded
  perform public.t2_price_basis_yarat_v1(v_actor, (select kompaniya_id from t2_obyekt where id=v_obyekt),
    'PRICE_AGREEMENT_PROTOCOL', jsonb_build_array(jsonb_build_object('qator_id', v_qE, 'approved_price', 115)),
    null, gen_random_uuid());
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qE, 'certified_quantity', 10, 'certified_unit_price', 120, 'certified_amount', 1200)),
    v_actor, 'PC-5', gen_random_uuid(), 'test');
  update public.t2_akt set holat = 'tasdiqlangan' where id = (v->>'akt_id')::bigint;

  -- verify via the read model
  v := public.t2_price_control_v1(v_obyekt, v_actor);
  if (v->>'ok') <> 'true' then raise exception 'FAIL read model: %', v; end if;

  select x into v_row from jsonb_array_elements(v->'qatorlar') x where (x->>'qator_id')::bigint = v_qA;
  if (v_row->>'frozen_amount')::numeric <> 10000 then raise exception 'FAIL case1 frozen != 10000: %', v_row; end if;
  if (v_row->>'price_state') <> 'BELOW_REFERENCE' then raise exception 'FAIL case1 state: %', v_row; end if;

  select x into v_row from jsonb_array_elements(v->'qatorlar') x where (x->>'qator_id')::bigint = v_qB;
  if (v_row->>'price_state') <> 'NORMAL' then raise exception 'FAIL case2 state: %', v_row; end if;
  if (v_row->>'frozen_amount')::numeric <> 0 then raise exception 'FAIL case2 frozen should be 0: %', v_row; end if;

  select x into v_row from jsonb_array_elements(v->'qatorlar') x where (x->>'qator_id')::bigint = v_qC;
  if (v_row->>'price_state') <> 'ABOVE_REFERENCE_JUSTIFIED' then raise exception 'FAIL case3 state: %', v_row; end if;

  select x into v_row from jsonb_array_elements(v->'qatorlar') x where (x->>'qator_id')::bigint = v_qD;
  if (v_row->>'price_state') <> 'ABOVE_REFERENCE_MISSING_BASIS' then raise exception 'FAIL case4 state: %', v_row; end if;

  select x into v_row from jsonb_array_elements(v->'qatorlar') x where (x->>'qator_id')::bigint = v_qE;
  if (v_row->>'price_state') <> 'ABOVE_APPROVED_BASIS' then raise exception 'FAIL case5 state: %', v_row; end if;

  -- historical frozen amount survives a LATER smeta price change
  update public.t2_qator set narx = 999 where id = v_qA;
  v := public.t2_price_control_v1(v_obyekt, v_actor);
  select x into v_row from jsonb_array_elements(v->'qatorlar') x where (x->>'qator_id')::bigint = v_qA;
  if (v_row->>'frozen_amount')::numeric <> 10000 then
    raise exception 'FAIL historical frozen amount changed after a later smeta revision: %', v_row;
  end if;

  raise exception 'T2_PRICE_CONTROL_V1_ACCEPTANCE_PASS';
end $$;
