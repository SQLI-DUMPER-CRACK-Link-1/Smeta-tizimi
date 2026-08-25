# TIZIM_02 — QATLAM ARXITEKTURASI

> Vizyon va butun ekotizim: `ARXITEKTURA.md` (ildizda).
> Bu fayl faqat **Tizim_02 ning ichki tuzilishi** haqida:
> qaysi mantiq qayerda yashaydi va NEGA.

---

## 1. To'rt qatlam

```
┌─────────────────────────────────────────────────────────────┐
│  OYNA        React (frontend/src)                           │
│              Ko'rsatadi, so'raydi. HISOBLAMAYDI.            │
├─────────────────────────────────────────────────────────────┤
│  DARVOZA     Cloudflare Pages Functions (frontend/functions) │
│              Sessiya · rol · NOMLI amallar oq ro'yxati       │
├─────────────────────────────────────────────────────────────┤
│  HAQIQAT     Postgres / Supabase                             │
│              Ma'lumot + BARCHA moliyaviy qoida. Tranzaksiya. │
├─────────────────────────────────────────────────────────────┤
│  KO'PRIK     Google Apps Script (Smeta tizimi/T2_*.js)       │
│              Drive · Sheets · Excel · F2 dvigateli           │
└─────────────────────────────────────────────────────────────┘
```

### Nega qoida Postgresda, frontendda emas

Bu qoida qog'ozda emas — **narx evaziga** o'rganilgan.

F2 importda moslashtirish bir vaqtning o'zida uch joyda bor edi:
Tizim_01 dvigatelida, mening SQL funksiyamda va frontenddagi ball
tizimida. Uchtasi uch xil javob berardi. Frontenddagisida birlik
**darvoza emas, 10 ball** edi — «АРМАТУРА/Т» ↔ «АРМАТУРА/КГ» jimgina
bog'lanardi: **1000 baravar xato**.

Shuning uchun: **bitta mantiq — bitta joy.** Frontend takrorlamaydi.

### Nega GAS butunlay olib tashlanmaydi

`.xlsx` ni faqat qiymat bilan ochish (`#REF!` himoyasi), MIME
xavfsizligi, uchta akt shabloni uchun ustun avtoaniqlash, F2
moslashtirish dvigateli — bularning **har biri** haqiqiy moliyaviy
xatodan keyin sozlangan. Ularni Postgresga qayta yozish yutuq emas,
**yo'qotish**. GASdagi funksiya `REGISTR.json` da `qatlam: "GAS"`
deb belgilanadi va u **qarz emas**.

---

## 2. Umumiy primitivlar — yangisini o'ylab topmang

Yangi RPC yozayotgan agent shularni **takrorlaydi**, o'z yo'lini emas.

| Primitiv | Qayerda | Nima uchun |
|---|---|---|
| **Idempotentlik** | jadvalda `operation_id uuid` + partial unikal indeks (`t2_akt`, `t2_qator`) | Tarmoq uzilib qayta yuborilsa ikkinchi hujjat/qator yaralmasin |
| **Optimistik qulf** | `versiya` ustuni + `p_kutilgan_versiya` | Oxirgi yozuvchi yutmasin — ziddiyat XATO qaytarsin |
| **Audit** | `t2_ozgarish` (trigger, avtomatik) | Kim/qachon/nima. Qo'lda yozilmaydi |
| **Manba belgisi** | `t2_manba_belgila('rollup'\|'frontend'\|…)` | O'zgarishni kim qilgani jurnalga tushsin |
| **Kategoriya** | `t2_kat_birlik(birlik, nom)` | ЧЕЛ/МАШ **faqat birlikdan**; tanlov bosib o'tolmaydi |
| **Kalitlar** | `t2_nom_key` / `t2_birlik_key` (generated ustunlar) | Solishtirish bir xil qoida bilan |
| **Jamlash** | `t2_rollup(obyekt_id)` | rz ← (bl\|mat\|ob\|rs); bl ← rs |
| **Son** | `t2_son(text)` | Vergul/probel/apostrof bilan kelgan raqamlar |

---

## 3. Uchta qat'iy invariant

### 3.1 Narx o'zidan to'qilmaydi
`narx IS NULL → summa NULL`. Bu `t2_akt_qator.summa` da **generated
ustun** bilan mustahkamlangan — kod xato qilsa ham baza yo'l qo'ymaydi.
`t2_qator_qosh` narxni topa olmasa `NULL` qoldiradi, **0 emas**:
0 «bepul» degani.

`t2_akt_yarat` odatda narx berilmasa smeta narxini oladi (qo'lda akt
yasashda to'g'ri). F2 IMPORTda esa hujjat tashqi — u yerda
`narx_yoq: true` beriladi va fallback o'chadi.

### 3.2 f2 ≤ fakt ≤ smeta
Yig'indi bo'yicha, bitta hujjat bo'yicha emas. Buzilsa yozilmaydi va
**qaysi qator** buzgani aytiladi. `p_majburiy` bilan ataylab o'tkazish
mumkin (faqat admin), lekin buzilish ro'yxati baribir qaytadi —
**jim o'tmaydi**.

### 3.3 Manfiy hajm bloklanmaydi
ПЕРЕРАСЧЁТ haqiqiy hujjat. Tekshiruv `> 0` emas, yig'indi chegarasi
bo'yicha. Bu tizimda `> 0` sharti **to'rt joyda** manfiy tuzatishni
yo'qotgan.

---

## 4. Ma'lumot oqimi

```
Excel (.xls/.xlsx)
   │  apiT2FaylYukla → t2_manba + t2_xom     [GAS: Drive, ZIP imzo, #REF!]
   ▼
t2_markirovka(manba_id)                      [Postgres: rz/bl/rs/mat/ob]
   │  ⚠️ NORMA ≠ HAJM — 5-ustun norma, 6-ustun hajm; hajm HISOBLANADI
   ▼
t2_narx_svodkadan(manba_id) → t2_narx        [narxlash]
   │  ⚠️ topilmasa NULL — 0 emas
   ▼
t2_rollup(obyekt_id) → t2_qator.summa        [jamlash]
   │
   ├──▶ t2_daraxt (view) ──▶ frontend
   ├──▶ ИШЧИ СМЕТА (Sheets ko'zgu, ikki tomonlama)
   └──▶ t2_akt_yarat ──▶ t2_akt / t2_akt_qator ──▶ F2 / Fakt hujjatlari
              ▲
              │  T2_F2Import.js  →  f2MoslashEngine   [GAS: 35_F2Moslash.js]
        tashqi F2 Excel fayli
```

---

## 5. Yozish eshigi ataylab TOR

Frontend ixtiyoriy SQL yubora olmaydi. `functions/api/sb-yoz.ts` da
**nomli amallar** ro'yxati bor va RPC nomi so'rov tanasidan
qurilmaydi. Yangi amal qo'shish = shu faylga ataylab kod yozish
**va** `t2_kompaniya.test.cjs` dagi ro'yxatni yangilash. Ya'ni eshik
**jimgina kengayolmaydi**.

O'qish eshigi (`sb.ts`) kengroq bo'lishi mumkin, lekin u ham oq
ro'yxatli va faqat `t2_*` ko'rinishlarini beradi.

---

## 6. Ko'chirish holati va navbat

| Fayl | Nima |
|---|---|
| `tizim02/REGISTR.json` | Har bir `api*` funksiya: domen · qatlam · holat · nima qopladi |
| `tizim02/KEYINGI.md` | Odam o'qiydigan navbat va keyingi ish |
| `tizim02/tasnif.json` | **Qo'lda** to'ldiriladigan tasnif |
| `tizim02/registr.gen.cjs` | Generator (`--tekshir` bilan drift nazorati) |
| `tizim02/AGENT.md` | AI agent shartnomasi |
| `tizim02/MULOQOT.md` | Ikki agent orasidagi reja va xabarlar jurnali |
| `tizim02/navbat.json` | Hudud: kim qaysi domenni olgan |
| `tizim02/sinov/*.sql` | Bazadagi qoidalar uchun qabul testlari |

⚠️ `REGISTR.json` **koddan** yasaladi. `t2_registr.test.cjs` uni har
safar qayta yasab solishtiradi — eskirsa test yiqiladi. Qo'lda yozilgan
xarita birinchi kunidayoq eskiradi va «hammasi ko'chirildi» degan soxta
tasavvur beradi.

---

## 7. Sinov qatlamlari

| Nima sinaladi | Qayerda | Qanday |
|---|---|---|
| Frontend/ko'prik qoidalari | `frontend/testlar/*.test.cjs` | `node testlar/hammasi.cjs` |
| F2 moslashtirish | `t2_f2import.test.cjs` | **Haqiqiy dvigatel** `vm` ichida |
| Bazadagi qoidalar | `tizim02/sinov/*.sql` | Haqiqiy RPC chaqiruvi, sinov obyektida |
| Ko'chirish xaritasi | `t2_registr.test.cjs` | Generator bilan solishtirish |
| F2 fayl o'qish | `_f2lab/` | Deploysiz, Node'da haqiqiy GAS kodi |

⚠️ **Regex testiga ishonmang.** «Filoncha funksiya chaqirilyaptimi»
degan tekshiruv noto'g'ri amalga oshirishda ham YASHIL bo'ladi —
bu loyihada aynan shunday bo'lgan. Xatti-harakatni sinang.
