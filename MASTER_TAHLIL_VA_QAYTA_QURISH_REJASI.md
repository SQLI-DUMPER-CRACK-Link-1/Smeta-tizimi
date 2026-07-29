# 🏗️ MASTER TAHLIL VA QAYTA QURISH REJASI — 0 dan 100 gacha

> **Sana:** 2026-07-05. **Muallif:** Claude — butun tizim (kod + hujjatlar + xotira + bugungi
> jonli holat) chuqur auditi asosida.
> **Maqsad:** "Legolar chalkashib ketdi" muammosini hal qilish — butun tizimni ipidan
> ignasigacha tahlil qilib, dunyodagi eng yaxshi qurilish-boshqaruv tizimlari bilan
> solishtirib, YAGONA izchil arxitekturaga qayta yig'ish rejasi.
> **Bog'liq hujjatlar:** `TIZIM_XARITASI_VA_REJA.md` (2026-07-02 xarita — bu hujjat uni
> ALMASHTIRADI emas, CHUQURLASHTIRADI), `NAKRUTKA_VA_F2_TAHLIL_ANTIGRAVITY.md` (bugungi
> накрутка ildiz tahlili), `ANTIGRAVITY_UCHUN.md` (buzilmas qoidalar), `Smeta tizimi/CLAUDE.md`
> (69 ta tuzatish tarixi).

---

# I QISM — DUNYO BILAN TAQQOSLASH

## 1.1. Dunyoda bu masala qanday hal qilinadi

Bizning tizim hal qilayotgan masala dunyoda **"Construction Cost Management + Progress
Billing"** deb ataladi. Yetakchi tizimlar va ularning yadro g'oyalari:

| Tizim | Bozor | Yadro g'oyasi | Bizga saboq |
|---|---|---|---|
| **Procore** (AQSh, ~$1B revenue) | Umumiy qurilish boshqaruvi | **Yagona ma'lumot manbai** (single source of truth) — smeta, o'zgartirishlar (change orders), progress billing, to'lovlar BITTA bazada, hamma modul shu bazadan o'qiydi | Bizda hozir 4 ta "haqiqat manbai" bor (LRV, DASHBOARD, KESH, Supabase) va ular orasida delta yig'iladi — bu bizning №1 kasalligimiz |
| **Autodesk Construction Cloud / BIM 360** | Loyiha + qiymat | **Budget → Contract → Change Order → Pay Application zanjiri** — har hujjat oldingisiga BOG'LANGAN, havolasiz hujjat bo'lmaydi | Bizning Akt↔Smeta, F2↔Smeta bog'lanishlari hali "nom bo'yicha taxmin" darajasida — barqaror work-key kerak (G4) |
| **Oracle Primavera / P6** | Yirik infratuzilma | **Progress measurement** — har ish turining % bajarilishi va EARNED VALUE (o'zlashtirilgan qiymat) — reja-fakt-prognoz | Bizda "Остатка" endi paydo bo'ldi (bugun); prognoz (G7) hali yo'q |
| **Гранд-Смета / Smeta.ru** (RF/MDH) | Smeta hisobi | **Normativ baza (ГЭСН/ФЕР) + indeks** — расценка kutubxonasi markaziy, smeta shu kutubxonadan yig'iladi | Bizning `_ISHTURLAR` kutubxonasi shu g'oyaning boshlanishi; "Shaxsiy smeta" aynan shu yo'nalish |
| **1C:Подрядчик / БИТ.Строительство** | MDH pudratchi | **КС-2/КС-3 hujjat aylanishi** — oylik forma avtomatik, nakopitelniy vedomost markaziy hujjat | Bizning LRV_PLUS = накопительная ведомость. КС-2/КС-3 avto-generatsiya (G2) hali yo'q |
| **Fieldwire / PlanRadar** | Maydon (field) | **Mobil birinchi** — prorab telefondan yozadi, ofis ko'radi | Bizning Telegram bot + ovozli sklad — aynan shu; dunyo darajasida bu to'g'ri yo'nalish |

## 1.2. Xulosa — biz qayerdamiz

**Kuchli tomonlarimiz (dunyo darajasida raqobatbardosh):**
1. **CONSTANTA narxlash** (narx faqat svodkadan, aynan moslik) — yuridik jihatdan Procore'dagi "locked budget" bilan bir xil qat'iylik. ✅
2. **Nakopitelniy LRV_PLUS + xavfsiz qayta ishlash** (`_faktSaqla/_faktQayta` — fakt hech qachon yo'qolmaydi) — 1C darajasidagi hujjat yaxlitligi. ✅
3. **Telegram + ovozli AI sklad** — Fieldwire'dan ham qulayroq kirish nuqtasi (hech qanday ilova o'rnatilmaydi). ✅
4. **Ko'p qatlamli sinx (Sheets→Supabase→frontend)** — to'g'ri zamonaviy arxitektura tanlangan. ✅
5. **Narx-materialda to'liq nazorat zanjiri** (smeta→fakt→F2→akt→sklad→to'lov) — ko'p tayyor tizimlarda ham bunchalik to'liq zanjir yo'q. ✅

**Zaif tomonlarimiz (dunyo tizimlaridan ortda):**
1. 🔴 **Bir nechta "haqiqat manbai" va ularning kelishmasligi** — Procore printsipi buzilgan. KPI 10 mlrd deydi, накрутка 9.77 mlrd deydi, DASHBOARD uchinchisini. Bugun bitta sabab (marker `+`) tuzatildi, lekin ARXITEKTURAVIY sabab qoladi (II qism).
2. 🔴 **O'qish kodi 6+ joyda takrorlangan** — har biri o'z xatosi bilan (II qism, §2.2).
3. 🟡 **Hujjatlar orasida barqaror bog'lanish yo'q** (Akt↔smeta nom bo'yicha, F2 import nom bo'yicha).
4. 🟡 **Vaqt o'lchovi umuman yo'q** (Gantt, muddat, kechikish) — Primavera'ning yadrosi bizda 0%.
5. 🟡 **Frontend hali yo'q** — "kaftday ko'rinish" oxirgi halqasi qurilmagan.

---

# II QISM — HOZIRGI HOLAT: IPIDAN IGNASIGACHA

## 2.1. Nima ISHLAYDI (tasdiqlangan, 2026-07-05 holatiga)

**LRV_PLUS yaratish zanjiri — HAL QILINGAN (foydalanuvchi tasdig'i bilan):**
- Papka skan + multi-lokalka bo'lish (`05_Papka.js`) ✅
- CONSTANTA narxlash + oraliq + svod ustun xaritasi + har-obyekt stavka ✅
- НАРХ ТАЙЁР rejimi (svodkasiz, faqat struktura) ✅
- Katta obyekt (Amfiteatr) timeout muammolari: mergedMap Sheets API, filter tozalash,
  navbat peek-pattern (item yo'qolmaydi) ✅
- `curFmt` ReferenceError (yangi obyekt birinchi ishlashda yiqilardi) ✅
- "You can't remove all sheets" crash ✅
- Xavfsiz qayta ishlash: `_BAK_` tranzaksiya, fakt/F2/qo'shimcha occurrence-key bilan saqlash ✅

**Boshqa ishlaydigan modullar:** DASHBOARD (bugun `+` fix bilan), Kesh (CacheService gzip),
Navbat (fon trigger), Shartnoma+Накрутка zanjiri (mexanika to'g'ri, falsafa savoli ochiq —
§2.4), Buxgalteriya, Telegram bot (fon rejim), Groq→Gemini AI shlyuz, Sklad ovozli AI
(2-bosqichli tasdiqlash), Supabase mirror (13 jadval), SelfTest (121 funksiya registri).

## 2.2. ILDIZ KASALLIK №1 — "O'qish kodi ko'paygan" (eng muhim tushuncha!)

Bugungi накрутка xatosi tasodif emas — bu **tizimli kasallikning navbatdagi simptomi**.
LRV_PLUS'dan ma'lumot o'qiydigan kod hozir **kamida 7 joyda mustaqil** yozilgan:

| # | O'quvchi | Fayl | Nima o'qiydi | Ma'lum bo'lgan xatosi |
|---|---|---|---|---|
| 1 | `apiHolatOl` | 30_Panel.js | To'liq daraxt (Panel uchun) | ✅ marker `+` to'g'ri |
| 2 | `serverYozFile` | 20_Server.js | Jami + kategoriyalar (DASHBOARD) | 🔴 marker `+` YO'Q edi → bugun tuzatildi |
| 3 | `apiTashxis` | 30_Panel.js | Diagnostika | 🔴 xuddi shu xato — fix #63 da tuzatilgan |
| 4 | `apiBossObyekt` | 30_Panel.js | Kategoriya+RZ breakdown | ✅ `+` to'g'ri (tekshirildi) |
| 5 | `_resurslarYig` | 10_Engine.js | Resurs ro'yxati | 🔴 `+` YO'Q edi → bugun tuzatildi |
| 6 | `supabaseObyektPush` | 70_Supabase.js | holat jadvali | ⚠️ tekshirilmagan |
| 7 | `_narxYangilaVaraq` (tezkor) | 10_Engine.js | narx yangilash | ✅ `+` to'g'ri |

**Har biri o'zicha:** marker o'qiydi, `+` ni tashlaydi (yoki unutadi!), start qatorni
aniqlaydi, kategoriyani aniqlaydi (ЧЕЛ>0? МАШ>0?...), leaf/rollup farqlaydi. Bitta qoida
o'zgarsa (masalan yangi `ob` marker qo'shilganda) — 7 joyni ham yangilash kerak, bittasi
unutiladi → yana "sirli delta". **Bu "legolar chalkashligi"ning asosiy sababi.**

**Xuddi shu kasallik YOZISHDA ham:** F2 qiymat yozadigan joylar (`apiHolatSaqla`,
`apiF2Qolla`, `apiRsQosh`, `apiBlQosh`, `_oyKollarTikla`, `_oyFormulaToldur`) — har biri
o'zicha formulani ta'minlaydi yoki ta'minlamaydi. Bugungi "F2=0" xatosi aynan shundan:
bitta yozuvchi (`_oyFormulaToldur`) `bl` qatorlarni unutgan edi.

## 2.3. ILDIZ KASALLIK №2 — Bir nechta haqiqat manbai, kelishuv nazorati yo'q

```
LRV_PLUS (haqiqat)
  ├─→ apiHolatOl → KPI "Umumiy smeta" = 10.0 mlrd     (jonli, to'liq)
  ├─→ serverYozFile → DASHBOARD = 7.4 mlrd            (eskirgan + '+' xatosi)
  │      └─→ apiObyektNakrutka → 9.77 mlrd            (kichik bazadan)
  ├─→ 25_Kesh → holat_<ob> keshi                       (TTL bilan, invalidatsiya to'g'ri)
  └─→ Supabase → frontend                              (soatlik, dirty-tracking)
```

DASHBOARD `[Ишла]` yoki qo'lda yangilashda yoziladi — Panel'da fakt kiritilsa
`serverYozFile` chaqiriladi, LEKIN foydalanuvchi LRV'ni QO'LDA tahrir qilsa DASHBOARD
eskiradi va **hech kim buni sezmaydi**. Kelishuv (reconciliation) tekshiruvi yo'q.

## 2.4. ILDIZ KASALLIK №3 — Ikki narx falsafasi aralashgan (biznes qaror kerak!)

- **LRV narxi (G ustun)** = svodkadan olingan **joriy bozor narxi** (CONSTANTA #46).
- **Накрутка zanjiri** = klassik "базис→жорий" metodika: ПРЯМЫЕ (bazaviy xarajat)
  ustiga transport/склад/прочие 18%/НДС qatlab chiqish.

Bular ikki xil dunyo. LRV'dagi narx allaqachon "joriy" bo'lsa, ustiga yana 32% qo'yish —
yo ikki marta narxlash, yo (agar svodka narxi aslida bazaviy bo'lsa) to'g'ri. **Bu kodda
hal bo'lmaydi — foydalanuvchi qaror berishi kerak:**
- **(A)** Накрутка = faqat tahliliy ko'rsatkich (mijoz taklifi kalkulyatori) — u holda
  UI'da "taxminiy tijorat narxi" deb aniq yozib, KPI bilan yonma-yon EMAS, alohida ko'rsatish.
- **(B)** Накрутка = rasmiy yakuniy narx — u holda ПРЯМЫЕ bazasi DASHBOARD'dan emas,
  bevosita KPI bilan BIR manbadan (yangi `lrvOqi()` dan, §3.2) olinishi shart, va foydalanuvchi
  svodka narxlari "bazaviy" ekanini tasdiqlashi kerak.

## 2.5. Ochiq muammolar TO'LIQ REESTRI (2026-07-05 kechqurun holati)

### 🔴 KRITIK (ishlashga to'sqinlik qiladi)
| # | Muammo | Manba/joy | Holat |
|---|---|---|---|
| K1 | F2 import o'ng panelda smeta daraxti ochilmaydi | Panel.html F2 modal | ❌ ochiq — KEYINGI birinchi ish |
| K2 | F2 import keraksiz tasdiqlashlar (mos kelsa ham so'raydi) | `f2AvtoMoslash` chaqirilishi/mantiqiy | ❌ ochiq — real testda tekshirish |
| K3 | Замена qator ro'yxat oxiriga tushadi (kerak: o'z razdeli ichiga) | `apiF2Qolla`/`apiBlQosh` targetRow | ⚠️ tuzatish kiritilgan (razdel-tanlash modali), real test YO'Q |
| K4 | Замена resurslari (material/mexanizm bolalari) yo'qoladi | F2 import → apiBlQosh | ⚠️ qisman ishlangan, test YO'Q |
| K5 | Yangi oy yaratilganda darhol "kiritilgan" status | status/foiz hisoblovchi joy topilmagan | ❌ ochiq — reproduksiya kerak |

### 🟠 MUHIM (funksional kamchilik)
| # | Muammo | Holat |
|---|---|---|
| M1 | Multi-lokalka obyektlarni JAMLAB ko'rish (14 smeta = 1 oyna) | ❌ ochiq — III qism §3.4 dizayni |
| M2 | Ierarxiya tabi barcha obyektni birdan tortsin | ❌ ochiq — navbat pattern bilan |
| M3 | Reestr ⇄ Shartnoma tablari dublikat — birlashtirish | ❌ ochiq — qaror + migratsiya |
| M4 | Shaxsiy smeta F2-import uslubida (chapda qidiruv → o'ngga tortish + razdel) | ❌ ochiq — UI qayta dizayn |
| M5 | "Lot qo'shish" tugmasi ishlamaydi | ❌ ochiq — hali qidirilmagan |
| M6 | Sozlamalarda universal AI API kalit (istalgan provayder) | ❌ ochiq — OpenAI-compatible adapter |
| M7 | Накрутка falsafasi (A yoki B) — foydalanuvchi qarori | ❓ savol berildi, javob kutilmoqda |
| M8 | М/К, КАБ, БЕЗСКЛАД ustunlari hech qachon to'ldirilmaydi → накрутка kabel/М-К qatorlari doim 0 | ❌ ochiq — UI kerak yoki ataylab shunday |
| M9 | НАРХ ТАЙЁР obyektlarda "faqat struktura" to'g'ri ishlashini tekshirish | ⚠️ qurilgan, chuqur test YO'Q |

### 🟡 TIZIMIY (arxitektura qarzi — III qism hal qiladi)
| # | Muammo |
|---|---|
| T1 | O'qish kodi 7 joyda takrorlangan (§2.2) — yagona `lrvOqi()` kerak |
| T2 | Yozish kodi 6 joyda takrorlangan — yagona `lrvYoz()` kerak |
| T3 | DASHBOARD⇄LRV kelishuv nazorati yo'q (§2.3) — avto-solishtirish kerak |
| T4 | AI qatlam (65-78) sinovdan o'tmagan, SelfTest qamrovida emas |
| T5 | `document is not defined @ test.gs` — jonli kodda YO'Q (tasdiqlangan); qayta chiqsa alohida bog'langan skript qidirilsin |
| T6 | Supabase o'quvchilari (70/71) marker/kategoriya qoidalariga mosligi tekshirilmagan |

### Yechilgan deb TASDIQLANGAN bo'shliqlar (eski G-ro'yxatdan)
- G1 (F2 import) — mexanizm qurilgan, lekin K1-K5 tugamaguncha "yopilgan" emas.
- Qolganlari o'z kuchida: G2 (КС-2/КС-3 generatsiya), G3 (sklad chiqim to'liq ledger),
  G4 (Akt↔smeta work-key), G5 (Frontend), G6 (Gantt/muddat), G7 (AI prognoz).

---

# III QISM — YANGI LEGO ARXITEKTURA (qayta yig'ish)

## 3.1. Printsip: "Bitta lego — bitta vazifa, ulanish faqat kontrakt orqali"

Hozirgi muammo legolarning ko'pligi emas — **ularning bir-biriga TARTIBSIZ ulanganida**.
Har modul LRV'ni O'ZICHA o'qiydi/yozadi. Yangi tartib — qat'iy qatlamlar:

```
┌────────────────────────────────────────────────────────────────┐
│ L5 KO'RSATISH   Panel · Boss · Telegram · Frontend(Next.js)    │
│     ▲ faqat L4/L2 API orqali. LRV'ga BEVOSITA tegmaydi.        │
├────────────────────────────────────────────────────────────────┤
│ L4 AGREGATSIYA  DASHBOARD · _KESH · Supabase mirror            │
│     ▲ faqat L2 lrvOqi() natijasidan yig'adi. O'z o'quvchisi YO'Q│
├────────────────────────────────────────────────────────────────┤
│ L3 YOZISH       lrvYoz() — fakt/F2/qo'shimcha yozishning       │
│     YAGONA eshigi (formula ta'minlash + invalidatsiya ICHIDA)  │
├────────────────────────────────────────────────────────────────┤
│ L2 O'QISH       lrvOqi() — LRV'dan o'qishning YAGONA eshigi    │
│     (marker normalize, kategoriya, leaf/rollup — BIR joyda)    │
├────────────────────────────────────────────────────────────────┤
│ L1 HAQIQAT      LRV_PLUS fayllari (накопительная ведомость)    │
│     ✅ YARATISH HAL QILINGAN — endi muqaddas, faqat L3 yozadi  │
├────────────────────────────────────────────────────────────────┤
│ L0 MANBA        Excel lokalka + svodka + F2 aktlar (read-only) │
└────────────────────────────────────────────────────────────────┘
AI qatlam (65-78): L2 dan o'qiydi, L3 orqali yozadi — istisno YO'Q.
```

## 3.2. L2 — `lrvOqi()` (eng muhim yangi lego, T1 davosi)

`10_Engine.js` (yoki yangi `12_LrvIO.js`) ichida BITTA funksiya:

```js
/* LRV varag'ini O'QISHNING YAGONA STANDARTI.
 * Qaytaradi: rows[] — har qator uchun:
 *   {row, marker, isQosh, nom, birlik, kod, e, f, narx,
 *    kat,            // 'ЧЕЛ'|'МАШ'|'МАТ'|'ОБ'|'М/К'|'КАБ'|'?' — BIR joyda aniqlanadi
 *    smeta, stFakt, stF2, stOst, fakt, f2ol, f2mum,
 *    tur}            // 'rz'|'bl'|'rs'|'mat'|'ob' (+ tashlab bo'lingan)
 * opts: {faqatLeaf:true} — rs/mat/ob;  {daraxt:true} — rz→bl→rs tree quradi. */
function lrvOqi(sh, opts) { ... }
```

Keyin **7 ta o'quvchining hammasi** (`serverYozFile`, `apiTashxis`, `apiBossObyekt`,
`_resurslarYig`, Supabase push, `apiHolatOl` daraxt qismi) shu funksiyaga o'tkaziladi.
Marker `+` qoidasi, kategoriya aniqlash, start-qator — **bir marta, bir joyda**.
Yangi qoida kelsa — bitta funksiya o'zgaradi, hamma iste'molchi avtomatik oladi.

**Migratsiya xavfsizligi:** bittadan o'tkaziladi, har o'tkazishdan keyin eski natija bilan
yangi natija RAQAMLAB solishtiriladi (bitta obyektda smeta/fakt/f2 jamilari aynan teng
bo'lishi shart), keyin eski kod o'chiriladi. `98_SelfTest`ga `selftestLrvOqi()` qo'shiladi.

## 3.3. L3 — `lrvYoz()` (T2 davosi)

Fakt/F2/narx yozishning yagona eshigi:
```js
function lrvYoz(sh, edits){
  // 1) qiymatlarni yozadi (obyom/narx/fakt)
  // 2) HAR DOIM: _oyFormulaToldur + _oyYigindiFormulalarYangila (ta'mirlash ichida!)
  // 3) HAR DOIM: _holatInvalidate + serverYozFile (DASHBOARD darhol yangi)
  // 4) HAR DOIM: _sbDirty (Supabase keyingi sinxda oladi)
}
```
Bugungi `apiHolatSaqla` tuzatishi (oyYozildi→ta'mirlash) shu g'oyaning birinchi qadami —
uni rasmiy qatlamga aylantirish kerak. `apiF2Qolla`, `apiRsQosh`, `apiBlQosh` ham shu
eshikdan o'tsin.

## 3.4. L4 — Kelishuv nazorati (T3 davosi)

`98_SelfTest.js`ga yangi invariant: **har obyekt uchun**
`|KPI_smeta − DASHBOARD_smeta| < 1 so'm` (ikkalasi lrvOqi'dan kelgani uchun ta'rifan teng
bo'ladi — test bu holatni QULFLAB qo'yadi, kelajak regressiyani ushlaydi). Anomaliya
skanerga qo'shiladi: farq chiqsa → `anomaliya` jadvali + Telegram ogohlantirish.

## 3.5. Multi-lokalka JAMLASH (M1 dizayni)

`apiHolatOl(parent)` allaqachon `_subObyektlar()` bilan bolalarni biladi (apiOyQosh shunday
ishlaydi). Xuddi shu pattern:
1. Parent tanlansa → har sub-obyekt `apiHolatOl` (keshdan, tez) → daraxtlar `[{lokalka:'…',
   tree:[…]}]` shaklida birlashtiriladi; har RZ tuguni oldiga lokalka nomi badge.
2. KPI = barcha sub-KPI yig'indisi.
3. Yozish (fakt/F2) o'z lokalkasiga boradi — `varaq` maydoni allaqachon `subOb||varaq`
   formatini qo'llaydi (`apiHolatSaqla` 1605-qator) — TAYYOR mexanizm, faqat UI ulash kerak.

## 3.6. Reestr ⇄ Shartnoma birlashtirish (M3 dizayni)

Ikkala funksiya "obyekt bo'yicha shartnoma/hujjat ro'yxati" vazifasini bajaradi.
**Qaror-tavsiya:** SOZLAMALAR_ШАРТНОМА (varaq) — yagona manba bo'lib qoladi (audit
qilinadi, ko'rinadi, Supabase'ga sinxlanadi); Reestr'ning Document-Properties JSON'i
o'qilib, bir martalik migratsiya bilan ШАРТНОМА varag'iga ko'chiriladi; Reestr tabi
o'chirilib, Шартнома tabiga "reestr ko'rinishi" (jadval) qo'shiladi.

## 3.7. Universal AI kalit (M6 dizayni)

`00_AI_Gateway.js`da allaqachon Groq (OpenAI-compatible) klienti bor. Kengaytirish:
- Script Property: `AI_PROVIDER` = `groq|gemini|openai|custom`, `AI_BASE_URL`, `AI_MODEL`, `AI_KEY`.
- `aiCall()` zanjiri: custom provider (agar sozlangan) → Groq → Gemini. OpenAI-compatible
  `/chat/completions` format deyarli barcha provayderni qamraydi (OpenAI, DeepSeek, Mistral,
  OpenRouter, local Ollama). Sozlamalar tabida: provider dropdown + base URL + model + kalit.
- Kalit HECH QACHON kodda emas — faqat Script Property (buzilmas qoida).

---

# IV QISM — REJA: 0 → 100 (fazalar, har biri "qanday" bilan)

> Foydalanuvchi yo'nalishi: *"LRV_PLUS yaratish hal bo'ldi — endi undan TO'G'RI O'QISH
> va unga TO'G'RI YOZISH darajasiga chiqamiz."* Reja aynan shunga qurilgan.

## FAZA A — F2 OQIMINI YOPISH (1-2 kun ish, eng shoshilinch)
*Maqsad: foydalanuvchi F2 aktini import qilib, natijani panelda TO'G'RI ko'rsin.*

1. **K1** — F2 import o'ng panel daraxti: `Panel.html` F2 modalida smeta daraxti
   yuklanish zanjirini (apiHolatOl chaqiruvi → render konteyner) debug qilish.
   *Qanday:* brauzer konsoli + `drawF2Node` oqimini tekshirish; katta ehtimol modal
   ochilganda `CUR_OB` bo'sh yoki konteyner ID ziddiyati.
2. **K2** — `f2AvtoMoslash` real faylda test: nega 100% mos qatorlar so'ralmoqda —
   indeks kaliti (kod/nom+birlik normalize) F2 fayl qiymatlari bilan solishtirib log qilish.
3. **K3+K4** — zamena joylashuvi va resurslari: real F2 fayl bilan sinov, `apiBlQosh`
   insert pozitsiyasi va `_ISHTURLAR` kutubxonasidan resurs bolalarini ko'chirish.
4. **K5** — "yangi oy = kiritilgan" statusi: reproduksiya → manba topish → tuzatish.
5. Har qadamdan keyin: bitta obyektda `[Ишла]` → KPI/DASHBOARD raqamlarini solishtirish.

## FAZA B — LEGO QAYTA YIG'ISH (2-3 kun, tizimiy davo)
1. `lrvOqi()` yozish + 7 o'quvchini birma-bir ko'chirish (§3.2, har birida raqam-tenglik testi).
2. `lrvYoz()` yozish + 6 yozuvchini ko'chirish (§3.3).
3. Kelishuv invarianti SelfTest'ga (§3.4).
4. **M7 qarori** (накрутка A/B) — foydalanuvchidan olib, tegishlicha ulash.
5. Supabase o'quvchilarini (T6) lrvOqi'ga o'tkazish.

## FAZA C — PANEL UX YAKUNLASH (2-3 kun)
1. **M1** multi-lokalka jamlangan ko'rinish (§3.5).
2. **M3** Reestr⇄Shartnoma birlashtirish (§3.6).
3. **M4** shaxsiy smeta F2-uslub UI (chapda kutubxona qidiruv, o'ngda qurilayotgan smeta
   daraxti, razdel qo'shish tugmasi — F2 importdagi kod bazasidan 70% qayta ishlatiladi).
4. **M2** Ierarxiya "hammasini tort" (navbat pattern).
5. **M5** Lot tugmasi (topish→tuzatish yoki olib tashlash), **M8** М/К-КАБ belgilash UI
   (yoki foydalanuvchi "kerak emas" desa — накрутка jadvalida "0 — belgilanmagan" izohi).

## FAZA D — HUJJAT ZANJIRI (keyingi hafta)
1. **G2** КС-2/КС-3 avto-generatsiya: LRV oy ustunidan rasmiy forma (template Sheets →
   PDF eksport, `03_ARXIV_F2`ga saqlash).
2. **G4** Akt↔smeta barqaror work-key (`obyekt||KOD||normNom`) + coverage foizi.
3. **G3** sklad chiqim (расход) ledger yakunlash + qoldiq nazorati.
4. **M6** universal AI kalit (§3.7).

## FAZA E — KAFTDAY KO'RINISH (frontend, parallel Antigravity)
1. **G5** Next.js: Supabase'dan dashboard, anomaliya, buxgalteriya, viborka ko'rinishlari.
2. **G6** muddat/Gantt: LRV'ga boshlanish/tugash sana ustunlari (RZ darajasida) + frontend timeline.
3. **G7** AI prognoz: oylik F2 trend → tugash muddati/byudjet chetlashish bashorati
   (mavjud oyTrend ma'lumoti yetarli boshlanish uchun).

## Muvaffaqiyat mezonlari (qachon "100" deymiz)
- [ ] F2 akt import → 5 daqiqadan kam vaqtda, ≤3 qo'lda aralashuv bilan panelga tushadi.
- [ ] KPI = DASHBOARD = Накрутка bazasi — bitta obyektda uchchalasi 1 so'mgacha mos (invariant test o'tadi).
- [ ] 14-lokalkali obyekt bitta oynada jamlangan ko'rinadi.
- [ ] `selftestBarcha()` — 121+ funksiya + yangi invariantlar hammasi ✅.
- [ ] Yangi oy yaratish → status "0% kiritilgan"dan boshlanadi.
- [ ] Har oy yakunida КС-2 rasmiy forma bir tugma bilan chiqadi.
- [ ] Frontend'da rahbar telefondan barcha obyekt holatini ochadi.

---

# V QISM — ISH TARTIBI (multi-agent, BUZILMAS)

1. **Har seans boshida `clasp pull`** — jonli manba clasp, git emas. `git checkout <fayl>` /
   `git reset --hard` TAQIQLANGAN (2 marta falokat bo'lgan).
2. **Push'dan oldin** `selftestFunksiyalar()` — birorta ham "ТОПИЛМАДИ" bo'lmasin.
3. **Marker qoidasi:** LRV markerini o'qiydigan har kod `.replace(/\+$/,'')` qiladi.
   FAZA B tugagach bu qoida `lrvOqi()` ichiga ko'chadi va unutish imkonsiz bo'ladi.
4. **Motor muqaddas:** `_findPrice`, `_priceDB`, `_normNomKey`, `_cfgKalit/_cfgMos`,
   `_ishlaObyekt`, occurrence-key mexanizmi — faqat kelishilgan o'zgarish.
5. **"Tuzatdim" ≠ tuzatildi:** har fix real obyektda `[Ишла]`/import bilan RAQAMLAB
   tekshiriladi — foydalanuvchiga faqat tasdiqlangan natija aytiladi.
6. **Maxfiy kalit hech qachon kodda emas** — faqat Script Property.
7. **`clasp push` ≠ deploy:** jonli /exec uchun `clasp deploy -i AKfycbx0tzNBlYP...`
   — har safar foydalanuvchining ANIQ ruxsati bilan.
8. **Hudud:** Claude — backend/audit/L2-L3 qatlam; Antigravity — frontend/UI (Panel.html
   render, Next.js). Ikkalasi `10_Engine`/`05_Papka`ga ehtiyot bilan.

---

# VI QISM — QISQA XULOSA (bir sahifada)

**Qayerdamiz:** L1 (LRV yaratish) — dunyo darajasida mustahkam. Kasallik — L2/L4
(o'qish/agregatsiya) tarqoqligida: 7 ta mustaqil o'quvchi, har biri o'z xatosi bilan,
natijada "10 mlrd vs 9.77 mlrd" kabi sirli deltalar.

**Nima qilamiz:** (1) F2 oqimini yopamiz (FAZA A — foydalanuvchining kundalik ishi);
(2) legolarni qayta yig'amiz — `lrvOqi()`/`lrvYoz()` yagona eshiklar + kelishuv invarianti
(FAZA B — kasallikning davosi); (3) UX yakunlaymiz (FAZA C); (4) hujjat zanjiri (FAZA D);
(5) frontend kaftday ko'rinish (FAZA E).

**Dunyo bilan:** Procore printsipi (yagona haqiqat) — FAZA B bilan erishamiz; 1C КС-2
hujjat oqimi — FAZA D; Fieldwire mobil qulayligi — Telegram bilan allaqachon bor;
Primavera vaqt o'lchovi — FAZA E'da boshlanadi.

**Birinchi qadam (hoziroq):** K1 — F2 import o'ng panel daraxti. Keyin K2-K5 real fayl
bilan test. Shundan keyingina FAZA B.

_Yangilanish tartibi: har faza yakunida shu hujjat va `TIZIM_XARITASI_VA_REJA.md` yangilanadi._
