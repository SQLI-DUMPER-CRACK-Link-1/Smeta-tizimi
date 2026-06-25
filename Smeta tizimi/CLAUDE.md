# SMETA GAS — Loyiha Holati va Arxitektura

> **Yangi chatda ham o'qi** — bu fayl loyihaning to'liq xotirasini saqlaydi.
> Har muhim o'zgarishdan keyin yangilanishi kerak.
> **Oxirgi yangilanish: 2026-06-11** (CONSTANTA narxlash #46 — faqat EXACT, fuzzy yo'q; har obyekt ЧЕЛ-Ч/МАШ-Ч stavka; ЖАМИ 2x #44, FAKT/F2 occurrence #45)

---

## Tizim nima?

Google Apps Script (GAS) bilan yozilgan **qurilish smeta avtomatlashtirish tizimi**.

**Asosiy jarayon:**
1. Drive papkasidagi har ob'ekt uchun: Excel lokalka + Excel svodka (narx baza)
2. GAS lokalka + svodkani o'qib, `Ob'ekt_LRV_PLUS` Google Sheets fayl yaratadi
3. LRV_PLUS: narxlangan resurslar, kategoriyalar, FAKT/F2 tracking
4. SERVER_DASHBOARD: barcha ob'ektlarning jami ko'rsatkichlari
5. **NARXLAR** varaqi: barcha resurslar uchun markaziy narx boshqaruvi (har ob'ekt ustuni)
6. **_KESH** varaqi: panel tezligi uchun skan ma'lumotlari
7. **Web App**: Login → Admin panel / Rahbar dashboard
8. **Telegram bot**: ko'rish + yozish (native tugmalar + WebApp)
9. **Tashqi hujjatlar**: Akt, Prixod, Viborka (mustaqil)

---

## Drive Strukturasi

```
Root: 1-VfeA6NTIKtSfLHHztRvAlFAasZantvD
  SMETA_TEST_V1 (SS, ID: 18mixKyl59e7spYtTZEBdseRIeH5JnjWdHehoCIvJqos) ← GAS scripti
  Smeta/ (papka, ID: 1PpCaWWV47S_NlqD2cSeJQTjtzao6G09y) ← ROOT_FOLDER_ID
    _SERVER_DASHBOARD (ID: 1y83-TFh3X-qx2kSQlgojQExPe2gSXEa1Wk4klAsS8rs)
    Amfiteatr/     (format=TN,  LOCKED) — ID: 1BYbWmnkTyYXVf_cCpQvVQ1SsoUB_0jHP
    GAME CLUB/     (format=ABC4)         — ID: 1R8G4pWhDGCYAnNYiVka-seLzImWULK1M
    Karting/       (format=ABC4, LOCKED) — ID: 1KZxruhra3qWvIUpLP9Sv0UZcuhOP8EvC
    Otalar choyxonasi/ (format=ABC4)     — ID: 1GZFI0QkXkt_AaqkDty3uR0gvqoBZ_Fcg
    Sovg'alar do'koni/ (format=ABC4)     — ID: 1Cj4YD2u1tf8UK2VeuZ_0tGsibBA59Et3
    Turk oshxonasi 2sht/ (format=ABC4)  — ID: 1LugeC7OsLXYsCz2Kf3CAADXUq6yGoG-Z
    YEVROPA OSXONASI/  (format=TN)      — ID: 1VVJzSHIrP2xdzVGj_qtJAPoAnGDMx-A2
```

---

## Lokal Fayllar: `C:\Users\PC\Documents\GAS\`

| Fayl | Vazifa |
|------|--------|
| `00_Config.js` | CFG ob'ekti — ustun raqamlari, kalit so'zlar, SVOD konfiguratsiya |
| `01_Sozlamalar.js` | SOZLAMALAR varaqlarini yaratish (default qiymatlar) |
| `02_Menu.js` | `onOpen()` menyu + kesh yangilash |
| `05_Papka.js` | Drive skan, lok/svod/sheet tanlash, format, `apiSheetlarOl` |
| `10_Engine.js` | Asosiy dvigatel — LRV_PLUS yaratish, narxlash, oraliq tizimi |
| `15_IshTurlar.js` | Ish turlari kutubxonasi (bl+rs massivlar, qidiruv, qo'shish) |
| `20_Server.js` | DASHBOARD ga jami yozish |
| `25_Kesh.js` | Kesh tizimi — `_KESH` varaqda JSON saqlash |
| `30_Panel.js` | Web App router + barcha panel API |
| `40_Telegram.js` | Telegram bot — webhook, native buyruqlar, WebApp tugmalari |
| `45_Hujjatlar.js` | Tashqi hujjatlar — Akt, Prixod, Viborka |
| `50_Navbat.js` | Fon navbat (trigger) — timeout yo'q, avtomatik dashboard/kesh |
| `60_Maslahatchi.js` | AI maslahatchi — Claude API (UrlFetchApp), holatdan xulosa |
| `70_Supabase.js` | GAS → Supabase mirror (Postgres) — bir tomonlama push |
| `supabase_schema.sql` | Supabase jadval sxemasi (SQL Editor da RUN qilinadi) |
| `Login.html` | Kirish sahifasi — Admin / Rahbar tanlov |
| `Panel.html` | Admin boshqaruv paneli (dark, 7 tab) |
| `Boss.html` | Rahbar dashboard (chartlar, drill-down) |

**clasp scriptId:** `1fcGIysmTyIy2J-etZrVnxRMCzqbwACdlWfRhXc9ERT3r7fyCi6-98B6h`

---

## Web App — URL va Sahifalar

```
Web App URL: https://script.google.com/macros/s/AKfycby.../exec

(default)   → Login.html    (Admin / Rahbar tanlov)
?p=admin    → Panel.html    (to'liq boshqaruv)
?p=boss     → Boss.html     (rahbar dashboard, read-only)
```

**MUHIM:** `clasp push` dan keyin har safar **Deploy → Manage deployments → Edit → New version** kerak!

**URL Script Property da saqlanadi:**
```js
webAppUrlSet('https://...exec')  // bir marta ishga tushirish
```

---

## SMETA_TEST_V1 ichidagi varaqlar

| Varaq | Ko'rinadimi | Vazifa |
|-------|-------------|--------|
| SOZLAMALAR | Ha | ROOT_FOLDER_ID, DATA_QATOR, NARX_MANTIQ |
| SOZLAMALAR_KATEGORIYA | Ha | BLOK nomlari, KW kalit so'zlar, OVERRIDE |
| SOZLAMALAR_НАРХ | Yo'q | Eski narx jadvali |
| SOZLAMALAR_ҚУЛФ | Ha | Lock holati (ob'ekt / locked / sana) |
| SOZLAMALAR_BOGLASH | Yo'q | Puzzle: lok/svod ID, format, sheet tanlovi, **svod ustun xaritasi (I-L)** |
| SOZLAMALAR_ОРАЛИҚ | Yo'q | Seksiya oraliqlar (ob'ekt/varaq/qator/kat/sarlavha) |
| **NARXLAR** | **Ha** | **NOM\|BIR\|KAT\|BELGILANGAN\|[ob'ekt ustunlar]\|[sana]\|TIZIM** |
| РАЗДЕЛЛАР | Ha | RZ nomlar + D1-D5 (qavat taqsimoti) |
| DASHBOARD | Ha | Barcha ob'ektlar ko'rsatkichlari |
| _KESH | Ha | Panel keshi (JSON, max 45000 belgi) |
| _ISHTURLAR | Yo'q | Ish turlari kutubxonasi |

---

## LRV_PLUS Ustun Tuzilishi

```
A=NO  B=KOD  C=NOM  D=BIRLIK  E=HAJM(ed)  F=HAJM(jami)
G=NARX  H=SMETA  I=MARKER(rz/bl/rs/mat/+)
J=ЧЕЛ  K=МАШ  L=МАТ  M=ОБ  N=BEZSKLAD  O=М/К  P=КАБ
Q=FAKT  R=QOLDIQ  S=F2_OLINGAN  T=F2_MUMKIN
U=QAVAT1  V=QAVAT2  W=QAVAT3  X=VID_RABOT  Y=RAZDEL
Z=ST_RES  AA=ST_FAKT  AB=ST_F2  AC=ST_OST
AE+=Oylik F2 ustunlari
```

**Qator turlari (MARKER = I ustun):**
- `rz` — Razdel (sarlavha). Nomi: I=rz → A→H dan birinchi HARFLI katak
- `bl` — Ish turi (расценка). Resurslar (rs) uning ostida
- `rs` — Resurs (ЧЕЛ-Ч, МАШ-Ч, material). F = bl.E × rs.E formula
- `mat` — Mustaqil material (bl siz)
- `bl+`, `rs+`, `mat+` — Qo'shimcha ishlar (smeta tashqari, sariq rang)

---

## NARXLAR Varaqi Tuzilishi (yangilangan)

```
A=NOM | B=BIRLIK | C=KAT | D=BELGILANGAN | E=Ob1 | F=Ob2 | ... | SMETA_MAX | [sana] | TIZIM

Har ob'ekt alohida ustunda — MANBA ko'rinadi.
SMETA_MAX = MAX(ob'ekt ustunlari)
TIZIM = MAX(BELGILANGAN, SMETA_MAX, sana narxlar)
```

**Muhim:**
- `apiNarxlarYarat()` → ob'ekt ustunlarini yaratadi/yangilaydi
- `_narxlarHisob()` → faqat NARXLAR varaqidan o'qiydi (tashqi fayl ochilmaydi)
- Panel Narxlar tabi → deyarli zudlik bilan ochiladi
- KAT ustuni user tomonidan o'zgartirilsa `apiNarxlarYarat` qayta yozMaydi
- `_narxTizimBatch(sh)` → TIZIM formulalarini barcha qatorga 1 API callda

---

## Oraliq Tizimi (SOZLAMALAR_ОРАЛИҚ)

Svodka seksiya chegaralari bir marta saqlanadi → `_priceDB` ishlatadi.

```
Panel Ob'ektlar tab → [⚙ Оралиқ] → modal ochiladi:
  - Svodka skanlanadi → seksiya sarlavhalari topiladi
  - User kategoriyalarni tekshiradi (ЧЕЛ/МАШ/МАТ/ОБ)
  - Сақлаш → SOZLAMALAR_ОРАЛИҚ ga yoziladi
  - Keyingi Ишла da _priceDB hasRanges=true → oraliqlar ishlatiladi
```

---

## Svod Ustun Xaritasi (har svodka uchun — 2026-06 dan)

```
MUAMMO: SVOD_TN/SVOD_ABC global ustun raqamlari har svodkaga to'g'ri kelmaydi.
  Masalan Amfiteatr ekrani: NARX ustunidan DONA narx o'rniga JAMI qiymat
  o'qilib, ×miqdor = 229 mlrd shishish.

YECHIM: har obyekt svodkasi uchun ustunlar QO'LDA belgilanadi.
  SOZLAMALAR_BOGLASH I-L: СВОД_НОМ_УСТ / БИР_УСТ / НАРХ_УСТ / БЛОК_УСТ (1-based).
  _svodCfg(ob) → svodCols bo'lsa ishlatadi, aks holda format default (SVOD_TN/ABC).

UI: Файл боғлаш → СВОД → [🔬 Устун] → modal:
  apiSvodOldindan(ob) → svodka yuqori 22 qator × 16 ustun ko'rsatiladi (raqamli sarlavha)
  user НОМ/БИРЛИК/дона НАРХ/БЛОК ustun raqamini belgilaydi (НАРХ ustunini bosib ham)
  apiSvodUstunSaqla(ob, svodCols) → saqlaydi → [Ишла] qayta narxlaydi

_priceDB, apiOraliqlarSkan, apiRsQosh hammasi _svodCfg(ob) ishlatadi.
```

---

## Narxlash Algoritmi (_findPrice)

```
⚡⚡⚡ CONSTANTA NARXLASH (fix #46 — eng qatiy, yuridik muhim):
Narx topishning YAGONA yo'li — narx FAQAT shu obyekt svodkasidan, AYNAN moslik bilan.

USTUVORLIK (_findPrice):
1. ЗАТРАТЫ ТРУДА МАШИНИСТ → 0 (mashina tarkibida, alohida narxi yo'q)
2. SVODKA EXACT → nom (faqat son+harf) + birlik (aynan) mos → narx
3. HAR OBYEKT FIKSIRLANGAN ЧЕЛ-Ч / МАШ-Ч stavka (SOZLAMALAR_СТАВКА) — kiritilgan
   bo'lsa (>0) → svodkadan USTUN (barcha ЧЕЛ/МАШ resursga shu narx). Cross-obyekt EMAS.
4. topilmasa → MISS (narx 0) → _NARX_LOG → qo'lda beriladi (LRV_PLUS user ko'rib chiqadi)

❌ OLIB TASHLANGAN (fix #46): FUZZY (taxminiy moslik), FUZZY_CROSS, OVERRIDE-narx,
   NARXLAR БЕЛГИЛАНГАН-narx, FAKT cross-obyekt MAX. Bularning bari boshqa resurs/obyekt
   narxini aralashtirib QO'POL XATO berardi (ekranga umumiy narx). Endi MUMKIN EMAS.

NOM KALITI (_normNomKey): nomdan FAQAT son+harf qoldiriladi (probel/tinish/tire/qavs —
   hammasi tashlanadi), Lotin→Kirill, Ё→Е. "Бетон М-350, тяжёлый" == "БЕТОН М350 ТЯЖЕЛЫЙ"
   → "БЕТОНМ350ТЯЖЕЛЫЙ". Mazmun (son+harf) AYNAN mos bo'lsagina. So'z kam/ortiq → MISS.
BIRLIK (_normBirlik): м3=М3=m³, lekin кг≠т, шт≠1000шт (AYNAN bir xil).
_priceDB: byKey = _normNomKey+'||'+_normBirlik. byUnit/fuzzy/_fuzzyMatch O'CHIRILGAN.
   DONA NARX KAFOLATI saqlanadi: narx×qty≈summa (narx≈summa & qty>1 → narx=summa/qty, #39).

HAR OBYEKT СТАВКА (SOZLAMALAR_СТАВКА: ОБЪЕКТ|ЧЕЛ-Ч|МАШ-Ч):
  - _stavkaOl/_stavkaYoz; _ishlaObyekt → pdb.stavka; _findPrice cat ЧЕЛ/МАШ + stavka>0 → narx
  - Panel: Объектлар tab → [💰 Ставка] → modal (apiStavkaOl/apiStavkaSaqla)
  - GAME CLUB chel-ч=29ming, Amfiteatr=24ming — har obyekt alohida fiksirlanadi

NARXLAR varaq — endi faqat KATEGORIYA (C ustun, nkMap) tuzatmasi uchun (NARX EMAS):
  - bel>0 → kategoriya to'liq; tasdiqlanmagan → faqat МАТ ni boyitadi (ОБ/ЧЕЛ/МАШ tushmaydi)
  - _narxlarKatMap kaliti ham _normNomKey (mos kelishi uchun)
BIRLIK HIMOYASI(kat): ЧЕЛ-Ч→ЧЕЛ, МАШ-Ч→МАШ. KOD match O'CHIRILGAN.
```

---

## Tashxis / Diagnostika (apiTashxis — 30_Panel.js)

```
Maqsad: narx/miqdor shishishini (400→1T), 0-narx va topilmaganlarni o'lchash.

apiTashxis(obyekt) → {
  jamiSmeta, leaf, narxMantiq,
  katSum: {ЧЕЛ,МАШ,МАТ,ОБ,М/К,КАБ,?}    — kategoriya bo'yicha pul
  faktSmeta, faktSoni                    — FAKT-override (MAX) bilan shishgan summa
  top[40]                                — eng qimmat resurslar (absurd narx ko'rinadi)
  nol[]                                  — narx=0 lekin hajmi bor (qimmat material 0)
  miss[]                                 — _NARX_LOG dan narx topilmaganlar
}
apiTopilmaganlar(obyekt) → faqat miss + nol

Panel: Ҳолат tab → [🔍 Ташхис] → #tashxisBox da kategoriya/eng qimmat/0-narx/MISS.
ОБ kategoriya endi holat daraxtida rs qator oldida BADGE bilan ko'rsatiladi
  (marker I ustuni rs/mat bo'lib qoladi — formula rollup buzilmasin).
```

---

## Kesh Tizimi (CacheService — 2026-06-03 dan)

```
Avval: _KESH varaqida JSON (sekin o'qish, 45000 belgi limit → holat keshlanmasdi)
ENDI:  CacheService.getScriptCache() — xotirada, ~ms o'qish, gzip+chunk

Past-daraja API (25_Kesh.js):
  cachePut(key,obj,ttl) / cacheGet(key) / cacheDel(key)
  - gzip (Utilities.gzip) + base64 → JSON ~5-10x siqiladi
  - 100KB/kalit limitidan oshsa key__0/key__1... ga bo'linadi (putAll)
Eski API saqlanadi (ichi CacheService ga ulangan): _keshYoz/_keshOl(TTL 3600)/_keshOlStale

Nima keshlanadi:
  skan        → papkaSkan + har ob'ekt plusId (LRV fayl ID). DURABLE: _KESH
                varaqqa ham yoziladi (CacheService evict bo'lsa tiklash uchun)
  holat_<ob>  → apiHolatOl (gzip; faqat CacheService)
  boss_<ob>   → apiBossObyekt

Invalidatsiya (_holatInvalidate → holat_ + boss_ o'chiradi):
  apiHolatSaqla, apiOyQosh, apiBlQosh, apiRsQosh, apiObyektIshla,
  _ishlaObyekt, _qoshFaqatIshla (menyu yo'li ham qamralgan)

Warm-up (_keshWarmUp): skan + har ob'ekt holat/boss ni oldindan isitadi.
  Chaqiriladi: avtoYangilash (kunlik 06:00) + _navbatTugadi (navbat tugagach)

TEZLASHTIRISH (2026-06-03):
  - _plusTop endi keshdagi plusId → openById: har chaqiruvda Drive skani YO'Q
    (avval papkaSkan har _plusTop/apiHolatOl/Boss/Telegram da edi → 3-8 sek)
  - apiHolatOl format uchun keshdagi skanni ishlatadi (ortiqcha papkaSkan yo'q)
  - lockMap bitta ijro davomida memoize (_LOCKMAP_MEMO)
  - Panel/Boss boot: apiPanelInit / apiBossInit — bitta RPC (avval 3-4 ta)
```

---

## Panel Tablari (Panel.html) — 7 tab

| Tab | Vazifa |
|-----|--------|
| **Ҳолат ва Ф2** | Daraxт (RZ→BL→RS), FAKT/F2 kiritish, KPI (pul + %), oraliq qo'shish |
| **Нархлар** | Narx boshqaruvi — har ob'ekt ustuni, KAT dropdown, xavf belgisi |
| **Иерархия** | РАЗДЕЛЛАР D1-D5 ko'rish, "📥 LRV ga qo'y" |
| **Ҳужжатлар** | Akt (ko'rish+yozish), Prixod (ko'rish+yozish), Viborka (ko'rish) |
| **Файл боғлаш** | Lok/svod fayllarini tanlash, format (TN/ABC4), [🔬 Устун] svod ustun belgilash |
| **Объектлар** | Grid kartalar, [⚙ Оралиқ], [Ишла], progress |
| **Созлама** | ROOT_FOLDER_ID, SERVER_ID, NARX_MANTIQ |

**Panel UX:**
- `Ctrl+S` — saqlash, `Ctrl+F` — qidiruv, `Esc` — tozalash
- Toast bildirishnomalar (alert o'rniga)
- Har BL da smeta pul badge
- Har BL da "➕ Шу ишдан кейин янги иш тури" tugmasi
- Ketma-ket ish qo'shish: modal yopilmaydi, yana qo'shaverasiz
- Kutubxonada yo'q ish: "➕ Янги иш тури яратиш" → bo'sh BL+ yaratadi
- RS qo'shish: har BL ostida "＋ RS" tugmasi
- Tree expand/collapse + real-time qidiruv

---

## Panel API Funksiyalari (30_Panel.js)

| Funksiya | Vazifa |
|----------|--------|
| `apiPanelInit()` | **Boot: skan + format + kesh + URL — bitta RPC** |
| `apiBossInit()` | **Boss boot: dashboard + URL — bitta RPC** |
| `apiPapkaSkan()` | Ob'ektlar ro'yxati (skan keshdan) |
| `apiObyektIshla(ob)` | Ob'ektni qayta ishlash |
| `apiHolatOl(ob)` | RZ→BL→RS daraxti (CacheService+gzip keshlanadi) |
| `apiHolatSaqla(ob, edits)` | FAKT/F2 oy yozish |
| `apiOyQosh(ob, oyNom)` | Yangi F2 oy ustuni |
| `apiNarxlarOl(filter)` | NARXLAR varaqidan o'qiydi (tez) |
| `apiNarxlarYarat()` | NARXLAR varaqi — ob'ekt ustunlari yaratadi |
| `apiNarxSanaQosh(edits)` | Sana + narx qo'shish |
| `apiNarxBelgilanganSaqla(nom,bir,val)` | D ustun saqlash |
| `apiNarxKatSaqla(nom,bir,kat)` | C ustun KAT saqlash |
| `apiBossData()` | DASHBOARD varaqidan jami ko'rsatkichlar |
| `apiBossObyekt(ob)` | LRV_PLUS dan kategoriya+RZ breakdown |
| `apiBlQosh(params)` | Bo'sh bl+ yaratish (kutubxonada yo'q ish uchun) |
| `apiRsQosh(params)` | Mavjud BL ga rs+ qo'shish |
| `apiOraliqlarSkan(ob)` | Svodka seksiya oraliqlarini aniqlash |
| `apiOraliqlarSaqla(ob, oraliqlar)` | SOZLAMALAR_ОРАЛИҚ ga yozish |
| `apiAktlarOl(limit, q)` | Akt reestri (45_Hujjatlar.js) |
| `apiAktYoz(data)` | Yangi akt qo'shish |
| `apiPrixodOl(limit, q)` | Kelgan materiallar ro'yxati |
| `apiPrixodYoz(data)` | Yangi prixod qo'shish |
| `_webAppUrl()` | Web App URL (Script Property dan) |

---

## Navbat / Fon Tizimi (50_Navbat.js)

```
MUAMMO: "Барчасини ишлаш" 6 daqiqa timeout → qotardi.
YECHIM: Har ob'ekt ALOHIDA trigger-execution da → yangi 6 daqiqa.

navbatBoshla(ob?) → Script Property NAVBAT ga ro'yxat, trigger after(2sek)
_navbatQadam()    → trigger: 1 ob'ekt oladi, ishlaydi, keyingi trigger
_navbatTugadi()   → serverYigPapka + apiKeshSkanYangilash avtomatik

apiBarchaFonIshla() / apiObyektFonIshla(ob) — panel chaqiradi
apiNavbatHolat()  → progress {running, qolgan, bajarilgan, foiz, hozir, log}
Panel: _navbatPoll() har 3 sek progress ko'rsatadi (UI bloklanmaydi)

AVTOMATIK TRIGGER:
  triggerlarOrnat() → har kuni 06:00 da avtoYangilash()
  avtoYangilash() → serverYigPapka + apiKeshSkanYangilash (LRV qayta ishlamaydi)
  TIZIM_SOZLASH ichida avtomatik o'rnatiladi
```

---

## AI Maslahatchi (60_Maslahatchi.js — Claude API)

```
GAS da Anthropic SDK yo'q → UrlFetchApp orqali raw HTTP:
  POST https://api.anthropic.com/v1/messages
  headers: x-api-key, anthropic-version: 2023-06-01
  model=claude-opus-4-8, thinking={type:adaptive}, max_tokens=5000

Sozlash (bir marta):
  Apps Script editor → Run: claudeKeySet('sk-ant-...')
  → ANTHROPIC_API_KEY Script Property ga saqlanadi

API:
  apiMaslahatObyekt(ob, force) → obyekt holatidan xulosa (smeta/факт/Ф2/
     kategoriya/razdel/oy dinamikasi → qisqa o'zbekcha tahlil + tavsiya)
  apiMaslahatDashboard(force)  → barcha obyektlar bo'yicha umumiy xulosa

Manba: apiBossObyekt (keshlangan) → kompakt matn summary → Claude.
Natija CacheService da keshlanadi (maslahat_<ob>); _holatInvalidate uni
  ham tozalaydi → saqlash/Ишла dan keyin keyingi bosishda qayta hisoblanadi.

Panel: Ҳолат tab → [🤖 Таҳлил] tugmasi → #aiBox da ko'rsatiladi (↻ янгилаш).
Sozlamalar (60_Maslahatchi.js boshida): CLAUDE_MODEL (sonnet'ga o'tkazsa
  bo'ladi), CLAUDE_MAXTOK, CLAUDE_THINKING.
```

---

## Supabase Integratsiya (70_Supabase.js — bir tomonlama mirror)

```
ARXITEKTURA: GAS+Sheets = DVIGATEL (formulalar) → Supabase = tez o'qish
qatlami (realtime + tarix + Auth + Storage). Frontend Supabase'dan o'qiydi.

GAS da SDK yo'q → UrlFetchApp orqali PostgREST (REST).
Yozish: service_role kalit (maxfiy, Script Property: SUPABASE_URL/SUPABASE_KEY).
Frontend: anon kalit + RLS (faqat authenticated o'qiydi).

Jadvallar (supabase_schema.sql):
  obyektlar  → dashboard darajasi (realtime)
  holat      → bl/mat/rs qatorlar (drill-down)
  oylik_f2   → oylik Ф2 trend
  tarix      → FAKT/Ф2 o'zgarishlar jurnali (append-only audit)
  narxlar    → markaziy narx

Push funksiyalari:
  supabaseObyektPush(ob)  / supabaseDashboardPush() / supabaseNarxlarPush()
  supabaseTarixYoz(ob,..) / supabaseToliqSinx() (qo'lda to'liq yuklash)

Avtomatik hook'lar (Supabase sozlanmagan bo'lsa NO-OP, tizimga ta'sirsiz):
  _ishlaObyekt (Ишла) → supabaseObyektPush
  apiHolatSaqla        → supabaseTarixYoz + supabaseObyektPush
  _navbatTugadi / avtoYangilash → supabaseDashboardPush + supabaseNarxlarPush

Sozlash (bir marta):
  1) Supabase loyiha → SQL Editor → supabase_schema.sql ni RUN
  2) Settings → API → Project URL + service_role key
  3) Apps Script editor → Run:
       supabaseSozlash('https://xxx.supabase.co','service_role_key')
       supabaseTest()         // ulanish
       supabaseToliqSinx()    // birinchi to'liq yuklash
       supabaseTriggerOrnat() // SOATLIK + kunlik 03:00 avtomatik sinx
  4) Auth: Dashboard → Authentication → Email/Password yoq
     Storage: Dashboard → Storage → bucket yarat

Keyingi bosqich: Frontend (veb/mobil) — anon kalit + Supabase Auth +
  realtime subscribe → lahzada/realtime panel.
```

---

## ШАРТНОМА (Dogovor) Qatlami (80_Shartnoma.js — 2026-06-12 dan)

```
IYERARXIYA: ШАРТНОМА (dogovor) → OBYEKTLAR + ҚЎШИМЧА ИШЛАР (subpodryad).
HAMMASI UI ORQALI (panel 📜 Шартнома tab) — hardcode YO'Q (bozorbop talab).

Varaqlar (SMETA_TEST_V1):
  SOZLAMALAR_ШАРТНОМА      → reestr: NO|НОМИ|ТАРАФ|СУММА|НДС|ЖАМИ|ҲОЛАТ|ИЗОҲ
  SOZLAMALAR_ШАРТНОМА_БОГ  → ОБЪЕКТ|ШАРТНОМА_NO (biriktirish)
  ҚЎШИМЧА_ИШЛАР            → ШАРТНОМА_NO|НОМИ|СМЕТА|ФАКТ|Ф2_ОЛ|Ф2_МУМ|ИЗОҲ
                              (Бронза VIP ART kabi — summalar QO'LDA)
  SOZLAMALAR_НАКРУТКА      → koeffitsientlar % (UI dan tahrirlanadi)

НАКРУТКА zanjiri (nakrutkaHisob — user eski F2 podvalidan, 20 qator):
  ПРЯМЫЕ(ЧЕЛ+МАШ+МАТ+ОБ) → трансп.мат 5% (МАТ−КАБ) → склад 2% + М/К 0.75% →
  трансп.каб 1.5% → ИТОГО1(оборудсиз) → ПРОЧИЕ 18% → ИТОГО2 → ОБОРУД+трансп 2%
  +загот 1.2% → ИТОГО3 → СТРАХ 0.32% + РИСК → ИТОГО4 → НДС 12% → ВСЕГО

API (30_Panel orqali run): apiShartnomaOl/Saqla/Ochir, apiShartnomaBogOl/Saqla,
  apiQoshIshOl/Saqla/Ochir, apiNakrutkaOl/Saqla, apiShartnomaDashboard
  (rollup — DASHBOARD varaqdan tez o'qiydi, LRV ochmaydi).

Eski tizim konteksti (01_Tizim/00_BOSH/README.md, ф2 реестр.xlsx):
  3 dogovor guruhi amalda: Исскуственное озера / Стелла / Амфитеатр.
  ф2 реестр: ~169.5 mlrd F2 olинган (По смета ustuni = dogovor mapping).
```

---

## Telegram Bot (40_Telegram.js)

**Sozlash (bir marta):**
```js
// Apps Script editor → Run: TIZIM_SOZLASH
// Token va URL Script Property ga yoziladi, webhook o'rnatiladi
```

**Script Properties:**
- `TG_TOKEN` — bot tokeni
- `TG_ADMINS` — vergul bilan ajratilgan admin user ID lar
- `TG_VIEWERS` — faqat ko'rish uchun user ID lar
- `WEBAPP_URL` — deploy URL (webAppUrlSet bilan yoziladi)

**Bot imkoniyatlari:**
- `/start`, `/menu` → asosiy menyu (WebApp tugmalari + native)
- WebApp tugmalari → Telegram ichida Admin panel / Rahbar dashboard ochadi
- Native: Dashboard (jami), Ob'ektlar ro'yxati, har ob'ekt detail
- Native: Aktlar (oxirgi 10), Prixod (oxirgi 12)
- Ruxsat: admin (to'liq), viewer (faqat ko'rish), none (xabar)

---

## Tashqi Hujjatlar (45_Hujjatlar.js)

Mustaqil — LRV tizimiga bog'lanmagan.

| Hujjat | ID | Imkoniyat |
|--------|-----|-----------|
| Akt (yashirin ishlar) | `1Co9bC9dEdJUG9wTEiQjUJ4KH-aCScQihkQ_9-MHQbP0` | Ko'rish + yozish |
| Prixod (kelgan material) | `1vchaALFe0FmKzt4b_w1ZMA3GZO44jedF16dbSpd6pTo` | Ko'rish + yozish |
| Viborka (material spets.) | `17PbwnwpQGhGPU_OMgnl605VmuRXzeFFSgG2QXdem_xY` | Faqat ko'rish (murakkab) |

---

## Lock Arxitekturasi

```
LOCK = smeta skeleti muzlatilgan
  ✓ FAKT/F2 doim yoziladi
  ✓ Qo'shimcha ishlar (+) qo'shiladi
  ✗ Smeta tuzilishi o'zgarmaydi

Qayta ishlash xavfsizligi:
  _oyKollarTikla, _faktSaqla → _faktQayta, _qoshSaqla → _qoshQayta
```

---

## Muhim Tuzatishlar Tarixi

| # | Muammo | Tuzatish |
|---|--------|---------|
| 1-15 | (avvalgi 15 ta) | Ko'hna CLAUDE.md da batafsil |
| 16 | NARXLAR tabi sekin | `_narxlarHisob()` faqat NARXLAR varaqi o'qiydi |
| 17 | ТИЗИМ formula N×setFormula | `_narxTizimBatch()` — 1 ta setFormulas() |
| 18 | holat_* 50000 belgi xatosi | holat keshlanmaydi, LRV dan o'qiydi |
| 19 | KAT kategoriya xato | NARXLAR C ustuni override (`nkMap`) |
| 20 | Svodka seksiyalari noaniq | Oraliq tizimi (SOZLAMALAR_ОРАЛИҚ) |
| 21 | Navigatsiya URL xatosi | `WEBAPP_URL` Script Property, `webAppUrlSet()` |
| 22 | `getUi()` webapp da crash | `try-catch` bilan himoya qilindi |
| 23 | Ish qo'shish modal yopilardi | `_treeYangiKerak` flag, modal ochiq qoladi |
| 24 | "Ish turi tanlang" (apostrophe) | `_itResults[i]` array, onclick da JSON yo'q |
| 25 | Kutubxonada yo'q ish | "➕ Yangi ish turi yaratish" → `apiBlQosh` |
| 26 | alert/prompt bloklar | Toast bildirishnomalar + `run()` default handler |
| 27 | 120→550mlrd (narx 10x) | `narx/qty` bo'lish olib tashlandi — dona narx aynan |
| 28 | KPI 2 barobar | `rollup` ikki marta yozilgan edi → bittasi o'chirildi |
| 29 | Telegram 512 spam | `else→menyu` olib tashlandi + `tgSpamTuxtat` drop_pending |
| 30 | 150+ "Untitled" fayl | Drive v3 `name` (v2 `title` emas) + `untitledTozala()` |
| 31 | Lock qayta yopilardi | apiLockBos/Och da `apiKeshSkanYangilash()` |
| 32 | 6 min timeout qotish | Navbat tizimi (50_Navbat.js) — har ob'ekt alohida trigger |
| 33 | Telegram webhook eski URL | `TIZIM_SOZLASH` getUrl + fallback, `drop_pending_updates` |
| 34 | Panel/Boss/Telegram sekin (har clickda Drive skani) | CacheService kesh (gzip+chunk); `_plusTop` keshdagi plusId→openById; holat/boss keshlanadi; `lockMap` memoize; `apiPanelInit/apiBossInit` bitta RPC; warm-up |
| 35 | 400mlrd→1T shishish (tashxis) | `apiTashxis` diagnostika asbobi — kategoriya/eng qimmat/FAKT-override/0-narx/MISS o'lchaydi. ОБ badge daraxtda; topilmaganlar paneli |
| 36 | **1000x — birlik e'tiborsiz** (asosiy sabab) | FUZZY_CROSS boshqa birlikdagi narxni aynan olardi (svodka 1000шт/т, LRV шт/кг → 1000x). `_birlikBaza()` qo'shildi: bir xil baza → masshtablash (×factor), boshqa baza → RAD (MISS). `_fuzzyMatch` matched `unit` qaytaradi. STANDART: `CFG.FUZZY_CROSS=false` (birlik mos kelmasa narx OLINMAYDI); `CFG.FUZZY=false` → toza EXACT |
| 37 | ЗАТРАТЫ ТРУДА МАШИНИСТОВ narxlanardi | `_findPrice` da qattiq himoya: nom 'ТРУДА МАШИНИСТ' → narx 0, cat МАШ (машина tarkibida, alohida narxi yo'q) |
| 38 | Tasdiqlangan narx/KAT buzilardi | (a) cross-obyekt FAKT MAX OVERRIDE/NARXLAR-tasdiqlangan narxni bosib o'tardi (24517.7→29421) → endi `tasdiq` immunitet; (b) NARXLAR БЕЛГИЛАНГАН (bel>0) eng ishonchli narx manbai; (c) tasdiqlanmagan NARXLAR KAT endi ОБ ni МАТ ga tushirmaydi. `_narxlarKatMap` → {kat,bel} |
| 39 | ГИБКИЙ summa narxi (1.7mlrd dona o'rniga) | `_priceDB` DONA NARX KAFOLATI: `narx×qty≈summa` shart. Agar `narx≈summa && qty>1` → `narx=summa/qty` (dona tiklanadi). Nega ГИБКИЙ: KOL-VO=132 (boshqalar 1) → summa olinsa 132x; kol=1 larda bilinmaydi. Universal — har resurs uchun ishlaydi |
| 40 | Ҳолат KPI 2x (501mlrd→1T) | `_kpi()` `walk()` bolalarni IKKI marta yurirdi (`forEach(c→walk(c))` + `forEach(walk)`) → bitta `forEach(walk)` qoldirildi |
| 41 | Lock kesh qotishi (panel eski badge) | `apiLockBos/Och` faqat skan keshini yangilardi, `holat_/boss_` ni invalidatsiya QILMASDI → `_holatInvalidate(obyekt)` qo'shildi. NARXLASHGA TA'SIR YO'Q edi (lockMi SOZLAMALAR_ҚУЛФ dan o'qiydi) — faqat ko'rsatish. + menyu "🔓 Қулф холатини текшир" (asl manba) |
| 42 | _KESH yacheyka bosib qotardi + menyu BARCHA timeout | (a) skan butun JSON bitta ulkan yacheykada → tartibli jadval (har obyekt 1 qator, texnik JSON yashirin 8-ustun), eski format onOpen migratsiya; (b) menyu "② Папкани ўқи — БАРЧА" → navbatga (`navbatBoshla`, har obyekt alohida trigger, timeout yo'q) + "📊 Навбат холати"; (c) `skanBitta()` — navbat/bitta [Ишла] faqat 1 papka skani (9 emas) |
| 43 | **Cross-obyekt narx aralashuvi** (GAME ZONA 29ming o'rniga Amfiteatr 24ming — YURIDIK) | SVODKA YETAKCHI: `_findPrice` tartibi o'zgardi — EXACT/FUZZY (o'sha obyekt svodkasi) BIRINCHI, NARXLAR БЕЛГИЛАНГАН (umumiy D ustun) faqat svod MISS zaxira. FAKT cross-obyekt MAX → `CFG.FAKT_CROSS=false` BUTUNLAY O'CHIRILGAN. Har obyekt FAQAT o'z svodkasidan narxlanadi |
| 44 | ЖАМИ ST_F2/ST_OST 2x (LRV varaq) | `_jamiQator` ST_* ustunlar uchun `SUM(barcha)` ishlatardi, lekin rz qatorlar ST_F2/ST_OST da leaf-yig'indisini saqlaydi (drill-down) → leaf+rz=2x. Endi `leafF()`=`SUMIF("rs")+SUMIF("mat")` (faqat leaf). DASHBOARD allaqachon to'g'ri edi (leaf yig'adi) |
| 45 | **FAKT/F2 occurrence** (nakopitelniy buzilishi) | `_faktSaqla`/`_faktQayta` key=`nom\|\|bir`. Bir xil nom+birlik bir necha marta (turli razdel/qavat — qurilishda ko'p) → oxirgisi qolganlarni bosib FAKT/F2 aralashtiradi, qayta ishlaganda ma'lumot buziladi. Endi occurrence index: key=`nom\|\|bir\|\|N` — har takror noyob, saqlash/tiklash bir xil tartibda |
| 46 | **CONSTANTA narxlash** (yuridik — ekranga umumiy narx) | Narx FAQAT EXACT: nom (`_normNomKey` — faqat son+harf, probel/belgi e'tiborsiz) + birlik (aynan) → o'sha obyekt svodkasidan. FUZZY/FUZZY_CROSS/OVERRIDE-narx/NARXLAR-narx/FAKT MAX **BUTUNLAY OLIB TASHLANDI** (`_fuzzyMatch`, byUnit o'chirildi). + HAR OBYEKT FIKSIRLANGAN ЧЕЛ-Ч stavka (faqat "ЗАТРАТЫ ТРУДА РАБОЧИХ", mashinist/boshqa ЧЕЛ emas — SOZLAMALAR_СТАВКА, panel [💰 Ставка]) — svodkadan ustun, cross-obyekt emas |
| 47 | **F2 fakticheskiy narxlash** (smeta narx o'rniga haqiqiy) | F2 yopilganda qimmat resurslar fakticheskiy narxda → smeta narxi (G) noto'g'ri edi. Endi har F2 oyi LRV da **3 ustun**: ОБЪЁМ\|НАРХ(default=G)\|СУММА(=obyom×narx). `_f2sum(r,offset)`=SUMPRODUCT(MOD(COLUMN-first,3)=offset) — F2OL=Σ ОБЪЁМ(0), ST_F2=Σ СУММА(2, fakticheskiy). `_oyMap3` oyNom→{o,n}; saqlash {obyom,narx} (qo'lda=formula emas, getFormulas). Migratsiya avtomatik (eski 1-ustun→3). Sarlavha suffix ' ₊нарх'/' ₊сумма' (`_f2Oylar`/`_oyKolMap` skip). Narx hozircha LRV НАРХ ustunida qo'lda |
| 58 | **VIBORKA panelда ko'rinadi + IDEAL ARXITEKTURA** | Avval `apiViborkaOl` faqat **havola** berardi (panelда ko'rinmasdi). Endi Viborka hujjatining **Nazorat** varag'ini O'QIYDI: Материал/Бирлик/План/Қабул/Қолдиқ/%/Поставщик/Ҳолат + jami. Panel `_renderViborka` — deficit ranglangan jadval (🟢≥98% 🟡<98% 🔴0 🔵>105% 🟣замена). Nazorat topilmasa → havola fallback. **`GAS/VIBORKA_ARXITEKTURA.md`** — to'liq dizayn (Antigravity): filtr/UI, anti-fraud→Supabase anomaliya, frontend material nazorat, per-obyekt. ⚠️ Viborka MUSTAQIL — Smeta/Prixod bilan material ATAYLAB ulanmaydi |
| 57 | **PRIXOD registr tuzatish + IDEAL ARXITEKTURA** | Akt kabi: `apiPrixodOl` panel 150→**0=barchasi**; `_renderPrixod` "➕ Янги приход" tugmasi **har doim** ko'rinadi + **раздел bo'yicha yig'iladigan guruh** (flat o'rniga). **`GAS/PRIXOD_ARXITEKTURA.md`** — to'liq sklad dizayni (Antigravity): kirим+chiqим(РАСХОД)→qoldiq formula, obyekt ustuni, material agregat ko'rinishi, anti-fraud+deficit nazorat, smeta-bog'lash (qo'lда+AI taklif), Supabase `rashod`/`sklad_ostatka`. Viborka bilan ATAYLAB ulanmaydi (mustaqil) |
| 56 | **AKT registr tuzatish + IDEAL ARXITEKTURA** | Aktlar chiqmas/chalkash edi: (a) `apiAktlarOl` panel faqat 100 so'rardi → **0=barchasi**; (b) `_aktSheet` REYESTR varag'ini nomi bilan ochadi (TEMPLATE emas) — 500+ akt chiqdi; (c) render **obyekt bo'yicha yig'iladigan guruh** (`<details>`), status rangi, jami sanoq — flat ro'yxat o'rniga. **`GAS/AKT_ARXITEKTURA.md`** — to'liq ideal dizayn (Antigravity davom ettiradi): barqaror work-key `obyekt\|\|КОД\|\|nom_key` (qator EMAS), akt↔ish N:M qo'lда bog'lash, eski 500 aktni AI/fuzzy taklif bilan ulash, coverage nazorat, Supabase `akt_ish` link jadval, frontend registr |
| 55 | **AKT integratsiya 1-bosqich — smetadan avto-to'ldirish** | Akt yaratish Smeta bilan ulandi: `45_Hujjatlar.js` `apiAktIshlar(obyekt)` (bajarilgan FAKT>0 ish turlari + akt bor-yo'qligi `SMETA_REF` bo'yicha), `apiAktSmetadan(obyekt,varaq,qator)` (ish nomi+hajm(FAKT)+materiallar(rs tarkibidan, ЧЕЛ/МАШ chiqarib)+bog'lanish avto-to'ldiradi); `apiAktYoz` → MATERIAL+SMETA_REF yozadi. Akt generator REY ga `SMETA_REF` ustuni (smeta ishiga bog'lanish). Panel: Ҳужжатлар→Актлар→[🧩 Сметадан] → obyekt→ishlarni **KO'P TANLASH (checkbox)** → `apiAktSmetadanKop` jamlaydi → akt modali (status Янги/Қоғоз + скан URL). **Dizayn (foydalanuvchi talabi):** (a) nomlar smeta bilan mos kelmaydi → bog'lanish QO'LDA (checkbox), avto-moslik yo'q; (b) **bitta akt — bir nechta ish** (`SMETA_REF` = `;` bilan ro'yxat, `_aktRefSet` split qiladi); (c) **qog'oz/arxiv aktlar** kiritiladi (status `QOGOZ` + `PDF_URL` skan, generatsiyasiz registr uchun). **Ишга тушириш:** Akt generator'da `setupAll` bir marta (SMETA_REF ustuni). Keyingi: 2-bosqich nazorat (yashirin ish akt yo'q → anomaliya), 3-bosqich frontend |
| 54 | **DASHBOARD yetim qator → JAMI shishishi** (split o'tishida) | Obyekt bo'linganda/o'chganda/qayta nomlanganda eski dashboard qatori (masalan bo'linishdan oldingi "Suniy ko'l") yetim qolib, `_jami` uni ham qo'shib JAMI ni shishirardi. `serverYigPapka` oxirida **RECONCILE**: `_dashOrphanTozala(srv, valid)` — skanда YO'Q (papkaSkan ro'yxatida bo'lmagan) qatorlarni o'chiradi, ЖАМИ saqlanadi. Xavfsizlik: skan bo'sh bo'lsa tegilmaydi (dashboard yo'qolib ketmasin). FAKT/F2 occurrence, apiBossData ЖАМИ-skip, anomaliya skaner — audit qilinib TO'G'RI topildi |
| 53 | **Multi-lokalka audit — qolgan izchilliklar** | (a) `svodSheets` ham svodCols kabi papka bo'yicha meros (`_svodSheetsFolder`) — siblinglar bir xil svod varaqlarini o'qiydi; (b) takroriy parent→child aniqlash (apiHolatOl, apiOyQosh dagi `o.obyekt.split(' - ')[0]===parent` bloklari) → yagona `_subObyektlar(parent)` helperга birlashtirildi (normallashtirilgan); (c) **obyekt↔shartnoma bog'lanishi split obyekt uchun**: foydalanuvchi papkani dogovorga bog'lasa, sub-obyektlar (`"Папка - локалка"`) endi papka bog'lanishini meros oladi — `70_Supabase.js` `_sbShNo` (obyektlar.shartnoma_no) va `80_Shartnoma.js` `apiShartnomaDashboard` rollup ikkalasi `_cfgKalit` fallback bilan. lockMi/shartnomaChelCh allaqachon papka-fallback bor edi |
| 52 | **Multi-lokalka NARXLASH/ORALIQ — barqaror izchil kalit** (Antigravity prefiks yamog'ini normaga keltirdi) | Muammo: papka ko'p lokalkaga bo'linganda (`"Папка - локалка"`) narxlash sozlamasi (oraliq/svod ustun/stavka) obyekt nomiga bog'langani uchun yetim qolardi + svodCols faqat tanlangan sub-obyektga saqlanib, siblinglar olmasdi → ЧЕЛ/МАШ/МАТ/ОБ noto'g'ri. Yechim — **sozlama SVODKAga (papkaga) tegishli** degan yagona mantiq: `05_Papka.js` `_cfgKalit` (papka nomi=kalit) + `_cfgNorm` (katta/kichik, probel, apostrof variantlari ʻʼ'`´, ё/е normallashtirish) + `_cfgMos` (normallashtirilgan moslik) + `_svodColsFolder` (svodCols papka bo'yicha meros, yangi lokalka avtomat oladi). `_oraliqlarOl`/`_stavkaOl`/`_stavkaYoz` (10_Engine), `apiOraliqlarSaqla`/`apiSvodUstunSaqla` (30_Panel) — hammasi `_cfgKalit`/`_cfgMos` ishlatadi → split obyektlar bir svodka sozlamasini ulashadi, kirill/lotin imlo farqi buzmaydi. Tarqoq `split(' - ')` hiylalari olib tashlandi |
| 51 | **Backend audit — mantiqiy bog'lanishlar tuzatildi** | Supabase push'lardagi nomuvofiqliklar: (a) `holat.kategoriya` hech qachon yozilmasdi → rs `kat` (ЧЕЛ/МАШ/ОБ/МАТ...) endi yoziladi; (b) rs node'da `narx` YO'Q edi (har doim 0) → birlik narxi = ST_RES summa/hajm hisoblanadi; (c) `material_kerak` ish haqi (ЧЕЛ/МАШ) ni "material" deb qo'shardi → endi faqat material kategoriyalar; (d) **obyekt↔shartnoma bog'lanishi** Supabase'da yo'q edi → `obyektlar.shartnoma_no` qo'shildi (`apiShartnomaBogOl` dan; obyektlar↔shartnoma↔tolovlar endi shartnoma_no orqali bog'langan); (e) anomaliya o'chirishda `>` belgisi URL'da kodlanmagan → har qoida alohida `encodeURIComponent`; (f) obyektPush `kab` clobber xavfi (CATS'da КАБ yo'q) → yozilmaydi (dashboard beradi); (g) xarita schema/kodga moslandi (oylik_f2=qiymat, holat ustunlari) |
| 50 | **BUXGALTERIYA + PRIXOD + TO'LOVLAR** (moliyaviy nazorat) | `85_Buxgalteriya.js`: **ТЎЛОВЛАР** registri (САНА\|ШАРТНОМА_NO\|ОБЪЕКТ\|СУММА\|ТУР\|ИЗОҲ — Аванс/Тўлов/Қайтарим), `apiTolovOl/Yoz/Ochir`, `apiBuxDashboard` (har shartnoma: dog_summa, bajarilgan Ф2, to'langan, **debitor/avans**). `70_Supabase.js`: `supabaseTolovPush` (→ `tolovlar`), `supabasePrixodPush` (tashqi Prixod Sheet → `prixod` ledger), `shartnoma` boyitildi (НДС, dog_summa, qoldiq, bajarilgan%, tolangan, debitor). Moliyaviy nazorat invariantlari: `KS2>DOGOVOR` (overbilling, kritik), `TOLOV>DOGOVOR` (ortiqcha to'lov, kritik), `TOLOV>BAJARILGAN` (avans, ogohlantirish). Soatlik/to'liq sinxga ulangan |
| 49 | **Supabase SOATLIK to'liq sinx** (mirror kengaytirildi) | `supabase_schema.sql` ga 6 jadval: material_kerak, shartnoma, topilmaganlar, akt, prixod, anomaliya (+RLS+realtime). `70_Supabase.js`: `supabaseMaterialKerakPush`(holat agregatsiya, material_key), `supabaseTopilmaganPush`(_NARX_LOG), `supabaseShartnomaPush`(apiShartnomaDashboard); **`supabaseSoatlikSinx`** (yengil dashboard/narx/shartnoma + DIRTY obyektlar) + **dirty-tracking** (`_sbDirty` `_holatInvalidate` ichida, SB_DIRTY Script Property) + **`supabaseTriggerOrnat`** (soatlik + kunlik 03:00). 3 qatlam: event→soat→tun, hech narsa yo'qolmaydi. **+ ANOMALIYA SKANER** `supabaseAnomaliyaPush(ob)` (F2>SMETA, FAKT>SMETA, F2>FAKT, OSTATKA<0, qator hajm oshishi, narx topilmagan → `anomaliya` jadval). **+ AKT** (`Akt generator/Supabase.js` → `akt` REYESTRdan) va **VIBORKA** (`Viborka/Supabase.js` → `viborka_nazorat` TO'LIQ Nazoratdan) — har biri o'z soatlik trigger. ⚠️ **MUSTAQILLIK:** material nomlari har tizimda har xil → Smeta↔Viborka ATAYLAB ulanmaydi; Viborka deficitni o'zida hisoblaydi. **+ PRIXOD** (`supabasePrixodPush` ← tashqi Prixod Sheet `apiPrixodOl` → `prixod` ledger). **+ BUXGALTERIYA:** `shartnoma` НДС/dog_summa/bajarilgan%/qoldiq bilan boyitildi; moliyaviy nazorat invariant `KS2>DOGOVOR` (Ф2 shartnoma summasidan oshsa kritik anomaliya). | Xarita: `GAS/SUPABASE_SYNC.md` |
| 48 | **Chunked Ишла xato edi** (varaq-bo'lish) → ATOMIK qaytarildi | Boshqa chatda qo'shilgan `opts.fromVaraq/deadline/partial` (varaq darajasida bo'lib ishlash): (a) LRV sahifani BO'LARDI — bitta natija buzilardi (format qonuniy!); (b) har chunk setup (fayl ochish, pdb) takror; (c) **bitta ulkan sahifani umuman bo'lolmasdi** → hech narsa tugamasdi. Olib tashlandi: `_ishlaObyekt(ob)` atomik, `copyTo` (format saqlanadi), `_BAK_` tranzaksiya himoyasi qoldi. Navbat har obyekt alohida trigger. Juda katta obyekt uchun → bottleneck optimallashtirish (chunking emas) |

---

## Workflow

```
1. clasp push (lokal fayllar sync)
2. Deploy → Manage deployments → Edit → New version → Deploy
3. Bir marta: webAppUrlSet('...') va TIZIM_SOZLASH ishga tushirish
4. SMETA_TEST_V1 → Menyu → 📊 Narxlar varaqini yaratish
5. Ob'ektlar tabida: [⚙ Оралиқ] → seksiyalar tekshir → Сақлаш
6. Ob'ektlar tabida: [Ишла] → LRV_PLUS yangilanadi
7. Holat tabida: FAKT/F2 kiritish
8. Ierarxiya tabida: D1-D3 to'ldirish → LRV ga qo'y
```

---

## Qolgan Rejalashtirilgan Ishlar

- [ ] RS tahrirlash (mavjud resurs norm/birlik o'zgartirish, o'chirish)
- [ ] FAKT/F2 + 100% tugmalar to'liq qayta dizayn
- [ ] Boss dashboardga Akt/Prixod ko'rinishi
- [ ] Viborka batafsil jadval panelda
- [ ] Telegram native yozish (akt/prixod/fakt tugmalar bilan, web appsiz)
- [ ] Time-based trigger: kesh avtomatik yangilash
- [ ] РАЗДЕЛЛАР daraxti → PIVOT ko'rinish
