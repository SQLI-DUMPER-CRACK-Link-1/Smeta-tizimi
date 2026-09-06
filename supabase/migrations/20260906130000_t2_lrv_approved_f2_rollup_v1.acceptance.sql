-- Read-only acceptance for 20260906130000_t2_lrv_approved_f2_rollup_v1.
-- No business rows are inserted or changed.

do $$
declare
  v_definition text;
  v_bad_count bigint;
begin
  select pg_get_viewdef('public.t2_qator_holat'::regclass, true) into v_definition;
  if position('tasdiqlangan' in v_definition) = 0 then
    raise exception 'FAIL approved F2 filter is absent from t2_qator_holat';
  end if;

  select count(*) into v_bad_count
  from public.t2_qator q
  join public.t2_qator_holat h on h.qator_id = q.id
  where h.f2_hajm is distinct from coalesce((
    select sum(coalesce(aq.certified_quantity, aq.hajm))
    from public.t2_akt_qator aq
    join public.t2_akt a on a.id = aq.akt_id
    where aq.qator_id = q.id and a.tur = 'f2' and a.holat = 'tasdiqlangan'
  ), 0::numeric)
  or h.f2_summa is distinct from coalesce((
    select sum(coalesce(aq.certified_amount, aq.summa))
    from public.t2_akt_qator aq
    join public.t2_akt a on a.id = aq.akt_id
    where aq.qator_id = q.id and a.tur = 'f2' and a.holat = 'tasdiqlangan'
  ), 0::numeric);
  if v_bad_count <> 0 then
    raise exception 'FAIL approved-only rollup mismatch: % qator', v_bad_count;
  end if;
end $$;

select 'LRV_APPROVED_F2_ROLLUP_ACCEPTANCE_PASS' as acceptance;
