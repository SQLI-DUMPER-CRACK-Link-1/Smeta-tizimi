# 🏗️ NAVOIY QURILISH — TIZIM VIZYONI VA ARXITEKTURASI

> **Bu fayl — butun ekotizimning xaritasi va vizyoni.** Har qanday agent (Antigravity, Claude…)
> shu bitta faylni o'qib: (1) bugun nima bor, (2) qurilish PTO uchun TO'LIQ tizim qanday bo'lishi
> kerak, (3) qayerdan davom etish — hammasini tushunadi. Har loyihaning ichki tafsiloti o'z
> `CLAUDE.md`/`LOYIHA_HOLATI.md` sida; bu fayl **ULARNI BIRLASHTIRADI va KELAJAKNI chizadi**.
>
> Loyiha: **"Янги Навоий Шахарчаси" / Yangi O'zbekiston bog'i (Navoiy)**.
> Bitta PTO muhandisi 32 gektar qurilishni boshqaradi → maqsad: **avtomat, tez, aniq, hayratlanarli**.

---

## 0. KATTA G'OYA (nega va qayoqqa)

Hozir 3 ta alohida Google Sheets+Apps Script asbobi bor (smeta, akt, viborka). Ular kuchli,
lekin **orolcha** — bir-biriga ulanmagan, har biri o'z ma'lumotini qayta kiritadi, umumiy
ko'rinish yo'q. Maqsad — ularni **bitta "Qurilish Operatsion Tizimi"** ga aylantirish:

```
Bugun:  3 ta orolcha (smeta | akt | viborka), qo'lda bog'lanish, Excel chegaralari
Ertaga: 1 ta integratsiyalashgan tizim — bitta haqiqat manbai (Supabase),
        AI tahlil, real-time dashboard, mobil/Telegram kirish, avto-hujjat, prognoz
```

PTO ishining **butun hayotiy sikli** qamralishi kerak: smeta → ta'minot → bajarilish →
hujjat → moliya → tahlil. Hozir faqat 3 bo'lak qoplangan. Quyida TO'LIQ rasm.

---

## 1. MAVJUD 3 LOYIHA (poydevor)

```
C:\Users\PC\Documents\GAS\
├── Smeta tizimi/   ⭐ moliya/smeta dvigateli (git + clasp + Next.js frontend)
├── Akt generator/  📋 «скрытых работ» akt + REYESTR (clasp)
└── Viborka/        📦 material kerak/kelgan nazorati + AI (clasp)
```

| Loyiha | Vazifa | Master Sheet | Script ID |
|--------|--------|-------------|-----------|
| **Smeta tizimi** | Smeta→narx(CONSTANTA)→FAKT/Ф2→DASHBOARD→ШАРТНОМА→panel/bot/AI/Supabase/frontend | `18mixKyl…JqoS` | `1fcGIysm…98B6h` |
| **Akt generator** | Akt yaratish + ROOT skan + REYESTR + PDF + komissiya | `1Co9bC9d…HQbP0` | `1Mw4wcIK…CCZal` |
| **Viborka** | Material выборка — KERAK(I) vs KELGAN(J), zayavka, deficit, zamena, anti-fraud, AI normalize | (CoreTitan) | `1eIm6BIk…54cnA` |

Batafsil: `Smeta tizimi/CLAUDE.md` (eng to'liq), `Akt generator/Code.js`, `Viborka/0_Master_Triggers.js`.
Har papkada `.clasp.json` → `clasp pull`/`push`.

---

## 2. QURILISH PTO — TO'LIQ MODUL XARITASI

Jiddiy qurilish boshqaruv tizimi 8 ta modulдан iborat. Hozirgi qamrov: ✅ bor · 🟡 qisman · ❌ yo'q.

| Modul | Tarkib | Hozir | Qayerda |
|-------|--------|:-----:|---------|
| **A. SMETA / BYUDJET** | obyekt→razdel→ish(bl)→resurs(rs/mat), narx (CONSTANTA), ШАРТНОМА, накрутка | ✅ | Smeta |
| **B. TA'MINOT / SKLAD** | kerak (smetadan), zayavka, prixod, **sklad qoldiq**, rasxod, zamena, deficit, postavshik | 🟡 | Viborka + Prixod |
| **C. BAJARILISH / PROGRESS** | FAKT hajm, Ф2 (КС-2), **КС-3**, qavat/blok, davr (oy), velocity | 🟡 | Smeta |
| **D. HUJJATLAR** | akt(скрытых), **КС-2/КС-3 avto**, исполнительная схема, sertifikat, **foto-hisobot** | 🟡 | Akt |
| **E. MOLIYA / CASHFLOW** | dogovor to'lovlari, subpodryad hisob, debitor/kreditor, **cashflow prognoz** | 🟡 | Smeta (ШАРТНОМА) |
| **F. JADVAL / REJA** | kalendar-plan, **Gantt**, deadline, kritik yo'l, oylik reja vs fakt | ❌ | — |
| **G. SIFAT / NAZORAT** | Nazorat (kerak/kelgan), defekt, **anti-fraud audit**, tekshiruv | 🟡 | Viborka |
| **H. TAHLIL / AI** | dashboard, KPI, **prognoz (tugash/byudjet/material)**, anomaliya, maslahatchi, NL-so'rov | 🟡 | Smeta (AI+tashxis) |

➡️ **Eng katta bo'shliqlar (kuchaytirish kerak):**
**F (Jadval/Gantt) — umuman yo'q**, **B (Sklad qoldiq)**, **D (КС-2/3 avto + foto)**,
**E (cashflow prognoz)**, **H (prognoz AI + tabiiy til so'rov)**.

---

## 2.5 ⭐ QOG'OZ ISHLARI — TIZIMNING ENG MUHIM YURAGI (СМЕТА→ФАКТ→Ф2→Ф3→ОСТАТОК)

> PTO ishida eng katta xavf va eng ko'p nazorat shu yerda: **bajarilgan ish hujjatlari,
> Forma-2, Forma-3, fakt va ostatkalar.** Bu modul moliyaviy-yuridik yurak — har raqam
> tekshirilgan, izlanadigan (audit tarix) va oshkor bo'lishi shart.

### Hujjat sikli (zanjiri)
```
СМЕТА (reja: hajm × narx)
   └─→ ФАКТ (haqiqatda bajarilgan hajm — saytdan)
          └─→ Ф2 / КС-2 (oylik «Акт о приёмке выполненных работ» = hajm × narx)
                 └─→ Ф3 / КС-3 («Справка о стоимости» — davr + jami yig'indi)
   ОСТАТОК = СМЕТА − Σ Ф2   (qolgan ish)        НАКОПИТЕЛЬНАЯ ведомость = LRV_PLUS (jami)
   Material: ПРИХОД → РАСХОД → ОСТАТКА (sklad)   Доп-ишлар (+) = смета tashqari, alohida
```

### 🚦 NAZORAT INVARIANTLARI — tizim AVTOMAT tekshiradi (buzilsa qizil + Telegram ogohlantirish)
1. **Ф2(oylik) hajm ≤ FAKT hajm ≤ СМЕТА hajm** — bajarilmagan ishni yozib bo'lmaydi; smetadan oshsa → доп-смета kerak.
2. **Σ Ф2 (jami olingan) ≤ СМЕТА** · **ОСТАТОК = СМЕТА − ΣФ2 ≥ 0** (manfiy bo'lsa — xato/qo'shib yozish).
3. **Ф2 fakticheskiy narx vs смета narx** — har resurs bo'yicha (qimmatlashish/overrun bayroq). *(Smeta'da Ф2 3-ustun: ОБЪЁМ│НАРХ│СУММА — fix #47, poydevor bor.)*
4. **КС-3 (davr) = Σ КС-2 (shu davr)** · КС-3 jami = Σ barcha КС-2 (nomuvofiqlik = bayroq).
5. **РАСХОД ≤ ПРИХОД** va **РАСХОД ≈ FAKT × НОРМА** (norma bo'yicha sarf; katta og'ish → o'g'irlik/isrof bayroq).
6. **Material ОСТАТКА = ПРИХОД − РАСХОД ≥ 0**.
7. **Har bajarilgan yashirin ishga АКТ bor** (FAKT bor, akt yo'q → bayroq → Akt generator chaqiriladi).
8. **Доп-ишлар (+)** смета tashqari — ШАРТНОМА dop sifatida alohida hisob va nazorat.

### 🤖 Avtomatlashtirish
- **КС-2 / КС-3 avto-yaratish** — Ф2/FAKT ma'lumotidan oylik to'ldiriladi (qo'lda yozish yo'qoladi).
- **ОСТАТОК ведомость** — har davr avto hisoblanadi (СМЕТА − ΣФ2).
- **Anomaliya skaneri** — yuqoridagi 8 invariantni har Ишла/Ф2 saqlashda tekshiradi, buzilganini ro'yxatlaydi.
- **Audit tarix** — kim/qachon/qaysi Ф2/FAKT ni o'zgartirdi (Supabase `tarix`, allaqachon Smeta'da bor).

➡️ Bu modul **C (Progress) + D (Hujjat) + G (Nazorat)** ning kesishmasi — tizimning ishonch va
yuridik asosi. Roadmap'da FAZA 2 ning bosh ustuvori (B5 КС-avto + B5.1 invariant skaner).

---

## 3. YAGONA MA'LUMOT MODELI (Supabase — hub)

Hammasini bog'laydigan markaziy Postgres sxemasi. **Bitta haqiqat, hamma o'qiydi.**

```
loyiha
  └─ obyekt (id, nom, format, holat, shartnoma_id)
       ├─ razdel (id, obyekt_id, nom, kod[KJ/AR/OV/VK/ES])
       │    └─ ish_turi/bl (id, razdel_id, nom, shnk_kod, birlik, hajm, narx, smeta)
       │         └─ resurs/rs-mat (id, ish_id, tur[chel/mash/mat/ob], nom_key, birlik, norma, narx, kat)
       ├─ fakt (resurs_id, davr, hajm, summa)              ← C
       ├─ f2/ks2 (ish_id, oy, hajm, narx, summa)           ← C/D
       └─ foto (ish_id|akt_id, url, sana)                  ← D

shartnoma (id, nom, taraf, summa, nds, jami, holat)        ← A/E
  └─ qoshimcha_ish (subpodryad — summalar qo'lda)
nakrutka (koeffitsientlar %)                               ← A

narx_registr (nom_key, birlik, kat, [obyekt narxlar], tizim)  ← A

material (nom_key, birlik, kat)                            ← B   (umumiy kalit!)
  ├─ kerak (material, obyekt, razdel, hajm)   ← smetadan avto
  ├─ zayavka (material, hajm, sana, holat)
  ├─ prixod (material, hajm, sana, narx, postavshik)
  ├─ sklad (material, qoldiq = Σprixod − Σrasxod)
  ├─ zamena (asl → almashtirilgan, sabab)
  └─ deficit (material, kerak − kelgan)

akt (id, obyekt_id, ish_id, raqam, sana, komissiya{}, status, pdf_url)  ← D (ish_id = BOG'!)
tolov (shartnoma_id, summa, sana, tur)                     ← E
jadval (ish_id, boshlanish, tugash, foiz_reja)             ← F (yangi)
tarix (audit log — kim/qachon/nima)                        ← G/H
```

### 🔑 INTEGRATSIYANING YURAGI — 2 ta umumiy kalit
1. **OBYEKT kaliti** — bitta kanonik ro'yxat (`obyekt.nom`). Uchala tizim shunga moslashadi.
2. **MATERIAL kaliti** — bitta normalizatsiya. Hozir Smeta `_normNomKey`+`_normBirlik`,
   Viborka `AI_NormalizeName`+`normalizeUnit` — **alohida**. Birlashtirilmasa "kerak" (smeta)
   va "kelgan" (prixod) MOS KELMAYDI → butun ta'minot tahlili buziladi. **B1 ustuvor.**

---

## 4. ARXITEKTURA (target)

```
        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │ SMETA (o'zak)│   │ AKT generator│   │   VIBORKA    │
        │ smeta·narx·  │   │ skрытых·КС-2 │   │ kerak/kelgan │
        │ fakt·Ф2·shart│   │ ·foto·reyestr│   │ ·zayavka·audit│
        └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
               │ push             │ push/read        │ push/read
               ▼                  ▼                  ▼
        ╔═══════════════════════════════════════════════════════╗
        ║   SUPABASE — UMUMIY HUB (Postgres + Realtime + Auth)   ║
        ║   obyekt·resurs·fakt·material·sklad·akt·tolov·jadval   ║
        ╚════════════╦══════════════════╦═══════════════════════╝
                     │ realtime          │ AI (Claude API)
        ┌────────────▼─────────┐  ┌──────▼───────────────────────┐
        │  KIRISH QATLAMI       │  │  AQL QATLAMI (AI)            │
        │  • Next.js panel (PTO)│  │  • prognoz (tugash/byudjet)  │
        │  • Rahbar dashboard   │  │  • anomaliya/fraud           │
        │  • Telegram bot       │  │  • КС-2/3 avto-yaratish      │
        │  • Mobil (sayt: foto, │  │  • tabiiy til so'rov (NL→SQL)│
        │    FAKT kiritish)     │  │  • maslahatchi               │
        └───────────────────────┘  └──────────────────────────────┘
```

- **Sheets+GAS = dvigatel** (hisob, formula, format — qonuniy hujjat). Qoladi.
- **Supabase = hub** (tez o'qish, realtime, hammasi bir joyda). Smeta'da boshlangan.
- **Next.js + Telegram = kirish** (PTO + rahbar + sayt muhandisi).
- **Claude API = aql** (prognoz, anomaliya, hujjat, NL-so'rov).

---

## 5. "HAYRATLANARLI" QOBILIYATLAR (maqsad — kuchli natija)

Bular tizimni oddiy jadvaldan **aqlli operatsion tizimga** aylantiradi:

1. **🔮 Prognoz dvigateli (AI):**
   - **Tugash sanasi** — FAKT tezligidan (velocity) har obyekt/ish qachon tugashini bashorat.
   - **Material vaqti** — jadval + yetkazib berish muddatidan "qachon buyurtma berish kerak".
   - **Byudjet oshishi** — joriy FAKT narx vs smeta → oxирги qiymat prognozi (ogohlantirish).
   - **Cashflow** — dogovor to'lov grafigi + Ф2 → naqd oqim prognozi.

2. **🚨 Anomaliya / Anti-fraud (Viborka audit + AI):**
   - Kelgan material kerakdan ko'p/kam, shubhali zamena, narx sakrashi → avto bayroq + Telegram.

3. **📄 Avto-hujjat:**
   - **КС-2 / КС-3** — Ф2/FAKT dan avtomat to'ldiriladi (oylik).
   - **Akt** — ish turi (bl) + FAKT'ga bog'lanib avto-matn (komissiya, sana, material).
   - **Исполнительная** — foto + akt + chizma birikmasi.

4. **📱 Sayt muhandisi mobil oqimi (Telegram/Next.js):**
   - Saytdan foto + "Amfiteatr fundament 80%" → AI tahlil qiladi → FAKT yangilanadi →
     akt kerakmi tekshiradi → rahbarga real-time ko'rinadi.

5. **🗣️ Tabiiy til so'rov (NL → SQL):**
   - "Suniy ko'lda qancha beton qoldi?", "Bu oy qaysi obyekt orqada?" → AI Supabase'dan javob.

6. **📊 Rahbar real-time dashboard:**
   - Har obyekt: byudjet vs fakt vs Ф2 vs to'lov, progress %, deficit, deadline holati — bitta ekran.

7. **📅 Kalendar-plan / Gantt (yangi modul F):**
   - Oylik reja vs fakt, kritik yo'l, kechikish ogohlantirish.

---

## 5.1 🧠 AI: QAYSI MODEL + PROGNOZ QANDAY ISHLAYDI

**Model: Claude (Anthropic)** — allaqachon ulangan (`60_Maslahatchi.js`, `claude-opus-4-8`).
Bitta kalit (`ANTHROPIC_API_KEY`, Script Property), hammasi `UrlFetchApp` orqali.

| Model | Qachon | Narx (1M token) |
|-------|--------|-----------------|
| `claude-opus-4-8` | **Standart** — murakkab tahlil, anomaliya, hujjat matni, NL-so'rov | $5 / $25 |
| `claude-sonnet-4-6` | Arzon/tez — ko'p hajmli oddiy tahlil | $3 / $15 |
| `claude-haiku-4-5` | Eng tez/arzon — oddiy klassifikatsiya | $1 / $5 |

> Console: console.anthropic.com → API Keys. Kalit faqat serverda (GAS Script Property / Supabase
> Edge Function) — frontendga QO'YILMAYDI.

### ⚠️ MUHIM AJRATISH — prognoz 2 qism (aks holda noto'g'ri natija)
- 🔢 **RAQAMLI prognoz = KOD/SQL matematikasi** (LLM EMAS): tugash sana (FAKT velocity), byudjet
  oshishi (fakt narx trend), cashflow (Ф2+to'lov grafigi), ostatka. Aniq, bepul, takrorlanadigan.
  *LLM raqamni "taxmin qiladi" — moliyaga MUMKIN EMAS.*
- 🧠 **AQLLI qatlam = Claude**: raqamlarni IZOHLAYDI, anomaliyani topadi/tushuntiradi, tavsiya
  beradi, КС/akt matnini yozadi, tabiiy tilga javob beradi.
- **Birga:** kod aniq hisoblaydi → Claude tushuntiradi + ogohlantiradi → ishonchli + aqlli.

### NL→SQL (tabiiy til so'rov)
Savol → Claude SQL yozadi → Supabase'da **read-only** bajariladi → Claude javobni tilga aylantiradi.
Misol: «Suniy ko'lda qancha beton qoldi?» / «Bu oy qaysi obyekt orqada?»

---

## 5.2 🎬 SAYT: 3D / MOTION GRAPHICS (hayratlanarli ko'rinish)

**Ha — `Smeta tizimi/frontend` (Next.js) da to'liq mumkin.** Texnologiyalar:

| Texnologiya | Nima uchun |
|-------------|-----------|
| **React Three Fiber** (Three.js) | ⭐ 32 gektar **3D master-plan** — har obyekt 3D blok, progress % bo'yicha rang/balandlik, bosilsa → smeta/fakt/ostatka drill-down |
| **Framer Motion** | silliq UI animatsiya, o'tishlar, KPI raqamlari jonlanishi |
| **GSAP** | murakkab timeline (qurilish progressi vaqt bo'yicha animatsiya) |
| **Lottie** | vektor motion aksent (yuklash, holat ikonkalari) |
| **Recharts / Visx** | jonli grafiklar (cashflow, progress trend) |

- Ma'lumot **Supabase'dan realtime** → 3D rang/balandlik avto yangilanadi (FAKT o'zgarsa — blok o'sadi).
- **Tavsiya:** 3D = rahbar/taqdimot qatlami (wow); tez jadval = PTO kundalik ishi. Ikkalasi bitta saytda.

**Misol oqim:** rahbar saytni ochadi → 32 ga aylanma 3D plan, obyektlar progress bo'yicha rangли
(🟢 tayyor · 🟡 ketyapti · 🔴 orqada) → obyektga bosadi → KPI + Ф2/ostatka/deficit paneli ochiladi.

> Eslatma: 3D chiroyli, lekin **og'ir hisob va qog'oz nazorati birinchi** (2.5-bo'lim). 3D — ustki
> "ko'rgazma" qatlam; poydevor (ma'lumot + invariant nazorat) mustahkam bo'lгач quriladi.

---

## 6. YO'L XARITASI (poydevordan hayratlanarligacha)

**FAZA 1 — Poydevor va integratsiya kaliti**
- [x] B0: Ekotizim xaritasi (shu fayl)
- [ ] B1: **Umumiy OBYEKT + MATERIAL kaliti** (Smeta `_normNomKey` ↔ Viborka `AI_NormalizeName` moslash) ⭐
- [ ] B2: Smeta → Supabase to'liq (resurs/kerak + narx + fakt/Ф2) — `70_Supabase.js` kengaytirish
- [ ] B3: Viborka Supabase'dan "kerak"ni, Prixod'dan "kelgan"ni avto oladi (qo'lda kiritish yo'qoladi)

**FAZA 2 — ⭐ QOG'OZ NAZORATI + hujjat + moliya (eng kritik)**
- [ ] B5.1: **Nazorat invariant skaneri** (2.5-bo'lim 8 qoidasi — Ф2≤FAKT≤смета, ΣФ2≤смета, расход≤приход…) → qizil + Telegram bayroq ⭐
- [ ] B5: **КС-2 / КС-3 avto-generatsiya** (Ф2/FAKT dan oylik) + ОСТАТОК ведомость avto
- [ ] B4: Akt ⟷ Smeta bog' (akt → ish_id; FAKT yonida "akt bor" belgisi; akt yo'q → bayroq)
- [ ] B6: Moliya moduli — to'lovlar, subpodryad hisob, cashflow ko'rinishi

**FAZA 3 — Aql va kirish (hayratlanarli)**
- [ ] B7: AI prognoz (tugash sana, material vaqti, byudjet oshishi, cashflow)
- [ ] B8: Yagona Next.js panel (smeta+ta'minot+akt+moliya) + rahbar mobil + **3D master-plan (React Three Fiber) + Framer Motion** (5.2-bo'lim)
- [ ] B9: Telegram sayt-oqimi (foto+FAKT+AI) + tabiiy til so'rov (NL→SQL)
- [ ] B10: Sklad qoldiq + zayavka avtomatikasi + deficit ogohlantirish

**FAZA 4 — Kengaytirish (bozorbop)**
- [ ] B11: Kalendar-plan / Gantt (modul F)
- [ ] B12: Ko'p loyiha / ko'p foydalanuvchi (boshqa obyektlarga ham — mahsulot sifatida)

---

## 7. AGENT UCHUN — ISH TARTIBI

1. **O'qish:** shu fayl → `Smeta tizimi/CLAUDE.md` → kerakli loyiha kodi.
2. **Tahrir:** papka ichida `clasp pull` → tahrir → `clasp push` → (web app) Deploy → New version.
3. **Git:** faqat `Smeta tizimi/` da. Akt/Viborka — clasp (bulut).
4. **Buzma qoidalar (Smeta):** narx = CONSTANTA (faqat EXACT, fuzzy yo'q); format qonuniy
   (copyTo saqlanadi); LRV sahifa bo'linmaydi; har obyekt alohida trigger (navbat).
5. **Birinchi ustuvor ish:** **B1 — umumiy kalit** (busiz integratsiya qurilmaydi).
6. **Texnik bo'shliq:** Smeta Suniy ko'l 6-daqiqa optimizatsiyasi (copyTo+formula recalc+РЕСУРСЛАР SUMIFS, format saqlangan holda).

---

## 8. DRIVE / ID XARITASI

```
Smeta ROOT (obyektlar):     1PpCaWWV47S_NlqD2cSeJQTjtzao6G09y
Smeta SERVER_DASHBOARD:     1y83-TFh3X-qx2kSQlgojQExPe2gSXEa1Wk4klAsS8rs
Akt ROOT:                   1ySurglAgbADlj7CmyYEx9WsxVP88cFSh   (⚠ Smeta ROOT'idan farqli — B4 da moslash)
Akt master / REYESTR:       1Co9bC9dEdJUG9wTEiQjUJ4KH-aCScQihkQ_9-MHQbP0
Prixod (kelgan material):   1vchaALFe0FmKzt4b_w1ZMA3GZO44jedF16dbSpd6pTo
Viborka container Sheet:    17PbwnwpQGhGPU_OMgnl605VmuRXzeFFSgG2QXdem_xY  (script: 1eIm6…54cnA)
```

---

## 9. TEXNOLOGIK STACK

| Qatlam | Texnologiya | Holat |
|--------|-------------|-------|
| Dvigatel/hisob/hujjat | Google Sheets + Apps Script (3 loyiha) | ✅ |
| Ma'lumot hub | Supabase (Postgres+Realtime+Auth+Storage) | 🟡 (Smeta'da boshlangan) |
| Frontend | Next.js (`Smeta tizimi/frontend`) | 🟡 (skelet) |
| Bot | Telegram (Smeta) | ✅ |
| AI | Claude API (`claude-opus-4-8`, UrlFetchApp) | 🟡 (maslahatchi+tashxis) |
| Versiya | git (Smeta) + clasp (3 loyiha) | ✅ |

> **Prinsip:** og'ir hisob va qonuniy hujjat — Sheets'da (qoladi). Tez ko'rish, realtime,
> AI, integratsiya — Supabase + Next.js + Claude. Eski mehnat yo'qolmaydi, ustiga quriladi.

---

_Oxirgi yangilanish: 2026-06-18 — to'liq PTO modul xaritasi + yagona ma'lumot modeli + ⭐qog'oz nazorati (Ф2/Ф3/FAKT/ostatka invariantlar) + AI model & prognoz mexanikasi + 3D/motion frontend + 4 fazali yo'l xaritasi._
