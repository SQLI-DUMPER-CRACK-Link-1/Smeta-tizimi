-- T2_OZGARISH_TASDIQLASH_SIGNAL_BIR_MARTA — o'zgartirishni tasdiqlash tezligi.
--
-- Muammo (2026-09-25, prod tranzaksiya testi, rollback): Amfiteatr (obyekt 6)
-- da bitta ishni (bl, 1 normali resurs) bekor qilishni tasdiqlash 31,7 s —
-- har o'zgargan t2_qator qatori uchun t2_signal_source_trigger butun obyekt
-- signallarini qayta hisoblaydi (norma kaskadi bilan qatorlar ko'payadi).
-- PostgREST sessiya chegarasi (authenticator statement_timeout) 30 s —
-- ya'ni UI dan tasdiqlash yiqilardi. Egasi talabi (ostatka: "bekor qilingan
-- ishlar") shu yo'lga tayanadi.
--
-- Yechim (additiv):
--  1) Trigger tranzaksiya-lokal `t2.signal_kechiktir = 'on'` bayrog'ida
--     t2_qator va uning audit izi t2_ozgarish o'zgarishini o'tkazib yuboradi
--     (import/rollup markerlari kabi). Har qator uchun ikki marta (qator +
--     audit) obyekt signal refresh ~4,6 s edi.
--  2) t2_smeta_ozgarish_tasdiqlash_v2 = bayroq + v1 (o'zgarmagan) + oxirida
--     BITTA t2_signal_refresh_object. Semantika bir xil, signal yakuniy holat
--     bo'yicha bir marta yangilanadi.
-- v1 va boshqa chaqiruvchilar o'zgarmaydi. Rollback: *.rollback.sql.
-- Prod: 2026-09-25 qo'llandi (schema_migrations version 20260925160504).
-- Tranzaksiya testi (rollback): Amfiteatr bl bekor — 31,7 s → 5,0 s, natija bir xil.

begin;

create or replace function public.t2_signal_source_trigger()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_kompaniya_id bigint;
  v_obyekt_id bigint;
  v_manba text := coalesce(nullif(current_setting('t2.manba', true), ''), '');
begin
  -- t2_markirovka, t2_narxla and t2_rollup set this transaction-local marker.
  -- A single explicit refresh follows after the full import pipeline.
  if tg_table_name = 't2_qator'
     and v_manba in ('markirovka', 'narxlash', 'rollup', 'import') then
    return coalesce(new, old);
  end if;
  -- O'zgartirishni tasdiqlash (v2): signal oxirida bir marta yangilanadi.
  -- t2_ozgarish — t2_qator audit izi (t2_ozgarish_qayd), u ham har qatorda
  -- signalni qayta hisoblardi.
  if tg_table_name in ('t2_qator', 't2_ozgarish')
     and coalesce(current_setting('t2.signal_kechiktir', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 't2_obyekt' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_kompaniya_id := (to_jsonb(old)->>'kompaniya_id')::bigint;
    v_obyekt_id := (to_jsonb(old)->>'obyekt_id')::bigint;
  else
    v_kompaniya_id := coalesce((to_jsonb(new)->>'kompaniya_id')::bigint,
                               (to_jsonb(old)->>'kompaniya_id')::bigint);
    v_obyekt_id := coalesce((to_jsonb(new)->>'obyekt_id')::bigint,
                            (to_jsonb(old)->>'obyekt_id')::bigint);
  end if;

  if tg_table_name = 't2_tolov' and v_kompaniya_id is not null then
    perform public.t2_signal_refresh_kompaniya(v_kompaniya_id);
  elsif v_kompaniya_id is not null and v_obyekt_id is not null
    and exists (select 1 from public.t2_obyekt
                where id = v_obyekt_id and kompaniya_id = v_kompaniya_id and holat <> 'bekor') then
    perform public.t2_signal_refresh_object(v_kompaniya_id, v_obyekt_id);
  elsif v_kompaniya_id is not null then
    perform public.t2_signal_refresh_kompaniya(v_kompaniya_id);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create or replace function public.t2_smeta_ozgarish_tasdiqlash_v2(
  p_ozgarish_id bigint, p_actor_id bigint, p_kutilgan_versiya integer, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_res jsonb; v_obyekt bigint; v_komp bigint; v_holat text;
begin
  select obyekt_id, kompaniya_id into v_obyekt, v_komp from public.t2_smeta_ozgarish where id = p_ozgarish_id;
  perform set_config('t2.signal_kechiktir', 'on', true);
  v_res := public.t2_smeta_ozgarish_tasdiqlash_v1(p_ozgarish_id, p_actor_id, p_kutilgan_versiya, p_operation_id);
  perform set_config('t2.signal_kechiktir', '', true);
  if coalesce((v_res->>'ok')::boolean, false) and v_obyekt is not null and v_komp is not null then
    select holat into v_holat from public.t2_obyekt where id = v_obyekt;
    if v_holat is distinct from 'bekor' then
      perform public.t2_signal_refresh_object(v_komp, v_obyekt);
    else
      perform public.t2_signal_refresh_kompaniya(v_komp);
    end if;
  end if;
  return v_res;
end $$;

revoke all on function public.t2_smeta_ozgarish_tasdiqlash_v2(bigint,bigint,integer,uuid) from public, anon, authenticated;

comment on function public.t2_smeta_ozgarish_tasdiqlash_v2(bigint,bigint,integer,uuid) is
  'v1 + signal yangilash oxirida bir marta (t2.signal_kechiktir). PostgREST 30 s chegarasidan o''tmaslik uchun.';

commit;
