# TASK 10 — BENCHMARK VA PROFILLASH

**Sana:** 2026-08-21
**Usul:** `t2_benchmark(obyekt_id, lokalka_manba, svodka_manba)` — takrorlanadigan
o'lchov funksiyasi. Har bosqich `clock_timestamp()` bilan alohida vaqtlanadi.

Reja 14-bo'limi: «Performance targetlar **tajribadan** belgilanadi.
0.05–0.1 sek kafolat berilmaydi». 17-bo'lim: «**O'lchamasdan performance
claim qilmaslik**». Quyidagilar — o'lchangan raqamlar.

---

## 1. Natijalar

| Bosqich | 1.4k | 10.5k | 52.7k | 52.7k ulush |
|---|---:|---:|---:|---:|
| markirovka | 1 341 | 6 758 | **33 162** | 66 % |
| narxlash | 520 | 2 340 | **15 222** | 30 % |
| rollup | 81 | 169 | 1 229 | 2 % |
| narx bazasi | 217 | 371 | 587 | 1 % |
| **JAMI (yozish)** | **2.2 s** | **9.6 s** | **50.2 s** | |
| o'qish — daraxt | 2 | 14 | 154 | |
| o'qish — nakopitelniy | 2 | 7 | 43 | |

52.7k to'plami sun'iy: Amfiteatr xom qatorlari 5 marta ko'paytirilgan.
O'lchovdan keyin o'chirilgan.

## 2. Masshtablanish

| O'tish | Ma'lumot | Vaqt |
|---|---|---|
| 1.4k → 10.5k | 7.3× | 4.5× |
| 10.5k → 52.7k | 5.0× | 5.2× |

Ya'ni **chiziqli** (biroz yaxshiroq). Kvadratik o'sish yo'q — set-based
SQL o'z ishini qilyapti.

## 3. Asosiy xulosa

**50 000 qatorli smeta Postgres'da ~50 soniyada ishlanadi.**

GAS ning 6 daqiqalik chegarasi bu yerda emas — u **import** tomonida
(varaqni o'qish), va u allaqachon bo'laklarga bo'lingan.

O'qish yo'llari juda tez: 52.7k qatorli obyekt daraxti 154 ms,
nakopitelniy 43 ms. Frontend uchun bu muammo emas.

---

## 4. Optimallashtirish urinishi — NATIJA BERMADI

Profillashda `t2_tasnif` **ikki joyda** chaqirilishi topildi:
jadval qurishda va `soxta_razdel_tashlandi` diagnostik hisoblagichi
uchun alohida to'liq so'rovda. Ya'ni 52 725 qator bo'yicha ikkinchi
to'liq o'tish.

Ikki urinish qilindi:

| Variant | markirovka (52.7k) |
|---|---:|
| Asl (ikki o'tish) | 33 162 |
| `_tas` da tur='' saqlash | 38 588 / 39 106 |
| Bitta o'tish + `delete from _tas` | 34 272 / 38 791 |

**Xulosa: yaxshilanish o'lchanmadi.** Birinchi variant hatto
sekinlashtirdi — `_tas` kattalashib, keyingi 5 ta so'rov ko'proq
qator kechdi.

⚠️ **O'lchov tarqoqligi ~15 % (34–39 s)** — men quvayotgan effektdan
katta. Ya'ni bu usul bilan bunday hajmdagi farqni ajratib bo'lmaydi.

Kod hozirgi holatda (bitta o'tish + `delete`) qoldirildi: u
prinsipial jihatdan kamroq ish qiladi, natija esa ikkala real
obyektda bir xil tekshirildi. Lekin **«tezlashtirdim» deb aytilmaydi** —
o'lchov buni ko'rsatmadi.

## 5. To'g'ri keyingi qadam

Taxmin bilan optimallashtirishni to'xtatish kerak. Haqiqiy profillash
uchun `EXPLAIN (ANALYZE, BUFFERS)` bilan markirovkaning ICHKI
so'rovlarini alohida o'lchash lozim — qaysi biri 33 soniyani yeyayotgani
hozir **noma'lum**.

Va bundan oldin savol berilishi kerak: 50 soniya muammomi? Import
allaqachon bo'lakli va foydalanuvchi jarayonni ko'rib turadi. Agar
muammo bo'lmasa, bu optimallashtirish umuman kerak emas.

---

## 6. Natijaning to'g'riligi

Har o'zgarishdan keyin ikkala real obyekt tekshirildi:

| Obyekt | Jami | Holat |
|---|---:|---|
| Fast food 1этаж | 744 054 071.73 | o'zgarmadi |
| Amfiteatr | 43 596 859 620.62 | o'zgarmadi |
| Amfiteatr ОБ | 269 qator | o'zgarmadi |
