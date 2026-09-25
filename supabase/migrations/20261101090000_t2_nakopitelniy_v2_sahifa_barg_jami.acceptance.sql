-- ACCEPTANCE T2_NAKOPITELNIY_V2 (prod 2026-09-25 tranzaksiyada tekshirildi:
-- Amfiteatr smeta_summa 43 596 859 620,62, smeta_nakrutka.vsego 56 623 606 614,37;
-- Suniy Ko'l 27 309 qator 6 sahifada, ~2,9 s).
do $$
declare a bigint; r jsonb; n int := 0; off int := 0; sahifa int := 0; ob bigint; jami int;
begin
  -- Har obyekt uchun: barg jami = revision uslubi, sahifalash to'liq va takrorsiz.
  for ob in select o.id from public.t2_obyekt o where exists (select 1 from public.t2_qator q where q.obyekt_id=o.id) loop
    select az.foydalanuvchi_id into a from public.t2_azolik az join public.t2_obyekt o on o.kompaniya_id=az.kompaniya_id
      where o.id=ob and az.holat='faol' limit 1;
    continue when a is null;
    n := 0; off := 0; sahifa := 0;
    loop
      r := public.t2_nakopitelniy_v2(ob, a, null, 5000, false, off);
      if sahifa = 0 and (r->'jami'->>'smeta_summa')::numeric <>
         (select coalesce(sum(summa),0) from public.t2_qator where obyekt_id=ob and tur in ('rs','mat','ob')) then
        raise exception 'QABUL XATO: obyekt % smeta_summa barg jamiga teng emas', ob;
      end if;
      sahifa := sahifa + 1; n := n + jsonb_array_length(r->'qatorlar');
      exit when r->>'keyingi_offset' is null;
      off := (r->>'keyingi_offset')::int;
    end loop;
    select count(*) into jami from public.t2_qator where obyekt_id=ob;
    if n <> jami then raise exception 'QABUL XATO: obyekt % sahifalab % qator, bazada %', ob, n, jami; end if;
  end loop;
  raise notice 'T2_NAKOPITELNIY_V2_ACCEPTANCE_PASS';
end $$;
