# 📐 VIBORKA (МАТЕРИАЛ НАЗОРАТИ) — IDEAL ARXITEKTURA (Antigravity davom ettiradi)

> Material ta'minot/nazorat tizimini ekotizimga **ideal va kuchli** ulash. Bu hujjat — to'liq dizayn.
> Claude poydevorni qo'ydi (8-bo'lim), Antigravity 9-bo'limdagi bosqichlar bo'yicha davom ettiradi.
> Bog'liq: `AKT_ARXITEKTURA.md`, `PRIXOD_ARXITEKTURA.md`, `SUPABASE_SYNC.md`,
> `Smeta tizimi/CLAUDE.md`, `[[material-mustaqil-tizimlar]]`.

---

## 1. MUAMMO (hozir) va MAQSAD (ideal)

**Hozir:** Viborka — **alohida, kuchli GAS loyiha** (`Viborka/`), o'z spreadsheet'ida.
Smeta `45_Hujjatlar.js` faqat **havola** berardi ("мураккаб структура") → panelда ko'rinmasdi.
- ❌ Panel Viborka ma'lumotini ko'rsatmasdi, faqat hujjatga yo'naltirardi *(tuzatildi: Nazorat o'qiladi)*.

**Maqsad (ideal):**
1. Viborka material nazorati (План/Қабул/Қолдиқ/Ҳолат) **bevosita panelда va frontendда** ko'rinadi.
2. Deficit, замена, anti-fraud bayroqlari **ekotizimда** ko'rinadi (Supabase/dashboard).
3. Viborka **mustaqilligini saqlash** (material nomlari Smeta/Prixod bilan mos kelmaydi).

---

## 2. VIBORKA STRUKTURASI (mavjud, kuchli)

**Loyiha fayllari (`Viborka/`):**
- `0_Master_Triggers.js` — menyu (⚡ TITAN PRO), `fullRefresh`, tungi trigger (03:00).
- `1_CoreTitan_AI.js` — **yuragi**: `AI_NormalizeName` (lotin→kirill, o'lcham `10х100`, diametr `Ø12`,
  metall guruhi), `normalizeUnit`, `resolveDitto` ("то же" tiklash), `AI_Categorize`.
- `10_Nazorat.js` — **Nazorat varag'i** (asosiy): `1№ 2Материал 3Бирлик 4План 5Қабул 6Нарх
  7Сумма 8Қолдиқ 9% 10Сана 11Етказувчи 12Изоҳ 13Ҳолат 14Замена`. PTO "Қабул"ни kiritadi → qoldiq avtomat.
- `2_Dashboard.js`, `8_Home_Page.js` — dashboard/bosh sahifa.
- `3_Audit_AntiFraud.js` — **anti-fraud**: 🔴 birlik/narx yo'q · 🟠 перерасход >25% yoki narx >40% ·
  🟢 ≥98% yopilgan.
- `7_Filter_Reports.js`, `9_PDF_Export.js` — hisobotlar, PDF, email.
- `Supabase.js` — **Nazorat → `viborka_nazorat`** push (soatlik, mustaqil).

**Z_Obyekt sahifalar** — har obyekt bo'yicha material (avtomat yaratiladi).

**Ranglar (Nazorat conditional formatting):** 🟢 ≥98% · 🟡 <98% · 🔴 0 · 🔵 >105% · 🟣 замена.

---

## 3. ⭐ MUSTAQILLIK TAMOYILI (eng muhim)

⚠️ Material nomlari **Smeta / Prixod / Viborka**da **har xil yoziladi** (har tizim o'z normalizatsiyasi:
Smeta `_normNomKey` vs Viborka `AI_NormalizeName` — butunlay boshqa natija). Shuning uchun:
- Viborka **mustaqil** ishlaydi: deficitni **O'ZIDA** hisoblaydi (План − Қабул = Қолдиқ).
- **Smeta/Prixod bilan MAJBURIY ULANMAYDI.** "Yagona material katalog" g'oyasi RAD etilgan
  (foydalanuvchi qarori — `[[material-mustaqil-tizimlar]]`).
- Ekotizimda har tizim o'z to'liq rasmini beradi; nazorat o'z ichida.

---

## 4. DATA OQIMI

```
СМЕТА выборка (kerak)  →  Viborka План  →  PTO Қабул kiritadi  →  Қолдиқ (deficit)
   (material ehtiyoji)      (10_Nazorat)     (omborga kelgan)       (avtomat) + Ҳолат rang
                                                                         │
                                                              viborka_nazorat (Supabase) → frontend
```

> Viborka План qayerdan: material выборка (smeta resurslaridan, Viborka o'z usulida yig'adi).
> Bu Smeta `material_kerak` bilan **ataylab ulanmaydi** — Viborka o'zi mustaqil hisoblaydi.

---

## 5. REGISTR / KO'RINISH

- **Panel** (Ҳужжатлар→Выборка): Nazorat jadvali — Материал/Бирлик/План/Қабул/Қолдиқ/%/Поставщик/Ҳолат,
  deficit rang bilan (qabul/plan: 🟢≥98% 🟡<98% 🔴0 🔵>105% 🟣замена) *(qilingan)*.
- **Filtr (qo'shilsin):** holat (ёпилган/кам/келмаган/ортиқча/замена), postavshik, deficit only.
- **Qidiruv:** material nomi, izoh *(server-side bor)*.
- **Yozish:** Қабул kiritish — Viborka loyihasida (PTO). Panel **o'qiydi** (read-only), kerak bo'lsa
  havola orqali ochadi.

---

## 6. NAZORAT (Viborka anti-fraud → ekotizimga)

Viborka allaqachon anti-fraud qiladi (`3_Audit_AntiFraud.js`). Ideal:
- Bayroqlar **Supabase**ga: `viborka_nazorat.holat` + alohida `anomaliya` (🔴 келмаган, 🟠 перерасход,
  🟣 замена) → frontend/Telegram'da ko'rinadi.
- Deficit ro'yxati (qoldiq>0) → ta'minot rejasi.

---

## 7. SUPABASE / FRONTEND

- **`viborka_nazorat`** (bor — `Viborka/Supabase.js` push): material_key, nom, birlik, plan, qabul,
  narx, summa, qoldiq, foiz, holat, postavshik, zamena. **Mustaqil** (Smeta bilan join yo'q).
- Frontend: material nazorat ko'rinishi (deficit, holat rang), postavshik analitikasi, замена tarixi.
- Realtime → omborga Қабул kiritilganda frontend yangilanadi.

---

## 8. ✅ CLAUDE QO'YGAN POYDEVOR (qayta qilma)

**`Smeta tizimi/45_Hujjatlar.js`:** `apiViborkaOl(limit,q)` — endi Viborka hujjatining **Nazorat
varag'ini O'QIYDI** (havola emas): nom, birlik, plan, qabul, narx, summa, qoldiq, foiz, sana,
postavshik, holat, zamena + jami План/Қабул/Сумма. Nazorat topilmasa → havola+xabar (xavfsiz fallback).
**`Smeta tizimi/Panel.html`** (Ҳужжатлар→Выборка): `_renderViborka` — material jadvali, deficit rang
(🟢🟡🔴🔵🟣), jami summa, "Ҳужжатни очиш" havolasi.
**`Viborka/Supabase.js`:** Nazorat → `viborka_nazorat` (soatlik, mustaqil) — allaqachon ishlaydi.

> ⚠️ DOC_VIBORKA ID (`17Pbwn...`) — Viborka GAS loyihasi ishlaydigan spreadsheet bilan **bir xil**
> bo'lishi kerak (Nazorat varag'i bor). Agar boshqa bo'lsa, panel "Nazorat топилмади" deydi → ID ni
> to'g'rilash (`hujIdSet('viborka','...')`).

---

## 9. ANTIGRAVITY DAVOM ETTIRADI (bosqichlar)

**P2 — Filtr/UI (5-bo'lim):** holat chiplari (ёпилган/кам/келмаган/замена), postavshik filtri,
"faqat deficit", sana oralig'i. Material bo'yicha guruh (Z_Obyekt asosida obyekt kesimi).

**P3 — Anomaliya surfacing (6-bo'lim):** Viborka anti-fraud bayroqlarini Supabase `anomaliya`ga
(🔴 келмаган deficit, 🟠 перерасход, 🟣 замена) → unified dashboard/Telegram.

**P4 — Frontend (Next.js):** material nazorat ko'rinishi (`viborka_nazorat`dan), deficit/holat rang,
postavshik analitikasi, замена tarixi, realtime.

**P5 — Per-obyekt:** Z_Obyekt material kesimi panelда/frontendда (qaysi obyektga qancha material).

---

## 10. TAMOYILLAR (buzilmasin)
- Viborka **mustaqil** — material nomlari Smeta/Prixod bilan mos kelmaydi → **majburiy ulash YO'Q**.
- Deficit Viborka **o'zida** hisoblanadi (План−Қабул).
- Қабул yozish — Viborka loyihasida (PTO). Panel/frontend = **o'qiydi**.
- Viborka Sheet = yagona manba; `viborka_nazorat` = mirror; frontend = o'qiydi.
- Viborka o'z AI normalizatsiyasi va anti-fraudini saqlaydi (kuchli, qayta yozilmaydi).

_Oxirgi yangilanish: 2026-06-19. Poydevor: Claude. Davomi: Antigravity (9-bo'lim)._
