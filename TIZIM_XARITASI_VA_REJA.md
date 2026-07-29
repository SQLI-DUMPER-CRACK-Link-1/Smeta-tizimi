# 🗺️ TIZIM XARITASI VA REJA — QURILISHNI KAFTDAY KO'RSATISH

> **Maqsad:** Navoiy "Yangi O'zbekiston bog'i" (32 ga) qurilishini **bitta PTO muhandisi**
> kaftday ko'rib, oson boshqarishi. Har smeta, har so'm, har ish — reja → fakt → topshirish →
> pul zanjiri bo'yicha ko'rinib tursin. Bu hujjat — tizimning TO'LIQ xaritasi + keyingi ishlar rejasi.
>
> Muallif: Claude (Opus) — 2026-07-02 chuqur audit asosida. Har muhim o'zgarishdan keyin yangilanadi.
> Bog'liq: `ARXITEKTURA.md`, `Smeta tizimi/CLAUDE.md`, `ANTIGRAVITY_UCHUN.md` (agent qoidalari),
> `SUPABASE_SYNC.md`, `AKT_ARXITEKTURA.md`, `PRIXOD_ARXITEKTURA.md`, `VIBORKA_ARXITEKTURA.md`.

---

## 1. QURILISH JARAYONI ZANJIRI (foydalanuvchi mantig'i)

Tizim shu **10 bosqichli zanjir** atrofida qurilgan. Har bosqich bir savolga javob beradi:

```
1. SMETA (reja)        → "Nima qilish kerak?"        Excel lokalka + svodka (narx)
2. NARXLASH            → "Har resurs qancha turadi?"  svodka → LRV_PLUS (constanta)
3. LRV_PLUS (nakopit.) → "Umumiy holat qanaqa?"       markaziy накопительная ведомость
4. FAKT                → "Nima bajarildi?"            har oy kiritiladi
5. Ф2 / КС-2           → "Nima topshirildi/olindi?"   oylik forma-2 (nakopitelniy)
6. AKT (yashirin ish)  → "Yashirin ish hujjatlashdimi?" akt generator + reestr
7. PRIXOD / SKLAD      → "Material keldimi/ishlatildimi?" kirim/chiqim/qoldiq
8. VIBORKA             → "Material yetarlimi?"         план vs қабул (mustaqil)
9. ШАРТНОМА / НАКРУТКА → "Shartnoma bo'yicha qancha?"  dogovor + koeffitsient → ВСЕГО
10. ТЎЛОВ / БУХ        → "Pul qancha keldi/qarz?"      to'lov → debitor/kreditor
─────────────────────────────────────────────────────────────────────
NAZORAT: DASHBOARD (jami) + ANOMALIYA (invariant buzilishi) — hammasini kuzatadi
```

**Kaftday ko'rinish** = bu zanjirning har halqasi Panel/Dashboard/Telegram/frontend'da bir qarashda ko'rinishi.

---

## 2. ARXITEKTURA — 3 loyiha + markaz

```
┌─────────────────────────────────────────────────────────────┐
│ GAS (Google Sheets = DVIGATEL, formulalar shu yerda)          │
│  ├── Smeta tizimi/   ⭐ ASOSIY: 1-5, 9-10 bosqich + AI qatlam  │
│  ├── Akt generator/  📋 6-bosqich (yashirin ishlar aktlari)    │
│  └── Viborka/        📦 8-bosqich (material nazorati, mustaqil)│
└───────────────┬─────────────────────────────────────────────┘
                │ bir tomonlama push (hisoblangan qiymat, formula EMAS)
                ▼
        ┌───────────────┐   realtime o'qish
        │  SUPABASE     │ ◄──────────────── Next.js frontend (D:\frontend)
        │  (miya/kesh)  │ ◄──────────────── Telegram bot
        └───────────────┘ ◄──────────────── AI qatlam (Claude/Gemini)
```

**Tamoyil:** Sheets aniq hisoblaydi → Supabase tez o'qish/realtime/tarix → frontend chiroyli ko'rsatadi.
Maxfiy kalitlar faqat Script Property'da. Har loyiha bitta Supabase hub'ga yozadi, lekin material
nomlari har xil → Smeta↔Viborka **ataylab ulanmaydi** (har biri mustaqil to'liq ishlaydi).

---

## 3. BIZDA NIMA BOR (modullar holati) — 2026-07-02

Belgilar: ✅ ishlaydi · ⚠️ ishlaydi, lekin nomuvofiqlik/tuzatish kerak · 🔴 buzilgan/yo'q · 🟡 reja.

### Smeta tizimi (fayllar)
| Modul | Fayl | Holat | Izoh |
|-------|------|:---:|------|
| Konfiguratsiya | `00_Config.js` | ✅ | CFG ustunlar, kategoriya kalit so'zlar |
| Papka skan / multi-lokalka | `05_Papka.js` | ⚠️ | svod tanlash mantig'i mo'rt (§5.3); `_NAT_` kesh, tizim papka OK |
| Narxlash dvigateli | `10_Engine.js` | ✅ | CONSTANTA narxlash, oraliq, tezkor (§4), chunking |
| Ish turlari kutubxonasi | `15_IshTurlar.js` | ✅ | |
| Server / DASHBOARD | `20_Server.js` | ✅ | yetim qator reconcile |
| Kesh (CacheService) | `25_Kesh.js` | ✅ | gzip+chunk + durable _KESH |
| Panel API + web app | `30_Panel.js` | ✅ | ~2500 qator, hamma api* |
| Telegram bot | `40_Telegram.js` | ⚠️ | AI javob sinxron (sekin, §5.4); token kodда hardcode |
| Hujjatlar (Akt/Prixod/Viborka o'qish) | `45_Hujjatlar.js` | ✅ | |
| Navbat / fon ishlash | `50_Navbat.js` | ✅ | har obyekt alohida trigger + watchdog + tezkor rejim |
| AI maslahatchi (Claude) | `60_Maslahatchi.js` | ✅ | |
| **AI qatlam (Antigravity)** | `65..78_*.js` | ⚠️ | TitanAI, SqlEngine, Vision, Telegram AI, SmartF2 — sinovdan o'tmagan, §5.5 |
| Supabase mirror | `70,71_*.js` | ⚠️ | 71_SupabaseYozish (MIRROR) + kursorli sinx; schema tekshirilsin |
| Shartnoma / Nakrutka | `80_Shartnoma.js` | ✅ | dogovor rollup + 20-qatorli накрутка |
| Buxgalteriya (to'lov) | `85_Buxgalteriya.js` | ✅ | debitor/kreditor |
| Sklad (kirim/chiqim) | `86_Sklad.js` | ⚠️ | Antigravity yangi; sinovdan o'tmagan |
| Self-test (backtest) | `98_SelfTest.js` | ✅ | 121 funksiya registri + invariant test |
| Panel UI | `Panel.html` | ⚠️ | 4300+ qator; monitoring/F2 modal Antigravity qo'shган |
| Boss dashboard | `Boss.html` | ✅ | |

### Akt generator + Viborka
| Loyiha | Holat | Izoh |
|--------|:---:|------|
| Akt generator | ⚠️ | 37 ustunli REYESTR (~380 akt), spreadsheet-per-akt. Redizayn BEKOR (foydalanuvchi eski usulда qoldi) |
| Viborka | ✅ | material план/қабул/deficit, o'zi hisoblaydi (mustaqil) |

---

## 4. BU SESSIYADA TUZATILGAN (2026-07-02)

Antigravity/Gemini ko'p regressiya kiritган edi — audit qilib tuzatildi va push qilindi:

1. 🔴→✅ **`_lokSheetsFolder` yo'q edi** → ko'p-lokalka papkada `papkaSkan` CRASH (Panel/Telegram/Ишла
   yiqilardi). Yozildi.
2. 🔴→✅ **Oraliq seksiya aniqlash buzuq** (`if(kod||bir) continue` juda tor + merged sarlavha) →
   seksiya topilmasdi → **narxlar 0**. Narx-asosli + merged-fallback mantiqqa qaytarildi.
3. 🔴→✅ **Varaq ro'yxati `,`↔`|` nomuvofiqligi** → svod varaq filtri hech narsa o'tkazmay pdb=0.
   `_sheetsParse` ikkalasini qabul qiladi.
4. 🔴→✅ **`_tezkorObyekt` yo'q edi** → "⚡ Тезкор (Нарх)" har obyektга ReferenceError (50+ "Xato").
   Yozildi: LRV ni qayta qurmay faqat narx+kategoriya yangilaydi.
5. 🔴→✅ **Monitoring log ko'rinmas** — render `msg`/`error` o'qirdi, navbat `ob`/`xato`/`xabar` yozadi
   → doim quruq "Xato". Endi `[Obyekt] sabab (Ns)` ko'rinadi.

> Batafsil: xotira `antigravity-regressiya-stash`. Barcha yo'qolgan funksiyalar tiklandi (121/121).

---

## 5. QOLGAN NOMUVOFIQLIKLAR (hal qilinishi kerak)

### 5.1 ✅ Tezkor narx — HAL QILINDI (2026-07-02)
`_tezkorObyekt` svodkadan narxni qayta yozadi — bu **CONSTANTA (#46) bilan izchil**: narx HAR DOIM
svodkadan olinadi, NARXLAR faqat kategoriya (narx emas). Demak "manual narx" standart oqimda yo'q →
svodkadan qayta yozish to'g'ri. (Agar kelajakda LRV G ustuniga qo'lда narx kiritish kerak bo'lsa —
o'shanda "himoyalangan narx" belgisi qo'shiladi.)

### 5.4 ✅ Telegram AI javob — FONГА o'tkazildi (2026-07-02, sklad ham 2026-07-03)
Avval `doPost` ичida AI javob sinxron (10-30 sek) → webhook bloklanardi → Telegram qayta yuboradi →
sekin/javobsiz. Endi `_tgFonQosh`/`_tgFonQadam` (avvalgi `_tgAiNavbatga`/`_tgAiQadam` umumlashtirildi)
navbatga qo'yadi + trigger; fon-ijroda javob beradi; webhook darrov `ok`. **Sklad ovozli/matn qabuli
ham endi fonga o'tkazilgan** (avval faqat oddiy AI chat fonga edi, sklad hali sinxron qolgan edi —
foydalanuvchi "ovozli xabar yuborganimga 5 daqiqa bo'ldi, natija yo'q" deb xabar berdi, shundan keyin
tuzatildi). + token hardcode olib tashlandi (§5.6).

### 5.7 ✅ Groq AI qatlami qo'shildi (2026-07-03) — tezlik + limit muammosi
Foydalanuvchi Groq API kalit oldi (LPU asosida tez inference, bepul limiti Gemini'dan kengroq).
`00_AI_Gateway.js`ga qo'shildi: `groqCall`/`groqFetchRaw` (OpenAI-mos chat/completions,
`llama-3.3-70b-versatile`), `groqTranscribeAudio` (Whisper — audio→matn). **`aiCall()` markaziy
funksiyasi endi barcha SOF MATNLI (vision/audio inlineData'siz) so'rovlarni, Groq kaliti ulangan
bo'lsa, AVVAL Groq'ga yuboradi — xato/limit bo'lsa avtomatik Gemini'ga qaytadi.** Bu degani: 65-74
oralig'idagi barcha matnli AI fayllar (TitanAI, AI_Data, Kunlik_Vazifa va h.k.) HECH BIR qatorini
o'zgartirmasdan Groq'dan foydalana boshladi. **Sklad ovozli xabar (86_Sklad.js)** — endi audio avval
Groq Whisper bilan matnga o'tkaziladi (juda tez), keyin o'sha matndan JSON ajratish ham `aiCall`
orqali Groq'da davom etadi; Groq mavjud bo'lmasa/xato bersa — eski Gemini multimodal (audio to'g'ridan)
yo'liga qaytadi, hech narsa buzilmaydi. Vision (73_AI_Vision.js, rasm tahlili) — Gemini'da qoladi,
Groq'da vision hali ishonchli emas. Kalit: Panel/Созлама yoki menyu (`⚡ Groq kalit ulash`) yoki
chatда `setgroqkey:gsk_...`. **Sinov kerak:** foydalanuvchi ovozli sklad xabari yuborib tezlikni
solishtirishi kerak (avval ~5 daqiqagacha, endi soniyalar kutilmoqda).

### 5.8 ✅ Prixod AI — mavjud material nomlaridan moslashtirish (2026-07-03)
`86_Sklad.js`ning `SKLAD_FILE_ID` — "Copy of Navoiy park" (`10IWmAQTD384T7gRwSmipoEVtAqfa3J80z3B718U-lBw`),
tarkibida Приход/Расход/Остаток/Накладной/**DropdownData** varaqlari bor. DropdownData ustunlari
(D=Тип материала, E=Ед.изм, G=Поставщик, H=Наименование) hammasi `SORT(UNIQUE(TOCOL(...)))` formula —
Приход/Расход tarixidan avtomatik, jonli yig'iladi (H ustunda 1500+ noyob material nomi bor, ba'zilari
imlo xatosi bilan takrorlanadi — masalan "Автоклавный газабетон" va "Автокланый газобетон" ikkalasi ham bor).

Qo'shildi: `_skladDropdownOl()` (DropdownData'ni CacheService'да 15 daqiqa keshlaydi), `_skladNomTaklif
(qidiruv,limit)` (normallashtirilgan — `_normNomKey` bilan bir xil mantiq — aynan/qism/so'z-moslik skori
bilan eng yaqin nomlarni topadi), ochiq API `apiPrixodNomTaklif` (kelajakda Panel autocomplete uchun).
`apiSkladTelegramQabul` endi har item uchun: skor≥90 (deyarli aynan mos) → **mavjud nomga avtomatik
almashtiradi** (yangi variant/imlo xatosi yaratilmaydi); skor 50-89 → yozadi (yangi nom sifatida, qoida:
faqat topilmasa yangi yozish mumkin — bu holat "aniq emas" deb hisoblanadi) LEKIN foydalanuvchiga
"❓ Ўхшаш мавжуд номлар: ..." deb ko'rsatadi (imloni tekshirib qayta yuborish imkoni uchun; CONSTANTA
falsafasiga mos — hech qachon SILENT noaniq moslashtirish yo'q). AI prompt'dagi "тип материала" enum
endi DropdownData'dan DINAMIK olinadi (avval faqat 9 ta qattiq kodlangan tur bor edi, endi barcha
haqiqiy turlar: Бетон/Газаблок/Гранит/ЖБ/Известь/Кабель/Керамика/Кирпич/Металл/Песок/Пиломатериалы/
Прочее/Сад и удоб/Фонарь/Цемент/Шебень). `apiSkladgaYozish` endi **majburiy maydonlarni tekshiradi**
(НОМИ/БИРЛИГИ/ҲАЖМИ yo'q yoki 0 bo'lsa — aniq xabar bilan rad etadi, bo'sh/nomalum qator yozilmaydi).

✅ **HAL QILINDI (2026-07-03):** Panel/Ҳужжатлар→Приход (`45_Hujjatlar.js`, `_HUJ.prixod`) avval
hamkasb (ochilovdilshodbek3@gmail.com) egalik qilgan "Navoiy park" (`1DQPR05...`) fayliga yozardi,
Telegram AI sklad esa foydalanuvchining o'z nusxasiga ("Copy of Navoiy park") — IKKI XIL FAYL, sinxron
emas edi. Foydalanuvchi tanladi: **Panel ham "Copy of Navoiy park"ga o'tkazildi** (hamkasb faylidan
uziladi). `_HUJ.prixod` default o'zgartirildi → `10IWmAQTD384T7gRwSmipoEVtAqfa3J80z3B718U-lBw`. ⚠️ Agar
`DOC_PRIXOD` Script Property avval aniq o'rnatilgan bo'lsa (kod defaultini bosib o'tadi), foydalanuvchi
bir marta `hujIdSet('prixod', '10IWmAQTD384T7gRwSmipoEVtAqfa3J80z3B718U-lBw')` ni editorда RUN qilishi
kerak — Script Properties sahifasini xavfsizlik cheklovi tufayli avtomatik tekshira olmadim (boshqa
maxfiy kalitlar transkriptga chiqib ketmasligi uchun harness bloklади).

### 5.2 ⚠️ Oraliq folder-bo'yicha ulashiladi — multi-svodka papkada xato
Sun'iy ko'l = 14 ta ALOHIDA smeta bitta papkada. Oraliq `_cfgKalit` (papka) bo'yicha ulashiladi →
bir smeta oralig'i (qator raqamlari) boshqasiga noto'g'ri qo'llanadi. **Yechim:** oraliqni SVODKA
(fayl) bo'yicha kalitlash — "bir svodka+ko'p lokalka" (Amfiteatr split) ham, "ko'p svodka" (Sun'iy
ko'l) ham to'g'ri ishlaydi. (Hozircha: avto-aniqlash ishlaydi → Sun'iy ko'lда oraliq qo'lда saqlamang.)

### 5.3 ⚠️ `_skanObyekt` svod tanlash mo'rt
Hech fayl "СВОД" kalitiga tushmasa, ixtiyoriy bitta fayl butun papkага svod deb olinishi mumkin.
Ko'p-alohida-smeta papkada har fayl o'zi svod bo'lishi kerak. Bog'lashni (SOZLAMALAR_BOGLASH)
tekshirish yoki har OB_ALL_SM ni o'ziga bog'lash kerak.

### 5.4 ⚠️ Telegram sekin/javobsiz
Oddiy matnга AI javob **sinxron** (`tgAiJavob`) → 10-30 sek webhook bloklaydi → Telegram qayta
yuboradi → sekinlik/dublikat. **Yechim:** AI javobni fonга (trigger/navbat) o'tkazish, webhook
darrov `ok` qaytarsin. Token kodда hardcode (40_Telegram:30) — Script Property'ga ko'chirilsin.

### 5.5 ⚠️ AI qatlam (65-78) sinovdan o'tmagan
TitanAI, SqlEngine, Vision, SmartF2, Orchestrator — Antigravity/Gemini qo'shган, katta hajm, lekin
tizim invariantlariga (CONSTANTA narx, occurrence, format) mosligini hech kim tekshirmagan. Har birini
`98_SelfTest` doirasiga kiritib, jonli sinovdan o'tkazish kerak.

### 5.6 🔴 Xavfsizlik: hardcode kalitlar
`99_Debug.js` (Supabase service_role), `40_Telegram.js` (bot token) kodда. Kod GitHub/clasp'ga
chiqsa sizadi. Hammasini Script Property'ga ko'chirish.

---

### 5.9 ✅ НАРХ ТАЙЁР — svodkasiz obyekt (2026-07-03)
Foydalanuvchida allaqachon narxlangan tayyor smetalar bor — ularga svodka fayl kerak emas, faqat
LRV_PLUS strukturasi (RZ→BL→RS daraxti) qurilishi kerak, narxlashga vaqt sarflanmasdan. Yangi
per-papka bayroq: `SOZLAMALAR_BOGLASH` ustun O = `НАРХ_ТАЙЁР` (`_boglashOl`/`05_Papka.js`).

Ishlash mantig'i: `_skanObyekt` bu bayroq bilan svodka aniqlashning BARCHA bosqichlarini
(kalit so'z bo'yicha qidiruv + "svod topilmasa bittasini svod deb olish" fallback) o'tkazib
yuboradi — papkadagi HAMMA fayl lokalka deb hisoblanadi, `svodFile` doim `null` qoladi, foydalanuvchidan
svodka SO'RALMAYDI. `10_Engine.js` (`_ishlaObyekt`/`_ishlaQism`): `ob.narxTayyor` bo'lsa svodka fayli
umuman ochilmaydi, `pdb={byKey:{},n:0}` (bo'sh narx bazasi). Bu xavfsiz, chunki `_ishlaVaraq` allaqachon
har bir rs/mat/ob qatorda AVVAL lokalkaning o'z НАРХ ustunidagi qiymatni o'qiydi (`pNarx!==0` bo'lsa
o'shani ishlatadi, `_findPrice`/pdb ga umuman murojaat qilmaydi) — svodka faqat `pNarx===0` bo'lganda
kerak edi (bunday holatda ham xavfsiz: bo'sh pdb → MISS/0, to'g'ri holat, chunki svodka yo'q). `_tezkorObyekt`
(⚡ Тезкор нарх) bunday obyektlar uchun mazmunsiz — do'stona xabar bilan no-op qiladi. `apiOraliqlarSkan`
ham aniq xabar bilan rad etadi (оралиқ ҳам керак эмас).

UI: Panel → Файл боғлаш → ҳар папка гуруҳи бошида **"☑ НАРХ ТАЙЁР (свод керак эмас)"** чекбокс —
белгиланса, СВОД танлов қатори бутунлай яширилади (ҳатто кўрсатилмайди ҳам), сақлаш билан бирга
`apiBoglashSaqla` орқали SOZLAMALAR_BOGLASH'га ёзилади. Гуруҳ (папка) даражасида — бир марта белгиланса
шу папкадаги барча бўлим-локалкаларга (split obyektlarга) татбиқ этилади (format/svod каби).

**Foydalanish:** Panel → Файл боғлаш → keraкли obyekt guruhida НАРХ ТАЙЁР ni belgilang → Сақлаш →
[Ишла]. Struktura tez quriladi, mavjud narxlar tegilmaydi, svodka fayl umuman so'ralmaydi/ochilmaydi.

## 6. NIMA YETISHMAYDI (gaps — zanjirdagi bo'shliqlar)

| # | Bo'shliq | Zanjir bosqichi | Muhimlik |
|---|----------|-----------------|:---:|
| G1 | **Ф2/КС-2 import** — F2 hujjatidan oylik hajmни LRV oy ustuniga o'qish | 5 | ⭐⭐⭐ |
| G2 | **КС-2 / КС-3 avto-generatsiya** (rasmiy topshirish formasi) | 5 | ⭐⭐ |
| G3 | **Sklad chiqim (расход) + qoldiq** to'liq ledger | 7 | ⭐⭐ |
| G4 | **Akt ↔ smeta barqaror ulash** (work-key), coverage nazorati | 6 | ⭐⭐ |
| G5 | **Frontend (Next.js)** — anomaliya/bux/viborka/akt ko'rinishi + Vercel deploy | hammasi | ⭐⭐⭐ |
| G6 | **Gantt / muddat / jadval** — vaqt bo'yicha reja-fakt | yangi | ⭐⭐ |
| G7 | **Prognoz/AI tahlil** — tugash muddati, byudjet chetlashishi | nazorat | ⭐ |

---

## 7. REJA (bosqichma-bosqich) — barqarorlikdan boshqaruvga

### FAZA 0 — BARQARORLIK (hozir, eng muhim)
- [x] Regressiyalarni tuzatish (§4) — bajarildi
- [x] §5.6 xavfsizlik: hardcode kalitlar (Supabase service_role, TG token) kodдан olib tashlandi →
      Script Property'дан o'qiydi (2026-07-02, push qilingan)
- [ ] `selftestBarcha()` ni jonli ishga tushirish → 121 funksiya + har obyekt invarianti ✅ bo'lsin
- [ ] Har obyektni [Ишла] → **narx 0 qolmasin** (Ташхис bilan tekshir); oraliq kerak bo'lsa saqlash
- [ ] §5.4 Telegram: AI javobni fonга (webhook darrov ok qaytarsin) — keyingi qadam

### FAZA 1 — NARXLASH IDEAL (zanjir 1-3 to'liq ishonchli)
- [ ] Oraliqni svodka-bo'yicha kalitlash (§5.2)
- [ ] Svod tanlashni mustahkamlash + har obyekt bog'lanishini panelда ko'rsatish (§5.3)
- [ ] Tezkor narx rejimini qarorga moslash (§5.1)
- [ ] Barcha obyektlar narxlansin → DASHBOARD jami to'g'ri

### FAZA 2 — FAKT & Ф2 (zanjir 4-5)
- [ ] Ф2 import (G1): F2 hujjatidan oylik hajm → LRV oy ustuni (mos topilса) yoki alohida ish turi
      (mos topilmasa). Universal, nakopitelniy.
- [ ] КС-2/КС-3 avto-generatsiya (G2)

### FAZA 3 — HUJJAT & SKLAD (zanjir 6-8)
- [ ] Akt ↔ smeta barqaror ulash + coverage (G4)
- [ ] Sklad chiqim + qoldiq ledger (G3)

### FAZA 4 — PUL & NAZORAT (zanjir 9-10)
- [ ] Buxgalteriya to'liq (debitor/kreditor/avans) — panel + frontend
- [ ] Anomaliya nazorati frontendда ko'rinsin

### FAZA 5 — KAFTDAY KO'RINISH (frontend)
- [ ] Frontend (G5): dashboard + zanjirning har halqasi + realtime + Vercel deploy
- [ ] Gantt/muddat (G6), AI prognoz (G7)

---

## 8. ISH TARTIBI (multi-agent — buzilmasin)

1. **clasp push remote'ni TO'LIQ almashtiradi** → avval `clasp pull` bilan solishtir, keyin push.
   (Antigravity eski bazadan push qilib 24+ funksiya yo'qotgan edi.)
2. **Faylni qayta yozma (rewrite), funksiya o'chirma** — faqat qo'sh/tuzat. `98_SelfTest` registri
   himoya.
3. **Motor muqaddas** (`10_Engine.js` narxlash) — CONSTANTA (nom+birlik aynan), occurrence, format
   qonunlariga tegma.
4. **Har o'zgarishdан keyin** `selftestFunksiyalar()` → 121/121 bo'lsin; keyin `selftestBarcha()`.
5. **Kim nima qiladi:** Claude — backend/audit/mantiq tahlili; Antigravity — frontend + katta kod
   yozish (Claude tahlili bo'yicha). Ikkalasi `10_Engine`/`05_Papka` ga EHTIYOT bilan.
6. **Maxfiy kalit** hech qachon kodга — faqat Script Property.

---

## 9. QISQA XULOSA (kaftday)

- **Zanjir:** Smeta→Narx→Nakopit.→Fakt→Ф2→Akt→Sklad→Shartnoma→Tolov→Nazorat (§1).
- **Bor:** 1-4, 9-10 bosqich ishlaydi (narxlash, dashboard, shartnoma, buxgalteriya). AI+Sklad+Mirror
  bor lekin sinalmagan.
- **Bu sessiyada:** 5 ta jiddiy regressiya tuzatildi (narx 0, crash, tezkor, monitoring).
- **Eng katta bo'shliq:** Ф2 import (G1) + Frontend (G5) — "kaftday ko'rinish" shularga bog'liq.
- **Birinchi qadam:** FAZA 0 — barqarorlik (selftest + narx 0 yo'qolishi + xavfsizlik).

_Oxirgi yangilanish: 2026-07-02 (Claude Opus, chuqur audit)._
