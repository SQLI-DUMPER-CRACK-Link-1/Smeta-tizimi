-- Run after the forward migration inside BEGIN/ROLLBACK only.
do $test$
declare
  c1 bigint;
  c2 bigint;
  a1 bigint;
  a2 bigint;
  o1 bigint;
  o2 bigint;
  q_zero bigint;
  q_price bigint;
  v jsonb;
  op uuid := gen_random_uuid();
begin
  insert into public.t2_kompaniya(nom, kod) values ('_TEST_RES_PRICE_1', 'RSP1' || txid_current()) returning id into c1;
  insert into public.t2_kompaniya(nom, kod) values ('_TEST_RES_PRICE_2', 'RSP2' || txid_current()) returning id into c2;
  insert into public.t2_foydalanuvchi(login) values ('_TEST_RES_PRICE_A1_' || txid_current()) returning id into a1;
  insert into public.t2_foydalanuvchi(login) values ('_TEST_RES_PRICE_A2_' || txid_current()) returning id into a2;
  insert into public.t2_azolik(foydalanuvchi_id, kompaniya_id, rol) values (a1, c1, 'pto'), (a2, c2, 'pto');
  insert into public.t2_obyekt(nom, kompaniya_id) values ('_TEST_RES_PRICE_OBJECT', c1) returning id into o1;
  insert into public.t2_obyekt(nom, kompaniya_id) values ('_TEST_RES_PRICE_OTHER', c2) returning id into o2;
  insert into public.t2_qator(obyekt_id, kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa, tartib)
    values (o1, c1, 'mat', 'B-25', 'Бетон Ё 25', 'м³', 10, 0, 0, 1) returning id into q_zero;
  insert into public.t2_qator(obyekt_id, kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa, tartib)
    values (o1, c1, 'mat', 'B-30', 'Бетон B30', 'м3', 5, 99, 495, 2) returning id into q_price;

  v := public.t2_smeta_narxla_res_v1(c1, a1, o1, op,
    jsonb_build_array(jsonb_build_object('kod', 'b 25', 'nom', ' бетон е 25 ', 'birlik', 'М3', 'narx', 123.45)));
  if (v->>'ok')::boolean is not true or (v->>'yozildi')::integer <> 1 then
    raise exception 'RES_PRICE_WRITE_FAILED: %', v;
  end if;
  if (select narx from public.t2_qator where id=q_zero) <> 123.45
     or (select summa from public.t2_qator where id=q_zero) <> 1234.5 then
    raise exception 'RES_PRICE_VALUE_OR_SUM_FAILED';
  end if;
  if (select narx from public.t2_qator where id=q_price) <> 99 then
    raise exception 'EXISTING_PRICE_OVERWRITTEN';
  end if;

  v := public.t2_smeta_narxla_res_v1(c1, a1, o1, op,
    jsonb_build_array(jsonb_build_object('kod', 'B25', 'nom', 'BETON E 25', 'birlik', 'M3', 'narx', 777)));
  if (v->>'takror')::boolean is not true or (select narx from public.t2_qator where id=q_zero) <> 123.45 then
    raise exception 'OPERATION_ID_NOT_IDEMPOTENT: %', v;
  end if;

  begin
    perform public.t2_smeta_narxla_res_v1(c2, a2, o1, gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('nom', 'Бетон Ё 25', 'birlik', 'м3', 'narx', 1)));
    raise exception 'CROSS_TENANT_NOT_BLOCKED';
  exception when sqlstate '42501' then
    null;
  end;
end $test$;

select 'T2_SMETA_NARXLA_RES_V1_ACCEPTANCE_PASS' as acceptance;
