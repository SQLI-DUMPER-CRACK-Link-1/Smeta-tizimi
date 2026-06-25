-- ============================================================
-- SMETA GAS → SUPABASE  (bir tomonlama mirror sxemasi)
-- ============================================================
-- Supabase loyiha → SQL Editor → bu faylni butunlay yopishtirib RUN.
-- GAS service_role kalit bilan yozadi (RLS ni chetlab o'tadi).
-- Frontend authenticated foydalanuvchi sifatida faqat O'QIYDI.
-- ============================================================

-- ---------- OBYEKTLAR (dashboard darajasi — tez panel + realtime) ----------
create table if not exists obyektlar (
  nom        text primary key,
  format     text,
  locked     boolean default false,
  smeta      numeric default 0,
  chel       numeric default 0,
  mash       numeric default 0,
  mat        numeric default 0,
  ob         numeric default 0,
  mk         numeric default 0,
  kab        numeric default 0,
  fakt       numeric default 0,
  f2         numeric default 0,
  qoldiq     numeric default 0,
  progress   int     default 0,
  f2pct      int     default 0,
  shartnoma_no text,                 -- qaysi dogovorga tegishli (SOZLAMALAR_ШАРТНОМА_БОГ)
  sana       text,
  updated_at timestamptz default now()
);
create index if not exists obyektlar_sh_idx on obyektlar(shartnoma_no);

-- ---------- HOLAT (bl/mat/rs qatorlar — drill-down) ----------
create table if not exists holat (
  obyekt     text not null references obyektlar(nom) on delete cascade,
  varaq      text,
  qator      int,
  tur        text,            -- bl / mat / rs
  kod        text,
  nom        text,
  birlik     text,
  smeta_hajm numeric,
  narx       numeric,
  fakt       numeric,
  f2ol       numeric,
  qoldiq     numeric,
  smeta_pul  numeric,
  st_fakt    numeric,
  st_f2      numeric,
  kategoriya text,
  razdel     text,
  updated_at timestamptz default now(),
  primary key (obyekt, varaq, qator)
);
create index if not exists holat_obyekt_idx on holat(obyekt);
create index if not exists holat_razdel_idx on holat(obyekt, razdel);

-- ---------- OYLIK Ф2 (trend / analitika) ----------
create table if not exists oylik_f2 (
  obyekt text not null references obyektlar(nom) on delete cascade,
  oy     text not null,
  qiymat numeric default 0,
  primary key (obyekt, oy)
);

-- ---------- TARIX (o'zgarishlar jurnali — append-only audit) ----------
create table if not exists tarix (
  id     bigserial primary key,
  obyekt text,
  varaq  text,
  qator  int,
  nom    text,
  tur    text,            -- 'fakt' yoki oy nomi (masalan 'Май 2026')
  qiymat numeric,
  kim    text,
  vaqt   timestamptz default now()
);
create index if not exists tarix_obyekt_idx on tarix(obyekt, vaqt desc);

-- ---------- NARXLAR (markaziy narx) ----------
create table if not exists narxlar (
  nom         text not null,
  birlik      text not null,
  kat         text,
  belgilangan numeric default 0,
  smeta_max   numeric default 0,
  tizim       numeric default 0,
  updated_at  timestamptz default now(),
  primary key (nom, birlik)
);

-- ---------- MATERIAL_KERAK (Smeta MUSTAQIL — har obyekt material ehtiyoji) ----------
-- ⚠️ Viborka bilan ATAYLAB ulanmaydi (nomlar har tizimda boshqacha). Bu — Smeta'ning
--    o'z analitikasi uchun. material_key faqat Smeta ichida (_normNomKey || _normBirlik).
create table if not exists material_kerak (
  obyekt       text not null references obyektlar(nom) on delete cascade,
  material_key text not null,        -- Smeta ichki kaliti (_normNomKey || _normBirlik)
  nom          text,
  birlik       text,
  kat          text,
  kerak_hajm   numeric default 0,    -- Σ smeta hajm (shu obyekt bo'yicha)
  narx         numeric default 0,
  updated_at   timestamptz default now(),
  primary key (obyekt, material_key)
);
create index if not exists material_kerak_key_idx on material_kerak(material_key);

-- ---------- SHARTNOMA (dogovor + накрутка + BUXGALTERIYA) ----------
create table if not exists shartnoma (
  no            text primary key,
  nomi          text,
  taraf         text,
  smeta         numeric default 0,   -- jamiSmeta (прямые + qo'shimcha)
  fakt          numeric default 0,   -- jamiFakt
  f2            numeric default 0,   -- jamiF2 = bajarilgan (КС-2 asosi)
  nakrutka_vsego numeric default 0,
  nds           numeric default 0,   -- НДС (shartnoma summasidan)
  dog_summa     numeric default 0,   -- shartnoma jami summasi (НДС bilan)
  qoldiq        numeric default 0,   -- dog_summa − f2 (qolgan bajarilmagan)
  bajarilgan_pct int  default 0,     -- f2 / dog_summa %
  tolangan      numeric default 0,   -- kelgan pul (ТЎЛОВЛАР dan, qaytarim ayirilgan)
  debitor       numeric default 0,   -- bajarilgan − to'langan (bizga qarz; manfiy = avans)
  holat         text,
  updated_at    timestamptz default now()
);

-- ---------- TO'LOVLAR (pul harakati — buxgalteriya; debitor/kreditor uchun) ----------
create table if not exists tolovlar (
  id           text primary key,     -- 'r'+qator (to'liq qayta yoziladi)
  sana         text,
  shartnoma_no text,
  obyekt       text,
  summa        numeric default 0,
  tur          text,                 -- Аванс / Тўлов / Қайтарим
  izoh         text,
  updated_at   timestamptz default now()
);
create index if not exists tolovlar_sh_idx on tolovlar(shartnoma_no);

-- ---------- PRIXOD (kelgan material — sklad kirim ledger; Prixod hujjati) ----------
-- Smeta `apiPrixodOl` orqali tashqi Prixod Sheet'dan push qilinadi (mustaqil ledger).
create table if not exists prixod (
  id          text primary key,      -- 'r'+qator (har push to'liq qayta yoziladi)
  nom         text,
  razdel      text,
  birlik      text,
  hajm        numeric default 0,
  narx        numeric default 0,
  summa       numeric default 0,     -- hajm × narx
  ostatka     numeric default 0,
  sana        text,
  postavshik  text,
  obyekt      text,                  -- qaysi obyektga kelgan
  updated_at  timestamptz default now()
);
create index if not exists prixod_postavshik_idx on prixod(postavshik);
create index if not exists prixod_obyekt_idx on prixod(obyekt);

-- ---------- RASHOD (chiqim ledger; Prixod hujjati) ----------
create table if not exists rashod (
  id          text primary key,      -- 'r'+qator
  nom         text,
  birlik      text,
  hajm        numeric default 0,
  sana        text,
  obyekt      text,
  ish         text,
  izoh        text,
  updated_at  timestamptz default now()
);
create index if not exists rashod_obyekt_idx on rashod(obyekt);

-- ---------- SKLAD_OSTATKA (Sklad joriy holati) ----------
create or replace view sklad_ostatka as
select
  coalesce(p.nom, r.nom) as nom,
  coalesce(p.birlik, r.birlik) as birlik,
  coalesce(p.kirim, 0) as kirim,
  coalesce(r.chiqim, 0) as chiqim,
  coalesce(p.kirim, 0) - coalesce(r.chiqim, 0) as qoldiq,
  case when coalesce(p.kirim, 0) > 0 then (coalesce(p.summa, 0) / p.kirim) else 0 end as ort_narx
from (
  select nom, max(birlik) as birlik, sum(hajm) as kirim, sum(hajm * narx) as summa
  from prixod group by nom
) p
full outer join (
  select nom, max(birlik) as birlik, sum(hajm) as chiqim
  from rashod group by nom
) r on p.nom = r.nom;

-- ---------- TOPILMAGANLAR (narx topilmagan resurslar — MISS) ----------
create table if not exists topilmaganlar (
  obyekt     text not null references obyektlar(nom) on delete cascade,
  varaq      text,
  qator      int,
  tur        text,
  nom        text,
  birlik     text,
  kod        text,
  updated_at timestamptz default now()
);
create index if not exists topilmaganlar_obyekt_idx on topilmaganlar(obyekt);

-- ---------- AKT (REYESTR — yashirin ishlar akti; Akt generator loyihasidan) ----------
create table if not exists akt (
  act_id      text primary key,      -- act file URL (noyob)
  obyekt      text,
  work_name   text,
  act_number  text,
  start_date  text,
  end_date    text,
  status      text,
  customer    text,
  sub_name    text,
  act_url     text,
  ish_key     text,                  -- holat bilan bog'lash (kelajak — B1)
  smeta_ref   text,                  -- Smeta_REF ustuni (obyekt||KOD yoki obyekt||normNomKey)
  work_count  integer default 0,     -- nechta ishga bog'langan
  updated_at  timestamptz default now()
);
create index if not exists akt_obyekt_idx on akt(obyekt);

-- ---------- AKT_ISH (Akt ↔ Smeta N:M bog'lanish) ----------
create table if not exists akt_ish (
  id          text primary key,      -- act_id||work_key (noyob)
  act_id      text references akt(act_id) on delete cascade,
  obyekt      text,
  work_key    text,
  updated_at  timestamptz default now()
);
create index if not exists akt_ish_obyekt_idx on akt_ish(obyekt);
create index if not exists akt_ish_work_idx on akt_ish(work_key);

-- ---------- VIBORKA_NAZORAT (Viborka MUSTAQIL material nazorati) ----------
-- ⚠️ Smeta material_kerak bilan ATAYLAB ulanmaydi — nomlar har tizimda boshqacha.
--    Viborka deficitni O'ZIDA hisoblaydi (qoldiq = plan − qabul). material_key
--    faqat Viborka ichida dedup uchun (uning AI_NormalizeName/normalizeUnit kaliti).
create table if not exists viborka_nazorat (
  material_key text primary key,
  nom          text,
  birlik       text,
  plan         numeric default 0,   -- kerak (jami)
  qabul        numeric default 0,   -- kelgan (qabul qilingan)
  narx         numeric default 0,
  summa        numeric default 0,
  qoldiq       numeric default 0,   -- deficit = plan − qabul
  foiz         text,                -- bajarilish %
  sana         text,
  postavshik   text,
  holat        text,                -- ✅/🟡/🔴/🔄 status
  zamena       text,
  updated_at   timestamptz default now()
);

-- ---------- ANOMALIYA (nazorat invariant buzilishi — 2.5-bo'lim 8 qoida) ----------
create table if not exists anomaliya (
  id         text primary key,       -- obyekt||qoida||qator (idempotent)
  obyekt     text,
  qoida      text,                   -- masalan: 'F2>SMETA', 'OSTATKA<0', 'RASHOD>PRIHOD'
  tavsif     text,
  qiymat     numeric,
  daraja     text,                   -- 'ogohlantirish' / 'xato' / 'kritik'
  hal        boolean default false,
  sana       timestamptz default now()
);
create index if not exists anomaliya_obyekt_idx on anomaliya(obyekt, daraja);

-- ============================================================
-- RLS — faqat tizimga kirgan (authenticated) foydalanuvchi o'qiydi.
-- Yozish faqat service_role (GAS) — u RLS ni avtomatik chetlab o'tadi.
-- ============================================================
alter table obyektlar      enable row level security;
alter table holat          enable row level security;
alter table oylik_f2       enable row level security;
alter table tarix          enable row level security;
alter table narxlar        enable row level security;
alter table material_kerak enable row level security;
alter table shartnoma      enable row level security;
alter table topilmaganlar  enable row level security;
alter table akt            enable row level security;
alter table akt_ish        enable row level security;
alter table prixod         enable row level security;
alter table rashod         enable row level security;
alter table viborka_nazorat enable row level security;
alter table tolovlar       enable row level security;
alter table anomaliya      enable row level security;
-- ---------- SYSTEM_CONFIG (tizim global sozlamalari) ----------
create table if not exists system_config (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);
alter table system_config enable row level security;

create policy "auth_read" on obyektlar      for select to authenticated using (true);
create policy "auth_read" on holat          for select to authenticated using (true);
create policy "auth_read" on oylik_f2       for select to authenticated using (true);
create policy "auth_read" on tarix          for select to authenticated using (true);
create policy "auth_read" on narxlar        for select to authenticated using (true);
create policy "auth_read" on material_kerak for select to authenticated using (true);
create policy "auth_read" on shartnoma      for select to authenticated using (true);
create policy "auth_read" on topilmaganlar  for select to authenticated using (true);
create policy "auth_read" on akt             for select to authenticated using (true);
create policy "auth_read" on akt_ish         for select to authenticated using (true);
create policy "auth_read" on prixod          for select to authenticated using (true);
create policy "auth_read" on rashod          for select to authenticated using (true);
create policy "auth_read" on viborka_nazorat for select to authenticated using (true);
create policy "auth_read" on tolovlar        for select to authenticated using (true);
create policy "auth_read" on anomaliya       for select to authenticated using (true);
create policy "auth_read" on system_config   for select to authenticated using (true);

-- ============================================================
-- REALTIME — o'zgarishlar darhol frontend'ga uzatiladi
-- ============================================================
alter publication supabase_realtime add table obyektlar;
alter publication supabase_realtime add table holat;
alter publication supabase_realtime add table oylik_f2;
alter publication supabase_realtime add table shartnoma;
alter publication supabase_realtime add table anomaliya;
alter publication supabase_realtime add table system_config;

-- STORAGE (hujjat/rasm): Dashboard → Storage → "New bucket" → masalan "hujjatlar"
-- AUTH (login): Dashboard → Authentication → Email/Password yoqing, foydalanuvchi qo'shing.
