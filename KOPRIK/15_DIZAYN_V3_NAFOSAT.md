# 💎 DIZAYN V3 — NAFOSAT QATLAMI

> **Claude · 2026-07-28**
> `06` — poydevor (rang, shrift, oraliq). `12` — hissiyot (3D, motion).
> Bu hujjat — **hunarmandlik**: qimmat tizimni oddiysidan ajratadigan
> 1% detallar. Ular alohida sezilmaydi, birgalikda hammasini o'zgartiradi.

---

## 1. ⚠️ YOZUV TIZIMI — hozirgi eng ko'zga tashlanadigan nuqson

Tizimda uch xil yozuv aralashib ketgan:

```
Обyектлар     ← О,б,е,к,т,л,а,р kirill + y LOTIN  ❌ ARALASH
Obyektlar     ← toza lotin
ОБЪЕКТЫ       ← rus tili
```

`Обyектлар` — bu **buzuq so'z**. Ko'z uni darhol sezmaydi, lekin miya
«nimadir noto'g'ri» deb baholaydi. Bu — havaskorlikning eng tinch belgisi.

### Qat'iy qoida

| Nima | Yozuv | Misol |
|---|---|---|
| **Interfeys matni** (tugma, sarlavha, izoh) | **O'zbek lotin** | `Obyektlar`, `Saqlash`, `Qoldiq` |
| **Ma'lumot** (smeta ichidagi nomlar) | **manbadagidek** — o'zgartirilmaydi | `БЕТОН М300`, `ЦЕМЕНТ М400` |
| **Hujjat sarlavhalari** (Ф2, КС-2) | **rus** — rasmiy shakl | `АКТ О ПРИЁМКЕ` |

**Bitta matn ichida ikki yozuv aralashmaydi.** Agar ma'lumot kirill bo'lsa —
u ma'lumot, atrofidagi yorliq lotin bo'ladi:

```
✅  Obyekt:  АМФИТЕАТР            ← yorliq lotin, qiymat manbadagidek
❌  Обyект:  АМФИТЕАТР            ← buzuq so'z
```

### Tekshirish

```bash
# Aralash yozuvli so'zlarni topadi (kirill va lotin bir so'zda)
grep -rnoP '\b(?=\w*[А-Яа-яЁё])(?=\w*[A-Za-z])\w+' frontend/src --include=*.tsx
```

Bu buyruq **bo'sh natija** berishi kerak.

---

## 2. OPTIK TEKISLASH — matematik emas, ko'z bilan

Matematik markaz va ko'rinadigan markaz **bir xil emas**.

| Holat | Muammo | Tuzatish |
|---|---|---|
| Ikonka tugma ichida | «▶» o'ngga og'gan ko'rinadi | `translateX(1px)` |
| Yumaloq ikonka kvadrat yonida | kichikroq ko'rinadi | 4–8% kattaroq |
| Matn karta ichida | pastga bosgan ko'rinadi | pastki `padding` 1–2px kam |
| Katta raqam ostidagi yorliq | uzoq ko'rinadi | `margin-top` 2px kam |

**Amaliy qoida:** ikonka + matn yonma-yon bo'lsa, ikonka **optik markazga**
tekislanadi, satr balandligiga emas:

```css
.tugma-ikonka { display: grid; place-items: center; line-height: 0; }
```

---

## 3. YORUG'LIK MODELI — bitta manba, hamma joyda

Chuqurlik ishonarli bo'lishi uchun **yorug'lik bir tomondan** kelishi kerak.
Qoida: **yuqoridan** (12 soat yo'nalishi).

Demak:

```css
/* Ko'tarilgan yuza — yuqori chekkasi yorug'roq */
.karta {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.04),      /* yuqori nur chizig'i */
    0 1px 2px rgba(0,0,0,.3);                 /* pastki soya */
}

/* Botiq yuza (input) — teskari */
.input {
  box-shadow:
    inset 0 1px 2px rgba(0,0,0,.35),          /* yuqoridan soya */
    inset 0 -1px 0 rgba(255,255,255,.03);
}
```

`inset 0 1px 0 rgba(255,255,255,.04)` — bir piksellik oq chiziq. Deyarli
ko'rinmaydi, lekin usiz karta «yopishtirilgan qog'oz», u bilan «material».

**Barcha kartalar bir xil yorug'lik modelida.** Biri yuqoridan, boshqasi
pastdan yoritilsa — ko'z chalkashadi.

---

## 4. YUKLANISH XOREOGRAFIYASI — tartib muhim

Elementlar tasodifiy emas, **ma'no tartibida** paydo bo'ladi:

```
1. Karkas (sidebar, topbar)        0 ms      ← darhol, animatsiyasiz
2. Sahifa sarlavhasi              60 ms
3. KPI kartalar                  120 ms      (60ms stagger)
4. Asosiy jadval/daraxt          280 ms
5. Ikkilamchi (grafik, panel)    400 ms
```

**Sabab:** ko'z avval tuzilmani, keyin mazmunni oladi. Hammasi bir vaqtda
chiqsa — «portlash» effekti, o'qish qiyin.

### Skeletondan tarkibga o'tish

```css
/* Keskin almashish TAQIQLANADI */
.tarkib-kirdi { animation: yumshoq 240ms var(--ease); }
@keyframes yumshoq {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}
```

Skeleton **o'sha o'lchamda** bo'lsin — aks holda tarkib kelganda sahifa
sakraydi (layout shift). Bu eng bezovta qiluvchi hodisa.

---

## 5. MIKRO-O'ZARO TA'SIRLAR KATALOGI

Har biri kichik, birgalikda tizimni «tirik» qiladi.

| Element | Harakat | Vaqt | Tafsilot |
|---|---|---|---|
| Tugma hover | fon +6% yorug' | 120ms | |
| Tugma bosish | `scale(.97)` | 80ms | `transform-origin: center` |
| Tugma qo'yib yuborish | `scale(1)` | 160ms | biroz uzunroq — «yumshoq» |
| Jadval qatori hover | fon + chap chekka 2px accent | 120ms | |
| Daraxt tugun ochilishi | balandlik + `▸` 90° burilish | 180ms | birga, alohida emas |
| Input fokus | halqa 0→3px | 140ms | |
| Checkbox belgilash | belgi chiziladi (`stroke-dashoffset`) | 220ms | |
| Toast kirishi | o'ngdan 24px + fade | 260ms | |
| Toast chiqishi | fade + `scale(.96)` | 160ms | tezroq — e'tibor tortmasin |
| Modal ochilishi | `scale(.97)→1` + fon blur | 200ms | |
| Raqam o'zgarishi | eski yuqoriga, yangi pastdan | 300ms | faqat KPI'da |
| Nusxa olindi | ikonka ✓ ga o'tadi, 1.2s | 200ms | matn o'zgarmaydi |

### Kursor holatlari — unutilmaydi

```css
button, [role=button], .qator-bosiladigan { cursor: pointer; }
.sudraladigan   { cursor: grab; }
.sudralmoqda    { cursor: grabbing; }
.tahrirlanadi   { cursor: text; }
[disabled]      { cursor: not-allowed; }
.yuklanmoqda    { cursor: progress; }
```

Kursorning noto'g'ri bo'lishi — sezilmaydigan, lekin doimiy bezovtalik.

---

## 6. RAQAMLAR — chuqurroq

`06` da `tabular-nums` majburiy qilingan. Bu minimum. Qo'shimchalar:

### 6.1 Uch xonali guruhlar — ko'zga yordam

`467348726061` → `467 348 726 061`. Ajratgich — **tor bo'shliq** (`U+202F`),
oddiy probel emas: qatorni sindirmaydi va tor ko'rinadi.

### 6.2 Kasr qismi susroq

```tsx
<span className="num">
  1 240 500<span className="text-[--text-mute]">,00</span>
</span>
```

Butun qism muhim, kasr — ikkilamchi. Bu skanerlashni tezlashtiradi.

### 6.3 Nol va bo'sh farqlanadi

```
0        → "0"          (haqiqiy nol — ma'lumot bor)
null     → "—"          (ma'lumot yo'q)
```

Ular bir xil ko'rsatilsa — buxgalter noto'g'ri xulosa chiqaradi.

### 6.4 Manfiy son

Minus emas, **rang + qavs** (buxgalteriya an'anasi):

```
(1 240 500)   --danger rangda
```

### 6.5 Ustunda o'ng chekka bir xil

Raqam ustunida `padding-right` **hamma qatorda bir xil**. Ba'zi qatorda
valyuta belgisi bo'lsa — u alohida ustunchada, raqam ichida emas.

---

## 7. IKONKA TIZIMI

```
Kutubxona:  lucide-react (allaqachon o'rnatilgan)
Qalinlik:   1.5px  — HAMMA joyda bir xil
O'lcham:    14 (zich jadval) · 16 (odatiy) · 20 (sarlavha) · 24 (bo'sh holat)
Rang:       matn rangini meros oladi (currentColor)
```

### Qat'iy qoidalar

1. **Bitta ma'no — bitta ikonka.** «Saqlash» hamma joyda bir xil ikonka
2. Ikonka **yolg'iz turmaydi** (matn yoki `aria-label` bilan)
3. Emoji va chiziqli ikonka **aralashmaydi** bir qatorda —
   ⚠️ hozir `🔧 ИШ` (emoji) va `<Folder/>` (chiziqli) yonma-yon ishlatilyapti
4. Yechim: tur nishonlari uchun **emoji qoladi** (ular ma'lumot turini
   bildiradi, rangli bo'lishi kerak), interfeys uchun **lucide** —
   lekin ular **bir konteynerda uchrashmaydi**

---

## 8. ZICHLIK REJIMLARI

Buxgalter zich, rahbar keng ko'rishni xohlaydi. Bir sozlama:

```
Кўриниш:  [ Зич ]  [ Ўртача ]  [ Кенг ]
```

```css
:root[data-zichlik="zich"]    { --qator-h: 28px; --katak-p: 8px;  --shrift: 12px; }
:root[data-zichlik="ortacha"] { --qator-h: 32px; --katak-p: 12px; --shrift: 13px; }
:root[data-zichlik="keng"]    { --qator-h: 40px; --katak-p: 16px; --shrift: 14px; }
```

`localStorage` da saqlanadi. Admin sukut bo'yicha **zich**, Rahbar **keng**.

---

## 9. BIRINCHI KIRISH TAJRIBASI

Yangi foydalanuvchi birinchi marta kirganda bo'sh ekran ko'rmasin:

```
   👋  Хуш келибсиз, Анвар

   Тизимда 66 та объект, 467.3 млрд сўмлик смета бор.

   Нимадан бошлаймиз?

   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
   │ 📊 Умумий      │  │ 📁 Объектлар   │  │ 🧾 Ф2 импорт   │
   │    ҳолат       │  │    рўйхати     │  │    қилиш       │
   └────────────────┘  └────────────────┘  └────────────────┘
```

Bir marta ko'rsatiladi (`localStorage`), keyin oddiy dashboard ochiladi.

---

## 10. FOKUS VA KLAVIATURA — birinchi darajali

Tez ishlaydigan odam sichqonchani tashlaydi. Klaviatura **to'liq** ishlasin.

```css
/* Fokus faqat klaviaturada ko'rinadi, sichqonchada emas */
:focus { outline: none; }
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}
```

### Fokus tartibi

- `Tab` — mantiqiy ketma-ketlik (chapdan o'ngga, yuqoridan pastga)
- Modal ochilsa — fokus ichkariga **qamaladi** (focus trap)
- Modal yopilsa — fokus **chaqirgan tugmaga qaytadi**
- Jadvalda `↑↓` qator, `←→` daraxt tuguni
- `Home`/`End` — birinchi/oxirgi qator

### «Skip to content»

Sahifa boshida ko'rinmas havola — `Tab` bosilsa paydo bo'ladi:

```tsx
<a href="#asosiy" className="skip-link">Асосий мазмунга ўтиш</a>
```

---

## 11. MATNLAR — terminologiya lug'ati

Bir tushuncha — **bitta so'z**, hamma joyda. Aralashtirish tizimni
tartibsiz ko'rsatadi.

| Tushuncha | To'g'ri | Ishlatilmaydi |
|---|---|---|
| Смета hajmi | **Smeta** | reja, loyiha, budjet |
| Bajarilgan | **Fakt** | bajarilgan, amalga oshirilgan |
| Ф2 ga olingan | **F2 olingan** | akt qilingan, topshirilgan |
| Qolgan | **Qoldiq** | qolgan, balans |
| Ish turi | **Ish** | pozitsiya, band, qator |
| Yangi qo'shilgan | **Qo'shimcha** | dop, qo'shilgan |
| Almashtirilgan | **Zamena** | almashtirish, o'zgartirish |

### Xabar ohangi

- Xato: **nima bo'ldi + nima qilish kerak**, ayb qo'ymasdan
  - ✅ `Ma'lumot yuklanmadi. Internetni tekshiring va qayta urining.`
  - ❌ `Xato! Noto'g'ri so'rov.`
- Tasdiq: **qisqa va aniq** — `14 ta qator saqlandi`
- Hech qachon texnik atama foydalanuvchiga: `500 Internal Server Error` ❌

---

## 12. «1% DETALLAR»

Alohida hech kim sezmaydi. Birgalikda — «qimmat» hissi.

```css
/* Tanlash rangi — brendga mos */
::selection { background: rgba(79,123,255,.28); color: #fff; }

/* Skroll — nozik, dark uchun */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--surface-3);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background: var(--border-2); background-clip: content-box; }

/* Rasm sudralmasin */
img { user-select: none; -webkit-user-drag: none; }

/* Raqamlar tasodifan tanlanmasin, lekin nusxa olish mumkin bo'lsin */
.num { -webkit-user-select: all; user-select: all; }

/* Uzun so'z konteynerni buzmasin */
.nom { overflow-wrap: anywhere; }

/* Matn silliqligi */
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
```

### Sarlavha (title) — har sahifada mazmunli

```
Amfiteatr — Smeta holati · SMETA GAS
F2 import · SMETA GAS
```

Foydalanuvchida 12 ta yorliq ochiq bo'lishi mumkin. `SMETA GAS` yolg'iz
turgan yorliqni topib bo'lmaydi.

### Favicon va brend

Oddiy, o'qiladigan belgi. Yorliqda 16px'da tanib olinsin.

---

## 13. NIMA QILMASLIK KERAK — kengaytirilgan

`06` §11 dagi ro'yxatga qo'shiladi:

| ❌ | Nega |
|---|---|
| Aralash yozuv (`Обyект`) | buzuq so'z, havaskorlik belgisi |
| Turli yorug'lik yo'nalishi | chuqurlik yolg'on ko'rinadi |
| Skeleton o'lchami tarkibdan farq qiladi | sahifa sakraydi |
| Bir ma'noga ikki xil ikonka | ishonch yo'qoladi |
| Emoji va chiziqli ikonka bir konteynerda | uslub buziladi |
| Barcha element bir vaqtda paydo bo'ladi | «portlash», o'qib bo'lmaydi |
| `cursor: default` bosiladigan elementda | bosiladiganini bilmaydi |
| Sarlavha faqat `SMETA GAS` | yorliqni topib bo'lmaydi |
| Manfiy son oddiy minus bilan | buxgalteriya an'anasiga zid |
| `0` va bo'sh bir xil ko'rsatiladi | noto'g'ri xulosa |

---

## 14. YAKUNIY TEKSHIRUV — har PR oldidan

```
[ ] Aralash yozuvli so'z yo'q (§1 grep buyrug'i bo'sh)
[ ] Barcha karta bir xil yorug'lik modelida
[ ] Skeleton va tarkib o'lchami bir xil (layout shift yo'q)
[ ] Yuklanish tartibi: karkas → sarlavha → KPI → jadval
[ ] Har bosiladigan elementda to'g'ri kursor
[ ] Ikonka qalinligi hamma joyda 1.5px
[ ] Raqamlarda tor bo'shliq ajratgich, kasr susroq
[ ] 0 va — farqlanadi
[ ] :focus-visible ko'rinadi, :focus ko'rinmaydi
[ ] Modal fokusni qamaydi va qaytaradi
[ ] Sahifa sarlavhasi mazmunli
[ ] Terminologiya lug'atiga mos (§11)
[ ] Skrollbar, ::selection uslublangan
```

---

## 15. XULOSA

Bu hujjatdagi hech bir band yolg'iz sezilmaydi. Lekin:

> **Professionallik — bu bitta ajoyib narsa emas.
> Bu 200 ta mayda narsaning hech biri noto'g'ri emasligi.**

Foydalanuvchi «nima uchun bu chiroyli?» deb tushuntira olmaydi.
U shunchaki **ishonadi**. Maqsad — shu.
