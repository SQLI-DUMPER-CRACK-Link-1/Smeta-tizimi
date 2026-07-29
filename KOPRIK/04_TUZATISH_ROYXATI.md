# 🔧 TUZATISH RO'YXATI — «sayt ishlamayapti» tekshiruvi

> **Kim tekshirdi:** Claude · **Sana:** 2026-07-28
> **Xulosa:** kod **yaxshi**, build **ishlaydi**. Muammo deploy sozlamalarida
> va ikkita xavfsizlik nuqsonida.

---

## ✅ NIMA YAXSHI ISHLAYAPTI

Buni alohida yozyapman, chunki ish qilingan va u yo'qolmasin:

| Narsa | Holat |
|---|---|
| Vite build | ✅ 484 ms, xatosiz, 237 KB (gzip 74 KB) |
| TypeScript `tsc -b` | ✅ toza |
| GAS API darcha | ✅ **jonli isbotlandi** — 186 ta funksiya haqiqiy tortib olingan |
| `functions/api/gas.ts` proxy | ✅ shartnomaga mos (POST, `text/plain`) |
| Papka egaligi qoidasi | ✅ `Smeta tizimi/` ga tegilmagan |
| Komponent tuzilishi | ✅ shartnomadagidek |

Ya'ni **poydevor to'g'ri qurilgan**. Qolgani sozlama.

---

## 🔴 M1 — TOKEN GIT'GA TUSHGAN (eng shoshilinch)

**Fayl:** `frontend/scripts/fetch-functions.js`, 4-satr

```js
const GAS_TOKEN = "6db2806134...fee";   // ← ochiq matnda
```

**Holat:** `57e8374` commitida, `origin/cursor/sql-first-ai-central-key` ga
push qilingan.

**Nima uchun xavfli:** bu token bilan istalgan odam smeta jadvallariga
**yoza oladi**. Repo hozir yopiq, lekin token endi git tarixida — hamkor
qo'shilsa yoki repo ochilsa, darhol oshkor bo'ladi.

### Tuzatish

**1-qadam (foydalanuvchi, hoziroq):** GAS'da `webApiTokenYarat()` ni **qayta**
ishga tushiring. Eski token o'sha zahoti o'lik bo'ladi va git tarixidagi
nusxa ahamiyatsiz qoladi. *(Shu sababli git tarixini tozalash shart emas.)*

**2-qadam (Antigravity):** skriptni muhit o'zgaruvchisidan o'qiydigan qiling:

```js
const GAS_URL   = process.env.GAS_URL;
const GAS_TOKEN = process.env.GAS_TOKEN;

if (!GAS_URL || !GAS_TOKEN) {
  console.error('GAS_URL va GAS_TOKEN muhit o\'zgaruvchilari kerak.');
  console.error('Masalan:  GAS_TOKEN=xxx GAS_URL=yyy node scripts/fetch-functions.js');
  process.exit(1);
}
```

**3-qadam:** `frontend/.gitignore` ga qo'shing:

```
.env
.env.*
.dev.vars
```

---

## 🔴 M2 — PROXY OCHIQ CORS BILAN (xavfsizlik)

**Fayl:** `frontend/functions/api/gas.ts`

```ts
'Access-Control-Allow-Origin': '*',      // ← har qanday sayt chaqira oladi
```

`onRequestOptions` ham preflight'ni ochiq qo'yib beryapti.

**Nima uchun xavfli:** bu sarlavha bilan **istalgan begona sayt** brauzeringdan
`/api/gas` ga so'rov yubora oladi va u **sening tokening bilan** bajariladi.
Yani boshqa saytga kirsang, u fonda smetalaringni o'qishi yoki o'zgartirishi
mumkin. Saytda hali kirish (login) yo'qligi buni yanada jiddiy qiladi.

### Tuzatish

CORS sarlavhalarini **butunlay olib tashlang**. Sayt va proxy bir domenda
(`same-origin`) — CORS umuman kerak emas. `onRequestOptions` ni ham o'chiring.

```ts
export const onRequestPost: PagesFunction<{
  GAS_URL: string; GAS_TOKEN: string;
}> = async (ctx) => {
  const { fn, args } = await ctx.request.json<{ fn: string; args?: unknown[] }>();
  const r = await fetch(ctx.env.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ __api: 1, token: ctx.env.GAS_TOKEN, fn, args: args ?? [] }),
  });
  return new Response(await r.text(), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

---

## 🟠 M3 — SAYT NOTO'G'RI BRANCH'DA (deploy ishlamasligining ASOSIY sababi)

```
origin/main                            = 267fc0b  ← frontend/ YO'Q
origin/cursor/sql-first-ai-central-key = e402bb9  ← frontend/ SHU YERDA
```

Qo'llanmada (`03_MEN_UCHUN_QOLLANMA.md`) Production branch sifatida **`main`**
yozilgan. Cloudflare `main` ni quradi — u yerda `frontend/` papkasi yo'q →
build yiqiladi yoki 404.

> ℹ️ Bu **Claude'ning xatosi** — qo'llanmani yozganda ish qaysi branch'ga
> tushishini tekshirmagan.

### Tuzatish — ikki yo'ldan biri

**A (tavsiya):** frontend'ni `main` ga qo'shish. Branch `main` dan atigi
3 ta commit oldinda, ya'ni oddiy fast-forward:

```bash
git checkout main
git merge cursor/sql-first-ai-central-key
git push origin main
```

**B (tezroq):** Cloudflare'da Production branch'ni
`cursor/sql-first-ai-central-key` qilib qo'yish.
*Kamchiligi:* branch nomi vaqtinchalik, keyin baribir ko'chirish kerak bo'ladi.

---

## 🟠 M4 — LOYIHA NOMI MOS EMAS

`frontend/wrangler.toml`:
```toml
name = "smeta-frontend"
```

Qo'llanmada esa Project name = **`smeta`** deb yozilgan.

Cloudflare Pages `wrangler.toml` dagi `name` ni loyiha nomi bilan
solishtiradi. Mos kelmasa build shunday xato beradi:

```
Your wrangler.toml file has a "name" that does not match the Pages project name
```

### Tuzatish
Ikkalasini **bir xil** qiling. Eng oson: Cloudflare'da loyihani
**`smeta-frontend`** deb ataysiz (wrangler.toml o'zgarmaydi).
Shunda sayt manzili: `https://smeta-frontend.pages.dev`

---

## 🟡 M5 — `wrangler.toml` va panel sozlamasi ikkiyoqlama

`wrangler.toml` da `pages_build_output_dir = "dist"` bor. Bu **to'g'ri va
zamonaviy usul**, lekin shuni bilish kerak: shu fayl bor bo'lsa, Cloudflare
**uni** o'qiydi, panelga qo'lda yozilgan «Build output directory» esa
e'tiborsiz qoladi.

**Chalkashmaslik uchun:** panelda faqat shularni to'ldiring —

| Maydon | Qiymat |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | *(bo'sh qoldiring — wrangler.toml hal qiladi)* |

---

## 📋 BAJARISH TARTIBI

### Foydalanuvchi (Anvar) — ~5 daqiqa
1. **M1:** GAS'da `webApiTokenYarat()` ni **qayta** ishga tushiring → yangi token
2. Yangi tokenni faqat Cloudflare'ga yozing (Settings → Variables and Secrets → **Encrypt**)
3. **M3:** qaysi yo'l — A yoki B? Claude'ga ayting
4. **M4:** Cloudflare'da loyiha nomi `smeta-frontend` bo'lsin

### Antigravity — ~10 daqiqa
1. **M1:** `scripts/fetch-functions.js` → `process.env` dan o'qisin
2. **M1:** `.gitignore` ga `.env`, `.env.*`, `.dev.vars`
3. **M2:** `functions/api/gas.ts` dan CORS sarlavhalarini va
   `onRequestOptions` ni olib tashlash
4. Commit + push

### Claude
- **M3-A** tanlansa — `main` ga merge qilib push qiladi
- `03_MEN_UCHUN_QOLLANMA.md` dagi branch va loyiha nomini tuzatadi

---

## 🔍 QANDAY TEKSHIRILDI

| Tekshiruv | Natija |
|---|---|
| `npm run build` | ✅ 484 ms, xatosiz |
| `git ls-remote --heads origin` | `main` = 267fc0b, frontend yo'q |
| `git log -S "<token>"` | ✅ topildi — `57e8374` |
| `curl smeta.pages.dev` | `000` — DNS yo'q, loyiha mavjud emas |
| `curl smeta-frontend.pages.dev` | `000` — xuddi shunday |
| `src/api/gas-functions.json` | 186 ta funksiya — **API jonli ishlagan** |
