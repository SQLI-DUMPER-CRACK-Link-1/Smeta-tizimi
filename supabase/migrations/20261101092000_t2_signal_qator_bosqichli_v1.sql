-- T2_SIGNAL_QATOR_BOSQICHLI_V1 — signallar faqat O'ZGARGAN qator bo'yicha.
--
-- Egasi (2026-09-25, 8-band): "Amfiteatrda topgan muammoyingni bajar va buni
-- tizimli darajada birinchi o'rinda hal qilib ber."
--
-- Muammo (prod o'lchovi, tranzaksiya + rollback): t2_signal_source_trigger
-- BITTA t2_qator o'zgarishida butun obyektni qayta hisoblardi
-- (t2_signal_refresh_object): obyektning HAR qatori uchun 2 ta producer
-- chaqiruvi (Amfiteatr: 10 537 × 2) + obyektning BUTUN audit izi
-- (t2_ozgarish, hozir 75 243 qator va har tahrirda o'sadi) + taminot,
-- grafik, hujjat turlari. Har qator tahriri audit yozadi (t2_ozgarish_qayd) —
-- u ham triggerni chaqiradi: bitta tahrir = 2 × ~4,6 s. t2_tolov o'zgarishi
-- esa BUTUN kompaniyani (hamma obyektlar) qayta hisoblardi.
--
-- Yechim: trigger faqat o'zgargan yozuvning o'z signalini yangilaydi (O(1)).
-- Predikatlar t2_signal_refresh_object / _kompaniya dagi bilan AYNAN bir xil
-- (bir xil operation_id: md5(kompaniya, signal_type, manba, manba_id)), shuning
-- uchun natija to'liq refresh bilan bir xil. To'liq refresh funksiyalari
-- o'zgarmaydi (import konveyeri va qo'lda tekshiruv uchun qoladi); import
-- markerlari va t2.signal_kechiktir bayrog'i ham saqlanadi.
-- Rollback: *.rollback.sql (20261101091000 dagi trigger funksiyasi).
-- Prod: 2026-09-25 qo'llandi (version 20260925173506). Tranzaksiya testi: tahrir
-- ~10 s → 0,28 s; bosqichli natija to'liq refresh bilan aynan bir xil (917 = 917, md5 teng).

begin;

-- Smeta qatori: missing_price + data_quality (refresh_object dagi predikatlar).
create or replace function public.t2_signal_qator_yangila(
  p_kompaniya_id bigint, p_obyekt_id bigint, p_qator_id bigint,
  p_nom text, p_tur text, p_narx numeric, p_birlik text, p_hajm numeric, p_bor boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.t2_signal_producer_apply(
    p_kompaniya_id, 'obyekt', p_obyekt_id::text, 'missing_price', 'warning',
    coalesce(p_nom, 'Smeta qatorida narx yo''q'), 't2_qator', p_qator_id::text,
    p_bor and p_tur in ('rs','mat','ob') and p_narx is null,
    jsonb_build_object('qator_id', p_qator_id, 'tur', p_tur), null);
  perform public.t2_signal_producer_apply(
    p_kompaniya_id, 'obyekt', p_obyekt_id::text, 'data_quality', 'error',
    'Smeta qatori metadata/miqdor tekshiruvdan o''tmadi', 't2_qator', p_qator_id::text,
    p_bor and (p_nom is null or p_birlik is null or p_hajm is null or p_hajm < 0 or p_narx < 0),
    jsonb_build_object('qator_id', p_qator_id, 'nom_missing', p_nom is null,
                       'birlik_missing', p_birlik is null, 'hajm', p_hajm, 'narx', p_narx), null);
end $$;

-- Obyekt darajasidagi yengil signallar (hujjat turlari, grafik, taminot) —
-- refresh_object dagi predikatlar, og'ir qator/audit sikllarisiz. Eski yo'lda
-- bular har qator tahririda yon ta'sir sifatida yangilanardi (vaqtga bog'liq
-- schedule_delay ham) — endi tranzaksiyada obyekt bo'yicha BIR MARTA.
create or replace function public.t2_signal_obyekt_yengil(p_kompaniya_id bigint, p_obyekt_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;
begin
  for r in select ht.kod, ht.nom from public.t2_hujjat_turi ht loop
    perform public.t2_signal_producer_apply(
      p_kompaniya_id,'obyekt',p_obyekt_id::text,'document_missing','warning',
      coalesce(r.nom,'Majburiy hujjat yo''q'),'t2_hujjat_turi',r.kod,
      not exists (select 1 from public.t2_obyekt_hujjat h
                  where h.kompaniya_id=p_kompaniya_id and h.obyekt_id=p_obyekt_id
                    and h.turi=r.kod and h.holat <> 'bekor'),
      jsonb_build_object('turi',r.kod),null);
  end loop;
  for r in select g.id,g.nom,g.tugash_sana,g.ish_holati,g.faol from public.t2_grafik_qator g
           where g.kompaniya_id=p_kompaniya_id and g.obyekt_id=p_obyekt_id loop
    perform public.t2_signal_producer_apply(
      p_kompaniya_id,'obyekt',p_obyekt_id::text,'schedule_delay','warning',
      coalesce(r.nom,'Grafik muddati kechikdi'),'t2_grafik_qator',r.id::text,
      r.faol and r.tugash_sana is not null and r.tugash_sana < current_date
        and r.ish_holati <> 'bajarildi',
      jsonb_build_object('tugash_sana',r.tugash_sana,'ish_holati',r.ish_holati),r.tugash_sana::timestamptz);
  end loop;
  for r in select z.id,z.item_text,z.status,z.required_date from public.t2_erp_taminot z
           where z.kompaniya_id=p_kompaniya_id and z.obyekt_id=p_obyekt_id loop
    perform public.t2_signal_producer_apply(
      p_kompaniya_id,'obyekt',p_obyekt_id::text,'open_request','info',
      coalesce(r.item_text,'Ochiq ta''minot zayavkasi'),'t2_erp_taminot',r.id::text,
      r.status in ('submitted','approved','procurement','ordered','partially_delivered'),
      jsonb_build_object('request_id',r.id,'status',r.status),r.required_date::timestamptz);
  end loop;
end $$;

create or replace function public.t2_signal_source_trigger()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_manba text := coalesce(nullif(current_setting('t2.manba', true), ''), '');
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_bor boolean := tg_op <> 'DELETE';
  v_komp bigint := (v_row->>'kompaniya_id')::bigint;
  v_obyekt bigint := (v_row->>'obyekt_id')::bigint;
  v_faol boolean;
  v_nom text;
begin
  -- t2_markirovka, t2_narxla va t2_rollup shu tranzaksiya markerini qo'yadi;
  -- import konveyeridan keyin bitta aniq to'liq refresh bo'ladi.
  if tg_table_name = 't2_qator'
     and v_manba in ('markirovka', 'narxlash', 'rollup', 'import') then
    return coalesce(new, old);
  end if;
  -- O'zgartirishni tasdiqlash (v2): oxirida bitta aniq refresh.
  if tg_table_name in ('t2_qator', 't2_ozgarish')
     and coalesce(current_setting('t2.signal_kechiktir', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_table_name = 't2_obyekt' or v_komp is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 't2_tolov' then
    -- refresh_kompaniya dagi payment_overdue predikati, faqat shu to'lov.
    perform public.t2_signal_producer_apply(
      v_komp, case when (v_row->>'obyekt_id') is null then 'shartnoma' else 'obyekt' end,
      coalesce(v_row->>'obyekt_id', 'shartnoma:' || (v_row->>'shartnoma_id')), 'payment_overdue', 'error',
      'Tasdiqlangan to''lov muddati o''tgan', 't2_tolov', v_row->>'id',
      v_bor and (v_row->>'holat') in ('kutilmoqda','approved','tasdiqlandi') and (v_row->>'sana')::date < current_date,
      jsonb_build_object('tolov_id', (v_row->>'id')::bigint, 'sana', (v_row->>'sana')::date, 'holat', v_row->>'holat'),
      (v_row->>'sana')::timestamptz);
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if v_obyekt is null then return coalesce(new, old); end if;
  -- refresh_object bekor obyektni o'tkazib yuboradi — shu yerda ham.
  select (o.holat <> 'bekor') into v_faol from public.t2_obyekt o
   where o.id = v_obyekt and o.kompaniya_id = v_komp;
  if not coalesce(v_faol, false) then return coalesce(new, old); end if;

  if tg_table_name = 't2_qator' then
    -- Obyekt yengil signallari — tranzaksiyada obyekt bo'yicha bir marta.
    if position(',' || v_obyekt::text || ',' in ',' || coalesce(current_setting('t2.signal_yengil', true), '') || ',') = 0 then
      perform public.t2_signal_obyekt_yengil(v_komp, v_obyekt);
      perform set_config('t2.signal_yengil', coalesce(nullif(current_setting('t2.signal_yengil', true), ''), '') || ',' || v_obyekt::text, true);
    end if;
    perform public.t2_signal_qator_yangila(v_komp, v_obyekt, (v_row->>'id')::bigint,
      v_row->>'nom', v_row->>'tur', (v_row->>'narx')::numeric, v_row->>'birlik', (v_row->>'hajm')::numeric, v_bor);
  elsif tg_table_name = 't2_ozgarish' then
    perform public.t2_signal_producer_apply(
      v_komp, 'obyekt', v_obyekt::text, 'mirror_conflict', 'error',
      'Ko''zgu va manba o''rtasida ziddiyat', 't2_ozgarish', v_row->>'id',
      v_bor and coalesce((v_row->>'ziddiyat')::boolean, false),
      jsonb_build_object('maydon', v_row->>'maydon', 'izoh', v_row->>'izoh'), null);
  elsif tg_table_name = 't2_erp_taminot' then
    perform public.t2_signal_producer_apply(
      v_komp, 'obyekt', v_obyekt::text, 'open_request', 'info',
      coalesce(v_row->>'item_text', 'Ochiq ta''minot zayavkasi'), 't2_erp_taminot', v_row->>'id',
      v_bor and (v_row->>'status') in ('submitted','approved','procurement','ordered','partially_delivered'),
      jsonb_build_object('request_id', (v_row->>'id')::bigint, 'status', v_row->>'status'),
      (v_row->>'required_date')::timestamptz);
  elsif tg_table_name = 't2_grafik_qator' then
    perform public.t2_signal_producer_apply(
      v_komp, 'obyekt', v_obyekt::text, 'schedule_delay', 'warning',
      coalesce(v_row->>'nom', 'Grafik muddati kechikdi'), 't2_grafik_qator', v_row->>'id',
      v_bor and coalesce((v_row->>'faol')::boolean, false) and (v_row->>'tugash_sana') is not null
        and (v_row->>'tugash_sana')::date < current_date and (v_row->>'ish_holati') is distinct from 'bajarildi',
      jsonb_build_object('tugash_sana', (v_row->>'tugash_sana')::date, 'ish_holati', v_row->>'ish_holati'),
      (v_row->>'tugash_sana')::timestamptz);
  elsif tg_table_name = 't2_obyekt_hujjat' then
    -- document_missing — faqat shu hujjat turi (tur o'zgarsa — eskisi ham).
    for v_nom in select distinct t from unnest(array[v_row->>'turi',
                   case when tg_op = 'UPDATE' then to_jsonb(old)->>'turi' end]) t where t is not null loop
      perform public.t2_signal_producer_apply(
        v_komp, 'obyekt', v_obyekt::text, 'document_missing', 'warning',
        coalesce(ht.nom, 'Majburiy hujjat yo''q'), 't2_hujjat_turi', ht.kod,
        not exists (select 1 from public.t2_obyekt_hujjat h
                    where h.kompaniya_id = v_komp and h.obyekt_id = v_obyekt
                      and h.turi = ht.kod and h.holat <> 'bekor'),
        jsonb_build_object('turi', ht.kod), null)
      from public.t2_hujjat_turi ht where ht.kod = v_nom;
    end loop;
  else
    perform public.t2_signal_refresh_object(v_komp, v_obyekt);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function public.t2_signal_qator_yangila(bigint,bigint,bigint,text,text,numeric,text,numeric,boolean) from public, anon, authenticated;
revoke all on function public.t2_signal_obyekt_yengil(bigint,bigint) from public, anon, authenticated;

comment on function public.t2_signal_source_trigger() is
  'Bosqichli signal: faqat o''zgargan yozuv (O(1)). To''liq refresh — t2_signal_refresh_object/_kompaniya (import konveyeri). 20261101092000.';

commit;
