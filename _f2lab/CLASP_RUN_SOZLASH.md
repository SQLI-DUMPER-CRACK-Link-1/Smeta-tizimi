# `clasp run` sozlash — BIR MARTALIK (~5 daqiqa)

Buni bir marta qilsangiz, dasturchi (AI) server funksiyalarini **to'g'ridan-to'g'ri
terminaldan ishga tushirib, jonli natijani o'zi ko'ra oladi.
Ya'ni: `deploy → siz sinaysiz → xabar berasiz` halqasi **butunlay yo'qoladi**.

Kod tomonida hammasi tayyor (`appsscript.json` → `executionApi.access = MYSELF` qo'shildi).
Qolgani — Google tomonidagi ruxsat.

---

## 1-qadam: Apps Script loyihasini GCP proyektga bog'lash

1. Apps Script muharririni ochingiz:
   https://script.google.com/home/projects/1fcGIysmTyIy2J-etZrVnxRMCzqbwACdlWfRhXc9ERT3r7fyCi6-98B6h/settings
2. **Google Cloud Platform (GCP) Project** bo'limini toping
3. Loyiha raqami (**Project number**) yozilganini tekshiring.
   - Agar "default project" bo'lsa → **Change project** bosing
   - https://console.cloud.google.com/ da yangi proyekt yarating (masalan `smeta-tizimi`)
   - Uning **Project number** ini ko'chirib, Apps Script sozlamasiga qo'ying

## 2-qadam: Apps Script API ni yoqish — IKKI JOYDA!

**2a) Foydalanuvchi darajasida:**
https://script.google.com/home/usersettings → **Google Apps Script API** → **ON**

**2b) GCP PROYEKT darajasida (BUNI O'TKAZIB YUBORSA `clasp push` HAM ISHLAMAYDI!):**
https://console.developers.google.com/apis/api/script.googleapis.com/overview?project=117465515912
→ **ENABLE** tugmasi

⚠️ Agar `clasp login --creds` qilingandan keyin `clasp push` quyidagi xato bersa:
> *Apps Script API has not been used in project 117465515912 before or it is disabled*

— demak aynan **2b** bajarilmagan. Yuqoridagi havolaga kirib ENABLE bosingiz
(1-2 daqiqa tarqalishini kutingiz), keyin push qaytadan ishlaydi.

**Tezkor orqaga qaytish (agar kerak bo'lsa):** `clasp login` (creds'siz) — clasp
o'zining standart kalitiga qaytadi, push darhol ishlaydi, lekin `clasp run` o'chadi.

## 3-qadam: OAuth mijoz kaliti (client secret)

1. https://console.cloud.google.com/apis/credentials (yuqorida yaratgan proyektni tanlang)
2. **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Agar so'rasa: **OAuth consent screen** → *External* → nom/email kiriting → Save
4. **Application type: Desktop app** → nom: `clasp` → **CREATE**
5. **DOWNLOAD JSON** bosing
6. Yuklangan faylni shu nom bilan saqlang:
   ```
   C:\Users\PC\Documents\GAS\_f2lab\creds.json
   ```

## ⚠️ 3b-qadam: TEST FOYDALANUVCHI qo'shish (BU QADAM MAJBURIY!)

Agar `clasp login` da quyidagi xato chiqsa:

> **Access blocked: Smeta tizimi has not completed the Google verification process**
> **Error 403: access_denied**

— demak OAuth ekrani "Testing" rejimida va hali hech kimga ruxsat berilmagan.
Yechim (o'zingizni ruxsat etilganlar ro'yxatiga qo'shish):

1. https://console.cloud.google.com/auth/audience
   (yoki: **APIs & Services → OAuth consent screen → Audience**)
2. Pastda **Test users** bo'limini toping
3. **+ ADD USERS** bosing
4. `anvar.ahatqulov@gmail.com` ni kiriting → **SAVE**
5. `clasp login --creds ...` ni **QAYTA** ishga tushiring

### Muhim eslatma: 7 kunlik cheklov

"Testing" rejimida Google **refresh token'ni 7 kundan keyin bekor qiladi** —
ya'ni haftada bir marta `clasp login --creds ...` ni qayta bajarish kerak bo'ladi.

Buni butunlay yo'q qilish uchun (ixtiyoriy):
1. https://console.cloud.google.com/auth/audience
2. **PUBLISH APP** → **Publishing status: In production** ga o'tkazing
3. Keyin kirishda "Google hasn't verified this app" ogohlantirishi chiqadi →
   **Advanced** → **Go to Smeta tizimi (unsafe)** → davom etasiz
   (bu o'zingizning shaxsiy loyihangiz, xavf yo'q — faqat siz ishlatasiz)

Shundan keyin token muddatsiz bo'ladi.

## 4-qadam: clasp ga kirish

Terminalda:
```bash
cd "C:/Users/PC/Documents/GAS/Smeta tizimi"
clasp login --creds "C:/Users/PC/Documents/GAS/_f2lab/creds.json"
```
Brauzer ochiladi → ruxsat bering.

## 5-qadam: Sinov

```bash
cd "C:/Users/PC/Documents/GAS/Smeta tizimi"
clasp run apiTolaDiagnostika
```

Agar JSON natija chiqsa — **tayyor**. Endi dasturchi istalgan funksiyani
(masalan `apiXarajatOl`, `apiHolatOl`, `apiF2FaylOqi`) o'zi ishga tushirib,
natijani darhol ko'radi va tuzatadi.

---

## Xavfsizlik

- `executionApi.access = MYSELF` → **faqat siz** (loyiha egasi) ishga tushira olasiz
- `creds.json` va `~/.clasprc.json` — maxfiy fayllar, git'ga tushmasligi kerak
- Bu web-app (Panel/Boss) ishlashiga **hech qanday ta'sir qilmaydi**

## Muhim afzallik

`clasp run` **HEAD** (oxirgi push qilingan) kodni ishga tushiradi — ya'ni
`clasp deploy` ham shart emas. `push → run → natija` = soniyalar.
