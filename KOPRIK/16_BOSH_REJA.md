# 🗺️ BOSH REJA — sayt panelga to'liq tenglashguncha

> **Claude · 2026-07-29**
> Bu hujjat 02 / 07 / 08 / 09 dagi **tartibni almashtiradi**. Ular ichidagi
> texnik tafsilotlar kuchda qoladi.
>
> Sabab: foydalanuvchi aytdi — *«ҳали панелдаги функциялар йўқ. дизайн ҳам
> фақат бош панелда ўзгарган, қолган жойларда ўзгариш йўқку»*. **Ikkalasi ham
> to'g'ri.** Quyida aniq inventarizatsiya va shundan kelib chiqqan reja.

---

## A. HOZIRGI HOLAT — inventarizatsiya

### A.1 Panelda bor (11 bo'lim + 17 modal)

| # | Bo'lim | Saytda | Holat |
|---|---|---|---|
| 1 | **Ҳолат ва Ф2** | qisman | daraxt bor, F2 yo'q |
| 2 | **Объектлар** (skan) | qisman | ro'yxat bor, boshqaruv yo'q |
| 3 | **Нархлар** | ⬜ yo'q | |
| 4 | **Иерархия** | ⬜ yo'q | Д1-Д3 tasnifi |
| 5 | **Шартнома** | ⬜ yo'q | |
| 6 | **Шахсий смета** | ⬜ yo'q | |
| 7 | **Ҳужжатлар** | ⬜ yo'q | |
| 8 | **Мониторинг** | ⬜ yo'q | |
| 9 | **Созлама** | ⬜ yo'q | |
| 10 | **Supabase** | ⬜ yo'q | ichki, ko'chirilmaydi |
| 11 | **Файл боғлаш** | ⬜ yo'q | |

**Modallar:** `f2Imp` `f2Tay` `huj` `it` `nk` `ns` `obBog` `or` `qi` `rs`
`sh` `st` `sv` `tolov` `varaq` `xarajat` `zamena` — saytda **birortasi yo'q**.

### A.2 Saytda bor

```
admin/  Obyektlar · Holat
boss/   Umumiy · Obyektlar3D
```

**Xulosa: sayt panelning ~15% iga teng.** Bu Faza 1+2 uchun kutilgan, lekin
buni ochiq aytish kerak edi.

---

## B. NIMA UCHUN DIZAYN FAQAT BOSH PANELDA O'ZGARGAN

Bu **rejalashtirish xatosi**, Antigravity'ning aybi emas.

Men fazalarni shunday tuzdim:

```
Faza 2B → Rahbar paneli (3D, motion, jonli fon)     ← dizayn SHU YERDA
Faza 5  → «Dizayn sayqali»                          ← qolgani OXIRIDA
```

Ya'ni dizaynni **alohida oxirgi faza** qilib qo'ydim. Natijada bugun tizim
yarmi 2026-yilgi, yarmi Faza-1 ko'rinishida.

Bu mening o'z hujjatimga zid. `06_DIZAYN_TIZIMI.md` da yozganman:

> «Professional ko'rinish = 200 ta mayda qarorning **bir xilligi**»

Lekin reja aynan **bir xil emaslikni** ishlab chiqardi.

### Tuzatish — dizayn faza emas, TUGALLANGANLIK MEZONI

Bundan keyin **har ekran** V2/V3 dizayn bilan **tug'iladi**. «Keyin
chiroyli qilamiz» degan bosqich **yo'q**.

Har ekran uchun majburiy (`06` + `12` + `15`):

```
[ ] Rang, shrift, oraliq — 06 bo'yicha
[ ] Har pul/hajm katagida .num
[ ] Yuklanmoqda / bo'sh / xato holatlari
[ ] Sahifa o'tishi + ro'yxat stagger (12 §4)
[ ] Yorug'lik modeli, kursorlar, fokus (15 §3, §5, §10)
[ ] Aralash yozuv yo'q (15 §1)
[ ] Mobil 375px da gorizontal skroll yo'q
```

Bu ro'yxat bajarilmasa — **ekran tugallanmagan** hisoblanadi.

### Va birinchi ish — mavjud 2 ta admin ekranini tuzatish

`admin/Obyektlar` va `admin/Holat` Faza-1 uslubida qolgan. Ular
**2A-RETRO** da (quyida) V3 ga keltiriladi — yangi ekran qo'shishdan **oldin**.

---

## C. EKRAN-BA-EKRAN REJA

### 🔧 BLOK 0 — POYDEVOR (2 sessiya)

Bular barcha ekranlarga ta'sir qiladi, shuning uchun birinchi.

| Ish | Manba | Sessiya |
|---|---|---|
| **Idempotentlik** (`f2Uid` har insert'da) | `14 §1` | 0.5 |
| API shartnoma testi (vitest) | `14 §10.2` | 0.5 |
| Kuzatuv: mijoz xatolari → GAS | `14 §9` | 0.25 |
| **2A-RETRO:** Obyektlar + Holat → V3 dizayn | `B` bo'limi | 0.75 |

> ⚠️ Idempotentliksiz drag & drop ishlab chiqarishga chiqmaydi — ikki marta
> bosish ikkita qator yaratadi (`14 §1` da isbotlangan).

---

### 🏗 BLOK 1 — ASOSIY ISH OQIMI (5 sessiya)

Kunlik ishning 80% shu uchtasida.

| Ekran | Panel manbai | API | Sessiya |
|---|---|---|---|
| **Ҳолат — tahrir rejimi** | `pane-holat` | `apiHolatSaqla`, `apiBlQosh`, `apiRsQosh` | 1.5 |
| **Ф2 Импорт** | `f2ImpModal` | `apiF2FaylOqi`, **`apiF2AvtoMoslash`** ✅, `apiF2QollaNavbatga` | 2 |
| **Ф2 Тайёрлаш** | `f2TayModal` | `apiF2TayyorHujjatYarat` | 1 |
| Zamena / Qo'shimcha modallari | `zamenaModal`, `rsModal` | | 0.5 |

`apiF2AvtoMoslash` **tayyor** (`35_F2Moslash.js`, 18/18 test) — Faza 3 bloki yo'q.

---

### 💰 BLOK 2 — MOLIYA (3 sessiya)

| Ekran | Panel manbai | API | Sessiya |
|---|---|---|---|
| **Шартнома** | `pane-shart`, `shModal`, `tolovModal` | `apiShartnoma*` | 1 |
| **Бухгалтерия** | `xarajatModal` | `85_Buxgalteriya.js` | 0.75 |
| **Склад** | — | `apiSkladOl` | 0.5 |
| **Накрутка** ko'rinishi | `nkModal` | `apiShartnomaDashboard` | 0.75 |

⚠️ Накрутка **saytda qayta hisoblanmaydi** — GAS bergani ko'rsatiladi.

---

### 📐 BLOK 3 — SMETA BOSHQARUVI (3 sessiya)

| Ekran | Panel manbai | Sessiya |
|---|---|---|
| **Нархлар** (markaziy narx bazasi) | `pane-narx`, `stModal` | 1 |
| **Иерархия** (Д1-Д3 tasnifi, РАЗДЕЛЛАР reestri) | `pane-ier` | 1 |
| **Объектлар boshqaruvi** (skan, ishla, lok, oraliq) | `pane-skan`, `orModal`, `svModal` | 1 |

---

### 📄 BLOK 4 — HUJJAT VA QO'SHIMCHA (2 sessiya)

| Ekran | Panel manbai | Sessiya |
|---|---|---|
| **Ҳужжатлар** (M-29 va b.) | `pane-huj`, `hujModal` | 0.75 |
| **Шахсий смета** | `pane-shsm` | 0.5 |
| **Файл боғлаш** | `pane-puz`, `obBogModal`, `varaqModal` | 0.5 |
| **Иш турлари кутубхонаси** | `itModal` | 0.25 |

---

### 📊 BLOK 5 — RAHBAR TOMONI (1.5 sessiya)

| Ekran | Sessiya |
|---|---|
| Умумий ✅ tayyor | — |
| Обyектлар 3D ✅ tayyor | — |
| **Молиявий оқим** (shartnoma, to'lov, debitor) | 0.75 |
| **Ҳисоботлар** (davr bo'yicha, eksport) | 0.75 |

---

### ⚙️ BLOK 6 — TIZIM (2 sessiya)

| Ish | Manba | Sessiya |
|---|---|---|
| **Мониторинг** (API log, sekin chaqiruvlar, job holati) | `pane-mon` | 0.5 |
| **Созлама** (foydalanuvchilar, kalitlar, rollar) | `pane-soz` | 0.5 |
| **Buyruq navbati** (offline, IndexedDB) | `14 §2` | 0.5 |
| **Undo** (orqaga qaytarish) | `14 §5` | 0.5 |

---

### ✨ BLOK 7 — KUCHAYTIRISH (2 sessiya)

| Ish | Manba | Sessiya |
|---|---|---|
| **⌘K buyruq paneli** (52 516 qator ichidan qidiruv) | `14 §7` | 0.75 |
| **AI yordamchi** (GAS'da tayyor, saytda ishlatilmayapti) | `14 §8` | 0.75 |
| **Presence** (qulf o'rniga) | `14 §4` | 0.5 |

---

### 📱 BLOK 8 — YAKUNIY (1.5 sessiya)

| Ish | Sessiya |
|---|---|
| Mobil (barcha ekran) | 0.5 |
| Yorug' rejim (tekshirilgan ranglar bilan) | 0.5 |
| Klaviatura + a11y auditi | 0.25 |
| Degradatsiya darajalari (`14 §6`) | 0.25 |

---

## D. ATAYLAB KO'CHIRILMAYDIGANLAR

Hamma narsani ko'chirish shart emas:

| Nima | Nega |
|---|---|
| **Supabase** yorlig'i | Ichki texnik vosita. Faza 6 da qayta ko'riladi |
| `99_Debug`, `99_Diagnostika` | Ishlab chiquvchi uchun, GAS'da qoladi |
| Telegram bot sozlamalari | GAS'da ishlaydi, UI kerak emas |
| `98_SelfTest` | GAS menyusidan ishga tushadi |

---

## E. UMUMIY HISOB

```
BLOK 0  Poydevor + retro dizayn        2.0
BLOK 1  Asosiy ish oqimi (Holat, Ф2)   5.0
BLOK 2  Moliya                         3.0
BLOK 3  Smeta boshqaruvi               3.0
BLOK 4  Hujjatlar                      2.0
BLOK 5  Rahbar tomoni                  1.5
BLOK 6  Tizim                          2.0
BLOK 7  Kuchaytirish                   2.0
BLOK 8  Yakuniy                        1.5
─────────────────────────────────────────
JAMI                                  22 sessiya
```

Kuniga bittadan — **~4 hafta**. Ilgari 14–16 deb aytgandim; endi ekran-ba-ekran
sanaganda **22** chiqdi. Oldingi baho past edi, chunki panelning 11 bo'limi va
17 modali to'liq hisobga olinmagan.

### Bosqichli maqsadlar

| Qachon | Nima ishlaydi |
|---|---|
| **BLOK 0-1 tugagach** (7 sessiya) | Kunlik ishning 80% saytda: holat tahriri + Ф2 |
| **BLOK 2-3 tugagach** (13 sessiya) | Moliya va smeta boshqaruvi — panel deyarli kerak emas |
| **BLOK 4-6 tugagach** (18 sessiya) | Panelga **teng** |
| **BLOK 7-8 tugagach** (22 sessiya) | Paneldan **kuchli** |

---

## F. HAR EKRAN UCHUN TUGALLANGANLIK MEZONI

Yangi ekran «tayyor» deyilishi uchun **hammasi** bajarilishi shart:

```
FUNKSIYA
[ ] Panel'dagi mos bo'limning barcha amallari ishlaydi
[ ] API maydonlari CHAQIRIB tekshirilgan (taxmin YO'Q)
[ ] Yozuvchi amallar idempotent (uid bilan)
[ ] Rahbar rolida yozish serverda bloklanadi

DIZAYN (06 + 12 + 15)
[ ] Rang/shrift/oraliq — 06 bo'yicha
[ ] Har pul/hajm katagida .num
[ ] Yuklanmoqda (skeleton) / bo'sh / xato holatlari
[ ] Sahifa o'tishi + ro'yxat stagger
[ ] Yorug'lik modeli, kursor, fokus
[ ] Aralash yozuv yo'q (grep bo'sh)
[ ] 375px da gorizontal skroll yo'q

SIFAT
[ ] npm run build xatosiz
[ ] Kichik obyektda sinaldi
[ ] JAVOB_HOLAT.md yozildi
[ ] PUSH qilindi va Cloudflare Success
```

---

## G. KEYINGI QADAM

**BLOK 0 dan boshlanadi** — poydevor va mavjud ikki admin ekranining
dizayn retrofiti. Yangi ekran qo'shishdan oldin bor narsani to'g'rilaymiz,
aks holda nomuvofiqlik ortib boraveradi.

Antigravity'ga: `16_BOSH_REJA.md` → BLOK 0.
