-- T2-OBYEKT-NAME-REUSE-001: haqiqiy hodisa (2026-09-08) -- foydalanuvchi
-- "Amfiteatr" obyektini yukladi, import xato bo'lgani uchun obyektni
-- korzinkaga tashladi (t2_korzinkaga_tashlash -> holat='bekor'), keyin
-- xuddi shu nom bilan qayta obyekt yaratmoqchi bo'lganda muvaffaqiyatsiz
-- bo'lib, "Amfiteatr2" deb nomlashga majbur bo'ldi.
--
-- ILDIZ SABAB: `t2_obyekt_komp_nom_uniq UNIQUE (kompaniya_id, nom)` HAR
-- QANDAY holatdagi (shu jumladan 'bekor' -- korzinkadagi) qatorni ham
-- hisobga oladi. Korzinkaga tashlash `holat`ni o'zgartiradi, nomni
-- BO'SHATMAYDI -- shuning uchun o'chirilgan obyekt nomi ABADIY band bo'lib
-- qolaveradi. Bundan tashqari `t2_obyekt_yarat_v1` bu unique_violation'ni
-- ushlamas edi -- xom `23505` PostgREST orqali chiqib, `xato.ts`dagi
-- xavfsizKod() uni umumiy CONFLICT ("Ma'lumot boshqa joyda o'zgargan --
-- sahifani yangilang") deb noto'g'ri tarjima qilardi, foydalanuvchiga
-- muammoning haqiqiy sababini (nom band) hech qachon ko'rsatmasdan.
--
-- TUZATISH:
--  1) Unique indeksni PARTIAL qilib, faqat 'bekor' BO'LMAGAN (faol)
--     qatorlarga tegishli qilamiz -- korzinkaga tashlangan nom darhol
--     qayta ishlatilishi mumkin bo'ladi.
--  2) `t2_obyekt_yarat_v1`ga aniq oldindan tekshiruv qo'shamiz: agar
--     shu kompaniyada FAOL (bekor emas) obyekt xuddi shu nom bilan
--     mavjud bo'lsa, xom SQL xatosi o'rniga tushunarli
--     `{ok:false, code:'OBYEKT_NOM_MAVJUD', xato:'...'}` qaytaradi.

begin;

drop index if exists public.t2_obyekt_komp_nom_uniq;
create unique index t2_obyekt_komp_nom_uniq
  on public.t2_obyekt (kompaniya_id, nom)
  where holat <> 'bekor';

create or replace function public.t2_obyekt_yarat_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_loyiha_id bigint,
  p_nom text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev jsonb; v_rol text; v_obyekt public.t2_obyekt; v_nom text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  v_nom := nullif(btrim(p_nom),'');
  if v_nom is null then
    return jsonb_build_object('ok',false,'code','OBYEKT_NOM_REQUIRED');
  end if;
  if p_loyiha_id is not null and not exists(
      select 1 from public.t2_loyiha where id=p_loyiha_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','PROJECT_COMPANY_MISMATCH');
  end if;

  if exists(
      select 1 from public.t2_obyekt
      where kompaniya_id = p_kompaniya_id and nom = v_nom and holat <> 'bekor') then
    return jsonb_build_object('ok',false,'code','OBYEKT_NOM_MAVJUD',
      'xato', format('"%s" nomli obyekt allaqachon mavjud. Boshqa nom tanlang.', v_nom));
  end if;

  begin
    insert into public.t2_obyekt(nom, tur, kompaniya_id, loyiha_id, storage_status, operation_id)
      values (v_nom, 'obyekt', p_kompaniya_id, p_loyiha_id, 'ready', p_operation_id)
      returning * into v_obyekt;
  exception when unique_violation then
    return jsonb_build_object('ok',false,'code','OBYEKT_NOM_MAVJUD',
      'xato', format('"%s" nomli obyekt allaqachon mavjud. Boshqa nom tanlang.', v_nom));
  end;

  perform public.t2_audit_yoz(p_kompaniya_id,'obyekt_yarat','obyekt',v_obyekt.id,
    format('nom=%s; loyiha_id=%s; actor_id=%s',v_obyekt.nom,p_loyiha_id,p_actor_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',v_obyekt.id,'nom',v_obyekt.nom,'loyiha_id',v_obyekt.loyiha_id,'versiya',v_obyekt.versiya);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'obyekt_yarat', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_obyekt_yarat_v1(bigint,bigint,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.t2_obyekt_yarat_v1(bigint,bigint,bigint,text,uuid) to service_role;

commit;
