-- Rollback: 20261102090000_t2_forma3_rule_mapped_v1.sql
-- t2_forma3_yarat_v1 ni 20260912120000_t2_forma3_closeout_v1.sql dagi eski
-- (UNRESOLVED) ta'rifga qaytaradi. Additive: faqat create or replace function;
-- jadval/ustun o'zgarmagan, ma'lumot yo'qolmaydi. Eski yozuvlar
-- FORMA3_RULE_MAPPED qoida_holat bilan qoladi (check constraint ikkala qiymatni
-- ham qabul qiladi) — ularni UNRESOLVED ga qaytarish qo'lda (kerak bo'lsa):
--   update public.t2_forma3 set qoida_holat='FORMA3_RULE_UNRESOLVED', qoida_manba=null
--    where qoida_manba like 'EGA_QAROR_B_NAKRUTKA_KASKAD_V1:%';

begin;

create or replace function public.t2_forma3_yarat_v1(
  p_actor_id bigint, p_loyiha_id bigint, p_obyekt_id bigint, p_shartnoma_id bigint,
  p_davr_boshi date, p_davr_oxiri date, p_akt_ids bigint[], p_raqam text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_rol text; v_id bigint; v_summa numeric := 0; v_n integer := 0;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select id into v_id from public.t2_forma3 where operation_id = p_operation_id;
  if found then return jsonb_build_object('ok',true,'takror',true,'forma3_id',v_id); end if;

  if p_loyiha_id is not null then
    select kompaniya_id into v_komp from public.t2_loyiha where id = p_loyiha_id;
  elsif p_obyekt_id is not null then
    select kompaniya_id, loyiha_id into v_komp, p_loyiha_id from public.t2_obyekt where id = p_obyekt_id;
  end if;
  if v_komp is null then return jsonb_build_object('ok',false,'code','SCOPE_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
  if v_rol not in ('boss','superadmin','rahbar','bugalter') then
    return jsonb_build_object('ok',false,'code','FORMA3_DENIED');
  end if;
  if p_akt_ids is null or array_length(p_akt_ids,1) is null then
    return jsonb_build_object('ok',false,'code','FORMA3_AKT_REQUIRED');
  end if;
  -- every linked act must be an APPROVED F2 in scope + in the period
  if exists (
    select 1 from unnest(p_akt_ids) aid
    left join public.t2_akt a on a.id = aid
    where a.id is null or a.tur <> 'f2' or a.holat <> 'tasdiqlangan'
       or a.kompaniya_id <> v_komp
       or (p_obyekt_id is not null and a.obyekt_id <> p_obyekt_id)
       or a.oy < date_trunc('month', p_davr_boshi) or a.oy > date_trunc('month', p_davr_oxiri)
  ) then
    return jsonb_build_object('ok',false,'code','FORMA3_AKT_INVALID',
      'xato','Har akt: tasdiqlangan Ф2, shu scope va davr ichida bo''lishi kerak');
  end if;

  select coalesce(sum(aq.summa),0), count(distinct a.id)
    into v_summa, v_n
  from public.t2_akt a join public.t2_akt_qator aq on aq.akt_id = a.id
  where a.id = any(p_akt_ids);

  insert into public.t2_forma3
    (kompaniya_id, loyiha_id, obyekt_id, shartnoma_id, raqam, davr_boshi, davr_oxiri,
     holat, bajarilgan_f2_summa, qoida_holat, operation_id, actor_id)
  values (v_komp, p_loyiha_id, p_obyekt_id, p_shartnoma_id, p_raqam, p_davr_boshi, p_davr_oxiri,
     'qoralama', v_summa, 'FORMA3_RULE_UNRESOLVED', p_operation_id, p_actor_id)
  returning id into v_id;

  insert into public.t2_forma3_akt (forma3_id, akt_id) select v_id, unnest(p_akt_ids);
  update public.t2_akt set forma3_id = v_id where id = any(p_akt_ids);

  perform public.t2_audit_yoz(v_komp, 'forma3_yarat', 'smeta', p_obyekt_id,
    format('forma3_id=%s davr=%s..%s aktlar=%s f2_summa=%s', v_id, p_davr_boshi, p_davr_oxiri, v_n, round(v_summa,2)),
    'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'takror',false,'forma3_id',v_id,
    'bajarilgan_f2_summa',v_summa,'aktlar',v_n,
    'qoida_holat','FORMA3_RULE_UNRESOLVED',
    'izoh','Forma-3 qonuniy jami/soliq/to''lov HISOBLANMADI — qoida manbai aniqlanmagan.');
end $$;

revoke all on function public.t2_forma3_yarat_v1(bigint,bigint,bigint,bigint,date,date,bigint[],text,uuid) from public, anon, authenticated;

comment on function public.t2_forma3_yarat_v1(bigint,bigint,bigint,bigint,date,date,bigint[],text,uuid) is
  'SMETA/F2 CONTROL: Forma-3 period certificate creation — UNRESOLVED legal boundary (pre-MAPPED rollback state).';

commit;
