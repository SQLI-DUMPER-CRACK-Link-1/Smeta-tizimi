# 🧭 QO'LLANMA — GitHub + Cloudflare ulash (Anvar uchun)

> Bu qo'llanma **sen uchun**, dasturchi uchun emas. Har qadam alohida yozilgan.
> Jami vaqt: **~25 daqiqa**. Narx: **$0**.

---

## ✅ ALLAQACHON TAYYOR (hech narsa qilish shart emas)

Tekshirdim, bular joyida:

| Narsa | Holat |
|---|---|
| GitHub akkaunt | ✅ `SQLI-DUMPER-CRACK-Link-1` |
| GitHub repo | ✅ `Smeta-tizimi` |
| Repo **yopiq** (private) | ✅ — kodni hech kim ko'rmaydi |
| Node.js | ✅ v20.19.2 |
| GAS API darcha | ✅ deploy qilindi (@215 / @216) |

Ya'ni **1-qadamni o'tkazib yuborasan** — GitHub allaqachon bor.

---

## 1️⃣ QADAM — GAS TOKENINI YARATISH (5 daqiqa)

Bu token saytga «men haqiqiy egaman» deb aytishga xizmat qiladi.

### Nima qilasan:

1. Smeta jadvalingni ochasan (Google Sheets)
2. Yuqorida: **Кенгайтмалар** (Extensions) → **Apps Script**
3. Yangi oyna ochiladi — bu kod redaktori
4. Yuqorida funksiya tanlash ro'yxati bor (odatda `myFunction` yozilgan).
   Uni bosib, ro'yxatdan **`webApiTokenYarat`** ni tanlaysan
5. Yonidagi **▶ Ишга тушириш** (Run) tugmasini bosasan
6. Ruxsat so'rasa — **Разрешить** (Allow)

### Natija:

Ekranda oyna chiqadi, ichida uzun matn:

```
a3f9c2e1b8d74a6f0c5e9b2d8a1f7c3e6b4d9a2f5c8e1b7d0a3f6c9e2b5d8a1f4c7e0b3
```

**Buni ko'chirib olasan va xavfsiz joyga saqlaysan** (Bloknot, telefon,
parol menejeri — qayerga qulay bo'lsa).

Agar oyna chiqmasa: pastda **Логлар** (Execution log) bo'limida ham yozilgan bo'ladi.

> ⚠️ Bu tokenni **hech kimga yuborma**, menga ham. Chatga ham tashlama.
> Kimda token bo'lsa — sening smetalaringga yoza oladi.

> 🔄 Agar token qandaydir yo'l bilan boshqaga o'tib qolsa —
> `webApiTokenYarat()` ni qayta ishga tushirasan, eskisi darhol o'lik bo'ladi.

---

## 2️⃣ QADAM — WEB APP MANZILINI OLISH (2 daqiqa)

Saytga GAS'ning manzili kerak.

1. Apps Script oynasida yuqori o'ng burchakda **Деплой** (Deploy) →
   **Деплойларни бошқариш** (Manage deployments)
2. Ro'yxatdan birinchisini tanlaysan
3. **Веб-илова** (Web app) ostida URL bor, `.../exec` bilan tugaydi
4. Yonidagi 📋 nusxa olish belgisini bosasan

Manzil shunday ko'rinadi:

```
https://script.google.com/macros/s/AKfycbxKOoTacS.../exec
```

Buni ham saqlab qo'yasan. Bu **maxfiy emas**, lekin kerak bo'ladi.

---

## 3️⃣ QADAM — CLOUDFLARE AKKAUNT (5 daqiqa)

Cloudflare — saytimiz turadigan joy. **Butunlay tekin.**

1. Brauzerda: **https://dash.cloudflare.com/sign-up**
2. Email + parol yozasan → **Sign Up**
3. Emailingga tasdiqlash xati keladi → havolani bosasan
4. Karta so'ramaydi. So'rasa — demak noto'g'ri sahifadasan.

> **Nima uchun Cloudflare, Vercel emas?**
> Vercel'ning tekin tarifi rasmiy ravishda tijorat loyihalari uchun emas.
> Cloudflare'da bunday cheklov yo'q — biznes uchun ham tekin.

---

## 4️⃣ QADAM — GITHUB'NI CLOUDFLARE'GA ULASH (5 daqiqa)

> ⏸️ **BU QADAMNI ANTIGRAVITY `frontend/` PAPKASINI YARATIB, GITHUB'GA
> YUBORGANDAN KEYIN QILASAN.** Hozir qilsang, Cloudflare «papka topilmadi»
> deydi. Antigravity tayyor bo'lganini aytsa — shu qadamga qaytasan.

1. Cloudflare panelida chapda: **Workers & Pages**
2. **Create** tugmasi → yuqoridagi **Pages** yorlig'i
3. **Connect to Git** tugmasi
4. **GitHub** ni tanlaysan → **Authorize Cloudflare Pages**
5. GitHub «qaysi repolarga ruxsat?» deb so'raydi:
   - **Only select repositories** ni tanlaysan
   - Ro'yxatdan **`Smeta-tizimi`** ni belgilaysan
   - **Install & Authorize**
6. Cloudflare'ga qaytasan → ro'yxatdan **`Smeta-tizimi`** → **Begin setup**

### Sozlamalar oynasi — AYNAN SHUNDAY TO'LDIRASAN:

| Maydon | Qiymat |
|---|---|
| **Project name** | `smeta-tizimi` ✅ *(allaqachon yaratilgan)* |
| **Production branch** | `main` ✅ *(frontend 2026-07-28 da main ga ko'chirildi)* |
| **Framework preset** | `None` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `frontend` ← **eng muhimi, unutma!** |

> `Root directory` = `frontend` — chunki sayt kodi shu papkada.
> Buni yozmasang, Cloudflare butun GAS loyihasini qurishga urinadi va xato beradi.

**Hali «Save and Deploy» ni BOSMA** — avval 5-qadam.

---

## 5️⃣ QADAM — TOKENNI CLOUDFLARE'GA YOZISH (3 daqiqa)

Xuddi shu sozlamalar oynasida pastroq:
**Variables and Secrets** bo'limini ochasan.
(Eski Cloudflare versiyalarida bu «Environment variables (advanced)» deb atalgan —
ikkalasi ham bir narsa.)

Ikkita o'zgaruvchi qo'shasan:

| Variable name | Value | Tur |
|---|---|---|
| `GAS_URL` | 2-qadamdagi `.../exec` manzil | Text |
| `GAS_TOKEN` | 1-qadamdagi uzun token | **Secret** 🔒 |

> `GAS_TOKEN` uchun **albatta «Encrypt» / «Secret»** tugmasini bos.
> Shunda Cloudflare uni shifrlaydi va hech kim, hatto sen ham,
> keyin ko'ra olmaysan (faqat almashtirish mumkin).

Endi **Save and Deploy** ni bosasan.

2–3 daqiqa kutasan. Natijada manzil chiqadi:

```
https://smeta.pages.dev
```

---

## 6️⃣ QADAM — PREVIEW UCHUN HAM YOZISH (2 daqiqa)

Cloudflare'da ikkita muhit bor: **Production** va **Preview**.
5-qadamda faqat Production'ga yozilgan bo'lishi mumkin.

1. Loyihaga kirasan → **Settings** → **Variables and Secrets**
2. **Preview** bo'limida ham `GAS_URL` va `GAS_TOKEN` borligini tekshirasan
3. Yo'q bo'lsa — o'sha qiymatlarni qo'shasan

Sabab: Antigravity yangi funksiya sinaganda Preview manzilidan foydalanadi.
U yerda token bo'lmasa, sinash ishlamaydi.

---

## 7️⃣ QADAM — ISHLAYAPTIMI? (1 daqiqa)

### ✅ 2026-07-28 holati: SAYT ISHLAYAPTI

```
https://smeta-tizimi.pages.dev          → HTTP 200
POST /api/gas {"fn":"apiWebApiSalom"}   → ok:true, 37 ms
POST /api/gas {"fn":"apiBossData"}      → ok:true, 9.7 s, haqiqiy raqamlar
```

Ya'ni Cloudflare → proxy → GAS → Sheets zanjiri **to'liq ishlaydi**.
`localhost:5173` ni ochish **shart emas** — u faqat dasturchi uchun.

---

`https://smeta-tizimi.pages.dev` ni ochasan.

**Yaxshi belgi:** obyektlar ro'yxati yoki dashboard chiqadi.

**Yomon belgi va sabablari:**

| Ekranda | Sabab | Yechim |
|---|---|---|
| `Нотўғри токен` | Token noto'g'ri ko'chirilgan | 5-qadamni qayta qil, probel qolmasin |
| `Сервер токени созланмаган` | GAS'da token yaratilmagan | 1-qadamni qil |
| Bo'sh oq ekran | Build xatosi | Antigravity'ga ayt |
| `404 Not Found` | `Root directory` yozilmagan | Settings → Builds → `frontend` yoz |
| Uzoq aylanib turadi | GAS sekin javob beryapti | 20 soniya kut, normal |

---

## 💰 NARX — HAQIQIY RAQAMLAR

| Xizmat | Tekin chegara | Bizning ehtiyoj |
|---|---|---|
| Cloudflare Pages | Cheksiz tashrif | juda oz |
| Cloudflare Functions | **100 000 so'rov/kun** | ~2 000/kun |
| GitHub (private) | Cheksiz repo | 1 ta |
| Google Apps Script | Tekin | mavjud |
| **JAMI** | | **$0 / oy** |

Kelajakda o'z manziling kerak bo'lsa (`smeta.uz` kabi) — yiliga ~$10–12.
Majburiy emas, `smeta.pages.dev` ham to'liq ishlaydi.

---

## 🔐 XAVFSIZLIK — 4 ta oddiy qoida

1. **Token faqat Cloudflare'da.** Chatga, Telegramga, emailga tashlama
2. **Repo yopiq qolsin.** GitHub → Settings → «Change visibility» ga tegma
3. Xodimga sayt kerak bo'lsa — **saytning manzilini** ber, tokenni emas
4. Kimdir ishdan bo'shasa — `webApiTokenYarat()` ni qayta ishga tushir,
   Cloudflare'dagi `GAS_TOKEN` ni yangila. Eski hamma narsa o'lik bo'ladi

---

## 📞 ANTIGRAVITY'GA NIMA DEYSAN

Antigravity'ga ochib, aynan shuni yozasan:

```
C:\Users\PC\Documents\GAS\KOPRIK\ papkasini o'qi.

Tartib:
  1. 00_QOIDA.md          — ish qoidalari va taqiqlar
  2. 01_API_SHARTNOMA.md  — GAS API kontrakti
  3. 02_TOPSHIRIQ_FAZA1.md — sening topshirig'ing

Faqat frontend/ papkasida ishla.
"Smeta tizimi/" ichidagi hech qanday faylga TEGMA — u Claude'niki.
clasp buyruqlarini ishlatma.

02_TOPSHIRIQ_FAZA1.md ning 3-bo'limidan boshla:
avval apiWebApiSalom ulanishini isbotla, keyin davom et.
```

---

## 🗺️ UMUMIY TARTIB — QAYSI QADAM QACHON

```
HOZIR:
  [1] GAS token yarat            ← sen, 5 daq
  [2] Web App manzilini ol       ← sen, 2 daq
  [3] Cloudflare akkaunt och     ← sen, 5 daq
  [→] Antigravity'ga topshiriq ber

ANTIGRAVITY ISHLAYDI (1-2 kun):
  frontend/ papkasi quriladi va GitHub'ga yuboriladi
  ⏳ sen kutasan — Claude bu vaqtda GAS tomonida ishlaydi

ANTIGRAVITY "tayyor" DEGACH:
  [4] Cloudflare'ni GitHub'ga ula   ← sen, 5 daq
  [5] GAS_URL va GAS_TOKEN yoz      ← sen, 3 daq
  [6] Preview uchun ham yoz         ← sen, 2 daq
  [7] Saytni och va tekshir         ← sen, 1 daq
```

---

## ❓ TEZ-TEZ BERILADIGAN SAVOLLAR

**Hozirgi panel o'chadimi?**
Yo'q. Ikkalasi parallel ishlaydi. Sayt to'liq tayyor bo'lgunicha
panel asosiy vosita bo'lib qoladi. Xohlasang ikkalasini abadiy saqlaysan.

**Sayt jadvallarni buzib qo'ymaydimi?**
Yo'q. Sayt Sheets'ga **to'g'ridan-to'g'ri tegmaydi**. U mavjud
`api*` funksiyalarni chaqiradi — ya'ni panel bosganingdagi bilan
**aynan bir xil kod** ishlaydi.

**Faza 1 da yozish bo'ladimi?**
Yo'q, **faqat o'qish**. Yozish Faza 2 da, alohida sinovdan keyin.

**Internetsiz ishlaydimi?**
Yo'q — ma'lumot Google Sheets'da, internet kerak.

**Xodimlarga ko'rsatsam bo'ladimi?**
Faza 1 da hali kirish (login) yo'q — manzilni bilgan har kim ko'radi.
Kirish tizimi Faza 2 da qo'shiladi. Shu paytgacha manzilni tarqatma.
