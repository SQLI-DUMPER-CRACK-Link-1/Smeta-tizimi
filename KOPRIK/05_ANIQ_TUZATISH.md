# 🎯 ANIQ TUZATISH — qora ekran sababi topildi

> **Kim:** Claude · **Sana:** 2026-07-28 · **Antigravity uchun**
> Taxmin emas — jonli brauzerda tutilgan xato va jonli API javobidan olingan
> haqiqiy maydon nomlari.

---

## 🔬 QANDAY TOPILDI

Brauzerda `88bd883a.smeta-tizimi.pages.dev` ochilib, sahifaga xato-tuzoq
o'rnatildi va ma'lumot kelishi kutildi:

```
root = 3718  →  (14 soniya, apiBossData javobi keldi)  →  root = 0

Uncaught TypeError: Cannot read properties of undefined (reading 'smetaJami')
```

React uchqun xatosida butun daraxtni yechib tashlaydi → **qop-qora sahifa**.

---

## 🔴 ZANJIR — nima uchun tuzatishlar saytga chiqmayapti

```
1. Manba kodda 'smetaJami' TUZATILGAN ✅
2. LEKIN  npm run build  YIQILADI  ❌   ← tsc 3 ta xato beryapti
3. Cloudflare build yiqilgani uchun ESKI bundle'ni xizmat qilaverdi
4. Eski bundle'da 'smetaJami' bor → ma'lumot kelishi bilan qulaydi
5. Foydalanuvchi qora ekran ko'radi
```

**Ya'ni tuzatishlar yozilgan, lekin hech qachon saytga yetib bormagan.**

Hozirgi build xatosi:

```
src/pages/Holat.tsx(13,36): error TS2339: Property 'id' does not exist on type 'ObyektInfo'.
src/pages/Holat.tsx(40,34): error TS2339: Property 'id' does not exist on type 'ObyektInfo'.
src/pages/Holat.tsx(40,60): error TS2339: Property 'id' does not exist on type 'ObyektInfo'.
```

> ⚠️ **MUHIM ODAT:** har o'zgarishdan keyin **`npm run build`** ni ishga tushiring.
> U yiqilsa — Cloudflare ham yiqiladi va **eski nusxa qolaveradi**. Sayt
> «o'zgarmadi» bo'lib ko'rinadi, aslida build yiqilgan bo'ladi.
> Cloudflare → Deployments → oxirgi qatorda **Failed** yozuvini tekshiring.

---

## 📐 HAQIQIY API SHAKLLARI (jonli chaqiruvdan olingan, taxmin emas)

### `apiPapkaSkan()` → **massiv**, 66 ta element

```ts
type PapkaObyekt = {
  obyekt: string;      // ← NOM SHU YERDA. `nom` ham, `id` ham YO'Q!
  folderId: string;
  lokId: string;
  lokName: string;
  svodId: string;
  svodName: string;
  format: string;
  lokSheets: string[];
  svodSheets: string[];
  svodCols: unknown;
};
```

⛔ **Diqqat:** `apiPapkaSkan` da `smeta`, `fakt`, `qoldiq`, `progress` **YO'Q**.
Bu faqat papka skaneri. Moliyaviy raqamlar uchun `apiBossData()` kerak.

### `apiBossData()` → **obyekt**

```ts
type BossData = {
  objects: BossObyekt[];
  jami: BossJami;        // ← `jami` MAVJUD, ishlatish to'g'ri
  oylar: unknown[];      // hozircha bo'sh massiv
  sana: string;
};

type BossJami = {
  smeta: number; smetaToza: number; chel: number; mash: number;
  mat: number; ob: number; mk: number; kab: number; sub: number;
  fakt: number; f2: number; qoldiq: number;
  tolangan: number; debitor: number; avans: number;
  leaf: number; progress: number; f2pct: number;
};

type BossObyekt = {
  nom: string;           // ← bu yerda `nom` BOR
  isGroup?: boolean;
  subItems?: BossObyekt[];
  smeta: number; smetaToza: number; fakt: number; f2: number;
  chel: number; mash: number; mat: number; ob: number;
  mk: number; kab: number; sub: number; qoldiq: number;
  progress: number; f2pct: number;
  tolangan: number; debitor: number; avans: number; dogSumma: number;
  leaf: number; sana: string;
};
```

**Tekshirilgan haqiqiy qiymatlar:**
```
jami.smeta  = 467 348 726 061
jami.fakt   =  90 468 054 268
jami.f2     =  28 016 003 673
jami.qoldiq = 376 880 671 792
jami.leaf   = 52 516
```

---

## 🔧 TUZATISH 1 — `src/api/types.ts`

`ObyektInfo` ikki xil narsa uchun ishlatilyapti — shuning uchun chalkashlik.
**Ikkiga ajrating:**

```ts
/** apiPapkaSkan() qaytaradigan element — faqat papka ma'lumoti */
export type PapkaObyekt = {
  obyekt: string;
  folderId: string;
  lokId: string;
  lokName: string;
  svodId: string;
  svodName: string;
  format: string;
  lokSheets: string[];
  svodSheets: string[];
};

/** apiBossData().objects elementi — moliyaviy ko'rsatkichlar */
export type BossObyekt = {
  nom: string;
  isGroup?: boolean;
  subItems?: BossObyekt[];
  smeta: number; smetaToza: number; fakt: number; f2: number;
  qoldiq: number; progress: number; f2pct: number; leaf: number;
};

export type BossJami = {
  smeta: number; smetaToza: number; fakt: number; f2: number;
  qoldiq: number; progress: number; f2pct: number; leaf: number;
  chel: number; mash: number; mat: number; ob: number;
  mk: number; kab: number; sub: number;
  tolangan: number; debitor: number; avans: number;
};

export interface BossData {
  objects: BossObyekt[];
  jami: BossJami;
  oylar: unknown[];
  sana: string;
}
```

`ObyektInfo` nomini butunlay olib tashlang — u chalkashlik manbai.

---

## 🔧 TUZATISH 2 — `src/api/hooks.ts`

```ts
export function useObyektlar() {
  return useQuery({
    queryKey: ['obyektlar'],
    queryFn: () => gas<PapkaObyekt[]>('apiPapkaSkan'),   // ← tip almashdi
    staleTime: 10 * 60 * 1000,
  });
}
```

---

## 🔧 TUZATISH 3 — `src/pages/Holat.tsx`

**13-satr — `.id` yo'q, va render paytida setState xavfli:**

```tsx
// ❌ ESKI — cheksiz qayta render xavfi (ikkalasi ham undefined bo'lsa)
if (!selectedObyekt && obyektlar && obyektlar.length > 0) {
  setSelectedObyekt(obyektlar[0].id || obyektlar[0].nom);
}

// ✅ YANGI — useEffect ichida, to'g'ri maydon bilan
useEffect(() => {
  if (!selectedObyekt && obyektlar?.length) {
    setSelectedObyekt(obyektlar[0].obyekt);
  }
}, [obyektlar, selectedObyekt]);
```

`import { useState, useEffect } from 'react';` ni unutmang.

**40-satr — select ro'yxati:**

```tsx
{obyektlar?.map(obj => (
  <option key={obj.obyekt} value={obj.obyekt}>{obj.obyekt}</option>
))}
```

---

## 🔧 TUZATISH 4 — `src/App.tsx` (haqiqiy Holat sahifasi ulanmagan)

```tsx
// ❌ Bu 3 satrni O'CHIRING — u haqiqiy sahifani to'sib turibdi
function Holat() {
  return <div className="text-xl">Smeta Holati Page</div>;
}

// ✅ Import qo'shing
import { Holat } from './pages/Holat';
```

Bir xil nomdagi lokal funksiya import qilinganini to'sgan, shuning uchun
TypeScript ogohlantirmagan. Sahifada shu sababdan «Smeta Holati Page»
yozuvi turgan.

---

## 🔧 TUZATISH 5 — `src/pages/Obyektlar.tsx`

`(obj as any).obyekt || obj.nom` — `as any` **olib tashlansin**, endi tip to'g'ri:

```tsx
<h3 className="...">{obj.obyekt}</h3>
```

Va bu sahifada `smeta` / `fakt` **ko'rsatilmaydi** — `apiPapkaSkan` ularni
qaytarmaydi. Ikki yo'l:
- **A (oson):** kartada faqat papka ma'lumotini ko'rsating
  (obyekt nomi, lokalkalar soni, svodka bor/yo'q)
- **B (to'liq):** `apiBossData()` ni ham chaqirib, `objects` dan `nom`
  bo'yicha qo'shib ko'rsating

---

## ✅ TUGATISH MEZONI

Ketma-ket bajaring, biri o'tmasa keyingisiga o'tmang:

```bash
cd frontend
npm run build          # ← XATOSIZ o'tishi SHART
```

Keyin:

1. `git add -A && git commit && git push` (branch: **`main`**)
2. Cloudflare → Deployments → yangi qurilish **Success** bo'lsin
3. Saytni oching, **20 soniya kuting** (apiBossData ~14 s)
4. KPI raqamlari chiqsin: **Смета 467 348 726 061**
5. Obyektlar sahifasida 66 ta karta, har birida nom ko'rinsin
6. Smeta Holati — «Smeta Holati Page» EMAS, haqiqiy daraxt

---

## 🛡️ QAYTARILMASLIGI UCHUN — ERROR BOUNDARY

Bitta maydon xatosi butun saytni o'ldirdi. Buni oldini oling —
`src/main.tsx` ni o'rang:

```tsx
import { Component, type ReactNode } from 'react';

class Xato extends Component<{children: ReactNode}, {xato: Error | null}> {
  state = { xato: null as Error | null };
  static getDerivedStateFromError(xato: Error) { return { xato }; }
  render() {
    if (this.state.xato) {
      return (
        <div style={{padding:32, color:'#FF5A5A', fontFamily:'monospace',
                     background:'#0B0E14', minHeight:'100vh'}}>
          <h2>Sahifada xatolik</h2>
          <pre style={{whiteSpace:'pre-wrap'}}>{this.state.xato.message}</pre>
          <button onClick={() => location.reload()}
                  style={{marginTop:16, padding:'8px 16px'}}>Qayta yuklash</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

`<Xato>` ni `<QueryClientProvider>` atrofiga o'rang. Shunda keyingi safar
qora ekran o'rniga **xato matni** ko'rinadi — sabab bir soniyada topiladi.
