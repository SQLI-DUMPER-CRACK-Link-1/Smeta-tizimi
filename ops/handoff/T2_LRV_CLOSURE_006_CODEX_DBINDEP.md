# T2-LRV-CLOSURE-006-CODEX-DBINDEP — Codex lane (DB-independent, parallel to Tree V2)

**Rol:** Implementation engineer (Codex)
**Branch:** yangi, `codex/t2-lrv-dbindep-v1` (yoki mos nom) — `origin/integration/next-main-release-v1` dan boshlang'ich olinsin (Claude bu round push qilgach).
**Bog'liq emas:** `codex/t2-smeta-tree-ux-v2` (Tree V2) — bu lane UNGA TEGMAYDI, `frontend/src/umumiy/daraxt/**` ga qo'l tegmasin. Ikkala lane parallel boradi.
**Muddat/blocker:** YO'Q — bu lane DB-independent, isolated DB yoki Tree V2 kutish shart emas.

## Nega bu lane

T2-LRV-CLOSURE-006 (Claude, `ops/handoff/T2_LRV_CLOSURE_006_CLAUDE.md`) Section 3'da
qolgan DB-independent band'lar bor, lekin Claude bir vaqtda ikkita katta blockerni
(Codex Tree V2 kutish + isolated-DB/baseline arxitekturasi) boshqaryapti. Shu ish
Codex bilan parallel bo'linadi — ikki agent bir-birining fayliga tegmaydi.

## Vazifa 1: Additional/Replacement client contract (backend RPC'siz)

LRV Control qonuni (`ops/handoff/T2_LRV_CONTROL_001_CONTRACT.md`) talabi:
`createAdditionalWork`, `createReplacementWork`, `addResourceChild` — mavjud
`t2_qator`/`t2_smeta_ozgarish_*` ustida (parallel jadval YO'Q), stable ID,
`operation_id`, `expected_version`, idempotentlik, audit, parent/ordering.

Backend RPC hali yozilmaydi (isolated DB kerak — Claude tomonidan keyinroq).
**Sen shu ROUNDDA qiladigan narsa — faqat frontend TAYYORGARLIK qatlami:**

1. `frontend/src/api/t2-additional-replacement.ts` (yangi fayl) — TypeScript
   TYPE'lar (RPC hali yo'q payload/response shakllari) + client wrapper
   funksiyalar (`sbT2QoshimchaIshYarat`, `sbT2ZamenaIshYarat`,
   `sbT2ResursBolaQosh` — nomlash repo konvensiyasiga mos, `frontend/src/api/supabase.ts`
   dagi `sbT2...` uslubiga qara) — HAR BIRI `operationId`/`expectedVersion` majburiy
   parametr sifatida oladi (idempotentlik/optimistic-lock kontraktini frontendda
   ham kafolatlash uchun).
2. Bu funksiyalar hozircha `/api/sb-yoz`ga chaqiruv YO'LLAYDI, lekin backend RPC
   yo'qligi sabab **hozircha ishlamaydi** — bu NORMAL, chunki maqsad shakl/kontraktni
   qotirish, ishlatishni EMAS. `sb-yoz.ts`ning `AMALLAR` whitelist'iga YANGI RPC nomi
   QO'SHMA (RPC hali mavjud emas — qo'shsang whitelist soxta bo'ladi).
3. Vitest: har funksiya to'g'ri shape (URL/body/RPC nomi) yasashini tekshiruvchi
   pure unit test — HAQIQIY tarmoq/DB chaqiruvisiz (`fetch` mock qilinadi, repo'da
   allaqachon shu uslubdagi testlar bor — masalan `frontend/src/api/*.test.ts`
   qidir va o'sha patternga mosla).
4. Bitta qisqa `docs/architecture/` yoki shu faylning o'zida izoh: RPC signature
   TAKLIF (Claude/owner keyin isolated DB'da tasdiqlaganda RPC'ning o'zi yoziladi) —
   "TAKLIF, HALI QABUL QILINMAGAN" deb ANIQ belgila, xuddi tasdiqlangandek yozma.

## Vazifa 2: Catalog ingestion adapter (parser qatlami, DB'siz)

`supabase/migrations/20260919120000_t2_construction_catalog_observation_v1*.sql`
allaqachon bor (schema — work/material/resource/equipment/work-resource-recipe
observation jadvallari). Hali ULANMAGAN: SMETA/F2 yuklanganda shu jadvallarga
observation yozish PIPELINE'i.

**Shu roundda qiladigan narsa — faqat PURE parser/adapter qatlami:**

1. `frontend/src/lib/catalog-ingest/` (yangi papka) — kirish: smeta/F2 daraxt
   tugunlari (mavjud `TreeNode`/`DaraxtTugun` shakli), chiqish: observation
   yozuvlari kandidatlari (`{tur: 'ish'|'material'|'resurs'|'texnika', nom, kod,
   birlik, narx?, ...}` — schema'dagi ustunlarga mos).
2. **QAT'IY QOIDA (LRV Control qonunidan)**: faqat ANIQ deterministik moslik
   auto-link qilinadi (kod+nom+birlik aniq mos kelsa). Noaniq holat — "candidate/review"
   ro'yxatiga tushadi, AVTOMATIK YOZILMAYDI. Fuzzy auto-merge QAT'IY TAQIQ.
   Cross-object narx contamination (bir obyektning narxi boshqasiga sizib chiqishi)
   QAT'IY TAQIQ — har observation faqat o'z `kompaniya_id`/`obyekt_id` doirasida.
3. Bu ham pure funksiya — DB yozish YO'Q, faqat "shu smeta tugunlaridan qanday
   observation yozuvlari CHIQARILADI" logikasi. Vitest bilan tekshir (aniq mos —
   auto-link; noaniq — candidate; ikki xil obyekt — contamination yo'qligi).
4. DB yozish qismi (real INSERT/RPC) Claude tomonidan isolated DB kelganda
   ulanadi — sen faqat "qanday yozuv kerak" mantig'ini tayyorlaysan.

## QAT'IY CHEKLOVLAR (butun sessiya qoidasi, bu lane uchun ham amal qiladi)

- Production Supabase'ga HECH QANDAY DDL/DML/ulanish YO'Q.
- `main`ga push/merge YO'Q. Faqat o'z branch'ingga commit/push (owner sizga
  standing git-avtonomiya berdi — push qilishga ruxsat bor, lekin integration
  branch'ga MERGE qilish Claude orqali review'dan o'tadi, blind-merge yo'q).
- `frontend/src/umumiy/daraxt/**` ga TEGMA (Tree V2 lane'ning hududi).
- Claude bu round yozgan fayllarga tegma: `frontend/src/test02/f2-exact-payload.ts`,
  `frontend/src/test02/f2-exact-payload.test.ts`, `supabase/isolated-test/**`,
  `supabase/baseline/**` (parallel ish, konflikt oldini olish uchun).
- Soxta PASS yo'q: agar biror narsa DB'siz tekshirib bo'lmasa — "NOT_TESTED (DB
  kerak)" deb ochiq yoz, "PASS" deb yozma.

## Report

Tugagach: `ops/handoff/T2_LRV_CLOSURE_006_CODEX_DBINDEP_REPORT.md` (yoki repo
konvensiyasidagi `_CODEX.md` qo'shimchasi bilan) — nima qilindi, qaysi fayllar,
gates natijasi (vitest/tsc/lint), va aniq ochiq qolgan narsalar ro'yxati.
