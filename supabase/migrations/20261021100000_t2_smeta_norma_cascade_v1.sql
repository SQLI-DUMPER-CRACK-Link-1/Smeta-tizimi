-- T2-SMETA-NORMA-CASCADE-001: haqiqiy hodisa -- T1 (Google Sheets) da LRV
-- fayllarida har bir resurs (ЧЕЛ-Ч va h.k.) o'z ish turiga nisbatan NORMA
-- (birlik uchun sarf normasi) bilan formula orqali bog'langan edi: ish
-- hajmi o'zgarsa, pastidagi resurslar hajmi/summasi AVTOMATIK qayta
-- hisoblanardi. T2 (Postgres) buni yo'qotgan edi ikki joyda:
--
--  1) `t2_qator.norma` ustuni bazada bor edi (eski T1 sinxronizatsiyasidan
--     meros), lekin YANGI native XLSX import yo'li (`smeta-flatten.ts` ->
--     `t2_smeta_import_yakunla_v1` / `t2_smeta_import_bulk_v1`) uni
--     BUTUNLAY tashlab yuborardi -- import qilingan resurs qatori
--     o'zining ish turiga hech qanday formula bilan bog'lanmagan, sodda
--     statik son bo'lib qolardi.
--  2) `t2_qator_tahrir` orqali bir ish (bl) qatorining hajmini
--     o'zgartirganda, faqat O'SHA qatorning o'zi yangilanardi --
--     `t2_rollup` esa faqat PASTDAN YUQORIGA yig'indi qiladi (bolalar
--     summasi otasiga), OTADAN PASTGA hech narsa "quymaydi". Natijada
--     ish hajmini o'zgartirsangiz, ostidagi resurslar hajmi ESKI qolib
--     ketardi.
--
-- Bu migratsiya ikkalasini ham tuzatadi: import endi `norma`ni saqlaydi
-- (FAQAT 'rs' turidagi qatorlarda -- boshqa turlarda `treeBuild.ts`
-- har doim 0 qo'yadi, bu haqiqiy norma emas), va `t2_qator_tahrir` endi
-- hajm o'zgarganda bevosita bolalar orasidagi normasi bor resurslarni
-- avtomatik qayta hisoblaydi (`yangi_hajm = norma * yangi_ota_hajmi`),
-- so'ng `t2_rollup` orqali yuqoriga qayta yig'adi.

begin;

-- ═══ 1) t2_smeta_import_yakunla_v1 -- bo'lakli import, norma saqlaydi ═══
create or replace function public.t2_smeta_import_yakunla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_sessiya_id bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_sessiya public.t2_smeta_import_sessiya; v_prev jsonb; v_soni integer;
begin
  perform public.t2_smeta_import_ruxsat(p_kompaniya_id, p_actor_id);

  select * into v_sessiya from public.t2_smeta_import_sessiya
   where id = p_sessiya_id and kompaniya_id = p_kompaniya_id;
  if not found then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_NOT_FOUND'); end if;

  select natija into v_prev from public.t2_onboarding_command_log where operation_id = v_sessiya.operation_id;
  if found then return v_prev; end if;
  if v_sessiya.holat <> 'ochiq' then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_CLOSED'); end if;

  if not exists (select 1 from public.t2_smeta_import_bolak where sessiya_id = p_sessiya_id) then
    return jsonb_build_object('ok',false,'code','IMPORT_EMPTY');
  end if;
  if exists (select 1 from public.t2_qator where obyekt_id = v_sessiya.obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;

  perform set_config('t2.manba', 'import', true);

  create temporary table t2_imp_qator(
    local_id text primary key, parent_local_id text, tur text, kod text, nom text,
    birlik text, hajm numeric, narx numeric, summa numeric, kat text, norma numeric,
    ordinal integer, new_id bigint, ota_id bigint, daraja integer
  ) on commit drop;

  insert into t2_imp_qator(local_id, parent_local_id, tur, kod, nom, birlik,
                           hajm, narx, summa, kat, norma, ordinal, new_id)
  select x->>'local_id', nullif(x->>'parent_local_id',''), x->>'tur',
         nullif(x->>'kod',''), nullif(x->>'nom',''), nullif(x->>'birlik',''),
         public.t2_son_tez(x->>'hajm'), public.t2_son_tez(x->>'narx'), public.t2_son_tez(x->>'summa'),
         case when (x->>'tur') in ('rs','mat','ob') then
           coalesce((select rk.kategoriya from public.t2_resurs_kategoriya rk
                      where rk.kompaniya_id = p_kompaniya_id
                        and rk.nom_key = public.t2_resurs_nom_kalit(x->>'nom')
                        and rk.birlik_key = public.t2_resurs_birlik_kalit(x->>'birlik')),
                    public.t2_kat_birlik(x->>'birlik', x->>'nom')) end,
         -- Faqat 'rs' qatorida ma'noli; 0/manfiy/bo'sh -- haqiqiy norma emas.
         case when (x->>'tur') = 'rs' and public.t2_son_tez(x->>'norma') > 0
              then public.t2_son_tez(x->>'norma') end,
         (row_number() over (order by b.bolak, t.ordinality))::integer,
         nextval(pg_get_serial_sequence('public.t2_qator','id'))
  from public.t2_smeta_import_bolak b
  cross join lateral jsonb_array_elements(b.qatorlar) with ordinality as t(x, ordinality)
  where b.sessiya_id = p_sessiya_id;

  update t2_imp_qator m set ota_id = p.new_id
    from t2_imp_qator p where p.local_id = m.parent_local_id;

  with recursive d as (
    select local_id, 0 as lvl from t2_imp_qator where parent_local_id is null
    union all
    select r.local_id, d.lvl + 1 from t2_imp_qator r join d on r.parent_local_id = d.local_id
  )
  update t2_imp_qator m set daraja = d.lvl from d where d.local_id = m.local_id;

  insert into public.t2_qator(id, obyekt_id, kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, source_document_id, tartib, daraja, kat, ota_id, norma)
  overriding system value
  select new_id, v_sessiya.obyekt_id, p_kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, v_sessiya.source_document_id, ordinal, coalesce(daraja,0), kat, ota_id, norma
  from t2_imp_qator order by ordinal;

  select count(*) into v_soni from t2_imp_qator;

  update public.t2_smeta_import_sessiya
     set holat = 'yakunlandi', qator_soni = v_soni, yangilandi = now()
   where id = p_sessiya_id;
  delete from public.t2_smeta_import_bolak where sessiya_id = p_sessiya_id;

  if v_soni < 5000 then
    begin
      perform public.t2_signal_refresh_object(p_kompaniya_id, v_sessiya.obyekt_id);
    exception when others then
      raise warning 't2_smeta_import_yakunla_v1: signal refresh failed (non-fatal): %', sqlerrm;
    end;
  end if;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bolakli','smeta',v_sessiya.obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,v_sessiya.source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',v_sessiya.obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (v_sessiya.operation_id, p_actor_id, 'smeta_import_bolakli', v_prev);
  return v_prev;
end $$;

-- ═══ 2) t2_smeta_import_bulk_v1 -- eski bitta-o'tishli import, bir xil ═══
create or replace function public.t2_smeta_import_bulk_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint, p_operation_id uuid,
  p_source_document_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_rol text; v_soni integer;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  if not exists (select 1 from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','OBJECT_ACCESS_DENIED');
  end if;
  if exists (select 1 from public.t2_qator where obyekt_id=p_obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;
  if p_source_document_id is not null and not exists(
      select 1 from public.t2_document_registry d
      where d.id=p_source_document_id and d.kompaniya_id=p_kompaniya_id
        and (d.obyekt_id is null or d.obyekt_id=p_obyekt_id)) then
    return jsonb_build_object('ok',false,'code','SOURCE_DOCUMENT_SCOPE_MISMATCH');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0
     or jsonb_array_length(p_qatorlar) > 60000 then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;

  perform set_config('t2.manba', 'import', true);

  create temporary table t2_imp_qator(
    local_id text primary key, parent_local_id text, tur text, kod text, nom text,
    birlik text, hajm numeric, narx numeric, summa numeric, kat text, norma numeric,
    ordinal integer, new_id bigint, ota_id bigint, daraja integer
  ) on commit drop;

  insert into t2_imp_qator(local_id, parent_local_id, tur, kod, nom, birlik,
                           hajm, narx, summa, kat, norma, ordinal, new_id)
  select x->>'local_id', nullif(x->>'parent_local_id',''), x->>'tur',
         nullif(x->>'kod',''), nullif(x->>'nom',''), nullif(x->>'birlik',''),
         public.t2_son_tez(x->>'hajm'), public.t2_son_tez(x->>'narx'), public.t2_son_tez(x->>'summa'),
         case when (x->>'tur') in ('rs','mat','ob') then
           coalesce((select rk.kategoriya from public.t2_resurs_kategoriya rk
                      where rk.kompaniya_id = p_kompaniya_id
                        and rk.nom_key = public.t2_resurs_nom_kalit(x->>'nom')
                        and rk.birlik_key = public.t2_resurs_birlik_kalit(x->>'birlik')),
                    public.t2_kat_birlik(x->>'birlik', x->>'nom')) end,
         case when (x->>'tur') = 'rs' and public.t2_son_tez(x->>'norma') > 0
              then public.t2_son_tez(x->>'norma') end,
         (ordinality)::integer,
         nextval(pg_get_serial_sequence('public.t2_qator','id'))
  from jsonb_array_elements(p_qatorlar) with ordinality as t(x, ordinality);

  update t2_imp_qator m set ota_id = p.new_id
    from t2_imp_qator p where p.local_id = m.parent_local_id;

  with recursive d as (
    select local_id, 0 as lvl from t2_imp_qator where parent_local_id is null
    union all
    select r.local_id, d.lvl + 1 from t2_imp_qator r join d on r.parent_local_id = d.local_id
  )
  update t2_imp_qator m set daraja = d.lvl from d where d.local_id = m.local_id;

  insert into public.t2_qator(id, obyekt_id, kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, source_document_id, tartib, daraja, kat, ota_id, norma)
  overriding system value
  select new_id, p_obyekt_id, p_kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, p_source_document_id, ordinal, coalesce(daraja,0), kat, ota_id, norma
  from t2_imp_qator order by ordinal;

  select count(*) into v_soni from t2_imp_qator;

  if v_soni < 5000 then
    begin
      perform public.t2_signal_refresh_object(p_kompaniya_id, p_obyekt_id);
    exception when others then
      raise warning 't2_smeta_import_bulk_v1: signal refresh failed (non-fatal): %', sqlerrm;
    end;
  end if;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bulk','smeta',p_obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,p_source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_import_bulk', v_prev);
  return v_prev;
end $$;

-- ═══ 3) t2_qator_tahrir -- hajm o'zgarsa, normasi bor bolalarni ═══
-- ═══    avtomatik qayta hisoblaydi                                ═══
create or replace function public.t2_qator_tahrir(
  p_qator_id bigint, p_maydon text, p_qiymat text, p_kutilgan_versiya integer,
  p_manba text default 'frontend', p_kim text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_q record; v_ver int; v_ob bigint; v_son numeric;
begin
  if p_maydon not in ('nom','hajm','narx','birlik','kat') then
    return jsonb_build_object('ok',false,'sabab','maydon_ruxsat_yoq',
      'xabar','Bu maydonni tahrirlash mumkin emas: '||p_maydon);
  end if;

  select * into v_q from t2_qator where id = p_qator_id;
  if not found then
    return jsonb_build_object('ok',false,'sabab','topilmadi',
      'xabar','Qator topilmadi: '||p_qator_id);
  end if;

  if p_kutilgan_versiya is not null and v_q.versiya <> p_kutilgan_versiya then
    return jsonb_build_object('ok',false,'sabab','ziddiyat',
      'xabar','Bu qatorni boshqa foydalanuvchi o''zgartirdi. Yangilang va qayta urinib ko''ring.',
      'sizning_versiya',p_kutilgan_versiya,'bazadagi_versiya',v_q.versiya,
      'joriy',jsonb_build_object('nom',v_q.nom,'hajm',v_q.hajm,'narx',v_q.narx,
                                 'birlik',v_q.birlik,'kat',v_q.kat));
  end if;

  perform set_config('t2.manba', coalesce(p_manba,'frontend'), true);
  perform set_config('t2.kim',   coalesce(p_kim,''),           true);

  /* Bo'sh matn → NULL (0 EMAS). 0 va «kiritilmagan» boshqa-boshqa:
     narx 0 haqiqiy qiymat bo'lishi mumkin, NULL «topilmadi» degani. */
  if p_maydon in ('hajm','narx') then
    v_son := nullif(btrim(coalesce(p_qiymat,'')),'')::numeric;
  end if;

  /* BITTA update — `summa` shu yerda qayta hisoblanadi */
  update t2_qator set
    nom    = case when p_maydon='nom'    then p_qiymat else nom    end,
    birlik = case when p_maydon='birlik' then p_qiymat else birlik end,
    kat    = case when p_maydon='kat'    then p_qiymat else kat    end,
    hajm   = case when p_maydon='hajm'   then v_son    else hajm   end,
    narx   = case when p_maydon='narx'   then v_son    else narx   end,
    /* ⚡ NARX QO'LDA KIRITILDI — `t2_narxla` bunga tegmaydi.
       Belgisiz qolsa keyingi hisobda tuzatish JIM yo'qolardi. */
    narx_usul = case when p_maydon='narx' then 'QOL' else narx_usul end,
    summa  = case
               when p_maydon not in ('hajm','narx') then summa
               when (case when p_maydon='hajm' then v_son else hajm end) is null
                 or (case when p_maydon='narx' then v_son else narx end) is null
                 then null
               else (case when p_maydon='hajm' then v_son else hajm end)
                  * (case when p_maydon='narx' then v_son else narx end)
             end
  where id = p_qator_id;

  /* T2-SMETA-NORMA-CASCADE-001: ish (yoki har qanday) qatorining hajmi
     o'zgarganda, bevosita bolalari orasida NORMASI BOR resurslarni
     ("Норма на единицу" bilan import qilingan rs qatorlar) avtomatik
     qayta hisoblaymiz -- T1 LRV formulasining o'zi (resurs_hajmi =
     norma * ota_hajmi). Norma yo'q bolalar (mat/ob va norma import
     qilinmagan eski qatorlar) tegilmaydi -- ular T1'da ham mustaqil
     kiritilardi, formula bilan bog'lanmagan edi. */
  if p_maydon = 'hajm' and v_son is not null then
    update t2_qator c set
      hajm = c.norma * v_son,
      summa = case when c.narx is null then null else c.norma * v_son * c.narx end
    where c.ota_id = p_qator_id and c.norma is not null;
  end if;

  select versiya, obyekt_id into v_ver, v_ob from t2_qator where id = p_qator_id;
  perform t2_rollup(v_ob);

  return jsonb_build_object('ok',true,'qator_id',p_qator_id,
    'maydon',p_maydon,'versiya',v_ver);
end $$;

commit;
