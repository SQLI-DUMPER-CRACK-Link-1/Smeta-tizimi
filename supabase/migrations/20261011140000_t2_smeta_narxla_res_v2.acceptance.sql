-- Transaction-only structural acceptance. Bu skript real biznes qatori
-- yaratmaydi va ROLLBACK bilan tugaydi.
begin;

do $acceptance$
declare
  v_def text;
begin
  select pg_get_functiondef('public.t2_smeta_narxla_res_v2(bigint,bigint,bigint,uuid,jsonb,jsonb)'::regprocedure)
    into v_def;
  if v_def is null
     or position('SECURITY DEFINER' in upper(v_def)) = 0
     or position('SET search_path TO' in v_def) = 0
     or position('source_ref' in v_def) = 0
     or position('manual_valid' in v_def) = 0
     or position('t2_actor_kompaniya_azo_tekshir' in v_def) = 0 then
    raise exception 'T2_RES_PRICING_V2_ACCEPTANCE_FAILED';
  end if;
  raise notice 'T2_RES_PRICING_V2_ACCEPTANCE_PASS';
end;
$acceptance$;

rollback;
