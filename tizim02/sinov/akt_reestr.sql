-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: t2_akt_reestr (cheksiz rekursiya tuzatilgani)
-- ══════════════════════════════════════════════════════════════════
--
-- ⚠️ HAQIQIY PRODUKSIYA BUGI (2026-08-25): boshqa migratsiya
-- `t2_akt_reestr` ni o'ziga-o'zi ishora qiladigan qilib qo'ygan edi
-- (`CREATE OR REPLACE VIEW ... AS SELECT * FROM t2_akt_reestr ...`).
-- Natija: HAR QANDAY so'rov `ERROR 42P17: infinite recursion` berardi.
-- `TestF2.tsx` (F2/Fakt sahifasi) buni to'g'ridan-to'g'ri so'raydi —
-- ya'ni sahifa LIVE holda buzuq edi.
--
-- Bu test: (1) view umuman xato bermasdan ishlashi, (2) `versiya`
-- ustuni borligi (optimistik qulf uchun qo'shilgan sabab shu edi).

do $$
declare v_soni int; v_versiya_bor boolean;
begin
  select count(*) into v_soni from t2_akt_reestr;
  raise notice 'OK 1: t2_akt_reestr xatosiz o''qildi (% qator)', v_soni;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='t2_akt_reestr' and column_name='versiya'
  ) into v_versiya_bor;

  if not v_versiya_bor then
    raise exception 'XATO: versiya ustuni yo''q — optimistik qulf ishlamaydi';
  end if;
  raise notice 'OK 2: versiya ustuni bor';

  raise notice '==== 2 otdi, 0 yiqildi ====';
end $$;
