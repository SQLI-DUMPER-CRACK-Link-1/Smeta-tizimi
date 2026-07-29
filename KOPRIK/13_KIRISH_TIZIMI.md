# 🔐 KIRISH TIZIMI — Google orqali + foydalanuvchilar

> **Claude · 2026-07-28**
> Hozirgi «bitta umumiy parol» tizimini almashtiradi.

---

## 1. 🔴 AVVAL — hozirgi kirishdagi nuqson

`functions/_shared/auth.ts` da:

```ts
export async function imzola(rol: string, secret: string) {
  const data = new TextEncoder().encode(rol);   // ← faqat ROL imzolanadi
  ...
  return `${rol}.${sigHex}`;
}
```

Imzo faqat `"admin"` yoki `"boss"` satridan hisoblanadi. Ya'ni:

- **Butun tizimda atigi 2 ta mumkin bo'lgan token bor** — biri admin, biri boss
- Token **hech qachon eskirmaydi**. `Max-Age=43200` faqat brauzerga ishora;
  token qiymatining o'zida muddat yo'q
- Kimdir cookie'ni bir marta nusxa olsa — **abadiy kira oladi**
- Bitta sessiyani bekor qilib bo'lmaydi. `SESSIYA_KALIT` ni o'zgartirish esa
  **hammani** chiqarib yuboradi

### Tuzatish — imzoga muddat va tasodifiy qism qo'shiladi

```ts
type Sess = { rol: 'admin'|'boss'; email: string; exp: number; jti: string };

export async function imzola(s: Omit<Sess,'exp'|'jti'>, secret: string) {
  const payload: Sess = {
    ...s,
    exp: Date.now() + 12 * 3600_000,          // 12 soat
    jti: crypto.randomUUID(),                  // har sessiya noyob
  };
  const body = btoa(JSON.stringify(payload)).replace(/=+$/,'');
  const sig  = await hmacHex(body, secret);
  return `${body}.${sig}`;
}

export async function tekshir(cookie: string|null, secret: string) {
  const t = cookie?.match(/sess=([^;]+)/)?.[1];
  if (!t) return null;
  const [body, sig] = t.split('.');
  if (!body || !sig) return null;

  const kutilgan = await hmacHex(body, secret);
  if (!teng(sig, kutilgan)) return null;        // vaqt-barqaror solishtirish

  let s: Sess;
  try { s = JSON.parse(atob(body)); } catch { return null; }
  if (!s.exp || Date.now() > s.exp) return null; // MUDDAT tekshiruvi
  return s;
}

/** Vaqt-barqaror solishtirish — sirni uzunlik bo'yicha topib bo'lmasin */
function teng(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
```

Endi token 12 soatdan keyin **o'z-o'zidan** ishlamay qoladi va har sessiya noyob.

---

## 2. NIMA UCHUN GOOGLE ORQALI KIRISH — bu holatda eng to'g'ri

| Umumiy parol | Google orqali |
|---|---|
| Hamma bir xil parolni biladi | Har kim o'z akkaunti bilan |
| Kim o'zgartirganini **bilib bo'lmaydi** | Har amal **kim tomonidan** — ma'lum |
| Xodim ketsa — parolni hammaga almashtirasan | Bitta emailni ro'yxatdan chiqarasan |
| Parol Telegram'da yuboriladi, tarqaydi | Yuboriladigan sir yo'q |
| Parolni saqlash, tiklash — bosh og'riq | Google hal qiladi |

Va eng muhimi: **ma'lumotlaring allaqachon Google'da.** Smeta fayllari
Drive'da, tizim Apps Script'da. Har xodimning Google akkaunti bor. Alohida
parol tizimi qurish — ortiqcha qatlam.

### ⭐ Qo'shimcha yutuq — kim nima qilgani yoziladi

Google orqali kirilsa, sayt **kim ekanini biladi**. Shundan keyin har yozuvga
email qo'shib yuborish mumkin:

```
🔄 ЗАМЕНА
«Гравийно-песчаная смесь» ЎРНИГА → «Қазиш ишлари»
Сана: 28.07.2026 · Ким: anvar.ahatqulov@gmail.com
```

Hozir `_ЗАМЕНА_ТАРИХ` varag'ida «kim» ustuni bor, lekin **umumiy parol
bilan uni to'ldirib bo'lmaydi** — hamma bir xil. Google kirishi buni ochadi.

---

## 3. TEXNIK YECHIM — server tomonda OAuth

**Google'ning JS kutubxonasi ishlatilmaydi.** Sof server-tomon yo'naltirish
oqimi — ishonchliroq, tashqi skript yuklanmaydi, brauzerda hech qanday sir yo'q.

```
1. Foydalanuvchi «Google orqali кириш» bosadi
        ↓
2. /api/auth/google  →  accounts.google.com ga yo'naltiradi
        ↓
3. Foydalanuvchi Google'da tanlaydi/kiradi
        ↓
4. Google  →  /api/auth/google/callback?code=...
        ↓
5. Pages Function code'ni token'ga almashtiradi (server↔server)
        ↓
6. id_token'dan email olinadi va TEKSHIRILADI
        ↓
7. Email ruxsat ro'yxatida bormi? → rol aniqlanadi
        ↓
8. O'z sessiya cookie'imiz qo'yiladi (1-bo'limdagi imzo bilan)
```

### 3.1 Ruxsat ro'yxati — muhit o'zgaruvchisida

Cloudflare → Variables and Secrets:

```
RUXSAT = anvar.ahatqulov@gmail.com:admin,rais@example.com:boss,prorab@example.com:admin
```

Ro'yxatda yo'q email — kirolmaydi. Xodim ketsa: emailni olib tashlaysan,
qayta deploy — tamom. Parol almashtirish shart emas.

### 3.2 `functions/api/auth/google.ts`

```ts
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const state = crypto.randomUUID();          // CSRF himoyasi

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', ctx.env.GOOGLE_CLIENT_ID);
  auth.searchParams.set('redirect_uri', `${url.origin}/api/auth/google/callback`);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'openid email profile');
  auth.searchParams.set('state', state);
  auth.searchParams.set('prompt', 'select_account');

  return new Response(null, {
    status: 302,
    headers: {
      Location: auth.toString(),
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
};
```

### 3.3 `functions/api/auth/google/callback.ts`

```ts
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // CSRF: qaytgan state cookie'dagi bilan bir xilmi?
  const kutilgan = ctx.request.headers.get('Cookie')?.match(/oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== kutilgan) {
    return Response.redirect(`${url.origin}/?xato=state`, 302);
  }

  // code → token (server↔server, sir brauzerga chiqmaydi)
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: ctx.env.GOOGLE_CLIENT_ID,
      client_secret: ctx.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const tok = await tr.json<{ id_token?: string }>();
  if (!tok.id_token) return Response.redirect(`${url.origin}/?xato=token`, 302);

  // id_token ni Google'ning o'zida tekshiramiz (imzoni qo'lda tekshirmaymiz)
  const vr = await fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + tok.id_token);
  const info = await vr.json<{ email?: string; email_verified?: string; aud?: string }>();

  if (!info.email || info.email_verified !== 'true' ||
      info.aud !== ctx.env.GOOGLE_CLIENT_ID) {
    return Response.redirect(`${url.origin}/?xato=tekshiruv`, 302);
  }

  // Ruxsat ro'yxati
  const email = info.email.toLowerCase();
  const xarita = new Map(
    ctx.env.RUXSAT.split(',').map(p => {
      const [e, r] = p.trim().split(':');
      return [e.toLowerCase(), r] as const;
    })
  );
  const rol = xarita.get(email);
  if (rol !== 'admin' && rol !== 'boss') {
    return Response.redirect(`${url.origin}/?xato=ruxsat`, 302);
  }

  const sess = await imzola({ rol, email }, ctx.env.SESSIYA_KALIT);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/${rol}`,
      'Set-Cookie':
        `sess=${sess}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`,
    },
  });
};
```

> ⚠️ `SameSite=Strict` **ishlamaydi** — Google'dan qaytishda cookie yuborilmaydi.
> OAuth uchun `Lax` to'g'ri va xavfsiz.

### 3.4 Parol — zaxira sifatida qoladi

Google akkaunti yo'q xodim uchun mavjud `/api/kirish` saqlanadi. Kirish
ekranida:

```
      [  🔵  Google орқали кириш  ]      ← asosiy, katta

      ─────────  ёки  ─────────

      [ парол ]           [ Кириш ]      ← kichik, ikkilamchi
```

---

## 4. FOYDALANUVCHI QILADIGAN ISH (Anvar) — ~10 daqiqa

### 4.1 Google Cloud'da OAuth kaliti yaratish

1. **https://console.cloud.google.com** → yuqorida loyihani tanla
   (Apps Script loyihang bor bo'lsa — **o'shani ishlat**, yangi kerak emas)
2. Chapda: **APIs & Services → OAuth consent screen**
   - User Type: **External** → Create
   - App name: `Smeta tizimi`
   - User support email: o'zingniki
   - Developer contact: o'zingniki → **Save and Continue**
   - Scopes: hech narsa qo'shma → Save and Continue
   - **Test users** → `+ ADD USERS` → **saytga kiradigan hamma emailni yoz**
     → Save
3. **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**
   - Application type: **Web application**
   - Name: `Smeta sayt`
   - **Authorized redirect URIs** → ADD URI:
     ```
     https://smeta-tizimi.pages.dev/api/auth/google/callback
     ```
   - CREATE
4. Chiqqan **Client ID** va **Client secret** ni ko'chirib ol

### 4.2 Cloudflare'ga yozish

Settings → Variables and Secrets:

| Nom | Qiymat | Tur |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | Text |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | **Secret** 🔒 |
| `RUXSAT` | `email:rol,email:rol,...` | Text |
| `SESSIYA_KALIT` | uzun tasodifiy satr | **Secret** 🔒 |

**Production va Preview — ikkalasiga ham.**

### 4.3 ⚠️ «Access blocked» xatosi haqida — oldindan biling

Ilgari `clasp` bilan shu xatoga duch kelgansan:

> *Access blocked: Smeta tizimi has not completed the Google verification process*

**Bu safar chiqmaydi**, agar 4.1-bo'limning 2-qadamida emailni **Test users**
ro'yxatiga qo'shsang. Testing rejimida 100 tagacha foydalanuvchi mumkin —
bizga yetarli. Google tekshiruvidan o'tish **shart emas**.

Agar kimdir «Access blocked» ko'rsa — sababi bitta: uning emaili Test users
ro'yxatida yo'q.

---

## 5. ROLLAR VA HUQUQLAR

| | Admin | Rahbar |
|---|---|---|
| Ko'rish | hammasi | hammasi |
| Smeta tahriri | ✅ | ⛔ |
| Ф2 import/yozish | ✅ | ⛔ |
| Shartnoma o'zgartirish | ✅ | ⛔ |
| Sozlamalar | ✅ | ⛔ |

Rahbarning yoza olmasligi **`functions/api/gas.ts` da, serverda** majburlanadi
(`11_ARXITEKTURA_V2.md` §2). Brauzerda tugmani yashirish — qulaylik, himoya emas.

---

## 6. AUDIT — kim nima qilgani

Sessiyada email bor. `/api/gas` uni GAS'ga uzatsin:

```ts
body: JSON.stringify({
  __api: 1, token: ctx.env.GAS_TOKEN, fn, args,
  kim: sess.email,                    // ← qo'shiladi
})
```

Claude GAS tomonida `webApiIshlov` ni shunga moslashtiradi va `kim` ni
`_ЗАМЕНА_ТАРИХ` hamda yozuv izohlariga qo'shadi.

> Antigravity: `kim` ni **faqat yuboring**. GAS tomonidagi qabul qilish
> Claude'ning ishi — `JAVOB_HOLAT.md` ga «kim yuborilmoqda» deb yozing.

---

## 7. QABUL MEZONLARI

```
[ ] auth.ts: imzoda exp + jti bor, muddat tekshiriladi
[ ] Vaqt-barqaror solishtirish (teng())
[ ] /api/auth/google → Google'ga yo'naltiradi
[ ] callback: state (CSRF) tekshiriladi
[ ] id_token tekshiriladi, aud == GOOGLE_CLIENT_ID
[ ] email_verified === 'true' shart
[ ] RUXSAT ro'yxatida yo'q email — kirolmaydi (sinaldi)
[ ] Sessiya cookie: HttpOnly + Secure + SameSite=Lax
[ ] Parol bilan kirish zaxira sifatida ishlaydi
[ ] Rahbar rolida yozuvchi funksiya 403 (SERVERDA sinaldi)
[ ] 12 soatdan keyin sessiya tugaydi
[ ] «Чиқиш» tugmasi cookie'ni o'chiradi
[ ] npm run build xatosiz
[ ] PUSH QILINDI  ← oxirgi 3 commit hali push qilinmagan!
```

### Sinov

```bash
# Sessiyasiz — 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://smeta-tizimi.pages.dev/api/gas \
  -H "Content-Type: application/json" -d '{"fn":"apiBossData","args":[]}'

# Buzilgan cookie bilan — 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://smeta-tizimi.pages.dev/api/gas \
  -H "Cookie: sess=admin.soxta" -H "Content-Type: application/json" \
  -d '{"fn":"apiBossData","args":[]}'
```
