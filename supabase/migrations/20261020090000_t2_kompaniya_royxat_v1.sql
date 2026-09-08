-- T2-COMPANY-CREATE-GATE-001 — P0 XAVFSIZLIK TUZATISHI
--
-- Egasi (haqiqiy hodisa): "prorab bo'lib kirib ko'rdim va o'zim kompaniya
-- ochib qo'ydim. bu juda xato ish edi. kompaniyani ro'yxatdan o'tib to'lov
-- o'tgandan keyin yoki man superadmin ruxsatim bilan ochilishi kerak."
--
-- Ildiz sabab: `t2_kompaniya_yarat_v1` HECH QANDAY rol tekshiruvi qilmasdi
-- — faqat `p_actor_id` mavjud va faol ekanini tekshirardi. Nol a'zolikka
-- ega HAR QANDAY foydalanuvchi (yangi ro'yxatdan o'tgan, yoki a'zoligi
-- bekor qilingan "prorab") frontendda "Ochish — men direktor bo'laman"
-- tugmasini bosib, ZUM ARADA kompaniya yaratib, uning `boss`i (direktori)
-- bo'lib qolardi. `KompaniyaPage.tsx` buni HAR BIR nol-a'zolik
-- foydalanuvchiga ko'rsatardi, hech qanday rol yoki to'lov tekshiruvisiz —
-- sahifaning o'zida ham yozilgan edi: "Obuna/to'lov modeli bu relizda
-- YO'Q" — ammo shunga qaramay yaratish tugmasi ochiq turardi.
--
-- Yechim (to'lov gateway hali yo'q, shuning uchun ikkinchi yo'l bilan):
--   1) To'g'ridan-to'g'ri yaratish (`t2_kompaniya_yarat_v1`) endi FAQAT
--      platforma superadmini uchun ochiq.
--   2) Oddiy foydalanuvchi endi SO'ROV yuboradi (`t2_kompaniya_royxat_soraw_v1`)
--      — bu hech qanday kompaniya yoki a'zolik YARATMAYDI, faqat
--      "kutilmoqda" holatidagi yozuv qo'shadi.
--   3) Superadmin so'rovlarni ko'rib chiqadi (`t2_kompaniya_royxat_royxat_v1`)
--      va tasdiqlaydi/rad etadi. Tasdiqlansa — kompaniya ANIQ SHU so'rovni
--      yuborgan foydalanuvchi nomiga yaratiladi (superadmin o'ziniki emas).
--
-- Kelajakda to'lov integratsiyasi qo'shilsa, u shu tasdiqlash bosqichini
-- (muvaffaqiyatli to'lov -> avtomatik tasdiqlash) almashtiradi — oraliq
-- jadval va so'rov-holat modeli o'zgarmaydi.

begin;

create table if not exists public.t2_kompaniya_royxat (
  id bigint generated always as identity primary key,
  actor_id bigint not null references public.t2_foydalanuvchi(id),
  nom text not null,
  inn text,
  telefon text,
  holat text not null default 'kutilmoqda' check (holat in ('kutilmoqda','tasdiqlandi','rad_etildi')),
  kompaniya_id bigint references public.t2_kompaniya(id),
  sabab text,
  decided_by bigint references public.t2_foydalanuvchi(id),
  decided_at timestamptz,
  operation_id uuid unique,
  created_at timestamptz not null default now()
);
create index if not exists t2_kompaniya_royxat_actor_idx on public.t2_kompaniya_royxat(actor_id, created_at desc);
create index if not exists t2_kompaniya_royxat_holat_idx on public.t2_kompaniya_royxat(holat, created_at desc);

-- Faqat service_role (Cloudflare Function) yozadi/o'qiydi; RPC'lar o'z
-- ichida actor/rol tekshiruvini bajaradi (bu loyihadagi barcha yozuvchi
-- jadvallar bilan bir xil naqsh — RLS anon/authenticated uchun umuman
-- yo'l bermaydi).
alter table public.t2_kompaniya_royxat enable row level security;

-- ── Umumiy yaratish mantig'i — HAR IKKI yo'l (to'g'ridan-to'g'ri
--    superadmin va so'rov-tasdiqlash) shu yerdan foydalanadi, shuning
--    uchun kompaniya-yaratish logikasi ikki joyda YOZILMAYDI. ──
create or replace function public._t2_kompaniya_yarat_asosiy(
  p_boss_actor_id bigint, p_nom text, p_inn text, p_telefon text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_kod text; v_azolik bigint; v_nom text;
begin
  v_nom := btrim(coalesce(p_nom,''));
  if length(v_nom) < 2 then return jsonb_build_object('ok',false,'code','COMPANY_NAME_REQUIRED'); end if;
  if p_inn is not null and p_inn <> '' and p_inn !~ '^\d{9}$' then
    return jsonb_build_object('ok',false,'code','INN_INVALID','xato','STIR 9 ta raqam');
  end if;

  insert into public.t2_kompaniya (nom, kod, faol, inn, telefon)
  values (v_nom, 'PENDING', true, nullif(p_inn,''), nullif(p_telefon,''))
  returning id into v_komp;
  v_kod := public.t2_kompaniya_kod_yasa(v_nom, v_komp);
  update public.t2_kompaniya set kod = v_kod where id = v_komp;

  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat)
  values (p_boss_actor_id, v_komp, 'boss', 'faol')
  returning id into v_azolik;

  return jsonb_build_object('ok',true,'kompaniya_id',v_komp,'kod',v_kod,'rol','boss','azolik_id',v_azolik);
end $$;

-- ── 1) To'g'ridan-to'g'ri yaratish — ENDI FAQAT SUPERADMIN ──
create or replace function public.t2_kompaniya_yarat_v1(
  p_actor_id bigint, p_nom text, p_inn text, p_telefon text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_natija jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  if p_actor_id is null or p_actor_id <= 0 then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  if not exists (select 1 from public.t2_foydalanuvchi where id = p_actor_id and coalesce(holat,'faol') = 'faol') then
    return jsonb_build_object('ok',false,'code','ACTOR_NOT_FOUND');
  end if;
  -- ⚠️ P0 TUZATISH: avval bu yerda hech qanday rol tekshiruvi yo'q edi —
  -- har qanday foydalanuvchi o'zi uchun kompaniya ochib, uning direktori
  -- bo'lib olardi. Endi faqat platforma superadmini.
  if not public.t2_platforma_superadmin(p_actor_id) then
    return jsonb_build_object('ok',false,'code','SUPERADMIN_REQUIRED',
      'xato','Yangi kompaniyani to''g''ridan-to''g''ri faqat superadmin ochadi. Oddiy foydalanuvchi so''rov yuboradi.');
  end if;

  v_natija := public._t2_kompaniya_yarat_asosiy(p_actor_id, p_nom, p_inn, p_telefon);
  if not (v_natija->>'ok')::boolean then return v_natija; end if;

  perform public.t2_audit_yoz((v_natija->>'kompaniya_id')::bigint, 'kompaniya_yarat', 'onboarding', null,
    format('nom=%s kod=%s director=azolik:%s (superadmin to''g''ridan-to''g''ri)', p_nom, v_natija->>'kod', v_natija->>'azolik_id'),
    'actor:'||p_actor_id, null);

  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'kompaniya_yarat', v_natija);
  return v_natija;
end $$;

-- ── 2) Oddiy foydalanuvchi: SO'ROV yuboradi (kompaniya/a'zolik yo'q) ──
create or replace function public.t2_kompaniya_royxat_soraw_v1(
  p_actor_id bigint, p_nom text, p_inn text, p_telefon text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_royxat_id bigint; v_nom text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  if p_actor_id is null or p_actor_id <= 0 then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  if not exists (select 1 from public.t2_foydalanuvchi where id = p_actor_id and coalesce(holat,'faol') = 'faol') then
    return jsonb_build_object('ok',false,'code','ACTOR_NOT_FOUND');
  end if;

  v_nom := btrim(coalesce(p_nom,''));
  if length(v_nom) < 2 then return jsonb_build_object('ok',false,'code','COMPANY_NAME_REQUIRED'); end if;
  if p_inn is not null and p_inn <> '' and p_inn !~ '^\d{9}$' then
    return jsonb_build_object('ok',false,'code','INN_INVALID','xato','STIR 9 ta raqam');
  end if;

  insert into public.t2_kompaniya_royxat (actor_id, nom, inn, telefon, operation_id)
  values (p_actor_id, v_nom, nullif(p_inn,''), nullif(p_telefon,''), p_operation_id)
  returning id into v_royxat_id;

  -- `t2_audit_log.kompaniya_id` NOT NULL — bu bosqichda kompaniya hali
  -- yo'q, shuning uchun umumiy audit jurnaliga yozilmaydi. `t2_kompaniya_
  -- royxat` jadvalining o'zi (actor_id/created_at/decided_by/decided_at)
  -- shu bosqich uchun yetarli audit izi.

  v_prev := jsonb_build_object('ok',true,'royxat_id',v_royxat_id,'holat','kutilmoqda');
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'kompaniya_royxat_soraw', v_prev);
  return v_prev;
end $$;

-- ── 3) Ro'yxatni o'qish — superadmin: HAMMASI; oddiy foydalanuvchi:
--      FAQAT O'ZINING so'rovlari (o'z holatini kuzatishi uchun). ──
create or replace function public.t2_kompaniya_royxat_royxat_v1(p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_superadmin boolean; v_ro jsonb;
begin
  if p_actor_id is null or p_actor_id <= 0 then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  v_superadmin := public.t2_platforma_superadmin(p_actor_id);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'actor_id', r.actor_id, 'login', u.login, 'nom', r.nom, 'inn', r.inn,
           'telefon', r.telefon, 'holat', r.holat, 'kompaniya_id', r.kompaniya_id,
           'sabab', r.sabab, 'created_at', r.created_at, 'decided_at', r.decided_at)
         order by r.created_at desc), '[]'::jsonb)
    into v_ro
  from public.t2_kompaniya_royxat r
  join public.t2_foydalanuvchi u on u.id = r.actor_id
  where v_superadmin or r.actor_id = p_actor_id
  limit 200;

  return jsonb_build_object('ok', true, 'superadmin', v_superadmin, 'royxatlar', v_ro);
end $$;

-- ── 4) Tasdiqlash — FAQAT superadmin. Kompaniya SO'ROVCHI nomiga
--      yaratiladi (tasdiqlovchi emas). ──
create or replace function public.t2_kompaniya_royxat_tasdiqla_v1(
  p_actor_id bigint, p_royxat_id bigint, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_ro public.t2_kompaniya_royxat%rowtype; v_natija jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  if not public.t2_platforma_superadmin(p_actor_id) then
    return jsonb_build_object('ok',false,'code','SUPERADMIN_REQUIRED');
  end if;

  select * into v_ro from public.t2_kompaniya_royxat where id = p_royxat_id for update;
  if not found then return jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND'); end if;
  if v_ro.holat <> 'kutilmoqda' then
    return jsonb_build_object('ok',false,'code','REQUEST_NOT_PENDING','holat',v_ro.holat);
  end if;

  -- Kompaniya SO'ROVNI YUBORGAN foydalanuvchi (v_ro.actor_id) nomiga
  -- yaratiladi va u boss bo'ladi — tasdiqlovchi superadmin emas.
  v_natija := public._t2_kompaniya_yarat_asosiy(v_ro.actor_id, v_ro.nom, v_ro.inn, v_ro.telefon);
  if not (v_natija->>'ok')::boolean then return v_natija; end if;

  update public.t2_kompaniya_royxat
     set holat = 'tasdiqlandi', kompaniya_id = (v_natija->>'kompaniya_id')::bigint,
         decided_by = p_actor_id, decided_at = now()
   where id = p_royxat_id;

  -- ⚠️ `t2_audit_log.obyekt_id` HAQIQIY qurilish obyektiga (t2_obyekt) FK —
  -- so'rov IDsi bu yerga YOZILMAYDI (FK buzilishiga olib keladi). ID
  -- matn ichida.
  perform public.t2_audit_yoz((v_natija->>'kompaniya_id')::bigint, 'kompaniya_royxat_tasdiqla', 'onboarding', null,
    format('royxat_id=%s nom=%s so''ragan=actor:%s tasdiqlagan=actor:%s', p_royxat_id, v_ro.nom, v_ro.actor_id, p_actor_id),
    'actor:'||p_actor_id, null);

  v_prev := v_natija || jsonb_build_object('royxat_id', p_royxat_id);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'kompaniya_royxat_tasdiqla', v_prev);
  return v_prev;
end $$;

-- ── 5) Rad etish — FAQAT superadmin ──
create or replace function public.t2_kompaniya_royxat_rad_et_v1(
  p_actor_id bigint, p_royxat_id bigint, p_sabab text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_ro public.t2_kompaniya_royxat%rowtype;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  if not public.t2_platforma_superadmin(p_actor_id) then
    return jsonb_build_object('ok',false,'code','SUPERADMIN_REQUIRED');
  end if;

  select * into v_ro from public.t2_kompaniya_royxat where id = p_royxat_id for update;
  if not found then return jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND'); end if;
  if v_ro.holat <> 'kutilmoqda' then
    return jsonb_build_object('ok',false,'code','REQUEST_NOT_PENDING','holat',v_ro.holat);
  end if;

  update public.t2_kompaniya_royxat
     set holat = 'rad_etildi', sabab = nullif(btrim(coalesce(p_sabab,'')),''),
         decided_by = p_actor_id, decided_at = now()
   where id = p_royxat_id;

  -- Kompaniya yaratilmagani uchun umumiy audit jurnaliga yozilmaydi (yuqoridagi
  -- izohga qarang) — qaror `t2_kompaniya_royxat.decided_by/decided_at/sabab`da.

  v_prev := jsonb_build_object('ok',true,'royxat_id',p_royxat_id,'holat','rad_etildi');
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'kompaniya_royxat_rad_et', v_prev);
  return v_prev;
end $$;

revoke all on function public._t2_kompaniya_yarat_asosiy(bigint,text,text,text) from public, anon, authenticated;
revoke all on function public.t2_kompaniya_royxat_soraw_v1(bigint,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_kompaniya_royxat_royxat_v1(bigint) from public, anon, authenticated;
revoke all on function public.t2_kompaniya_royxat_tasdiqla_v1(bigint,bigint,uuid) from public, anon, authenticated;
revoke all on function public.t2_kompaniya_royxat_rad_et_v1(bigint,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public._t2_kompaniya_yarat_asosiy(bigint,text,text,text) to service_role;
grant execute on function public.t2_kompaniya_royxat_soraw_v1(bigint,text,text,text,uuid) to service_role;
grant execute on function public.t2_kompaniya_royxat_royxat_v1(bigint) to service_role;
grant execute on function public.t2_kompaniya_royxat_tasdiqla_v1(bigint,bigint,uuid) to service_role;
grant execute on function public.t2_kompaniya_royxat_rad_et_v1(bigint,bigint,text,uuid) to service_role;

commit;
