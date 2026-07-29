# 📜 API SHARTNOMA — GAS ↔ Sayt

> **Egasi:** Claude · **Versiya:** 1 · **2026-07-28**
> Antigravity bu faylni **faqat o'qiydi**. O'zgarish kerak bo'lsa → `JAVOB_SAVOL.md`.

---

## 1. ULANISH

### 1.1 GAS Web App manzillari

```
PRODUKSIYA (barqaror):
https://script.google.com/macros/s/AKfycbxKOoTacSJaiKd5nPqa38letjjWJUvqy6vLcqkXnM78_jPRT_HobktQNQAEl-XXK2n4aQ/exec

TEST (har push'dan keyin darhol yangilanadi, versiya kerak emas):
https://script.google.com/macros/s/AKfycbxhZgAn59VJOiwcUxqw4MhrlNMOCHd4AJDnEtzwJ7DL/dev
```

Ishlab chiqish paytida **`/dev`** ni ishlating — Claude push qilgani zahoti
o'zgarish ko'rinadi, deploy kutish shart emas.

### 1.2 Token

Token `PropertiesService` ichida saqlanadi. Foydalanuvchi `webApiTokenYarat()`
ni bir marta ishga tushiradi va natijani Cloudflare muhit o'zgaruvchisiga yozadi:

```
GAS_URL   = https://script.google.com/macros/s/.../exec
GAS_TOKEN = <64 belgili token>
```

> ⛔ **Token hech qachon brauzer kodiga tushmasin.** `VITE_` prefiksi bilan
> boshlanadigan o'zgaruvchiga yozmang — Vite ularni bundle ichiga qo'shadi.

---

## 2. CHAQIRISH FORMATI

### 2.1 POST (asosiy usul — barcha yozish va katta o'qishlar)

```http
POST <GAS_URL>
Content-Type: text/plain     ← MUHIM! application/json QILMANG
```

```json
{ "__api": 1, "token": "...", "fn": "apiHolatOl", "args": ["Suniy_Kol"] }
```

> **Nima uchun `text/plain`?** Apps Script `OPTIONS` preflight so'rovini
> qo'llab-quvvatlamaydi. `application/json` brauzerda preflight keltirib
> chiqaradi → CORS xatosi. `text/plain` — "simple request", preflight yo'q.
> (Cloudflare Function'dan chaqirsangiz CORS umuman qo'llanilmaydi, lekin
> qoidani baribir saqlang.)

### 2.2 GET (kichik, keshlanadigan o'qishlar)

```
<GAS_URL>?action=api2&token=...&fn=apiWebApiSalom&args=[]
```

`args` — URL-encoded JSON massiv.

### 2.3 Javob

```json
{ "ok": true,  "fn": "apiHolatOl", "ms": 1840, "data": { ... } }
{ "ok": false, "fn": "apiHolatOl", "error": "...", "stack": "..." }
```

`ok:false` **ham HTTP 200** qaytaradi. Har doim `body.ok` ni tekshiring,
`res.status` ni emas.

### 2.4 Redirect

Apps Script `302` bilan `googleusercontent.com` ga yo'naltiradi.
`fetch` uni avtomatik kuzatadi (`redirect: 'follow'` — standart).
Faqat `manual` qilib qo'ymang.

---

## 3. CLOUDFLARE PROXY (namuna — Antigravity yozadi)

`functions/api/gas.ts`:

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

Brauzer tomonda:

```ts
export async function gas<T>(fn: string, ...args: unknown[]): Promise<T> {
  const r = await fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn, args }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'GAS xato');
  return j.data as T;
}
```

---

## 4. XAVFSIZLIK QOIDALARI (GAS tomonda majburlangan)

1. Faqat **`api`** bilan boshlanadigan funksiyalar chaqiriladi
2. `_` bilan boshlanadigan ichki funksiyalar **butunlay yopiq**
3. Qora ro'yxat: `apiHammasiniOchir`, `apiReestrTozala`, `apiKalitYoz`,
   `apiKalitOchir`, `apiSozlamaYoz`, `apiTokenYarat`
4. Noto'g'ri token → `{ok:false, error:'Нотўғри токен'}`

---

## 5. TASDIQLANGAN FUNKSIYALAR (Faza 1 uchun)

Quyidagilar kodda mavjudligi tekshirilgan.

### 5.1 Sog'liq / xizmat

| Funksiya | Arg | Qaytaradi |
|---|---|---|
| `apiWebApiSalom()` | — | `{ok, tizim, vaqt, zona, egasi, versiya}` |
| `apiWebApiFunksiyalar()` | — | `[{nom, argSoni}]` — **barcha** chaqirilishi mumkin bo'lgan funksiyalar |
| `apiWebApiLog()` | — | oxirgi 50 API chaqiruvi |

> 💡 **Birinchi ish:** `apiWebApiFunksiyalar()` ni chaqirib, natijani
> `frontend/src/api/gas-functions.json` ga saqlang va undan TypeScript
> tiplarini generatsiya qiling. Shunda 261 ta funksiya avtomat hujjatlashadi.

### 5.2 Obyektlar

| Funksiya | Arg | Izoh |
|---|---|---|
| `apiPapkaSkan()` | — | Drive'dagi barcha obyektlar ro'yxati. **Sekin (10–30 s)**, keshlang |
| `apiBossData()` | — | Dashboard: barcha obyektlar bo'yicha jamlanma |
| `apiBossObyekt(obyekt)` | `string` | Bitta obyekt bo'yicha batafsil |

### 5.3 Holat (smeta daraxti) — Faza 1 asosiy ekrani

| Funksiya | Arg | Izoh |
|---|---|---|
| `apiHolatOl(obyekt, forceRefresh)` | `string, bool?` | **To'liq daraxt.** Katta obyektda 2–5 MB, 5–20 s |
| `apiHolatOlLokalka(parent, sub, force)` | `string,string,bool?` | Ko'p smetali obyektda bitta lokalka |
| `apiF2LokalkaRoyxat(obyekt)` | `string` | Lokalkalar ro'yxati |

**⚠️ Diqqat:** `apiHolatOl` og'ir. Faza 1 da:
- birinchi yuklashda `forceRefresh=false`
- javobni `sessionStorage` ga keshlang
- skeleton ko'rsating, spinner emas

`apiHolatOl` javob tuzilishi (soddalashtirilgan):

```ts
type Node = {
  uid: string;
  tip: 'rz' | 'bl' | 'rs' | 'mat' | 'ob';   // razdel / ish / resurs / material / obor.
  nom: string;
  kod: string;
  birlik: string;
  smeta: number;      // smeta hajmi
  fakt: number;       // bajarilgan
  narx: number;
  qoldiq: number;
  f2ol: number;       // olingan F2
  f2mum: number;      // F2 ga olish mumkin
  qavat1?: string; qavat2?: string; qavat3?: string;  // ierarxiya Д1-Д3
  zamena?: boolean;   // 🔄 zamena qatori
  qoshimcha?: boolean;// ➕ qo'shimcha qatori
  children: Node[];
};
```

> Aniq maydon nomlarini `apiHolatOl('<kichik obyekt>')` ni bir marta chaqirib
> tekshiring — yuqoridagi ro'yxat qisqartma.

### 5.4 Yozish (Faza 2 — hali qilmang)

| Funksiya | Arg |
|---|---|
| `apiHolatSaqla(obyekt, edits)` | `string, Array` |
| `apiBlQosh(params)` | `object` |
| `apiRsQosh(params)` | `object` |
| `apiOyQosh(obyekt, oyNom)` | `string,string` |

### 5.5 Shartnoma / Buxgalteriya (Faza 4)

`apiShartnomaOl`, `apiShartnomaSaqla`, `apiShartnomaDashboard`,
`apiShartnomaBogOl`, `apiSkladOl(qidiruv)`

---

## 6. ISHLASH XUSUSIYATLARI — BILISH SHART

| Cheklov | Qiymat | Oqibat |
|---|---|---|
| GAS bajarilish vaqti | **6 daqiqa** | og'ir amallar navbat (job) orqali |
| Bitta chaqiruv kechikishi | **1–3 s** (bo'sh), **5–20 s** (og'ir) | UI optimistik bo'lsin |
| Parallel chaqiruv | ~30 | ketma-ket qiling, 20 ta parallel emas |
| Javob hajmi | ~50 MB gacha | lekin 5 MB dan katta bo'lsa sekin |

**Sayt tez his qilinishi uchun:**
1. Skeleton (kulrang gavda), spinner emas
2. `apiPapkaSkan` / `apiBossData` — `sessionStorage` kesh + fon yangilash
3. Yozishda optimistik UI: darhol ko'rsat, xato bo'lsa qaytar
4. Uzoq amallar (F2 yozish) — `apiF2QollaProgress()` bilan progress so'rab turing

---

## 7. ⚠️ F2 MOSLASHTIRISH MANTIQI — SAYTGA KO'CHIRILMAYDI

> Bu bo'lim Faza 3 rejasidagi jiddiy xatoni oldini oladi. **Diqqat bilan o'qing.**

### Muammo

Hozir F2 avto-moslashtirish mantiqi **brauzerda** yashaydi — `Panel.html`
ichidagi ~8000 satr JS: `_f2KodKanon`, `pickUnique`, `pickQatiy`, `pickFuzzy`,
`_ekvivmi`, `_birMos`, `_gradeFarq`, `processBl`, orphan rescue va h.k.

Sayt ikkinchi mijoz bo'lgani uchun tabiiy vasvasa: **shu 8000 satrni React'ga
ko'chirish.** Bu **XATO** bo'ladi:

- Ikki nusxa mantiq → vaqt o'tib bir-biridan uzoqlashadi
- Bitta bug ikki joyda tuzatilishi kerak → biri unutiladi
- Panelda 1466 ta moslik, saytda 1201 ta chiqadi → foydalanuvchi qaysiga ishonadi?
- Bu mantiq juda nozik sozlangan (Т↔КГ qalqoni, ПК≠ПБ farqi, razdel-doirali
  unikallik, 0.86 Dice chegarasi). Ko'chirishda **albatta** nuqsonlar kiradi

### Yechim — GAS'ga ko'chiriladi (Claude qiladi)

Moslashtirish dvigateli `Panel.html` dan olinib, GAS'da yagona funksiyaga
aylantiriladi:

```
apiF2AvtoMoslash(aktDaraxt, obyekt, opts) → { mosliklar[], dopps[], statistika }
```

Keyin **ikkala mijoz ham** shu bitta funksiyani chaqiradi:

```
Panel.html ──┐
             ├──→ apiF2AvtoMoslash()  ← YAGONA HAQIQAT MANBAI
Sayt (React)─┘
```

### Antigravity uchun amaliy xulosa

⛔ **F2 moslashtirish algoritmini yozma.** Kod solishtirish, fuzzy o'xshashlik,
birlik tekshiruvi — bularning birortasini saytda qilma.

✅ Sening ishing — **natijani ko'rsatish**: moslik darajasi nishonlari,
ishonch foizi, «bog'lash / bekor qilish» tugmalari, qo'lda tuzatish,
ikki tomonlama daraxt, sudrab tashlash (drag & drop).

Ya'ni **aql GAS'da, go'zallik saytda.**

### Bu baholashni o'zgartiradi

Faza 3 endi «8000 satr mantiqni ko'chirish» emas, «UI qurish» bo'ladi —
ya'ni **3–4 sessiya emas, 2–3 sessiya**. Va panel ham shundan foyda ko'radi:
`Panel.html` yengillashadi.

### ✅ 2026-07-29 — TAYYOR. Faza 3 ni boshlash mumkin.

Fayl: `Smeta tizimi/35_F2Moslash.js` (server'ga push qilingan).

```ts
apiF2AvtoMoslash(
  aktTree: AktNode[],      // apiF2FaylOqi natijasi
  obyekt: string,
  opts?: { lokalka?: string }   // '' yoki 'AVTO' → tizim o'zi aniqlaydi
): {
  mosliklar: Array<{
    uid: string;     // akt tugunining uid'i
    varaq: string;   // LRV varaq ("sub||varaq" bo'lishi mumkin)
    row: number;     // LRV qatori
    kod: string; hajm: number; narx: number; summa: number;
  }>;
  sabablar: Record<string, string>;   // uid → nega topilmadi (matn)
  rzDiag: Array<{ nom: string; ok: boolean }>;   // razdel mosligi
  stat: {
    moslashti: number; otkazib: number;
    scopeHit: number;      // razdel doirasida aniq topilgan
    fuzzyHit: number;      // nom o'xshashligi bo'yicha
    kanonHit: number;      // kod-kanon orqali (ikki xil yozuv)
    birlikBlok: number;    // birlik farqli — bloklandi (Т↔КГ)
    zamenaShubha: number;  // marka farqli (ПК↔ПБ) — qo'lda
    yetimUrindi: number; yetimMos: number;   // ish topilmasa bolalari
    lokalka: string; lokAuto: boolean;
    rzMos: number; rzJami: number;
    ms: number;
  };
}
```

**UI uchun muhim:**
- `sabablar[uid]` — har bog'lanmagan qator ostida **ko'rsatilsin**. Bu
  foydalanuvchining eng katta shikoyati edi («nega bog'lanmagani ko'rinmaydi»)
- `stat.birlikBlok` va `stat.zamenaShubha` — bular **xato emas**, himoya.
  Ularni qizil emas, sariq «qo'lda tekshiring» ko'rinishida bering
- `rzDiag` → «🗂 Раздел мослиги: 44/47» ko'rsatkichi

⛔ **Algoritmni saytda takrorlamang.** Bu funksiya barcha himoyalarni
o'z ichiga oladi: birlik qalqoni, grade-farq, qat'iy unikallik, kod-kanon,
yetim-resurs qutqarish, razdel doirasi.

---

## 8. NIMA UCHUN GET EMAS, POST

Ba'zi maslahatlarda `?fn=apiHolatOl` ko'rinishidagi GET proxy taklif qilinadi.
Kichik o'qishlar uchun **maqbul**, lekin asosiy usul sifatida **yaramaydi**:

| Sabab | Tafsilot |
|---|---|
| URL uzunligi | F2 saqlash `edits` massivi 500 KB gacha — URL'ga sig'maydi (~8 KB limit) |
| Token ko'rinishi | GET manzillari brauzer tarixida, proxy loglarida qoladi |
| Keshlash | Oraliq keshlar GET javobini saqlab qolishi mumkin → eski ma'lumot |

**Qoida:** o'qish uchun GET ham POST ham mumkin, **yozish faqat POST**.
Sodda bo'lishi uchun hamma joyda POST ishlating.

---

## 9. O'ZGARISHLAR TARIXI

| Sana | Versiya | Nima |
|---|---|---|
| 2026-07-28 | 1 | Birinchi shartnoma. `79_WebAPI.js`, `doGet?action=api2`, `doPost{__api:1}` |
| 2026-07-28 | 1.1 | 7-bo'lim: F2 moslashtirish saytga ko'chirilmaydi → `apiF2AvtoMoslash` GAS'da. 8-bo'lim: POST majburiyligi |

---

## 10. ⚠️ 2026-07-29 KASHFIYOT — panelda IKKI HIMOYA O'LIK EDI

Dvigatelni serverga ko'chirishda topildi. `Panel.html` da:

```js
function _tokenlar(s){
   s=_f2NormNom(s).replace(/[.,;:()\/\-]+/g,' ');
   return s.split(/\s+/).filter(function(t){ return t.length>=2; });
}
```

Lekin `_f2NormNom` **probellarni ham** olib tashlaydi (`[^0-9А-Я]`). Ya'ni
`split(/\s+/)` bo'linadigan narsa topmaydi — natija **doim bitta uzun token**:

```
«БЕТОН М300 ТЯЖЕЛЫЙ»  →  ["БЕТОНМ300ТЯЖЕЛЫЙ"]     ← 1 ta token
```

Oqibati:

| Himoya | Nima bo'lgan |
|---|---|
| **FUZZY** (nom o'xshashligi) | `if(ftok.length<2) return null` → **hech qachon ishlamagan** |
| **GRADE-FARQ** (ПК↔ПБ) | 2-3 harfli marka topilmagan → **hech qachon ishlamagan** |

Ya'ni foydalanuvchi maxsus so'ragan «ПК плита лойиҳада, биз ПБ ишлатдик —
тизим сезмасдан боғлаб юборади» himoyasi **kodda bor, lekin ishlamagan**.

Server versiyasida tuzatildi: avval xom matn so'zlarga bo'linadi, keyin
har so'z alohida normallashtiriladi:

```
«БЕТОН М300 ТЯЖЕЛЫЙ»  →  ["БЕТОН","М300","ТЯЖЕЛЫЙ"]
```

`f2MoslashSelfTest()` da isbotlangan (18/18): ПК↔ПБ endi **bog'lanmaydi**.

> ⚠️ **Oqibat:** server natijasi paneldan **farq qilishi mumkin** — ba'zi
> mosliklar qo'shiladi (fuzzy tirildi), ba'zilari olib tashlanadi (grade-farq
> tirildi). Ikkinchisi — **xavfsizlik yaxshilanishi**. Haqiqiy akt bilan
> solishtirish `GAS/_f2lab` stendida qilinadi.
