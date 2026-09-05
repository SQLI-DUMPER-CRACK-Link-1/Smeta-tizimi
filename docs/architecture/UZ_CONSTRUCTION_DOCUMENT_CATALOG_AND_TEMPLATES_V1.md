# O‘ZBEKISTON QURILISH HUJJATLARI KATALOGI VA TIZIM SHABLONLARI — V1

**Holat:** TADQIQOT / implementatsiya kontrakti emas  
**Maqsad:** TIZIM_02 ichida qurilish hujjatlarini qonuniy kuchi, dalil manbasi
va ish jarayonidagi vazifasiga qarab to‘g‘ri modellashtirish.  
**Qamrov:** yangi qurilish, rekonstruksiya va kapital ta’mirning odatiy
pudrat jarayoni. Obyekt turi, mablag‘ manbasi, shartnoma va maxsus ShNQlar
qo‘shimcha talab qo‘yishi mumkin.

> Bu hujjat “har bir obyektga aynan bitta universal blank” deb da’vo qilmaydi.
> Qonunda aniq ilovasi bo‘lgan shakl — normativ shakl; shartnoma yoki
> buyurtmachi talab qilgan shakl — shartnomaviy shakl; nakopitelniy va
> slichitelniy kabi reestrlar esa ichki nazorat shaklidir. TIZIM_02 ularni
> aralashtirmaydi.

---

## 1. Qonuniy manba va ishonchlilik darajasi

| Daraja | Tizimdagi ma’nosi | Misol |
|---|---|---|
| **A — normativ shakl** | Maydonlar normativ ilovaga to‘liq mos bo‘lishi kerak; eksportda blank ixtiyoriy o‘zgarmaydi. | ShNQ 3.01.01-22 1-, 6-, 7-ilovalari. |
| **B — davlat xizmati / reglament** | Obyekt turi va tartibiga qarab davlat portalidagi jarayon; tizim faqat paket va holatni yuritadi. | Foydalanishga qabul qilish/ruxsatnoma. |
| **C — shartnomaviy yoki buyurtmachi shakli** | Nom, ustunlar, tasdiqlash ketma-ketligi shartnoma/prokurment talabidan olinadi. | F-2, F-3, resurs hisoboti, to‘lov sertifikati. |
| **D — ichki nazorat reestri** | Boshqaruv va taqqoslash uchun; o‘zi bilan tashqi qabul yoki to‘lovni huquqiy tasdiqlamaydi. | Nakopitelniy, slichitelniy, risk reestri. |
| **E — loyiha/maxsus texnik hujjat** | Faqat tegishli ish, uskuna yoki standart talab qilsa majburiy. | Laboratoriya sinovi, geodezik sxema, bosim sinovi. |

### Tasdiqlangan tayanchlar

- Qurilish, rekonstruksiya va kapital ta’mirda barcha ish turlari uchun
  **Ishlarning umumiy jurnali** yuritilishi lozim; ShNQ unga tayyor namuna
  beradi. Shuningdek, yopiq ish dalolatnomasi keyingi ish boshlanishidan oldin,
  muhim konstruksiya esa oraliq qabul dalolatnomasi bilan rasmiylashtiriladi.
  [ShNQ 3.01.01-22, 189-son buyruq](https://mc.uz/uploads/mcuz_56216353799793.pdf)
- Davlat va yirik pudrat amaliyotidagi “ijro hujjatlari” tarkibiga as-built
  ishchi chizmalar, sifat sertifikatlari/pasportlar, yopiq ishlar dalolatnomasi,
  mas’ul konstruksiyalar dalolatnomasi, uskuna sinovi dalolatnomasi va jurnallar
  kiradi. Bu ro‘yxat shartnoma namunalarida ham ishlatiladi, ammo loyiha va
  shartnoma uni kengaytirishi mumkin.
  [Davlat qurilish pudrati namunasi](https://apisitender.mc.uz/storage/138794/contract/68/2257c060-4ab1-4102-9514-ffd0425b0758.pdf)
- Obyektni foydalanishga qabul qilish hamda ruxsatnoma davlat xizmati alohida
  jarayon: ruxsatga oid rekvizitlar, komissiya xulosalari, inspeksiya va
  kadastr holatlari ichki F-2 bilan almashtirilmaydi.
  [Yagona portal — VM 200-son tartibi](https://my.gov.uz/uz/service/480)

### Muhim aniqlik: F-2 / F-3

“F-2”, “Forma-2”, “KS-2”, “F-3”, “KS-3” atamalari amaliyotda juda keng
uchraydi. Lekin bu tadqiqotda ularning **bugungi barcha obyektlar uchun yagona
majburiy davlat blanki** ekanini tasdiqlovchi amaldagi birlamchi normativ
manba topilmadi. Shu bois TIZIM_02:

1. ularni `contractual_certification_template` sifatida yuritadi;
2. aniq buyurtmachi/shartnoma talabidagi blankni versiyalaydi;
3. moliyaviy satrlar va tasdiqlash dalilini kanonik saqlaydi;
4. “F-3 qonuniy jami” yoki soliq/to‘lov qiymatini manbasiz hisoblab bermaydi.

Amaliy shartnomalarda odatda ikki bog‘liq dalil alohida yuradi: bajarilgan
ishlar hajmini topshirish-qabul qilish dalolatnomasi va pudratchi taqdim etgan
qiymat bo‘yicha ma’lumotnoma-hisobvaraq-faktura. Kompaniyaning Drive’dagi
amaldagi blanklarida ularning aniq profili quyidagicha:

- `АКТ О ПРИЁМКЕ ВЫПОЛНЕННЫХ РАБОТ (Форма № 02)` — **Forma-2**;
- `СПРАВКА-СЧЕТ-ФАКТУРА О СТОИМОСТИ ВЫПОЛНЕННЫХ РАБОТ ...` — **Forma-3**.

TIZIM_02 ularni bitta nom ostida yo‘qotmaydi: `forma2_act` va
`forma3_value_invoice` alohida hujjat turlari, zarur bo‘lsa bitta
davr/qatorlar to‘plamiga bog‘langan ikki eksport bo‘ladi. [O‘zbekiston
shartnoma namunasi](https://ufa.uz/wp-content/uploads/2025/05/farg%E2%80%98ona_uchun_futbol_maydonini_xarid_qilish_to%E2%80%98g%E2%80%98risidagi.pdf)

Demak, eski F-2/F-3 eksporti qo‘llab-quvvatlanadi, biroq **“davlatning universal
majburiy blanki”** deb noto‘g‘ri belgilanmaydi. Davlat mablag‘i, g‘aznachilik,
QQS/EHF yoki maxsus buyurtmachi uchun tegishli amaldagi reglament va shartnoma
raqami obyekt kartasiga kiritilgach, mos rasmiy eksport yoqiladi.

---

## 2. Hujjatlar bir-biriga qanday ulanadi

```text
Shartnoma + loyiha/smeta reviziyasi
        │
        ├─ Ishni bajarish loyihasi / kalendar reja / texnologik xarita
        │        │
        │        ├─ Ishlarning umumiy jurnali
        │        ├─ Material sertifikati, pasporti, kirish nazorati
        │        ├─ Laboratoriya / geodeziya / uskuna sinovi (shart bo‘lsa)
        │        ├─ Yopiq ishlar dalolatnomasi (AOSR)
        │        └─ Mas’ul konstruksiyani oraliq qabul qilish dalolatnomasi
        │
        ├─ Bajarilgan ishlarni qabul qilish/to‘lov sertifikati (F-2/KS-2 yoki
        │   shartnoma blanki) → faqat tasdiqlangan qatorlar
        │        │
        │        ├─ Nakopitelniy — davriy jamlanma, ichki nazorat
        │        ├─ Slichitelnaya vedomost — manbalar taqqoslanishi, ichki nazorat
        │        └─ F-3/qiymat ma’lumotnomasi — faqat tanlangan shartnoma shakli
        │
        └─ Ijro hujjatlari papkasi + yakuniy qabul/ruxsat jarayoni
```

**Qonun:** bir satrning nomi, o‘lchov birligi yoki miqdorini nakopitelniy,
slichitelniy yoki eksport uchun o‘zgartirish mumkin emas. Ular kanonik smeta,
Fakt va tasdiqlangan F-2 qatorlarining ko‘rinishlari; manba satri har doim
o‘zining barqaror IDsi bilan saqlanadi.

---

## 3. Tizim uchun to‘liq hujjatlar katalogi

| Kod | Hujjat | Daraja | Qachon kerak | Kanonik bog‘lanish | Tizimdagi holat |
|---|---|---|---|---|---|
| DOC-01 | Pudrat shartnomasi va ilovalari | C | Har bir pudratda | kompaniya, loyiha, obyekt, shartnoma | Asosiy kartochka + fayl |
| DOC-02 | Loyiha/smeta reviziyasi, BOQ | A/C | Ish hajmi va qiymat bazasi | `t2_qator`, revision | Immutable reviziya |
| DOC-03 | Qurilishni tashkil etish loyihasi / kalendar reja | A/E | ShNQ va loyiha sharti bo‘yicha | loyiha, davr, topshiriq | Versiyali fayl + nazorat |
| DOC-04 | Ishlarni bajarish loyihasi, texnologik xarita | A/E | Ish turiga qarab | ish turi, obyekt, reviziya | Versiyali fayl + check-list |
| DOC-05 | Ishlarning umumiy jurnali | **A** | Barcha ish turlari | obyekt, sana, javobgar | Normativ blank eksporti |
| DOC-06 | Material/konstruksiya sertifikati, pasport, kirish nazorati | E | Material/uskuna qo‘llansa | resurs, partiya, AOSR | Fayl/evidence, expiry/lot |
| DOC-07 | Laboratoriya, geodeziya, bosim/yakka/kompleks sinov dalolatnomasi | E | Ishchi loyiha yoki normativ talab qilsa | ish/konstruksiya/uskuna | Maxsus shakl reestri |
| DOC-08 | Yopiq ishlar dalolatnomasi (AOSR) | **A** | Ish keyingi qatlam bilan berkitilsa | ishchi chizma, satr, material, joy | ShNQ 6-ilova blanki |
| DOC-09 | Muhim konstruksiyani oraliq qabul qilish dalolatnomasi | **A** | Muhim/yuk ko‘taruvchi konstruksiya | konstruksiya, chizma, sinov | ShNQ 7-ilova blanki |
| DOC-10 | As-built ishchi chizma | C/E | Ijro hujjatlari paketi | chizma reviziyasi, obyekt qismi | Fayl + o‘zgarish belgisi |
| DOC-11 | Forma-2 — bajarilgan ishlar hajmini qabul qilish dalolatnomasi | C | Davriy qabul/to‘lov | `t2_akt`, `t2_akt_qator` | Exact certified snapshot |
| DOC-12 | Qiymat ma’lumotnomasi-hisobvaraq-faktura yoki F-3/KS-3 nomli blank | C | Shartnoma talab qilsa | tasdiqlangan qabul satrlari | `FORMA3_RULE_UNRESOLVED` saqlanadi |
| DOC-13 | Nakopitelnaya vedomost | **D** | Davriy/jamlangan nazorat | approved F-2, smeta reviziyasi | Read-only proyeksiya |
| DOC-14 | Slichitelnaya vedomost | **D** | Smeta–fakt–F-2–ombor/Drive farqini tekshirish | ikkita manba + evidence | Taqqoslash, hech narsani yozmaydi |
| DOC-15 | O‘zgarish dalolatnomasi / qo‘shimcha ish / almashtirish | C/E | Tasdiqlangan scope o‘zgarishi | `t2_smeta_ozgarish`, satr relation | Version, audit, approval |
| DOC-16 | Nuqsonlar dalolatnomasi / bartaraf etish reestri | C/E | Sifat nuqsoni aniqlansa | obyekt qismi, evidence, ijrochi | Status va dalil |
| DOC-17 | Ijro hujjatlari ro‘yxati (closeout index) | C/E | Qabulga tayyorgarlikda | document registry | Gaplar ko‘rinishi |
| DOC-18 | Foydalanishga qabul/ruxsat paketi | **B** | Obyekt tugagach | obyekt, davlat xizmati, QR/raqam | Jarayon kuzatuvi; blankni davlat yaratadi |

---

## 4. Tayyor tizim shablonlari

Quyidagi shablonlar **maydonlar modeli**. A-darajali blank eksporti normativ
ilovaning tartibi va matniga mos bo‘lishi kerak; bu yerda uning maydonlari
raqamli modelga ajratilgan. C–E darajalarida loyiha shartnomasi qo‘shimcha
ustunlarni belgilashi mumkin.

### TPL-01 — Ishlarning umumiy jurnali (DOC-05, ShNQ 1-ilova)

**Muqova:**

| Maydon | Qiymat manbasi |
|---|---|
| Pudrat tashkiloti | shartnoma tomoni |
| Jurnal raqami | obyekt ichida yagona raqam |
| Obyekt nomi va manzili | obyekt kartasi |
| Mas’ul shaxs, lavozim, imzo | vakolatli foydalanuvchi/ERI |
| Bosh loyiha tashkiloti, loyiha bosh muhandisi | loyiha qatnashchilari |
| Buyurtmachi texnik nazorati | loyiha qatnashchilari |
| Boshlanish/tugash: shartnoma va amaldagi sana | shartnoma + fakt |
| Shartnomaviy narx, tasdiqlash/ekspertiza ma’lumoti | shartnoma + revision |

**Jadval bloklari:**

1. Muhandis-texnik xodimlar: F.I.O., ish boshlanishi, ruxsat belgisi,
   tugash sanasi.
2. Yopiq ishlar va mas’ul konstruksiya dalolatnomalari: raqam, nomi, joyi,
   imzo va sana.
3. Sifat nazorati: sana, konstruktiv qism/element, chizma havolasi, baho,
   imzo.
4. Kunlik ish yozuvi: sana, qisqacha ish va sharoit, material/uskuna,
   to‘xtash yoki ko‘rsatma, ijrochi va tekshiruvchi imzosi.

**Tizim cheklovi:** jurnal satri tasdiqlangach o‘chirilmaydi; tuzatish yangi
izoh/versiya bilan yoziladi. Jurnal satri F-2 miqdorini o‘zi yaratmaydi.

### TPL-02 — Yopiq ishlar dalolatnomasi / AOSR (DOC-08, ShNQ 6-ilova)

| Blok | Majburiy maydon |
|---|---|
| Identifikatsiya | dalolatnoma №, sana, obyekt va joylashuv, ish nomi |
| Ishchi guruh | pudratchi, buyurtmachi texnik nazorati, loyiha tashkiloti vakili: lavozim/F.I.O./vakolat |
| Ko‘rik predmeti | ko‘rikka taqdim etilgan yopiq ish/konstruksiya; uning barqaror satr IDsi |
| Loyiha asosi | ishchi loyiha tashkiloti, chizma № va sana, reviziya |
| Sifat dalili | material/konstruksiya/mahsulot, sertifikat yoki sifat hujjati №/sana/fayl |
| Chetlanish | loyiha hujjatidan chetlanish: `yo‘q` yoki dalolatnoma/kelishuv havolasi |
| Muddat | ishning boshlanishi va tugashi |
| Qaror | ish loyiha va normativga mos/mos emas; keyingi ishga ruxsat yoki rad sababi |
| Imzolar | har bir rolning imzosi/ERI, sana; ilovalar ro‘yxati |

**Qonun:** dalolatnoma keyingi ish boshlanishidan oldin tuziladi. Shuning uchun
`next_work_allowed=false` holatida bog‘langan keyingi qatlam uchun tasdiqlash
signalini chiqarish mumkin, lekin tizim faktni avtomatik “qabul qilingan” deb
yozmaydi.

### TPL-03 — Muhim konstruksiyani oraliq qabul qilish dalolatnomasi (DOC-09, ShNQ 7-ilova)

| Blok | Majburiy maydon |
|---|---|
| Identifikatsiya | №, sana, obyekt, konstruksiya va aniq joyi |
| Komissiya | pudratchi, buyurtmachi texnik nazorati, loyiha vakili va zarur maxsus vakillar |
| Loyiha bog‘lanishi | chizma/reviziya, konstruksiya markasi yoki o‘qi |
| Dalillar | AOSRlar, sertifikat/pasportlar, laboratoriya/geodeziya/sinov dalolatnomalari |
| Ko‘rik | amalda bajarilgan holat, o‘lchovlar, chetlanish, bartaraf etish talabi |
| Xulosa | qabul qilindi / shart bilan qabul qilindi / rad etildi; keyingi bosqichga ruxsat |
| Imzolar | komissiya a’zolari, sana, ERI/fayl |

### TPL-04 — Material, konstruksiya va uskuna sifat pasporti kartasi (DOC-06)

| Maydon | Izoh |
|---|---|
| Material/uskuna ID, nomi, markasi, birlik | katalogdagi mavjud dalil; AI to‘ldirmaydi |
| Ishlab chiqaruvchi va yetkazib beruvchi | kontragent kartasi |
| Partiya/lot, ishlab chiqarilgan sana | birlamchi hujjatdan |
| Sertifikat/pasport/protokol № va sana | fayl bilan bog‘langan |
| Muvofiqlik muddati | agar hujjatda mavjud bo‘lsa |
| Miqdor va qabul sanasi | ombor/kirish nazorati dalili |
| Qayerda ishlatildi | obyekt/qator/AOSR bog‘lanishi |
| Kirish nazorati xulosasi | qabul qilingan / rad / karantin; sabab va imzo |

### TPL-05 — Maxsus sinov yoki geodezik dalolatnoma (DOC-07)

Bu universal bitta blank emas. Har bir tur `test_type` bilan versiyalanadi:
`laboratoriya`, `beton_kubi`, `zichlash`, `bosim`, `germetiklik`,
`elektr_izolyatsiya`, `yakka_sinov`, `kompleks_sinov`, `geodeziya`.

Minimal umumiy qism: protokol №/sana, obyekt/joy, bog‘langan ishchi chizma,
usul yoki standart, asbob va kalibrovka, namuna/uskuna ID, kutilgan mezon,
o‘lchangan natija, xulosa, laboratoriya/mas’ul imzo, ilova fayli. Natija
`unknown` bo‘lsa “0” yozilmaydi.

### TPL-06 — Forma-2: bajarilgan ishlarni qabul qilish dalolatnomasi (DOC-11)

Bu shartnomaviy blankning kanonik qator modeli:

| Ustun | Qoidasi |
|---|---|
| Hujjat №, davr, obyekt, shartnoma | muqova identifikatsiyasi |
| Smeta qatori ID, kod, professional nomi, birlik | manba reviziyasidan; eksport nomi mutatsiya qilinmaydi |
| Tasdiqlangan miqdor | aynan manba/ko‘rikdan keladi |
| Sertifikatlangan birlik narxi | alohida snapshot |
| **Sertifikatlangan summa** | manba hujjatidagi original qiymat; `miqdor × narx`dan farq qilishi mumkin |
| Hisoblangan summa | faqat analitika; original summani almashtirmaydi |
| Arifmetik farq | `original − hisoblangan`, sharh talab qiladi |
| Oldingi / joriy / jami | faqat tasdiqlangan tarixdan, davr bo‘yicha |
| Dalil | jurnal, AOSR, sinov, foto yoki boshqa attachment ID |
| Holat | qoralama → ko‘rib chiqish → tasdiqlangan/rad etilgan/bekor |

**Qonun:** tasdiqlangan satrning miqdor/narx/summasi muzlaydi; keyingi smeta,
katalog yoki xarid narxi uni qayta yozmaydi. Xarid narxi sertifikatlangan narx
emas, alohida biznes faktidir.

**Unga bog‘lanadigan qiymat hujjati:** kompaniyaning amaldagi blankida
`forma3_value_invoice` — `СПРАВКА-СЧЕТ-ФАКТУРА О СТОИМОСТИ ВЫПОЛНЕННЫХ
РАБОТ ...`. U Forma-2ning o‘zi emas, alohida document ID bilan yaratiladigan
**Forma-3**. Forma-3 faqat tasdiqlangan qabul satrlari hamda shartnomada
tasdiqlangan formulalarga tayanadi; “noma’lum” QQS, ushlab qolish yoki boshqa
to‘lov elementlari avtomatik nolga almashtirilmaydi.

### TPL-07 — Nakopitelnaya vedomost (DOC-13, ichki nazorat)

| Smeta satri | Birlik | Bazaviy hajm | Tasdiqlangan o‘zgarish | Jami limit | Oldingi tasdiqlangan F-2 | Joriy F-2 | Jami F-2 | Qoldiq | Sertifikatlangan summa | Holat |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `stable_line_id` | manba | B | Δapproved | B+Δ | P | C | P+C | (B+Δ)-(P+C) | source amount | normal/chegara/ortiqcha |

**Qoidalar:**

- faqat `tasdiqlangan` F-2 qatorlari kiradi;
- qoralama, rad etilgan va bekor qilingan hujjat nol emas — umuman hisobga
  kirmaydi;
- davr filtri hujjat sanasi/oyini aniq ko‘rsatadi;
- oldingi davr natijasi muzlagan F-2 snapshotidan olinadi;
- nakopitelniy tashqi hujjatni yoki qatorni tahrir qilmaydi;
- Nakopitelniy Forma-3ning o‘rnini bosa olmaydi: u ichki nazorat proyeksiyasi,
  Forma-3 esa davriy qiymat ma’lumotnomasi-hisobvaraq-faktura eksportidir.

### TPL-08 — Slichitelnaya vedomost (DOC-14, ichki reconciliation)

| Taqqoslash kaliti | A manba | B manba | A qiymat | B qiymat | Farq | Holat | Dalil | Qaror |
|---|---|---|---:|---:|---:|---|---|---|
| `canonical_line_id` yoki tasdiqlangan mapping ID | smeta/F-2/ombor/Sheet | boshqa manba | original | original | A−B | mos/farq/noaniq | file/event ID | ochiq/tasdiq/rad |

**Qoidalar:** satr raqami identifikator emas; faqat barqaror ID yoki inson
tasdiqlagan mapping ishlatiladi. Faqat indekslar bir xil bo‘lgani uchun ikki
satrni bog‘lash taqiqlanadi. Bu vedomost farqni ko‘rsatadi, “to‘g‘rilash”ni
o‘zi bajarmaydi.

### TPL-09 — Qo‘shimcha ish / almashtirish o‘zgarish dalolatnomasi (DOC-15)

| Blok | Maydon |
|---|---|
| Buyruq | operation ID, raqam, sana, tashabbuskor, sabab, shartnoma/loyiha asoslari |
| Turi | qo‘shimcha ish / almashtirish / hajm o‘zgarishi / resurs bolasi |
| Manba satr | eski satr ID va immutable snapshot; almashtirishda eski satr o‘chmaydi |
| Yangi satr | yangi stable ID, ota satr, tartib kaliti, nom/kod/birlik manbasi |
| Qiymat asosi | tasdiqlangan revision yoki narx-asos hujjati; bo‘lmasa `UNKNOWN_REFERENCE` |
| Tasdiqlash | loyiha, buyurtmachi, pudratchi vakolati; sana va dalil |
| Audit | expected version, actor, old/new relation, idempotent operation ID |

### TPL-10 — Nuqsonlar dalolatnomasi va bartaraf etish reestri (DOC-16)

| Maydon | Mazmuni |
|---|---|
| №, sana, aniqlovchi shaxs | kim va qachon aniqladi |
| Obyekt qismi / ishchi chizma / satr | aniqlanadigan manba |
| Nuqson tavsifi va dalil | foto, sinov, jurnal yoki AOSR havolasi |
| Me’yor yoki loyiha talabi | aniq havola; taxmin emas |
| Mas’ul ijrochi va muddat | shartnomadagi rol |
| Bartaraf etish dalili | qayta ko‘rik/sinov, fayl, imzo |
| Holat | ochiq → tuzatildi → qayta tekshirildi → yopildi/rad |

### TPL-11 — Ijro hujjatlari papkasi indeksi (DOC-17)

| Bo‘lim | Hujjat turi | №/sana | Reviziya | Obyekt qismi | Fayl hash/ID | Holat | Tekshiruvchi |
|---|---|---|---|---|---|---|---|
| Ishchi chizmalar | as-built | … | … | … | private R2 object ID | bor/missing/superseded | … |

Majburiylik loyiha turiga qarab `required`, `conditional`, `not_applicable`
bilan belgilanishi lozim. `missing` bo‘lgan hujjat “qabul qilingan”ga
o‘zgartirilmaydi.

### TPL-12 — Yakuniy qabul va foydalanishga ruxsat paketi (DOC-18)

| Blok | Tizimda saqlanadigan narsa |
|---|---|
| Davlat xizmati | xizmat turi, ariza ID, yuborilgan sana, holat, ruxsat/QR/raqam |
| Tayyorlik paketi | ijro hujjatlari indeksi, sinov dalolatnomalari, tarmoqlar ma’lumoti, xulosalar |
| Komissiya | vakolatli tashkilot va imzo/ERI dalili |
| Natija | ruxsat berildi/rad etildi/qayta ishlash; qaror hujjati |
| Kadastr | tegishli identifikator va holat |

Davlat portalida dalolatnoma loyihasi vakolatli organ tomonidan elektron
shakllantirilishi mumkin; TIZIM_02 o‘rniga soxta “davlat dalolatnomasi”
yaratmaydi. U faqat tayyorlov paketi va haqiqiy natija rekvizitlarini saqlaydi.

---

## 5. TIZIM_02 uchun qonuniy model

### 5.1. Hujjat reestrining minimal rekvizitlari

Har bir hujjatda kamida:

```text
document_id, document_type, legal_level, template_version,
company_id, project_id, object_id, contract_id?, source_revision_id?,
status, document_number?, issue_date?, approved_at?,
issuer_role, approver_roles[], source_file_id, file_hash,
related_entity_ids[], provenance, created_by, created_at, audit trail
```

bo‘lishi kerak. Faylning binar haqiqati private R2da, biznes metama’lumoti
Supabaseda saqlanadi; Drive/Sheets faqat ikkilamchi sinxron nusxa bo‘lishi
mumkin. Fayl hash va versiya originalni keyin almashtirib yuborishni aniqlaydi.

### 5.2. Holatlar

```text
qoralama → ko‘rib_chiqishda → tasdiqlangan
                              ↘ rad_etilgan
tasdiqlangan → bekor_qilingan (tarix saqlanadi)
```

`tasdiqlangan` satr yoki dokument qiymatlarini tahrirlash o‘rniga yangi
reviziya/kompensatsion hujjat yaratiladi. Har yozuvda actor, operation ID,
expected version va audit bo‘lishi kerak.

### 5.3. “Nima tizim o‘zi qilmasligi kerak”

- AOSR imzosini, laboratoriya natijasini, sertifikat raqamini yoki chizma
  chetlanishini AI uydirmaydi.
- F-2 satrida `miqdor × narx`ni manba summasining o‘rniga yozmaydi.
- F-3 yoki to‘lov jami uchun qonuniy formula va asos aniq tasdiqlanmaguncha
  soliq, QQS, ushlab qolish yoki qarzdorlikni o‘zi hisoblab chiqarmaydi.
- Slichitelnaya farq chiqqanda hech qaysi manbani avtomatik tahrir qilmaydi.
- Satr raqami, Drive papka nomi yoki ko‘rinadigan “+ / ~” markerini kanonik
  identifikator deb qabul qilmaydi.

---

## 6. F-2, F-3, nakopitelniy va slichitelniy o‘rtasidagi aniq farq

| Hujjat | Savolga javob beradi | Manba | Tashqi kuchi | Biror narsani o‘zgartiradimi? |
|---|---|---|---|---|
| F-2/ish qabul sertifikati | “Bu davrda qaysi ish, qancha va qaysi narxda qabul qilindi?” | fakt + loyiha + dalil + tasdiqlash | shartnoma blankiga bog‘liq | yo‘q, certified snapshot yaratadi |
| F-3/qiymat ma’lumotnomasi | “Tasdiqlangan ishlar qiymati bo‘yicha davriy ma’lumot nima?” | tasdiqlangan F-2lar | shartnoma/reglamentga bog‘liq | yo‘q; bu tizimda hozir unresolved |
| Nakopitelniy | “Boshlang‘ich limit, oldingi/joriy/jami F-2 va qoldiq qancha?” | tasdiqlangan F-2 + smeta reviziyasi | ichki boshqaruv | yo‘q, read-only proyeksiya |
| Slichitelnaya | “Ikki manba nimada farq qilyapti?” | manba A + manba B + mapping | ichki tekshiruv | yo‘q, faqat farq reestri |
| AOSR | “Keyin berkitiladigan ish ko‘rildi va keyingi ishga ruxsat bormi?” | ko‘rik, chizma, sifat dalili | normativ | F-2 emas; sifat dalili |

---

## 7. Moslashtirishning xavfsiz navbati

1. **Document type registry:** yuqoridagi 18 tur, legal level, template version,
   mandatory/conditional qoidasini registrga kiritish.
2. **A-daraja:** ShNQ 1-, 6-, 7-ilovalarini aynan normativ maydonlari bilan
   professional eksportga aylantirish; ERI va ilovalarni bog‘lash.
3. **F-2 exact law:** mavjud `t2_akt`/`t2_akt_qator`da original certified
   quantity/price/amount va muzlatilgan approval snapshotini eksportga uzish.
4. **Nakopitelniy/slichitelniy:** faqat proyeksiya sifatida; qator mutatsiyasi
   yoki positional matchingsiz.
5. **Ijro paketi:** AOSR, sertifikat, sinov, as-built va jurnalni obyekt/
   chizma/ish qatoriga bog‘laydigan closeout matrix.
6. **F-3 va davlat to‘lovi:** aynan sizning buyurtmachi/tender/shartnoma
   rejimingiz bo‘yicha rasmiy blank hamda formula yuridik/buxgalteriya tomonidan
   tasdiqlangach alohida kontrakt qilib yoqish.
7. **Yakuniy qabul:** VM 200 va obyekt toifasi bo‘yicha davlat xizmatiga
   yuboriladigan haqiqiy rekvizitlarni integratsiya qilish; ichki hujjatni
   davlat ruxsatnomasi deb ko‘rsatmaslik.

---

## 8. Obyekt ochilganda ko‘rinadigan real checklist

```text
[ ] Shartnoma va tasdiqlangan revision
[ ] Kalendar reja / ishlarni bajarish loyihasi (tegishli bo‘lsa)
[ ] Ishlarning umumiy jurnali
[ ] Material sertifikat/pasportlari va kirish nazorati
[ ] Zarur laboratoriya/geodeziya/uskuna sinovlari
[ ] Har yopiq ish uchun AOSR
[ ] Har muhim konstruksiya uchun oraliq qabul dalolatnomasi
[ ] Davriy tasdiqlangan ish qabul sertifikati
[ ] Nakopitelniy: faqat approved F-2
[ ] Slichitelnaya: ochiq farqlar 0 yoki qarori bor
[ ] O‘zgarishlar: tasdiqlangan, izchil, eski qator saqlangan
[ ] Ijro hujjatlari indeksi
[ ] Yakuniy qabul/ruxsat davlat jarayoni
```

`[ ]` belgisi yuridik tasdiq emas — faqat qaysi dalil yetishmayotganini
ko‘rsatadi. Qabul hujjati faqat vakolatli shaxsning haqiqiy imzosi/ERI va
bog‘langan dalillar bilan tasdiqlangan bo‘lsa yashil bo‘ladi.

---

## 9. Ochiq yuridik savollar (implementatsiyadan oldin tasdiqlanadi)

1. Mazkur kompaniyaning har bir buyurtmachisi uchun F-2/F-3ning aynan qaysi
   blank versiyasi, imzo roli va to‘lov asosi talab qilinadi?
2. Davlat mablag‘i/g‘aznachilik obyektlari uchun alohida EHF, resurs yoki
   elektron platforma rekvizitlari qaysilar?
3. Har bir obyekt toifasida qabul/ruxsat jarayoni VM 200 doirasida qanday
   xizmat va ilovalarni talab qiladi?
4. Qaysi maxsus ishlar uchun qo‘shimcha laboratoriya, geodezik, yong‘in,
   elektr yoki ishga tushirish hujjatlari talab qilinadi?

Bu savollar `unknown` deb saqlanadi; “0”, “kerak emas” yoki avtomatik F-3
formula bilan to‘ldirilmaydi.

---

## 10. Drive’dagi haqiqiy blanklardan olingan dalillar

Quyidagi xulosalar nazariy emas — Drive’dagi ishlatilgan hujjatlarni o‘qib
olindi. Ular **kompaniyaning amaliy blanki** sifatida qabul qilinadi; lekin
ular normativ ilovadan ustun emas.

| Drive namuna | Ko‘rilgan tuzilma | TIZIM_02 uchun qaror |
|---|---|---|
| [Amfiteatr F2, 2025-12](https://docs.google.com/spreadsheets/d/1vVdZ6GWv6zTTNIqyz7OBlhv67JSpKV18RAKCG4zq2ZY/edit) | Alohida `ОБЛОЖКА`, `АКТ` va ish/resurs qatorlari bor. Muqovada `АКТ О ПРИЁМКЕ ВЫПОЛНЕННЫХ РАБОТ (Форма № 02)` deb aniq yozilgan; qatorli varaqda ish kodi, nomi, birlik, miqdor, birlik narxi, loyiha bo‘yicha summa va resurs turlari bor. | Bu **Forma-2 paketi**: muqova va qatorli akt bitta `forma2_act`ga tegishli mustaqil ko‘rinishlardir. BL–resurs daraxti saqlanadi. |
| [Stella F2, 2026-07](https://docs.google.com/spreadsheets/d/1Tlr3W96XQHldajm_7SZ3FbKAFz8UDrutA27MjMO9Bvo/edit) | `ф2 Стелла сцена`da qatorli akt va yakunda `Итого по ранее оформленным Формам №2` bor; `СЧЁТ-ФАКТ.` varag‘ida esa `СПРАВКА-СЧЕТ-ФАКТУРА ...`, boshlangandan beri/yil boshidan/joriy oy kesimlari, QQS va imzolar bor. | `forma2_act` va **Forma-3** `forma3_value_invoice` alohida document ID, lekin bir davr va tasdiqlangan qatorlar to‘plamiga bog‘lanadi. Oldingi F-2 jami faqat tasdiqlangan tarixdan olinadi. |
| [Amfiteatr F2, 2026-03](https://docs.google.com/spreadsheets/d/1no5TkAlsBNeX6tthOLrKdYvULj56Qr-J9Zo8LGF_amE/edit) | `Amfiteatr` varag‘i qatorli Forma-2; yonidagi `Лист1 (2)` metall og‘irligi, oraliq hisob va oy/jami/to‘lov-qoldiq hisoblarini olib boradigan **hisoblash varag‘i**. Unda `#REF!` formula uzilishlari ham bor. | `calculation_draft` alohida, tasdiqlanmagan ishchi qatlam. U sertifikatlangan F-2/F-3 haqiqatini almashtira olmaydi; formula xatosi eksportni bloklaydi. |
| [AOSR reestri va blanklari](https://drive.google.com/drive/folders/1ySurglAgbADlj7CmyYEx9WsxVP88cFSh) | `Pechat_Kitobi` fayllarida `Akt_1_455` ... `Akt_40_494` kabi ketma-ket raqamlangan alohida AOSR varaqlari bor. `AKT_SYSTEM_TEMPLATES`da subpudratchili va subpudratchisiz ikki blank; ikkisi ham ShNQ 3.01.01-22, 6-ilovaga tayangan. | AOSR hujjati `aosr_number` bilan alohida reestrda yuradi; variant, obyekt, ish, loyiha, material/sertifikat, chetlanish, muddat, komissiya qarori va keyingi ishga ruxsat kanonik maydon bo‘ladi. |
| [AOSR — Stella blanki](https://docs.google.com/spreadsheets/d/11OQCeeLueSQayDK7a17DgMQvYflfE2NK/edit) | ShNQ 3.01.01-22 6-ilova sarlavhasi, komissiya, ish bayoni, loyiha tashkiloti, material, chetlanish, boshlanish/tugash va keyingi ishga ruxsat. | Bu TPL-02ni real korxona blankiga moslaydi; free-text bayon saqlanadi, ammo sertifikat va chizma alohida kanonik havolasiz qolmaydi. |
| [Nakopitelnaya PDF](https://drive.google.com/file/d/1lrwY7x__VFKVH4nsji4ItR7lx8zOLVNa/view) | Qoldiq ish summalari va PTO izohlari: “qancha qoldi, nima sababdan” kesimida. | Bu klassik davriy nakopitelniydan farqli **qoldiq ishlar/risk reestri**. Uni `remaining_work_register` sifatida alohida ko‘rsatish kerak; F-2 kumulyativi bilan aralashtirilmaydi. |

### Drive blanklarida topilgan beshta muhim qoida

1. **Forma-2 muqovasi real dalil hisoblanadi.** Unda pudratchi, buyurtmachi,
   obyekt, hisobot oyi va “haqiqiy bajarilgan hajmlar, loyiha-smeta hujjati,
   ijro geodezik o‘lchovi hamda jurnal bilan tasdiqlangan” degan asos bor.
   Tizim buni oddiy fayl nomi sifatida emas, qabul hujjati metama’lumoti va
   bog‘langan dalillar sifatida saqlaydi.
2. **Forma-3 qiymat varag‘i alohida biznes hujjati.** Real namunada hujjat raqami,
   tuzilgan sana, davr, tomonlarning rekvizitlari, shartnoma, umumiy qiymat,
   “boshlangandan beri / yil boshidan / joriy oy” ko‘rsatkichlari, QQS va
   tomonlar imzosi bor. Demak F-2 qatorlarini faqat Excelga chiqarish yetmaydi.
3. **Hisoblash chernovigi sertifikat emas.** `Лист1 (2)`dagi metall/oylik/jami/
   to‘lov-qoldiq hisoblari F-2/F-3ni tayyorlashga yordam beradi, lekin u
   `qoralama` holatidan bevosita `tasdiqlangan` moliyaviy haqiqatga o‘ta olmaydi.
   Unga manba F-2/F-3 qatori yoki shartnoma asosining IDsi bog‘lanmagan bo‘lsa,
   natija `needs_review` bo‘ladi.
4. **Blankdagi formula xatosi yashirilmasligi kerak.** Amfiteatrning amaldagi
   hisoblash varag‘ida `#REF!`, qiymat varag‘ida esa avval `#VALUE!` va `#REF!`
   ko‘rinadigan kataklar uchradi. TIZIM_02
   bunday eksportni “tayyor” deb belgilamaydi: `TEMPLATE_FORMULA_ERROR` bilan
   bloklaydi, aniq katak/ustunni ko‘rsatadi va kanonik ma’lumotni o‘zgartirmaydi.
5. **AOSR har biri alohida ijro dalili.** Ketma-ket AOSR raqami bitta fayl ichida
   varaqlar ko‘rinishida bo‘lsa ham, har varaq mustaqil dalolatnoma; uning raqami
   faqat sarlavha emas, reestrdagi noyob biznes kalitidir.
6. **Bir workbook avtomatik bitta davr paketi degani emas.** Ko‘rilgan Stella
   namunasida fayl nomi, F-2 varag‘i va Forma-3 sarlavhasidagi davrlar bir-biriga
   ishonchli identifikator bo‘la olmasligi ko‘rindi. Demak Drive nomi yoki varaq
   nomi asosida F-2/F-3ni avtomatik bog‘lash taqiqlanadi. Bog‘lash uchun kamida
   kanonik obyekt, shartnoma, hisobot davri, tasdiqlash holati va paket IDsi
   talab qilinadi; mos kelmasa `TEMPLATE_HEADER_MISMATCH` chiqadi.

### Drive shablonlarining kanonik xaritasi

```text
Drive F2 muqovasi       → document.profile = forma2_cover_v1
Drive “АКТ” qatorlari   → forma2_act_v1, approved certified lines (stable_line_id bilan)
Drive “СЧЁТ-ФАКТ.”      → forma3_value_invoice_v1 (alohida document ID)
Drive “Лист1 (2)”       → calculation_draft_v1 (sertifikat emas)
Drive AOSR blanki       → aosr_v1 (ShNQ 6-ilova)
Drive “Pechat kitobi”   → aosr_register_v1 (raqamli reestr)
Drive qoldiq PDF        → remaining_work_register_v1 (ichki nazorat)
Drive LRV_PLUS sheets   → secondary projection / import candidate
```

**Hech biri Drive satr raqamiga yoki papka nomiga tayanmaydi.** Drive fayli
faqat `replica_file_id`, revision va hash bilan bog‘lanadi; kanonik obyekt,
smeta qatori, akt va AOSR IDlari Supabase tarafida qoladi.

---

## 11. Hozirgi TIZIM_02 bilan aniq integratsiya yo‘li

### Mavjud kuchli qatlamni saqlash

| Mavjud TIZIM_02 elementi | Drive topilmasi bilan ulanish |
|---|---|
| `t2_qator` va uning ota-bola daraxti | F-2dagi BL/RS/MAT/OB qatorlari uchun barqaror manba; Excel tartibi identifikator bo‘lmaydi. |
| `t2_akt` / `t2_akt_qator` | **Forma-2** `АКТ` qatorli qismning kanonik shakli; tasdiqlangan certified triplet muzlaydi. |
| exact certified quantity/price/amount qonuni | Drive formulasidan mustaqil original qabul summasini saqlaydi; hisoblangan farq faqat analitika. |
| `t2_nakopitelniy_v1` | F-2 kumulyativ proyeksiyasi; Drive’dagi qoldiq/izoh reporti bilan birlashtirilmaydi. Forma-3 uchun u faqat tekshiruv manbasi, hujjatning o‘zi emas. |
| `t2_document_registry` + private R2 | F-2/AOSR/sertifikat/as-builtning binar haqiqati, Drive esa ikkilamchi nusxa. |
| `t2_smeta_ozgarish` | Qo‘shimcha/almashtirishdan oldingi va keyingi scope relationi; eksportda nomga banner qo‘shilmaydi. |

### Kiritilishi kerak bo‘lgan to‘rtta professional qatlam

1. **Template registry.** `forma2_cover_v1`, `forma2_act_v1`,
   `forma3_value_invoice_v1`, `calculation_draft_v1`, `aosr_v1`,
   `aosr_register_v1`, `remaining_work_register_v1` — har biri `template_version`,
   qaysi shartnoma/buyurtmachi uchun yoqilgani va validatsiya qoidasi bilan.
2. **Hujjat paketi.** Bitta `f2_package` ichida `forma2_cover`, qatorli
   `forma2_act`, alohida `forma3_value_invoice`, ixtiyoriy `calculation_draft`
   va dalillar bo‘ladi. Qismlar mustaqil document IDga ega, lekin bitta
   davr/revisionga bog‘langan. Qoralama hech qachon Forma-2 yoki Forma-3
   tasdig‘ining o‘rniga o‘tmaydi.
   `package_id` qatorli Forma-2 va Forma-3ni Drive nomi bilan emas, aynan
   kanonik obyekt + shartnoma + davr + tasdiqlash snapshotiga bog‘laydi.
3. **Evidence chain.** F-2 qatori uchun AOSR, jurnal satri, sertifikat,
   laboratoriya/protokol yoki geodeziya fayli `evidence_link` orqali
   bog‘lanadi. Dalil bo‘lmasa status `needs_review`, lekin tizim dalilni
   o‘ylab topmaydi.
4. **Export validator.** Majburiy rekvizit, `TEMPLATE_FORMULA_ERROR`,
   yo‘qolgan imzo/ERI, eski template version, bog‘lanmagan qator, manfiy miqdor
   `TEMPLATE_HEADER_MISMATCH` hamda Forma-2/3 davrlarining nomuvofiqligini
   tekshiradi. Natija
   `export_blocked` bo‘lsa, faqat ko‘rinadigan xato emas, mashina o‘qiydigan
   sabab kodi ham qaytadi.

### Ketma-ketlik

```text
1. Real Drive blanklarni versionlab registrga kiritish
2. F-2 package read model va export-validator
3. AOSR form + evidence link + approval workflow
4. Remaining-work / slichitelniy ichki reestrlari
5. Drive bilan faqat boshqariladigan replica sync
6. Har buyurtmachi uchun value-invoice/F-3 huquqiy profilini yoqish
```

Bu ketma-ketlik eski ishlaydigan Sheets jarayonini sindirmaydi: Drive/Sheets
bir muddat eksport va boshqariladigan replica bo‘lib qoladi, biroq yangi haqiqiy
qabul, tasdiqlash va versiya biznes-truthi Supabasega yoziladi.
