# 🏛️ ARXITEKTURA V2 — ADMIN / RAHBAR bo'linishi

> **Qaror:** foydalanuvchi 2026-07-28 · **To'liq sayt, maksimal dizayn**
> Bu hujjat `02_TOPSHIRIQ_FAZA1.md` dagi tuzilmani **almashtiradi**.

---

## 0. NIMA UCHUN O'ZGARYAPTI

Foydalanuvchining so'zi:

> *«мани хоҳишим худди аввалгидай admin ва boss панеллари бўлиши керакда»*
> *«hali ham arxitektura rasvoku»*

Hozirgi sayt — bitta yassi qobiq, 3 ta yorliq. Bu foydalanuvchi o'rgangan
model emas. Mavjud tizimda allaqachon to'g'ri bo'linish bor:

```
Login.html  →  Panel.html (admin)   |   Boss.html (rahbar, read-only)
```

Sayt ham **shu modelni takrorlaydi**.

---

## 1. YANGI TUZILMA

```
                    ┌─────────────────┐
                    │  КИРИШ ЭКРАНИ   │  ← 3D sahna, parallax
                    │  парол киритиш  │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌────────────────────┐        ┌────────────────────┐
   │   👷 АДМИН         │        │   📊 РАҲБАР        │
   │   (to'liq huquq)   │        │   (faqat o'qish)   │
   ├────────────────────┤        ├────────────────────┤
   │ Обyектлар          │        │ Умумий ҳолат       │
   │ Смета ҳолати       │        │ Обyектлар кесими   │
   │ Ф2 импорт          │        │ Молиявий оқим      │
   │ Ф2 тайёрлаш        │        │ Шартномалар        │
   │ Шартнома           │        │ Графиклар          │
   │ Бухгалтерия        │        └────────────────────┘
   │ Склад              │           ↑ ENG CHIROYLI QISM
   │ Мониторинг         │
   └────────────────────┘
      ↑ ZICH VA TEZ
```

### Ikki qobiqning uslubi ATAYLAB har xil

| | АДМИН | РАҲБАР |
|---|---|---|
| Maqsad | kuniga 8 soat ishlash | 2 daqiqada tushunish |
| Zichlik | maksimal | bo'sh joy ko'p |
| Animatsiya | minimal, tez | boy, taassurotli |
| 3D | **yo'q** | **ha** |
| Fon | tekis | jonli gradient |
| Shrift | 13–14px | 14–48px |

Sabab: buxgalter jadvalda tez ishlashi kerak, rahbar esa **hayratlanishi**.
Bir uslub ikkalasiga ham to'g'ri kelmaydi — shuning uchun ikkita.

---

## 2. 🔴 XAVFSIZLIK — birinchi navbatda hal qilinadi

### Hozirgi holat: SAYT BUTUNLAY OCHIQ

`smeta-tizimi.pages.dev` manzilini bilgan **har kim**:
- 467 mlrd so'mlik moliyaviy ma'lumotni ko'radi
- obyektlar, shartnomalar, to'lovlarni o'qiydi
- Faza 2 chiqqach — **yoza oladi**

Bu qabul qilib bo'lmaydi. Tuzatilmaguncha Faza 2 yozish saytga chiqmaydi.

### Yechim — Pages Function darajasida parol

Rol tanlash **xavfsizlik emas** (brauzerda o'zgartirib bo'ladi). Haqiqiy
himoya server tomonda:

**`functions/api/kirish.ts`** (yangi)

```ts
// Muhit o'zgaruvchilari (Cloudflare → Variables and Secrets, Encrypt):
//   ADMIN_PAROL   — admin uchun
//   BOSS_PAROL    — rahbar uchun
//   SESSIYA_KALIT — imzo uchun tasodifiy satr

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { parol } = await ctx.request.json<{ parol: string }>();

  let rol: 'admin' | 'boss' | null = null;
  if (parol === ctx.env.ADMIN_PAROL) rol = 'admin';
  else if (parol === ctx.env.BOSS_PAROL) rol = 'boss';

  if (!rol) {
    await new Promise(r => setTimeout(r, 800));   // brute-force sekinlashtirish
    return Response.json({ ok: false, xato: 'Нотўғри парол' }, { status: 401 });
  }

  const token = await imzola(rol, ctx.env.SESSIYA_KALIT);   // HMAC-SHA256
  return new Response(JSON.stringify({ ok: true, rol }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `sess=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`,
    },
  });
};
```

**`functions/api/gas.ts` — har chaqiruvda tekshiriladi:**

```ts
const sess = tekshir(ctx.request.headers.get('Cookie'), ctx.env.SESSIYA_KALIT);
if (!sess) return Response.json({ ok:false, error:'Кириш талаб қилинади' }, { status:401 });

// RAHBAR faqat o'qiy oladi
const YOZUVCHI = /^api(HolatSaqla|BlQosh|RsQosh|OyQosh|F2Qolla|F2QollaNavbatga|ShartnomaSaqla|ShartnomaOchir|Lock)/;
if (sess.rol === 'boss' && YOZUVCHI.test(fn)) {
  return Response.json({ ok:false, error:'Раҳбар режимида ёзиш мумкин эмас' }, { status:403 });
}
```

> ⭐ **Muhim:** rahbarning yoza olmasligi **serverda** majburlanadi, brauzerda
> tugmani yashirish bilan emas. Tugmani yashirish — qulaylik, himoya emas.

Cookie `HttpOnly` — JavaScript uni o'qiy olmaydi, ya'ni XSS orqali o'g'irlanmaydi.

---

## 3. MARSHRUTLASH

`react-router-dom` qo'shiladi (hozir yo'q — `useState` bilan yorliq almashyapti,
bu orqaga tugmasini va havola ulashishni buzadi).

```
/                    → Kirish (agar sessiya bo'lsa avtomatik yo'naltiradi)
/admin               → Admin qobig'i
/admin/obyektlar
/admin/holat/:obyekt
/admin/f2
/admin/f2-tayyorlash
/admin/shartnoma
/admin/buxgalteriya
/admin/sklad
/boss                → Rahbar qobig'i
/boss/obyekt/:nom
```

**Kod bo'linishi majburiy:**

```ts
const AdminShell = lazy(() => import('./admin/AdminShell'));
const BossShell  = lazy(() => import('./boss/BossShell'));
```

Sabab: Boss'da Three.js bor (~160 KB). Admin uni **hech qachon yuklamasin** —
buxgalter uchun har kilobayt kechikish.

---

## 4. PAPKA TUZILMASI

```
frontend/src/
├── kirish/
│   ├── KirishSahifa.tsx
│   └── Sahna3D.tsx          ← Three.js, faqat shu yerda va boss/da
├── admin/
│   ├── AdminShell.tsx
│   └── sahifalar/
│       ├── Obyektlar.tsx
│       ├── Holat.tsx
│       ├── F2Import.tsx
│       ├── F2Tayyorlash.tsx
│       ├── Shartnoma.tsx
│       ├── Buxgalteriya.tsx
│       └── Sklad.tsx
├── boss/
│   ├── BossShell.tsx
│   └── sahifalar/
│       ├── Umumiy.tsx
│       ├── Obyektlar3D.tsx
│       └── Moliya.tsx
├── umumiy/                  ← ikkalasi ishlatadi
│   ├── ui/                  (Button, Card, Modal, Toast, Skeleton…)
│   ├── daraxt/              (SmetaTree — virtualizatsiyalangan)
│   └── vizual/              (GradientFon, Grain, MotionWrapper)
├── api/
└── lib/
```

---

## 5. YANGILANGAN YO'L XARITASI

Tartib **ataylab o'zgartirildi** — chiroyli natija oxirida emas, **boshida**
ko'rinsin:

| Faza | Nima | Sessiya | Nega shu tartibda |
|---|---|---|---|
| **2A** | Kirish + parol + Admin/Boss qobiqlari + marshrutlash | 1–2 | Xavfsizlik va tuzilma — poydevor |
| **2B** | 🌟 **RAHBAR paneli — to'liq 3D/motion** | 2 | **Sen 1 haftada haqiqiy natija ko'rasan** |
| **2C** | Admin: yozish rejimi (hozirgi Faza 2, tuzatilgan) | 2 | |
| **3** | Ф2 import / tayyorlash | 3 | Eng murakkab |
| **4** | Shartnoma · Buxgalteriya · Sklad | 2–3 | |
| **5** | Sayqal · mobil · klaviatura | 2 | |
| **6** | Supabase tezlik qatlami | 2 | |

**Jami 14–16 sessiya.**

> 💡 **2B nima uchun oldinda?** Rahbar paneli — faqat o'qish, xavfi past,
> lekin eng ko'rinadigan qism. Uni birinchi qilsak, sen natijani darhol
> ko'rasan; qolgan haftalar «hech narsa ko'rinmayapti» bo'lib o'tmaydi.

---

## 6. PANEL BILAN PARALLEL ISHLASH

Sayt tugagunicha `Panel.html` **to'liq ishlab turadi**. Ikkalasi bir xil
GAS funksiyalarini chaqiradi — ya'ni bir xil ma'lumot, ziddiyat yo'q.

Sayt Faza 4 tugagach panel bilan tenglashadi. Shundan keyin qaysi birini
saqlashni **sen hal qilasan** — hech narsa majburan o'chirilmaydi.

---

## 7. FAZA 2A — QABUL MEZONLARI

```
[ ] react-router-dom qo'shildi, orqaga tugmasi ishlaydi
[ ] Kirish sahifasi 3D sahna bilan (12_DIZAYN_V2 §2)
[ ] ADMIN_PAROL / BOSS_PAROL / SESSIYA_KALIT Cloudflare'da (Encrypt)
[ ] Parolsiz /admin yoki /boss ga kirib bo'lmaydi (kirish sahifasiga otadi)
[ ] /api/gas sessiyasiz 401 qaytaradi
[ ] Rahbar rolida yozuvchi funksiya 403 qaytaradi (SERVERDA sinaldi)
[ ] Cookie HttpOnly + Secure + SameSite=Strict
[ ] Admin va Boss alohida bundle (Three.js admin bundle'ida YO'Q — tekshiring)
[ ] npm run build xatosiz
[ ] push qilindi, Cloudflare Success
```

### Xavfsizlik sinovi — majburiy

```bash
# 1. Sessiyasiz — 401 kutiladi
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://smeta-tizimi.pages.dev/api/gas \
  -H "Content-Type: application/json" -d '{"fn":"apiBossData","args":[]}'

# 2. Boss sessiyasi bilan yozishga urinish — 403 kutiladi
```

Ikkalasi ham kutilgan kodni qaytarmasa — Faza 2A tugamagan.
