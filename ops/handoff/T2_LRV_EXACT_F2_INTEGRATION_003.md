# T2-LRV-EXACT-F2-INTEGRATION-003 — CONTRACT

**Rol:** Chief Integrator / Backend / Release Owner (Claude)
**Sana:** 2026-09-03
**Integration branch:** `integration/next-main-release-v1`
**Codex core:** `codex/t2-lrv-canonical-core-v1` @ `bbf55c8`
**Holat:** SOURCE ONLY. Production freeze davom etadi.

---

## 1. Uch mustaqil source truth — nima yozildi

Bo'lim to'liq: `T2_LRV_CONTROL_001_CONTRACT.md` Section 1 (tuzatilgan).
Qisqacha: `t2_akt_qator.summa` GENERATED (`hajm*narx`) — bu F2 hujjatning
haqiqiy summasini (agar u `hajm*narx`dan farq qilsa) saqlay OLMAYDI.
Tuzatish — ADDITIVE, eski ustunlar buzilmaydi:

- YANGI: `certified_quantity`, `certified_unit_price`, `certified_amount`
  (oddiy ustunlar, GENERATED EMAS), `certified_source_hash`,
  `provenance_status`.
- ESKI: `hajm`/`narx`/`summa` (GENERATED) — compatibility uchun QOLADI.
- Tarixiy qatorlar: `provenance_status='unknown_provenance'`,
  `qty*price`dan BACKFILL QILINMAYDI.

Migratsiya: `supabase/migrations/20260920120000_t2_akt_qator_certified_v1.sql`
(pastda, Bo'lim 6).

---

## 2. F2 PRICE FALLBACK — caller audit natijasi

To'liq dalil: `T2_BRIDGE_CALLER_AUDIT_003.md`. Xulosa: `t2_akt_yarat`
o'zi o'zgartirilmaydi (eski chaqiruvchilar — GAS `T2_F2Import.js` —
undan hali foydalanadi va XAVFSIZ ishlaydi, buzmaslik kerak). Buning
o'rniga **YANGI, alohida `t2_akt_yarat_v2` RPC** yoziladi:

- `p_qatorlar` har bir elementida `certified_qty`, `certified_price`,
  `certified_amount` — UCHALASI HAM talab qilinadi (yoki uchalasi ham
  `null` + `narx_yoq=true`, "hujjatda narx yo'q" holatini bildiradi).
- Agar `certified_price` YO'Q va `narx_yoq` HAM false bo'lsa →
  **`MISSING_CERTIFIED_PRICE` xato, INSERT QILINMAYDI.** Smeta narxiga
  jim qaytish YO'Q — eski `t2_akt_yarat`dagi `coalesce(..., q.narx)`
  bu funksiyada UMUMAN YO'Q.
- `calculated_amount := certified_qty * certified_price` — faqat
  solishtirish uchun; `abs(calculated_amount - certified_amount) > 0.01`
  bo'lsa `F2_ARITHMETIC_MISMATCH` OGOHLANTIRISH qaytariladi (natija
  JSON'da), lekin YOZUV BLOKLANMAYDI — bu hujjatning o'zida shunday
  yozilgan bo'lishi mumkin (Section 1 misoli).

Eski `t2_akt_yarat` — **o'zgartirilmaydi, revoke qilinmaydi**. Ikkalasi
parallel yashaydi to frontend callerlar (`TestF2Import.tsx`, `TestF2.tsx`)
v2'ga o'tguncha — bu UX ishi (narx yo'qligini UI'da qanday ko'rsatish/
tasdiqlash), ushbu backend-architecture bosqichida QILINMAYDI.

---

## 3. Codex `t2-lrv-canonical-core-v1` — RECONCILIATION

Codex 11 ta yangi jadval (`t2_lrv_document`, `_document_revision`,
`_document_line`, `_work_type`, `_work_alias`, `_recipe_version`,
`_recipe_resource`, `_entity`, `_approved_f2`, `_sync_event`,
`_sync_conflict`) + toza pure TS engine (`lrv-canonical-core.ts`) yozgan.

**Muammo**: bu — to'liq PARALLEL canonical model. `t2_lrv_document/
_revision/_line` = `t2_manba`/`t2_akt`/`t2_akt_qator`/`t2_qator`ning
qaytadan yozilishi. `t2_lrv_work_type/_alias` = `t2_ish_turi`/
`t2_material_alias_royxat`ning qaytadan yozilishi. `t2_lrv_entity` =
`t2_qator`ning qaytadan yozilishi (parent/ordering/kind/status —
`t2_qator`da `ota_id`/`tartib`/`tur`/`qoshimcha`+`zamena` allaqachon bor).
Bular — user Section 4'da ANIQ taqiqlagan "mavjud canonical table bilan
parallel `t2_lrv_*` truth".

**Xulosa: har komponent alohida klassifikatsiya qilindi — jadval darajasi
REJECT/ADAPT, semantika darajasi deyarli hammasi ACCEPT.**

| Komponent | Semantika | Jadval sifatida |
|---|---|---|
| `t2_lrv_document/_revision/_line` (immutable source snapshot) | **ACCEPT** | **REJECT_PARALLEL_TRUTH** — `t2_manba`/`t2_akt`/`t2_akt_qator`/`t2_qator` allaqachon bor. **ADAPT**: `raw_snapshot jsonb` + `source_hash text` ustunlarini TO'G'RIDAN-TO'G'RI `t2_akt_qator`/`t2_qator`ga additive qo'shish (yangi migratsiyada, Bo'lim 6) |
| `t2_lrv_work_type/_alias` (catalog + confidence/confirmed) | **ACCEPT** | **REJECT_PARALLEL_TRUTH** — `t2_ish_turi`/`t2_material_alias_royxat` bor. **ADAPT**: bu semantika allaqachon T2-CONSTRUCTION-CATALOG-001'da `t2_catalog_match_candidate.confidence`/`holat` sifatida YOZILGAN (Codex'ning `confidence`/`confirmed` bilan bir xil g'oya) — QAYTA QILINMAYDI, Construction Catalog kontrakti tasdiqlandi |
| `t2_lrv_recipe_version/_resource` (versioned recipe) | **ACCEPT** | **ADAPT** — haqiqatan YANGI g'oya (hech narsa duplikat qilmaydi), lekin FK `t2_lrv_work_type` o'rniga **`t2_ish_turi.id`ga** qarasin — `t2_ish_turi_recipe_version`/`t2_ish_turi_recipe_resource` nomi bilan, alohida parallel work-type jadvalisiz. Bu — KEYINGI bosqich (bu taskda yozilmadi, kontrakt sifatida qayd etildi) |
| `t2_lrv_entity` (base/additional/replacement/resource) | **ACCEPT** semantika (change_type, replaces_line_id, stable id) | **REJECT_PARALLEL_TRUTH** — `t2_qator` bor. **ADAPT**: `t2_qator`ga `replaces_line_id`/`change_type` (LRV_CONTROL_001 Section 5'da allaqachon taklif qilingan) + Codex'ning `created_operation_id uuid unique` g'oyasi — additive qo'shildi (Bo'lim 6) |
| `t2_lrv_approved_f2` (certified_qty/price/amount, frozen) | **ACCEPT to'liq** — bu AYNAN kerakli shakl | **ADAPT**: yangi alohida jadval o'rniga, xuddi shu uchta ustun (`certified_quantity/unit_price/amount`, plain, NOT generated) **to'g'ridan-to'g'ri `t2_akt_qator`ga** qo'shildi (Bo'lim 1/6) — `frozen boolean check(frozen)` g'oyasi ham: yangi `certified_*` ustunlar UPDATE qilinmaydigan qilib RPC darajasida qo'riqlanadi (trigger bilan emas — SOURCE-ONLY bu bosqichda faqat kontrakt) |
| `t2_lrv_sync_event/_conflict` (operation_id/entity_version/base_version/projection_hash/origin, STALE_VERSION/FROZEN_F2/ROW_MAPPING_MISSING) | **ACCEPT to'liq** — aynan Bridge kontraktining yetishmayotgan qismi | **ADAPT**: `entity_id bigint references t2_lrv_entity` o'rniga **generic `entity_table text + entity_id bigint`** juftligi (chunki bitta "entity" jadvali yo'q — `t2_qator`/`t2_akt_qator` ikkalasi ham sync qilinishi kerak). Additive migratsiya yozildi (Bo'lim 7) |
| Pure TS engine (`lrv-canonical-core.ts`) | **ACCEPT to'liq, o'zgarishsiz** | Jadvaldan mustaqil — `Id` generic `string` turi, `t2_qator.id`/`t2_akt_qator.id`ni stringlashtirib ISHLATISH mumkin. Hech qanday moslashtirish kerak emas |

### PARALLEL_TRUTH: NO

Codex'ning 11 ta yangi jadvali **hech biri o'z original shaklida
qabul qilinmadi**. Ularning semantikasi (deyarli 100%) to'g'ri va
qimmatli — lekin FIZIK joylashuvi mavjud canonical jadvallarga
(`t2_qator`, `t2_akt_qator`, `t2_ish_turi`) ADAPT qilindi, aks holda
ikkita "F2/smeta haqiqati" paydo bo'lardi.

### Codex-owned fayllar

`frontend/src/lib/lrv-canonical/lrv-canonical-core.ts` +
`.test.ts` — **o'zgartirilmadi**, to'liq ACCEPT, keyingi bosqichda
DB write-path bilan bog'lanadi (bu taskda emas — hozircha faqat pure
logic, hech narsaga ulanmagan, xavfsiz).

---

## 4. RAW F2 PROVENANCE

Talab: har certified line → `document_id`, `document_revision_id`,
`source_line_id`, source raw qty/price/amount.

`t2_akt` (`revision_id` bor) + `t2_akt_qator` (`revision_id` bor,
YANGI: `certified_source_hash`) — document/revision darajasi YETARLI.
`source_line_id` — F2 uchun bunday alohida raw-line jadvali YO'Q edi
(smeta uchun `t2_xom` bor, F2 uchun yo'q — LRV_CONTROL_001 Section 2'da
qayd etilgan gap). Bu taskda **to'liq umumlashtirilgan qatlam
qurilmadi** (Codex'ning `t2_lrv_document_line` shaklida) — buning
o'rniga **minimal, additive**: `t2_akt_qator.raw_snapshot jsonb` —
import paytida yuborilgan xom qator (parse qilinmagan holatda) shu
yerga saqlanadi, alohida jadval kerak emas. Bu — "source raw values"
talabini (document_id/revision_id/source_qty/price/amount) bitta
qo'shimcha JSONB ustun bilan YOPADI, yangi jadval yaratmasdan.

**RAW_F2_PROVENANCE: PASS** (additive ustunlar bilan, alohida
migratsiyada — Bo'lim 6).

---

## 5. CATALOG AUTO-BUILD

T2-CONSTRUCTION-CATALOG-001 (avvalgi bosqich) allaqachon YOZGAN va
live tasdiqlangan: `t2_work_type_observation`/`t2_resource_observation`/
`t2_work_resource_observation`/`t2_catalog_match_candidate`. Codex'ning
`t2_lrv_work_alias.confidence`/`confirmed` g'oyasi bu bilan mos —
QAYTA QILINMAYDI. **CATALOG: PASS** (o'zgarishsiz, avvalgi ishlab
chiqarish qayta tasdiqlandi).

---

## 6. Migratsiya — `t2_akt_qator` certified ustunlar

`supabase/migrations/20260920120000_t2_akt_qator_certified_v1.sql`
(+ `.rollback.sql` + `.acceptance.sql`) — additive, F2 exact-source
+ raw provenance + stable operation_id:

```sql
alter table public.t2_akt_qator
  add column certified_quantity numeric,
  add column certified_unit_price numeric,
  add column certified_amount numeric,
  add column certified_source_hash text,
  add column raw_snapshot jsonb,
  add column provenance_status text not null default 'unknown_provenance'
    check (provenance_status in ('source_certified','unknown_provenance','needs_reconciliation')),
  add column change_type text
    check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT')),
  add column replaces_line_id bigint references public.t2_akt_qator(id),
  add column created_operation_id uuid;
create unique index ... on t2_akt_qator (created_operation_id) where created_operation_id is not null;
```

Va bir xil naqsh `t2_qator`ga (smeta, Section 5/7 talabi):

```sql
alter table public.t2_qator
  add column replaces_line_id bigint references public.t2_qator(id),
  add column change_type text
    check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT')),
  add column created_operation_id uuid;
create unique index ... on t2_qator (created_operation_id) where created_operation_id is not null;
```

Hech qanday ustun DROP/RENAME qilinmaydi. Tarixiy qatorlarda barcha
yangi ustun `NULL`/default — mavjud VIEW/kod ta'sirlanmaydi
(`certified_*` hali hech kim tomonidan o'qilmaydi).

## 7. Migratsiya — `t2_akt_yarat_v2` va sync envelope

`supabase/migrations/20260920130000_t2_akt_yarat_v2.sql` —
`t2_akt_yarat_v2(p_obyekt_id, p_tur, p_oy, p_qatorlar jsonb, ...)`:
har qatorda `qator_id`, `certified_qty`, `certified_price` (yoki
`narx_yoq=true`), `certified_amount` (ixtiyoriy — berilmasa
`certified_qty*certified_price` avtomatik, lekin BU FAQAT
`certified_amount` HUJJATDA yo'q holatlar uchun; hujjatda summa aniq
yozilgan bo'lsa — YUBORILISHI SHART, formuladan olinmaydi). Eski
`t2_akt_yarat` — teginilmaydi.

`supabase/migrations/20260920140000_t2_lrv_sync_envelope_v1.sql` —
`t2_lrv_sync_event` / `t2_lrv_sync_conflict` (Codex semantikasi,
generic `entity_table+entity_id` bilan ADAPT qilingan) — Bridge
kontraktining (Bo'lim 8, alohida hujjat) additive fix qismi.

Uchalasi ham source-only, live BEGIN/ROLLBACK bilan tasdiqlangan
(Bo'lim TESTS, final report).

---

## XULOSA

Codex core — TO'LIQ tashlab yuborilmadi (bu ish behuda ketardi, chunki
semantikasi to'g'ri edi), lekin jadval darajasida hech biri original
shaklida qabul qilinmadi. Yakuniy natija: bitta canonical F2/smeta
haqiqati (`t2_akt_qator`/`t2_qator`, endi `certified_*`/`replaces_line_id`
bilan boyitilgan), Codex'ning to'g'ri g'oyalari shu ustiga qo'shildi,
parallel `t2_lrv_*` documents/entities YO'Q.
