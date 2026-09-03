# T2-CONSTRUCTION-CATALOG-001 — CONTRACT

**Rol:** Chief Integrator / Backend Architect (Claude)
**Sana:** 2026-09-03
**Bosqich:** T2-GAS-EXIT-LRV-CONTROL-001 foundation, Section 16 ketma-ketligi
bo'yicha (Company Control Foundation Phase A yopilgach).
**Holat:** SOURCE ONLY. Production freeze davom etadi.

Ushbu hujjat — har yuklangan smeta/F2/boshqa qurilish hujjati tizimning o'z
katalogini (WORK_TYPE / RESOURCE / MATERIAL / EQUIPMENT) qanday BOYITISHI,
lekin buni raw documentdan canonical truthga BLIND MERGE qilmasdan
qanday amalga oshirilishi kerakligining kontrakti.

---

## 0. Nima MAVJUD (qayta ishlatiladi, ustidan qurilmaydi)

| Talab qilingan tushuncha | Mavjud jadval | Izoh |
|---|---|---|
| SOURCE_DOCUMENT | `t2_manba` | obyekt_id, rol, fayl_id, fayl_nom, varaq, format, holat, xato, import_vaqt, kompaniya_id |
| SOURCE_DOCUMENT (F2) | `t2_akt` | fayl_id, manba, revision_id |
| SOURCE_DOCUMENT_REVISION | `t2_akt.revision_id` / `t2_smeta_revision` | F2 va smeta uchun alohida, ikkalasi ham bor |
| SOURCE_LINE (smeta) | `t2_xom` | manba_id, qator, hujayra[] (raw cell array) |
| WORK_TYPE (canonical) | `t2_ish_turi` | kompaniya_id, kod, nomi, birligi, norma, narx, kategoriya, versiya |
| MATERIAL/RESOURCE price (canonical) | `t2_narx` | obyekt_id, nom_key, birlik_key, narx, kat, manba, **belgilangan** (tasdiqlangan), **shubhali** (ambiguous review flag) |
| CATALOG_ALIAS (material) | `t2_material_alias_royxat` | alias_nom → kanonik_nom_key/kanonik_birlik_key — MATCH_CANDIDATE g'oyasining o'zi, materiallar uchun |
| EQUIPMENT/labor pool (ERP) | `t2_texnika_royxat` / `t2_kadr_royxat` / `t2_sklad_royxat` | mustaqil resurs havzalari (M:N obyektga bog'lanadi) — LRV recipe resource bilan bir xil EMAS, lekin EQUIPMENT canonical manbai sifatida mavjud |

**Yo'q (haqiqiy GAP, quyida YANGI):** WORK_TYPE_OBSERVATION,
RESOURCE_OBSERVATION, WORK_RESOURCE_OBSERVATION — ya'ni "bu ish turi shu
hujjatda shunday resurs tarkibi bilan ko'rildi" darajasidagi **provenance
bilan saqlangan xom kuzatuv qatlami**. Hozir `t2_ish_turi`/`t2_narx` faqat
OXIRGI (canonical) qiymatni saqlaydi — QAYERDAN kelgani (`t2_qator.manba_id`
orqali smeta uchun bor, lekin F2/boshqa hujjat turlari uchun yo'q, va
"necha marta, qaysi obyektlarda shu tarkibda ko'rilgan" degan
KUZATUV TARIXI umuman yo'q).

---

## 1. T1 `_ISHTURLAR` PRINCIPLE — Supabase canonical

T1'dagi `15_IshTurlar.js` g'oyasi — norm/kod bo'yicha ish turi + uning
resurs retsepti (mehnat, mashina, material...). Tizim_02'da bu ALLAQACHON
`t2_ish_turi` (canonical work type: kod/nomi/birligi/norma/narx/kategoriya)
sifatida bor, lekin **child resource recipe** (E0601-001-22 misolidagi
"ichida: labor, machine, concrete, water, nails...") hali yo'q.

### YANGI (SOURCE-ONLY): observation qatlami

```
t2_work_type_observation        -- "bu kod/nom/birlik shu hujjatda ko'rildi"
t2_resource_observation         -- "bu resurs (material/mashina/mehnat) shu hujjatda ko'rildi"
t2_work_resource_observation    -- "shu ish turi observation'ida shu resurs shuncha miqdorda ko'rildi" (retsept qatori)
```

Har uchalasida ham **provenance to'liq**:

```
company_id, project_id, object_id, document_id, revision_id,
source_line_id, code, name, unit, source_type, created_at
```

`source_type` — qaysi hujjat turidan kelgan: `'smeta' | 'f2' | 'other'`
(kelajakda kengaytiriladi — pudrat/tender/boshqa qurilish hujjatlari).

**Bular canonical `t2_ish_turi`/`t2_narx`ni AVTOMATIK yangilamaydi.**
Ular faqat KUZATUV — "necha marta, qaysi shaklda ko'rildi" tarixi.
Canonical jadvalga ko'chirish faqat Bo'lim 3 (DEDUP/MATCH) qoidalari
bilan, alohida (keyingi bosqichda yoziladigan) MERGE komandasi orqali.

---

## 2. IMPORTANT CATALOG LAW — F2/SMETA/PROCUREMENT aralashmasin

| Manba | Nima u | Canonical yozadimi? |
|---|---|---|
| **F2** (`t2_akt_qator`) | Tasdiqlangan tarixiy kuzatuv (certified historical observation) | Observation'ga YOZADI (`source_type='f2'`); `t2_ish_turi.norma`/retseptni **overwrite QILMAYDI** |
| **SMETA** (`t2_qator`) | Baholash/baseline kuzatuvi | Observation'ga YOZADI (`source_type='smeta'`); baseline narxni **overwrite QILMAYDI** |
| **PROCUREMENT** (kelajakda) | Boshqa haqiqat — xarid narxi | Alohida `source_type` bilan observation'ga YOZADI; hech qachon F2/smeta canonical qiymatini bosib yozmaydi |

Bu qonun `t2_narx.manba` ustuni orqali QISMAN ALLAQACHON qo'llanilgan
(narx qayerdan kelgani belgilanadi) — observation qatlami buni HAR BIR
KO'RINISH darajasida kengaytiradi, faqat oxirgi qiymat emas.

**Boshqa obyekt narxi global canonical narx BO'LMAYDI**: `t2_narx.obyekt_id`
allaqachon nullable-lekin-scoped tuzilishga ega — observation jadvallari
ham xuddi shunday `object_id`ni saqlaydi, canonical merge esa
Bo'lim 3'dagi deterministik qoidalarsiz HECH QACHON bir obyektning
narxini boshqasiga "global" qilib yozmaydi.

---

## 3. DEDUP / MATCH

**Avtomatik canonical merge FAQAT xavfsiz deterministik holatda**:
aniq canonical kod + mos birlik + normalizatsiya qilingan identity bir xil
bo'lsa. Bu — `t2_material_alias_royxat`ning aynan qilayotgan ishi
(materiallar uchun): `alias_nom` → `kanonik_nom_key`/`kanonik_birlik_key`,
faqat ANIQ moslik bo'lsa.

### YANGI (SOURCE-ONLY): umumiy MATCH_CANDIDATE

`t2_material_alias_royxat` faqat MATERIAL uchun. Ish turlari va boshqa
resurs turlari (mashina, mehnat) uchun umumlashtirilgan navbat kerak:

```
t2_catalog_match_candidate (
  id, company_id, observation_type ('work_type'|'resource'),
  observation_id (t2_work_type_observation.id yoki t2_resource_observation.id),
  candidate_canonical_kod, confidence numeric, -- fuzzy suggestion, 0..1
  holat text default 'kutmoqda' check (holat in ('kutmoqda','tasdiqlangan','rad_etilgan')),
  reviewed_by, reviewed_at
)
```

**Fuzzy suggestion mumkin (`confidence` ustuni) — fuzzy AUTO MERGE YO'Q.**
`holat='tasdiqlangan'` bo'lmaguncha hech qanday avtomatik yozuv
`t2_ish_turi`/`t2_narx`ga tushmaydi. Inson tasdiqlashi — MAJBURIY.

**Hech qachon boshqa ish/materialni birlashtirib yubormaslik** — bu
qoida MATCH_CANDIDATE'ning borligining o'zi bilan ta'minlanadi: aniq
moslik bo'lmasa, tizim HECH NARSANI taxmin qilib birlashtirmaydi, faqat
navbatga qo'yadi.

---

## 4. TENANT ISOLATION

`t2_ish_turi`, `t2_narx`, `t2_material_alias_royxat` — barchasi
`kompaniya_id not null`, `sb.ts`dagi `T2_GLOBAL_JADVALLAR` ro'yxatida
YO'Q → default **COMPANY-SCOPED** qoidasi allaqachon amal qiladi
(`t2CompanyScoped()` funksiyasi barcha `t2_*`ni company-scoped deb
hisoblaydi, faqat ochiq ro'yxatdagilar bundan mustasno).

Observation jadvallari ham xuddi shunday `company_id not null` bilan
qurilishi kerak — Company A hujjatlaridan o'rganilgan kuzatuv Company B
ga hech qachon avtomatik ko'rinmasin.

**Kelajakdagi PLATFORM MASTER catalog** (curated, kompaniyalar aro) —
ushbu bosqichda YARATILMAYDI. Agar kerak bo'lsa, alohida
`t2_platform_catalog_*` nomlari bilan, ANIQ opt-in bilan (masalan,
kompaniya administratori "bu ish turini platform katalogiga taklif
qilish" tugmasini bossa) — parallel/majburiy truth sifatida EMAS.

---

## 5. Migratsiya

`supabase/migrations/20260919120000_t2_construction_catalog_observation_v1.sql`
(+ `.rollback.sql` + `.acceptance.sql`) — SOURCE ONLY, quyidagi 4 ta
additive jadval:

- `t2_work_type_observation`
- `t2_resource_observation`
- `t2_work_resource_observation` (FK: `work_type_observation_id`,
  `resource_observation_id`, `observed_qty`, `observed_unit`)
- `t2_catalog_match_candidate`

Barchasi RLS yoqilgan, `public`/`anon`/`authenticated`dan REVOKE
qilingan (boshqa yangi jadvallar bilan bir xil naqsh). Write RPC bu
taskda YOZILMAYDI — jadvallar faqat SOURCE-ONLY schema sifatida bor;
import pipeline ularga qanday yozishi (Bo'lim 15, R2 ingestion
kontrakti) keyingi implementatsiya bosqichi.

---

## XULOSA

Construction Catalog — F2/SMETA/PROCUREMENT manbalarini ARALASHTIRMASDAN,
provenance bilan to'liq, faqat DETERMINISTIK holatlarda canonical'ga
qo'shiladigan observation qatlami. Mavjud `t2_ish_turi`/`t2_narx`/
`t2_material_alias_royxat` almashtirilmaydi — ular hali ham canonical
haqiqat, observation esa ularga olib boradigan, inson tasdig'i talab
qiladigan YO'L.
