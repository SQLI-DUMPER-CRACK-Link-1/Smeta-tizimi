# T2-PTO-CLOSURE-007-CODEX-CATALOG-WRITE

**Rol:** Implementation engineer (Codex)
**Branch:** yangi, `codex/t2-catalog-write-v1` — base:
`origin/integration/next-main-release-v1`
**Nega HOZIR xavfsiz**: `frontend/src/lib/catalog-ingest/` allaqachon
merge qilingan (pure, DB yozmaydi), lekin hech qanday sahifa uni
chaqirmaydi va jadvallar (`t2_work_type_observation` va h.k.) `revoke all
from public, anon, authenticated` bilan qulflangan — HECH KIM (frontend
ham) hozircha yoza olmaydi. Bu ish ham route-cutover qaroridan mustaqil.

## Vazifa

`observationsFromTree()`/`matchCatalogObservations()` (allaqachon bor,
pure) natijasini HAQIQIY yozadigan RPC yoz:

1. Yangi migration: `supabase/migrations/20260924130000_t2_catalog_write_v1.sql`.
2. `t2_catalog_observation_yoz_v1(p_kompaniya_id, p_actor_id, p_scope
   jsonb, p_observations jsonb, p_operation_id)`:
   - `p_scope`: `{object_id, project_id?, document_id?, revision_id?,
     source_type}` (mos `CatalogIngestScope` turi bilan,
     `frontend/src/lib/catalog-ingest/types.ts`ga qara).
   - `p_observations`: `CatalogObservation[]` (`kind`, `resourceKind?`,
     `sourceLineKey`, `code?`, `name`, `unit?`, `sourcePrice?` maydonlari
     bilan — front-end turi bilan AYNAN mos).
   - Har observation uchun: `kind='work_type'` bo'lsa
     `t2_work_type_observation`ga, `kind='resource'` bo'lsa
     `t2_resource_observation`ga yoz (`resource_kind` ustuniga
     `resourceKind`).
3. **QAT'IY QOIDA (Cross-Object Price Safety, `T2_LRV_PRODUCT_AUDIT_001_
   ANTIGRAVITY.md` Section 5):**
   - `sourcePrice` FAQAT observation yozuvining o'zida saqlanadi
     (jadval sxemasida narx ustuni yo'q — buni tekshir: agar SQL
     jadvalida narx ustuni yo'q bo'lsa, `sourcePrice`ni SAQLAMA, faqat
     observation identity (kod/nom/birlik) yoz; narx boshqa hech qanday
     jadval/obyektga sizib chiqmasin).
   - Har observation `company_id`ga (frontend'dagi kabi) QAT'IY bog'liq —
     boshqa kompaniya ma'lumoti bilan aralashmasin.
4. Auto-link: agar aniq bitta `t2_ish_turi`/`t2_narx`/`t2_material_alias_
   royxat` nomzodi topilsa (aynan `code+nom+birlik`, normallashtirilgan,
   `matchCatalogObservations()`dagi mantiqqa mos) — `t2_catalog_match_
   candidate`ga `holat='tasdiqlangan'`, `candidate_canonical_kod` bilan
   avtomatik yoz. Bir nechta nomzod yoki nol nomzod — `holat='kutmoqda'`.
   **Fuzzy auto-merge QAT'IY TAQIQ** — faqat aniq (exact, normallashtirilgan)
   moslik.
5. Avtorizatsiya/idempotentlik/audit — Additional/Replacement RPC'lardagi
   bilan bir xil pattern (`t2_actor_kompaniya_azo_tekshir`, `p_operation_id`).
6. `frontend/functions/api/sb-yoz.ts`ga `amal: 'catalog_observation_yoz_v1'`
   qo'sh.
7. `.rollback.sql`/`.acceptance.sql` + sintetik ma'lumot bilan sinov,
   TOZALAB (yuqoridagi boshqa brifdagi bilan bir xil intizom: sintetik
   `company_id`/observation yarat, tekshir, `delete`).

## QAT'IY CHEKLOVLAR

Xuddi `T2_PTO_CLOSURE_007_CODEX_ADDITIONAL_REPLACEMENT_BACKEND.md`dagi
bilan bir xil: faqat shu bitta migratsiya, haqiqiy ma'lumotga tegma,
`main`/GAS/Cloudflare deploy yo'q. Qo'shimcha:
`frontend/src/lib/catalog-ingest/index.ts`/`.test.ts`ning pure mantig'ini
O'ZGARTIRMA — faqat YANGI RPC qo'sh, mavjud pure funksiyalarni chaqir.

## Report

`ops/handoff/T2_PTO_CLOSURE_007_CODEX_CATALOG_WRITE_REPORT.md`.
