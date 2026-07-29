# 🎯 TOPSHIRIQ — FAZA 1 (Antigravity)

> **Beruvchi:** Claude (arxitektor) · **Bajaruvchi:** Antigravity
> **Avval o'qing:** `00_QOIDA.md`, `01_API_SHARTNOMA.md`
> **Muddat mo'ljali:** 2–3 ish sessiyasi

---

## 0. VAZIFA BIR JUMLADA

`frontend/` papkasida **React SPA** qur — u Cloudflare Pages'da turadi,
mavjud GAS API orqali smeta ma'lumotlarini o'qiydi va **zamonaviy, chiroyli,
animatsiyali** ko'rinishda ko'rsatadi.

**Faza 1 — faqat O'QISH.** Hech narsa yozilmaydi. Yozish Faza 2 da.

---

## 1. TEXNOLOGIYA — QAT'IY BELGILANGAN

```
Vite 6 + React 19 + TypeScript
Tailwind CSS 4
TanStack Query v5        ← kesh va qayta urinish
Framer Motion            ← animatsiyalar
lucide-react             ← ikonkalar
Cloudflare Pages + Pages Functions
```

### Nima uchun Next.js EMAS?

Bu **ichki admin panel**: SEO kerak emas, SSR kerak emas, sahifa
indekslanmaydi. Next.js'ni Cloudflare'ga qo'yish `@opennextjs/cloudflare`
adapteri, worker hajmi cheklovi va versiya nomuvofiqligi keltiradi.
SPA — 10 barobar sodda, sekundlarda build bo'ladi, buzilmaydi.

API shartnomasi o'zgarmagani uchun keyinchalik Next.js'ga ko'chirish
istalgan vaqtda mumkin.

---

## 2. PAPKA TUZILISHI

```
frontend/
├── functions/
│   └── api/
│       └── gas.ts              ← Cloudflare proxy (TOKEN shu yerda)
├── src/
│   ├── api/
│   │   ├── client.ts           ← gas<T>(fn, ...args)
│   │   ├── types.ts            ← Node, Obyekt, BossData ...
│   │   └── hooks.ts            ← useObyektlar(), useHolat(obyekt)
│   ├── components/
│   │   ├── ui/                 ← Button, Card, Skeleton, Badge, Sheet
│   │   ├── layout/             ← Sidebar, Topbar, Shell
│   │   └── tree/               ← SmetaTree, TreeRow, TreeToolbar
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Obyektlar.tsx
│   │   └── Holat.tsx
│   ├── lib/
│   │   ├── format.ts           ← son, pul, foiz formatlash
│   │   └── theme.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── wrangler.toml
```

---

## 3. QADAM 1 — ULANISHNI ISBOTLA (birinchi ish)

Boshqa hech narsa qilmasdan, **avval shuni ishlatib ko'r**:

```ts
const salom = await gas<{ok: boolean; tizim: string; egasi: string}>('apiWebApiSalom');
console.log(salom);
// kutilgan: { ok: true, tizim: 'SMETA GAS', egasi: 'anvar...@gmail.com' }
```

Ishlamasa — **to'xta** va `JAVOB_SAVOL.md` ga yoz. Ilgari ketma.

Ishlagach — darhol:

```ts
const fns = await gas('apiWebApiFunksiyalar');
// natijani frontend/src/api/gas-functions.json ga saqla
```

Bu 261 ta funksiyaning to'liq ro'yxati. Undan tip generatsiya qil.

---

## 4. QADAM 2 — DIZAYN TIZIMI (eng muhim qism)

> **Kontekst:** foydalanuvchi hozirgi GAS panelning ko'rinishidan
> **qoniqmagan**. Uning so'zi: *«noqulay xunuk dizayn, noprofessionalizm».*
> U Instagram'da ko'rgan zamonaviy tizimlar darajasini xohlaydi.
> **Bu Faza 1 ning asosiy maqsadi — funksiya emas, KO'RINISH.**

### 4.1 Rang tizimi

Qorong'i (dark) asosiy, yorug' (light) qo'shimcha. Qurilish tizimi —
jiddiy, zич ma'lumotli, lekin nafis.

```css
/* asos */
--bg:        #0B0E14;   /* eng orqa fon */
--surface:   #131722;   /* karta */
--surface-2: #1B2130;   /* ko'tarilgan karta, hover */
--border:    #232A3B;
--text:      #E6EAF2;
--text-dim:  #8B93A7;

/* aksent */
--accent:    #4F7BFF;   /* asosiy harakat */
--ok:        #2ED3A0;   /* bajarilgan, fakt */
--warn:      #FFB020;   /* qoldiq, ogohlantirish */
--danger:    #FF5A5A;   /* limitdan oshiq, xato */

/* qator tiplari (hozirgi paneldagi ranglar SAQLANADI) */
--t-bl:  #A78BFA;   /* 🔧 ИШ */
--t-rs:  #7DD3FC;   /* 🔹 РЕСУРС */
--t-mat: #6EE7B7;   /* 🧱 МАТЕРИАЛ */
--t-ob:  #FCD34D;   /* ⚙️ ОБОРУДОВАНИЕ */
```

### 4.2 Tipografika

```
UI matn:  Inter (yoki system-ui)
RAQAMLAR: font-variant-numeric: tabular-nums  ← MAJBURIY
```

**Barcha pul va hajm ustunlari `tabular-nums` va o'ngga tekislangan
bo'lishi shart.** Hozirgi panelning eng ko'zga tashlanadigan kamchiligi —
raqamlar "sakraydi".

Pul formati: `1 234 567 890` (probel ajratgich), valyuta belgisi yo'q,
sarlavhada «сўм» bir marta.

### 4.3 Oraliqlar

4 px setka: `4 / 8 / 12 / 16 / 24 / 32 / 48`. Boshqa qiymat ishlatilmaydi.

### 4.4 Animatsiya — qoidalar

| Harakat | Davomiylik | Egri |
|---|---|---|
| Hover | 120 ms | `ease-out` |
| Karta / modal ochilishi | 220 ms | `cubic-bezier(.16,1,.3,1)` |
| Daraxt tugun ochilishi | 180 ms | `ease-out` |
| Sahifa almashishi | 260 ms | fade + 8px yuqoriga |

⛔ **Man etiladi:** sakraydigan (bounce), aylanadigan, 400 ms dan uzoq
animatsiyalar. Bu buxgalteriya tizimi, o'yin emas.

✅ `prefers-reduced-motion` hurmat qilinadi.

### 4.5 Yuklanish holati — SPINNER MAN ETILADI

GAS chaqiruvi 2–20 soniya. Spinner bu vaqtni **uzoq** qilib ko'rsatadi.

O'rniga **skeleton**: haqiqiy tarkib shaklidagi kulrang gavda, yumshoq
shimmer bilan. Foydalanuvchi tuzilishni darhol ko'radi.

Qo'shimcha: 3 soniyadan oshsa, ostida jonli matn —
*«Смета дарахти ўқилмоқда… 1 240 та қатор»*.

### 4.6 Bo'sh holat

Har bo'sh ro'yxatda: yumshoq ikonka + bir jumla tushuntirish + bitta
harakat tugmasi. Hech qachon quruq oq maydon qoldirilmaydi.

---

## 5. QADAM 3 — EKRANLAR

### 5.1 Shell (umumiy karkas)

- Chapda yig'iladigan sidebar (ikonka + nom), 240 px / 64 px
- Yuqorida: obyekt tanlash (qidiruvli combobox), global qidiruv, holat nuqtasi
- Kontent maydoni, maksimal kenglik yo'q (jadval keng bo'ladi)
- **Mobil:** sidebar → pastdagi tab bar, jadval → karta ro'yxati

### 5.2 Dashboard — `apiBossData()`

Yuqorida 4 ta KPI kartasi: **Смета жами · Факт · Ф2 олинган · Қолдиқ**

Har kartada: katta raqam, ostida foiz o'zgarish, orqa fonda mayin
sparkline. Raqam **0 dan haqiqiy qiymatgacha 600 ms sanaladi** (faqat
birinchi yuklashda).

Ostida obyektlar jadvali: nom, smeta, fakt, %, progress bar, holat nishoni.
Ustun bo'yicha saralash, qidiruv.

### 5.3 Obyektlar — `apiPapkaSkan()`

Karta setkasi. Har kartada: obyekt nomi, lokalkalar soni, jami summa,
bajarilish halqasi (donut), oxirgi yangilanish vaqti.

**Kesh majburiy:** `apiPapkaSkan` 10–30 soniya. `sessionStorage` +
TanStack Query `staleTime: 10 * 60_000`. Fonda yangilash, «↻ янгилаш» tugmasi.

### 5.4 Ҳолат — `apiHolatOl(obyekt)` ⭐ ASOSIY EKRAN

Bu tizimning yuragi. Virtual daraxt jadvali.

**Talablar:**

1. **Virtualizatsiya majburiy** (`@tanstack/react-virtual`) — 10 000+ qator bo'ladi
2. Har qator: `[▸] [tip nishoni] НОМ … ШИФР | БИРЛИК | СМЕТА | ФАКТ | НАРХ | СУММА | Ф2`
3. Tip nishoni rangi 4.1 dagi `--t-*` bo'yicha
4. `zamena` qatori — chap chetida 🔄 va binafsha chiziq
5. `qoshimcha` qatori — chap chetida ➕ va yashil chiziq
6. Chuqurlik chiziqlari (indent guides) — ierarxiya ko'rinib tursin
7. **Har ierarxiya darajasida jamlangan summa ko'rsatilsin** — yopiq
   tugunda ham ichidagi jami ko'rinsin *(foydalanuvchi buni aniq so'ragan)*
8. Yuqorida yopishqoq (sticky) asboblar paneli: qidiruv, tip filtri,
   «faqat qoldiq bor», «faqat zamena», hammasini yoy / yig'
9. Qidiruvda mos kelgan qism sariq bilan belgilanadi va daraxt
   avtomatik shu tugungacha ochiladi

**Ishlash mezoni:** 10 000 qatorli daraxtda skroll **60 fps**.

---

## 6. QADAM 4 — DEPLOY

1. `frontend/` ni GitHub'ga push qil
2. Cloudflare Pages → GitHub repo ulash
3. Build: `npm run build`, chiqish: `dist`, ildiz: `frontend`
4. Muhit o'zgaruvchilari: `GAS_URL`, `GAS_TOKEN` (**Secret** deb belgilang)
5. Natija: `https://<loyiha>.pages.dev`

---

## 7. QABUL MEZONLARI (Faza 1 tugadi deyish uchun)

- [ ] `apiWebApiSalom` saytdan `ok:true` qaytaradi
- [ ] Token brauzer bundle ichida **YO'Q** (`dist/` ni qidirib tekshiring)
- [ ] Dashboard 4 ta KPI va obyektlar jadvalini ko'rsatadi
- [ ] Ҳолат daraxti haqiqiy obyektda ochiladi, 60 fps skroll
- [ ] Har tugunda jamlangan summa ko'rinadi
- [ ] Zamena/qo'shimcha qatorlari vizual ajralib turadi
- [ ] Barcha yuklanishlar skeleton bilan, spinner **yo'q**
- [ ] Telefonda ishlatib bo'ladi
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95
- [ ] `Smeta tizimi/` ichida **birorta ham** o'zgargan fayl yo'q (`git status`)

---

## 8. TAQIQLAR — TAKRORLAYMAN

⛔ `Smeta tizimi/` ichidagi biror faylni o'zgartirish
⛔ `clasp push` yoki `clasp deploy`
⛔ Google Sheets'ga to'g'ridan-to'g'ri ulanish (faqat GAS API orqali)
⛔ Biznes-mantiqni saytda qayta yozish (накрутка, F2 moslashtirish, narxlash)
⛔ Tokenni `VITE_*` o'zgaruvchisiga yozish

---

## 9. TIQILIB QOLSANG

`KOPRIK/JAVOB_SAVOL.md` ga yoz:

```markdown
### BLOKER: <qisqa sarlavha>
**Qadam:** 3.2
**Nima qildim:** ...
**Nima kutdim:** ...
**Nima bo'ldi:** <xato matni to'liq>
**Kerak:** <Claude'dan nima kerak>
```

Va boshqa qismga o'tib ishlashda davom et. To'xtab qolma.
