# STOR-001 — Multi-company storage foundation (yakuniy hardening + release)

- TASK ID:              STOR-001
- OWNER:                codex
- OBJECTIVE:            `codex/company-storage-foundation-v1` ishini joriy `main`
                        ustiga keltirib, ishlab chiqarishga tayyor holatga
                        yetkazish: har bir T2 kompaniya/loyiha/obyekt uchun
                        storage yagona haqiqat Postgresda; Drive faqat tashqi
                        proyeksiya; global Drive fallback nol (legacy-only koddan
                        tashqari).
- REPO:                 github.com/SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi
- BASE REF / SHA:       origin/main @ 37e5f0e  (verified remote 2026-08-31)
- CURRENT WORK BRANCH:  codex/company-storage-foundation-v1
                        (main’dan 9 commit oldinda, 0 orqada)
- NEW WORK BRANCH:      codex/company-storage-foundation-v1  (rebase qilinadi)
- REQUIRED READING:
    - AGENTS.md
    - docs/governance/CONSTITUTION.md
    - docs/governance/CURRENT_STATE.md
    - ops/ACTIVE_TASKS.json
    - docs/governance/AGENT_COMMS_PROTOCOL.md
    - supabase/migrations/20260830052000_t2_company_storage_foundation_v1.sql
      (+ .rollback.sql, .acceptance.sql, .reconciliation.sql)
    - Smeta tizimi/97_T2Storage.js, Smeta tizimi/06_ObyektPapka.js

## OWNED PATHS (faqat shular)
```
supabase/migrations/20260830052000_t2_company_storage_foundation_v1*.sql
supabase/migrations/20260830044354_t2_signal_bulk_import_coalescing.sql
Smeta tizimi/97_T2Storage.js
Smeta tizimi/06_ObyektPapka.js
Smeta tizimi/95_ObyektHujjat.js
Smeta tizimi/30_Panel.js
Smeta tizimi/T2_Import.js
Smeta tizimi/T2_Yuklash.js
frontend/testlar/t2_company_storage.test.cjs
frontend/testlar/t2_project_storage.test.cjs
frontend/testlar/t2_object_create.test.cjs
frontend/testlar/t2_document_upload.test.cjs
frontend/testlar/hammasi.cjs
tizim02/REGISTR.json  tizim02/navbat.json  tizim02/tasnif.json  tizim02/KEYINGI.md
ops/releases/STOR-001.md   (yangi)
```

## DO-NOT-TOUCH
- `frontend/src/**` (mindmap/participant UX — MIND-001/ENT-001 hududi)
- root `main` push, boshqa worktreelar
- foydalanuvchining dirty fayllari (Excel/DOCX/PDF/wrangler/biznes fayllar)
- `.git/*.lock` — o‘chirilmaydi

## ARCHITECTURAL INVARIANTS
1. Yangi T2 kompaniya **hech qachon** `ROOT_FOLDER_ID` / TIZIM_01 root /
   boshqa kompaniya workspace’ini implicit meros olmaydi. Legacy root faqat
   `t2_company_storage_legacy_allowlist` ичидаги kompaniya uchun, `status='legacy'`
   yozuvi orqali.
2. Nom = identity emas. Papka/fayl faqat saqlangan `root_folder_id` /
   `folder_id` / `external_file_id` bo‘yicha topiladi. Global root skan,
   obyekt-nom bo‘yicha global qidiruv — TAQIQLANGAN.
3. Postgres + Drive bitta ACID tranzaksiya emas. Aniq holat modeli:
   `pending -> (provision) -> verified` yoki `failed`. `failed`da eski/global
   rootga fallback YO‘Q.
4. `operation_id` (caller-generated uuid) idempotentlik: bir xil operation_id
   ikkinchi obyekt/papka/hujjat yaratmaydi — original kanonik natijani qaytaradi.
5. `expected_version` / `versiya`: eskirgan mutatsiya `STALE_VERSION` bilan rad.
6. Interaktiv yo‘lda (obyekt yaratish) yangi sinxron O(n) skan yo‘q. Signal/
   ko‘zgu/rollup — trigger yengil qoladi (bulk import coalescing buzilmaydi).
7. Company A → Company B workspace’iga yoza olmaydi (RLS + command funksiyasi
   ичида invariant tekshiruvi; `service_role` RLS’ni chetlab o‘tishini hisobga ol).

## STABLE ERROR CODES (UI tarjima qiladi)
`STORAGE_WORKSPACE_NOT_CONFIGURED`, `STORAGE_ROOT_NOT_VERIFIED`,
`OBJECT_STORAGE_NOT_PROVISIONED`, `STORAGE_TENANT_MISMATCH`,
`LEGACY_WORKSPACE_FORBIDDEN`, `STALE_VERSION`, `OPERATION_ID_REQUIRED`,
`PROJECT_COMPANY_MISMATCH`.

## ISH BOSQICHLARI

### Bosqich 1 — Reality reconciliation (majburiy, kod yozishdan oldin)
- `git fetch --all --prune` muvaffaqiyatli bo‘lishини tasdiqla.
- Branchni `origin/main @ 37e5f0e` ustiga rebase qil.
- Production DB (`tuoyrzadkgoltpqkdiyx`) migratsiya ro‘yxati bilan solishtir.
  ANIQLANGAN DRIFT:
  * prod’da `20260830044354 t2_signal_bulk_import_coalescing` — ALLAQACHON bor.
  * prod’da `20260830040816 t2_signal_trigger_keep_object_create_fast` — bor
    (repo’da `...050000...` nomi bilan; bir xil mazmun bo‘lishини tekshir).
  * prod’da `t2_company_storage_foundation_v1` — YO‘Q. Bu — asosiy yetkazma.
- `ops/mailbox/STOR-001/`da drift xulosasini yoz: qaysi migratsiya faylni
  no-op/`if not exists` qilib qoldirish kerak, qaysi biri yangi qo‘llanadi.
- `20260830052000` migratsiyasi **idempotent** bo‘lsin (`create table if not
  exists`, `add column if not exists`, `create ... if not exists` — hozir shunday
  ko‘rinadi, tasdiqla). Prod katalogi bilan to‘qnashmasin.

### Bosqich 2 — Backend to‘liqlash
- `t2_company_storage_workspace`, `t2_project_storage_binding`,
  `t2_object_storage_binding`, `t2_document_registry` uchun **command
  funksiyalari** (SECURITY DEFINER) mavjud va invariantlarni o‘zi tekshiradi:
  `bind_company_storage`, `provision_project_storage`, `provision_object_storage`,
  `register_document`. Har biri: authenticate → tenant/loyiha tekshir → holat
  tekshir → versiya → operation_id → minimal tranzaksiya → audit → kanonik natija.
- RLS: `t2_company_storage_*` va binding jadvallari uchun policy’lar
  company membership + project participation asosida. `service_role` grantlari
  minimal.
- `06_ObyektPapka.js` / `97_T2Storage.js`: obyekt yaratish endi
  `provision_object_storage` orqali; global root qidiruvi olib tashlangan
  (diff allaqachon 215→~50 qatorga qisqargan — tasdiqla, qoldiq fallback yo‘qligini
  isbotla).

### Bosqich 3 — Testlar (behavioral, "funksiya bor" yetarli emas)
- `t2_company_storage.test.cjs` — Company A Company B rootiga yoza olmasligi.
- `t2_project_storage.test.cjs` — workspace verified bo‘lmasa provisioning FAIL,
  fallback yo‘q.
- `t2_object_create.test.cjs` — operation_id retry ikkinchi obyekt yaratmaydi;
  stale versiya `STALE_VERSION`.
- `t2_document_upload.test.cjs` — hujjat faqat verified object binding ostида.
- Static regression guard: repo’da `ROOT_FOLDER_ID` global fallback pattern
  faqat legacy-only faylda uchraydi (grep testi).
- `node frontend/testlar/hammasi.cjs` yashil.
- `node ops/governance-check.cjs` yashil.

### Bosqich 4 — Release paketi: `ops/releases/STOR-001.md`
Quyidagilar bilan:
- WHAT WILL CHANGE (jadval + funksiyalar ro‘yxati)
- DB MIGRATIONS: `20260830052000_t2_company_storage_foundation_v1.sql`
  (+ signal fayllar drift-reconciled)
- ROLLBACK: `...rollback.sql` (mavjud — tekshir, to‘liq drop qamrovi)
- GAS DEPLOYMENT: `97_T2Storage.js`, `06_ObyektPapka.js`, `95_ObyektHujjat.js`
- CLOUDFLARE: bu bosqichда o‘zgarish yo‘q (frontend tegilmaydi) — tasdiqla
- ACCEPTANCE SQL: `...acceptance.sql` — kutilgan natijalar bilan
- RECONCILIATION: `...reconciliation.sql` — legacy Drive: MATCHED / AMBIGUOUS /
  MISSING; faqat MATCHED kanonik binding bo‘ladi, hech narsa avto-ko‘chirilmaydi
- LIVE SMOKE PLAN: (1) yangi test kompaniya → workspace bind → verified;
  (2) loyiha → provision → verified; (3) obyekt yaratish → folder_id yozildi,
  global qidiruv yo‘q; (4) hujjat yuklash → registry yozuvi
- RISK SUMMARY + rollback vaqti

## ACCEPTANCE (ob'ektiv)
- Joriy T2 global Drive fallback = **0** (legacy-only koddan tashqari), grep bilan isbot.
- Normal T2 Drive resolyutsiyasi: company/project/object kanonik ID → saqlangan
  folder ID → to‘g‘ridan-to‘g‘ri provider lookup. Global root skan yo‘q.
- Barcha yangi behavioral testlar + `hammasi.cjs` + `governance-check.cjs` yashil.
- Rebase toza, `main`ga fast-forward mumkin.
- `ops/releases/STOR-001.md` to‘liq.

## FORBIDDEN ACTIONS
prod migratsiya qo‘llash · `main` push/merge · `.git` lock o‘chirish ·
`git reset --hard` / `git clean` · boshqa worktree yoki dirty user fayllarга tegish ·
`frontend/src/**` tahrirlash · yangi arxitektura kontrakti Claude tasdig‘isiz.

## EXPECTED FINAL OUTPUT
1. `codex/company-storage-foundation-v1` rebased + pushed.
2. `ops/mailbox/STOR-001/NN-codex.md`: `DONE` + diff --stat + test loglari +
   drift reconciliation xulosasi + ochiq savollar.
3. `ops/releases/STOR-001.md` to‘ldirilgan.
4. `ops/ACTIVE_TASKS.json`da STOR-001 `status: review`.
Ishchi DONE yoki haqiqiy BLOCKER (§7 AGENT_COMMS_PROTOCOL) gача to‘xtamaydi.
