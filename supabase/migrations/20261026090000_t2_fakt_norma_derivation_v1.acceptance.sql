-- Run inside BEGIN ... ROLLBACK.  This acceptance does not create business data.
-- Supply :actor with an actor who is entitled to the sample object's company.
begin;

do $$
declare
  v_definition text;
  v_rs record;
  v_response jsonb;
  v_bad bigint;
begin
  select pg_get_viewdef('public.t2_qator_holat'::regclass, true) into v_definition;
  if position('BL_NORMA' in v_definition) = 0
     or position('tasdiqlangan' in v_definition) = 0 then
    raise exception 'FAKT_NORMA_VIEW_CONTRACT_MISSING';
  end if;

  -- A cancelled Fakt/F2 must never contribute to this read model.
  select count(*) into v_bad
  from public.t2_qator q
  join public.t2_qator_holat h on h.qator_id=q.id
  where h.direct_fakt_hajm is distinct from coalesce((
    select sum(aq.hajm) from public.t2_akt_qator aq
    join public.t2_akt a on a.id=aq.akt_id
    where aq.qator_id=q.id and a.tur='fakt' and a.holat<>'bekor'
  ),0::numeric);
  if v_bad <> 0 then raise exception 'FAKT_NORMA_CANCELLED_ROLLUP_MISMATCH: %',v_bad; end if;

  -- Pick an existing RS below BL.  Command rejection is side-effect-free.
  select q.id,q.obyekt_id into v_rs
  from public.t2_qator q join public.t2_qator parent on parent.id=q.ota_id
  where q.tur='rs' and parent.tur='bl'
  order by q.id limit 1;
  if v_rs.id is null then
    raise exception 'FAKT_NORMA_ACCEPTANCE_SAMPLE_RS_REQUIRED';
  end if;
  v_response := public.t2_fakt_yoz_v2(v_rs.obyekt_id,current_date,
    jsonb_build_array(jsonb_build_object('qator_id',v_rs.id,'hajm',1)),
    :actor,gen_random_uuid(),'acceptance');
  if v_response->>'code' <> 'FAKT_DERIVED_OR_ROLLUP_LINE' then
    raise exception 'FAKT_NORMA_RS_WRITE_GUARD_FAILED: %',v_response;
  end if;
end $$;

select 'FAKT_NORMA_DERIVATION_ACCEPTANCE_PASS' as acceptance;
rollback;
