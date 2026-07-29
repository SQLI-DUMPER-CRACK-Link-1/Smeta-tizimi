# 🌉 KO'PRIK — Claude ↔ Antigravity parallel ish qoidalari

> **Yaratildi:** 2026-07-28 · **Muallif:** Claude (arxitektor)
> **Maqsad:** ikki AI bir vaqtda, bir-birini buzmasdan ishlashi.

---

## 1. ASOSIY TAMOYIL — PAPKA BO'YICHA EGALIK

Konflikt bo'lmasligining yagona ishonchli usuli: **hech qachon bir faylga ikkovimiz tegmaymiz.**

| Papka / fayl | Egasi | Ikkinchisi nima qiladi |
|---|---|---|
| `Smeta tizimi/*.js` | **CLAUDE** | Antigravity **O'QIYDI**, yozmaydi |
| `Smeta tizimi/*.html` | **CLAUDE** | Antigravity **O'QIYDI**, yozmaydi |
| `frontend/**` | **ANTIGRAVITY** | Claude **O'QIYDI**, yozmaydi |
| `KOPRIK/*.md` | **CLAUDE** yozadi | Antigravity o'qiydi |
| `KOPRIK/JAVOB_*.md` | **ANTIGRAVITY** yozadi | Claude o'qiydi |

`.claspignore` da `frontend/**` allaqachon istisno qilingan — ya'ni sayt kodi
hech qachon Google Apps Script'ga yuborilmaydi. Bo'linish **texnik jihatdan
kafolatlangan**.

### ⛔ ANTIGRAVITY UCHUN QAT'IY MAN ETILADI

1. `Smeta tizimi/` ichidagi **hech qanday** faylni o'zgartirish
2. `clasp push`, `clasp deploy` — GAS'ga deploy **faqat Claude** qiladi
3. Google Sheets tuzilishini o'zgartirish (ustun qo'shish/o'chirish)
4. Yangi `api*` funksiya yozish — kerak bo'lsa **so'raladi** (5-bo'limga qara)

### ⛔ CLAUDE UCHUN QAT'IY MAN ETILADI

1. `frontend/` ichidagi faylni tahrirlash
2. Antigravity kelishilgan API shartnomasini **ogohlantirmasdan** o'zgartirish

---

## 2. ALOQA PROTOKOLI (fayl orqali)

Ikkovimiz bir-birimizni ko'rmaymiz. Aloqa faqat `KOPRIK/` papkasidagi fayllar orqali:

```
KOPRIK/
├── 00_QOIDA.md              ← shu fayl (Claude yozadi)
├── 01_API_SHARTNOMA.md      ← API kontrakti (Claude yozadi) ⭐ ENG MUHIM
├── 02_TOPSHIRIQ_FAZA1.md    ← joriy topshiriq (Claude yozadi)
├── JAVOB_HOLAT.md           ← Antigravity: nima bajarildi
└── JAVOB_SAVOL.md           ← Antigravity: Claude'ga savollar / blokerlar
```

### Antigravity ish tugatgach `JAVOB_HOLAT.md` ga yozadi:

```markdown
## 2026-07-29 — FAZA 1
- [x] Vite+React skelet qurildi
- [x] /api/gas proxy ishladi (apiWebApiSalom → ok:true)
- [ ] Ҳолат daraxti — apiHolatOl javobi 4 MB, sekin (BLOKER)

### Bloker
apiHolatOl butun daraxtni bitta JSON qilib qaytaryapti (4 MB, 9 soniya).
Sahifalash (pagination) kerakmi yoki keshlash?
```

### Claude javobni `01_API_SHARTNOMA.md` ga qo'shadi va yangi endpoint yozadi.

---

## 3. API — YAGONA ALOQA NUQTASI

Sayt **hech qachon** Google Sheets'ga to'g'ridan-to'g'ri tegmaydi.
Faqat GAS Web API orqali:

```
  Brauzer
     │  POST /api/gas   {fn, args}
     ▼
  Cloudflare Pages Function     ← TOKEN shu yerda, brauzerda EMAS
     │  POST <gas_url>  {__api:1, token, fn, args}
     ▼
  79_WebAPI.js → webApiIshlov()   ← CLAUDE egalik qiladi
     │
     ▼
  261 ta mavjud api* funksiya     ← O'ZGARMAYDI
     ▼
  Google Sheets / Drive
```

**Sabab:** butun biznes-mantiq (F2 moslashtirish, накрутка, ierarxiya,
zamena tarixi, СВОДКА narxlash) GAS ichida. Uni qaytadan yozish = tizimni
o'ldirish. Sayt faqat **yuz**, mantiq emas.

---

## 4. O'ZGARISH TARTIBI (kim nimani buzishi mumkin)

| Vaziyat | Kim hal qiladi |
|---|---|
| Saytda tugma ishlamayapti | Antigravity |
| Sayt dizayni | Antigravity |
| `apiHolatOl` noto'g'ri son qaytardi | **Claude** |
| Yangi api funksiya kerak | Claude yozadi, Antigravity chaqiradi |
| Javob formati o'zgarishi kerak | Claude — `01_API_SHARTNOMA.md` yangilanadi |
| GAS deploy | **faqat Claude** |
| Cloudflare deploy | **faqat Antigravity** |

---

## 5. YANGI API FUNKSIYA SO'RASH

Antigravity `JAVOB_SAVOL.md` ga shu shaklda yozadi:

```markdown
### SO'ROV: apiObyektQisqa
**Nima uchun:** bosh sahifada 40 ta obyekt kartasi kerak, lekin
apiPapkaSkan() 2 MB qaytaryapti — faqat nom+summa+holat yetarli.
**Kutilayotgan javob:**
[{ nom, jamiSmeta, fakt, f2, holat }]
```

Claude buni GAS'da yozadi, deploy qiladi va `01_API_SHARTNOMA.md` ga qo'shadi.

**Antigravity o'zi GAS'ga funksiya yozmaydi** — chunki u Sheets ustun
raqamlarini, `_subObyektlar` mantiqini, накрутка koeffitsientini bilmaydi.
U yerda bitta xato = butun hisobot noto'g'ri.

---

## 6. GIT TARTIBI

- Antigravity: `frontend/` o'zgarishlarini **alohida commit** qiladi,
  xabar boshida `[FE]` — masalan `[FE] Ҳолат даraxti компоненти`
- Claude: GAS o'zgarishlarini `[GAS]` bilan
- Bitta commit ichida ikkala papka **bo'lmaydi**

Konflikt chiqsa — demak qoida buzilgan, `JAVOB_SAVOL.md` ga yoziladi.

---

## 7. HOZIRGI HOLAT

| Narsa | Holat |
|---|---|
| `79_WebAPI.js` (API darcha) | ✅ Claude yozdi, deploy kutmoqda |
| `doGet` / `doPost` ulash | ✅ yozildi |
| Token | ⏳ `webApiTokenYarat()` ishga tushirilishi kerak |
| `frontend/` | ⬜ Antigravity boshlaydi |
| Cloudflare Pages | ⬜ foydalanuvchi akkaunt ochadi |

Keyingi qadam: **`02_TOPSHIRIQ_FAZA1.md`** — Antigravity shundan boshlaydi.
