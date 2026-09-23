# SMETA_ANATOMIYA_V1 — yagona smeta tushunish moduli

Status: **taklif (egasi yo'nalishni 2026-09-23 da ma'qulladi), implementatsiya boshlanmoqda.**
Task: `SMETA-ANAT-001` · Branch: `claude/smeta-anatomiya-v1` · Mashina: noutbuk.

## 1. Muammo (o'lchangan dalil)

Bitta smeta faylini hozir kamida besh xil kod mustaqil o'qiydi:

| Funksiya | O'qish kodi |
|---|---|
| Smeta yuklash | `SmetaYuklaNative.tsx` + `smeta-source-analysis.ts` + `smeta-lrv-boundary.ts` |
| F2 import | `lib/f2-import-parse/*` |
| Tender oferta | `lib/tender-oferta-parser.ts` |
| RES narxlash | `lib/res-narxlash.ts` |
| LRV eksport | `lib/lrv-plus-export.ts` (o'z yozish usuli) |

Oqibatlari (egasi va real fayllar bilan tasdiqlangan):

1. **RZ tekis.** `f2-import-parse/treeBuild.ts` da bitta `currentRz`, `api/supabase.ts` da
   bitta `rzNom`. Ketma-ket sarlavhalar (`ОЗЕРА → КАНАЛ 1 → КЖ`) dan faqat oxirgisi qoladi.
   Baza esa daraxtni ko'taradi (`t2_qator.ota_id`, `daraja`) — muammo o'qish qatlamida.
2. **Ustun va varaq roli har funksiyada boshqacha aniqlanadi**; birida tuzatilgan xato
   boshqasida qoladi (masalan oferta parserida kod ustunidagi `ЦЕНА` qiymati narx
   ustuni deb olindi).
3. **Yuklashning uch yo'li (bitta fayl / ko'p fayl / papka) uch xil UI va oqim.**
4. **Katta smeta (27 309 qator) sahifani qotiradi**; Web Worker umuman yo'q.

### Real korpusdan kuzatuvlar

**ABC4 lokal (`*_ALL_*.xls`)** — varaqlar `RES`, `F5_UZB`, `RES_A`, `LRV`:
- `LRV`: `РАЗДЕЛ: <nom>` (RZ), raqamsiz matn qatorlari (`ЗЕМЛЯНЫЕ РАБОТЫ`, `КМ-1`, `Р-1`) — blok,
  `1`,`2` — ish, `1.1`,`1.2` — resurs. Oxirida `ВЕДОМОСТЬ РЕСУРСОВ` bloki — **ish emas**.
- `F5_UZB`: xuddi shu, lekin `РАЗДЕЛ 1: <nom>` raqamli va ustunlar siljigan.
**ABC4 yig'ma (`*_OB_ALL_SM_*`, `*_STR_ALL_SM_*`)** — bir xil `РАЗДЕЛ:` prefiksi uch darajani bildiradi:
```
РАЗДЕЛ: СМЕТА № 01-01 НА КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА   ← lokal smeta
РАЗДЕЛ: КОЛОННА (ЛИСТ.-16)                             ← haqiqiy RZ
КМ-1                                                   ← blok
```
Obyekt darajasi (`ИСКУССТВЕННАЯ ОЗЕРА`) LRV da **yo'q** — u `*_CB_DET2_*` (svod) da:
obyekt sarlavhasi, keyin lokal smetalar ro'yxati va har birining mehnat sarfi (чел-ч).
Bu **isbotlanadigan bog'lanish**: STR dagi har `СМЕТА №` blokining `ЗАТРАТЫ ТРУДА` yig'indisi
svoddagi qiymatga teng bo'lishi shart.

**ABC4 yo'l (Faravon)** — varaqlar `NNNN_БВ` (vedomost/LRV), `NNNN_БР` (RES), `сводн.`,
`трансп.`, ba'zan `_ЛРВ`/`_РС`. Ierarxiya **raqam prefiksi** bilan, lekin toza emas:
```
1.ВОДОООТВОД                         d1
1.1.УСТАНОВКА НОВЫХ КЮВЕТНЫХ ЛОТКОВ   d2
3.2.УСТРОЙСТВО ОСТРОВКОВ              d2
1.ДОРОЖНАЯ ОДЕЖДА.                    d3  ← raqamlash qaytadan boshlangan
В).УСТАНОВКА Ж/Б БЛОКОВ               harfli belgi
10.ОБУСТРОЙСТВО ДОРОГИ. → ДОРОЖНЫЕ ЗНАКИ → УСТАНОВКА НОВЫХ ДОРОЖНЫХ ЗНАКОВ  (raqamsiz zanjir)
```
Varaqda Excel outline (guruhlash) bor — qo'shimcha dalil.

**Sun'iy ko'l**: LRV — TN Qurilish, RES — ABC4 (egasi ma'lumoti). Demak **format varaq
darajasida** aniqlanadi, fayl darajasida emas.

**Erkin hisob varaqlari**: perevozka, badiiy ishlar, shefmontaj — LRV ham, RES ham emas.

## 2. Qonunlar (o'zgarmas)

1. **Matn o'zgarmaydi.** Har tugun asl matnni (`xom`) aynan saqlaydi; qidiruv uchun alohida
   `kalit`. Ko'rsatish va eksportda doim `xom`.
2. **Har tugun manzilga ega**: fayl, varaq, qator, ustun. Manzilsiz qiymat yo'q.
3. **NULL ≠ 0.** Bo'sh katak `null`. Noma'lum pul → REVIEW.
4. **Taxmin qilinmaydi.** Dalil yetarli bo'lmasa — `ishonch: 'past'` + sabab, operator hal
   qiladi. AI tasniflashda yordam beradi, lekin qaror deterministik qoida yoki operator.
5. **Manba bayt-bayt saqlanadi.** Yozish faqat asl faylni davom ettiradi (§7).
6. **Bitta modul, ko'p iste'molchi.** Hech bir sahifa `XLSX.read`/`sheet_to_json` ni
   to'g'ridan-to'g'ri chaqirmaydi (lint qoidasi bilan majburlanadi, §9).

## 3. Modul tuzilishi

```
frontend/src/lib/smeta-anatomiya/
  oqish/        kitob o'qish (xls/xlsx/xlsm), kataklar + uslub + merge + outline, Worker ichida
  varaq/        varaq roli: lrv | res | res_alt | f5 | svod | titul | transport | erkin | vedomost_blok
  format/       format dalillari: abc4 | tn | lrv_plus | foydalanuvchi | noma'lum (varaq bo'yicha)
  ustun/        ustun xaritasi (sarlavha + ma'lumot shakli bo'yicha, bir martalik)
  ierarxiya/    RZ yo'li quruvchi (§5)
  jami/         ИТОГО/ВСЕГО tekshiruvi, svod bilan bog'lash
  profil/       tasdiqlangan format profillari (§6)
  yozish/       asl faylni davom ettiruvchi OOXML patch (§7)
  korpus/       golden test harness (§8)
  index.ts      smetaAnatomiya(fayllar) → SmetaAnatomiya
```

## 4. Chiqish modeli

```ts
type Manzil = { fayl: string; varaq: string; qator: number; ustun?: number };
type Dalil  = { qoida: string; ishonch: 'yuqori' | 'orta' | 'past'; izoh: string };

type Sarlavha = {            // RZ yo'lining bir bo'g'ini
  xom: string; kalit: string; manzil: Manzil;
  daraja: number;            // 1..n, yo'l ichidagi joyi
  tur: 'qurilish' | 'obyekt' | 'lokal' | 'razdel' | 'blok' | 'guruh';
  belgi?: string;            // "1.", "3.2.", "РАЗДЕЛ 1", "В)"
  dalil: Dalil[];
};
type Ish    = { tartib: string; shifr?: string; xom: string; birlik?: string; hajm: number | null;
                rzYol: Sarlavha[]; manzil: Manzil; resurslar: Resurs[] };
type Resurs = { tartib: string; kod?: string; xom: string; birlik?: string;
                normaBirlikka: number | null; hajm: number | null; narx: number | null;
                summa: number | null; kategoriya: Kategoriya | 'UNKNOWN'; manzil: Manzil };
type ErkinVaraq = { varaq: string; yakuniySumma: { qiymat: number; manzil: Manzil } | null;
                    svodQatori?: Manzil; holat: 'kutmoqda' | 'yaxlit_qator' | 'svodga' | 'ilova' };

type SmetaAnatomiya = {
  fayllar: FaylAnatomiya[];  // har varaq: rol, format, ustunlar, dalillar
  daraxt: Sarlavha-tugunlari → Ish → Resurs;
  resursVedomost: Resurs[];  // RES/RES_A/ВЕДОМОСТЬ РЕСУРСОВ (ish daraxtidan alohida)
  erkin: ErkinVaraq[];
  jamilar: JamiTekshiruv[];  // manba summa vs hisoblangan, farq
  review: ReviewBand[];      // hal qilinmagan har narsa, sababi bilan
};
```

`t2_qator` ga yozishda `Sarlavha` zanjiri `tur='rz'` tugunlari sifatida (`ota_id` orqali
ichma-ich) yoziladi — yangi jadval kerak emas; `bl` va resurslar o'z joyida.

## 5. RZ yo'li algoritmi

Sarlavha qatorlari bitta **stek** bilan qayta ishlanadi. Har qator uchun dalillar:

| # | Dalil | Misol | Ta'siri |
|---|---|---|---|
| D1 | Aniq daraja kalit so'zi | `СМЕТА №`, `ОБЪЕКТ`, `РАЗДЕЛ` | `lokal` > `razdel` tartibi |
| D2 | Raqam prefiksi chuqurligi | `1.` / `1.1.` / `1.1.1.` | chuqurlik = nuqtalar soni |
| D3 | Raqamlash qayta boshlanishi | `3.2.` ostida `1.` | joriy tugunning bolasi |
| D4 | Ketma-ket sarlavhalar (orada ish yo'q) | `КЛ-0,4КВТ` → `РАЗДЕЛ 1` → `ЗЕМЛЯНЫЕ` | har keyingisi — bola |
| D5 | Yopuvchi jami | `ИТОГО ПО РАЗДЕЛУ …` | stekdan chiqarish |
| D6 | Excel outline darajasi | `!rows[].level` | tasdiqlovchi |
| D7 | Uslub (qalinlik, merge, shrift) | xlsx da | faqat teng dalillarda hal qiluvchi |
| D8 | Svod/OB bilan moslik | CB_DET2 obyekt ro'yxati + чел-ч | obyekt darajasini qo'shadi |

Qoidalar:
- Ishdan keyin kelgan raqamsiz sarlavha → oxirgi raqamsiz sarlavhaning **qo'shnisi**
  (`ishonch: 'orta'`); agar D4/D6/D7 qarshi bo'lsa → `past` + REVIEW.
- `ВЕДОМОСТЬ РЕСУРСОВ`, `ТРУДОВЫЕ РЕСУРСЫ`, `СТРОИТЕЛЬНЫЕ МАШИНЫ…` — ish daraxtini yopadi,
  sarlavha emas.
- Hech qachon sarlavha tashlab yuborilmaydi: har biri o'z manzili bilan daraxtda qoladi.

## 6. Profil — modul qanday "o'rganadi"

Operator tasdiqlagan tuzilma **profil** bo'ladi: varaq imzosi (sarlavha matnlari xeshi +
ustun tartibi + varaq nomi naqshi) → rol, ustun xaritasi, sarlavha qoidalari. Keyingi faylda
imzo mos kelsa, profil qo'llanadi (`dalil: 'profil:<id>'`). Profillar kompaniya bo'yicha
bazada saqlanadi, versiyalanadi, audit qilinadi. Profil hech qachon qiymat o'ylab topmaydi —
faqat "qaysi katak nima" ni aytadi.

## 7. Yozish — asl hujjatni davom ettirish

- Asl ZIP qismlari bayt-bayt saqlanadi; o'zgargan varaqda barcha asl `<c>` hujayralar identik.
- Yangi ustunlar eng o'ng ustundan keyin. Uslub **qo'shni asl ustundan klonlanadi**
  (shrift, chegara, son formati, qator balandligi). Yangi rang/uslub o'ylab topilmaydi;
  egasining ranglari tegilmaydi.
- `.xls` → xlsx ga aylantirish `qisman` deb belgilanadi va UI da aytiladi.
- Oferta, Ostatka, Nakopitelniy, F2 eksportlari shu yozuvchidan foydalanadi.

## 8. Korpus va golden testlar

- Real fayllar **repoga qo'yilmaydi** (repo public). Lokal papka + `korpus/manifest.json`
  (sha256, format, kutilgan: varaq rollari, RZ yo'llari soni va matnlari, ishlar, resurslar,
  jamilar).
- `npm run korpus` — har fayl uchun anatomiyani hisoblab manifest bilan solishtiradi.
  Fayl mashinada yo'q bo'lsa → `REAL_BINARY_UNKNOWN`, soxta PASS emas.
- Sintetik minimal testlar (repoda) har dalil D1–D8 va har rol uchun.

## 9. Iste'molchilarni ko'chirish

Tartib: **Oferta → Smeta yuklash (yagona liniya) → Fakt/Ostatka → F2 import → RES narxlash →
Nakopitelniy**. Har bosqichda: eski va yangi natija korpusda solishtiriladi; yangi ≥ eski
isbotlangandan keyin almashtiriladi; eski parser o'chiriladi. Oxirida lint qoidasi:
`smeta-anatomiya/oqish` dan tashqarida `xlsx` import qilish taqiqlanadi.

**Yagona yuklash liniyasi:** bitta fayl / ko'p fayl / papka → `Fayl[]` → `smetaAnatomiya()`
→ bitta ko'rib chiqish ekrani (varaq rollari, RZ daraxti, review bandlari, erkin varaqlar)
→ tasdiq → bitta server buyrug'i.

## 10. Unumdorlik (P0)

- O'qish va anatomiya **Web Worker** da; asosiy oqim faqat natijani oladi.
- Har ro'yxat/daraxt virtualizatsiyalangan; daraxt dangasa ochiladi.
- 27 309 qatorli fayl bilan o'lchov: yuklash, ko'rish, fakt, F2 — har sahifa uchun
  "uzun vazifa" (>50 ms) soni va eng uzuni. Tuzatish o'lchovdan keyin.

## 11. Ochiq savollar

1. Sun'iy ko'l `_ALL_` fayllaridagi `LRV`/`F5_UZB` (TN) va `RES`/`RES_A` (ABC4) varaqlarini
   farqlovchi **ishonchli belgi** hali aniqlanmadi (varaq nomi yetarli emas). Egasi bilan
   bitta faylda belgilab olinadi va profilga yoziladi.
2. Profillar kompaniya bo'yicha yoki global? (taklif: kompaniya, global — faqat tizim profillari).
3. Erkin varaq yaxlit qatorining birligi va kategoriyasi — operator tanlaydi, standart yo'q.
