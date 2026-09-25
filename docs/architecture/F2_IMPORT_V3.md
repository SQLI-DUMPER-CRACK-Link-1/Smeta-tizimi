# F2 IMPORT V3 — Smeta ↔ F2 ↔ Nakopitelniy (loyiha, 2026-09-25)

> Egasi: "F2 importni maksimal mukammal, maksimal oson, lekin aniq, xato qilmaydigan qilib ber.
> Avval mantiqan F2 va smetani (LRV) tushunib, Nakopitelniyga kiritilishi oson bo'lishi —
> ikki oynali. Smetada yo'q ishlar, zamena ishlar, qo'shimcha ishlar, zamena material —
> hammasiga universal." · "Bog'lashda lokal smeta nomeri F2 dagi nomerdan farq qiladi — bu
> bilan bog'lab bo'lmaydi. Tizim1 dagi importerni o'rgan… xuddi shunaqa yoki undan yaxshi."

## 1. Dalillar (real hujjatlar, Tizim1, baza — 2026-09-25)

**Real F2 (Drive `F2` papkasi, 25 fayl; `ф2 реестр`, 51 akt):**
- F2 fayli = paket: `ОБЛОЖКА` (Форма № 02), `СЧЁТ-ФАКТ.(…)` (справка-счет-фактура),
  **akt varag'i** — LRV smeta shaklida: `РАЗДЕЛ/СМЕТА №` → ish (№, ОБОСНОВАНИЕ=шифр,
  nom, birlik, **shu oy hajmi**, summa) → resurslar `N.1…` (kod, nom, birlik, norma, hajm,
  narx, summa) → podval (…НДС, ВСЕГО) → **"Итого по ранее оформленным Формам №2"** →
  "Разница" → imzolar.
- F2 dagi ish № lokal smetadagi № ga **teng emas** (egasi tasdiqladi) — kalit bo'lolmaydi.
- Bir oyda bitta smeta bo'yicha bir nechta F2 (Тротуар, Скважина, ЭО/ЭС…); subpudratchi
  aktlari yaxlit summa.
- Zamena/qo'shimcha faylda belgilanmaydi — smetaga mos kelmasligi bilan bilinadi.
- Bitta shifr obyekt smetasida o'nlab marta uchraydi (E1-1-197-2: НАСОСНАЯ №1 ЛИСТ-24,
  №2 ЛИСТ-31, ЛИСТ-36…) — global shifr qidiruvi noaniq.

**Tizim1 (`Smeta tizimi/35_F2Moslash.js`, `Panel.html` f2Imp*, `37_F2TezYoz.js`,
`38_F2Nazorat.js`, `39_F2Reestr.js`) — isbotlangan sxema:**
1. **Razdel doirasi (scope):** F2 razdel nomi normallashtiriladi (`(ЛИСТ …)`, `ЛИСТ КР-24`,
   `ПЕРЕРАСЧЕТ`, `РАЗДЕЛ:` olib tashlanadi, lotin→kirill, faqat harf+raqam) va shu nomli
   smeta razdeli topiladi; nom mos kelmasa — **chizma kodlari** (КР-5, АР-12, КЖ, ЭО, ВК…,
   oraliq КР-28-35 yoyiladi) bo'yicha. Real o'lchov: ish kodi global 11/54 unikal, o'z
   razdeli ichida 132/186 (71%).
2. **Doira ichida kalitlar:** kod → **kod-kanon** (`Е1101-002-09 ДОП.3` ↔ `E11-1-2-9`) →
   nom+birlik → qat'iy fuzzy (Dice ≥ 0.86, raqamlar aynan, g'olib farqi ≥ 0.12). Doirada
   topilmasa — global (qat'iy emas rejimda).
3. **Faqat yagona (yoki aynan ekvivalent) nomzod bog'lanadi** — aks holda qo'lda.
4. **Himoyalar:** birlik qalqoni (Т↔КГ = 1000×), marka farqi (ПК↔ПБ, АI↔АIII) → "ehtimoliy
   ZAMENA", har smeta qatori bir marta band.
5. **Resurslar faqat bog'langan ish ichida** (kod → kanon → nom+birlik); ish topilmasa —
   bolalar qat'iy rejimda qutqariladi (yetim).
6. **Qo'lda (drag-drop):** o'sha ishga → bog'lash + bolalar avto, topilmagan resurs →
   `add_rs`; boshqa ishga → modal **Bog'lash / Zamena / Qo'shimcha**; razdelga → ish+bolalar
   razdel oxiriga; qatorlar orasiga (gap) → aniq joyga; materialga ish → zamena; F2 razdeli
   smeta razdeliga → butun razdel; ko'p tanlab sudrash → ketma-ket joylashadi. Nomzodlar
   ro'yxati joyi va qoldig'i bilan. Zamena belgisi nomga yozilmaydi (izoh + tarix).
7. **Nazorat:** jonli panel (akt jami / bog'langan / доп / qolgan), F2 REESTR
   (HUJJAT_JAMI ↔ YOZILGAN_JAMI, farq 0 = kafolat, bo'sh bo'lsa "ТЕКШИРИЛМАГАН"), oy muhri,
   undo.

**T2 dagi port:** `frontend/src/lib/f2-match-engine/engine.ts` — Tizim1 dvigatelining aniq
porti (kod-kanon, doira, chizma kodlari, marka farqi, takliflar bor). **Lekin** doiralarni
faqat YUQORI darajadagi RZ bo'yicha quradi: Tizim1 LRV sida yuqori daraja = razdellar edi,
T2 ichma-ich RZ da yuqori daraja = "СМЕТА № …". Natija: F2 razdeli ("РАЗДЕЛ: ЗЕМЛЯНЫЕ
РАБОТЫ (ЛИСТ-24)") doirasi topilmaydi → global qidiruv → ko'p nomzod → bog'lanmaydi.
Tuzatish: doira HAR darajadagi RZ uchun (bola RZ lar ota doirasiga ham kiradi). F2 fayli esa
qo'lda ustun raqamli `f2-import-parse` bilan o'qiladi — anatomiyaga almashtiriladi.

**Baza (T2):** `t2_akt`/`t2_akt_qator` da F2 qatori 0 ta. `t2_nakopitelniy_v1` har `t2_qator`
bo'yicha tasdiqlangan F2 ni oylar kesimida yig'adi. `t2_akt_yarat_v2` — bir aktda bir
`qator_id`, narx/summa F2 dan. `t2_qoshimcha_ish_yarat_v1`, `t2_zamena_ish_yarat_v1` mavjud.

## 2. Mantiq — Tizim1 sxemasi + 4 yaxshilash

```
Smeta (LRV, t2_qator)  ←— har F2 qatori → aniq bitta t2_qator (yoki yangi qo'shimcha/zamena) —→  F2 akt
        └────────── Nakopitelniy = Σ tasdiqlangan F2 (oy bo'yicha) per t2_qator ─────────────┘
```

**Asos — Tizim1 §1.1–1.7 aynan** (kod-kanon, razdel normallashtirish, chizma kodlari,
yagona-nomzod, birlik qalqoni, marka farqi, resurslar ish ichida, yetim qutqarish).

**Yaxshilash A — o'tgan oylar xotirasi (eng kuchli kalit).** Har tasdiqlangan F2 qatori
bog'lanishini "F2 imzosi" bilan saqlaymiz: `normRazdelYo'li + kod-kanon + normNom + birlik`.
Keyingi oy F2 sida aynan shu imzo → o'sha `t2_qator` (agar hali qoldig'i bo'lsa). Oylik F2 lar
bir xil ishlarni takrorlaydi — ikkinchi oydan boshlab deyarli hammasi avtomatik va aniq.

**Yaxshilash B — razdel doirasini o'rganish.** Operator F2 razdelidagi bitta ishni smeta
qatoriga bog'lasa, tizim o'sha F2 razdeli ↔ smeta razdeli juftligini eslab, shu razdelning
qolgan ishlarini shu doira ichida qayta moslaydi (Tizim1 da nom mos kelmasa doira umuman
topilmasdi).

**Yaxshilash C — tartib va qoldiq bo'yicha ajratish (faqat TAKLIF).** Doira ichida bir xil
shifr bir necha marta bo'lsa: F2 dagi ketma-ketlik smetadagi ketma-ketlikka tekislanadi
(LCS) va F2 hajmi ≤ qoldiq sharti bilan eng mosi **oldindan tanlanib**, lekin "◐ tasdiqlang"
holatida qoladi — operator bir bosishda tasdiqlaydi. Avtomatik "✓" faqat yagona nomzodda.

**Yaxshilash D — hajm va pul nazorati.** Har bog'langan qator uchun: oldingi F2 + shu F2 ≤
smeta hajmi (oshsa qizil "ortiqcha"); F2 hujjat ИТОГО = bog'langan + qo'shimcha + zamena
jami (farq 0); "Итого по ранее оформленным Формам №2" = Nakopitelniy (oldingi davrlar).

**Bog'lanish darajasi.** Ish qatori **hajm** (bajarilish) ni, resurslar **pul** ni tashiydi
(ikki marta sanalmaydi). Resurssiz ish (yaxlit) — pul ishda. Mashinist — narxsiz (hajm).

**Holatlar (har F2 qatori):** `✓ aniq` · `◐ tasdiqlang` (taklif) · `✕ topilmadi` ·
`＋ qo'shimcha` (smetada yo'q ish/resurs) · `⇄ zamena` (qaysi ish/material o'rniga) ·
`– o'tkazildi` (sabab bilan, pulga kirmaydi). Saqlash faqat `✕` va `◐` 0 bo'lganda.

## 3. Ikki oynali ekran

```
┌ Obyekt · Davr (fayldan) · F2 fayl(lar) · [Avto-moslash]   Jonli panel: akt jami | bog'langan | ＋ | ⇄ | qolgan | ortiqcha ┐
├──────────────── CHAP: F2 akt daraxti ───────────┬─────────────── O'NG: Smeta (LRV) ────────────────┤
│ РАЗДЕЛ / ish / resurs · hajm · summa · holat    │ smeta hajmi · oldin F2 · shu F2 · qoldiq          │
│ Filtr: Hammasi | Hal qilinmagan | ◐ | Ortiqcha   │ Tanlangan F2 qatorining nomzodlari yoritiladi     │
│ Bosish → o'ngda nomzodlar; sudrash → o'ngga      │ Tashlash: ishga / razdelga / qatorlar orasiga     │
├──────────────────────────────────────────────────┴───────────────────────────────────────────────────┤
│ Tashlash modali (turli ishga): [Bog'lash] [⇄ Zamena — shu ish o'rniga] [＋ Qo'shimcha — razdel oxiriga] │
│ [Qoralamani saqlash] → [Tasdiqlash → Nakopitelniy]   · REESTR: hujjat jami ↔ yozilgan jami (farq 0)      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Ustun raqamlarini qo'lda kiritish yo'q (anatomiya o'qiydi). Klaviatura: ↑/↓ keyingi hal
qilinmagan, Enter — taklifni tasdiqlash. Katta F2 da virtual ro'yxat.

## 4. Bosqichlar

| # | Ish | Qabul mezoni |
|---|---|---|
| F1 | Anatomiya F2 ga: imzo bloki RZ emas; `1 2 3 4` qatori ish emas; podval yig'ma qatorlari ish emas; `(fakt)` varaq ustunlari; hajmi bo'sh ish = bajarilmagan; davr, "Итого по ранее…", ИТОГО/ВСЕГО o'qiladi | 7 real F2 (KORPUS) — ish/resurs soni, jami fayldagi ИТОГО bilan teng |
| F2 | Dvigatel V3 (`lib/f2-moslash-v3/`): Tizim1 qoidalari 1:1 port + A/B/C/D | Tizim1 self-test holatlari + yangi: bir shifr ko'p joyda, xotira, doira o'rganish, zamena material |
| F3 | Ikki oynali UI (`F2ImportNative` qayta yoziladi): drag-drop, modal, nomzodlar, jonli panel | UI testlari; 1000+ qatorda silliq |
| F4 | Yozish: qoralama → tasdiq; qo'shimcha/zamena RPC; REESTR solishtiruvi; F2 imzosi xotirasi | integratsiya testi; prodda egasi bilan |
| F5 | Nakopitelniy va F2 hujjat eksporti hujjat standartida | H1–H9 |

## Qavatlar tartibi — egasi tuzatishi (2026-09-25)

Avto-bog'lash qavatlari: **razdel → shifr → nom → birlik → resurslar (rs/mat/ob) → hajm**.
Hajm ENG OXIRGI va eng kuchsiz qavat (0…+2): F2 ish hajmini ko'pincha qisman oladi, shuning
uchun hajm hech qachon jarima bermaydi va nomzodni yo'qotmaydi — faqat teng ballli nomzodlarni
ajratadi (teng smeta +2, ≤ qoldiq +1). Qoldiqdan oshish — ball emas, ogohlantirish
(o'ng oynadagi qizil "qoldiq").

## F3 — ikki oynali ish joyi (amalga oshirildi)

`/admin/f2` → `F2ImportV3.tsx` + `F2V3Workbench.tsx`, holat mantig'i `lib/f2-moslash-v3/ishJoyi.ts`.
Eski V2 ekran `/admin/f2-eski` da zaxira. Yozish: ish qatori — hajm, resurslar — pul;
`raw_snapshot.manba='f2_v3'` + imzolar → keyingi oylarda xotira orqali avto-bog'lash.
