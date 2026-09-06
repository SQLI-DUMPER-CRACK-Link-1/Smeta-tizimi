begin;

do $acceptance$
declare v_public boolean; v_service boolean;
begin
  select has_function_privilege('anon','public.t2_actor_kompaniya_azo_tekshir(bigint,bigint)','execute') into v_public;
  if v_public then raise exception 'T2_ACTOR_AZO_EXECUTE_HARDENING_FAIL_ANON'; end if;
  select has_function_privilege('service_role','public.t2_actor_kompaniya_azo_tekshir(bigint,bigint)','execute') into v_service;
  if not v_service then raise exception 'T2_ACTOR_AZO_EXECUTE_HARDENING_FAIL_SERVICE'; end if;
  raise notice 'T2_ACTOR_AZO_EXECUTE_HARDENING_ACCEPTANCE_PASS';
end $acceptance$;

rollback;
