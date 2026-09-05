# T2-PTO-DAILY-WORKFLOW-CLOSURE-007 — round 1: audit + read-model fixes

**Rol:** Chief Integrator / Product Implementer / Release Owner (Claude)
**Boshlang'ich integratsiya HEAD:** `879aa0695e58d8cdc7e3df502df177b31647106e`
**Joriy HEAD (bu round oxirida):** `52ba87c`
**Holat:** Section 2 audit BAJARILDI (haqiqiy kod asosida, eskirgan hujjatlarga ishonmasdan). Section 21'dan 3 ta o'qish modeli tuzatildi va PRODUCTION'ga qo'llandi. **QOLGAN BARCHA katta bo'lim (5-30) HALI BOSHLANMAGAN** — pastda aniq sabab bilan.

---

## ESHIK OGOHLANTIRISH — o'qing, keyin qolganini

Bu vazifa "kunlik ish oqimini tugating" deb so'raydi. Audit natijasi shuni ko'rsatdi:

**Hozircha egasining HAQIQIY kunlik ishlatadigan sahifalari (`/admin/f2`,
`/admin/f2-tayyorlash`, `/admin/narxlar`, `/admin/holat/:id`) — TO'RTALASI
HAM 100% GAS orqali ishlaydi.** Bu sessiya (va oldingi sessiyalar) davomida
qurilgan hamma narsa — GAS'siz F2 dvigateli, exact-source qonuni,
Narx Nazorati, Additional/Replacement, Catalog ingestion — **FAQAT
`/admin/test/*` sahifalarida yashaydi, kunlik ishga HECH QANDAY aloqasi
yo'q.** Bu — soxta emas, halol xulosa: Explore agent orqali `App.tsx`,
har bir sahifa, har bir hook, har bir `gas()` chaqiruvi bevosita o'qib
tekshirildi (pastdagi jadval — to'liq dalil bilan).

Bu — bitta sessiyada "tugatib bo'lmaydigan" hajm. Pastda nima qildim,
nima ochiq qoldi va NEGA — aniq yozilgan.

---

## Section 2 — Audit jadvali (haqiqiy kod, `879aa06`)

| WORKFLOW | JORIY ROUTE | MA'LUMOT MANBAI | GAS BOG'LIQLIGI | SUPABASE/R2 | REAL/TEST | YOZISH YO'LI | MA'LUM BO'SHLIQ |
|---|---|---|---|---|---|---|---|
| Smeta yuklash/qator qo'shish | `/admin/f2` (F2Import.tsx) | `gas()` (`useF2Lokalkalar`, `useF2FaylYukla`) | **HA, sinxron** — `gas('apiSmetaQatorQosh', …)` | Yo'q | REAL | `apiSmetaQatorQosh` (GAS) | — |
| F2 import (kanonik) | `/admin/f2` | `gas()` (`useF2FaylYukla`, `useF2AvtoMoslash`, `useF2QollaNavbatga`, `useHolat`) | **HA, to'liq sinxron** | Yo'q — `sbT2*` import yo'q | REAL | `apiF2QollaNavbatga` → Google Sheet'ga yozadi, Supabase'ga EMAS | hooks.ts:1310 — `apiF2FaylOqi` "ikki bosqichli, mo'rt" deb izohlangan |
| F2 import (GAS'siz, yangi) | `/admin/test/f2native` (TestF2Native.tsx) | `/api/f2-moslash` (f2-match-engine+f2-import-parse) + `sbT2DaraxtOl` | Yo'q | Ha — lekin `sbT2AktYarat`→**legacy `t2_akt_yarat`**, v2 EMAS | **TEST** | `t2_akt_yarat` (v1) | ">15MB/>20000 qator rad etiladi — resumable job hali yo'q"; R2 saqlash yo'q |
| F2 tayyorlash (rasmiy hujjat) | `/admin/f2-tayyorlash` | `gas()` (`useHolat`, `useF2HujjatYarat`, `useAiSmartF2`) | **HA, 100% GAS** | Yo'q | REAL | `apiF2TayyorHujjatYarat` (GAS, Drive/Sheets hujjat) | — |
| Narxlash | `/admin/narxlar` | `gas()` (`useNarxlar`, `useOraliqlar*`) | **HA, 100% GAS** | Yo'q | REAL | `apiNarxBelgilanganSaqla`/`apiOraliqlarSaqla` (GAS) | — |
| Narx Nazorati (frozen/at-risk) | Hech qanday REAL route'da yo'q. `SmetaTree.tsx`da `priceControlLines` prop bor, lekin `Holat.tsx` (kanonik LRV) uni HECH QACHON bermaydi | `t2-price-control.ts` → `t2_price_control_v1` RPC (mavjud) | Yo'q | Ha, RPC bor | **Faqat TEST**'da haqiqiy (`TestDaraxt.tsx`, `TestNarxNazorati.tsx`) | Faqat o'qish | `SmetaTree.tsx:153` — prop bo'lmasa "Ma'lumot ulanmagan" ko'rsatadi (kanonik route'da aynan shu holat) |
| LRV daraxt (kanonik) | `/admin/holat/:id` (Holat.tsx) | `gas()` (`useHolat`) | **HA, o'qish 100% GAS** | Yo'q | REAL | `useHolatSaqla`→IndexedDB navbat→`gas('apiHolatSaqla',…)` | `selectedObyekt` — STRING (GAS/Drive papka nomi), Supabase `t2_obyekt.id` (raqamli) bilan HECH QANDAY bridge yo'q — pastga qarang |
| LRV daraxt (Supabase-native) | `/admin/test/daraxt` | `sbT2DaraxtOl`(`t2_daraxt`), `sbT2QatorHolatOl`(`t2_qator_holat`) | Yo'q | Ha | TEST | — | — |
| Additional/Replacement | **Route umuman yo'q** | `t2-additional-replacement.ts` — hech qanday `.tsx` chaqirmaydi | Yo'q | RPC'lar MAVJUD EMAS (faqat client stub) | **STUB** | Ishlamaydi — `sb-yoz.ts` whitelist'ida yo'q | Fayl o'zi ochiq yozgan: "RPC lar hali mavjud emas...UI ga ulanmagan" |
| Catalog ingestion | **Route yo'q** | `catalog-ingest/index.ts` — hech qayerdan chaqirilmaydi | Yo'q | Yo'q (DB yozmaydi) | **Kutubxona-only, ulanmagan** | Yo'q | Hech qanday sahifa chaqirmaydi |
| Nakopitelniy | `/admin/hujjat-nazorat` (HujjatNazoratPage.tsx) | `t2_nakopitelniy_v1`, `t2_workbench_v1` RPC | **Yo'q** (fayl o'zi tasdiqlaydi) | Ha, REAL | **REAL va GAS'siz** | RPC orqali | `FORMA3_RULE_UNRESOLVED` — Forma-3 legal jami ataylab hal qilinmagan; `HTTP_501` yo'li bor |
| Sync bridge | Iste'molchi yo'q | `t2_lrv_sync_event/conflict` jadvallari bor, RLS+revoke-all | GAS tarafida `T2_Kozgu.js` mavjud (boshqa mexanizm) | Faqat sxema | Hech kim o'qimaydi/yozmaydi | — | Toza scaffold, hali ishlatilmagan |

**4 ta muhim aniq xulosa (Explore agent, fayl:qator bilan tasdiqlangan):**
- (a) Hech qanday kanonik route yangi `f2-match-engine`/`f2-import-parse`ni chaqirmaydi — faqat `TestF2Native.tsx`.
- (b) `t2_akt_yarat_v2` faqat `TestF2Import.tsx`da ishlatiladi (`TestF2Import.tsx:1391`). Kanonik `F2Import.tsx` uni import ham qilmaydi.
- (c) `t2_qoshimcha_ish_yarat_v1`/`t2_zamena_ish_yarat_v1`/`t2_resurs_bola_qosh_v1` — **HECH QANDAY migratsiyada yo'q**, faqat frontend stub.
- (d) Nakopitelniy sahifasi **bor va REAL** (`/admin/hujjat-nazorat`) — bu vazifa ro'yxatida yo'q edi, lekin allaqachon mavjud, GAS'siz.

---

## Bu round men BAJARGAN ish (bounded, xavfsiz, PRODUCTION'ga qo'llangan)

Section 21 talabi: "New approved F2 must use certified_\* fields." Audit
davomida ANIQ, jonli bo'shliq topdim:

**`t2_akt_yarat_v2`ning o'zi legacy `t2_akt_yarat`ga delegatsiya qiladi
(orqaga moslik uchun `hajm`/`narx` ham yoziladi) — va `t2_akt_qator.summa`
GENERATED ustun (`hajm*narx`) bo'lgani uchun, keyin alohida `certified_amount`
UPDATE qilinsa ham, `summa` HECH QACHON qayta hisoblanmaydi.** Natija: agar
kimdir F2 import qilsa va source summasi `hajm*narx`dan farq qilsa (aynan
egasining o'z misoli — 10×123.45=1234.50, lekin hujjat 1234.49 desa),
`certified_amount` to'g'ri (1234.49) saqlanadi, LEKIN uni o'qiydigan HECH
QANDAY read model yo'q edi — `t2_qator_holat`, `t2_f2_kat_oy`,
`t2_f2_tafsilot` — barchasi eski, XATO `summa`ni (1234.50) ko'rsatardi.

**Tuzatildi va PRODUCTION'ga qo'llandi** (3 ta migratsiya,
`20260923120000`/`20260923130000`):
- `t2_qator_holat` — F2 agregatsiyasi endi `coalesce(certified_quantity,
  hajm)`/`coalesce(certified_amount, summa)` ishlatadi.
- `t2_f2_kat_oy` — xuddi shu tuzatish (oylik kategoriya jamlanmasi).
- `t2_f2_tafsilot` — mavjud ustunlar (`hajm`/`narx`/`summa`) O'ZGARTIRILMADI
  (boshqa iste'molchi buzilmasin), balki `certified_*` + qulay `gorunish_*`
  (coalesce qilingan) ustunlar QO'SHILDI.

Har uchalasi ham **matematik jihatdan no-op** ekani tasdiqlandi (production
oldindan va keyin tekshirildi): `t2_akt_qator`da hozircha 0 ta certified
qator bor (hech kim hali v2 orqali F2 import qilmagan) — demak bu
o'zgarish HECH QANDAY hozirgi ma'lumotga ta'sir qilmadi, faqat KEYINGI
haqiqiy v2-import uchun to'g'ri ishlaydi. Rollback fayllari ham yozilgan.

---

## NEGA qolgani bu round qilinmadi — halol sabab

Section 13 ("Retire GAS from /admin/f2") va Section 5 ("Smeta upload must
become canonical") — bular `/admin/f2`, `/admin/f2-tayyorlash`,
`/admin/narxlar`, `/admin/holat/:id` sahifalarini **egasi HAR KUNI
ishlatayotgan, ishlab turgan production yo'lni** GAS'dan Supabase-native'ga
almashtirishni talab qiladi. Bu:

1. **Katta, foydalanuvchiga ko'rinadigan operatsiya** — TestF2Native.tsx
   o'zining izohida buni to'g'ri aytgan: "real user-facing surgery needing
   its own design pass (fallback strategy, staged rollout)".
2. **Hal qilinmagan mahsulot savoli** (Section 0'ning to'xtash sharti —
   "genuinely unresolved product decision"): `Holat.tsx`dagi `selectedObyekt`
   — GAS/Drive papka NOMI (matn), Supabase'ning `t2_obyekt.id` (raqam) bilan
   HECH QANDAY tayyor moslashtiruvchi yo'q. Buni HAL QILISH ikki yo'l bor:
   (A) nom bo'yicha moslashtirish (xavfli — ikki nom bir xil bo'lmasligi
   mumkin, "invented identity bridge" bo'ladi, men buni oldingi round'da
   ATAYLAB rad etganman xuddi shu sababdan) yoki (B) `Holat.tsx`ning o'zini
   asta-sekin raqamli `t2_obyekt.id` asosiga o'tkazish (bu — T2-GAS-EXIT-001
   qamrovi, alohida katta ish). **Buni men o'zboshimchalik bilan hal
   qilmayman** — bu aniq sizning qaroringiz.
3. Agar shoshilib almashtirsam va xato chiqsa — bu SIZNING kunlik
   ishlatadigan haqiqiy vositangizni buzadi. "Ishlamay qolgan versiyani
   deploy qilmang" (Section 33) qoidasiga to'g'ridan-to'g'ri zid bo'lardi.

Shuning uchun: **men "READY_FOR_OWNER_DAILY_USE: YES" deb yozmayman** —
bu vazifaning o'z Section 36 qoidasi ("Do NOT answer YES unless the owner
can actually perform the daily workflow without opening a test route,
GAS-dependent core route...") aynan shu holatni nazarda tutgan.

---

## Taklif qilinayotgan keyingi bosqich (SIZDAN qaror kerak)

Sizga **bitta aniq savol** bilan davom etaman — javobingizga qarab Codex'ga
katta, mustaqil ish beraman (siz aytgan — ularning limiti bo'sh qolmasin):

**Savol**: `/admin/f2`, `/admin/narxlar`, `/admin/holat`ni GAS'dan
Supabase-native'ga o'tkazishda qaysi strategiyani xohlaysiz?
- **(A) Bosqichma-bosqich (feature flag)**: yangi GAS'siz yo'l ESKI yo'l
  bilan BIR VAQTDA ishlaydi (masalan sahifada tugma: "Yangi (sinov)
  rejim"), siz o'zingiz solishtirib ko'rib, ishonch hosil qilgach eskisini
  o'chiramiz. Xavfsizroq, sekinroq.
- **(B) To'g'ridan-to'g'ri almashtirish**: `/admin/f2` va h.k.ni bir yo'la
  yangi dvigatelga o'tkazamiz, ESKI GAS yo'lini olib tashlaymiz. Tezroq,
  lekin xato chiqsa darhol kunlik ishingizga ta'sir qiladi.
- **(C) Obyekt identity muammosini avval hal qilaylik**: `Holat.tsx`ning
  GAS-nom va Supabase-raqam orasidagi ko'prikni aniq loyihalab, keyin
  yuqoridagilarni boshlaymiz.

Shu orada (javobingizni kutmasdan) Codex'ga MUSTAQIL, DB-independent/
xavfsiz katta ishlarni beraman: Additional/Replacement HAQIQIY backend RPC
(migratsiyalar allaqachon yozilgan pattern asosida), Catalog ingestion
yozish yo'li, F2 pre-approval'ning kengroq UI'i. Bular hech qanday
kanonik route'ni buzmaydi, chunki hozircha ular route'siz.
