-- T2-Nakrutka-BEZSKLAD-001 acceptance
-- Run after migrations through 20261025090000 in a disposable Supabase DB.
-- No production data is written: the transaction is rolled back.

begin;

do $$
declare
  v_with_bez jsonb;
  v_without_bez jsonb;
begin
  v_with_bez := public.t2_nakrutka_hisobla_v1(
    jsonb_build_object('chel', 0, 'mash', 0, 'mat', 100, 'ob', 0,
                       'bez', 40, 'kab', 0, 'mk', 0),
    jsonb_build_object(
      'ЗТР_СОЦСТРАХ', 0, 'ТРАНСПОРТ_МАТЕРИАЛ', 5,
      'СКЛАДСКИЕ_МАТЕРИАЛ', 2, 'СКЛАДСКИЕ_МК', 0,
      'ТРАНСПОРТ_КАБЕЛЬ', 0, 'ПРОЧИЕ_ПОДРЯДЧИК', 0,
      'ТРАНСПОРТ_ОБОРУД', 0, 'ЗАГОТ_СКЛАД_ОБОРУД', 0,
      'СТРАХОВАНИЕ', 0, 'РИСК', 0, 'НДС', 0));

  v_without_bez := public.t2_nakrutka_hisobla_v1(
    jsonb_build_object('chel', 0, 'mash', 0, 'mat', 100, 'ob', 0,
                       'bez', 0, 'kab', 0, 'mk', 0),
    jsonb_build_object(
      'ЗТР_СОЦСТРАХ', 0, 'ТРАНСПОРТ_МАТЕРИАЛ', 5,
      'СКЛАДСКИЕ_МАТЕРИАЛ', 2, 'СКЛАДСКИЕ_МК', 0,
      'ТРАНСПОРТ_КАБЕЛЬ', 0, 'ПРОЧИЕ_ПОДРЯДЧИК', 0,
      'ТРАНСПОРТ_ОБОРУД', 0, 'ЗАГОТ_СКЛАД_ОБОРУД', 0,
      'СТРАХОВАНИЕ', 0, 'РИСК', 0, 'НДС', 0));

  if (v_with_bez ->> 'tr_mat')::numeric <> 3 then
    raise exception 'FAIL БЕЗСКЛАД is missing from material transport basis: %', v_with_bez;
  end if;
  if (v_with_bez ->> 'skl_mat')::numeric <> 1.2 then
    raise exception 'FAIL БЕЗСКЛАД received warehouse surcharge: %', v_with_bez;
  end if;
  if (v_without_bez ->> 'skl_mat')::numeric <> 2 then
    raise exception 'FAIL control material warehouse surcharge changed: %', v_without_bez;
  end if;
end;
$$;

rollback;
