-- P0 (owner-reported live): «Stella obyekti primoy zatrati 6mlrd 250mln ga
-- yaqin summa edi ... bu yerda nimadir xato yoki narxlanmay qolayotgan
-- narsalar bor». Haqiqatan ham: Stella'da 319 ta rs/mat/ob qatori narxsiz
-- (jumladan ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ -- 108 qator, 43 647 chel-soat),
-- shuning uchun jami 5.04 mlrd bo'lib turibdi, 6.33 mlrd o'rniga.
--
-- ILDIZ SABAB (bu migratsiya tuzatadigan narsa): `t2_obyekt_jami.narxsiz`
-- ko'rsatkichi FAQAT `narx IS NULL` ni sanardi. Lekin Excel'dan kelgan
-- bo'sh katak NULL emas, 0 bo'lib yoziladi -- bazada birorta ham NULL
-- narx YO'Q. Natijada ko'rsatkich butun tizim bo'yicha har doim 0
-- ko'rsatgan va egasi jami summaning to'liq emasligidan ogohlantirilmagan:
--     Amfiteatr2 -- 9448 ta narxsiz qator, ko'rsatkich 0
--     Fast Food  -- 1262 ta narxsiz qator, ko'rsatkich 0
--     Stella     --  319 ta narxsiz qator, ko'rsatkich 0
--     Karting2   --  206 ta narxsiz qator, ko'rsatkich 0
--
-- Bu AYNAN o'sha xato sinfi bo'lib, frontend'da 2026-09-08 da allaqachon
-- tuzatilgan edi (narxlarniDaraxtgaQoll: «narx ustuni bo'sh emas, 0 bo'lib
-- keladi»). Endi ta'rif ikkala tomonda bir xil: narx null YOKI 0 -> narxsiz.
--
-- Eslatma: ЗАТРАТЫ ТРУДА МАШИНИСТОВ normativ bo'yicha 0 bo'ladi (uning
-- qiymati mashina stavkasi ichida). Ular ham bu sanoqqa tushadi -- bu
-- ATAYLAB: ko'rsatkich «tekshirib ko'r» degan ogohlantirish, «xato» degan
-- da'vo emas. Kam ko'rsatgandan ko'ra ortiqcha ko'rsatgan xavfsiz.

begin;

create or replace view public.t2_obyekt_jami as
 SELECT id,
    nom,
    tur,
    ( SELECT count(*) AS count
           FROM t2_qator q
          WHERE q.obyekt_id = o.id) AS qator_soni,
    ( SELECT count(*) AS count
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND q.tur = 'rz'::text) AS razdel,
    ( SELECT count(*) AS count
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND q.tur = 'bl'::text) AS ish,
    ( SELECT count(*) AS count
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND q.tur = 'rs'::text) AS resurs,
    ( SELECT sum(q.summa) AS sum
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND q.tur = 'rz'::text) AS jami,
    ( SELECT count(*) AS count
           FROM t2_qator q
          WHERE q.obyekt_id = o.id
            AND (q.tur = ANY (ARRAY['rs'::text, 'mat'::text, 'ob'::text]))
            AND (q.narx IS NULL OR q.narx = 0)) AS narxsiz,
    ( SELECT sum(q.summa) AS sum
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND (q.tur = ANY (ARRAY['rs'::text, 'mat'::text, 'ob'::text])) AND q.kat = 'ЧЕЛ'::text) AS chel,
    ( SELECT sum(q.summa) AS sum
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND (q.tur = ANY (ARRAY['rs'::text, 'mat'::text, 'ob'::text])) AND q.kat = 'МАШ'::text) AS mash,
    ( SELECT sum(q.summa) AS sum
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND (q.tur = ANY (ARRAY['rs'::text, 'mat'::text, 'ob'::text])) AND q.kat = 'МАТ'::text) AS mat,
    ( SELECT sum(q.summa) AS sum
           FROM t2_qator q
          WHERE q.obyekt_id = o.id AND (q.tur = ANY (ARRAY['rs'::text, 'mat'::text, 'ob'::text])) AND q.kat = 'ОБ'::text) AS ob,
    yangilandi,
    kompaniya_id,
    lat,
    lng,
    versiya,
    loyiha_id
   FROM t2_obyekt o
  WHERE holat <> 'bekor'::text;

commit;
