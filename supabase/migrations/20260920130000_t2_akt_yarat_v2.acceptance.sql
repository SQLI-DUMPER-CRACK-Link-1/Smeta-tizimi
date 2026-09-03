-- Behavioral acceptance for t2_akt_yarat_v2 (reconciled contract). Run
-- inside a transaction that is ROLLED BACK. Substitute :obyekt / :qator1
-- / :qator2 / :actor (a real active member of the object's company).

do $$
declare
  v jsonb; v_obyekt bigint := :obyekt; v_qator1 bigint := :qator1;
  v_qator2 bigint := :qator2; v_actor bigint := :actor;
begin
  -- unauthorized actor rejected before anything else
  begin
    perform public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
      jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_quantity', 5, 'price_intentionally_absent', true)),
      999999999, 'TEST-0', gen_random_uuid(), 'test');
    raise exception 'FAIL unauthorized actor should have been rejected';
  exception when others then
    if sqlerrm = 'FAIL unauthorized actor should have been rejected' then raise; end if;
  end;

  -- missing price rejected, nothing inserted
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_quantity', 5)),
    v_actor, 'TEST-1', gen_random_uuid(), 'test');
  if (v->>'code') <> 'MISSING_CERTIFIED_PRICE' then raise exception 'FAIL missing price: %', v; end if;

  -- price_intentionally_absent honored
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_quantity', 5, 'price_intentionally_absent', true)),
    v_actor, 'TEST-2', gen_random_uuid(), 'test');
  if (v->>'ok') <> 'true' then raise exception 'FAIL price_intentionally_absent row: %', v; end if;
  perform 1 from public.t2_akt_qator where akt_id = (v->>'akt_id')::bigint and qator_id = v_qator1
    and provenance_status = 'price_intentionally_absent' and certified_unit_price is null;
  if not found then raise exception 'FAIL price_intentionally_absent not stored correctly'; end if;

  -- exact P0 case
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qator2, 'certified_quantity', 10, 'certified_unit_price', 123.45, 'certified_amount', 1234.49)),
    v_actor, 'TEST-3', gen_random_uuid(), 'test');
  if (v->>'ok') <> 'true' then raise exception 'FAIL exact case: %', v; end if;
  if (v->>'arithmetic_mismatch_soni')::int <> 1 then raise exception 'FAIL expected 1 mismatch: %', v; end if;
  perform 1 from public.t2_akt_qator where akt_id = (v->>'akt_id')::bigint and qator_id = v_qator2 and certified_amount = 1234.49;
  if not found then raise exception 'FAIL certified_amount not preserved exactly'; end if;

  -- duplicate source line in one batch rejected
  v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
    jsonb_build_array(
      jsonb_build_object('qator_id', v_qator1, 'certified_quantity', 1, 'price_intentionally_absent', true),
      jsonb_build_object('qator_id', v_qator1, 'certified_quantity', 2, 'price_intentionally_absent', true)),
    v_actor, 'TEST-4', gen_random_uuid(), 'test');
  if (v->>'code') <> 'DUPLICATE_F2_SOURCE_LINE' then raise exception 'FAIL duplicate line: %', v; end if;

  -- read model
  v := public.t2_f2_exact_qatorlar_v1((select (public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
      jsonb_build_array(jsonb_build_object('qator_id', v_qator1, 'certified_quantity', 1, 'price_intentionally_absent', true)),
      v_actor, 'TEST-5', gen_random_uuid(), 'test'))->>'akt_id')::bigint, v_actor);
  if (v->>'ok') <> 'true' then raise exception 'FAIL read model: %', v; end if;

  -- FROZEN: once the parent act is approved, certified_* cannot be updated
  declare v_akt_frozen bigint;
  begin
    v := public.t2_akt_yarat_v2(v_obyekt, '2026-05-01'::date,
      jsonb_build_array(jsonb_build_object('qator_id', v_qator2, 'certified_quantity', 1, 'price_intentionally_absent', true)),
      v_actor, 'TEST-6', gen_random_uuid(), 'test');
    v_akt_frozen := (v->>'akt_id')::bigint;
    update public.t2_akt set holat = 'tasdiqlangan' where id = v_akt_frozen;
    begin
      update public.t2_akt_qator set certified_quantity = 999 where akt_id = v_akt_frozen and qator_id = v_qator2;
      raise exception 'FAIL frozen trigger should have blocked this update';
    exception when check_violation then null; -- expected: APPROVED_F2_CERTIFIED_FROZEN
    end;
  end;

  raise exception 'T2_AKT_YARAT_V2_RECONCILED_ACCEPTANCE_PASS';
end $$;
