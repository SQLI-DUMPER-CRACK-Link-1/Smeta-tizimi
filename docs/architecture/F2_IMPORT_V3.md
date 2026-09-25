# F2 IMPORT V3 — Smeta ↔ F2 ↔ Nakopitelniy (loyiha, 2026-09-25)

> Egasi: "F2 importni maksimal mukammal, maksimal oson, lekin aniq, xato qilmaydigan qilib ber.
> Avval mantiqan F2 va smetani (LRV) tushunib, Nakopitelniyga kiritilishi oson bo'lishi —
> ikki oynali. Smetada yo'q ishlar, zamena ishlar, qo'shimcha ishlar, zamena material —
> hammasiga universal."

## 1. Dalillar (real hujjatlar va baza, 2026-09-25)

**Drive `F2` papkasi** (oylar bo'yicha, 25 fayl) va `ф2 реестр` (51 akt, 2025-07 … 2026-08):
- Bitta F2 fayli = paket: `ОБЛОЖКА` (Форма № 02 muqovasi: obyekt, zakazchik, podryadchik,
  davr), `СЧЁТ-ФАКТ.(…)` (справка-счет-фактура: boshidan / yil boshidan / shu oy), va
  **akt varag'i** (`ф2 Стелла сцена`, `Иск оз и канал (2)`, `тротуар (2)` …).
- Akt varag'i **LRV smeta shaklida** (ABC4): `РАЗДЕЛ/СМЕТА №` sarlavhalari → ish
  (№, ОБОСНОВАНИЕ=шифр, nom, birlik, **shu oy hajmi**, summa) → resurslar `N.1, N.2 …`
  (kod, nom, birlik, norma/birlik, hajm, narx, summa) → podval (materiallar, transport, sklad,
  ИТОГО, прочие 18%, страхование, НДС, ВСЕГО) → **"Итого по ранее оформленным Формам №2"**
  → "Разница" → imzo bloki (ЗАКАЗЧИК / Тех.надзор / ПОДРЯДЧИК).
- **Ish raqami = asl lokal smetadagi № (20, 21, 22, 4, 24 …)**, bo'lim nomlari smetadan
  ko'chirilgan (`СМЕТА № 01-01 НА КОНСТРУКТИВ`, `РАЗДЕЛ: КР АСО М-1 (ЛИСТ.-2 …)`).
- Bir oyda bitta smeta ("По смета": Исскуственное озера) bo'yicha **bir nechta F2** bo'ladi,
  har biri smetaning bir qismi (Тротуар, Скважина, ЭО/ЭС…). Subpudratchi aktlari ham bor
  (Бронза VIP ART — yaxlit summa).
- Zamena/qo'shimcha F2 faylida yozuv bilan belgilanmaydi — smetaga **mos kelmasligi** bilan
  bilinadi.

**Baza:** `t2_akt`/`t2_akt_qator` da F2 qatori **0 ta** (import hech qachon oxirigacha
ishlamagan). Nakopitelniy (`t2_nakopitelniy_v1`) har `t2_qator` bo'yicha tasdiqlangan F2
qatorlarini oylar kesimida yig'adi (oldingi / joriy / jami / qoldiq). `t2_akt_yarat_v2` —
bir aktda bir `qator_id` bir marta, narx/summa F2 ning o'zidan, narxsiz — belgilangan.
`t2_qoshimcha_ish_yarat_v1`, `t2_zamena_ish_yarat_v1` (→ `t2_addrepl_execute_v1`) mavjud.

**Nega eski import noaniq:** bitta shifr obyekt smetasida o'nlab marta uchraydi
(E1-1-197-2: НАСОСНАЯ №1 ЛИСТ-24, №2 ЛИСТ-31, ЛИСТ-36 …). Global shifr qidiruvi tabiatan
noaniq. Yangi smeta importi ish raqamini (`t2_qator.raqam`) saqlamaydi (91-obyektda 0/2387).

## 2. Mantiq (bitta haqiqat)

```
Smeta (LRV, t2_qator)  ←— bog'lanish (har F2 qatori → aniq bitta t2_qator) —→  F2 akt (t2_akt, t2_akt_qator)
        │                                                                              │
        └──────────── Nakopitelniy = Σ tasdiqlangan F2 (oy bo'yicha) per t2_qator ──────┘
```

1. **Bog'lanish darajasi.** F2 ishi (bl) → smeta ishiga; F2 resursi → shu smeta ishi
   ichidagi resursga. Ish qatori **hajm (bajarilish)** ni tashiydi, pul tashimaydi
   (pul resurslarda — ikki marta sanalmaydi). Resurssiz ish (yaxlit narxli) — pul ham ishda.
2. **Kalit (ishonch tartibida):**
   1. `raqam` (smetadagi №) + shifr + birlik, **shu lokal smeta ichida** → aniq;
   2. shifr + birlik + nom, bo'lim yo'li (СМЕТА №, РАЗДЕЛ, ЛИСТ raqami) o'xshashligi bilan
      yagona nomzod → aniq;
   3. bir nechta nomzod → operator tanlaydi (nomzodlar: yo'l, smeta hajmi, qolgan hajm);
   4. nomzod yo'q → **smetada yo'q** (qo'shimcha ish yoki zamena — operator qaror qiladi).
   Resurs: kod (000001 = 1) + birlik → nom+birlik → bo'sh nom; ish ichida topilmasa —
   **zamena material** yoki qo'shimcha resurs.
3. **Qamrov.** Operator F2 ni smetaning qaysi qismiga (lokal smeta / RZ) tegishli ekanini
   ko'rsatadi yoki tizim F2 bo'lim nomlaridan taklif qiladi. Qidiruv shu qamrov ichida.
4. **Tekshiruvlar (yozishdan oldin):**
   - har F2 qatori hal qilingan (bog'langan / qo'shimcha / zamena / o'tkazib yuborilgan-sababli);
   - **F2 hujjat jami = bog'langan qatorlar jami** (fayldagi ИТОГО bilan, farq 0);
   - "Итого по ранее оформленным Формам №2" = bizning Nakopitelniy (oldingi davrlar) —
     farq bo'lsa ogohlantirish;
   - **ortiqcha bajarish:** oldingi + shu F2 hajmi > smeta hajmi → ko'rinadigan ogohlantirish;
   - bitta smeta qatoriga ikki F2 qatori → yig'iladi (narx bir xil bo'lsa), narx har xil — to'xtash.
5. **Yozish:** `t2_akt_yarat_v2` (qoralama) → ko'rib chiqish → **Tasdiqlash** → Nakopitelniy.
   Qo'shimcha/zamena qatorlari avval `t2_qoshimcha_ish_yarat_v1` / `t2_zamena_ish_yarat_v1`
   bilan smetaga (sabab + dalil hujjat = shu F2) qo'shiladi, keyin F2 qatori ularga bog'lanadi.

## 3. Ikki oynali ekran

```
┌ 1. Obyekt · Davr (fayldan: "За сентябрь месяц 2025") · Fayl(lar) · Qamrov (lokal smeta) ┐
├──────────────── CHAP: F2 hujjati ──────────────┬──────────── O'NG: Smeta (LRV) ─────────┤
│ РАЗДЕЛ / ish / resurs daraxti, hajm, summa      │ Shu qamrovdagi smeta daraxti            │
│ Har qatorda holat belgisi:                      │ Har qatorda: smeta hajmi · oldin F2 ·   │
│  ✓ aniq   ◐ tanlash kerak   ✕ smetada yo'q      │ shu F2 · qoldiq (ortiqcha — qizil)      │
│  ＋ qo'shimcha   ⇄ zamena   – o'tkazildi         │ Tanlangan F2 qatorining nomzodlari      │
│ Filtr: [Hammasi] [Hal qilinmaganlar] [Ortiqcha] │ yoritiladi; bosish = bog'lash           │
├─────────────────────────────────────────────────┴────────────────────────────────────────┤
│ Pastki panel: F2 jami ↔ bog'langan jami (farq) · oldingi F2 ↔ Nakopitelniy · hal qilinmagan N │
│ [Qoralamani saqlash]  →  [Tasdiqlash → Nakopitelniy]                                        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Ustun raqamlarini qo'lda kiritish **yo'q** — anatomiya o'qiydi; faqat xato bo'lsa "Varaq
  tuzilishini ko'rish".
- Hal qilinmagan qatorga bir bosishda: `Nomzodni tanlash` · `Qo'shimcha ish (smetada yo'q)` ·
  `Zamena: smetadagi qaysi ish o'rniga` · `O'tkazish (sabab)`. Resurs darajasida:
  `Zamena material (qaysi material o'rniga)` · `Qo'shimcha resurs`.
- Klaviatura: ↑/↓ keyingi hal qilinmagan, Enter — birinchi nomzodni tasdiqlash.
- Katta hujjatda (1000+ qator) ikkala oyna virtual ro'yxat.

## 4. Amalga oshirish bosqichlari

| # | Ish | Qabul mezoni |
|---|---|---|
| F1 | Anatomiya F2 ga moslashuvi: imzo bloki RZ emas; `1 2 3 4` qatori ish emas; podval yig'ma resurslari ish emas; `(fakt)` varaq ustunlari; hajmi bo'sh ish = bajarilmagan (F2 dan tashqarida); davr/raqam/sana, "Итого по ранее…" o'qiladi | 7 ta real F2 korpus testida (KORPUS_DIR) ish/resurs soni va jami fayl ИТОГО bilan teng |
| F2 | Smeta importi `raqam` (asl №) ni saqlaydi | yangi importda `raqam` to'ldirilgan; test |
| F3 | Moslashtirish dvigateli V3 (`lib/f2-moslash-v3/`): qamrov + kalit ierarxiyasi (§2.2), nomzodlar ro'yxati, qo'shimcha/zamena taklifi; sof funksiya | unit testlar: bir shifr ko'p joyda, raqam bo'yicha aniq, zamena material, smetada yo'q ish |
| F4 | Ikki oynali UI (`F2ImportNative` qayta yoziladi) | UI testlari; 1000 qatorda silliq |
| F5 | Yozish: qoralama → tasdiq; qo'shimcha/zamena RPC; jami va Nakopitelniy solishtiruvi | integratsiya testi (mock RPC); prodda sinov egasi bilan |
| F6 | Nakopitelniy va F2 hujjat eksporti hujjat standartida | H1–H9 |

Ochiq savollar egasiga: yo'q (qarorlar §2 da). Migratsiya kerak bo'lsa (masalan ish
qatorini "faqat hajm" deb belgilash) — alohida ruxsat bilan.
