-- T2-SMETA-RETRY-CLEAR-001: haqiqiy hodisa -- smeta import xato bo'lsa
-- (yoki foydalanuvchi noto'g'ri faylni yuklab qo'ysa) obyektni BO'SH
-- holatga qaytarib qayta yuklashning HECH QANDAY yo'li yo'q edi. Yagona
-- "chiqish" -- butun OBYEKTNI korzinkaga tashlab, yangisini yaratish edi
-- (bu esa T2-OBYEKT-NAME-REUSE-001 hodisasiga olib keldi: "Amfiteatr"
-- o'chirilib, "Amfiteatr2" deb qayta yaratilgan).
--
-- Bu RPC obyektning O'ZINI saqlab qolgan holda uning smeta qatorlarini
-- (t2_qator) tozalaydi, obyektni "bo'sh" holatga qaytaradi -- shu obyektga
-- SmetaYuklaNative.tsx orqali darhol qayta import qilish mumkin bo'ladi.
--
-- Xavfsizlik: agar shu smeta ustida allaqachon FAKT (t2_akt_qator) yoki
-- narx-asos (t2_price_basis_line) yozuvlari mavjud bo'lsa -- ular haqiqiy
-- bajarilgan ish ma'lumotlari, shuning uchun tozalash RAD ETILADI
-- (SMETA_HAS_DEPENDENT_DATA). Ochiq (tugallanmagan) import sessiyalari va
-- ularning bo'laklari ham shu bilan birga tozalanadi, aks holda ular
-- abadiy "osilib" qolaveradi.

begin;

create or replace function public.t2_smeta_tozalash_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev jsonb; v_soni integer;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  perform public.t2_smeta_import_ruxsat(p_kompaniya_id, p_actor_id);

  if not exists (select 1 from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','OBJECT_ACCESS_DENIED');
  end if;

  if exists (
    select 1 from public.t2_akt_qator ak
    join public.t2_qator q on q.id = ak.qator_id
    where q.obyekt_id = p_obyekt_id
  ) then
    return jsonb_build_object('ok',false,'code','SMETA_HAS_DEPENDENT_DATA',
      'xato','Bu smetada allaqachon fakt (bajarilgan ish) yozuvlari bor -- tozalab bo''lmaydi.');
  end if;
  if exists (
    select 1 from public.t2_price_basis_line pl
    join public.t2_qator q on q.id = pl.qator_id
    where q.obyekt_id = p_obyekt_id
  ) then
    return jsonb_build_object('ok',false,'code','SMETA_HAS_DEPENDENT_DATA',
      'xato','Bu smetada allaqachon narx-asos yozuvlari bor -- tozalab bo''lmaydi.');
  end if;

  delete from public.t2_smeta_import_bolak
    where sessiya_id in (select id from public.t2_smeta_import_sessiya where obyekt_id = p_obyekt_id);
  delete from public.t2_smeta_import_sessiya where obyekt_id = p_obyekt_id;

  select count(*) into v_soni from public.t2_qator where obyekt_id = p_obyekt_id;
  delete from public.t2_qator where obyekt_id = p_obyekt_id;

  begin
    perform public.t2_signal_refresh_object(p_kompaniya_id, p_obyekt_id);
  exception when others then
    raise warning 't2_smeta_tozalash_v1: signal refresh failed (non-fatal): %', sqlerrm;
  end;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_tozalash','smeta',p_obyekt_id,
    format('actor_id=%s',p_actor_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'ochirilgan_qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_tozalash', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_smeta_tozalash_v1(bigint,bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.t2_smeta_tozalash_v1(bigint,bigint,bigint,uuid) to service_role;

commit;
