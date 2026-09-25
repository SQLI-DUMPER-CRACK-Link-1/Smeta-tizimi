# HUJJAT_STANDARTI_V1 — PTO hujjatlari standarti va `hujjat-yozuvchi` moduli

Status: **ACCEPTED (implementatsiya qilingan)** · 2026-09-25 · Vazifa `PTO-LINIYA-YAKUN-001`
Manba topshiriq: `ops/handoff/PTO_LINIYA_YAKUNIY_TOPSHIRIQ_2026-09-25.md` §4.
Egasi: "Hamma hujjat maksimal va ideal aniq, HUJJAT kabi bo'lishi kerak — chernovik emas."

Konstitutsiya ustun: NULL ≠ 0, manba qiymati o'zgarmaydi, taxmin yo'q.

---

## 1. Standart (H1–H9)

| # | Talab | Mashina tekshiruvi |
|---|---|---|
| H1 | Asl hujjat asosida — asl fayl saqlanadi; yangi qism asl jadvalning DAVOMI (ustun formasi, uslub klon, raqamlash davom etadi, birlashmalar cho'ziladi). | `hujjatTekshir(bytes, { asl })` asl kataklarni bayt-bayt chiqarib tashlaydi; Oferta testi: `F6` asl XML aynan; `fillSoni` o'zgarmaydi |
| H2 | Noldan hujjat — rasmiy shakl: sarlavha, titul (obyekt, buyurtmachi, pudratchi, davr/sana), jadval sarlavhasi (1–2 qator) + `1 \| 2 \| 3` raqamlash, ramka, ИТОГО/ВСЕГО qalin, `# ##0,00` / `# ##0,000`. | `RasmiyVaraq` shuni majburiy quradi; LibreOffice PDF/PNG ko'rinish |
| H3 | Imzo: ЗАКАЗЧИК / ПОДРЯДЧИК (+ ТЕХНАДЗОР / СОСТАВИЛ / ПРОВЕРИЛ), nom saytdan (bo'sh — chiziq), "(подпись)", "М.П." | `imzoRollariBormi(hisobot, rollar)` |
| H4 | Chop: A4, bitta sahifa eniga, `_xlnm.Print_Area` (hujjat + imzo), `_xlnm.Print_Titles` (sarlavha har sahifada), sahifa raqami. | `TekshirVaraq.a4/bittaEnli/printArea/printTitles`; LibreOffice PDF o'lchami |
| H5 | Texnik/dasturchi matni yo'q (TAYYOR, RESOURCE, `t2_*`, null, o'zbekcha lotin/kirill yorliq, inglizcha yorliq). Texnik ustun — yashirin. | `TAQIQLANGAN_QOIDALAR` bo'yicha grep = 0 (yashirin ustun/varaq chetda) |
| H6 | Formulalar tirik va nisbiy (`$` siz), keshlangan `<v>` bilan; `fullCalcOnLoad=1`; UI == Excel. | `dollarFormulalar = []`, `keshsizFormulalar = []`; `scripts/hujjat-lo-tekshir.mjs` — LibreOffice qayta hisoblash farqi 0 |
| H7 | Noma'lum joylar ochiq: "ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ (n)", yakuniy summa bo'sh — taxmin yo'q. | testlar: noma'lum narx/hajm → jami keshi `""` |
| H8 | Fayl nomi `<Obyekt>_<Hujjat>_<davr>.xlsx`; `.xls` manba — `saqlanish: 'qisman'`. | `hujjatFaylNomi` testlari |
| H9 | Rus tilidagi hujjat atamalari; o'zbekcha faqat egasining o'z matni (obyekt nomi, T1 LRV_PLUS sarlavhalari). | H5 qoidasi + `ruxsat` ro'yxati (faqat egasi matni) |

Istisnolar (egasining o'z matni, H9): obyekt nomi (saytdan); LRV_PLUS/Forma-2 (ЛРВ)
ustun sarlavhalari va `ТИП` belgilari (rz/bl/rs) — T1 LRV_PLUS faylidan aynan
olingan egasining shakli; LRV_PLUS ranglari — T1 `CFG.RANG`.

## 2. `frontend/src/lib/hujjat-yozuvchi/` API

| Fayl | Nima |
|---|---|
| `ooxml.ts` | `ustunHarfi`, `ustunIndeksi`, `xmlEsc`, `unEsc`, `sheetRef`, `sumArgs`, katak quruvchilar `strCell/numCell/fCell/bosCell` (`YangiHujayra`, `klon` uslubi) |
| `uslub.ts` | `appendToList`, `cellXfRoyxati`, `xfNusxa` (egasi uslubining nusxasi, faqat son formati), `zaxiraStillarQosh` (rangsiz), `fillSoni` |
| `varaq.ts` | Asl varaqni davom ettirish: `varaqXaritasi`, `boshUstun`, `varaqniPatchla` (birlashma cho'zish, `colBreaks` ko'chirish, `scale` moslash), `colsYoz`, `engOngUstun`, `sahifaEnigaSigdir` (faqat egasi sozlamasi yo'q bo'lsa) |
| `formula.ts` | `formulaKochir` (asl formulani yangi ustunga; koeffitsient katagi joyida qoladi), `aslFormula` |
| `kitob.ts` | `varaqYollari`, `workbookgaVaraqQosh`, `fullCalcYoq`, `printAreaKengaytir`, `definedNameQosh`, `printTitlesQiymati`, `printAreaQiymati`, `xlsdanXlsx`, `boshKeshQoy`, `chopNomlariAbsolyut` |
| `imzo.ts` | `imzoTomonlari(rollar, nomlar)`, `imzoMatni`, `IMZO_*` matnlari |
| `fayl-nomi.ts` | `hujjatFaylNomi({obyekt, hujjat, davr, kengaytma})`, `bugunSana` |
| `rasmiy.ts` | **Noldan rasmiy hujjat**: `new RasmiyVaraq({nom, sarlavha, ostSarlavha, titul, ustunlar, yonalish})` → `.qator(tur, qiymatlar\|(r)=>…, {daraja})`, `.bolim`, `.diqqat`, `.izoh`, `.imzo`; `rasmiyKitob([varaqlar])` → `{bytes, varaqlar}`; `sumFormula`, `yaxlit2` (Excel ROUND) |
| `tekshir.ts` | `hujjatTekshir(bytes, {asl, ruxsat})` — H1/H4/H5/H6 hisobot; `imzoRollariBormi` (faqat testlar va diagnostika) |

Ustun turlari (`UstunTuri`): `tartib, kod, matn, birlik, hajm, narx, pul, foiz,
norma, texnik` (+ `yashirin`, `guruh` — ikki qatorli sarlavha). Qator turlari:
`oddiy, ish, bolim, jami, vsego`. Uslublar rangsiz (fill yo'q): Times New Roman,
ingichka ramka, ВСЕГО — qalin chegara.

## 3. Hujjat turlari

| Hujjat | Kod | Asos | Ustunlar | Imzo | Chop |
|---|---|---|---|---|---|
| Tender oferta | `tender-oferta-export.ts` (+ `hujjat-yozuvchi` patch) | **Asl RES fayli (H1)** | asl jadval + КОЛ-ВО / ЦЕНА / СУММА (оферта) + yashirin КАТЕГОРИЯ; `OFERTA_JAMI` svod | ЗАКАЗЧИК, ПОДРЯДЧИК | asl print area kengayadi; Print_Titles; `<Obyekt>_ОФЕРТА_<sana>` |
| Oferta paket svodi | `tender-oferta-paket.ts` | noldan | №, Объект, Прямые затраты, ВСЕГО С НДС (оферта/смета), Разница, Примечание | ЗАКАЗЧИК, ПОДРЯДЧИК | A4 landshaft |
| LRV_PLUS / Forma-2 (ЛРВ) | `lrv-plus-export.ts` | T1 LRV_PLUS shakli | A..W (T1), yashirin Даража/КАЛИТ; RESURS_VEDOMOST (rus tilida); nakrutka kaskadi | ЗАКАЗЧИК, ПОДРЯДЧИК, СОСТАВИЛ | A4 landshaft, 1:3 takror, Print_Area A..W/P |
| Ведомость остатка работ | `ostatka-export.ts` | noldan, smeta shakli | №, Шифр, Наименование, Ед.; КОЛИЧЕСТВО (по смете / выполнено / остаток); СТОИМОСТЬ ОСТАТКА (цена / сумма) | ЗАКАЗЧИК, ПОДРЯДЧИК, СОСТАВИЛ | A4 landshaft |
| Накопительная ведомость | `nakopitelniy-vedomost-export.ts` | noldan | ПО СМЕТЕ, ФАКТ, ПРИНЯТО РАНЕЕ, ЗА ПЕРИОД, С НАЧАЛА, ОСТАТОК, МОЖНО ПРЕДЪЯВИТЬ | ЗАКАЗЧИК, ПОДРЯДЧИК, СОСТАВИЛ | A4 landshaft |
| Акт приемки (Форма № 2) | `f2-akt-tn-export.ts` | noldan, T1 TN Akt-2 shakli | №, Шифр, Наименование, Ед.; КОЛИЧЕСТВО (на ед. / по проектным); СТОИМОСТЬ (на ед. / общая); НДС, ВСЕГО С НДС | ЗАКАЗЧИК, ПОДРЯДЧИК, ТЕХНАДЗОР | A4 portret |
| Проект акта Ф-2 | `f2-native-export.ts` | noldan | за период (кол-во, цена, сумма по документу), Расчет, Отклонение, нарастающим итогом, Основание | ЗАКАЗЧИК, ПОДРЯДЧИК, ТЕХНАДЗОР | A4 landshaft |
| Ресурсная ведомость | `resurs-vedomost.ts` | noldan | ПО СМЕТЕ, ПРИНЯТО ПО АКТАМ Ф-2, ОСТАТОК (kategoriya ЧЕЛ→МАШ→МАТ→ОБ→КАБ→М/К) | ЗАКАЗЧИК, ПОДРЯДЧИК, СОСТАВИЛ | A4 landshaft |
| PTO hujjati (Ф-2/накоп./слич./Ф-3/М-29) | `pto-hujjat-export.ts` | noldan | turga qarab; ИТОГО faqat pul ustunida; Ф-3 yuridik jami yo'q | turga qarab | Excel + PDF |

Qo'shimcha qoidalar: pul faqat barglarda yig'iladi (bl/rz summasi takror — ikki marta
sanalmaydi); qirqilgan (`truncated`) RPC ro'yxatidan hujjat yasalmaydi; НДС stavkasi
berilmasa НДС va ВСЕГО С НДС bo'sh; Forma-3 yuridik jami — egasi qarori
(`ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md` Q1).

## 4. Tekshirish

- Birlik: har eksport uchun `*.hujjat.test.ts` (vitest, `hujjatTekshir`).
- LibreOffice: `HUJJAT_NAMUNA_DIR=/tmp/n npx vitest run hujjat` →
  `node scripts/hujjat-lo-tekshir.mjs /tmp/n` (qayta hisoblash farqi, PDF sahifa,
  o'lcham; salbiy nazorat: buzilgan kesh ushlanadi).
- Excel (Microsoft) va real fayllar — egasining ofis PC da (UNKNOWN shu muhitda).

## 5. Ustunlarni moslashuvchan tushunish (barcha o'quvchilar)

`smeta-anatomiya/ustun-dalil.ts`: sarlavha so'zi faqat nomzod; hajm/narx/summa uchligi
ma'lumotda `hajm × narx ≈ summa` bilan isbotlanadi; qo'shimcha ustunlar ro'yxati.
Ulangan: smeta anatomiyasi, F2 import (brauzer va `/api/smeta-yukla`, `/api/f2-moslash`),
Oferta RES, RES narxlash. Egasi so'rovi (2026-09-25).
