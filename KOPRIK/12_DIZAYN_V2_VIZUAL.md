# ✨ DIZAYN V2 — VIZUAL QATLAM (3D · MOTION · JONLI FON)

> **Bu hujjat `06_DIZAYN_TIZIMI.md` dagi «bezak taqiqlanadi» qoidalarini
> BEKOR QILADI.** 06 hujjatidagi rang, shrift, `.num`, oraliq va jadval
> qoidalari **kuchda qoladi**. O'zgaradigani — hissiyot qatlami.

---

## 0. AVVALGI XATO

`06_DIZAYN_TIZIMI.md` da men shunday yozgandim:

> «Ma'lumot qahramon, bezak xizmatkor» · «Sakraydigan animatsiya taqiqlanadi»
> · «400ms dan uzoq taqiqlanadi»

Bu **jadval uchun to'g'ri**, lekin men uni butun tizimga tatbiq qildim va
natijada tizimda jon qolmadi. Foydalanuvchi haq edi:

> *«на бир чиройли анимация на бир расм на бир чиройли фон на motion дизайн
> на 3d графика»*

---

## 1. IKKI QATLAM DOKTRINASI

```
╔══════════════════════════════════════════════════════════╗
║  YUZ QATLAMI  —  taassurot qoldiradi                     ║
║  Kirish · Rahbar paneli · sarlavhalar · o'tishlar        ║
║  → 3D, motion, jonli fon, chuqurlik, tekstura, parallax  ║
╠══════════════════════════════════════════════════════════╣
║  YADRO QATLAMI  —  ish bajaradi                          ║
║  Jadval · daraxt · Ф2 · formalar                         ║
║  → zich, tez, bezaksiz. 06 hujjati to'liq amal qiladi.   ║
╚══════════════════════════════════════════════════════════╝
```

**Chegara aniq:** foydalanuvchi *tomosha qiladigan* joy — boy.
Foydalanuvchi *ishlaydigan* joy — intizomli.

Jadvalga 3D qo'yish = ishni sekinlashtirish. Kirish ekranini quruq qoldirish =
tizimni arzon ko'rsatish. Ikkalasi ham xato.

---

## 2. 🌟 KIRISH EKRANI — birinchi taassurot

Foydalanuvchi tizimni birinchi shu yerda ko'radi. Bu ekran **butun tizim
haqidagi fikrni belgilaydi**.

### 2.1 Sahna

Fon: **abstrakt qurilish karkasi** — sekin aylanuvchi metall to'sinlar
tarmog'i, chekka chiziqlari yorug'lanadi (emissive), chuqurlikka ketgan
sari xiralashadi.

```
Kamera:      perspektiv, FOV 45, sekin orbital harakat (0.05 rad/s)
Geometriya:  ~40 ta to'sin (BoxGeometry), instanced mesh — bitta draw call
Material:    MeshStandardMaterial, metalness .8, roughness .35
Yoritish:    2 ta yo'naltirilgan (accent #4F7BFF va warm #D97706) + ambient
Tuman:       FogExp2, rang --bg, density .035  → chuqurlik hissi
Parallax:    sichqoncha harakatida kamera ±3° og'adi (lerp, 0.06)
```

Bu **abstrakt** bo'lsin — haqiqiy kran yoki bino modeli emas. Abstrakt
geometriya qimmat ko'rinadi, realistik model esa o'yinchoqday.

### 2.2 Old plan

```
        ┌──────────────────────────────────────┐
        │                                      │
        │            SMETA GAS                 │  ← 48px, 700, oq
        │   Қурилиш сметаси бошқарув тизими    │  ← 15px, --text-dim
        │                                      │
        │   ┌──────────┐    ┌──────────┐      │
        │   │    👷    │    │    📊    │      │
        │   │  АДМИН   │    │  РАҲБАР  │      │
        │   │ Тўлиқ    │    │ Кўриш    │      │
        │   │ бошқарув │    │ режими   │      │
        │   └──────────┘    └──────────┘      │
        │                                      │
        │        [ парол ]      [ Кириш → ]   │
        └──────────────────────────────────────┘
```

**Karta harakati:**
- Kirish: `opacity 0→1`, `y 24→0`, `scale .96→1` — ketma-ket 80ms kechikish
- Hover: `y -6px`, chegara `--accent` ga o'tadi, orqasida yumshoq nur
- Bosilganda: `scale .98`, keyin tanlangani markazga suriladi

**Sarlavha:** harflar bittalab chiqadi (`stagger: 0.03`) — 500ms, bir marta.

### 2.3 Zaxira variantlar — MAJBURIY

| Holat | Nima ko'rsatiladi |
|---|---|
| WebGL yo'q | statik gradient mesh + grain (chiroyli, jonsiz) |
| `prefers-reduced-motion` | sahna qotgan holatda, parallax yo'q |
| Mobil (< 768px) | 3D o'chadi, gradient fon qoladi (batareya) |
| Sekin qurilma | `navigator.hardwareConcurrency < 4` → gradient fon |

3D **hech qachon sahifani bloklamaydi** — u `<Suspense>` ichida, orqasida
gradient turadi va tayyor bo'lgach yumshoq paydo bo'ladi (`fade 600ms`).

---

## 3. 🌟 RAHBAR PANELI — eng chiroyli qism

### 3.1 Jonli fon (butun sahifada)

Ikki qatlam:

**(a) Animatsiyali gradient mesh** — CSS bilan, GPU'da, deyarli bepul:

```css
.jonli-fon {
  position: fixed; inset: 0; z-index: -2;
  background:
    radial-gradient(60% 50% at 15% 20%, #4F7BFF22, transparent 60%),
    radial-gradient(50% 45% at 85% 15%, #8B5CF61e, transparent 60%),
    radial-gradient(55% 50% at 70% 85%, #05966918, transparent 60%),
    var(--bg);
  animation: fon-suz 24s ease-in-out infinite alternate;
}
@keyframes fon-suz {
  0%   { background-position: 0% 0%,   100% 0%,  70% 100%; }
  100% { background-position: 10% 8%,  88% 10%,  60% 92%;  }
}
```

**(b) Grain (don) qatlami** — raqamli tekislikni «materialga» aylantiradi:

```css
.grain {
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  opacity: .035; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

Grain — eng arzon va eng samarali usul. Usiz dark UI «yassi plastik»
bo'lib ko'rinadi.

### 3.2 Hero — jonli KPI

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│   УМУМИЙ ҲОЛАТ                          28-июл, 2026     │
│                                                           │
│   467.3 млрд                                             │
│   ─────────── сўм умумий смета                           │
│   ████████████░░░░░░░░░░░░░░░░  19% бажарилди            │
│                                                           │
│   ФАКТ 90.5 млрд   Ф2 28.0 млрд   ҚОЛДИҚ 376.9 млрд     │
└───────────────────────────────────────────────────────────┘
```

- Katta raqam: `clamp(40px, 6vw, 72px)`, 700, `tabular-nums`
- 0 dan haqiqiy qiymatgacha **1200ms** sanaydi (`easeOutExpo`) — **bir marta**
- Progress chizig'i chapdan o'ngga to'ladi, 1400ms, 200ms kechikish bilan
- Raqam ostida yumshoq nur: `text-shadow: 0 0 40px rgba(79,123,255,.25)`

### 3.3 3D obyektlar diagrammasi

Obyektlar 3D ustunlar sifatida — balandlik = smeta, to'lgan qismi = fakt.

```
Texnologiya:  @react-three/fiber + @react-three/drei
Geometriya:   InstancedMesh (66 ta ustun, bitta draw call)
Kamera:       izometrik burchak, sekin aylanish, sudrab burish mumkin
Material:     ikki qatlam — pastki (fakt) --ok, ustki (qoldiq) --surface-2
Hover:        ustun yorug'lanadi + HTML tooltip (drei/Html) aniq raqam bilan
Bosilganda:   kamera shu ustunga yaqinlashadi, yon panel ochiladi
Kirish:       ustunlar 0 dan balandlikkacha ko'tariladi, 40ms stagger
```

> ⚠️ **Muhim qoida:** 3D diagramma — **taassurot**, o'lchov emas. Odam 3D'da
> balandlikni aniq baholay olmaydi. Shuning uchun **yonida doim 2D jadval
> turadi** — aniq raqamlar u yerdan o'qiladi. 3D ko'z uchun, jadval aql uchun.

### 3.4 Obyekt kartalari

- Progress **halqa** (SVG, `stroke-dasharray` animatsiyasi, 900ms)
- Hover: `translateY(-4px)`, chegara yorug'lashadi, orqada nur
- Ro'yxatga kirish: `stagger 60ms`, `y 20→0`

---

## 4. MOTION TIZIMI

`framer-motion` allaqachon o'rnatilgan — hozirgacha **ishlatilmagan**.

### 4.1 Sahifa o'tishlari

```tsx
const sahifa = {
  kirish: { opacity: 0, y: 12, filter: 'blur(4px)' },
  faol:   { opacity: 1, y: 0,  filter: 'blur(0px)',
            transition: { duration: .32, ease: [.16,1,.3,1] } },
  chiqish:{ opacity: 0, y: -8, filter: 'blur(4px)',
            transition: { duration: .18 } },
};
```

`AnimatePresence mode="wait"` bilan o'ralsin.

### 4.2 Ro'yxat elementlari

```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: i * 0.05, duration: .34, ease: [.16,1,.3,1] }}
/>
```

Kechikish **maksimal 400ms** bilan cheklansin (`Math.min(i*0.05, 0.4)`) —
aks holda 66-karta 3 soniyadan keyin chiqadi.

### 4.3 Umumiy o'tish

Obyekt kartasidan batafsil sahifaga o'tganda `layoutId` bilan sarlavha
**joyida qoladi va o'sadi** — sahifa almashmagandek tuyuladi.

```tsx
<motion.h2 layoutId={`obyekt-${nom}`}>{nom}</motion.h2>
```

Bu eng kuchli effekt va deyarli bepul.

### 4.4 Yadro qatlamida NIMA QILINMAYDI

Jadval va daraxtda:
- Qator kirish animatsiyasi **yo'q** (virtualizatsiya bilan ziddiyat)
- `layout` animatsiyasi **yo'q** (skroll paytida fps o'ldiradi)
- Faqat hover (120ms) va tugun ochilishi (180ms)

---

## 5. ISHLASH BYUDJETI — qat'iy

Chiroyli, lekin sekin = muvaffaqiyatsizlik. Chegaralar:

| O'lchov | Chegara |
|---|---|
| Boss marshruti bundle (gzip) | **≤ 400 KB** |
| Admin marshruti bundle (gzip) | **≤ 150 KB** (Three.js YO'Q) |
| Kirish ekrani LCP | ≤ 2.0 s |
| 3D sahna uchburchaklari | ≤ 30 000 |
| 3D draw call | ≤ 10 (instancing) |
| Devicepixelratio | `Math.min(dpr, 1.5)` |
| Soyalar | **o'chirilgan** (baked yoritish) |
| Jadval skroll | 60 fps |

### Majburiy optimizatsiyalar

```tsx
// Yorliq ko'rinmasa — render to'xtaydi (batareya + fps)
useFrame((state) => {
  if (document.visibilityState !== 'visible') return;
  // …
});

// Canvas ekrandan chiqsa — pauza
<Canvas frameloop={korinadimi ? 'always' : 'never'} dpr={[1, 1.5]} shadows={false} />
```

`prefers-reduced-motion` → 3D o'rniga statik render (bir marta chizib,
`frameloop="never"`).

---

## 6. RANG — V2 qo'shimchalari

`06` dagi ranglar kuchda. Qo'shiladi:

```css
/* Nur va chuqurlik */
--glow-accent: 0 0 40px rgba(79,123,255,.25);
--glow-ok:     0 0 32px rgba(46,211,160,.20);

/* Shisha effekti (faqat suzuvchi panellar) */
--glass: rgba(19,23,34,.72);
--glass-border: rgba(255,255,255,.06);
/* backdrop-filter: blur(16px) saturate(1.4) */
```

⚠️ `backdrop-filter` — faqat **suzuvchi** elementlarda (modal, tooltip,
sticky topbar). Ko'p ishlatilsa GPU'ni yeydi.

---

## 7. FAZA 2B — QABUL MEZONLARI (Rahbar paneli)

```
[ ] Kirish ekrani: 3D sahna + parallax + karta animatsiyalari
[ ] WebGL yo'q / reduced-motion / mobil → gradient zaxira ishlaydi
[ ] Jonli gradient fon + grain qatlami
[ ] Hero KPI: 1200ms sanash, progress to'lishi
[ ] 3D obyektlar diagrammasi: hover tooltip, bosilganda drill-down
[ ] 3D YONIDA aniq raqamli 2D jadval bor
[ ] Obyekt kartalari: progress halqa, stagger kirish
[ ] Sahifa o'tishlari (AnimatePresence)
[ ] layoutId bilan umumiy o'tish ishlaydi
[ ] Admin bundle'ida Three.js YO'Q (tekshiring!)
[ ] Boss bundle gzip ≤ 400 KB
[ ] Jadval skroll 60 fps
[ ] npm run build xatosiz
```

### Bundle tekshiruvi — majburiy

```bash
npm run build
# Admin chunk ichida three yo'qligini tasdiqlang:
grep -l "three" dist/assets/*.js
# Faqat boss/kirish chunk'ida chiqishi kerak
```

---

## 8. MAVJUD 06 HUJJATIDAN NIMA O'ZGARADI

| 06 dagi qoida | V2 dagi holati |
|---|---|
| «Sakraydigan animatsiya taqiqlanadi» | **Yadroda** taqiqlanadi, **yuzda** ruxsat |
| «400ms dan uzoq taqiqlanadi» | Yuzda 1400ms gacha (KPI, hero) |
| «Gradient faqat ma'no qo'shsa» | Yuzda gradient fon **majburiy** |
| «Soya faqat suzuvchi elementda» | Yuzda nur (glow) ham ruxsat |
| Rang, shrift, `.num`, oraliq, jadval | **O'ZGARMAYDI — to'liq kuchda** |
| Anti-patternlar (§11) | **O'ZGARMAYDI** — `alert()`, pirog, dual-axis hamon taqiq |
