# T2-LRV-EXACT-F2-ADAPTER-003 — Codex handoff

**Holat:** SOURCE-ONLY. Production/main ga hech narsa qo'llanmagan yoki push qilinmagan.

## BASE / BRANCH / HEAD

- **Base:** `0f8cb090693094b0d25e673611005d7218d7c525` (`integration/next-main-release-v1`)
- **Branch:** `codex/t2-lrv-exact-f2-adapter-v1`
- **HEAD:** branchning yakuniy SHA si integratorga yuboriladigan handoff
  hisobotida qayd etiladi (hujjat ichiga o'z-o'zini o'zgartiradigan SHA
  kiritilmaydi).

## EXISTING_SCHEMA_REUSED

**HA.** Canonical scope: `t2_qator`; F2/Fakt hujjati: `t2_akt` va
`t2_akt_qator`; kumulyativ projection: `t2_qator_holat` va `t2_lrv`.
`t2_lrv_*` parallel jadvali yoki yangi LRV truth yaratilmagan.

## EXACT_SOURCE_AMOUNT

`20260920120000_t2_lrv_exact_f2_adapter_v2.sql` `t2_akt_qator`ga faqat
additive manba ustunlarini qo'shadi:

- `source_certified_hajm`, `source_certified_narx`, `source_certified_summa`;
- immutable `source_line_id` hamda `source_line_snapshot`;
- `source_provenance`: `source_verified`, `legacy_unproven`,
  `price_intentionally_absent`.

Generated `summa` saqlanadi, ammo endi u source amount o'rnida ishlatilmaydi.
Read RPC `t2_f2_exact_qatorlar_v1` source amount, calculated amount va
`amount_mismatch`ni alohida qaytaradi. Misol: `10 × 123.45 = 1234.50`, lekin
source `1234.49` bo'lsa, `1234.49` o'zgarmaydi va farq ochiq ko'rinadi.

## PRICE_FALLBACK

Eski `t2_akt_yarat` o'zgartirilmadi: u legacy callerlar uchun production
compatibility yo'li bo'lib qoladi. Yangi `t2_akt_yarat_v2` faqat F2 import
uchun opt-in adapter:

- actor DB a'zoligi bilan tekshiriladi;
- `operation_id` majburiy;
- `source_line_id` majburiy;
- source narx yoki source summa bo'lmasa, `MISSING_CERTIFIED_PRICE`;
- faqat hujjatda narx ataylab yo'qligi belgilansa `price_intentionally_absent`;
- smeta `q.narx`iga jim fallback qilmaydi.

## RAW_PROVENANCE / FROZEN_HISTORY

Tarixiy qatorlar uchun hech qanday backfill yo'q. Ular default
`legacy_unproven` bo'lib qoladi; generated `hajm × narx` source fact deb
nomlanmaydi. `t2_akt_qator_source_freeze_v2` triggeri parent F2
`tasdiqlangan` bo'lgach source triplet/snapshot/provenance o'zgarishini rad
etadi (`APPROVED_F2_SOURCE_FROZEN`). Baseline, catalog, procurement yoki fakt
narxi o'zgarsa ham ushbu manba snapshotiga yozilmaydi.

## CHANGE_RELATION

Mavjud `t2_smeta_ozgarish` / `t2_smeta_ozgarish_qator` change ledgeri
saqlanadi. `t2_qator`ga faqat nullable `replaces_line_id`, `change_type`
(`ADDITIONAL|REPLACEMENT`) va `change_id` qo'shiladi. Yangi change engine
yo'q; professional `nom`ga matnli banner yoki mutation qo'shilmaydi.

## CATALOG_RECONCILIATION

Claude ning `20260919120000_t2_construction_catalog_observation_v1.sql`dagi
`t2_work_type_observation`, `t2_resource_observation`,
`t2_work_resource_observation`, `t2_catalog_match_candidate` qayta
ishlatiladi. Ushbu task katalog jadvali yoki fuzzy auto-merge yozmadi.
Ambiguous match candidate bo'lib qoladi; qator raqami identity emas.

## TESTS

- `exact-f2-adapter.test.ts`: **4/4 PASS** — exact amount, legacy no-false
  backfill, fail-closed price, explicit absent price.
- `f2-import-bind.test.ts` bilan focused run: **14/14 PASS** — mavjud
  deterministic/non-positional F2 binding regressiyasi saqlangan.
- `npx tsc -b`: **PASS**.
- `npm run build`: **PASS**.
- `npm run tekshir`: **PASS**.
- `node ops/governance-check.cjs`: **PASS**.

## MIGRATION_ACCEPTANCE / ROLLBACK

Forward, `BEGIN…ROLLBACK` acceptance va PRE-USE rollback fayllari bor.
Bu taskda production migration apply qilinmadi. Acceptance sentinel:
`LRV_EXACT_F2_ADAPTER_ACCEPTANCE_PASS`. Rollback source fact mavjud bo'lsa
qat'iy rad etadi; tarixni o'chirmaydi.

## CLAUDE INTEGRATION NOTES

1. Migrationni apply qilishdan oldin disposable DB yoki `BEGIN…ROLLBACK`
   acceptance ishlatilsin; productionga ko'r-ko'rona apply qilinmasin.
2. Cloudflare BFF/F2 import callerini `t2_akt_yarat_v2`ga bosqichma-bosqich
   o'tkazish alohida integratsiya qadamidir. Eski callerlar v1da qolganidan
   keyin v1 fallbackini o'zgartirish uchun real caller inventory kerak.
3. F2 approval lifecycle mavjud `t2_akt_tasdiqlash` orqali davom etadi;
   freeze trigger tasdiqlangandan keyingi o'zgartirishni bloklaydi.

## READY_FOR_CLAUDE_INTEGRATION

**YES — source-level.** Production/main: **NONE**.
