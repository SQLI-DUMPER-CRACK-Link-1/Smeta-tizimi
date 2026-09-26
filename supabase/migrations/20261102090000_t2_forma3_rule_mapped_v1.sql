-- PRODUCTION APPLIED ✅ (Supabase MCP apply_migration, project tuoyrzadkgoltpqkdiyx):
--   schema_migrations version = 20260926125938, sana 2026-09-26.
--   Tranzaksiyada test (begin…rollback) — xatosiz; rollback file tayyor.
--   Prod tekshirildi: pg_get_functiondef 'FORMA3_RULE_MAPPED' yozadi, 'UNRESOLVED' yo'q.
--
-- F3 qoidasi — EGA QARORI (2026-09-26, PTO_EGASI_QARORLARI_2026-09-25.md Q1):
--   Jami qoidasi B — nakrutka kaskadi (server t2_nakrutka_hisob_v1 bilan aynan):
--   F3 qatorlari прямые затраты; oxirida nakrutka podvali har pul ustuniga;
--   eng pastki qator «ВСЕГО К ОПЛАТЕ» = ИТОГО-4 × (1+НДС) va u F2 к оплате
--   jamisi bilan bir xil (tiyingacha).
--   Davr ustunlari — FAQAT holat='tasdiqlangan' F2 aktlaridan; qamrov — loyiha
--   (shartnoma) darajasida; avans hozir F3 ga kirmaydi.
--   Hisob-kitobning o'zi frontend hujjat-yozuvchida (lib/forma3-export.ts +
--   lib/nakrutka-podval.ts = server kaskadining JS ko'rinishi) jonli
--   formulalar bilan; bu migratsiya bazada YANGI hisob maydoni/formulasi
--   QO'SHMAYDI — faqat UNRESOLVED guard ni egasining tasdiqlangan qoida
--   manbasi bilan yopadi (FORMA3_RULE_MAPPED) va RPC audit izohini yangilaydi.
--
-- ADDITIVE: faqat create or replace function — hech qanday ustun/jadval
-- o'zgartirilmaydi. Rollback: 20261102090000_t2_forma3_rule_mapped_v1.rollback.sql
-- (eski ta'rif 20260912120000 dan qaytariladi).

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
  -- (egasining qarori: F3 davr ustunlari FAQAT tasdiqlangan F2 dan).
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
     holat, bajarilgan_f2_summa, qoida_holat, qoida_manba, operation_id, actor_id)
  values (v_komp, p_loyiha_id, p_obyekt_id, p_shartnoma_id, p_raqam, p_davr_boshi, p_davr_oxiri,
     'qoralama', v_summa, 'FORMA3_RULE_MAPPED',
     -- EGA TASDIQLAGAN QOIDA MANBAI (2026-09-26, chat) — Q1 javobi ham shuni qayd etadi:
     'EGA_QAROR_B_NAKRUTKA_KASKAD_V1: ВСЕГО К ОПЛАТЕ = nakrutka kaskadi (t2_nakrutka_hisob_v1 bilan aynan: ИТОГО-4 × (1+НДС)); davr ustunlari faqat holat=tasdiqlangan F2 dan; qamrov — loyiha (shartnoma) darajasida; avans kirmaydi; hisob — frontend lib/forma3-export.ts jonli formulalar bilan (tiyingacha nazorat).',
     p_operation_id, p_actor_id)
  returning id into v_id;

  insert into public.t2_forma3_akt (forma3_id, akt_id) select v_id, unnest(p_akt_ids);
  update public.t2_akt set forma3_id = v_id where id = any(p_akt_ids);

  perform public.t2_audit_yoz(v_komp, 'forma3_yarat', 'smeta', p_obyekt_id,
    format('forma3_id=%s davr=%s..%s aktlar=%s f2_summa=%s qoida=EGA_QAROR_B_NAKRUTKA_KASKAD_V1',
           v_id, p_davr_boshi, p_davr_oxiri, v_n, round(v_summa,2)),
    'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'takror',false,'forma3_id',v_id,
    'bajarilgan_f2_summa',v_summa,'aktlar',v_n,
    'qoida_holat','FORMA3_RULE_MAPPED',
    'qoida_manba','EGA_QAROR_B_NAKRUTKA_KASKAD_V1',
    'izoh','F3 jami qoidasi eganing B qarori bilan MAPPED: nakrutka kaskadi, ВСЕГО К ОПЛАТЕ = F2 к оплате jamisi (tiyingacha). Hisob hujjat-yozuvchida (lib/forma3-export.ts) jonli formulalar bilan.');
end $$;

revoke all on function public.t2_forma3_yarat_v1(bigint,bigint,bigint,bigint,date,date,bigint[],text,uuid) from public, anon, authenticated;

comment on function public.t2_forma3_yarat_v1(bigint,bigint,bigint,bigint,date,date,bigint[],text,uuid) is
  'F3 period container — qoida egasining B qarori bilan FORMA3_RULE_MAPPED (EGA_QAROR_B_NAKRUTKA_KASKAD_V1): nakrutka kaskadi, davr ustunlari faqat tasdiqlangan F2 dan; hisob frontend lib/forma3-export.ts jonli formulalar bilan. Bazada alohida hisob maydoni YO''Q (bajarilgan_f2_summa — fakt).';

commit;
