-- Run together with 20260925120000 + 20260925130000 inside BEGIN/ROLLBACK.
-- It intentionally creates only transaction-local synthetic data.
do $test$
declare
  c bigint;
  u bigint;
  v jsonb;
  suffix text := txid_current()::text;
begin
  insert into public.t2_kompaniya(nom, kod, faol)
  values ('_TEST_NARX_ACCEPT_' || suffix, 'NARXACC' || suffix, true)
  returning id into c;
  insert into public.t2_foydalanuvchi(login, email, holat)
  values ('narx-accept-' || suffix, 'narx-accept-' || suffix || '@example.test', 'faol')
  returning id into u;
  insert into public.t2_azolik(foydalanuvchi_id, kompaniya_id, rol, holat)
  values (u, c, 'pto', 'faol');

  -- Unit wins over a forged client category.
  v := public.t2_narx_belgila('_TEST_NARX_BELGILA_' || suffix, 'МАШ.-Ч', 100, 'МАТ', null, null, 'test', 'narx-accept-' || suffix || '@example.test');
  if (v->>'ok')::boolean is not true or (v->>'versiya')::integer <> 1 then
    raise exception 'NARX_BELGILA_CREATE_FAILED: %', v;
  end if;
  if (select kat from public.t2_narx where id=(v->>'narx_id')::bigint) <> 'МАШ' then
    raise exception 'LOCKED_CATEGORY_FAILED';
  end if;

  v := public.t2_narx_belgila('_TEST_NARX_BELGILA_' || suffix, 'МАШ.-Ч', 101, null, null, 0, 'test', 'narx-accept-' || suffix || '@example.test');
  if v->>'sabab' <> 'STALE_VERSION' then raise exception 'STALE_VERSION_NOT_BLOCKED: %', v; end if;

  v := public.t2_narx_belgila('_TEST_NARX_BELGILA_' || suffix, 'МАШ.-Ч', 101, null, null, 1, 'test', 'narx-accept-' || suffix || '@example.test');
  if (v->>'ok')::boolean is not true or (v->>'eski_narx')::numeric <> 100 or (v->>'yangi_narx')::numeric <> 101 then
    raise exception 'VERSIONED_UPDATE_FAILED: %', v;
  end if;

  v := public.t2_narx_sana_qosh(current_date,
    jsonb_build_array(
      jsonb_build_object('nom','_TEST_NARX_SANA_' || suffix,'birlik','ШТ','narx',99),
      jsonb_build_object('nom','','birlik','ШТ','narx',99),
      jsonb_build_object('nom','_TEST_NARX_ZERO_' || suffix,'birlik','ШТ','narx',0),
      jsonb_build_object('nom','_TEST_NARX_SANA_' || suffix,'birlik','ШТ','narx',100)
    ), 'test', 'narx-accept-' || suffix || '@example.test');
  if (v->>'kirgan')::integer <> 4 or (v->>'yozildi')::integer <> 1
     or (v->>'tashlandi')::integer <> 3 or (v->>'kafolat')::boolean is not true then
    raise exception 'SANA_ACCOUNTING_FAILED: %', v;
  end if;

  v := public.t2_narx_belgila('_TEST_NARX_UNAUTHORIZED_' || suffix, 'ШТ', 10, null, null, null, 'test', 'nobody-' || suffix || '@example.test');
  if v->>'sabab' <> 'ACTOR_MEMBERSHIP_REQUIRED' then
    raise exception 'MEMBERSHIP_NOT_BLOCKED: %', v;
  end if;
end $test$;

select 'T2_NARXLAR_MARKAZI_ACCEPTANCE_PASS' as acceptance;
