# T2-REAL-PARK-LRV-CLOSURE-005

**Rol:** Chief Integrator / Backend / Release Owner (Claude)
**Sana:** 2026-09-03
**Base:** `b2c72a6` → **Bu bosqich natijasi:** quyida, `integration/next-main-release-v1`ga push qilinadi.

---

## 0. ABSOLUTE SAFETY — ISOLATED_DB_REQUIRED

Section 0 endi production Supabase'da HAR QANDAY DB testini (BEGIN/
ROLLBACK ham) taqiqlaydi. Isolated DB borligi tekshirildi:

- `list_projects` — bitta project bor (`tuoyrzadkgoltpqkdiyx`, "Smet-01")
  — bu PRODUCTIONNING O'ZI, alohida staging/shadow YO'Q.
- `list_branches` — faqat `main` (production'ning o'zi), alohida
  preview/dev branch YO'Q.
- Supabase "branching" funksiyasi orqali chinakam izolyatsiya yaratish
  narxi so'raldi (`get_cost`): **$0.01344/soat**. Owner'dan ruxsat
  so'raldi va **OLINDI** ("Ha, branch yarat").
- `create_branch` chaqirilganda: **`PaymentRequiredException` —
  "Branching is supported only on the Pro plan or above."** Joriy
  Supabase plani branching'ni qo'llamaydi (bu — alohida, kattaroq
  billing qarori, mustaqil ravishda qilinmadi).

**Xulosa: ISOLATED_DB_REQUIRED — DB darajasidagi HECH QANDAY yangi
sxema/acceptance test bu bosqichda O'TKAZILMADI.** Buning o'rniga:
kod darajasidagi (TS/JS) haqiqiy, real ishlaydigan tuzatishlar
qilindi; yangi SQL YOZILMADI (avvalgi bosqichlarda yozilgan source-only
migratsiyalar o'zgarishsiz qoldi — ular ham hali productionga
qo'llanilmagan va bu bosqichda QAYTA tekshirilmadi, chunki buning o'zi
production DB testi bo'lardi).

**PRODUCTION_RESIDUE tekshiruvi**: bu bosqichda productionga faqat
READ-ONLY `information_schema`/`pg_proc` so'rovlari yuborildi (schema
introspection, `t2_foydalanuvchi` ustunlarini bilish uchun) — hech
qanday DDL, INSERT, UPDATE, DELETE, yoki hatto BEGIN/ROLLBACK testi
YO'Q. **PRODUCTION_RESIDUE: NONE.**

---

## 1. CODEX TREE LANE

`git ls-remote origin` — barcha `codex/*` branchlar tekshirildi.
**`codex/t2-smeta-tree-implementation-001` (yoki shunga o'xshash) HALI
MAVJUD EMAS** — Codex bu ishni hali boshlamagan/push qilmagan.

Shu sabab: `frontend/src/umumiy/daraxt/**` ga **TEGILMADI** (aynan
buyurilganidek). **CODEX_TREE_INTEGRATED: NO** — sabab: hali review
qilinadigan narsa yo'q.

---

## 2-3. EXACT F2 FRONTEND V2 + PARSER — REAL TUZATISH (P0)

Avvalgi bosqichda men "frontend parserida alohida summa maydoni yo'q"
degan xato taxmin qilgan edim va shu sabab frontend migratsiyasini
kechiktirgan edim. **Bu safar chuqur tekshirildi va TAXMIN NOTO'G'RI
chiqdi**:

- `frontend/src/test02/TestF2Import.tsx` — `aktBarglar`dagi har bir
  tugun `n.summa` ga ega, va bu qiymat **F2 faylning O'Z SUMMA
  ustunidan** keladi (qator 1279 izohi: *"F2 fayldan o'qilgan summa
  ustuvur, bo'lmasa hajm × narx"*). Bu qiymat allaqachon jami/aggregatsiya
  hisob-kitoblarida ishlatiladi — lekin **yozish (RPC chaqiruv) vaqtida
  TASHLAB YUBORILARDI**, faqat `hajm`+`narx` yuborilardi.
- GAS tomonda (`Smeta tizimi/30_Panel.js`, `apiF2FaylOqi`): F2
  Excel/Sheets shablonining **H (yoki I, surilgan shablon) ustuni —
  СУММА — alohida `_cellNum` bilan o'qiladi**, izoh: *"H ustuni — TAYYOR
  summa (statik ko'chiriladi)"*. Bu — chinakam, mustaqil source triplet.
- LEKIN GAS'ning **"xavfsiz" deb hisoblangan** ishlab chiqarish yo'li
  (`apiT2F2Import` → `_t2F2Tekisla` → `_t2F2Moslashtir`) ham xuddi shu
  xatoga ega edi: `summa` MAVJUD bo'lsa ham TASHLAB YUBORILARDI, faqat
  `hajm`+`narx` `t2_akt_yarat`ga (GENERATED summa) yuborilardi.

### Qilingan tuzatish (real, frontend darhol reachable; GAS source-only)

**Frontend** (`TestF2Import.tsx`, `supabase.ts`) — **DEPLOY QILINADI**
(git push → Cloudflare Pages, GAS emas):
- Yangi `sbT2AktYaratV2()` klient funksiyasi (`supabase.ts`).
- `TestF2Import.tsx`'ning `yozish()` funksiyasi: `tur==='f2'` bo'lsa
  endi **`t2_akt_yarat_v2`** chaqiradi — har qatorda `certified_quantity`
  (hajm, guruh bo'yicha yig'ilgan), `certified_unit_price` (narx),
  `certified_amount` (**summa, F2 faylning o'zidan, guruh bo'yicha
  YIG'ILGAN** — bir nechta manba qatori bitta smeta qatoriga bog'lansa,
  summalar QO'SHILADI, `qty*narx`dan HECH QACHON hisoblanmaydi).
  `tur==='fakt'` — o'zgarishsiz, legacy `t2_akt_yarat` (fakt — draft,
  "certified" emas).
- **AMBIGUOUS holat** (narx bor, summa yo'q) — Section 3'ning
  `NEEDS_REVIEW` qoidasi: yozish **TO'XTATILADI**, foydalanuvchiga aniq
  xabar ("qty*narx bilan summa to'qilmaydi, faylni tekshiring").

**GAS** (`Smeta tizimi/T2_F2Import.js`) — **SOURCE ONLY, DEPLOY
QILINMADI** (`node --check` bilan sintaksis tasdiqlangan):
- `_t2F2Tekisla` endi `summa`ni ham saqlaydi (avval faqat hajm+narx).
- `_t2F2Moslashtir` uni `qatorlar`ga forward qiladi.
- `apiT2F2Import`: `tur==='f2'` uchun endi qator_id bo'yicha
  AGGREGATSIYA qiladi (hajm+summa yig'iladi — `t2_akt_yarat_v2`ning
  `DUPLICATE_F2_SOURCE_LINE` himoyasi bitta partiyada bir xil qator_id
  ni rad etadi, legacy esa buni jim qabul qilardi), keyin
  **`t2_akt_yarat_v2`**ni chaqiradi. Yangi `_t2ActorIdOl()` — GAS
  session emailini `t2_foydalanuvchi.email` bilan moslaydi (v2 RPC
  haqiqiy `p_actor_id` talab qiladi — legacy talab qilmasdi). Ambiguous
  (narx bor, summa yo'q) holatda hujjat **rad etiladi** (NEEDS_REVIEW),
  yozilmaydi. `tur==='fakt'` — o'zgarishsiz.

**Ochiq qoldi**: `TestF2.tsx` (qo'lda F2/fakt kiritish, HAQIQIY
hujjatsiz) — hali legacy'da, chunki bu yerda "source document" umuman
yo'q (foydalanuvchi raqamni qo'lda kiritadi) — "certified" semantikasi
mantiqan tegishli emas. Keyingi bosqich, agar kerak bo'lsa.

`EXACT_F2_E2E`: qty=10/price=123.45/amount=1234.49 zanjiri endi
FRONTEND'DAN BOSHLAB to'g'ri yo'lda (backend logikasi avvalgi
bosqichda alohida tasdiqlangan; **bu safar QAYTA DB-darajasida
tasdiqlanmadi — ISOLATED_DB_REQUIRED**).

---

## 4. READ_MODELS — O'ZGARTIRILMADI

`t2_qator_holat`/`t2_lrv`/`t2_f2_kat_oy`/`t2_f2_tafsilot` view'lari
o'zgartirilmadi. Sabab ikkita: (a) ISOLATED_DB_REQUIRED — VIEW
o'zgartirish DDL, sinovsiz productionga tegib bo'lmaydi; (b) hali
REAL certified qator yo'q (frontend v2 hozirgina ulandi, hech kim
hali undan foydalanmagan) — o'zgartirilsa ham HECH NARSA ko'rsatmagan
bo'lardi. **OCHIQ**, keyingi bosqich (isolated DB paydo bo'lgach).

---

## 5-11. PRICE CONTROL / FROZEN / AT_RISK / PRICE_BASIS

**O'ZGARTIRILMADI bu bosqichda** — avvalgi bosqichda (`b2c72a6`)
to'liq qurilgan va barcha misollar bilan tasdiqlangan edi. Bu safar
QAYTA tekshirilmadi (ISOLATED_DB_REQUIRED — hech qanday qo'shimcha
tasdiqlash SQL'i ishga tushirilmadi). Dizayn o'zgarishsiz qoladi,
avvalgi hisobotga qarang (`T2_REAL_PARK_LRV_VERTICAL_SLICE_004.md`).

---

## 12-13. NARX NAZORATI WEBSITE / PRE-APPROVAL AUDIT

**O'ZGARTIRILMADI** — vaqt ushbu bosqichda P0 (Section 2/3, yuqorida)
va Section 17 (bridge)ga sarflandi. Mavjud "Narx nazorati" tab
(`/admin/test/smeta`) o'zgarishsiz qoladi. Drill-down/filtr
kengaytmasi, F2 pre-approval maxsus paneli — **OCHIQ**.

---

## 14-16. ADDITIONAL/REPLACEMENT, CATALOG PIPELINE

**O'ZGARTIRILMADI** — ikkalasi ham YANGI SQL/sxema talab qiladi,
ISOLATED_DB_REQUIRED sababli bu bosqichda yozilmadi (yozib, sinovsiz
qoldirish — avvalgi incident'dan keyin yanada xavfli bo'lardi). **OCHIQ**.

---

## 17. SHEETS ↔ SUPABASE BRIDGE — REAL SOURCE FIX (mavjud sxema bilan)

`Smeta tizimi/T2_Kozgu.js` — **SOURCE ONLY, DEPLOY QILINMADI**
(`node --check` bilan sintaksis tasdiqlangan). Yangi jadval TALAB
QILINMAYDIGAN, mavjud `t2_ozgarish` ustunlari (`vaqt`) bilan ishlaydigan
ikkita ANIQ nuqson tuzatildi:

1. **Blanket PATCH → chegarali PATCH**: `apiT2VaraqYarat` endi
   ma'lumot o'qishni BOSHLASHDAN OLDIN `_syncChegara` (timestamp)ni
   qayd etadi va `_t2KopriknavbatYop`ga uzatadi; navbat yopish endi
   FAQAT `vaqt <= chegara` bo'lgan qatorlarni yopadi — o'qish paytida
   YANGI kelgan o'zgarish endi noto'g'ri "yozildi" deb belgilanmaydi
   (avvalgi race condition yopildi).
2. **Bo'sh `catch(e){}` → real xato + durable retry**:
   `_t2KopriknavbatYop` endi HTTP status va xatoni `Logger.log` qiladi
   VA `PropertiesService`da durable "oxirgi xato" belgisini saqlaydi
   (muvaffaqiyatda tozalanadi) — yangi `apiT2KoprikXatolarOl()` bu
   ro'yxatni monitoring uchun qaytaradi. `t2VaraqSinxFon`'ning bo'sh
   `catch` blogi ham — endi 3 martagacha DURABLE (PropertiesService)
   retry-count bilan avtomatik qayta rejalashtiradi, keyin taslim
   bo'lib aniq xabar qoldiradi ("qo'lda «Bazaga qaytarish» kerak").

**Hali QILINMAGAN** (yangi sxema talab qiladi, ISOLATED_DB_REQUIRED
sababli bu bosqichda emas): to'liq `event_id`/`operation_id`/
`entity_version`/`projection_hash`/dead-letter konverti — bu SOURCE-ONLY
migratsiya (`20260920140000_t2_lrv_sync_envelope_v1.sql`) allaqachon
avvalgi bosqichda yozilgan va productionga qo'llanilmagan holda qoladi;
`T2_Kozgu.js`ni shu jadvalga ulash — keyingi, isolated DB paydo
bo'lgach bajariladigan bosqich. **`60-second-only echo suppression`**
(vaqt-oynali, event-ID emas) — HAM o'zgartirilmadi (bu tuzatish ham
yangi sxema/chuqurroq refaktor talab qiladi, vaqt yetmadi).

---

## 18. CODEX TREE INTEGRATION

**CODEX_TREE_INTEGRATED: NO.** Codex hali branch push qilmagan
(Bo'lim 1). `TREE_CODEX_SHA`: yo'q. `TREE_INTEGRATION_DECISION`: yo'q
— kutilmoqda.

---

## 19. WORKING LRV

**O'ZGARTIRILMADI.**

---

## 20-21. TESTS / GATES

| Gate | Natija |
|---|---|
| `tsc -b` (frontend, to'liq) | ✅ PASS |
| `tsc -p tsconfig.functions.json` | ✅ PASS |
| `vite build` | ⚠️→✅ Avval 3 marta CRASH (native/xotira xatosi, transient Windows xotira bosimi — `~6.5GB/25GB bo'sh`), **keyingi (davomiy bosqichdagi) urinishda TOZA O'TDI** (`✓ built in 1.76s`) — taxmin tasdiqlandi: transient edi, kod muammosi emas. |
| `oxlint` | ✅ PASS (0 yangi xato — faqat oldindan mavjud ogohlantirishlar) |
| `npm run tekshir` (barcha oracle) | ✅ PASS (jumladan `tizim02` REGISTR.json — yangi `apiT2KoprikXatolarOl` funksiyasi sababli eskirgan edi, `node tizim02/registr.gen.cjs` bilan qayta yasaldi) |
| `node --check` (ikkala GAS fayl) | ✅ PASS (sintaksis) |
| DB acceptance (Section 20 A-H) | ⛔ **ISOLATED_DB_REQUIRED** — o'tkazilmadi |

---

## FINAL REPORT

```
FINAL_SHA: (push'dan keyin quyida)

EXACT_F2_E2E: QISMAN — frontend+GAS source darajasida tuzatildi, DB darajasida QAYTA tasdiqlanmadi (ISOLATED_DB_REQUIRED)
PARSER_SOURCE_AMOUNT: PASS — F2 faylning haqiqiy SUMMA ustuni endi frontend'da HAM, GAS source'da HAM aniqlanadi va forward qilinadi (avvalgi noto'g'ri taxmin tuzatildi)
FRONTEND_V2: PASS (TestF2Import.tsx) / OPEN (TestF2.tsx — source document yo'q, "certified" tegishli emas)
READ_MODELS: FAIL (o'zgartirilmadi, ISOLATED_DB_REQUIRED + hali real ma'lumot yo'q)

PRICE_CONTROL: O'ZGARISHSIZ (avvalgi bosqich, qayta tekshirilmadi)
FROZEN: O'ZGARISHSIZ
AT_RISK: O'ZGARISHSIZ
PRICE_BASIS: O'ZGARISHSIZ
PRE_APPROVAL_AUDIT: FAIL (yozilmagan)

ADDITIONAL_REPLACEMENT: FAIL (ISOLATED_DB_REQUIRED, yangi SQL yozilmadi)
CATALOG_PIPELINE: FAIL (o'zgarishsiz)
SHEET_BRIDGE_SOURCE: QISMAN PASS — blanket PATCH va bo'sh catch(e){} (ikkita eng jiddiy nuqson) mavjud sxema bilan tuzatildi; to'liq event/operation_id konvert va event-based echo suppression hali OCHIQ

CODEX_TREE_INTEGRATED: NO — Codex hali branch push qilmagan

PRODUCTION_RESIDUE: NONE — bu bosqichda faqat READ-ONLY schema-introspection so'rovlari yuborildi, hech qanday DDL/DML/BEGIN-ROLLBACK test YO'Q

READY_FOR_ANTIGRAVITY_FINAL_AUDIT: NO — ko'p bo'lim ochiq (read models, additional/replacement, catalog pipeline, to'liq bridge, pre-approval audit)

READY_FOR_OWNER_REAL_PARK_SMOKE: NO — uchdan-uchga hali to'liq ulanmagan

PRODUCTION_WRITE_REQUIRED: YES (keyingi bosqichlarda) — bu safar HECH NARSA productionga yozilmadi/qo'llanilmadi
```

**Owner uchun eslatma**: T2-REAL-PARK-LRV-CLOSURE-005'ning to'liq
bajarilishi uchun **isolated/staging Supabase DB** kerak (Pro plan —
branching funksiyasi hozir mavjud emas). Shusiz DB-darajasidagi
qolgan ishlar (read models, additional/replacement, catalog pipeline,
to'liq bridge envelope) xavfsiz davom ettirilmaydi.

---

## FINAL CONTINUATION (2026-09-03, davomi) — PRO_PLAN_REQUIRED tasdiqlandi + Codex tree integratsiyasi

### 0-qayta. LOCAL ISOLATED DB — texnik jihatdan mumkin EMASLIGI to'liq tasdiqlandi

Owner ko'rsatmasi: "Supabase hosted branching yagona yo'l emas — local
CLI + Docker orqali ham izolyatsiya mumkin, avval SHUNI sina."
Tekshirildi, natija **texnik jihatdan aniq**:

- `docker --version` — **topilmadi** (bash HAM, PowerShell HAM: `Get-Command
  docker` — hech narsa). Docker Desktop bu mashinada O'RNATILMAGAN.
- `wsl --list` — **topilmadi**. WSL2 distributivi yo'q.
- `podman` — **topilmadi**.
- Local PostgreSQL binari (`psql`/`pg_ctl`/`postgres`) — **topilmadi**.
- `npx supabase --version` — hatto CLI'ning O'ZI ham ishga tushmadi:
  `spawn ...cli-windows-x64\bin\supabase.exe ENOENT` (npx orqali
  yuklab olingan Windows platform-paket buzuq/to'liq emas).

**Muhim texnik nuqta**: bu — "Windows binary muammosi, npx bilan
aylanib o'tsa bo'ladi" degan holat EMAS. `supabase start` — arxitektura
jihatdan Docker Compose orkestratsiyasi (Postgres+GoTrue+PostgREST+...
konteynerlar sifatida). CLI qanday chaqirilishidan (npx/pnpm/global)
qat'i nazar, ORQADA baribir Docker (yoki Podman) kerak — bu CLI'ning
o'zi emas, uning ISHLASH USULI. Bu mashinada konteyner runtime UMUMAN
yo'q — demak hech qanday chaqirish usuli buni aylanib o'tolmaydi.

**`PRO_PLAN_REQUIRED: YES`** — aniq texnik sabab: (1) konteyner runtime
(Docker/Podman) yo'q, (2) WSL2 yo'q, (3) local Postgres binari yo'q,
(4) `npx supabase` CLI'ning o'zi ham platform-paket xatosi bilan ishga
tushmadi. Muqobil: `pg-mem` (JS in-memory Postgres-simulyatori) kabi
vositalar ko'rib chiqildi, lekin ATAYLAB ishlatilmadi — u `security
definer` funksiyalar, trigger'lar, to'liq PL/pgSQL semantikasini ishonchli
simulyatsiya qilmaydi; "test o'tdi" degan SOXTA ishonch berishi mumkin
(pg-mem'da o'tib, haqiqiy Postgres'da yiqiladigan holat) — bu aynan
oldingi bosqichdagi incident'dan keyin ENG KO'P qochish kerak bo'lgan
narsa. Shu sabab DB-darajasidagi yangi SQL (read models, additional/
replacement, catalog pipeline, bridge event sxemasi) bu bosqichda ham
**YOZILMADI** — tasdiqlash yo'li yo'q holda murakkab trigger/RPC yozish
xavfni oshiradi, kamaytirmaydi.

### 1. CODEX TREE — TO'LIQ REVIEW VA INTEGRATSIYA

`codex/t2-smeta-tree-ux-v1` @ `836280d` tekshirildi (blind merge
QILINMADI). To'liq tafsilot: `ops/handoff/T2_SMETA_TREE_IMPLEMENTATION_001_CLAUDE.md`.

**Qisqacha**: `utils.ts`/`utils.test.ts` — **ACCEPT** (haqiqiy O(n²)→O(n)
tuzatish, 10k-qatorli test bilan isbotlangan, qayta formatlab
integratsiya qilindi). `SmetaTree.tsx` — **REJECT** (blind merge emas —
REAL REGRESSIYA topildi: `Holat.tsx` sahifasi `isEditMode`/`onNodeDrop`
orqali inline-tahrirlash va drag-dropga tayanadi, Codex'ning qayta
yozilgan komponenti bu funksiyalarni TIP XATOSIZ, JIM o'chirib
qo'yardi). Mavjud, ishlab turgan `SmetaTree.tsx` o'zgarishsiz qoldi,
faqat tezroq `utils.ts` ostiga ulandi.

**TREE_CODEX_SHA**: `836280d07c70e731e1400272773d14bbe0e1360d`
**TREE_INTEGRATION_DECISION**: ADAPT (utils.ts/utils.test.ts ACCEPT,
SmetaTree.tsx REJECT — sabab yuqorida va alohida hujjatda).

Gates (Claude muhitida, mustaqil qayta ishga tushirildi — Codex build
"parallel Node pressure" sababli tugallanmagan edi): `tsc -b` PASS,
`vitest run` (to'liq, 130/130, 26 fayl) PASS, `oxlint` PASS (0 yangi),
`npm run tekshir` PASS. Vizual/responsive (1366/1536/1920/125%) claim'lar
KOD darajasida emas — bu safar brauzerda QAYTA tekshirilmadi (vaqt
tanqisligi, halol aytiladi).

### 2-11 (read models, price control website, pre-approval, additional/
replacement, catalog pipeline, bridge event model) — **O'ZGARISHSIZ**,
Bo'lim 0-qayta'dagi PRO_PLAN_REQUIRED sababli. Xavfsizlik ustuvor: yangi,
tasdiqlanmaydigan murakkab SQL yozishdan tiyildim.

### YAKUNIY HISOBOT (bu davomiy bosqich uchun)

```
FINAL_SHA: (push'dan keyin)

CODEX_TREE_INTEGRATED: PASS (ADAPT — utils.ts ACCEPT, SmetaTree.tsx REJECT, sabab bilan)
TREE_BUILD: PASS (tsc -b, tsc functions, vite build, vitest, oxlint, tekshir — barchasi Claude muhitida mustaqil PASS)
TREE_1366: NOT_VERIFIED (kod darajasida emas, vizual sinov bu safar o'tkazilmadi)
TREE_10K: PASS (haqiqiy 10 000-qatorli test, utils.test.ts)

LOCAL_SUPABASE: FAIL — Docker/Podman/WSL2/local Postgres HECH BIRI yo'q, npx supabase CLI ham ishga tushmadi
EXACT_F2_E2E: QISMAN (avvalgi davomdan o'zgarishsiz — frontend/GAS source tuzatildi, DB darajasida tasdiqlanmagan)
READ_MODELS: FAIL (o'zgarishsiz, PRO_PLAN_REQUIRED)
PRICE_CONTROL: O'ZGARISHSIZ (avvalgi bosqich holicha)
PRE_APPROVAL: FAIL (yozilmagan)
ADDITIONAL_REPLACEMENT: FAIL (PRO_PLAN_REQUIRED)
CATALOG_PIPELINE: FAIL (o'zgarishsiz)
SHEET_BRIDGE: QISMAN (avvalgi bosqichda ikkita nuqson tuzatilgan; to'liq event model PRO_PLAN_REQUIRED)

PRODUCTION_RESIDUE: NONE

READY_FOR_ANTIGRAVITY_FINAL_AUDIT: NO
READY_FOR_OWNER_REAL_PARK_SMOKE: NO

PRO_PLAN_REQUIRED: YES
  Sabab: bu Windows mashinada konteyner runtime (Docker Desktop yoki
  Podman) O'RNATILMAGAN, WSL2 distributivi YO'Q, va local PostgreSQL
  binari ham YO'Q. Supabase CLI'ning "local dev stack"i (`supabase
  start`) arxitektura jihatdan Docker Compose orkestratsiyasi bo'lib,
  bu konteynerlarsiz ISHLASHI MUMKIN EMAS — bu CLI chaqirish usuliga
  (npx/pnpm/global) bog'liq emas, balki uning ishlash tamoyiliga
  bog'liq. `npx supabase` CLI'ning o'zi ham alohida sabab bilan (Windows
  platform-paket ENOENT) ishga tushmadi — bu ikkinchi, mustaqil
  blokator. Muqobil (pg-mem kabi in-memory simulyatorlar) ataylab
  ishlatilmadi, chunki ular soxta "PASS" ishonchi berishi mumkin
  (to'liq PL/pgSQL/trigger semantikasi yo'q) — bu aynan oldingi
  incident'dan keyin qochish kerak bo'lgan xavf turi.
```

