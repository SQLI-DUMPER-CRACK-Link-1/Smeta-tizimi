# 🏗️ ARXITEKTURA V3 — MUSTAHKAMLIK QATLAMI

> **Claude · 2026-07-28**
> `11_ARXITEKTURA_V2.md` tuzilmani belgiladi. Bu hujjat — **ishonchlilik**.
> Professional tizimni havaskordan ajratadigan narsa ko'rinish emas:
> **xato bo'lganda nima sodir bo'lishi.**

---

## 0. NIMA UCHUN BU HUJJAT

Sayt hozir «yaxshi kunda» ishlaydi. Lekin qurilishda yaxshi kun kam:

| Vaziyat | Hozir nima bo'ladi |
|---|---|
| Prorab obyektda, internet sust | yozuv yo'qoladi |
| «Замена» tugmasi ikki marta bosildi | **ikkita qator qo'shiladi** |
| So'rov timeout bo'ldi, foydalanuvchi qaytadan urindi | **ikkita qator** |
| GAS 6 daqiqa chegarasiga urildi | yarim yozilgan holat |
| Ikki kishi bir obyektni ochdi | biri bloklanadi, sababini bilmaydi |
| Noto'g'ri saqlandi | **orqaga qaytarish yo'q** |

Bularning har biri moliyaviy tizimda qabul qilib bo'lmaydi.

---

## 1. 🔴 IDEMPOTENTLIK — eng jiddiy bo'shliq

### 1.1 Muammo aniq va tasdiqlangan

`apiBlQosh` **qator qo'shadi** (`insertRowsAfter`). Ya'ni ikki marta chaqirilsa —
**ikkita qator**. Ikki marta chaqirilishi esa oson:

- foydalanuvchi tugmani ikki marta bosdi
- so'rov timeout bo'ldi, lekin serverda **bajarildi**, foydalanuvchi qayta urindi
- tarmoq uzildi va brauzer qayta yubordi

Bu **faraziy xavf emas.** GAS kodining o'zida shu hodisa qayd etilgan:

```js
// ⚡⚡⚡ 2026-07-12 KRITIK: TAKRORIY QO'SHISH HIMOYASI.
// takror-takror qo'shilib ketardi — foydalanuvchi ko'rgan "2.2mlrd→3.3mlrd" kabi
```

### 1.2 Himoya mexanizmi allaqachon bor — lekin sayt undan foydalanmayapti

`apiBlQosh` `params.f2Uid` ni qabul qiladi va uni ШИФР katagiga **izoh (note)**
qilib yozadi. `_f2DopUidQatorTop` shu izoh bo'yicha qidiradi — ya'ni o'sha uid
bilan qator allaqachon bor bo'lsa, **qayta qo'shilmaydi**.

Buni hozir faqat Ф2 oqimi ishlatadi. Saytning drag & drop'i **uid yubormaydi**.

### 1.3 Yechim — har yozuvda mijoz tomonda yaratilgan UUID

```ts
// umumiy/idempotent.ts
export function yangiUid(): string {
  return crypto.randomUUID();
}
```

**Qoida:** qator **qo'shadigan** har chaqiruvda uid bo'lishi shart.

```ts
const uid = yangiUid();          // ⚠️ komponent RENDERIDA emas — harakat boshida
await blQosh.mutateAsync({ ...params, f2Uid: uid });
```

Muhimi: uid **bir marta** yaratiladi va qayta urinishlarda **o'zgarmaydi**.
Shuning uchun u mutatsiya ichida emas, undan tashqarida saqlanadi.

| Funksiya | Idempotentmi | Nima kerak |
|---|---|---|
| `apiHolatSaqla` | ✅ ha (`setValues` — qayta yozadi) | hech narsa |
| `apiBlQosh` | ⛔ yo'q | **`f2Uid` majburiy** |
| `apiRsQosh` | ⛔ yo'q | **`f2Uid` majburiy** |
| `apiOyQosh` | ⚠️ qisman | oy nomi bo'yicha tekshiradi |
| `apiF2QollaNavbatga` | ✅ ha (job tizimi) | hech narsa |

> ⚠️ **Bu Faza 2C ning birinchi ishi.** Idempotentliksiz drag & drop
> ishlab chiqarishga chiqarilmasin.

---

## 2. BUYRUQ NAVBATI — «kompyuterni o'chirsam ham»

Foydalanuvchining talabi:
*«компьютерни ўчириб кетсам ҳам маълумотларни ёзиб тура олади»*

Ф2 uchun bu GAS job tizimi bilan hal qilingan. Lekin **oddiy tahrir** uchun
yo'q — brauzer yopilsa saqlanmagan o'zgarish yo'qoladi.

### 2.1 Yechim — IndexedDB'dagi doimiy navbat

```ts
type Buyruq = {
  uid: string;                    // idempotentlik kaliti
  fn: string;                     // 'apiHolatSaqla' | 'apiBlQosh' | ...
  args: unknown[];
  obyekt: string;
  yaratildi: number;
  urinish: number;                // 0,1,2…
  holat: 'kutmoqda' | 'ketmoqda' | 'tugadi' | 'xato';
  xato?: string;
};
```

**Oqim:**

```
Foydalanuvchi «Saqlash» bosdi
        ↓
Buyruq IndexedDB'ga yoziladi (holat: kutmoqda)   ← bu YERDAN keyin yo'qolmaydi
        ↓
UI darhol «✅ Навбатга қўйилди» deydi
        ↓
Fon ishchisi navbatni ketma-ket yuboradi
        ↓
Muvaffaqiyat → holat: tugadi, keshdan o'chiriladi
Xato        → urinish++ , kechikish 2^urinish soniya (maks 60s)
        ↓
Brauzer yopilib qayta ochilsa — navbat davom etadi
```

### 2.2 Qat'iy qoidalar

1. Navbat **ketma-ket** ishlaydi, parallel emas — GAS tartibni yoqtiradi
2. Bir obyektga tegishli buyruqlar **tartibi saqlanadi**
3. 5 marta muvaffaqiyatsiz → to'xtaydi va foydalanuvchidan so'raydi
4. Navbatda buyruq bo'lsa — sarlavhada ko'rsatkich:
   `⏳ 3 та ўзгариш юборилмоқда`
5. `beforeunload` faqat navbat **bo'sh emas** bo'lsa ogohlantiradi

### 2.3 Offline

```ts
addEventListener('online',  () => navbat.davomEt());
addEventListener('offline', () => navbat.pauza());
```

Offline'da UI ishlaydi (kesh o'qiydi), yozuvlar navbatda turadi.
Sarlavhada: `📴 Оффлайн · 3 та ўзгариш кутмоқда`.

Bu qurilish maydonida ishlash uchun **shart** — u yerda internet sust.

---

## 3. KESH IERARXIYASI VA «MA'LUMOT YOSHI»

### 3.1 Uch qavat

```
1. Xotira (TanStack Query)     — 0 ms      — joriy sessiya
2. IndexedDB                   — ~10 ms    — brauzer yopilsa ham qoladi
3. GAS                         — 5–30 s    — haqiqat manbai
```

`apiHolatOl` katta obyektda 30 soniya. IndexedDB qatlami bilan foydalanuvchi
sahifani qayta ochganda **darhol** ko'radi, fonda yangilanadi.

### 3.2 Yoshni yashirmang — ko'rsating

Har og'ir ekranning yuqorisida:

```
Маълумот: 4 дақиқа олдинги · [↻ янгилаш]
```

Bu ishonchni oshiradi. Foydalanuvchi eski raqamni yangi deb o'ylab qaror
qabul qilmasin.

| Yoshi | Ko'rinishi |
|---|---|
| < 1 daq | `--text-mute`, oddiy |
| 1–15 daq | `--text-dim` |
| > 15 daq | `--warn` + «янгилаш тавсия этилади» |

---

## 4. QULF O'RNIGA — MAVJUDLIK (PRESENCE)

Hozirgi `apiLockBos` — ikkilik: biri ishlaydi, qolganlar **butunlay bloklanadi**.
Bu qo'pol. Ikki kishi turli razdellarda ishlashi mumkin.

### 4.1 Yumshoq model

| Daraja | Qachon | Xatti-harakat |
|---|---|---|
| **Ko'rish** | hamma | cheklov yo'q |
| **Yumshoq band** | kimdir tahrir rejimida | ogohlantirish, lekin ruxsat |
| **Qattiq qulf** | Ф2 yozuvi ketmoqda | tahrir bloklanadi |

Qattiq qulf faqat Ф2 yozuvida — chunki u butun varaqni qayta tuzadi.

### 4.2 Ko'rinishi

```
👤 Анвар ҳозир таҳрирламоқда  ·  2 дақиқа олдин
   Сиз ҳам таҳрирлашингиз мумкин, лекин бир қаторни иккалангиз
   ўзгартирсангиз охиргиси сақланади.
```

Foydalanuvchini bloklashdan ko'ra **xabardor qilish** yaxshiroq.

---

## 5. ORQAGA QAYTARISH (UNDO) — moliyaviy tizimda shart

Hozir noto'g'ri saqlansa — qo'lda tuzatishdan boshqa yo'l yo'q.

### 5.1 Har saqlashdan oldin «oldingi holat» yoziladi

Mijoz `apiHolatSaqla` yuborishdan oldin **eski qiymatlarni** ham biladi.
Shuni buyruq bilan birga saqlaydi:

```ts
type SaqlashBuyrug = Buyruq & {
  orqaga: Edit[];        // eski qiymatlar — teskari amal
  tavsif: string;        // «14 та қатор · +1 240 500 000 сўм»
};
```

### 5.2 UI

Saqlangandan keyin toast'da **10 soniya** davomida:

```
✅ 14 та қатор сақланди          [ ↩ Бекор қилиш ]
```

Bosilsa — `orqaga` massivi bilan yana `apiHolatSaqla` chaqiriladi.
`setValues` idempotent bo'lgani uchun bu xavfsiz.

### 5.3 Tarix ekrani

`Сўнгги ўзгаришлар` sahifasi — oxirgi 50 amal:

```
28.07 14:22  Анвар    Амфитеатр    14 қатор    +1.24 млрд   [↩]
28.07 11:05  Анвар    Ф2 импорт    1220 қатор  +1.24 млрд
27.07 16:40  Раис     —            кўрди
```

Manba: mijoz buyruq navbati + GAS `_ЗАМЕНА_ТАРИХ` + `apiWebApiLog`.

---

## 6. DEGRADATSIYA DARAJALARI — GAS ishlamay qolsa

Tizim **o'lmasin**, imkoniyati kamaysin:

| Daraja | Holat | Sayt nima qiladi |
|---|---|---|
| 0 | hammasi ishlayapti | to'liq |
| 1 | GAS sekin (>20 s) | keshdan ko'rsatadi, yosh belgisi bilan |
| 2 | GAS xato qaytaryapti | faqat o'qish, yozuvlar navbatda |
| 3 | GAS umuman javob bermayapti | oxirgi kesh + «Тизим вақтинча ишламаяпти» |
| 4 | Kesh ham yo'q | chiroyli bo'sh holat + qayta urinish |

**Hech qachon oq ekran, hech qachon tushunarsiz xato.**

### Avtomatik aniqlash

```ts
// 3 ta ketma-ket xato → daraja 2 ga o'tish
// muvaffaqiyatli javob → darhol daraja 0 ga qaytish
```

---

## 7. ⌘K — GLOBAL BUYRUQ PANELI

52 516 ta qator, 66 ta obyekt. Qidiruvsiz bu boshqarib bo'lmaydigan hajm.

`Ctrl/⌘ + K` istalgan joyda ochiladi:

```
┌──────────────────────────────────────────────┐
│ 🔍 бетон                                     │
├──────────────────────────────────────────────┤
│ ОБЪЕКТЛАР                                    │
│   📁 Амфитеатр                               │
│ ИШ ТУРЛАРИ                                   │
│   🔧 Бетон М300 тайёрлаш      Амфитеатр      │
│   🔧 Бетон М200 ётқизиш       Сунъий кўл     │
│ АМАЛЛАР                                      │
│   ⚡ Ф2 импорт қилиш                          │
│   ⚡ Янги ой устуни қўшиш                     │
└──────────────────────────────────────────────┘
```

- Fuzzy qidiruv, kirill/lotin farqsiz
- Natijalar guruhlangan, klaviatura bilan yuriladi
- Yaqinda ochilganlar yuqorida (`localStorage`)
- Qidiruv **mijozda**, keshlangan ma'lumot ustida — GAS chaqirilmaydi

Bu bitta funksiya butun tizimning tezlik hissini o'zgartiradi.

---

## 8. AI YORDAMCHI — mavjud, lekin saytda ishlatilmayapti

GAS'da tayyor turibdi va sayt undan **umuman foydalanmayapti**:

```
00_AI_Gateway.js   — GROQ / Gemini marshrutizatori
65_TitanAI.js      — savol-javob
66b_AI_SqlEngine   — tabiiy tildan so'rov
75_AI_SmartF2      — Ф2 aqlli moslashtirish
91_BossTahlil      — rahbar uchun tahlil
```

### Ko'rinishi

O'ng pastda suzuvchi tugma → yon panel:

```
👤 Амфитеатрда қанча қолдиқ бор?

🤖 Амфитеатр бўйича:
   Смета    56.83 млрд
   Факт      4.30 млрд  (8%)
   Қолдиқ   52.53 млрд

   Энг катта қолдиқ: Оборудование — 17.52 млрд
   [ Батафсил кўриш ]
```

**Qoidalar:**
- AI **hech qachon o'zi yozmaydi** — faqat o'qiydi va tavsiya beradi
- Har javobda **manba** ko'rsatiladi (qaysi obyekt, qaysi funksiya)
- Raqamlar AI tomonidan **hisoblanmaydi** — GAS bergani ko'rsatiladi
- Javob 3 soniyadan uzoq bo'lsa — jonli oqim (streaming) yoki «ўйламоқда»

> ⚠️ AI moliyaviy raqamni o'ylab topmasin. Faqat `api*` natijalarini
> tushuntirsin. Bu qat'iy chegara.

---

## 9. KUZATUV (OBSERVABILITY)

Bugungi «qora ekran» 40 daqiqa qidirildi, chunki xato **hech qayerga
yozilmagan** edi.

### 9.1 Mijoz xatolari serverga yuboriladi

```ts
addEventListener('error', e => xatoYubor('js', e.message, e.filename, e.lineno));
addEventListener('unhandledrejection', e => xatoYubor('promise', String(e.reason)));
```

`/api/xato` → GAS `apiXatoYoz(manba, xabar, kim, url)` → `_XATOLAR` varag'i.

### 9.2 Sekin chaqiruvlar

`/api/gas` har chaqiruvning davomiyligini o'lchaydi. 10 soniyadan sekin
bo'lsa — logga. Admin panelida «Мониторинг» sahifasida ko'rinadi.

### 9.3 Nima YOZILMAYDI

Shaxsiy ma'lumot, token, parol, to'liq so'rov tanasi. Faqat: funksiya nomi,
davomiylik, xato turi, foydalanuvchi emaili.

---

## 10. TESTLAR — «ishlaydi» degan so'zga ishonmaslik uchun

Hozir yagona tekshiruv `npm run build`. Bu tiplarni tekshiradi, **mantiqni emas**.

### 10.1 Minimal, lekin haqiqiy to'plam

```
vitest + @testing-library/react
```

| Test | Nimani ushlaydi |
|---|---|
| `pulTola(467348726061)` → `'467 348 726 061'` | formatlash |
| `pulQisqa(467348726061)` → `'467.3 млрд'` | |
| Idempotentlik: bir uid bilan 2 marta → 1 chaqiruv | **takroriy qator** |
| Navbat: xato → qayta urinish → tartib saqlanadi | yo'qolgan yozuv |
| Undo: `orqaga` teskari qiymatlarni beradi | noto'g'ri qaytarish |
| `TreeNode` tip ↔ haqiqiy API javobi | **bugungi qora ekran** |

### 10.2 ⭐ Eng muhim test — API shartnomasi

```ts
// api-shartnoma.test.ts
it('apiBossData javobi tipга мос', async () => {
  const d = await gas<BossData>('apiBossData');
  expect(d).toHaveProperty('jami.smeta');
  expect(d.objects[0]).toHaveProperty('nom');
});

it('apiHolatOl тугунлари типга мос', async () => {
  const r = await gas<{tree: TreeNode[]}>('apiHolatOl', KICHIK_OBYEKT, false);
  const n = r.tree[0];
  expect(n).toHaveProperty('type');       // 'tip' EMAS
  expect(n).toHaveProperty('smetaHajm');  // 'smeta' EMAS
  expect(n).toHaveProperty('varaq');
  expect(n).toHaveProperty('row');
});
```

**Bu test bugungi ikkala kritik nuqsonni ham oldindan ushlagan bo'lardi.**
CI'da har push'da ishlasin.

---

## 11. BAJARISH TARTIBI

Bularning hammasi bir vaqtda emas. Fazalarga taqsimlanadi:

| Nima | Qaysi fazada | Nega |
|---|---|---|
| **Idempotentlik (§1)** | **2C — birinchi ish** | Ma'lumot buzilishining oldini oladi |
| API shartnoma testi (§10.2) | 2C | Takrorlanuvchi xatoni to'xtatadi |
| Kuzatuv (§9) | 2C | Keyingi xatolar tez topilsin |
| Buyruq navbati (§2) | 3 | Ф2 bilan birga |
| Kesh + yosh (§3) | 3 | |
| Undo (§5) | 4 | |
| ⌘K (§7) | 4 | |
| Presence (§4) | 4 | |
| Degradatsiya (§6) | 5 | |
| AI yordamchi (§8) | 5 | |

---

## 12. QISQACHA — nima tizimni «professional» qiladi

Foydalanuvchi ko'rmaydigan, lekin sezadigan narsalar:

1. **Ikki marta bosish zarar qilmaydi** (idempotentlik)
2. **Yopilgan brauzer yozuvni yo'qotmaydi** (navbat)
3. **Xato bo'lsa sabab ekranda** (kuzatuv + xato holati)
4. **Noto'g'ri qilsang qaytara olasan** (undo)
5. **Internet yo'qolsa ishlayveradi** (offline)
6. **Eski ma'lumot eski deb aytiladi** (yosh belgisi)
7. **Server o'lsa sayt o'lmaydi** (degradatsiya)
8. **Hech narsa jim yo'qolmaydi**

Chiroyli animatsiya — birinchi taassurot.
Bu ro'yxat — **ikkinchi oydan keyin ham ishonch**.
