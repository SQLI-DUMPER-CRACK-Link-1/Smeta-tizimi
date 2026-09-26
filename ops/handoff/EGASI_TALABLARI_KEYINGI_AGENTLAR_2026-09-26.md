# Egasining talablari — keyingi agentlar uchun to'liq topshiriq (2026-09-26)

Muallif: Claude (PTO-LINIYA-YAKUN-001 / PTO-EGASI-JAVOB-001 sessiyasi).
Repo: `SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi` · Supabase: `tuoyrzadkgoltpqkdiyx` · Deploy: Cloudflare Pages (main ga push = deploy).

Bu fayl — egasi aytgan BARCHA talablarning yagona ro'yxati. Pastda: (A) har agent
uchun umumiy qonunlar, (B) bajarilganlar (qayta qilmang, faqat tekshiring),
(C) ochiq vazifalar — har biri alohida agentga beriladigan tayyor prompt.

---

## A. UMUMIY QONUNLAR (har bir promptga qo'shib bering)

```
Sen SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi reposida ishlaysan. Avval AGENTS.md (boot
protokoli: CONSTITUTION, CURRENT_STATE, ACTIVE_TASKS) ni o'qi, ops/ACTIVE_TASKS.json ga
o'z vazifangni owns bilan yoz (boshqa faol vazifaning fayllariga tegma — hozir
F2-IMPORT-V3-001 F2 import fayllarini egallagan).
Qonunlar:
- NULL ≠ 0: noma'lum pul/hajm — bo'sh, jami ham bo'sh, "ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ" ro'yxatida. Taxmin yo'q.
- Manba qiymati va matni o'zgartirilmaydi. Real smeta fayllari repoga qo'yilmaydi (repo ochiq) — testlar sintetik.
- Hujjatlar rus tilida, izoh/hisobot o'zbekcha. Hujjat standarti: docs/architecture/HUJJAT_STANDARTI_V1.md
  (H1–H9): lib/hujjat-yozuvchi (RasmiyVaraq), formulalar tirik, `$` siz, keshlangan <v>, fullCalcOnLoad=1,
  UI == Excel, A4 bir sahifa eniga, Print_Area/Titles, imzolar (ЗАКАЗЧИК/ПОДРЯДЧИК/…), fayl nomi
  <Obyekt>_<Hujjat>_<davr>.xlsx, yangi rang (fill) o'ylab topilmaydi.
- Yig'indilar: hujjat-yozuvchi `sumRefs/bosRefs` (Excel 255 argument chegarasi) yoki SUMIF(belgi ustuni).
- Ikki narx qoidasi (egasi): har hujjatda прямые затраты VA к оплате (nakrutka bilan) —
  lib/nakrutka-podval.ts (kaskad server t2_nakrutka_hisob bilan aynan; Kf kategoriya bo'yicha).
- НДС: F2 resurs qatorlari НДС siz; НДС hujjat oxirida bir marta, sukut 12 % (tahrirlanadi).
- Mashinistlar mehnatini "narxsiz" deb ogohlantirmang.
- t2_rollup ni rekursiv qilmang; t2_obyekt_jami, t2_ai_umumiy, t2_ai_kontekst, t2_mindmap_grafi ga tegmang.
- Parol/cookie so'ramang va kiritmang.
- Production migratsiya: faqat additiv (create or replace / yangi funksiya), .rollback.sql bilan, avval
  tranzaksiyada test (rollback), keyin apply. Destruktiv DDL / real biznes ma'lumotini o'chirish — egasidan
  alohida ruxsat. Egasi 2026-09-25 da "hammasiga ruxsat" bergan, lekin o'chirish/qayta yozishda baribir
  aniq tasdiq oling.
- Isbotlanmagan narsani "tayyor" demang; real fayl/Excel/login kerak bo'lsa — UNKNOWN deb yozing.
- Gate'lar yashil bo'lsa main ga push = deploy: `npx tsc -b`, `npx tsc -p tsconfig.functions.json`,
  `npx oxlint src functions`, `npx vitest run`, `node testlar/hammasi.cjs`, `npm run build`,
  `node ops/governance-check.cjs`, hujjatlar uchun `HUJJAT_NAMUNA_DIR=… npx vitest run hujjat` +
  `node scripts/hujjat-lo-tekshir.mjs …` (LibreOffice qayta hisoblash farqi 0). Merge'dan keyin testlarni
  qayta yurgizing. Cloudflare check-run "Deployed successfully" ni tekshiring.
- Egasi qarori kerak bo'lsa — o'zingiz hal qilmang, ops/handoff/ ga yozing va odam tilida so'rang.
```

---

## B. BAJARILGANLAR (2026-09-25/26, main da, deploy qilingan)

| Talab | Holat | Qayerda |
|---|---|---|
| Hujjat standarti H1–H9, barcha PTO eksportlari rasmiy hujjat | tayyor | lib/hujjat-yozuvchi, *-export.ts |
| Ustunlarni moslashuvchan tushunish (PTO ustun qo'shsa/o'zgartirsa), avtomatik + izoh | tayyor | smeta-anatomiya/ustun-dalil.ts |
| Nakopitelniy smeta jami barglardan; Amfiteatr 43,6 mlrd / nakrutka bilan 56,62 mlrd | prod | migr. 20261101090000 |
| 3000 qator chegarasi — server sahifalash, avtomat | prod | t2_nakopitelniy_v2, t2NakopitelniyToliq |
| НДС 12 % oxirida bir marta, tahrirlanadi | tayyor | nakrutka-podval (kaskad ichida) |
| Ostatka: bajarilmaydigan/bekor ishlar — «ИСКЛЮЧЕНО ИЗ ОСТАТКА», qoralama→tasdiq | tayyor | OstatkaIstisnoPanel, t2_smeta_ozgarish |
| Bekor qilishni PTO+/rahbar/boss/prorab tasdiqlaydi, sabab majburiy | prod | migr. 20261101093000 |
| Slichitelnaya vedomost (smeta↔fakt↔Ф-2, farq) | tayyor | lib/slichitelniy-vedomost.ts; eski prototip o'chirildi |
| Tizimli tezlik: qator tahriri ~10 s → 0,3 s; tasdiq 31,7 s → 1,9 s | prod | migr. 20261101092000, 092500 |
| Nakrutka view КАБ/М/К ni tashlab yuborardi (Suniy Ko'l −39,26 mlrd) | prod | migr. 20261101094000 |
| Ikki narx (прямые + к оплате) + nakrutka podvali: Nakopitelniy, Ф-2 akt, Ф-2 loyihasi, Ostatka, Slichitelniy | tayyor | lib/nakrutka-podval.ts |
| Hujjatni saytda hujjatdagiday ko'rish (👁 tugma) | tayyor | umumiy/hujjat/HujjatKorinish.tsx |
| Hermes (/api/agent/*) o'chirildi | tayyor | — |
| Login: sessiya 90 kun (butunlay o'chirilmadi — xavfsizlik) | tayyor | functions/_shared/auth.ts |

Egasi hali tekshirmagan (UNKNOWN): real login bilan saytda 👁, к оплате ustunlari, Suniy Ko'l Nakopitelniy
Excel, bekor qilish paneli.

---

## C. OCHIQ VAZIFALAR — har biri alohida agentga prompt

Har promptning boshiga A bo'limidagi qonunlarni qo'shing.

### C1. F3 (Справка-счет-фактура / КС-3) — ENG MUHIM
```
Egasi: "F3 — F2 lar ichida turgan schet-faktura sahifalaridan chiqadi. Men faqat bitta qatorda
yozib ketganman, lekin haqiqiy qonuniy F3 da razdellar va ish turlari narxlari bilan berilib, oxirida
nakrutka podvali hisoblanib, eng pastki qatori oxirgi natija bo'lishi va u F2 summalari bilan bir xil
bo'lishi kerak. Har F3 da umumiy summa, shu jumladan shu yil, obyekt boshidan beri va otchetniy
period pozitsiyalarida o'tgan F2 va smeta katta rol o'ynaydi."
Vazifa: lib/forma3-export.ts (hujjat-yozuvchi). Qatorlar: РАЗДЕЛ → ish turlari (bl) narxlari bilan;
ustunlar: сметная стоимость, с начала строительства, с начала года, за отчетный период (прямые);
oxirida nakrutka-podval (lib/nakrutka-podval.ts) har ustunga → ВСЕГО К ОПЛАТЕ. Tekshiruv: F3 ning
"за отчетный период" ВСЕГО = shu davr tasdiqlangan F2 akt(lar)i к оплате jamisi (tiyingacha, farq
bo'lsa diqqat). Manba: t2_nakopitelniy_v2 (oldingi/joriy), t2_akt (oy, yil), t2_forma3 jadvali va
t2_forma3_yarat_v1 (FORMA3_RULE_UNRESOLVED ni egasining shu qoidasi bilan yopish — ops/handoff/
PTO_EGASI_QARORLARI_2026-09-25.md Q1 ga javobni yozing). UI: Nakopitelniy/Hujjat nazorati sahifasida
"F3 Excel" + 👁. LibreOffice farqi 0.
```

### C2. АОСР va ijro hujjatlari (T2 native), logo, kolontitul
```
Egasi: "АОСР ning ШНК si bor, 3 bilan boshlanadi shifri, templateda yozilgan — shundan ko'rish
mumkin. Templateni ko'rib, o'zgartirish kerak bo'lsa o'zgartir. Kompaniya logosini yuklash va sayt
burchagidagi akkauntda ko'rinib turishi, aktlarning burchagida shu emblema. Hujjatlar
kolontitullarida bizning tizimning reklamasi bo'lishi kerak. АОСР qilinmagan bo'lsa ogohlantirish
berilsin, lekin F2 taqiqlanmasin."
Reja: ops/handoff/IJRO_HUJJATLARI_T2_REJA_2026-09-25.md (ma'lumot modeli t2_ijro_hujjat,
t2_ijro_hujjat_qator, t2_ijro_hujjat_fayl; generator; nazorat "fakt bor — АОСР yo'q"; T1 REYESTR
importi). T1 generatori: "Akt generator/Code.js" (blank kataklari, komissiya, imzo joylari,
REYESTR ustunlari) va Smeta tizimi/45_Hujjatlar.js, 67_AI_Akt.js. Blank — ShNQ 3.01.01-22 6-ilova;
shifr "3..." bilan boshlanadi — T1 template (TPL_WITH_SUB / TEMPLATE_NO_SUB_SHEET) tuzilmasidan oling,
real blank fayli repoga qo'yilmaydi. Oraliq qabul (ответственные конструкции), sinov va laboratoriya
aktlari — o'sha jadvalda tur bilan.
Qo'shimcha: kompaniya logosi (R2 ga yuklash, t2_kompaniya ga havola), sayt yuqori burchagidagi
akkaunt blokida ko'rsatish; hujjat-yozuvchi RasmiyVaraq ga logo (xl/media + drawing) va kolontitul
(headerFooter: "Сформировано в системе <nom> — <sayt>") qo'shish — barcha hujjatlarga birdaniga.
АОСР yo'q yashirin ish — F2 tayyorlashda ogohlantirish, bloklamasdan.
```

### C3. Katalog va narx takliflari (mashina, чел-час, material)
```
Egasi: "Tizimga katalog va mashina-mexanizm kalkulyatsiyalarini yuklash imkonini qo'shishimiz kerak.
Mashina-mexanizm narxini o'sha bazadagi eng qimmatini taklif qilishi kerak. Чел-час ham region
bo'yicha kalkulyatsiyasi kvartal va yil bo'yicha e'lon qilib boriladi — bu ham taklif etilsin.
Katalog ham kvartalda e'lon qilinadi (Iqtisodiyot vazirligi) — moslarini taklif etsin."
Vazifa: narx bazasi jadvallari (tenant, manba, region, yil, kvartal, versiya, audit): katalog
(material, kod/nom/birlik/narx), mashina-mexanizm kalkulyatsiyasi (shifr, nom, maш-час narxi),
чел-час (region, razryad/o'rtacha, narx). Yuklash: Excel importi smeta-anatomiya/ustun-dalil
uslubida (ustunlarni moslashuvchan tanish). Taklif: smeta qatori (kat МАШ/ЧЕЛ/МАТ, shifr/nom/birlik)
uchun mos narxlar — mashina: bazadagi eng qimmati (egasi qoidasi), чел-час: obyekt regioni + eng
yangi kvartal, material: eng yangi katalog kvartali; moslik ishonchi va manba ko'rsatiladi,
operator tasdiqlaydi (avtomatik yozilmaydi). Mavjud narxlash: lib/res-narxlash.ts,
SmetaNarxlashResNative.tsx, NarxNazoratNative.tsx — ular bilan birlashtiring.
```

### C4. Smetani tushunishning yagona tizimi (anatomiya)
```
Egasi: "Bu eng muhim ishlardan. Aynan smetani to'liq tushuna oladigan bitta tizim orqali bo'lishi
kerak va faqat o'sha o'qitilishi, rivojlantirilishi orqali tizim universallashishi kerak."
Vazifa: barcha smeta/Excel o'quvchilari (SmetaYuklaNative, F2 import, Oferta RES, RES narxlash,
Resurs vedomost importi, LRV) faqat lib/smeta-anatomiya orqali o'qisin (docs/architecture/
SMETA_ANATOMIYA_V1.md). Profil (varaq imzosi) bazada saqlansin va o'rganilsin (kompaniya bo'yicha,
versiya, audit). Korpus manifesti (smeta-anatomiya/korpus) real fayllar bilan egasining PC da
yurgiziladi (UNKNOWN). Diqqat: F2 import fayllari F2-IMPORT-V3-001 vazifasida — u bilan
kelishilgan holda (ACTIVE_TASKS) ishlang. testlar/t2_smeta_oqish_yagona.test.cjs qoidasini
kuchaytiring.
```

### C5. LRV ↔ RES farqlari smeta yuklanganda
```
Egasi: "LRV va RES o'rtasidagi farqlar smeta yuklanganda hisoblanilishi, farqlari tekshirilishi
va foydalanuvchiga va hujjatda bildirilishi kerak."
Vazifa: smeta yuklashda (SmetaYuklaNative → anatomiya) LRV (ish+resurs, norma×hajm) va RES (resurs
vedomost) jamilarini resurs kodi/nomi/birligi bo'yicha solishtirish: hajm va summa farqi, faqat
birida bor pozitsiyalar. Natija: yuklash oynasida ogohlantirish + saqlanadigan hisobot (jadval) +
Excel hujjat «Сверка ЛРВ и РС» (hujjat-yozuvchi, H1–H9). Taxminiy moslash yo'q — moslanmaganlar
ochiq ro'yxatda.
```

### C6. Suniy Ko'l (obyekt 84) dublikat qatorlar
```
Egasi: "Nimaga qayta kirgan? Agar xato bo'lsa to'g'rilab ber."
Holat: 2 413 vedomost qatori ish sifatida ikki marta (PTO_EGASI_QARORLARI Q7). Vazifa: sababni
kod bilan toping (import konveyeri, qayta import, svod/lokal), dalil bilan hisobot; xato bo'lsa
import kodini tuzating va ma'lumotni tuzatish rejasini (dry-run, rollback) tayyorlang. Real
ma'lumotni o'chirish/qayta yozish — egasiga dry-run natijasini ko'rsatib, aniq tasdiq bilan.
```

### C7. Kichik ochiq masalalar
```
- 17-kompaniyada (Suniy Ko'l va boshqalar) nakrutka foizlari kiritilmagan — к оплате = прямые +
  НДС. Egasidan so'rang: foizlarni kiritadimi yoki 1-kompaniyanikini ko'chirish kerakmi (yozuv —
  tasdiq bilan).
- Xavfsizlik: t2_obyekt_nakrutka va t2_qator_holat view larida anon/authenticated ga to'liq grant
  bor (Q5) — frontend anon kalitni ishlatmasligini tekshirib, revoke qiling (additiv migratsiya).
- Login: egasi "login oynasi chiqmasin" dedi — hozir 90 kunlik sessiya; eski 12 soatlik cookie va
  har deploy preview manzili (xxxx.smeta-tizimi.pages.dev) sababli qayta so'raydi. Asosiy manzilda
  bir marta kirish kifoya. Butunlay o'chirish so'ralsa — faqat preview/test muhiti uchun.
- Nakopitelniy ekrani katta obyektda birinchi 500 qatorni ko'rsatadi (Excel to'liq) — 👁 oynasi
  bilan to'liq ko'rish bor; ekranni ham sahifalash mumkin.
- ТЕПЛОТРАССА 02-04/02-05 −1,70 чел-ч, Faravon belgi farqi (Q8, Q9) — egasi ko'rib chiqadi.
- P-rejadan qisman qolganlar: 3 yuklash ekranini bitta ko'rib chiqish ekraniga birlashtirish,
  jonli <4 s o'lchovi, real korpus.
```

---

## D. Muhim fayllar

- Qarorlar: `ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md`
- Hisobot: `ops/handoff/PTO_LINIYA_YAKUN_HISOBOT_2026-09-25.md`
- Ijro hujjatlari rejasi: `ops/handoff/IJRO_HUJJATLARI_T2_REJA_2026-09-25.md`
- Standart: `docs/architecture/HUJJAT_STANDARTI_V1.md`, `docs/architecture/SMETA_ANATOMIYA_V1.md`
- Katalog: `docs/architecture/UZ_CONSTRUCTION_DOCUMENT_CATALOG_AND_TEMPLATES_V1.md`
- Kod: `frontend/src/lib/hujjat-yozuvchi/`, `frontend/src/lib/nakrutka-podval.ts`,
  `frontend/src/umumiy/hujjat/HujjatKorinish.tsx`, `supabase/migrations/2026110109*`
