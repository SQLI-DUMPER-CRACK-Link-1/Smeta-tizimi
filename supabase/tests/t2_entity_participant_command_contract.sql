-- Run only on a disposable Supabase branch or isolated tenant.
-- Required psql variables:
-- test_company_id, other_company_id, actor_id, loyiha_id,
-- kontragent_id, other_kontragent_id, loyiha_version, operation_id.
-- The fixture actor must be an active non-boss member of test_company_id.
-- This test is read/write by design and MUST NOT run against production data.

begin;

select set_config('t2.test_company_id', :'test_company_id', true);
select set_config('t2.test_other_company_id', :'other_company_id', true);
select set_config('t2.test_actor_id', :'actor_id', true);
select set_config('t2.test_loyiha_id', :'loyiha_id', true);
select set_config('t2.test_kontragent_id', :'kontragent_id', true);
select set_config('t2.test_other_kontragent_id', :'other_kontragent_id', true);
select set_config('t2.test_loyiha_version', :'loyiha_version', true);
select set_config('t2.test_operation_id', :'operation_id', true);

do $$
begin
  if to_regprocedure('public.t2_loyiha_qatnashchi_biriktir_v2(bigint,bigint,bigint,bigint,bigint,text,integer,uuid,text,text)') is null then
    raise exception 'missing canonical participant create RPC';
  end if;
  if to_regprocedure('public.t2_loyiha_qatnashchi_ochir_v2(bigint,bigint,bigint,integer,uuid,text)') is null then
    raise exception 'missing canonical participant unlink RPC';
  end if;
end;
$$;

-- The vocabulary is part of the contract; no ta_minotchi variant is allowed.
do $$
declare constraint_text text;
begin
  select string_agg(pg_get_constraintdef(c.oid), ' ') into constraint_text
    from pg_constraint c
   where c.conrelid = 'public.t2_loyiha_qatnashchi'::regclass
     and c.contype = 'c';
  if constraint_text is null
     or constraint_text not like '%zakazchik%'
     or constraint_text not like '%bosh_pudratchi%'
     or constraint_text not like '%subpudratchi%'
     or constraint_text not like '%loyihachi%'
     or constraint_text not like '%taminotchi%' then
    raise exception 'role vocabulary constraint is missing or drifted: %', constraint_text;
  end if;
end;
$$;

-- 1. Same-tenant external participant succeeds and retry is idempotent.
select public.t2_loyiha_qatnashchi_biriktir_v2(
  :test_company_id, :actor_id, :loyiha_id, null, :kontragent_id,
  'zakazchik', :loyiha_version, :'operation_id'::uuid, 'contract-test', 'contract-test'
) as first_result;
select public.t2_loyiha_qatnashchi_biriktir_v2(
  :test_company_id, :actor_id, :loyiha_id, null, :kontragent_id,
  'zakazchik', :loyiha_version, :'operation_id'::uuid, 'contract-test', 'contract-test'
) as retry_result;

do $$
declare c integer;
begin
  select count(*) into c from public.t2_mindmap_command_reestr
   where kompaniya_id = current_setting('t2.test_company_id')::bigint
     and operation_id = current_setting('t2.test_operation_id')::uuid;
  if c <> 1 then raise exception 'operation receipt count %, expected 1', c; end if;
  select count(*) into c from public.t2_loyiha_qatnashchi
   where loyiha_id = current_setting('t2.test_loyiha_id')::bigint
     and kontragent_id = current_setting('t2.test_kontragent_id')::bigint
     and rol = 'zakazchik' and holat = 'faol';
  if c <> 1 then raise exception 'duplicate participant rows: %', c; end if;
end;
$$;

-- 2. Invalid role is rejected by the database (not just the gateway).
savepoint invalid_role;
do $$
begin
  perform public.t2_loyiha_qatnashchi_biriktir_v2(
    current_setting('t2.test_company_id')::bigint, current_setting('t2.test_actor_id')::bigint,
    current_setting('t2.test_loyiha_id')::bigint, null,
    current_setting('t2.test_kontragent_id')::bigint, 'ta_minotchi',
    current_setting('t2.test_loyiha_version')::integer, gen_random_uuid(), null, null);
  raise exception 'invalid role was accepted';
exception when sqlstate '22023' then null;
end;
$$;
rollback to savepoint invalid_role;

-- 3. Cross-tenant kontragent and wrong project company are rejected.
savepoint cross_tenant;
do $$
begin
  perform public.t2_loyiha_qatnashchi_biriktir_v2(
    current_setting('t2.test_company_id')::bigint, current_setting('t2.test_actor_id')::bigint,
    current_setting('t2.test_loyiha_id')::bigint, null,
    current_setting('t2.test_other_kontragent_id')::bigint, 'zakazchik',
    current_setting('t2.test_loyiha_version')::integer, gen_random_uuid(), null, null);
  raise exception 'cross-tenant kontragent was accepted';
exception when sqlstate '42501' then null;
end;
$$;
rollback to savepoint cross_tenant;

savepoint wrong_company;
do $$
begin
  perform public.t2_loyiha_qatnashchi_biriktir_v2(
    current_setting('t2.test_other_company_id')::bigint, current_setting('t2.test_actor_id')::bigint,
    current_setting('t2.test_loyiha_id')::bigint, null,
    current_setting('t2.test_kontragent_id')::bigint, 'zakazchik',
    current_setting('t2.test_loyiha_version')::integer, gen_random_uuid(), null, null);
  raise exception 'wrong company id was accepted';
exception when sqlstate '42501' then null;
end;
$$;
rollback to savepoint wrong_company;

-- 4. Soft unlink leaves the row and records holat=bekor.
select public.t2_loyiha_qatnashchi_ochir_v2(
  :test_company_id, :actor_id,
  (select id from public.t2_loyiha_qatnashchi
    where loyiha_id=:loyiha_id and kontragent_id=:kontragent_id
      and rol='zakazchik' and holat='faol' order by id desc limit 1),
  (select versiya from public.t2_loyiha where id=:loyiha_id), gen_random_uuid(), 'contract-test'
);
do $$
begin
  if not exists (select 1 from public.t2_loyiha_qatnashchi
                  where loyiha_id=current_setting('t2.test_loyiha_id')::bigint
                    and kontragent_id=current_setting('t2.test_kontragent_id')::bigint
                    and rol='zakazchik' and holat='bekor') then
    raise exception 'unlink did not soft-delete participant';
  end if;
end;
$$;

rollback;
