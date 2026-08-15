# F2 TO'LIQ NAZORAT REJASI

**Sana:** 2026-08-15
**Maqsad (foydalanuvchi so'zi bilan):**
> «man shu paytgacha o'tkazgan f2 171 122 545 454 so'm bo'lsa
> 171 122 545 454 so'm smeta nakopitelnimizda ham to'g'ri va aniq
> kirita olishimiz kerak!»

---

## 0. AVVAL — BUGUNGI TASHXIS (bajarildi, deploy qilindi)

### «F2 oylari 0.00 turibdi» — bu ma'lumot yo'qligi EMAS edi

Panel ko'rsatkichi **har qanday holatda 0 chiqardi**. Uchta xato bir joyda:

| # | Xato | Joy |
|---|------|-----|
| 1 | LRV_PLUS da har oy **uch ustun** (`ОБЪЁМ │ ₊нарх │ ₊сумма`), lekin daraxt quruvchi faqat ikkitasini o'qirdi — **СУММА hech qachon uzatilmasdi** | `30_Panel.js:1059` |
| 2 | `oylar` maydoni faqat `bl` tugunlarga qo'shilardi; panel esa **barglar** bo'yicha yig'adi, barglar esa `rs` | `30_Panel.js:1114` |
| 3 | Frontend `Number(oylar[oy])` qilardi — bu **obyekt**, `Number({...})` = NaN → 0 | `F2Import.tsx:1743` |

**Xulosa:** o'sha 0.00 sentyabr yozilgan-yozilmagani haqida hech narsa demasdi.
1 soatlik ish katta ehtimol joyida turibdi. Endi panel haqiqiy raqamni
ko'rsatadi + **«Yozilgan qatorlar»** ko'rsatkichi qo'shildi.

### Yangi: `38_F2Nazorat.js` — haqiqat manbai

| Funksiya | Nima beradi |
|---|---|
| `apiF2Nazorat(obyekt)` | Har oy: haqiqiy summa (СУММА ustunidan), qator soni, varaqlar kesimi, marker qatlamlari, **ikki baravar sanash ogohlantirishi** |
| `apiF2OyTafsilot(obyekt, oy)` | O'sha oyning **har bir qatori**: manzili (`sub/varaq/row`), qiymatlari, qaysi F2 dan kelgani (`f2uid`), `summa ≠ hajm×narx` nomuvofiqligi |
| `apiF2QatorTahrir(obyekt, oy, ozgarishlar)` | **Nuqtali tahrir** — butun oyni qayta yozmasdan faqat ko'rsatilgan qatorlarni yangilaydi/tozalaydi |

GAS **v300**, 20/20 deploymentga tarqatildi.

---

## 1. ILDIZ MUAMMO: tizimda REESTR yo'q

Hozir F2 import oy ustunlariga yozadi va **tarqab ketadi**. Hech qayerda
yozilmagan:

- qaysi F2 hujjati kiritildi
- qachon, kim tomonidan
- **hujjatning o'z jami qancha edi** (masalan `8 277 622 548.30602`)
- **smetaga qancha tushdi**
- **farq bormi**

`f2uid` izohi — har qatordagi mayda iz, lekin **sarlavha yozuvi yo'q**.
Shuning uchun «171 mlrd kiritdim, 171 mlrd tushdimi?» degan savolga
tizim javob **bera olmaydi** — solishtirish uchun ikkinchi tomon yo'q.

> **Bu butun muammoning kaliti.** Qolgan hamma narsa shundan kelib chiqadi.

---

## 2. YECHIM ARXITEKTURASI: F2 REESTR

`_SERVER_DASHBOARD` ichida yangi varaq — **`F2_REESTR`**. Har kiritilgan F2
uchun **bitta qator**:

| Ustun | Ma'no |
|---|---|
| `F2_ID` | Yagona identifikator (uid ildizi) |
| `OBYEKT` / `OY` | Manzil |
| `FAYL_NOM` / `FAYL_ID` | Qaysi hujjat (Drive) |
| `SANA` / `KIM` | Qachon, kim |
| **`HUJJAT_JAMI`** | F2 ning **o'zidagi** jami (primoy zatrat) |
| **`YOZILGAN_JAMI`** | LRV_PLUS ga haqiqatda tushgan jami |
| **`FARQ`** | `HUJJAT_JAMI − YOZILGAN_JAMI` |
| `QATOR_JAMI` / `QATOR_YOZILDI` | Nechta qator bor edi / nechtasi tushdi |
| `HOLAT` | `TO'LIQ` / `QISMAN` / `XATO` |
| `VARAQLAR` | Qaysi smetalarga tarqaldi |

### Nima uchun bu hamma narsani hal qiladi

```
Σ HUJJAT_JAMI   =  171 122 545 454   ← siz kiritgan
Σ YOZILGAN_JAMI =  171 122 545 454   ← smetada turgan
                   ─────────────────
FARQ            =  0                 ← KAFOLAT
```

Bu ikki raqam **doim ekranda**. Farq paydo bo'lsa — qaysi F2 dan, qaysi
varaqda, qaysi qatorda ekani bir bosishda ochiladi. Taxmin qilish tugaydi.

---

## 3. FAZALAR

### FAZA 1 — HAQIQATNI KO'RSATISH ✅ *(bugun bajarildi)*
- [x] `oylar` da СУММА uzatilishi (GAS)
- [x] `rs` tugunlarga oylar kesimi
- [x] Frontend to'g'ri o'qishi + «Yozilgan qatorlar»
- [x] `38_F2Nazorat.js` — nazorat/tafsilot/tahrir API lari

### FAZA 2 — REESTR (poydevor) ✅ *(bajarildi)*
- [x] `F2_REESTR` varag'i + `39_F2Reestr.js`
- [x] Yozuvchi (`37_F2TezYoz.js`) yozib tugagach **reestrga qator qo'shsin**
- [x] `apiF2ReestrOl(obyekt?)` — ro'yxat + jami/farq
- [x] **Retro-to'ldirish**: mavjud oylarni `apiF2Nazorat` bilan skanlab
      reestrga kiritish (`HUJJAT_JAMI` bo'sh — qo'lda kiritiladi yoki
      arxiv fayldan o'qiladi)

### FAZA 3 — JARAYON OYNASI ✅ *(asosan bajarildi — F2YozishOyna.tsx)*
- [x] Yozish bosilganda modal ochiladi (ishlamoqda / tugadi / xato)
- [x] **Yakuniy hisobot**: yozilgan qatorlar, smetalar kesimi, summa, FARQ
- [x] Xato ham oynada qoladi (toast o'tib ketadi)
- [ ] ⚠ **Qadam-baqadam jonli progress QILINMADI.** Yozish GAS tarafida
      BITTA chaqiruvda bajariladi — oraliq qadamlar brauzerga kelmaydi.
      Soxta animatsiya ko'rsatmadim. Haqiqiy progress uchun yozuvchini
      navbat (trigger) rejimiga o'tkazish kerak — alohida ish.
- [ ] «Hisobotni saqlash» tugmasi — hozir hisobot faqat ekranda

### FAZA 4 — QATOR DARAJASIDA BOSHQARUV ✅ *(bajarildi — F2OyTahrir.tsx)*
- [x] Oy → «Tahrirlash» → **qatorlar jadvali** (`apiF2OyTafsilot`)
- [x] Har qatorda: smeta tomoni ↔ F2 tomoni yonma-yon
- [x] Amallar: **qiymatni o'zgartirish · qatorni tozalash** (bekor qilinadi)
- [x] **Boshqa qatorga ko'chirish** — eski qator tozalanadi + yangisiga
      yoziladi, ikkalasi BIR chaqiruvda (oraliq holatda yo'qolmaydi)
- [x] Saqlash → `apiF2QatorTahrir` → LRV_PLUS **darhol** yangilanadi
- [x] Nomuvofiq qatorlar (`summa ≠ hajm×narx`) belgilanadi + filtri bor

### FAZA 5 — RANGLAR ✅ *(bajarildi — umumiy/turRang.ts)*

`F2Tayyorlash.tsx:18` da allaqachon bor — uni **umumiy modulga**
chiqaramiz va hamma joyda ishlatamiz:

| Tur | Rang | Izoh |
|---|---|---|
| `rz` | **indigo** `text-indigo-400` | Razdel — sarlavha, qalin |
| `bl` | **binafsha** `text-purple-400` | Blok / ish |
| `rs` | **ko'k** `text-blue-400` | Resurs |
| `mat` | **sariq** `text-yellow-400` | Material |
| `ob` | **moviy** `text-cyan-400` | Uskuna |
| `~` zamena | rose ramka | Almashtirilgan |
| `+` qo'shimcha | emerald ramka | Qo'shimcha ish |

Chap tomonda rangli chiziq + turi qisqartma bilan. `F2Daraxt.tsx` da `rz`
YETISHMAYOTGAN edi (razdel rangsiz va belgisiz chiqardi) — qo'shildi.

### FAZA 6 — KAFOLAT PANELI ✅ *(bajarildi — F2Kafolat.tsx)*
- [x] Yuqorida doimiy: `Hujjatlarda Σ` · `Smetaga tushgan Σ` · `FARQ`
- [x] Farq ≠ 0 bo'lsa sariq + ishonchsizlik ogohlantirishi
- [x] «🔍 Sababni ko'rsat» tugmasi → F2Kafolat oynasi
- [x] Har F2 alohida qatorda: oy/fayl · hujjatda · smetada · farq · holat
- [x] «Hujjatda» ustuni TAHRIRLANADI — eski yozuvlarga jami kiritiladi
- [x] «Barcha obyektlar» rejimi — aynan 171 mlrd tekshiruvi
- [x] Har qatordan «Qatorlar» → o'sha oy qator-baqator ochiladi

---

## 4. SAVOLLAR — JAVOB OLINDI (2026-08-15)

**1. `HUJJAT_JAMI` qayerdan? → KATAKDAN EMAS, HISOBLANADI.**
> «uni rs mat ob qatorlarini chel-chas, mash-chas, resurs, oborudovaniya
> kabi yonda ajratiladigan ustunlaridan yig'ilishi kerak»

Ya'ni `ПРЯМЫЕ ЗАТРАТЫ` = `rs`/`mat`/`ob` qatorlari bo'yicha kategoriya
ustunlari yig'indisi: **ЧЕЛ + МАШ + МАТ + ОБ + М/К + КАБ**.
Bitta «Всего» katagi qidirilmaydi — qatorlab yig'iladi.

**2. ~~bl mi rs mi?~~ ✅ KODDA HAL QILINDI** — `apiF2QatlamTahlil` o'zi aniqlaydi.

**3. 171 122 545 454 — MISOL uchun yozilgan raqam.**
> «man bu summani shunchaki misol tariqasida yozganman»

Aniq qamrov belgilanmagan. Kafolat oynasi ikkala rejimda ham ishlaydi
(bitta obyekt / «Barcha obyektlar» belgisi) — qo'shimcha sozlash kerak emas.

**4. Eski oylar → ARXIV FAYLLARDAN AVTOMAT O'QILSIN.**
Drive dagi eski F2 fayllari topilib, 1-javobdagi qoida bo'yicha
`ПРЯМЫЕ ЗАТРАТЫ` hisoblanadi va reestrga tushadi.

**5. Ustuvorlik: TO'RTALASI HAM kerak** — jonli progress · F2 ni bekor
qilish (undo) · quruq yurish · oyni muhrlash.

---

## 5. MENING TAKLIFLARIM *(«kreativlik kerak»)*

**A. «Quruq yurish» (dry-run) majburiy qadam.**
Yozishdan oldin: *«412 qator yoziladi, jami 8 277 622 548 so'm.
Hujjat jami 8 277 622 548 — farq 0 ✓»*. Farq bo'lsa yozishga
ruxsat bermaydi. Xato yozib qo'yib keyin qidirishdan yaxshi.

**B. Har yozuvga «bekor qilish» (undo).**
Reestrdagi har qatorda «Bu F2 ni butunlay bekor qil» — `f2uid` bo'yicha
aynan o'sha yozuvlar tozalanadi, boshqasiga tegmaydi. Hozir «Tozalash»
butun oyni o'chiradi — bu juda qo'pol.

**C. Yozuvni «muhrlash» (lock).**
Tekshirilgan va topshirilgan oyni muhrlash — tasodifan qayta yozilmaydi.
Muhrni ochish alohida amal.

**D. Farqni avtomatik kuzatish.**
Kunlik trigger `apiF2Nazorat` ni yuritib, farq paydo bo'lsa Telegramga
xabar. Siz bilmay qolmaysiz.

---

## 6. QOLGAN ISHLAR (aniq spetsifikatsiya bilan)

✅ **Quruq yurish** — BAJARILDI. Yozishdan oldin sinov + raqamlar + tasdiq.

### 1. F2 ni butunlay bekor qilish (undo)
 —  izohi bo'yicha AYNAN o'sha
yozuvlarni tozalaydi, boshqasiga tegmaydi. Hozirgi «Tozalash» butun oyni
o'chiradi — bir oyga ikki F2 tushgan bo'lsa ikkalasi ham yo'qoladi.
Manba:  allaqachon har qatorning  ini qaytaradi.

### 2. Oyni muhrlash (lock)
 ga  ustuni. Muhrlangan oyga  va
 yozishdan BOSH TORTADI. Ochish alohida amal + jurnal.

### 3. Jonli progress
Yozuvchini navbat (trigger) rejimiga o'tkazish kerak — hozir GAS da
BITTA chaqiruv, oraliq qadam brauzerga kelmaydi.  naqshi bor.
Eng katta ish; ehtiyot bo'ling — yozuvchi hozir tez va to'g'ri ishlayapti.

### 4. Arxiv fayllardan hujjat jamini avtomat o'qish
Foydalanuvchi tanlovi.  oy bo'yicha faylni topadi;
jami esa 4-bo'limdagi qoida bilan hisoblanadi (rs/mat/ob qatorlarining
ЧЕЛ/МАШ/МАТ/ОБ/М-К/КАБ ustunlari).  shuni chaqirsin.

**Eslatma:** har o'zgarishdan keyin  stendida sinang.
