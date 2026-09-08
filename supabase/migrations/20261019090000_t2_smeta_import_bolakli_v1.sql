-- T2-SMETA-IMPORT-50K-003 -- "kamida 50 000 qatorli smetalarga ham ishlashi
-- kerak" (egasining talabi). Ikki alohida to'siq bor edi, ikkalasi ham
-- shu migratsiyada olib tashlanadi.
--
-- ================= 1-TO'SIQ: uch marta yozish =================
-- `t2_smeta_import_bulk_v1` bitta smetani bazaga UCH marta yozardi:
--   (a) insert  -> t2_qator ga N qator
--   (b) update  -> har qatorning ota_id si (yana N qator qayta yoziladi)
--   (c) update  -> har qatorning daraja si (yana N qator qayta yoziladi)
-- Postgres'da UPDATE = yangi qator versiyasi + 10 ta indeksni yangilash +
-- trigger dispatch. Ya'ni 50 000 qatorli smeta amalda 150 000 marta
-- yozilardi. O'lchandi: 22 000 qator = 11.2s, ya'ni 50 000 qator ~26s+
-- (30s chegarasiga urilib, yana 57014).
--
-- YECHIM: ota_id va daraja BAZAGA YOZISHDAN OLDIN hisoblanadi.
-- id lar identity ketma-ketligidan oldindan olinadi (nextval), ota_id
-- local_id -> new_id xaritasi orqali, daraja esa rekursiv CTE bilan --
-- hammasi VAQTINCHA jadvalda (indekssiz, triggersiz, WAL'siz). Keyin
-- t2_qator ga BITTA insert. O'lchandi, xuddi shu 50 500 qatorli yuk uchun:
--   tahlil=2517ms  ota_id=345ms  daraja=820ms  insert=8247ms  JAMI=11929ms
-- ya'ni 26s+ dan 11.9s ga tushdi, 30s budjetida 2.5 barobar zaxira bilan.
--
-- ================= 2-TO'SIQ: bitta ulkan so'rov =================
-- 50 000 qator = ~10 MB JSON. U brauzerdan Cloudflare Pages Function ga,
-- undan PostgREST ga bitta so'rovda ketardi. Pages Function izolyati 128 MB
-- xotira bilan cheklangan -- 10 MB JSON ni parse qilib, flatten qilib,
-- qayta stringify qilish o'sha chegaraga urilib ketishi mumkin (va bu
-- xatolik 57014 emas, umuman tushunarsiz uzilish bo'lardi).
--
-- YECHIM: BO'LAKLI import. Klient qatorlarni bo'laklab (masalan 4000 tadan)
-- yuboradi, ular `t2_smeta_import_bolak` ga to'planadi, oxirida bitta
-- `yakunla` chaqiruvi hammasini birdaniga t2_qator ga yozadi. Har bir
-- so'rov kichik va tez -- na xotira, na timeout to'sig'i qoladi. Qo'shimcha
-- foyda: foydalanuvchi haqiqiy jarayonni ko'radi ("3/13 bo'lak yuborildi").
--
-- Idempotentlik: sessiya `operation_id` bo'yicha yagona; bo'lak (sessiya,
-- raqam) bo'yicha yagona va qayta yuborilsa ustiga yoziladi; yakunlash
-- natijasi `t2_onboarding_command_log` ga yoziladi. Tarmoq uzilib qayta
-- urinilsa ikkinchi smeta paydo bo'lmaydi.

begin;

-- ── Tez son: klient yuborgan qiymatlar deyarli doim toza raqam ("4.6928"),
--    shuning uchun avval arzon regex + cast, faqat "iflos" qiymat uchun
--    plpgsql t2_son. 50 000 qatorda bu 150 000 plpgsql chaqiruvini
--    yo'q qiladi.
create or replace function public.t2_son_tez(v text)
returns numeric language sql immutable parallel safe set search_path=public as $$
  select case
    when v is null then null
    when v ~ '^-?[0-9]+(\.[0-9]+)?$' then v::numeric
    else public.t2_son(v)
  end
$$;

-- ── Bo'lakli import sessiyasi ───────────────────────────────────────
create table if not exists public.t2_smeta_import_sessiya (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  obyekt_id bigint not null references public.t2_obyekt(id) on delete cascade,
  actor_id bigint not null,
  operation_id uuid not null unique,
  source_document_id bigint,
  holat text not null default 'ochiq' check (holat in ('ochiq','yakunlandi')),
  qator_soni integer not null default 0,
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now()
);
create index if not exists t2_smeta_import_sessiya_obyekt_idx
  on public.t2_smeta_import_sessiya(obyekt_id, holat);

create table if not exists public.t2_smeta_import_bolak (
  sessiya_id bigint not null references public.t2_smeta_import_sessiya(id) on delete cascade,
  bolak integer not null,
  qatorlar jsonb not null,
  qator_soni integer not null,
  yozildi timestamptz not null default now(),
  primary key (sessiya_id, bolak)
);

-- Bu jadvallar FAQAT quyidagi SECURITY DEFINER RPC'lar orqali ishlatiladi.
-- RLS yoqilgan, siyosat yo'q => anon/authenticated uchun to'liq yopiq.
alter table public.t2_smeta_import_sessiya enable row level security;
alter table public.t2_smeta_import_bolak enable row level security;

-- ── Umumiy yordamchi: sessiya uchun kirish tekshiruvi ───────────────
create or replace function public.t2_smeta_import_ruxsat(
  p_kompaniya_id bigint, p_actor_id bigint)
returns void language plpgsql security definer set search_path=public, pg_temp as $$
declare v_rol text;
begin
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;
end $$;

-- ── 1) BOSHLA ───────────────────────────────────────────────────────
create or replace function public.t2_smeta_import_boshla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint,
  p_operation_id uuid, p_source_document_id bigint default null)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare v_prev jsonb; v_sessiya public.t2_smeta_import_sessiya;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform public.t2_smeta_import_ruxsat(p_kompaniya_id, p_actor_id);

  -- Allaqachon yakunlangan bo'lsa -- o'sha natijani qaytaramiz (idempotent).
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  -- Qayta urinish: shu operation_id bilan ochiq sessiya bormi?
  select * into v_sessiya from public.t2_smeta_import_sessiya where operation_id = p_operation_id;
  if found then
    return jsonb_build_object('ok',true,'sessiya_id',v_sessiya.id,'takror',true,
                              'bolak_soni',(select count(*) from public.t2_smeta_import_bolak b where b.sessiya_id=v_sessiya.id));
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

  insert into public.t2_smeta_import_sessiya(kompaniya_id, obyekt_id, actor_id, operation_id, source_document_id)
  values (p_kompaniya_id, p_obyekt_id, p_actor_id, p_operation_id, p_source_document_id)
  returning * into v_sessiya;

  return jsonb_build_object('ok',true,'sessiya_id',v_sessiya.id,'takror',false,'bolak_soni',0);
end $$;

-- ── 2) BO'LAK ───────────────────────────────────────────────────────
create or replace function public.t2_smeta_import_bolak_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_sessiya_id bigint,
  p_bolak integer, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare v_sessiya public.t2_smeta_import_sessiya; v_n integer; v_jami integer;
begin
  perform public.t2_smeta_import_ruxsat(p_kompaniya_id, p_actor_id);

  select * into v_sessiya from public.t2_smeta_import_sessiya
   where id = p_sessiya_id and kompaniya_id = p_kompaniya_id;
  if not found then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_NOT_FOUND'); end if;
  if v_sessiya.holat <> 'ochiq' then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_CLOSED'); end if;

  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;
  v_n := jsonb_array_length(p_qatorlar);
  if v_n = 0 or v_n > 10000 then return jsonb_build_object('ok',false,'code','BAD_CHUNK_SIZE'); end if;
  if p_bolak is null or p_bolak < 0 then return jsonb_build_object('ok',false,'code','BAD_CHUNK_INDEX'); end if;

  -- Qayta yuborilgan bo'lak ustiga yoziladi (tarmoq uzilishida takror
  -- yuborish ikkinchi nusxa yaratmasin).
  insert into public.t2_smeta_import_bolak(sessiya_id, bolak, qatorlar, qator_soni)
  values (p_sessiya_id, p_bolak, p_qatorlar, v_n)
  on conflict (sessiya_id, bolak) do update
    set qatorlar = excluded.qatorlar, qator_soni = excluded.qator_soni, yozildi = now();

  select coalesce(sum(qator_soni),0) into v_jami from public.t2_smeta_import_bolak where sessiya_id = p_sessiya_id;
  if v_jami > 60000 then return jsonb_build_object('ok',false,'code','TOO_MANY_ROWS','jami',v_jami); end if;

  update public.t2_smeta_import_sessiya set qator_soni = v_jami, yangilandi = now() where id = p_sessiya_id;
  return jsonb_build_object('ok',true,'bolak',p_bolak,'qator_soni',v_n,'jami',v_jami);
end $$;

-- ── 3) YAKUNLA (og'ir qism -- bitta o'tishda yoziladi) ──────────────
create or replace function public.t2_smeta_import_yakunla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_sessiya_id bigint)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
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
  -- Poyga himoyasi: boshqa import shu orada smetani yozib qo'ygan bo'lishi mumkin.
  if exists (select 1 from public.t2_qator where obyekt_id = v_sessiya.obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;

  perform set_config('t2.manba', 'import', true);

  create temporary table t2_imp_qator(
    local_id text primary key, parent_local_id text, tur text, kod text, nom text,
    birlik text, hajm numeric, narx numeric, summa numeric, kat text,
    ordinal integer, new_id bigint, ota_id bigint, daraja integer
  ) on commit drop;

  -- Barcha bo'laklar HUJJAT TARTIBIDA yig'iladi: avval bo'lak raqami,
  -- keyin bo'lak ichidagi tartib. Shu yerda id lar oldindan olinadi.
  insert into t2_imp_qator(local_id, parent_local_id, tur, kod, nom, birlik,
                           hajm, narx, summa, kat, ordinal, new_id)
  select x->>'local_id', nullif(x->>'parent_local_id',''), x->>'tur',
         nullif(x->>'kod',''), nullif(x->>'nom',''), nullif(x->>'birlik',''),
         public.t2_son_tez(x->>'hajm'), public.t2_son_tez(x->>'narx'), public.t2_son_tez(x->>'summa'),
         case when (x->>'tur') in ('rs','mat','ob') then
           coalesce((select rk.kategoriya from public.t2_resurs_kategoriya rk
                      where rk.kompaniya_id = p_kompaniya_id
                        and rk.nom_key = public.t2_resurs_nom_kalit(x->>'nom')
                        and rk.birlik_key = public.t2_resurs_birlik_kalit(x->>'birlik')),
                    public.t2_kat_birlik(x->>'birlik', x->>'nom')) end,
         (row_number() over (order by b.bolak, t.ordinality))::integer,
         nextval(pg_get_serial_sequence('public.t2_qator','id'))
  from public.t2_smeta_import_bolak b
  cross join lateral jsonb_array_elements(b.qatorlar) with ordinality as t(x, ordinality)
  where b.sessiya_id = p_sessiya_id;

  -- Ota havolasi: hali bazaga yozilmagan, vaqtincha jadvalda (arzon).
  update t2_imp_qator m set ota_id = p.new_id
    from t2_imp_qator p where p.local_id = m.parent_local_id;

  -- Chuqurlik: ham arzon, chunki t2_qator ga tegmaydi.
  with recursive d as (
    select local_id, 0 as lvl from t2_imp_qator where parent_local_id is null
    union all
    select r.local_id, d.lvl + 1 from t2_imp_qator r join d on r.parent_local_id = d.local_id
  )
  update t2_imp_qator m set daraja = d.lvl from d where d.local_id = m.local_id;

  -- BITTA yozuv o'tishi. id lar oldindan olingani uchun `overriding system value`.
  insert into public.t2_qator(id, obyekt_id, kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, source_document_id, tartib, daraja, kat, ota_id)
  overriding system value
  select new_id, v_sessiya.obyekt_id, p_kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, v_sessiya.source_document_id, ordinal, coalesce(daraja,0), kat, ota_id
  from t2_imp_qator order by ordinal;

  select count(*) into v_soni from t2_imp_qator;

  update public.t2_smeta_import_sessiya
     set holat = 'yakunlandi', qator_soni = v_soni, yangilandi = now()
   where id = p_sessiya_id;
  -- Xom bo'laklar endi kerak emas (10 MB gacha jsonb bo'lishi mumkin).
  delete from public.t2_smeta_import_bolak where sessiya_id = p_sessiya_id;

  -- Signal yangilash -- maslahat xarakterida, katta importda o'tkazib
  -- yuboriladi (T2-SMETA-IMPORT-TIMEOUT-002 dagi bilan bir xil qoida).
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

-- ── Eski bitta-o'tishli yo'l ham xuddi shu tez algoritmga ko'chiriladi ──
-- (hali ham ishlatilishi mumkin: kichik smeta, testlar, tashqi chaqiruv).
create or replace function public.t2_smeta_import_bulk_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint,
  p_operation_id uuid, p_source_document_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
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
    birlik text, hajm numeric, narx numeric, summa numeric, kat text,
    ordinal integer, new_id bigint, ota_id bigint, daraja integer
  ) on commit drop;

  insert into t2_imp_qator(local_id, parent_local_id, tur, kod, nom, birlik,
                           hajm, narx, summa, kat, ordinal, new_id)
  select x->>'local_id', nullif(x->>'parent_local_id',''), x->>'tur',
         nullif(x->>'kod',''), nullif(x->>'nom',''), nullif(x->>'birlik',''),
         public.t2_son_tez(x->>'hajm'), public.t2_son_tez(x->>'narx'), public.t2_son_tez(x->>'summa'),
         case when (x->>'tur') in ('rs','mat','ob') then
           coalesce((select rk.kategoriya from public.t2_resurs_kategoriya rk
                      where rk.kompaniya_id = p_kompaniya_id
                        and rk.nom_key = public.t2_resurs_nom_kalit(x->>'nom')
                        and rk.birlik_key = public.t2_resurs_birlik_kalit(x->>'birlik')),
                    public.t2_kat_birlik(x->>'birlik', x->>'nom')) end,
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
    hajm, narx, summa, source_document_id, tartib, daraja, kat, ota_id)
  overriding system value
  select new_id, p_obyekt_id, p_kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, p_source_document_id, ordinal, coalesce(daraja,0), kat, ota_id
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

commit;
