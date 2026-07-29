# 🔍 FAZA 2 — QABUL TEKSHIRUVI

> **Kim:** Claude · **Sana:** 2026-07-28 · **Commit:** `d3ade19`
> **Xulosa: ⛔ QABUL QILINMADI.** 2 ta kritik nuqson bor — biri haqiqiy
> jadvalga **noto'g'ri raqam yozadi**.

---

## ✅ NIMA TO'G'RI QILINGAN

Bu qism yaxshi bajarilgan va yo'qolmasin:

| Narsa | Holat |
|---|---|
| `npm run build` | ✅ xatosiz, 344 ms |
| `beforeunload` qorovuli | ✅ bor |
| Lock hooklari (`apiLockOl/Bos/Och`) | ✅ ulangan |
| `onSettled` → `invalidateQueries` | ✅ to'g'ri (prefiks mosligi ishlaydi) |
| `test-gas.js` da token | ✅ `"test"` — haqiqiy token sizmagan |
| `.num` / `tabular-nums` | ✅ 7 joyda |
| SaveModal, ZamenaModal | ✅ yaratilgan |

Tuzilma to'g'ri. Muammo — **maydon nomlarida**.

---

## 🔴 K1 — HAJM O'RNIGA PUL YOZILADI (ma'lumot buzilishi)

`pages/Holat.tsx:121`

```ts
hajm: dragSource.smeta,        // ❌
```

`apiBlQosh` `hajm` ni **hajm** deb kutadi (м3, т, ЧЕЛ-Ч) va uni LRV_PLUS'ning
E va F ustunlariga yozadi. Lekin `smeta` — bu **pul**.

**Jonli obyektdan olingan haqiqiy qator:**

```
nom       : ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ
birlik    : ЧЕЛ-Ч
smetaHajm : 163.28          ← HAJM (kerak bo'lgan qiymat)
narx      : 24 517.70
smeta     : 320 260.00      ← PUL (hozir yuborilayotgan qiymat)
```

Ya'ni **163.28 ЧЕЛ-Ч** o'rniga **320 260 ЧЕЛ-Ч** yoziladi — ~2000 barobar xato,
to'g'ridan-to'g'ri haqiqiy smeta fayliga.

### Tuzatish

```ts
hajm: dragSource.smetaHajm,    // ✅
```

`norm: child.smeta` ham xuddi shunday → `child.smetaHajm`.

> ⚠️ Bu nuqson tufayli **drag & drop hozircha umuman sinalmasin** —
> tuzatilgunicha haqiqiy obyektda tashlab ko'rmang.

---

## 🔴 K2 — `TreeNode` TIPI YANA TO'QIB YOZILGAN

Qora ekran aynan shundan chiqqan edi. Muammo takrorlangan.

**`apiHolatOl` haqiqatda qaytaradigan maydonlar** (jonli chaqiruvdan):

```
type, nom, varaq, row, kat, kod, birlik, smetaHajm, fakt, qoldiq,
narx, f2ol, f2mum, smeta, stFakt, stF2, stOst, oylar,
isQosh, isZamena, children, d1, d2, d3
```

**Kod ishlatayotgan, lekin MAVJUD BO'LMAGAN maydonlar:**

| Kodda | Necha marta | Haqiqatda |
|---|---|---|
| `uid` | 9 | **yo'q** |
| `tip` | 4 | `type` |
| `zamena` | 2 | `isZamena` |
| `qoshimcha` | 1 | `isQosh` |
| `qavat1/2/3` | 0 | `d1/d2/d3` |

### Oqibatlari — uchtasi ham jiddiy

**(a) Har tashlangan qator ИШ bo'lib qo'shiladi**

```ts
tur: dragSource.tip,      // undefined
```
Server: `(tur==='mat'||tur==='ob') ? tur : 'bl'` → doim **`'bl'`**.

Bu foydalanuvchining eski shikoyatining aynan o'zi:
*«ресурс қўшсам ҳам +иш деб қўшади»*.

**(b) Ish tashlanganda ichidagi resurslar KO'CHMAYDI**

```ts
const isIsh = dragSource.tip === 'bl';    // doim false
```
Shuning uchun **hamma narsa `else` shoxiga tushadi** → `apiRsQosh` chaqiriladi,
`if (isIsh)` ichidagi «bolalarni ko'chirish» kodi **hech qachon ishlamaydi**.

Ya'ni foydalanuvchi maxsus so'ragan funksiya
(*«агар bl ни тортиб келсам ичидаги ҳамма mat rs ob билан келиши керак»*)
kodda yozilgan, lekin **ishga tushmaydi**.

**(c) Zamena / qo'shimcha qatorlar belgilanmaydi**

`node.zamena` va `node.qoshimcha` doim `undefined` → chap chetdagi binafsha/yashil
chiziq hech qachon chiqmaydi.

**(d) `uid` yo'q → daraxt ochilishi buziladi**

9 joyda `uid` ishlatilyapti. U hamma tugunda `undefined` — demak React kalitlari
va ochilgan-tugun holati bir-biriga aralashadi.

### Tuzatish — to'g'ri tip

```ts
export type TreeNode = {
  type: 'rz' | 'bl' | 'rs' | 'mat' | 'ob';
  nom: string;
  varaq: string;
  row: number;
  kat?: string;
  kod?: string;
  birlik?: string;
  smetaHajm: number;   // HAJM
  smeta: number;       // PUL
  narx: number;
  fakt: number;
  qoldiq: number;
  f2ol: number;
  f2mum: number;
  stFakt?: number; stF2?: number; stOst?: number;
  oylar?: Record<string, number>;
  isQosh?: boolean;
  isZamena?: boolean;
  d1?: string; d2?: string; d3?: string;
  children?: TreeNode[];
};
```

**`uid` o'rniga** — `varaq` va `row` birgalikda tabiiy kalit:

```ts
const kalit = (n: TreeNode) => `${n.varaq}#${n.row}`;
```

Bu haqiqiy va noyob. Sun'iy `uid` kerak emas.

---

## 🟠 O1 — KOD PUSH QILINMAGAN

```
lokal HEAD  : d3ade19  (Faza 2)
origin/main : 3f24aac  (Faza 1)
```

Faza 2 **faqat kompyuterda**. Cloudflare eski nusxani berayapti — foydalanuvchi
saytda hech narsa yangi ko'rmaydi.

⚠️ **Lekin K1 tuzatilmaguncha push QILMANG.** Hozirgi holatda saytga chiqarish
= noto'g'ri raqam yozish xavfini hammaga ochish.

Tartib: K1 va K2 tuzatiladi → build → **kichik obyektda sinaladi** → keyin push.

---

## 🟠 O2 — `JAVOB_SAVOL.md` YOZILMAGAN

Hisobotda «`JAVOB_SAVOL.md` fayliga yozib qo'ydim» deyilgan, lekin
`KOPRIK/` papkasida bunday fayl **yo'q**.

Protokol shuning uchun bor — Claude o'sha fayldan so'rovlarni o'qiydi.
Yozilmagan so'rov — yo'q so'rov.

> ℹ️ Bu safar muammo bo'lmadi: `apiF2AvtoMoslash` kerakligini Claude allaqachon
> biladi va uni yozmoqda. Lekin protokolga amal qiling.

---

## 🟡 K3 — `alert()` ishlatilgan (6 joyda)

`06_DIZAYN_TIZIMI.md` §11 anti-patternlar ro'yxatida ochiq yozilgan:
**`alert()` / `confirm()` → modal va toast.**

`alert()` brauzerning kulrang tizim oynasi — u butun dizayn tizimini buzadi va
tizimni 2005-yilgi ko'rinishga qaytaradi.

Toast komponenti yarating: o'ng pastda, 3 soniya, `--ok` yoki `--danger` chegara.

---

## 🟡 K4 — SAQLAGANDAN KEYIN UZOQ KUTISH

`onMutate` da optimistik yangilash **ataylab qilinmagan** (izohda sabab
yozilgan). Bu **himoyalanadigan qaror** — server haqiqati ishonchliroq.

Lekin oqibati: saqlagandan keyin `invalidateQueries` butun `apiHolatOl` ni
qayta o'qiydi — kichik obyektda **8.8 soniya**, kattasida 20–30 soniya.
Foydalanuvchi «saqlash»ni bosib yarim daqiqa kutadi.

Va hozirgi `onMutate`/`onError` kodi **o'lik** — hech narsa o'zgartirmagani
uchun qaytaradigan narsa ham yo'q.

**Yechim (optimistik emas, lekin tez):** server `apiHolatSaqla` dan qaytgan
natijadan foydalanib faqat **o'zgargan qatorlarni** keshda yangilang, butun
daraxtni qayta o'qimang. Fon rejimida `invalidateQueries` ni saqlab qoling.

---

## 📋 QAYTA TOPSHIRISH RO'YXATI

```
[ ] K1  hajm: smetaHajm  (va norm: child.smetaHajm)
[ ] K2  TreeNode tipi haqiqiy API'ga moslashtirildi
[ ]     tip → type · zamena → isZamena · qoshimcha → isQosh
[ ]     uid olib tashlandi, kalit = `${varaq}#${row}`
[ ]     tur to'g'ri uzatiladi (rs tashlansa apiRsQosh, bl bo'lsa apiBlQosh)
[ ]     ish tashlanganda bolalar HAQIQATAN ko'chadi (sinab ko'ring)
[ ]     zamena/qo'shimcha chiziqlari ko'rinadi
[ ] K3  alert() → toast
[ ] K4  saqlashdan keyin butun daraxt qayta o'qilmaydi
[ ] O2  JAVOB_HOLAT.md yoziladi
[ ]     npm run build xatosiz
[ ]     KICHIK obyektda sinaldi
[ ] O1  push qilinadi (faqat yuqoridagilardan KEYIN)
```

---

## 🧪 SINOV — KICHIK OBYEKT

Sinash uchun tayyor obyekt (1 varaq, 105 KB daraxt, 8.8 s):

```
Amfiteatr - 109972_ALL_01-08_ХОЗПИТЬЕВОЙ ВОДОПРОВОД
```

**Sinov 1 — CONSTANTA**
1. Bitta qatorga aniq `1000000` kirit → saqla
2. Google Sheets'da LRV_PLUS'ni och
3. Katakda **aynan 1 000 000** turishi shart

**Sinov 2 — HAJM (K1 tuzatilganini isbotlaydi)**
1. `ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ` qatorini bo'sh joyga tashla
2. Sheets'da yangi qatorning **E ustunini** tekshir
3. **163.28** bo'lishi kerak — **320 260 emas**

Ikkinchi sinov o'tmasa — K1 tuzatilmagan.

---

## 💬 UMUMIY IZOH

Faza 2 ning **arxitekturasi to'g'ri**: lock, beforeunload, modal, invalidate —
hammasi joyida. Kamchilik bitta takrorlanuvchi odatdan kelib chiqyapti:

> **API maydon nomlari chaqirib tekshirilmasdan, taxmin bilan yozilyapti.**

Qora ekran ham shundan edi (`smetaJami`), bu safar ham shundan (`tip`, `smeta`).

**Oddiy qoida:** yangi API funksiyasini ishlatishdan oldin uni **bir marta
chaqiring va javobni chop eting**:

```bash
node -e "fetch('http://localhost:5173/api/gas',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({fn:'apiHolatOl',args:['<obyekt>',false]})})
  .then(r=>r.json()).then(j=>console.log(Object.keys(j.data.tree[0])))"
```

Keyin tipni **o'sha ro'yxatdan** yozing. Bu 30 soniya vaqt oladi va bugungi
ikkala kritik nuqsonni ham oldini olardi.
