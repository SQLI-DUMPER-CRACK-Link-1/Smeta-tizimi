-- BEGIN; run with real active :actor and canonical rows, then ROLLBACK.
do $$
declare v jsonb; v_obyekt bigint:=:obyekt; v_qator bigint:=:qator; v_actor bigint:=:actor; v_current numeric;
begin
  select coalesce(fakt_hajm,0) into v_current from public.t2_qator_holat where qator_id=v_qator;
  v:=public.t2_fakt_belgila_v2(v_obyekt,v_qator,v_current,v_current+1,current_date,v_actor,gen_random_uuid(),'acceptance','acceptance');
  if coalesce((v->>'ok')::boolean,false) is not true then raise exception 'FAKT_TOTAL_V2_ACCEPTANCE_FAILED: %',v; end if;
  v:=public.t2_fakt_belgila_v2(v_obyekt,v_qator,v_current,v_current+2,current_date,v_actor,gen_random_uuid(),'acceptance','acceptance');
  if v->>'code'<>'FAKT_CONFLICT' then raise exception 'FAKT_TOTAL_V2_CONFLICT_GUARD_FAILED: %',v; end if;
  raise exception 'FAKT_TOTAL_V2_ACCEPTANCE_PASS';
end $$;
