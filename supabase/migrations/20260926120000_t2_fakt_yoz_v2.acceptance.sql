-- Run inside BEGIN ... ROLLBACK with :obyekt, :actor and two canonical rows
-- of that object.  This script does not create business data permanently.
do $$
declare
  v jsonb;
  v_obyekt bigint := :obyekt;
  v_actor bigint := :actor;
  v_qator bigint := :qator;
  v_other_obyekt_qator bigint := :other_obyekt_qator;
begin
  v := public.t2_fakt_yoz_v2(v_obyekt, current_date,
    jsonb_build_array(jsonb_build_object('qator_id', v_qator, 'hajm', 1)),
    v_actor, gen_random_uuid(), 'acceptance');
  if coalesce((v->>'ok')::boolean, false) is not true then
    raise exception 'FAKT_V2_ACCEPTANCE_FAILED: %', v;
  end if;

  v := public.t2_fakt_yoz_v2(v_obyekt, current_date,
    jsonb_build_array(jsonb_build_object('qator_id', v_other_obyekt_qator, 'hajm', 1)),
    v_actor, gen_random_uuid(), 'acceptance');
  if v->>'code' <> 'FAKT_LINE_OUTSIDE_OBJECT' then
    raise exception 'FAKT_V2_CROSS_OBJECT_GUARD_FAILED: %', v;
  end if;

  raise exception 'FAKT_V2_ACCEPTANCE_PASS';
end $$;
