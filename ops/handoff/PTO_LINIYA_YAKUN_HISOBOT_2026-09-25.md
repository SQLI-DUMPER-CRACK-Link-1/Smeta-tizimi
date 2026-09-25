# PTO LINIYASI YAKUNI — hisobot (2026-09-25)

Vazifa: `PTO-LINIYA-YAKUN-001` · Agent: Claude (server, claude.ai/code bulut konteyneri) ·
Topshiriq: `ops/handoff/PTO_LINIYA_YAKUNIY_TOPSHIRIQ_2026-09-25.md` ·
Branch: `claude/ecstatic-cerf-0h899k` → `main`.

```
BASE SHA     e0d44855d193e960e75283df7fa73ec32ac8482d
FINAL SHA    345454d6891f762a9f7719bd549dec355faddc51  (main, fast-forward; oraliqda origin/main c4735d8 merge qilingan)
DEPLOYED SHA 345454d6891f762a9f7719bd549dec355faddc51  (Cloudflare Pages: completed success, 888befa5.smeta-tizimi.pages.dev)
```

## Gate'lar (§7) — hammasi push'dan oldin, merge qilingan holatda

| Gate | Natija |
|---|---|
| `npx tsc -b` | PASS |
| `npx tsc -p tsconfig.functions.json --noEmit` | PASS |
| `npx oxlint` | PASS — 0 error (faqat eski warning'lar) |
| `npm run tekshir` | PASS — "Barcha tekshiruvlar o'tdi" (+ yangi P6 qo'riqchisi) |
| `npm run build` | PASS (Web Worker bundle `xlsxReader.worker-*.js` chiqdi) |
| `npx vitest run` (to'liq) | PASS — 99 fayl / **631 test passed**, 5 skipped (korpus — real fayl yo'q) |
| `node ops/governance-check.cjs` | PASS (WARN: CURRENT_STATE main_sha bir commit orqada — addendum o'z SHA sini yoza olmaydi) |
| `git diff --check` | PASS |
| LibreOffice qayta hisoblash (`scripts/hujjat-lo-tekshir.mjs`) | PASS — 22 ta sintetik namuna, farq **0**; salbiy nazorat (buzilgan kesh) ushlandi |

## P1–P10

| # | Holat | Dalil |
|---|---|---|
| P1 hujjat-yozuvchi + eksportlar | **PASS** | `frontend/src/lib/hujjat-yozuvchi/`; Oferta ko'chirildi (33 Oferta testi o'zgarmay yashil); `*.hujjat.test.ts`: ostatka, nakopitelniy (+АКТ Ф-2), f2-native, tender-oferta-export (+paket), lrv-plus-export, pto-hujjat-export, resurs-vedomost; `hujjat-yozuvchi.test.ts` (salbiy nazorat) |
| P2 Ostatka | **PASS** | `ostatkaHujjatModeli` + `ostatkaHujjatXlsx`; HolatNative "Ostatka Excel" → ВЕДОМОСТЬ ОСТАТКА РАБОТ |
| P3 F2 + Nakopitelniy | **PASS** (Forma-3 — egasi qarori) | `f2AktHujjat`, `nakopitelniyVedomostHujjat`, `f2QoralamaHujjat`; qirqilgan ro'yxat bloklanadi; Q1/Q2 qarorlar faylida |
| P4.1 Oferta parser → anatomiya | **QISMAN** | ustun xaritasi anatomiya bilan solishtiriladi (`anatomiyaSolishtir`, golden test mos); to'liq almashtirish real korpus golden'idan keyin |
| P4.2 podval foizi istalgan katakda | **PASS** | `katakFoizlari` (0,05 / "2%" / НДС 1,12) + test |
| P4.3 fayldagi foizlar taklifi | **PASS** | `fayldagiFoizlar` + OfertaNative "[Qo'llash]" (avtomatik emas), ziddiyat ro'yxati |
| P4.4 NARX_HAR_XIL UI | **PASS** | guruhda varaq/qator bo'yicha narxlar + "Shu narxni asosiy qilish" (`asosNarxTanlovi`) + test |
| P4.5 paket e2e | **PASS** | 2 obyekt → ZIP (har obyekt + svod), svod = yig'indi, imzo, H5 |
| P4.6 Excel/real fayl | **UNKNOWN** | egasi ofis PC da (pastda) |
| P5 yagona yuklash liniyasi | **QISMAN** | Excel o'qish Web Worker da (`readXlsxFonda`, 4 sahifa); o'lchov sintetik 27 000 qator: o'qish 354 ms, anatomiya 103 ms (Node). Uch UI ni bitta ekranga birlashtirish qilinmadi (bitta fayl va paket importi — ikki xil server buyrug'i; real fayl smoke'isiz xavfli) |
| P6 anatomiyaga ko'chirish + lint | **QISMAN / lint PASS** | oxlint `no-restricted-imports` + `t2_smeta_oqish_yagona.test.cjs` (dinamik import, sheet_to_json); ustun aniqlash endi barcha o'quvchilarda yagona (`ustun-dalil.ts`). F2 import/RES narxlash/Nakopitelniy parserlarining to'liq anatomiyaga o'tishi — qolgan |
| P7 katta obyekt tezligi | **PASS (payload) / UNKNOWN (<4 s)** | `t2-daraxt-ustunlar.ts`; sintetik 27k: t2_daraxt 12,70→9,35 MB (−26 %), t2_qator_holat 14,83→8,88 MB (−40 %); ustunlar prod information_schema da bor. Jonli vaqt — egasi |
| P8 profil va korpus manifesti | **PASS (kod) / UNKNOWN (real korpus)** | `smeta-anatomiya/profil.ts`, `korpus/manifest.korpus.test.ts`, `npm run korpus`; sintetik mini-korpusda yozish/solishtirish/farq ushlandi |
| P9.1 narxlar native | **PASS (oldindan)** | `Narxlar.tsx` flag: native sukut, GAS legacy flag ortida |
| P9.2 Price Control | **PASS (oldindan)** | `useT2Daraxt` → `priceControlOl` → `SmetaTree priceControlLines` |
| P9.3 Additional/Replacement | **PASS (tekshirildi)** | prodda `20260905043049 t2_additional_replacement_v1`, RPC'lar va `sb-yoz` whitelist; UI — F2 ikki oynali panel (egasi qarori, test himoyasida) |
| P9.4 F2 fayllari R2 | **PASS (oldindan)** | `F2ImportNative.sourceniR2gaYukla` importdan oldin |
| P9.5 Sheets ko'prigi | **KUTILMOQDA** | egasi aktivatsiyasi (o'zgarmagan) |
| P10 hujjatlar | **PASS** | `docs/architecture/HUJJAT_STANDARTI_V1.md`, CURRENT_STATE addendum, ACTIVE_TASKS, qarorlar fayli, shu hisobot |

Qo'shimcha (egasi so'rovlari sessiya davomida):
- **Ustunlarni moslashuvchan tushunish (barcha hujjatlar)** — PASS: sarlavha nomzod,
  hajm × narx ≈ summa isboti; anatomiya (LRV/RES), F2 import (brauzer + server
  endpointlari), Oferta, RES narxlash; qo'shimcha ustunlar operatorga ko'rsatiladi.
  8 ta test (qo'shilgan "Кол-во по смете", qayta nomlangan "ИТОГО СТОИМОСТЬ",
  almashgan narx/summa, "ЦЕНА ПО СМЕТЕ 2025" …).
- **АОСР / promejutochnaya priemka / sinov-laboratoriya aktlari** — T1 GAS generatori
  (`45_Hujjatlar.js`, `67_AI_Akt.js`) tahlil qilindi; variantlar va tavsiya — Q12
  (qaror sizniki, kod yozilmadi).

Topilgan va tuzatilgan xatolar:
1. LRV_PLUS/Forma-2 nakrutka **ИТОГО-3** Excel formulasi ИТОГО-2 o'rniga "Прочие"
   qatoriga havola qilardi — sayt 501 500, Excel 76 500 (LibreOffice topdi).
2. LRV_PLUS da narxsiz bargda `=F*G` Excelda **0** (sayt — noma'lum); ota jamilar qisman summa.
3. Накопительная / АКТ Ф-2 eksporti RPC ning 500 qator chegarasida **jimgina chala** hujjat.
4. OFERTA_JAMI da texnik kodlar (ТРАНСПОРТ_МАТЕРИАЛ…) va o'zbek kirilidagi yorliqlar.
5. F2 tayyorlash qoralamasida o'zbekcha "NOANIQ"/"Bajarilgan ishlar" matnlari.

## Hujjat standarti (H1–H9) — hujjat turlari bo'yicha

| Hujjat | H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 |
|---|---|---|---|---|---|---|---|---|---|
| Tender oferta (asl RES) | ✅ asl `<c>` bayt-bayt, fill o'zgarmaydi | — (asl shakl) | ✅ | ✅ Print_Titles, sig'dirish | ✅ | ✅ LO 0 | ✅ | ✅ `_ОФЕРТА_<sana>` | ✅ |
| Oferta paket svodi | — | ✅ | ✅ | ✅ | ✅ | ✅ LO 0 | ✅ | ✅ | ✅ |
| LRV_PLUS / Forma-2 (ЛРВ) | — (T1 shakli) | ✅ (T1) | ✅ | ✅ | ✅ (T1 sarlavhalari — istisno) | ✅ LO 0 | ✅ | ✅ | ✅ istisno bilan |
| Ведомость остатка работ | — | ✅ | ✅ | ✅ | ✅ | ✅ LO 0 | ✅ | ✅ | ✅ |
| Накопительная ведомость | — | ✅ | ✅ | ✅ | ✅ | ✅ LO 0 | ✅ | ✅ | ✅ |
| АКТ Ф-2 (TN) | — | ✅ | ✅ +ТЕХНАДЗОР | ✅ portret | ✅ | ✅ LO 0 | ✅ НДС | ✅ | ✅ |
| Проект акта Ф-2 | — | ✅ | ✅ | ✅ | ✅ | ✅ LO 0 | ✅ | ✅ | ✅ |
| Ресурсная ведомость | — | ✅ | ✅ | ✅ | ✅ | ✅ LO 0 | ✅ | ✅ | ✅ |
| PTO hujjat (5 tur, Excel) | — | ✅ | ✅ (+PDF) | ✅ | ✅ | ✅ LO 0 | ✅ | ✅ | ✅ |

"LO 0" — LibreOffice headless qayta hisoblash farqi 0 (sintetik namuna). Microsoft
Excel CalculateFull — UNKNOWN.

## Egasi tekshirishi kerak (real fayl / Excel / jonli login)

1. **Kirish**: https://smeta-tizimi.pages.dev → kompaniya → `/admin/holat/<obyekt>`.
2. **Ostatka**: "Hujjat imzolari" panelida ЗАКАЗЧИК/ПОДРЯДЧИК ni kiriting → "Ostatka
   Excel" → Microsoft Excel da oching: F9 (qayta hisoblash) dan keyin "ВСЕГО ОСТАТОК"
   sayt toast'idagi jami bilan teng; A4 landshaft bir sahifa eniga; sarlavha har sahifada.
3. **LRV Excel / Forma-2**: nakrutka jadvalidagi ИТОГО-3 = ИТОГО-2 + ОБ + транспорт +
   заготовка ekanini tekshiring (tuzatilgan xato); narxsiz resurs qatorlarida summa bo'sh.
4. **Накопительная** (`/admin/nakopitelniy`): "XLSX eksport" va "Rasmiy Ф2 hujjati"
   (QQS stavkasini kiritib va kiritmasdan); Suniy Ko'l kabi katta obyektda hujjat
   bloklanishi va xabar (Q4).
5. **F2 tayyorlash**: "Forma-2 Excel qoralama" — ПРОЕКТ АКТА Ф-2.
6. **Oferta**: ofis PC `C:\Temp\oferta-real\` dagi real RES fayllari (ABC4 va TN,
   .xls va .xlsx, .xlsm) → Excel da OFERTA_JAMI yakuniysi == sayt; "Fayldagi foizlar"
   taklifi va "Smeta narxi har xil" tafsiloti.
7. **Ustun moslashuvi**: PTO ustun qo'shgan real F2 faylini `/admin/f2` ga yuklang —
   "ustunlar ma'lumot bo'yicha aniqlandi" izohi va qo'shimcha ustunlar ro'yxati.
8. **Tezlik**: Suniy Ko'l 2 (91) `/admin/holat/91` birinchi ochilishi (DevTools →
   Network `/api/sb` hajmi va vaqti; maqsad < 4 s).
9. **Korpus**: `KORPUS_DIR=C:/smetalar KORPUS_YOZ=1 npm run korpus` (manifest), keyin
   `npm run korpus` — farq 0.

## Egasi qarorlari

`ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md` — Q1–Q13.

## Deploy

- `git push origin HEAD:main` — fast-forward `c4735d8..345454d`.
- GitHub check-run **Cloudflare Pages: completed / success** (commit `345454d`,
  preview `https://888befa5.smeta-tizimi.pages.dev`).
- `curl https://smeta-tizimi.pages.dev/api/soglik` — **UNKNOWN**: bu bulut muhitining
  tarmoq siyosati `smeta-tizimi.pages.dev` ga chiqishni bloklaydi (proksi 403).
  Egasi brauzerda `/api/soglik` → `ok:true` ni tekshiradi (yoki muhit sozlamasida
  domenga ruxsat beradi).
- Shu hisobot faylining o'zi keyingi hujjat commit'ida (faqat hujjat, kod o'zgarmagan).
