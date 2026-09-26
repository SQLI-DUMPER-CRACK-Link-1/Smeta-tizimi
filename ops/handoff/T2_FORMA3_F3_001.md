# T2-FORMA3-F3-001 — F3 (Справка о стоимости выполненных работ и затрат / счет-фактура, Forma-3) — YAKUNIY HISOBOT

- **Agent:** Claude (Buffy, Freebuff) · **Machine:** server · **Branch:** `claude/forma3-f3-v1` · **Base:** `30f6633`
- **Sana:** 2026-09-26 · **Status:** BAJARILDI (kod + migratsiya + testlar + Amfiteatr real tekshiruv)
- **Asos:** `ops/handoff/EGASI_TALABLARI_KEYINGI_AGENTLAR_2026-09-26.md` §C1; egasining qarorlari (chat, 2026-09-26) — Q1 javobi `PTO_EGASI_QARORLARI_2026-09-25.md` ichida yozildi.

## 1. Nima qilindi

| Buyum | Holat |
|---|---|
| `frontend/src/lib/forma3-export.ts` | YANGI (~560 qator): `f3Model` / `f3ModelQatorlar` / `f3UstunlarNatijasi` / `forma3Hujjat`. RasmiyVaraq asosida: 4 pul ustuni — G=сметная стоимость, H=с начала строительства, I=с начала года, J=за отчетный период (H/I/J — FAQAT tasdiqlangan F2, manba `t2_f2_tafsilot`); РАЗДЕЛ → ish turlari (bl) → ИТОГО ПО РАЗДЕЛУ → ИТОГО ПРЯМЫЕ ЗАТРАТЫ; oxirida nakrutka podvali `nakrutkaPodvaliYoz` (har ustunga alohida kaskad) → eng pastki qator **ВСЕГО К ОПЛАТЕ**. |
| F2 tenglik nazorati | `kOplate` = Σ ROUND(qiymat × Kf[kat], 2) per-row ↔ podval kaskadi (kategoriya jami) — farq > 0.005 bo'lsa hujjat diqqatiga + UI panelsiga chiqadi, yashirilmaydi (egasi: tiyingacha). |
| NULL ≠ 0 | Smetasi noma'lum barg — G SUMIF `IF(COUNTIFS(...,"")>0,"",SUMIF(...))` bilan BO'SH, jami ham bo'sh, diqqatga yoziladi; F2 0 = shu davrda bajarilmagan (normal 0). |
| Olib tashlash | `t2_smeta_ozgarish` (tur='olib_tashlash', holat='tasdiqlangan') qatorlari СМЕТНАЯ dan chiqadi, «исключено из остатка (изменение утверждено)» diqqatiga yoziladi; F2 ustunlari o'zgarmaydi. |
| 255 argument | Yashirin ustunlar: K=Кат (kategoriya), L=Т (qiymat belgisi=1); jamilar va podval SUMIF oraliqlari bilan — 300+ bargli hujjat testi o'tadi. |
| Formulalar | Jonli, `$` YO'Q, keshsiz (`fullCalcOnLoad`); H1–H9 hujjat standarti (`hujjatTekshir` bilan tekshirilgan). |
| UI | `NakopitelniyVedomost.tsx`: «Форма № 3» (Excel yuklab olish) + 👁 (saytda hujjatdagiday ko'rish) tugmalari; manba yig'ish: `t2NakopitelniyToliq` + `sbT2F2TafsilotOl` (akt_holat='tasdiqlangan') + `ozgarishRoyxatOl`; F3 diqqatlari UI'da `<details>` panel. |
| Testlar | `frontend/src/lib/forma3-export.hujjat.test.ts` — **9/9**: model/guruhlash, 4 ustun yil chegarasi bilan, kaskad = nakrutkaKaskadJS, F2 tenglik (yaxlitlash ≤ 0.01×qator), NULL, olib_tashlash, H2–H9 + ruxsat regex, 300 barg SUMIF, davr matni rus tilida. |
| Migratsiya | `supabase/migrations/20261102090000_t2_forma3_rule_mapped_v1.sql` (+ `.rollback.sql`): `t2_forma3_yarat_v1` endi `qoida_holat='FORMA3_RULE_MAPPED'`, `qoida_manba='EGA_QAROR_B_NAKRUTKA_KASKAD_V1: …'` yozadi (avasidagi validatsiya saqlangan: faqat tasdiqlangan F2, scope va davr ichida). Additive — faqat create or replace function. |
| Migratsiya apply | **Productionga qo'llandi** ✅: `apply_migration` (MCP), `schema_migrations.version = 20260926125938`, 2026-09-26. Tranzaksiyada (begin…rollback) avval test qilindi. Prod tekshirildi: `pg_get_functiondef` 'FORMA3_RULE_MAPPED' yozadi, 'UNRESOLVED' yo'q; `comment on function` yangilandi. |

## 2. Gate'lar (t2clean — C:\Temp\t2clean, Drive diskidagi node_modules buzilgani uchun)

- `tsc -b` — toza; `tsc -p tsconfig.functions.json` — toza; `oxlint` — 0 xato (umumiy 182 warning — eskilari, mening fayllarimda 0).
- `npm run tekshir` — **5/5 PASS**; `npm run build` — OK (8.5s); to'liq `vitest` — **675/676 pass** (1 fail faqat shallow-clone muammosi edi — `git fetch --unshallow` dan keyin 14/14 OK).
- `node ops/governance-check.cjs` — PASS (stale main_sha WARN — CURRENT_STATE addendum yoziladi); `git diff --check` — toza.

## 3. Amfiteatr real sinov (read-only)

- Obyekt **77 «Amfiteatr»** (kompaniya 17): 195 razdel, 869 ish, 9 448 barg; smeta summasi NULL = 0; kat noma'lum = 0; прямые jami **43 596 859 620,83 so'm**; 1 370 barg razdelga to'g'ridan bog'langan (f3Model qo'llab-quvvatlaydi).
- Nakrutka foizlari obyektda 0 % — server `t2_obyekt_nakrutka`: pryamye = itogo1 = itogo3 = itogo4 = vsego = 43 596 859 620,83; kf=1.
- **JS kaskad (mening modulim) = server kaskadi AYNAN** (tiyingacha, test bilan isbotlandi: `nakrutkaKaskadJS(REAL_KAT, {})` ↔ SQL qiymatlari).
- **F2 tenglik real sinov CHEKLANMAGAN:** kompaniya 17 da tasdiqlangan F2 umuman yo'q (faqat 103 ta fakt qoralama). Butun bazada yagona tasdiqlangan F2 — akt 19 (obyekt 5 «Fast food 1этаж», kompaniya 1, 2026-07) va u **0 qatorli**. Demak «F3 J = F2 к оплате» tekshiruvi real F2 yaratilgach (Amfiteatrda F2 tayyorlab tasdiqlangach) takrorlanishi kerak — bu UNKNOWN.

## 4. UNKNOWN / keyingi qadamlar

1. **Real F2 bilan F3 tenglik** — Amfiteatrda tasdiqlangan F2 paydo bo'lganda: F3 «за отчетный период» ВСЕГО К ОПЛАТЕ = shu davr F2 к оплате jamisi (tiyingacha) ekanini saytdan tekshirish.
2. **LibreOffice farqi 0** — egasining PC da real Excel/LibreOffice ochib tekshirish (H2–H9 hujjatTekshir bilan o'tgan, lekin real dasturda chop sinovi egasida).
3. Egasidan kutilayotgan qarorlar: F3 raqamlash (avtomat raqam?), «shu jumladan» bo'laklari ko'rinishi, avans keyingi bosqichda qo'shilishi.
4. Kompaniya 17 nakrutka foizlari kiritilmagan (C7) — hozir к оплате = прямые + НДС 0% bo'lib qolmoqda (Amfiteatrda НДС=0 yozilgan).

## 5. Fayllar (owns)

- `frontend/src/lib/forma3-export.ts` (yangi), `frontend/src/lib/forma3-export.hujjat.test.ts` (yangi),
  `frontend/src/admin/sahifalar/NakopitelniyVedomost.tsx` (F3 tugmalari + panel),
  `supabase/migrations/20261102090000_t2_forma3_rule_mapped_v1.sql` (+ `.rollback.sql`),
  `ops/handoff/T2_FORMA3_F3_001.md` (shu fayl), `ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md` (Q1 javobi qismi).

Ishga tegilmagan: `F2ImportNative.tsx` (boshqa oqim o'zgartirgan — menikidan alohida), `.claude/settings.local.json` (mening emas).
