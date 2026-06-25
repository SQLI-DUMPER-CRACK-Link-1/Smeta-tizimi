# 🔄 SUPABASE SINXRONIZATSIYA — ANIQ XARITA (nima kerak / nima kerak emas)

> **Maqsad:** GAS (Sheets) = dvigatel; Supabase = "miya" (tez o'qish, realtime, AI, frontend).
> Har soatda **to'liq va ideal** ma'lumot Supabase'ga yetib boradi — hech narsa yo'qolmaydi,
> ortiqcha narsa ham bormaydi. Bu fayl — aniq DATA CONTRACT (kim, nima, qachon, qayerdan).
>
> Tamoyil: **faqat HISOBLANGAN QIYMATLAR** ko'chiriladi (formula EMAS). Sheets aniq hisoblaydi →
> Supabase saqlaydi → frontend/AI o'qiydi. Asos: `Smeta tizimi/70_Supabase.js`.

---

## 1. ✅ KERAK — Supabase jadvallari (push qilinadi)

Har jadval: **maqsad · asosiy ustunlar · MANBA (GAS) · sinx chastotasi**.
Chastota: **E**=event (o'zgarganda darhol) · **H**=soatlik trigger · **N**=kunlik to'liq reconcile.

| # | Jadval | Maqsad | Asosiy ustunlar | Manba (GAS) | Chastota |
|---|--------|--------|-----------------|-------------|:---:|
| 1 | **obyektlar** | dashboard + 3D (har obyekt jami) | nom(PK), locked, smeta, chel, mash, mat, ob, mk, kab, fakt, f2, qoldiq, progress, f2pct, **shartnoma_no**, sana | DASHBOARD / `apiBossData` + bog' | E+H+N |
| 2 | **holat** | drill-down (bl/mat/rs qatorlar) | obyekt, varaq, qator, tur, nom, birlik, smeta_hajm, narx(rs birlik), fakt, f2ol(bl/mat), qoldiq, smeta_pul, st_fakt, st_f2, **kategoriya**(rs kat), razdel | LRV_PLUS / `apiHolatOl` | E + H(dirty) + N |
| 3 | **oylik_f2** (КС-2 trend) | oylik Ф2 qiymati | obyekt, oy, qiymat | `apiBossObyekt`.oylar | E+H+N |
| 4 | **narxlar** | markaziy narx registri | nom_key(PK), nom, birlik, kat, belgilangan, smeta_max, tizim | NARXLAR / `_narxlarHisob` | H+N (+narx save) |
| 5 | **material_kerak** | har obyekt material EHTIYOJI (Viborka uchun) | obyekt, **material_key**, nom, birlik, kat, kerak_hajm, narx | РЕСУРСЛАР / holat agregatsiya | E+H+N |
| 6 | **shartnoma** ⭐BUX | dogovor + накрутка + **buxgalteriya** (НДС, dog_summa, bajarilgan%, qoldiq) | no(PK), nomi, taraf, smeta, fakt, f2, nakrutka_vsego, nds, dog_summa, qoldiq, bajarilgan_pct, holat | ШАРТНОМА / `apiShartnomaDashboard` | H+N (+save) |
| 7 | **akt** | REYESTR (скрытых работ) | act_id(PK), obyekt, work_name, act_number, sana, status, komissiya, act_url, pdf_url, **ish_key**(bog') | **Akt generator** REYESTR | H (Akt loyihasidan) |
| 8 | **viborka_nazorat** | Viborka MUSTAQIL material nazorati (kerak/kelgan/deficit) | material_key, nom, birlik, plan, qabul, narx, summa, qoldiq, foiz, holat, postavshik, zamena | Viborka Nazorat sahifasi | H |
| 8b | **prixod** | kelgan material ledger (sklad kirim) | id, nom, razdel, birlik, hajm, narx, summa, ostatka, sana, postavshik | tashqi Prixod Sheet / `apiPrixodOl` | H |
| 12 | **tolovlar** ⭐BUX | pul harakati (avans/to'lov/qaytarim) → debitor/kreditor | id, sana, shartnoma_no, obyekt, summa, tur, izoh | ТЎЛОВЛАР varaq / `apiTolovOl` | E+H |
| 9 | **anomaliya** | nazorat invariant buzilishi (2.5-bo'lim 8 qoida) | id, obyekt, qoida, tavsif, qiymat, daraja, sana, hal | invariant skaner (B5.1) | E+H |
| 10 | **topilmaganlar** | narx topilmagan resurslar (MISS) | obyekt, nom, birlik, tur, sana | `_NARX_LOG` | E+H |
| 11 | **tarix** | audit jurnali (kim/qachon/nima) | obyekt, varaq, qator, nom, tur, qiymat, kim, vaqt | `apiHolatSaqla` va b. | E (append) |

> **✅ BAJARILDI (2026-06-19) — HAMMA 11 JADVAL ULANDI:**
> - **Smeta** (`70_Supabase.js`): 1 obyektlar · 2 holat · 3 oylik_f2 · 4 narxlar · 5 material_kerak ·
>   6 shartnoma · 9 **anomaliya** (invariant skaner) · 10 topilmaganlar · 11 tarix +
>   **soatlik sinx + dirty-tracking + soatlik/kunlik trigger**.
> - **Akt generator** (`Supabase.js`): 7 **akt** (REYESTR) + soatlik trigger.
> - **Viborka** (`Supabase.js`): 8 **viborka_nazorat** (TO'LIQ: kerak/kelgan/deficit/holat) + soatlik trigger.
>
> ⚠️ **MUSTAQILLIK QARORI (2026-06-19):** Smeta va Viborka material nomlari har xil yoziladi →
> ataylab **ulanmaydi**. Har tizim o'zicha to'liq ishlaydi: Viborka deficitni **O'ZIDA** hisoblaydi
> (План−Қабул), Smeta `material_kerak` faqat o'z analitikasi uchun. material_key — har tizimning ICHKI dedup kaliti.

---

## 2. ❌ KERAK EMAS — Supabase'ga YOZILMAYDI

| Nima | Nega |
|------|------|
| **Formulalar** (SUMIF, =A1*B1…) | Faqat hisoblangan QIYMAT kerak; formula Sheets'da qoladi |
| **LRV_PLUS xom struktura, `_BAK_`, `_TMP_`, `Sheet1`** | Ichki/vaqtinchalik; `holat` jadvali yetarli |
| **SOZLAMALAR_* (BOGLASH, ОРАЛИҚ, KATEGORIYA, СТАВКА, НАКРУТКА)** | Sozlama/konfiguratsiya — Sheets'da boshqariladi, analitika emas |
| **_KESH varaqi** | GAS ichki keshi (Supabase o'zi kesh vazifasini bajaradi) |
| **Format/rang/uslub, ustun kengligi, merge** | Yuridik hujjat Sheets'da; Supabase = raqam |
| **Excel/svod xom fayllar, chizmalar (binar)** | Storage'da (kerak bo'lsa), jadvalga emas |
| **API kalitlar, service_role, parollar** | Maxfiy — faqat serverda (Script Property), hech qachon jadvalga emas |
| **Ф2 har oyning 3 xom ustuni (formula bilan)** | `oylik_f2` ga tayyor {hajm,narx,summa} yoziladi |

**Qoida:** agar ma'lumot (a) ko'rsatiladigan/qidiriladigan/tahlil qilinadigan bo'lsa → KERAK.
(b) ichki hisob/sozlama/format/maxfiy bo'lsa → KERAK EMAS.

---

## 3. ⏱️ SINX ARXITEKTURASI — 3 QATLAM (to'liq + ideal)

```
EVENT (darhol)          HOURLY (soatlik)            NIGHTLY (kunlik 03:00)
─────────────────       ──────────────────          ──────────────────────
Ишла → o'sha obyekt     supabaseSoatlikSinx():       supabaseToliqSinx():
FAKT/Ф2 save → obyekt   • dashboard (yengil)         • HAMMA obyekt to'liq
 + tarix                • narxlar, shartnoma          • barcha jadval reconcile
narx/shart save         • DIRTY obyektlar holat       • "yo'qolgan" ni tuzatadi
                        • anomaliya qayta skan
                        • material_kerak, topilmagan
```

### Dirty-tracking (ideal samaradorlik)
- Har o'zgarishda (`_holatInvalidate`) obyekt **"dirty"** belgilanadi: Script Property `SB_DIRTY`.
- Soatlik sinx: faqat **o'zgargan** obyektlar `holat`/`material_kerak` ni push qiladi → ortiqcha LRV ochilmaydi.
- Dashboard + narxlar + shartnoma — har soatda yengil push (DASHBOARD/NARXLAR varaqlaridan, LRV ochmasdan).
- Hech narsa o'zgarmasa — soatlik sinx deyarli bepul (faqat dashboard).
- **Kafolat:** event o'tkazib yuborilsa ham → soatda dirty orqali, har tunda to'liq reconcile orqali tutiladi → **hech narsa yo'qolmaydi.**

### Triggerlar (50_Navbat.js / 70_Supabase.js)
```
ScriptApp.newTrigger('supabaseSoatlikSinx').timeBased().everyHours(1)
ScriptApp.newTrigger('supabaseToliqSinx').timeBased().everyDays(1).atHour(3)
```
Bir marta: `supabaseTriggerOrnat()` o'rnatadi.

### Ishonchlilik
- Har push `try/catch` + `tarix`/log (xato bo'lsa keyingi sinx tuzatadi).
- Upsert (merge-duplicates) — takror push xavfsiz.
- `updated_at` har qatorda — frontend realtime + "qachon yangilandi" ko'radi.

---

## 4. KIM NIMA PUSH QILADI (3 loyiha mas'uliyati)

| Loyiha | Push qiladigan jadvallar | Mexanizm |
|--------|--------------------------|----------|
| **Smeta tizimi** ⭐ | obyektlar, holat, oylik_f2, narxlar, material_kerak, shartnoma, anomaliya, topilmaganlar, tarix | `70_Supabase.js` + soatlik/kunlik trigger |
| **Akt generator** | akt (REYESTR) | `Akt generator/Supabase.js` + soatlik trigger |
| **Viborka** | viborka_nazorat (TO'LIQ, MUSTAQIL) | `Viborka/Supabase.js` + soatlik trigger |

> Har loyiha **bitta** Supabase URL + service_role kalitga yozadi (umumiy hub — bir xil ulanish).
> ⚠️ Lekin **ma'lumotlar MUSTAQIL** — material nomlari har tizimda har xil yozilgani uchun
> Smeta↔Viborka materiallari **ataylab ulanmaydi**. Har biri o'z to'liq rasmini beradi; nazoratni
> o'z ichida hisoblaydi. Umumiy kalit faqat **obyekt.nom** darajasida (obyekt nomi barqaror).

---

## 5. IMPLEMENTATSIYA REJASI (koddan)

**✅ S1 — Schema:** 6 yangi jadval (material_kerak, shartnoma, topilmaganlar, akt, prixod, anomaliya)
+ RLS + realtime + indekslar `supabase_schema.sql` ga qo'shildi.

**✅ S2 — 70_Supabase.js:**
- `supabaseMaterialKerakPush(ob)` (holat daraxtidan agregatsiya, material_key),
  `supabaseTopilmaganPush(ob)` (_NARX_LOG), `supabaseShartnomaPush()` (apiShartnomaDashboard).
- `supabaseSoatlikSinx()` — dashboard+narxlar+shartnoma (yengil) + DIRTY obyektlar holat/material/topilmagan.
- Dirty: `_sbDirty(ob)` (`_holatInvalidate` ichida) + `_sbDirtyOl/Tozala`.
- `supabaseTriggerOrnat()` / `supabaseTriggerOchir()` — soatlik + kunlik (03:00) trigger.
- `supabaseToliqSinx()` kengaytirildi (material_kerak, topilmagan, shartnoma + dirty tozalash).

**▶️ ISHGA TUSHIRISH (bir marta):** Apps Script editor → Run:
`supabase_schema.sql` (SQL Editor da RUN) → `supabaseSozlash(url,key)` → `supabaseToliqSinx()` →
**`supabaseTriggerOrnat()`** (soatlik avtomatik boshlanadi).

**✅ S3 — Akt generator** (`Akt generator/Supabase.js`): `aktSupabasePush()` (REYESTR → akt),
`aktSupabaseSozlash`, `aktTriggerOrnat` (soatlik), `aktSupabaseTest`.

**✅ S4 — Viborka** (`Viborka/Supabase.js`): `vibSupabasePush()` (TO'LIQ Nazorat → viborka_nazorat),
`vibSupabaseSozlash`, `vibTriggerOrnat` (soatlik), `vibSupabaseTest`. MUSTAQIL — Smeta'ga bog'liqsiz.

**✅ Anomaliya skaner** (Smeta `supabaseAnomaliyaPush(ob)`): obyekt darajasi (F2>SMETA, FAKT>SMETA,
F2>FAKT, OSTATKA<0) + qator darajasi (hajm oshishi soni) + narx topilmagan soni. Soatlik+to'liq sinxga ulangan.

**▶️ Akt va Viborka loyihalarida ham bir marta:** har birida `*SupabaseSozlash(url,key)` (BIR XIL hub) →
`*SupabasePush()` → `*TriggerOrnat()`.

---

## 6. AGENT UCHUN QISQA

- **Bor:** obyektlar, holat, oylik_f2, narxlar, tarix push (`70_Supabase.js`), event hook'lar.
- **Qo'shiladi:** 6 jadval (material_kerak, shartnoma, akt, prixod, anomaliya, topilmaganlar) +
  soatlik/kunlik trigger + dirty-tracking + Akt/Viborka push.
- **Sozlash:** `supabaseSozlash(url, service_role)` (bir marta) → `supabaseTriggerOrnat()`.
- **Qoida:** faqat qiymat (formula emas); maxfiy kalitlar jadvalga emas; umumiy kalit nom_key/obyekt.nom.

---

_Bog'liq: `ARXITEKTURA.md` (umumiy vizyon, ma'lumot modeli), `Smeta tizimi/70_Supabase.js`,
`Smeta tizimi/supabase_schema.sql`. Oxirgi yangilanish: 2026-06-18._
