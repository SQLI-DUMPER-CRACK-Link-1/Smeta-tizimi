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

### FAZA 3 — JARAYON OYNASI ✅ *(bajarildi — F2YozishOyna.tsx)*
- [x] Yozish bosilganda modal ochilsin, real vaqtda qadamlar:
      `Varaq 1/4 · АРХИТЕКТУРНАЯ · 412 qator o'qildi · yozildi ✓`
- [x] Oxirida **yakuniy hisobot**: yozildi / o'tkazib yuborildi / xato,
      har biri ro'yxat bilan
- [x] «Yopish» emas — «**Hisobotni saqlash**» (reestrga bog'lanadi)

### FAZA 4 — QATOR DARAJASIDA BOSHQARUV ✅ *(bajarildi — F2OyTahrir.tsx)*
- [x] Oy → «Tahrirlash» → **qatorlar jadvali** (`apiF2OyTafsilot`)
- [x] Har qatorda: smeta tomoni ↔ F2 tomoni yonma-yon
- [x] Amallar: **qiymatni o'zgartirish · bog'lanishni uzish · boshqa
      qatorga ko'chirish · o'chirish**
- [x] Saqlash → `apiF2QatorTahrir` → LRV_PLUS **darhol** yangilanadi
- [x] Nomuvofiq qatorlar (`summa ≠ hajm×narx`) qizil bilan tepada

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

Chap tomonda 3px rangli chiziq + turi qisqartma bilan — ko'z bir qarashda
ajratadi.

### FAZA 6 — KAFOLAT PANELI ✅ *(asosiy blok bajarildi)*
- [x] Yuqorida doimiy: `Kiritilgan Σ` · `Yozilgan Σ` · `FARQ`
- [x] Farq ≠ 0 bo'lsa qizil + «Sababni ko'rsat» tugmasi
- [x] Ro'yxat: qaysi F2, qancha farq, qaysi varaq

---

## 4. SIZDAN SO'RAYDIGAN SAVOLLARIM

Bularga javob bersangiz reja aniqlashadi:

**1. `HUJJAT_JAMI` ni qayerdan olay?**
Siz `8 277 622 548,30602` raqamini F2 ning o'zidan o'qidingiz. Bu
F2 faylida **qat'iy bir katakda** turadimi (masalan «Всего прямых затрат»
qatori), yoki har hujjatda har xil joydami? Agar qat'iy bo'lsa —
avtomatik o'qiyman.

**2. `bl` va `rs` — qaysi biri asos?**
F2 ni bog'laganda **ish qatoriga** (bl) yozasizmi, yoki uning ostidagi
**resurslarga** (rs) ham? Ikkalasiga ham yozilsa jamlashda ikki baravar
chiqadi. `apiF2Nazorat` buni endi ogohlantiradi, lekin qaysi biri
«haqiqiy» ekanini siz aytishingiz kerak.

**3. 171 mlrd — bitta obyektmi yoki hammasi?**
Ekрandagi panel bitta obyekt uchun (44.39 mlrd smeta). 171 mlrd —
barcha obyektlar yig'indisimi? Kafolat panelini shunga qarab quraman.

**4. Eski oylar uchun retro-reestr kerakmi?**
Mart 2026, Iyul-2025, Sentyabr-2025, Dekabr-2025 — bularning hujjat
jamilarini bilasizmi? Bilsangiz kiritamiz va o'tmish ham nazoratga
tushadi.

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

## 6. KEYINGI QADAM

Sizdan javob kelguncha men **FAZA 2 (reestr)** ni boshlayman — u qolgan
hamma narsaning poydevori va savollaringizga javobsiz ham qurilaveradi.
