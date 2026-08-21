# FAZA 6 — F2 / FAKT / NAKOPITELNIY YADROSI

**Sana:** 2026-08-21
**Reja bo'yicha:** PHASE 6 poydevori + TASK 04 (idempotentlik)

---

## Nega aynan hozir

`t2_akt` va `t2_akt_qator` **bo'sh** edi. Idempotentlikni keyin qo'shish
degani — allaqachon yozilgan moliyaviy hujjatlarni tozalash degani.
Hozir esa bitta migratsiya.

---

## Avvaldan bor edi (o'qish tomoni)

| Narsa | Holat |
|---|---|
| `t2_akt`, `t2_akt_qator` | ✅ `qator_id` → `t2_qator.id` (o'zgarmas ID) |
| `t2_qator_holat` | ✅ nakopitelniy LATERAL bilan, set-based |
| `t2_akt_tekshir` | ✅ invariant hisoboti |
| `summa` ustuni | ✅ **generated**: `narx IS NULL → summa NULL` |

Ya'ni «narx o'zidan to'qilmaydi» qoidasi **bazaning o'zida** qulflangan —
uni qo'lda yozishga urinish xato beradi.

**Yetishmagani:** yozish yo'li. Hujjat yaratadigan RPC yo'q edi.

---

## Qo'shildi

### 1. Idempotentlik

```sql
alter table t2_akt add column operation_id uuid;
create unique index t2_akt_operation_uniq on t2_akt(operation_id)
  where operation_id is not null;
```

Tarmoq uzilib qayta yuborilsa yoki tugma ikki marta bosilsa —
**ikkinchi hujjat yaratilmaydi**, mavjudi qaytariladi.

Busiz nakopitelniy ikkalasini qo'shib, hujjat jami ikki baravar
chiqardi va hech qayerda ogohlantirish bo'lmasdi.

### 2. `t2_akt_yarat(...)` — yagona eshik

Reja 6-bo'limi: «har biri alohida domain RPC bo'lsin», «har moliyaviy
mutation transaction bo'lsin». PL/pgSQL funksiyasi butunlay bitta
tranzaksiyada — xato bo'lsa hech narsa yozilmaydi.

```
t2_akt_yarat(obyekt_id, tur, oy, qatorlar,
             raqam, operation_id, manba, kim, majburiy)
```

---

## Sinov natijalari (haqiqiy ma'lumot)

| # | Holat | Kutilgan | Natija |
|---|---|---|---|
| 1 | To'g'ri fakt | yaraladi | ✅ 2 qator, 85 217.40 |
| 2 | Bir xil `operation_id` | takror yaralmaydi | ✅ `takror:true`, o'sha akt |
| 3 | Fakt > smeta (9999 / 22.17) | bloklanadi | ✅ qaysi qator ko'rsatildi |
| 4 | F2 > fakt (500 / 10) | bloklanadi | ✅ chegara faktdan olindi |
| 5 | **Manfiy hajm** (ПЕРЕРАСЧЁТ −4) | **o'tadi** | ✅ yaraldi, −18 000 |
| 6 | Narxsiz qator | jami BO'SH | ✅ `jami:null`, «JAMI TO'LIQ EMAS» |

3-sinovda F2 chegarasi **10** bo'ldi — ya'ni bir sinov oldin yaratilgan
faktdan keldi. Nakopitelniy zanjiri ishlayotganining tasdig'i.

Sinov ma'lumoti tozalandi (`t2_akt` = 0 qator).

---

## Uchta qat'iy qoida — kodda mustahkamlangan

1. **Narx o'zidan to'qilmaydi.** Narx yo'q → `summa` NULL. 0 yozish
   «bepul» degani va soxta hujjat bo'lardi.
2. **Manfiy hajm bloklanmaydi.** ПЕРЕРАСЧЁТ haqiqiy hujjat. Tekshiruv
   `> 0` emas, YIG'INDI chegarasi bo'yicha.
3. **Invariant f2 ≤ fakt ≤ smeta** — yig'indi bo'yicha, bitta hujjat
   bo'yicha emas. Buzilsa yozilmaydi va qaysi qator buzgani aytiladi.
   `p_majburiy` bilan ataylab o'tkazish mumkin, lekin o'shanda ham
   buzilish ro'yxati javobda qaytadi — **jim o'tmaydi**.

---

## Yo'lda topilgan uchta xato

1. `holat` cheklovi `qoralama|tasdiqlangan|bekor` ekan, men `ochiq`
   yozgandim
2. `summa` generated ustun — unga qo'lda yozib bo'lmaydi
3. `on commit drop` vaqtinchalik jadval bitta tranzaksiyada ikkinchi
   chaqiruvda qolib ketardi → `drop table if exists` qo'shildi

---

## Bilib turish kerak

`t2_qator_holat` `holat <> 'bekor'` bo'yicha yig'adi, ya'ni
**QORALAMA ham nakopitelniyga kiradi**. Qoralama yaratilishi bilan
qoldiq kamayadi. Bu tizimning mavjud qarori — o'zgartirmadim, lekin
`t2_akt_tasdiqlash` yozilganda qayta ko'rib chiqilishi kerak.

---

---

# HAYOTIY SIKL (ikkinchi qadam)

```
qoralama ──tasdiqlash──▶ tasdiqlangan
    │                          │
    └────────bekor─────────────┘
```

## `t2_akt_tasdiqlash(akt_id, kutilgan_versiya, kim, operation_id)`

Reja 6-bo'limi «validate → **lock/recheck** → write» deydi. «Recheck»
shu yerda hal qiluvchi: qoralama yaratilgandan keyin tasdiqlashgacha
boshqa hujjatlar qoldiqni yeb qo'ygan yoki **smeta o'zgargan** bo'lishi
mumkin. Faqat yaratishda tekshirish yetarli emas.

- Qator `for update` bilan **qulflanadi** — parallel tasdiqlash ikki
  marta o'tmaydi
- Versiya mos kelmasa — ziddiyat, yozilmaydi
- Allaqachon tasdiqlangan bo'lsa — `takror:true`, xato emas
  (idempotent)

## `t2_akt_bekor(akt_id, sabab, kutilgan_versiya, kim)`

⚠️ Hujjat **O'CHIRILMAYDI**, faqat `bekor` deb belgilanadi. Moliyaviy
hujjatni yo'q qilish tarixni yo'qotadi. Nakopitelniy `holat <> 'bekor'`
bo'yicha yig'gani uchun natija bir xil, tarix esa saqlanadi.

## Tasdiqlangan hujjat — o'zgarmas

`t2_akt_qator_qulf` trigeri tasdiqlangan hujjat qatorlariga
INSERT/UPDATE/DELETE ni to'sadi. Busiz tasdiqdan keyin summa
jimgina o'zgarib ketishi mumkin edi.

## Sinov natijalari (2-qism)

| # | Holat | Natija |
|---|---|---|
| 7 | Tasdiqlash | ✅ `tasdiqlangan`, 85 217.40 |
| 8 | Takror tasdiqlash | ✅ `takror:true`, xato emas |
| 9 | Tasdiqlangan qatorni o'zgartirish | ✅ **to'sildi**, qiymat o'zgarmadi |
| 10 | Qoralama → smeta 22.17 dan 15 ga tushdi → tasdiqlash | ✅ **to'sildi**: «jami 22, chegara 15» |
| 11 | Bekor qilish | ✅ nakopitelniy 22 → 10, qatorlar saqlandi, sabab yozildi |

10-sinov eng muhimi: hujjat yaratilganda **haqiqiy** edi, keyin
sharoit o'zgardi va tasdiqlash uni ushladi.

## Tozalash haqida

Sinovda `t2_qator.summa` ni qo'lda tiklash **unutilgan edi** — hajm
tiklandi, summa esa eski qiymatda (67 500) qolib ketdi. Sezilib
tuzatildi: `summa` `t2_qator` da generated EMAS (faqat `t2_akt_qator`
da generated), shuning uchun hajmni to'g'ridan-to'g'ri UPDATE qilish
summani yangilamaydi.

**Xulosa:** `t2_qator` ga to'g'ridan-to'g'ri UPDATE qilmaslik kerak —
`t2_qator_tahrir` RPC ishlatilsin, u summani qayta hisoblaydi.

---

---

# QAYTA IMPORT MOLIYAVIY HUJJATNI YO'Q QILARDI

**Topilgan:** 2026-08-21, TASK 10 (benchmark) tayyorgarligida.

## Zanjir

```
t2_akt_qator.qator_id → t2_qator(id)  ON DELETE CASCADE
t2_markirovka         → delete from t2_qator where manba_id = …
```

Ya'ni hujjatni **qayta import qilish** o'sha qatorlarga bog'langan
barcha Fakt/F2 qatorlarini o'chirib yuborardi.

## Sinovda tasdiqlandi

Fast food uchun qoralama fakt yaratildi (2 125), keyin qayta import:

| | Import oldidan | Import keyin |
|---|---|---|
| Hujjat | mavjud | **mavjud** |
| `hujjat_jami` | 2 125 | **2 125** |
| Qatorlari | 1 | **0** |

Hujjat pulni ko'rsatib turibdi, uni tasdiqlaydigan qatorlar yo'q.
**Hech qanday xato chiqmadi.** Reestrda «hujjatda 2 125, bazada 0» —
sharpa hujjat.

Tasdiqlangan hujjat `t2_akt_qator_qulf` trigeri tufayli tasodifan
himoyalangan edi (u boshqa maqsadda yozilgan), lekin **qoralama
himoyasiz** edi.

## Yechim

`t2_markirovka_himoya()` — markirovka `delete` dan OLDIN tekshiradi:
tirik hujjat (`holat <> 'bekor'`) bog'liq bo'lsa **yozmaydi** va
qaysi hujjatlar to'sayotganini nomi bilan aytadi:

```
Qayta import to'xtatildi: bu hujjatning qatorlariga 1 ta Fakt/F2
hujjati bog'langan (HIMOYA-SINOV (fakt, 2026-09, qoralama)).
… Avval o'sha hujjatlarni bekor qiling.
```

Qayta import qilish uchun odam avval hujjatni bekor qilishi kerak —
bu **ataylab** qilinadigan ish, tasodifan emas.

Tekshirildi: bekor qilingandan keyin import muammosiz o'tadi.

## Yo'l-yo'lakay tasdiqlangan narsa

Zanjir **xom ma'lumotdan to'liq qayta tiklanadi**: markirovka →
narxlash → rollup dan keyin Fast food yana **744 054 071.73** berdi —
avvalgi qiymatning aynan o'zi. Reja 5.6 bandi («narx yoki tasnif
qoidasi o'zgarsa raw layerdan qayta hisoblash mumkin, Drive'ga qayta
o'qish shart emas») amalda ishlaydi.

---

## Keyingi bitta ish

TASK 10 — benchmark 1k / 5k / 20k / 50k.
