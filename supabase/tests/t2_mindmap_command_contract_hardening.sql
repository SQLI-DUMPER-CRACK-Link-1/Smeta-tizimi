-- Run only on a disposable Supabase branch or isolated tenant.
-- Required psql variables:
-- test_company_id, other_company_id, actor_id, loyiha_id, obyekt_id,
-- other_loyiha_id, obyekt_version, operation_id, retry_operation_id.
-- The fixture actor must be active in t2_azolik for test_company_id.
-- This test is read/write by design and MUST NOT run against production data.

begin;

select set_config('t2.test_company_id', :'test_company_id', true);
select set_config('t2.test_other_loyiha_id', :'other_loyiha_id', true);
select set_config('t2.test_actor_id', :'actor_id', true);
select set_config('t2.test_loyiha_id', :'loyiha_id', true);
select set_config('t2.test_obyekt_id', :'obyekt_id', true);
select set_config('t2.test_obyekt_version', :'obyekt_version', true);
select set_config('t2.test_operation_id', :'operation_id', true);
select set_config('t2.test_retry_operation_id', :'retry_operation_id', true);

do $$
begin
  if to_regprocedure('public.t2_mindmap_bog_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)') is null then
    raise exception 'missing t2_mindmap_bog_v2';
  end if;
  if to_regprocedure('public.t2_mindmap_bog_ochir_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)') is null then
    raise exception 'missing t2_mindmap_bog_ochir_v2';
  end if;
  if to_regprocedure('public.t2_mindmap_joylashuv_saqla_v2(bigint,bigint,jsonb,uuid,text)') is null then
    raise exception 'missing t2_mindmap_joylashuv_saqla_v2';
  end if;
  if to_regprocedure('public.t2_mindmap_tugun_ochir_v2(bigint,bigint,text,bigint,integer,uuid,text)') is null then
    raise exception 'missing t2_mindmap_tugun_ochir_v2';
  end if;
  if not exists (
    select 1 from pg_indexes
     where schemaname='public' and tablename='t2_mindmap_command_reestr'
       and indexdef like '%(kompaniya_id, operation_id)%'
  ) then
    raise exception 'missing command idempotency index';
  end if;
end;
$$;

-- 1. Same operation_id must return the stored result and must not create a second command.
select public.t2_mindmap_bog_v2(
  :test_company_id, :actor_id, 'obyekt_loyiha', :loyiha_id, :obyekt_id,
  null, :obyekt_version, :'operation_id'::uuid, 'contract-test'
) as first_result;

select public.t2_mindmap_bog_v2(
  :test_company_id, :actor_id, 'obyekt_loyiha', :loyiha_id, :obyekt_id,
  null, :obyekt_version, :'operation_id'::uuid, 'contract-test'
) as retry_result;

do $$
declare c integer;
begin
  select count(*) into c from public.t2_mindmap_command_reestr
   where kompaniya_id = current_setting('t2.test_company_id')::bigint
     and operation_id = current_setting('t2.test_operation_id')::uuid;
  if c <> 1 then raise exception 'operation receipt count %, expected 1', c; end if;
end;
$$;

-- 2. Cross-tenant source is rejected. The exception is expected.
savepoint cross_tenant;
do $$
begin
  perform public.t2_mindmap_bog_v2(
    current_setting('t2.test_company_id')::bigint, current_setting('t2.test_actor_id')::bigint,
    'obyekt_loyiha', current_setting('t2.test_other_loyiha_id')::bigint,
    current_setting('t2.test_obyekt_id')::bigint, null,
    current_setting('t2.test_obyekt_version')::integer + 1,
    current_setting('t2.test_retry_operation_id')::uuid, 'contract-test'
  );
  raise exception 'cross-tenant source was accepted';
exception when sqlstate '42501' then
  null;
end;
$$;
rollback to savepoint cross_tenant;

-- 3. Stale version is rejected; a concurrent command cannot overwrite the relation.
savepoint stale_version;
do $$
begin
  perform public.t2_mindmap_bog_ochir_v2(
    current_setting('t2.test_company_id')::bigint, current_setting('t2.test_actor_id')::bigint,
    'obyekt_loyiha', current_setting('t2.test_loyiha_id')::bigint,
    current_setting('t2.test_obyekt_id')::bigint, null,
    current_setting('t2.test_obyekt_version')::integer, gen_random_uuid(), 'contract-test'
  );
  raise exception 'stale version was accepted';
exception when sqlstate '40001' then
  null;
end;
$$;
rollback to savepoint stale_version;

-- 4. Soft unlink never deletes object or project; it only clears the relation.
-- Use the current object versiya after step 1.
select public.t2_mindmap_bog_ochir_v2(
  :test_company_id, :actor_id, 'obyekt_loyiha', :loyiha_id, :obyekt_id,
  null, (select versiya from public.t2_obyekt where id=:obyekt_id),
  gen_random_uuid(), 'contract-test'
);

do $$
begin
  if not exists (select 1 from public.t2_obyekt where id=current_setting('t2.test_obyekt_id')::bigint and kompaniya_id=current_setting('t2.test_company_id')::bigint) then
    raise exception 'unlink deleted entity';
  end if;
  if exists (select 1 from public.t2_obyekt where id=current_setting('t2.test_obyekt_id')::bigint and loyiha_id=current_setting('t2.test_loyiha_id')::bigint) then
    raise exception 'unlink did not clear natural FK';
  end if;
end;
$$;

rollback;
