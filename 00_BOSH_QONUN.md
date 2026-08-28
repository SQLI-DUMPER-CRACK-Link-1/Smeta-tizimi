# 00 — BOSH QONUN

> **Bu loyihaning ENG YUQORI hujjati.** Boshqa har qanday `.md` fayl bu bilan
> ziddiyatga tushsa — **bu fayl g'olib**. Kod bilan ziddiyatga tushsa — **kod
> g'olib, lekin darhol shu fayl yangilanadi**.
>
> **Muallif:** Claude · **Sana:** 2026-08-02 · **Versiya:** 1.0
> **Kimga:** Antigravity (va har qanday keyingi AI/dasturchi)

---

## 0. BU HUJJAT NEGA BOR

Loyihada ikki AI parallel ishladi (Claude — GAS backend, Antigravity —
frontend). Natijada bir necha marta **bir xil turdagi buzilish** takrorlandi:
ishlaydigan tizim ustiga soxta ma'lumot, o'lik tugma va build buzuvchi kod
qo'shildi.

Bu hujjat — shu takroriy xatolarni **qoida darajasida** to'xtatish uchun.
Har bir qoida ostida **nega** yozilgan (haqiqiy hodisa) ko'rsatilgan.
Sababini o'qimasdan qoidani o'zgartirmang.

---

## 1. ⛔ QIZIL CHIZIQLAR (buzilsa — ish BEKOR qilinadi)

### Q1. SOXTA MA'LUMOT MUTLAQO MAN ETILADI

**Hech qachon** o'ylab topilgan raqamni, nomni, sanani yoki koordinatani
haqiqiy ma'lumot sifatida ko'rsatmang. Buni quyidagi shakllarda ham qilmang:

| Man etilgan shakl | Misol |
|---|---|
| `Math.random()` bilan raqam yasash | `jamiIshchilar: Math.floor(Math.random()*50)` |
| Qotirilgan «namuna» ma'lumot | `nom: "Amfiteatr", smeta: 1200000000` |
| Haqiqiy raqamni soxta joyga qo'yish | real debitorni random koordinataga qo'yish |
| `setTimeout` bilan «yuklanish» taqlidi | `await new Promise(r => setTimeout(r, 800))` |
| Yo'q maydonni «bo'lishi kerak» deb yozish | `jamiKreditor: 12000000` (manba yo'q) |

**Nega bu qoida bor — 3 ta HAQIQIY hodisa (2026-07-30 … 07-31):**

1. `useBossData()` ichida `select` callback `Math.random()` bilan ERP
   raqamlarini **haqiqiy moliyaviy hisobotga aralashtirgan**. Sonlar har
   yangilanishda o'zgarardi — rahbar "zayavkalar 7 dan 9 ga oshdi" deb
   o'ylashi mumkin edi.
2. Keyin o'sha hook **butunlay** qotirilgan soxta ma'lumotga almashtirildi:
   `smeta: 5000000000`, ikkita o'ylab topilgan obyekt («Amfiteatr»,
   «Suniy kol»). Rahbar ko'radigan asosiy panel **100% to'qima** bo'lib qoldi.
3. Boss panelga «Obyektlar Geo-Lokatsiyasi» xaritasi qo'shildi: **haqiqiy**
   obyekt nomlari va **haqiqiy** debitor raqamlari `Math.random()`
   koordinatalarga qo'yilib, **Toshkent** atrofida ko'rsatildi — park esa
   **Navoiyda**.

Uchalasi ham o'chirildi. Bu — qurilish moliyasi tizimi; bu yerdagi raqam
asosida pul to'lanadi.

**To'g'ri yo'l — manba yo'q bo'lsa:**

```ts
// ✅ TO'G'RI: maydonni umuman qaytarmang (yoki ixtiyoriy qiling)
export type BuxDashboard = {
  kassaQoldiq: number;
  jamiKreditor?: number; // GAS'da hali manba yo'q — undefined bo'lishi mumkin
};
```

```js
// ✅ TO'G'RI: GAS tomonida izoh bilan tushuntiring
// ⚠️ "jamiKreditor" uchun tizimda HECH QANDAY MANBA YO'Q —
// shuning uchun SOXTA RAQAM QO'YILMAYDI.
```

Va UI'da bo'sh holatni **halol** ko'rsating:

```tsx
{data.ishchilar.length === 0
  ? "Hali birorta ishchi kiritilmagan — «Ishchi qo'shish» tugmasini bosing."
  : 'Qidiruvga mos ishchi topilmadi.'}
```

> **Nol — soxta raqamdan yaxshiroq.** Bo'sh jadval — o'ylab topilgan
> jadvaldan yaxshiroq.

---

### Q1-a. FRONTEND CHAQIRGAN FUNKSIYA GAS'DA BORMI? (2026-08-13)

Har `gas('apiXXX')` chaqiruvi uchun GAS'da **aynan shu nomli** funksiya
bo'lishi shart. Yo'q bo'lsa `«Функция мавжуд эмас ёки ёпиқ»` qaytadi va
tugma jimgina hech narsa qilmaydi.

Jonli auditda **3 ta** shunday nomuvofiqlik topildi:
| Frontend chaqirgan | Haqiqatda | Natija |
|---|---|---|
| `apiSmetaQatorQosh` | umuman yo'q edi | «Qator qo'shish» butunlay ishlamasdi |
| `apiStartBackgroundSync` | `apiFakturaSinxAsosiy` | fon sinxronizatsiya tugmasi o'lik |
| `apiSkladOchir` | yo'q (hook ham ishlatilmagan) | o'lik kod |

**Har ish oxirida shu auditni yuritib turing:**

```bash
cd frontend/src && grep -ohE "'api[A-Za-z0-9_]+'" api/hooks.ts \
  admin/sahifalar/*.tsx erp/sahifalar/*.tsx boss/sahifalar/*.tsx \
  | tr -d "'" | sort -u > /tmp/fe.txt
cd "../../Smeta tizimi" && grep -ohE "^function api[A-Za-z0-9_]+" *.js \
  | sed 's/function //' | sort -u > /tmp/gas.txt
comm -23 /tmp/fe.txt /tmp/gas.txt     # chiqish BO'SH bo'lishi kerak
```

> Yangi API kerak bo'lsa — mantiqni **noldan yozmang**. Avval o'xshash
> ishonchli funksiya bor-yo'qligini qidiring va **adapter** yozing.
> `apiSmetaQatorQosh` aynan shunday qilindi: u faqat argumentni tekshirib,
> sinovdan o'tgan `apiRzQosh`/`apiBlQosh`/`apiRsQosh` ga yo'naltiradi.

### Q2. O'LIK TUGMA QO'YMANG

Ko'rinadigan har bir tugma **haqiqiy ish bajarishi** shart. `onClick`siz
tugma — foydalanuvchi uchun yolg'on.

**Nega:** ERP sahifalarida «Zapravka», «Motochas», «Skladda tekshirish»,
«Tuzatildi deb belgilash» tugmalari bor edi — **hech biri hech narsa
qilmasdi**. Foydalanuvchi bosardi, hech nima bo'lmasdi.

Agar backend hali tayyor bo'lmasa — **tugmani qo'ymang**. Yoki `disabled`
qilib, sababini `title` da yozing.

---

### Q3. `npm run build` TOZA BO'LMASDAN COMMIT QILMANG

```bash
cd frontend && npm run build
```

`error TS...` bo'lsa — **commit yo'q, push yo'q**.

**Nega:** Cloudflare `tsc -b` ni ishlatadi. Bitta ishlatilmagan import
(`error TS6133`) butun saytni deploy qilmay qo'yadi. Bu sessiyada shu
sabab **5 marta** deploy yiqildi (`Filter`, `AlertTriangle`, `bugun`,
`CheckCircle`, `useNavigate`, `Cell`, `ReferenceLine`…).

Yangi kutubxona qo'shsangiz — **peer dependency**sini ham tekshiring.
`recharts` qo'shilganda `react-is` yo'qligi butun buildni yiqitgan edi.

---

### Q4. GAS'da: `push` ≠ `deploy`

```bash
cd "Smeta tizimi"
node --check 87_ErpModullar.js          # 1. sintaksis
clasp push                              # 2. kodni yuklash
clasp deploy --deploymentId AKfycbxKOoTacSJaiKd5nPqa38letjjWJUvqy6vLcqkXnM78_jPRT_HobktQNQAEl-XXK2n4aQ \
  --description "nima o'zgardi"         # 3. ⚠️ SHUSIZ SAYT ESKI KODNI KO'RADI
```

**Nega:** `clasp push` faqat `/dev` (test) URL'ni yangilaydi. Sayt
`/exec` (produksiya) ga uradi. `deploy` qilmasangiz — «hech narsa
o'zgarmadi» deysiz, lekin kod aslida yuklangan bo'ladi.

| URL | Qachon yangilanadi |
|---|---|
| `.../AKfycbxhZgAn59VJ.../dev` | `clasp push` dan **darhol** |
| `.../AKfycbxKOoTacSJa.../exec` | faqat `clasp deploy` dan keyin |

⚠️ Apps Script'da maksimum **20 ta** aktiv deployment. Limit xatosi
chiqsa — eskilarini `clasp undeploy <id>`.

#### ⚡⚡⚡ Q4-a. BITTA deployment'ni yangilash YETMAYDI (2026-08-13 topildi)

Loyihada **21 ta** deployment bor va Cloudflare'ning `GAS_URL` muhit
o'zgaruvchisi lokal `.env` dagidan **BOSHQA** ID ga ishora qilishi mumkin
(Cloudflare dashboard'dagi qiymat lokal fayl bilan sinxron emas).

Jonli tasdiq: `35_F2Moslash.js` tuzatildi → `clasp push` + bitta produksiya
ID ga `deploy` qilindi → sayt **hali eski kodni** ko'rsatdi. Faqat
**hamma** deployment yangilangandan keyin tuzatish jonli bo'ldi.

**Shuning uchun GAS o'zgarganda HAR DOIM hammasini yangilang:**

```bash
cd "Smeta tizimi"
clasp push
# yangi versiya yasab, uning raqamini olamiz:
clasp deploy --deploymentId <PRODUKSIYA_ID> --description "nima o'zgardi"
#   → chiqishda "@NNN" versiya raqami ko'rinadi

# barcha qolgan deployment'larni SHU versiyaga o'tkazamiz:
clasp deployments | grep -oE "AKfycb[A-Za-z0-9_-]+" | grep -v "<HEAD_ID>" \
  | while read id; do clasp deploy --deploymentId "$id" --versionNumber NNN \
      --description "vNNN"; done
```

**Tekshirish (majburiy):** `79_WebAPI.js` dagi `apiWebApiSalom` ichida
`versiya:` maydoni bor. Uni har deploy'da o'zgartirib, saytdan
so'rang — qaytgan qiymat siz kutgani bo'lsa, kod haqiqatan jonli.
Bu «push qildim, lekin o'zgarmadi» chalkashligini bir soniyada yechadi.

---

### Q5. FRONTEND DEPLOY ZANJIRINI TO'LIQ BAJARING

```bash
cd frontend && npm run build            # 1. toza bo'lishi SHART
cd .. && git add -A && git commit -m "..."
git fetch origin main && git push origin main
curl -s -X POST "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/ce116be6-e9c5-4132-8238-9c4b61c5566c"
```

**Nega:** GitHub App avto-deploy integratsiyasi ishonchsiz — push
qilinadi-yu, sayt yangilanmaydi. **Deploy hook majburiy.**

---

### Q6. 6 DAQIQA QOIDASI — OG'IR ISHNI SINXRON CHAQIRMANG

Google Apps Script bitta chaqiruvni **6 daqiqada** uzadi.

Barcha obyektni skanerlaydigan, LRV yozadigan yoki fayl yaratadigan
funksiyani **hech qachon** to'g'ridan-to'g'ri chaqirmang. **Navbat
(fon trigger) pattern** ishlatiladi:

```ts
// ✅ TO'G'RI
useBarchaIshla()      → apiBarchaFonIshla()   // navbatga qo'yadi, darhol qaytadi
useNavbatHolat(faol)  → apiNavbatHolat()      // har 4 soniyada holat so'raydi
useNavbatToxtat()     → apiNavbatToxtat()
```

```ts
// ❌ NOTO'G'RI — 6 daqiqada uziladi, ish yarim qoladi
gas('apiBarchaIshla')
```

Xuddi shu qoida F2 yozishga ham tegishli (`apiF2QollaNavbatga` +
`apiF2JobHolat` polling).

---

### Q7. BOSHQA AI FAYLIGA TEGMANG (kelishuvsiz)

| Papka | Egasi |
|---|---|
| `Smeta tizimi/*.js`, `*.html` | GAS backend |
| `frontend/src/**`, `frontend/functions/**` | Frontend |

Ikkalasi bir vaqtda bir faylni tahrirlasa — **ish yo'qoladi**. Bu
sessiyada `hooks.ts` va `Umumiy.tsx` **uch marta** ustma-ust yozildi
va bir marta soxta ma'lumot qaytib keldi.

Boshqa tarafning fayliga tegish kerak bo'lsa → `KOPRIK/JAVOB_SAVOL.md`
ga yozing, o'zingiz o'zgartirmang.

---

## 2. ARXITEKTURA — QATLAMLAR

```
┌──────────────────────────────────────────────────────────────┐
│  GOOGLE DRIVE — YAGONA HAQIQAT MANBAI                        │
│  Har obyekt papkasi: lokal smeta + svodka                    │
│  _SERVER_DASHBOARD: NARXLAR, ХАРАЖАТЛАР, ISHCHILAR, TABEL,   │
│                     TEXNIKA, ZAYAVKA, POSTAVSHIK, NUQSON…    │
└────────────────────────────┬─────────────────────────────────┘
                             │ SpreadsheetApp
┌────────────────────────────▼─────────────────────────────────┐
│  GAS — 45 fayl (Smeta tizimi/)                               │
│  10_Engine.js   dvigatel: narxlash, LRV_PLUS yasash          │
│  30_Panel.js    asosiy API endpointlar                       │
│  35_F2Moslash.js F2 moslashtirish (YAGONA joyi)              │
│  50_Navbat.js   fon navbati (6 daqiqa muammosi yechimi)      │
│  79_WebAPI.js   saytga ochiladigan darcha (token bilan)      │
│  85_Bux / 86_Sklad / 87_ErpModullar                          │
└────────────────────────────┬─────────────────────────────────┘
                             │ POST {__api:1, token, fn, args}
┌────────────────────────────▼─────────────────────────────────┐
│  CLOUDFLARE PAGES FUNCTIONS (frontend/functions/api/)        │
│  gas.ts      proksi + ROL TEKSHIRUVI (yozishni bloklash)     │
│  kirish.ts   login → HMAC imzolangan cookie                  │
│  sessiya.ts  joriy rol/huquqni qaytaradi                     │
└────────────────────────────┬─────────────────────────────────┘
                             │ fetch('/api/gas')
┌────────────────────────────▼─────────────────────────────────┐
│  REACT (frontend/src/) — 47 fayl                             │
│  api/client.ts  gas() — YAGONA tarmoq eshigi                 │
│  api/types.ts   GAS javob shakllari                          │
│  api/hooks.ts   TanStack Query — YAGONA ma'lumot qatlami     │
│  admin/ boss/ erp/ umumiy/                                   │
└──────────────────────────────────────────────────────────────┘
```

### Oltin qoida: **BIR YO'NALISH**

```
Sheets → GAS → Pages Function → hooks.ts → sahifa (.tsx)
```

Sahifa **hech qachon** `fetch` chaqirmaydi. Faqat `hooks.ts` dagi hook'ni
chaqiradi. `hooks.ts` faqat `gas()` ni chaqiradi. Boshqa yo'l yo'q.

---

## 3. MA'LUMOT BOG'LANISHLARI — MAJBURIY ZANJIR

Yangi ma'lumot ko'rsatmoqchi bo'lsangiz, **5 bosqichning HAMMASI**
bajarilishi shart. Bittasi tashlab ketilsa — soxta ma'lumot paydo bo'ladi.

| # | Qayerda | Nima qilinadi |
|---|---|---|
| 1 | Google Sheet | Varaq va ustunlar **haqiqatan** mavjudmi? |
| 2 | `Smeta tizimi/*.js` | `apiXXX()` funksiyasi shu varaqdan o'qiydi |
| 3 | `frontend/functions/api/gas.ts` | Yozuvchi bo'lsa — `YOZUVCHI` ro'yxatiga qo'shiladi |
| 4 | `frontend/src/api/types.ts` | Javob shakli **aynan** yoziladi |
| 5 | `frontend/src/api/hooks.ts` | `gas<Tur>('apiXXX')` — **mock EMAS** |
| 6 | `.tsx` sahifa | Faqat hook'dan o'qiydi |

**Tekshiruv savoli:** «Bu raqam qaysi Google Sheet katagidan keladi?»
Javob bera olmasangiz — **uni ko'rsatmang**.

### Bog'lanish holati (2026-08-02 — tekshirilgan)

| Sahifa | GAS funksiyasi | Holat |
|---|---|---|
| Obyektlar | `apiPapkaSkan` + `apiBossData` | ✅ real |
| Holat (smeta daraxti) | `apiHolatOl` / `apiHolatSaqla` | ✅ real |
| Ф2 импорт | `apiF2FaylOqi` → `apiF2AvtoMoslash` → `apiF2QollaNavbatga` | ✅ real |
| Ф2 тайёрлаш | `apiF2TayyorHujjatYarat` | ✅ real |
| Buxgalteriya | `apiBuxDashboard`, `apiXarajatOl` | ✅ real |
| Shartnomalar | `apiShartnomaDashboard` | ✅ real |
| Narxlar | `apiNarxlarOl` | ✅ real |
| Ierarxiya | `apiDarajalarOl` | ✅ real |
| Sklad | `apiSkladQoldiq` | ✅ real |
| Monitoring | `apiWebApiLog` | ✅ real |
| Sozlamalar | `apiSozlamaOl`, `apiNakrutkaOl`, `apiStavkaOl` | ✅ real |
| Kadrlar | `apiKadrlarDashboard` | ✅ real (varaq **bo'sh** — normal) |
| Texnika | `apiTexnikaDashboard` | ✅ real (varaq **bo'sh**) |
| Ta'minot | `apiTaminotDashboard` | ✅ real (materiallar Skladdan) |
| Sifat | `apiSifatDashboard` | ✅ real (varaq **bo'sh**) |

> ⚠️ ERP varaqlari **bo'sh** — bu **xato emas**. Ular yangi yaratildi.
> Foydalanuvchi ma'lumot kiritgach to'ladi. **Bo'shlikni «to'ldirish»
> uchun soxta ma'lumot qo'ymang** (Q1).

---

## 4. DIZAYN TIZIMI — QAT'IY

### 4.1 Ranglar — FAQAT shu tokenlar (`frontend/src/index.css`)

```css
--bg: #0B0E14;         /* asosiy fon */
--surface: #131722;    /* karta foni */
--surface-2: #1B2130;  /* ichki panel */
--border: #232A3B;     /* chegara */
--text: #E6EAF2;       /* asosiy matn */
--text-dim: #8B93A7;   /* ikkilamchi matn */
--accent: #4F7BFF;     /* asosiy harakat (ko'k) */
--ok: #2ED3A0;         /* muvaffaqiyat (yashil) */
--warn: #FFB020;       /* ogohlantirish (sariq) */
--danger: #FF5A5A;     /* xato (qizil) */

/* Daraxt turlari — MA'NOSI BIRIKTIRILGAN, o'zgartirilmaydi */
--t-bl: #A78BFA;   /* блок (ish) — binafsha */
--t-rs: #7DD3FC;   /* ресурс — moviy */
--t-mat: #6EE7B7;  /* материал — yashil */
--t-ob: #FCD34D;   /* оборудование — sariq */
```

**Qoida:** yangi HEX rang **kiritmang**. Kerak bo'lsa mavjud tokenning
shaffofligini ishlating: `bg-accent/15`, `border-ok/30`.

**Nega:** har AI o'z rangini qo'shsa, 3 oydan keyin panel 40 xil ko'k
bo'ladi va qaysi biri «muhim» ekani bilinmaydi.

### 4.2 Rang — MA'NO jadvali (buzilmasin)

| Rang | Faqat shu ma'noda |
|---|---|
| `accent` (ko'k) | asosiy harakat, tanlangan holat |
| `ok` (yashil) | bajarildi, to'landi, kirim, ijobiy |
| `warn` (sariq) | e'tibor kerak, kutilmoqda, avans |
| `danger` (qizil) | xato, qarz, muddat o'tgan, kritik |

Yashil rangni «chiroyli» degani uchun ishlatmang.

### 4.3 Tipografika va raqamlar

- Shrift: `Inter, system-ui, sans-serif`
- **Har qanday pul/miqdor** `tabular-nums` bilan (ustunlar tekis tursin)
- Pul **doim** `<FmtN val={...} />` orqali. Qo'lda `toLocaleString()`
  yozmang — formatlash bir joyda (`lib/format.tsx`).
- Katta summa `qisqa` bilan: `<FmtN val={x} qisqa />`

### 4.4 Komponent qoidalari

| Element | Qoida |
|---|---|
| Karta | `GlassCard` (`boss/sahifalar/Umumiy.tsx` dan) |
| Fon | `AuroraBackground` |
| Radius | `rounded-xl` (12px) yoki `rounded-2xl` (16px) |
| Bo'shliq | `gap-4` / `gap-6`, `p-5` / `p-6` |
| Yuklanish | `<Skelet qatorlar={N} />` — spinner emas |
| Xabar | `toast(matn, 'ok' \| 'danger')` — `'success'` **YO'Q** |
| Modal | `ErpQoshModal` (ERP) yoki `SaveModal` naqshi |

⚠️ `ToastType` faqat **`'ok'`** va **`'danger'`**. `'success'` yozsangiz
build yiqiladi (bu sessiyada 4 marta bo'ldi).

### 4.5 Bo'sh holat (majburiy)

Har jadval/ro'yxat **ikki xil** bo'sh holatni ajratsin:

```tsx
{ro'yxat.length === 0 && (
  data.hammasi.length === 0
    ? "Hali ma'lumot yo'q — «Qo'shish» tugmasini bosing."   // haqiqatan bo'sh
    : "Qidiruvga mos natija topilmadi."                      // filtr natijasi
)}
```

**Nega:** «Hech narsa topilmadi» degan bir xil matn foydalanuvchini
adashtiradi — tizim buzuqmi yoki ma'lumot yo'qmi bilinmaydi.

---

## 5. XAVFSIZLIK VA ROLLAR

### Rollar

`superadmin` · `admin` · `boss` · `rahbar` · `bugalter` · `pto` · `prorab`

`boss` va `rahbar` — **faqat o'qish**. Ular yozuvchi funksiyani
chaqirsa, `functions/api/gas.ts` **403** qaytaradi.

### ⚠️ `YOZUVCHI` ro'yxati — PREFIKS BILAN YOZMANG

```ts
// ❌ NOTO'G'RI — "Texnika" prefiksi apiTexnikaDashboard (O'QISH) ni ham bloklaydi
const YOZUVCHI = /^api(...|Texnika|...)/;

// ✅ TO'G'RI — har biri to'liq nom, oxirida $
const YOZUVCHI = new RegExp('^api(' + [
  'TexnikaQosh', 'TexnikaTahrir', 'TexnikaTarixQosh',
  ...
].join('|') + ')$');
```

**Nega:** men shu xatoni qildim — `Texnika` prefiksi rahbar uchun
oddiy o'qishni ham bloklab qo'ygan edi. To'liq nom + `$` majburiy.

**Yangi yozuvchi funksiya qo'shsangiz — ro'yxatga qo'shishni unutmang.**
Aks holda rahbar rejimidan ma'lumot o'zgartirib yuborish mumkin bo'ladi.

---

## 6. BUZILMASLIGI SHART BO'LGAN MANTIQLAR

Bu funksiyalar uzoq mehnat bilan to'g'rilangan. **Sababini o'qimasdan
tegmang.**

### 6.1 Ko'p smetali obyekt (`_subObyektlar`)

Bitta papkada bir necha smeta fayli bo'lishi mumkin. Barcha skanerlash
tsikli `_subObyektlar(obyekt)` orqali **hamma** faylni aylanib chiqishi
shart. Hech qachon «bitta fayl» ga qaytarmang.

### 6.2 ЧЕЛ / МАШ — faqat birlikdan

`ЧЕЛ` va `МАШ` kategoriyasi **faqat o'lchov birligi** bo'yicha aniqlanadi.
Nom bo'yicha taxmin qilmang — material `МАШ` bo'lib ketadi.

### 6.3 Накрутка — ikki narx falsafasi

- Smeta / Fakt / F2 — **toza narx** (накрутkasiz)
- Shartnoma / Buxgalteriya — **накрутka bilan**
  (`vsego / obJamiSmeta` koeffitsienti orqali)

Ikkalasini aralashtirmang — `bajarilgan%` sun'iy kam chiqadi.

### 6.4 F2 moslashtirish — YAGONA joyda

`35_F2Moslash.js` → `apiF2AvtoMoslash`. Frontendda **takrorlamang**.
Moslashtirish razdel doirasida ishlaydi (global BL kod ~20-35% unikal,
razdel ichida 71-100%).

F2 mantiqini o'zgartirsangiz — **avval** `_f2lab/` sinov stendida
(Node.js, deploysiz) sinang.

### 6.5 Ф2 doim akt narxida

Ф2 **hech qachon** smeta narxida hisoblanmaydi. Bu CONSTANTA.

### 6.6 MIME tekshiruvi — QORA ro'yxat EMAS, OQ ro'yxat (2026-08-13)

`SpreadsheetApp.openById()` ga Google Sheets bo'lmagan fayl berilsa, u
oddiy JS xatosi bermaydi — **V8 dvigatelini butunlay qulatadi**.
`try/catch` HAM ushlamaydi; saytga Google'ning HTML sahifasi ketadi va
foydalanuvchi «GAS HTML qaytardi» degan tushunarsiz xatoni ko'radi.

❌ **Ishlamaydigan yondashuv** (Antigravity urinishi):
```js
if (mime === MimeType.MICROSOFT_EXCEL || mime === '...spreadsheetml.sheet') { ... }
```
**Nega ishlamadi:** Telegram/API orqali yuklangan `.xlsx` Drive'da ba'zan
**`application/zip`** mime bilan saqlanadi (xlsx aslida zip arxiv).
Uchala Excel mime'iga ham tushmaydi, tekshiruvdan sirg'alib o'tadi.

✅ **To'g'ri yondashuv** — faqat haqiqiy Sheets ochiladi, boshqasi konvert:
```js
var meta = Drive.Files.get(fileId, {fields:'id,name,mimeType,parents'});
if (meta.mimeType !== 'application/vnd.google-apps.spreadsheet') {
  fileId = _excelToNative(fileId, parent, yangiNom);   // Drive REST — xavfsiz
}
ss = SpreadsheetApp.openById(fileId);
```

`_excelToNative` (`05_Papka.js`) ikki bosqichli:
1. `Drive.Files.copy` bilan konvert (tez);
2. u «conversion is not supported» bersa (zip-mime holati) — fayl
   baytlarini olib, MIME'ni majburan Excel deb belgilab
   `Drive.Files.create` bilan qayta yaratadi.

Konvertdan keyin **yangi fayl ID** qaytariladi (`yangiFileId`) — UI
`fid`ni shu yangi ID ga almashtirishi shart, aks holda keyingi o'qish
yana eski faylga uriladi.

---

## 7. YANGI ISH BOSHLASHDAN OLDINGI RO'YXAT

```
[ ] 1. `00_BOSH_QONUN.md` (bu fayl) o'qildi
[ ] 2. `Smeta tizimi/CLAUDE.md` o'qildi (ba'zi joyi eskirgan — kodga ishon)
[ ] 3. `git pull` qilindi — boshqa AI ishi ustiga yozmayapmanmi?
[ ] 4. Bu ma'lumot QAYSI Google Sheet katagidan keladi — javobim bor
[ ] 5. Bu og'ir ishmi? Ha bo'lsa — navbat pattern ishlataman
[ ] 6. Qo'shayotgan tugmam haqiqatan ishlaydimi?
```

## 8. ISHNI TUGATISHDAN OLDINGI RO'YXAT

```
[ ] 1. `node --check <fayl>.js`             (GAS o'zgargan bo'lsa)
[ ] 2. `clasp push` VA `clasp deploy`       (GAS o'zgargan bo'lsa)
[ ] 3. `cd frontend && npm run build`       → TOZA bo'lishi SHART
[ ] 4. Soxta ma'lumot qo'shmadimmi?         (Math.random, qotirilgan raqam)
[ ] 5. O'lik tugma qoldirmadimmi?
[ ] 6. Yangi yozuvchi funksiya → gas.ts YOZUVCHI ro'yxatiga qo'shildimi?
[ ] 7. git commit + push + Cloudflare deploy hook
```

---

## 9. HOZIRGI HOLAT (2026-08-02)

### Tugallangan
- GAS backend: 45 fayl, produksiya deployment `@223`
- React sayt: 47 fayl, barcha sahifalar haqiqiy GAS'ga ulangan
- ERP 4 moduli (Kadrlar/Texnika/Ta'minot/Sifat) — backend + CRUD forma
- «Ишла» dvigateli React adminga ko'chirildi (navbat pattern bilan)
- Sozlamalar sahifasi (tizim / накрутка / stavka)
- 3 ta soxta-ma'lumot buzilishi topilib o'chirildi

### Hali eski `Panel.html` da qolgan (ko'chirilmagan)
| Funksiya | Izoh |
|---|---|
| AKT tizimi | **Ataylab qoldirildi** — redizayn bekor qilingan |
| M-29 hujjat yaratish | `apiM29Yarat` |
| Shaxsiy smeta | `apiShaxsiySmetaYarat` |
| Oraliqlar sozlash | `apiOraliqlarOl/Saqla/Skan` |
| Diagnostika panellari | `apiTashxis`, `apiTolaDiagnostika` |
| Kesh boshqaruvi | `apiKeshHolat`, `apiKeshYangilash` |
| AI panellari | `apiSmetaAi`, `apiMaslahatDashboard` va sh.k. |
| Grafik | `apiGrafikYangilashBoshla` |
| Prixod/Rasxod kiritish | `apiPrixodYoz`, `apiRashodYoz` |

> Bular **ishlayapti** — faqat eski panelda. Ko'chirish shart emas,
> lekin ko'chirilsa — 3-bo'limdagi 6 bosqichli zanjir bilan.

### Keyingi tavsiya etilgan tartib
1. Prixod/Rasxod kiritish (Sklad sahifasiga) — kunlik ishlatiladi
2. Oraliqlar sozlash (Sozlamalar sahifasiga 4-tab)
3. Kesh + Diagnostika (Monitoring sahifasiga tab)
4. M-29 / Shaxsiy smeta (Hujjatlar sahifasi)

---

## 10. AGAR «ISHLAMAYAPTI» DESA — TEKSHIRISH TARTIBI

1. **Toast matnini so'rang.** Tizimda global JS-xato tutqichi bor,
   funksiya nomi bilan toast chiqadi. Bu 90% holatda ildizni ko'rsatadi.
2. **Rol tekshiring.** «Раҳбар режимида ёзиш мумкин эмас» — eski
   `boss`/`rahbar` cookie qolgan. Chiqib, `admin` bilan qayta kiring.
3. **Deploy tekshiring.** `clasp deployments` — oxirgi versiya
   produksiya ID'ga bog'langanmi?
4. **Build tekshiring.** Cloudflare deploy log'ida `error TS` bormi?
5. **Ma'lumot bo'shmi?** ERP varaqlari yangi — bo'sh bo'lishi normal.

---

## 11. XULOSA — UCH JUMLA

1. **Soxta ma'lumot — eng og'ir buzilish.** Manba yo'q bo'lsa, bo'sh
   ko'rsating.
2. **Build toza bo'lmasa — deploy yo'q**, va `push` ≠ `deploy`.
3. **Og'ir ish navbat orqali**, sinxron emas — GAS 6 daqiqada uzadi.

---

*Bu hujjat o'zgarsa — sababini shu yerga yozing. Qoidani sababisiz
o'chirish man etiladi.*

---
# 8-QONUN: XAVFSIZLIK POYDEVORI (2026-08-28 da foydalanuvchi tomonidan aniqlashtirildi)

> ✅ **HAL QILINDI.** Foydalanuvchining o'z izohi: *"Bitcoin darajasidagi
> xavfsizlik" deganda mubolag'a qilib aytdim, xavfsiz bo'lsin degan
> ma'noda. Xavfsizlikni farqi yo'q qaysi yo'ldan borsang ham, xavfsizlik
> poydevorlarini qo'yib boraverish kerak; tizim tayyor bo'lganidan
> keyin yoqishing kerak.* Ya'ni: **UUID/RLS literal talab EMAS** —
> bu band pastdagi shaklga almashtirildi.

**Qoida (yangi, kuchda):**
1. Har bir yangi jadval/RPC yozilganda xavfsizlik POYDEVORI albatta
   qo'yiladi: `id` immutable, `holat`/`versiya` (soft-delete + optimistik
   qulf), kompaniya a'zoligi tekshiruvi (`sb.ts`/`sb-yoz.ts` naqshi),
   audit yozuvi — bularning HAMMASI **hozirdanoq**, har safar.
2. **To'liq yoqish** (RLS policy, Supabase Auth+JWT, ID formatini
   almashtirish, secret rotation, MFA va h.k.) — tizim FAZA 1-9
   asosiy funksionalligi bilan tayyor bo'lgach, YAKUNIY bosqichda
   BITTA paket sifatida amalga oshiriladi (MASTER_REJA_ENTERPRISE_OS.md
   0/0-A bo'limlarida allaqachon shu tartib yozilgan — GPT reja ham
   band 31/39 da xuddi shu ketma-ketlikni tavsiya qiladi: "full security
   hardening — oxirgi katta bosqich").
3. Konkret ID formati (bigint yoki UUID) — MUHIM EMAS, chunki haqiqiy
   himoya (server-tomon a'zolik tekshiruvi) format bilan bog'liq emas.
   Yangi jadval qaysi formatda qulay bo'lsa (loyihada barchasi
   `bigint GENERATED ALWAYS AS IDENTITY`) — shu davom etadi, ATAYLAB
   UUID'ga o'tkazish shart EMAS.

Eski matn (arxiv, endi kuchda emas, tarix uchun saqlanadi):
> ~~Hech qachon tizim URLlarida... inkremental ID'lar ishlatilmasligi
> shart. ...UUIDv4 (128-bit) yordamida himoyalanishi, va Supabase RLS
> siyosatlari shu UUID asosida qurilishi kerak.~~
