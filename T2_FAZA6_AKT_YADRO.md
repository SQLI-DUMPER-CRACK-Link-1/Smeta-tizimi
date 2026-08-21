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

## Keyingi bitta ish

`t2_akt_tasdiqlash` va `t2_akt_bekor` — hujjat hayotiy sikli.
Undan keyin panelda F2/Fakt oynasi.
