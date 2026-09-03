-- No business rows are created. Run inside BEGIN ... ROLLBACK after migration apply.
begin;
do $$
declare v_def text; v_acl text;
begin
  select pg_get_functiondef(p.oid), coalesce(array_to_string(p.proacl,','),'')
    into v_def,v_acl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='t2_effective_authorization_v1';
  if v_def is null then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: function absent'; end if;
  if position('t2_platforma_rol' in v_def)=0 or position('t2_capability_effective_v1' in v_def)=0
     or position('t2_loyiha_foydalanuvchi_ruxsat' in v_def)=0 or position('t2_obyekt_foydalanuvchi_ruxsat' in v_def)=0 then
    raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: required truth source missing';
  end if;
  if position('anon=X' in v_acl)>0 or position('authenticated=X' in v_acl)>0 then
    raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: public caller grant';
  end if;
end $$;
select 'AUTH_CORE_ACCEPTANCE_PASS' as acceptance;
rollback;
