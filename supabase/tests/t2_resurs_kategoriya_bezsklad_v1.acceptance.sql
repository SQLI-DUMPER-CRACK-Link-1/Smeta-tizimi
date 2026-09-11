-- T2-RESURS-BEZSKLAD-V1 acceptance contract.
--
-- TDD RED contract: run after
-- 20261021150000_t2_resurs_kategoriya_bezsklad_v1.sql on a disposable/local
-- database. This file is source-only and must not be applied to production.
-- The DML assertions run inside one transaction and are rolled back.
--
-- Owner rule:
--   1. ЧЕЛ/МАШ from unit always wins.
--   2. Name classifier may return БЕЗСКЛАД for ВОДА/SUV, БЕТОН/BETON,
--      РАСТВОР/RASTVOR.
--   3. A confirmed tenant registry entry wins after the name classifier;
--      t2_kat_birlik is the final fallback.

begin;

-- The migration must expose an immutable deterministic classifier and the
-- tenant-scoped precedence helper used by both canonical import writers.
do $$
declare
  v_fn regprocedure;
  v_volatility "char";
  v_def text;
begin
  v_fn := to_regprocedure('public.t2_resurs_bozsklad_nomi_v1(text)');
  if v_fn is null then
    raise exception 'FAIL missing deterministic name classifier';
  end if;
  select p.provolatile into v_volatility from pg_proc p where p.oid = v_fn;
  if v_volatility <> 'i' then
    raise exception 'FAIL classifier must be immutable, got %', v_volatility;
  end if;

  v_fn := to_regprocedure('public.t2_resurs_kategoriya_import_kat_v1(bigint,text,text)');
  if v_fn is null then
    raise exception 'FAIL missing import precedence helper';
  end if;

  select pg_get_functiondef(to_regprocedure(
    'public.t2_resurs_kategoriya_belgila_v1(bigint,bigint,text,text,text,uuid)')) into v_def;
  if position('БЕЗСКЛАД' in v_def) = 0
     or position('t2_onboarding_command_log' in v_def) = 0 then
    raise exception 'FAIL registry writer lost БЕЗСКЛАД vocabulary or idempotency log';
  end if;

  select pg_get_functiondef(to_regprocedure(
    'public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb)')) into v_def;
  if position('t2_resurs_kategoriya_import_kat_v1' in v_def) = 0
     or position('t2_smeta_import_ruxsat' in v_def) = 0
     or position('t2_onboarding_command_log' in v_def) = 0
     or position('t2_audit_yoz' in v_def) = 0
     or position('t2.manba' in v_def) = 0 then
    raise exception 'FAIL bulk writer lost classifier, tenant, idempotency, audit, or import marker behavior';
  end if;
  if position('security definer' in lower(v_def)) = 0 then
    raise exception 'FAIL bulk writer lost SECURITY DEFINER';
  end if;

  select pg_get_functiondef(to_regprocedure(
    'public.t2_smeta_import_yakunla_v1(bigint,bigint,bigint)')) into v_def;
  if position('t2_resurs_kategoriya_import_kat_v1' in v_def) = 0
     or position('t2_smeta_import_ruxsat' in v_def) = 0
     or position('t2_onboarding_command_log' in v_def) = 0
     or position('t2_audit_yoz' in v_def) = 0
     or position('t2.manba' in v_def) = 0 then
    raise exception 'FAIL chunked writer lost classifier, tenant, idempotency, audit, or import marker behavior';
  end if;
  if position('security definer' in lower(v_def)) = 0 then
    raise exception 'FAIL chunked writer lost SECURITY DEFINER';
  end if;
end;
$$;

-- Positive owner-rule cases.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('ВОДА', 'БЕЗСКЛАД'),
      ('ВОДА ТЕХНИЧЕСКАЯ', 'БЕЗСКЛАД'),
      ('SUV', 'БЕЗСКЛАД'),
      ('ｂｅｔｏｎ', 'БЕЗСКЛАД'),
      ('БЕТО́Н', 'БЕЗСКЛАД'),
      ('БЕТОН М-200', 'БЕЗСКЛАД'),
      ('BETON M200', 'БЕЗСКЛАД'),
      ('РАСТВОР ЦЕМЕНТНЫЙ ГОТОВЫЙ', 'БЕЗСКЛАД'),
      ('RASTVOR GOTOVIY', 'БЕЗСКЛАД')
    ) as x(nom, expected)
  loop
    if public.t2_resurs_bozsklad_nomi_v1(r.nom) is distinct from r.expected then
      raise exception 'FAIL positive classifier case % -> %, expected %',
        r.nom, public.t2_resurs_bozsklad_nomi_v1(r.nom), r.expected;
    end if;
  end loop;
end;
$$;

-- Negative storable aggregates/products/dry mortar must not become БЕЗСКЛАД
-- from their names alone.
do $$
declare
  r record;
  v_actual text;
begin
  for r in
    select * from (values
      ('ПЕСОК'),
      ('QUM'),
      ('ЩЕБЕНЬ'),
      ('SHEBEN'),
      ('КВАРЦ'),
      ('KVARS'),
      ('БЕТОННЫЙ БЛОК'),
      ('BETON BLOCK'),
      ('БЕТОННАЯ ПЛИТА'),
      ('BETON PLITA'),
      ('TEMIR BETON'),
      ('BETON HALQA'),
      ('СУХОЙ РАСТВОР'),
      ('СУХАЯ СМЕСЬ RASTVOR'),
      ('РАСТВОР СУХОЙ ЦЕМЕНТНЫЙ')
    ) as x(nom)
  loop
    v_actual := public.t2_resurs_bozsklad_nomi_v1(r.nom);
    if v_actual is not null then
      raise exception 'FAIL negative classifier case % -> %', r.nom, v_actual;
    end if;
  end loop;
end;
$$;

-- Unit precedence, then name classifier, then confirmed registry/fallback.
do $$
declare
  v_kompaniya_id bigint;
  v_nom_key text := public.t2_resurs_nom_kalit('__ACC_BEZSKLAD_REGISTRY__');
  v_birlik_key text := public.t2_resurs_birlik_kalit('М3');
  v_actual text;
begin
  if public.t2_resurs_kategoriya_import_kat_v1(0, 'ВОДА', 'ЧЕЛ-Ч') <> 'ЧЕЛ'
     or public.t2_resurs_kategoriya_import_kat_v1(0, 'SUV', 'МАШ-Ч') <> 'МАШ' then
    raise exception 'FAIL ЧЕЛ/МАШ unit precedence was not preserved';
  end if;
  if public.t2_resurs_kategoriya_import_kat_v1(0, 'SUV', 'М3') <> 'БЕЗСКЛАД' then
    raise exception 'FAIL name classifier did not run after non ЧЕЛ/МАШ unit';
  end if;
  if public.t2_resurs_kategoriya_import_kat_v1(0, '__ACC_UNKNOWN_RESOURCE__', 'М3') <> 'МАТ' then
    raise exception 'FAIL registry/fallback did not retain МАТ fallback';
  end if;

  select min(id) into v_kompaniya_id from public.t2_kompaniya;
  if v_kompaniya_id is null then
    raise exception 'FAIL setup requires one company row to exercise confirmed registry precedence';
  end if;

  insert into public.t2_resurs_kategoriya(kompaniya_id, nom_key, birlik_key, kategoriya)
  values (v_kompaniya_id, v_nom_key, v_birlik_key, 'ОБ');
  v_actual := public.t2_resurs_kategoriya_import_kat_v1(
    v_kompaniya_id, '__ACC_BEZSKLAD_REGISTRY__', 'М3');
  if v_actual <> 'ОБ' then
    raise exception 'FAIL confirmed registry precedence: got %', v_actual;
  end if;
end;
$$;

-- The actual registry CHECK must accept БЕЗСКЛАД and reject an invalid value.
do $$
declare
  v_kompaniya_id bigint;
  v_nom_key text := public.t2_resurs_nom_kalit('__ACC_BEZSKLAD_CONSTRAINT__');
  v_birlik_key text := public.t2_resurs_birlik_kalit('М3');
  v_seen text;
begin
  select min(id) into v_kompaniya_id from public.t2_kompaniya;
  if v_kompaniya_id is null then
    raise exception 'FAIL setup requires one company row for registry constraint acceptance';
  end if;

  insert into public.t2_resurs_kategoriya(kompaniya_id, nom_key, birlik_key, kategoriya)
  values (v_kompaniya_id, v_nom_key, v_birlik_key, 'БЕЗСКЛАД')
  returning kategoriya into v_seen;
  if v_seen <> 'БЕЗСКЛАД' then
    raise exception 'FAIL registry constraint did not preserve БЕЗСКЛАД';
  end if;

  begin
    insert into public.t2_resurs_kategoriya(kompaniya_id, nom_key, birlik_key, kategoriya)
    values (v_kompaniya_id, v_nom_key || '_INVALID', v_birlik_key, '__INVALID__');
    raise exception 'FAIL registry constraint accepted invalid category';
  exception when check_violation then
    null;
  end;
end;
$$;

-- The qator category constraint must be present, validated, and retain the
-- legacy vocabulary alongside БЕЗСКЛАД. The qator DML path is intentionally
-- not guessed here because its base table has other deployment-specific FKs.
do $$
declare
  v_def text;
  v_unvalidated integer;
begin
  select string_agg(pg_get_constraintdef(c.oid), ' ') into v_def
  from pg_constraint c
  where c.conrelid = 'public.t2_qator'::regclass and c.contype = 'c';
  if v_def is null or position('БЕЗСКЛАД' in v_def) = 0
     or position('ЧЕЛ' in v_def) = 0
     or position('МАШ' in v_def) = 0
     or position('МАТ' in v_def) = 0
     or position('ОБ' in v_def) = 0
     or position('М/К' in v_def) = 0
     or position('КАБ' in v_def) = 0 then
    raise exception 'FAIL t2_qator category constraint vocabulary: %', v_def;
  end if;

  select count(*) into v_unvalidated
  from pg_constraint c
  where c.conrelid = 'public.t2_qator'::regclass
    and c.contype = 'c'
    and position('БЕЗСКЛАД' in pg_get_constraintdef(c.oid)) > 0
    and not c.convalidated;
  if v_unvalidated <> 0 then
    raise exception 'FAIL t2_qator БЕЗСКЛАД constraint is not validated';
  end if;
end;
$$;

-- Exercise the real t2_qator CHECK in the same rolled-back acceptance
-- transaction. The fixture only supplies a valid tenant/object FK pair.
do $$
declare
  v_obyekt_id bigint;
  v_kompaniya_id bigint;
  v_good_id bigint;
begin
  select o.id, o.kompaniya_id into v_obyekt_id, v_kompaniya_id
  from public.t2_obyekt o
  order by o.id
  limit 1;
  if v_obyekt_id is null then
    raise exception 'FAIL setup requires one object row for t2_qator constraint acceptance';
  end if;

  perform set_config('t2.manba', 'import', true);
  insert into public.t2_qator(
    obyekt_id, kompaniya_id, tur, nom, birlik, hajm, narx, summa, tartib, daraja, kat
  ) values (
    v_obyekt_id, v_kompaniya_id, 'mat', '__ACC_BEZSKLAD_QATOR__', 'М3', 1, 1, 1, 999999999, 0, 'БЕЗСКЛАД'
  ) returning id into v_good_id;
  if (select kat from public.t2_qator where id = v_good_id) <> 'БЕЗСКЛАД' then
    raise exception 'FAIL t2_qator constraint did not accept БЕЗСКЛАД';
  end if;

  begin
    insert into public.t2_qator(
      obyekt_id, kompaniya_id, tur, nom, birlik, hajm, narx, summa, tartib, daraja, kat
    ) values (
      v_obyekt_id, v_kompaniya_id, 'mat', '__ACC_INVALID_QATOR__', 'М3', 1, 1, 1, 999999998, 0, '__INVALID__'
    );
    raise exception 'FAIL t2_qator constraint accepted invalid category';
  exception when check_violation then
    null;
  end;

  delete from public.t2_qator where id = v_good_id;
end;
$$;

-- Registry and qator write commands remain service-role-only; clients cannot
-- bypass tenant/auth checks by calling the helper or import writers directly.
do $$
declare
  v_fn regprocedure;
begin
  foreach v_fn in array array[
    to_regprocedure('public.t2_resurs_kategoriya_import_kat_v1(bigint,text,text)'),
    to_regprocedure('public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb)'),
    to_regprocedure('public.t2_smeta_import_yakunla_v1(bigint,bigint,bigint)')
  ] loop
    if v_fn is null then
      raise exception 'FAIL required function disappeared';
    end if;
    if has_function_privilege('anon', v_fn, 'execute')
       or has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'FAIL client role can execute protected function %', v_fn;
    end if;
  end loop;
end;
$$;

rollback;

-- Expected terminal marker when run by a harness that prints notices:
-- T2_RESURS_KATEGORIYA_BEZSKLAD_ACCEPTANCE_PASS
