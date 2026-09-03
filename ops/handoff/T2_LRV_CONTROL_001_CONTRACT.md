# T2-LRV-CONTROL-001 — CONTRACT

**Rol:** Chief Integrator / Backend Architect (Claude)
**Sana:** 2026-09-03
**Bosqich:** T2-GAS-EXIT-LRV-CONTROL-001 — foundation (Company Control Foundation
Phase A yopilgach boshlandi, Section 16 bo'yicha).
**Holat:** SOURCE ONLY. Production freeze davom etadi — bu hujjatda ta'riflangan
hech narsa productionga qo'llanilmagan.

---

## 0. Usul — nima YANGI, nima MAVJUD

Bu kontrakt yozishdan oldin joriy Supabase sxemasi tekshirildi
(`information_schema.columns`, `pg_class`). Natija: **LRV CONTROL g'oyasi
allaqachon qisman qurilgan** — Tizim_02 buni noldan qurmaydi, balki
**formallashtiradi va yakunlaydi**. Har bir bo'lim ostida `HOLAT:` yorlig'i bor:

- **MAVJUD** — jadval/view allaqachon bor, faqat qonun sifatida qayd etiladi.
- **QISMAN** — mavjud, lekin to'liq qamrovi yo'q; additive to'ldirish taklif qilinadi.
- **YANGI (SOURCE-ONLY)** — hali yo'q; ushbu taskda faqat SQL loyihasi (yozilgan,
  productionga qo'llanilmagan).

Bu — "parallel truth yaratma" qonuniga (Section 4, 6) rioya qilishning o'zi:
mavjud `t2_qator` / `t2_akt_qator` / `t2_qator_holat` / `t2_lrv` ustidan
YANGI, raqobatdosh tizim qurish emas, balki ularni rasmiy qonun bilan
mustahkamlash.

---

## 1. F2 EXACT SOURCE LAW — TUZATILDI (T2-LRV-EXACT-F2-INTEGRATION-003, 2026-09-03)

**HOLAT: P0 XATO TOPILDI, TUZATISH LOYIHASI YOZILDI (source-only).**

> ⚠️ **KONTRAKT TUZATISHI.** Ushbu bo'limning avvalgi versiyasi (foundation
> bosqichida yozilgan) XATO xulosaga kelgan edi: "`t2_akt_qator.summa`
> GENERATED ustuni (`hajm*narx`) — bu o'zi qonunbuzarlik emas, faqat
> `narx`ning qayerdan kelishi xavfli" deb yozilgan edi. Bu qaror TO'G'RI
> EMAS — pastda tuzatildi.

### Nega GENERATED `summa` — P0 FAIL

Talab: uch qiymat — `certified_quantity`, `certified_unit_price`,
`certified_amount` — HAR BIRI mustaqil SOURCE DOCUMENT qiymati, hatto
ular o'zaro arifmetik mos kelmasa ham.

Misol: F2 hujjatida `qty=10`, `price=123.45`, `amount=1234.49` yozilgan
bo'lsa (dumaloqlash/chegirma sababli — `10 × 123.45 = 1234.50`, lekin
HUJJATNING O'ZIDA `1234.49` yozilgan) — canonical `certified_amount`
ham aynan `1234.49` bo'lishi SHART.

**Joriy sxema buni FIZIK JIHATDAN IMKONSIZ qiladi**:
`t2_akt_qator.summa generated always as (hajm*narx) stored` — Postgres
har doim `1234.50`ni majburlaydi, hujjatda nima yozilganidan qat'i
nazar. Bu — "narx noto'g'ri manbadan kelishi mumkin" darajasidagi xavf
emas, balki **"summa umuman document'dan emas, har doim formuladan"**
— aynan `certified_amount = quantity * price` TAQIQLANGAN naqshning
o'zi, DB SXEMASI DARAJASIDA.

### TUZATILGAN QONUN

```
certified_quantity     — SOURCE DOCUMENT qiymati, mustaqil ustun
certified_unit_price   — SOURCE DOCUMENT qiymati, mustaqil ustun
certified_amount       — SOURCE DOCUMENT qiymati, MUSTAQIL ustun
                          (GENERATED EMAS — oddiy, to'g'ridan-to'g'ri yoziladigan ustun)

calculated_amount      — OPTIONAL, faqat analytical validation:
                          certified_quantity * certified_unit_price
                          (GENERATED bo'lishi mumkin — bu faqat tekshirish
                          uchun, canonical truth EMAS)

calculated_amount != certified_amount  →  F2_ARITHMETIC_MISMATCH flag
certified_amount HECH QACHON shu farq asosida qayta yozilmaydi.
```

### Mavjud sxemaga MINIMAL ADDITIVE moslashuv (parallel truth EMAS)

`t2_akt_qator.summa`ni GENERATED-ligidan darhol mahrum qilish xavfli —
mavjud `t2_qator_holat`/`t2_lrv` VIEW'lari va `t2_f2_kat_oy`/
`t2_f2_tafsilot` shu ustunga SUM/JOIN qiladi; production freeze ostida
buni ko'r-ko'rona o'zgartirish yangi regressiya yaratishi mumkin.
**Tanlangan yechim — ADDITIVE, eskisini buzmaydi**:

1. `t2_akt_qator`ga YANGI, oddiy (GENERATED EMAS) ustunlar:
   `certified_quantity`, `certified_unit_price`, `certified_amount`,
   `certified_source_hash`, `provenance_status`
   (`'source_certified' | 'unknown_provenance' | 'needs_reconciliation'`).
2. Eski `hajm`/`narx`/`summa` (GENERATED) — **compatibility field**
   sifatida QOLADI, hech narsa o'chirilmaydi/qayta nomlanmaydi.
3. YANGI write yo'li (`t2_akt_yarat_v2`) — `certified_*` ustunlarga
   TO'G'RIDAN-TO'G'RI, hisoblanmagan holda yozadi; `hajm`/`narx` ham
   parallel to'ldiriladi (compatibility uchun). Canonical READ MODEL
   endi `certified_amount`ni ishlatishi SHART, `summa`ni EMAS.
4. **Tarixiy qatorlar** (`certified_*` bo'sh): `qty*price`dan "asl summa
   shunday edi" deb BACKFILL QILINMAYDI (soxta provenance bo'lardi).
   `provenance_status = 'unknown_provenance'` bilan QOLADI.

To'liq reja, Codex `t2-lrv-canonical-core-v1` bilan reconciliation va
migratsiya: **`ops/handoff/T2_LRV_EXACT_F2_INTEGRATION_003.md`**.

### NARX FALLBACK — CALLER AUDIT (P0, endi TAXMIN emas, isbotlangan)

Barcha chaqiruvchilar audit qilindi (kod o'qilib, taxmin qilinmadi):
GAS tomon (`Smeta tizimi/T2_F2Import.js`) XAVFSIZ — `narx_yoq`ni to'g'ri
yuboradi. Ikkita Tizim_02 frontend yo'li XAVFLI: `TestF2Import.tsx`
(narx=0/bo'sh bo'lsa `narx: undefined` — jim tushirib qoladi) va
`TestF2.tsx` (narxni umuman yubormaydi); ularning gateway'i
(`sb-yoz.ts`) `narx_yoq`ni hatto kelsa ham STRIP qiladi. To'liq dalil,
qator raqamlari bilan: **`ops/handoff/T2_BRIDGE_CALLER_AUDIT_003.md`**.

---

## 2. AUTO-BUILD CONSTRUCTION DATABASE (provenance zanjiri)

**HOLAT: QISMAN.** Manba/qator zanjiri smeta uchun ALLAQACHON bor:

```
t2_manba  (SOURCE_DOCUMENT: obyekt_id, rol, fayl_id, fayl_nom, varaq,
           format, qator_soni, holat, xato, import_vaqt, kompaniya_id)
   ↓
t2_xom    (SOURCE_LINE: manba_id, qator, hujayra[], merge_full, merge_ef)
   ↓ (parse)
t2_qator  (canonical: manba_id, xom_qator — TO'G'RIDAN-TO'G'RI PROVENANCE)
```

F2 tomonida `t2_akt` (SOURCE_DOCUMENT ekvivalenti: `fayl_id`, `manba`,
`revision_id`) va `t2_akt_qator` (`revision_id`) bor, lekin **F2 uchun
`t2_xom`ga o'xshash raw-qator qatlami yo'q** — F2 import to'g'ridan-to'g'ri
`t2_akt_qator`ga yozadi. Bu GAP emas — F2 import yo'li allaqachon
(`98_SelfTest.js`/F2 import mexanizmi) o'z parsing bosqichlariga ega,
faqat Supabase darajasida alohida SOURCE_LINE jadvali yo'q.

### SOURCE_DOCUMENT_REVISION

`t2_akt.revision_id` / `t2_akt_qator.revision_id` mavjud (bigint, FK
maqsadli) — REVISION tushunchasi allaqachon bor. Alohida
`t2_smeta_revision` jadvali (`smeta_f2_nakopitelniy` davridan) smeta
tomonidagi revision ledger.

**XULOSA:** SOURCE_DOCUMENT / SOURCE_DOCUMENT_REVISION / SOURCE_LINE
uchinchi marta QURILMAYDI — mavjud `t2_manba`/`t2_xom`/`t2_akt`/
`revision_id` shu rolni bajaradi. Yangi ehtiyoj — Bo'lim 3dagi
WORK_TYPE/RESOURCE OBSERVATION qatlami, chunki hozir `t2_qator`/
`t2_akt_qator` faqat OXIRGI natijani saqlaydi, HAR BIR MANBADAGI
KUZATUVNI EMAS (bir xil ish turi 5 xil obyektda 5 xil narxda ko'rilsa,
buning barchasi alohida "observation" sifatida qayd etilishi kerak —
canonikga BLIND MERGE emas). Bu — `T2_CONSTRUCTION_CATALOG_001.md`da.

---

## 3. LRV CUMULATIVE MODEL

**HOLAT: MAVJUD (view), qonun sifatida qayd etilmoqda.**

`t2_qator_holat` (VIEW, `v`) — aynan Section 14'dagi formulalarni
hisoblaydi:

| Talab qilingan | Haqiqiy ustun |
|---|---|
| `OSTATKA_SMETA` | `qoldiq_hajm` / `qoldiq_summa` |
| `F2_MUMKIN` | `f2_mumkin_hajm` / `f2_mumkin_summa` |
| `F2_JAMI` (qty) | `f2_hajm` |
| `F2_JAMI` (amount) | `f2_summa` |

Plyus: `smeta_hajm/narx/summa`, `fakt_hajm/summa`, `fakt_narx`,
`f2_narx_farq_foiz` — F2 narxi smeta/fakt narxidan qanchaga farq
qilishini FOIZDA ko'rsatadi (overbilling radar bilan bog'liq).

`t2_lrv` (VIEW, `v`) — bu aynan **LRV CONTROL** so'zining o'zi: SMETA +
FAKT + F2 (`Забран на Ф2`, `Остатка Ф2`) + RESURSLAR (`ЧЕЛ`, `МАШ`,
`МАТ`, `ОБ`) + `_qoshimcha`/`_zamena` flag'lari — bitta qatorda. **Bu —
Sections 1+13+14ning jonli, ishlab turgan implementatsiyasi**, faqat
hozir Google Sheets uslubidagi (Kirill, katta harf) ustun nomlari bilan —
u Sheets proyeksiyasi uchun ATAYLAB shunday (Bo'lim 9dagi bridge
kontraktiga qara).

### QAT'IY QONUN — tasdiqlangan

`t2_qator_holat` VIEW (jadval emas) — har safar `t2_qator` +
`t2_akt_qator`dan JONLI hisoblanadi. Ya'ni **tarixiy F2 tripletlarini
(hajm/narx/summa) bu formulalar hech qachon "yasab" bermaydi** — ular
faqat `t2_akt_qator`ning o'zidan SUM qilinadi. LAW allaqachon
arxitektura darajasida bajarilgan (VIEW, jadval emas — yozib bo'lmaydi).

---

## 4. F2 HISTORY PROJECTION (dinamik triplet)

**HOLAT: MAVJUD.** `t2_f2_kat_oy` (oylik kategoriya jamlanmasi:
`obyekt_id, kompaniya_id, tur, oy, kat, qator_soni, jami_hajm,
jami_summa`) va `t2_f2_tafsilot` (qator darajasida: `akt_id, oy,
akt_holat, kod, nom, birlik, hajm, narx, summa, ...`) — aynan
Section 13'dagi "2026-05 OBYOM/NARX/SUMMA" dinamik tripletlarini
beradigan manba. Frontend proyeksiyasi (pivot: har oy uchun 3 ustun)
mavjud UI qatlamida (`F2 oy summasi uch ustun` memory yozuvi — panel
allaqachon shunday ko'rsatadi).

**Qonun:** bu ikkala view ham `t2_akt_qator`dan hosil bo'ladi — tarixiy
triplet hech qachon bu yerdan "orqaga" yozilmaydi.

---

## 5. ADDITIONAL / REPLACEMENT CORE

**HOLAT: QISMAN.** `t2_qator.qoshimcha` (boolean) va `t2_qator.zamena`
(boolean) ustunlari ALLAQACHON bor — aynan `change_type = ADDITIONAL`
/ `change_type = REPLACEMENT` ekvivalenti. `d1/d2/d3` ustunlari
(detallashtirish darajasi) + mavjud "Zamena tarixi va tasnif merosi"
(memory: `zamena-tarixi-va-tasnif-merosi.md`) allaqachon **"NOM/CODE/UNIT
maydonlarini matn bilan buzma"** qonunini qo'llagan — replacement uchun
yangi qator yaratiladi, eskisi o'zgarmaydi, `_ЗАМЕНА_ТАРИХ` note orqali
bog'lanadi.

### GAP: `replaces_line_id`

Hozir zamena bog'lanishi NOM-note orqali (matn ichida) — canonical
`replaces_line_id bigint references t2_qator(id)` ustuni yo'q. **YANGI
(SOURCE-ONLY) taklif** (additive, ixtiyoriy ustun — mavjud
matn-asosli bog'lanishni buzmaydi, ustiga qo'shadi):

```sql
alter table public.t2_qator
  add column if not exists replaces_line_id bigint references public.t2_qator(id),
  add column if not exists change_type text
    check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT'));
-- t2_akt_qator uchun ham xuddi shunday (F2 tomonida additional/replacement
-- ko'rsatilsa) — alohida migratsiyada, bu yerda faqat kontrakt sifatida.
```

Bu ustunlar TO'LDIRILGUNCHA hech narsani buzmaydi (`null` default);
mavjud matn-asosli zamena tarixi bilan PARALLEL emas — uni
STRUKTURALASHTIRADI (matn saqlanadi, YANGI qidiruv/JOIN imkoniyati
qo'shiladi).

Conceptual command darajasi (`addAdditionalWork`/`replaceWork`) —
canonical Supabase RPC sifatida hali yozilmagan; bu — keyingi
implementatsiya bosqichining ishi (bu kontrakt faqat modelni belgilaydi).

---

## 6. ROW INSERTION

**HOLAT: MAVJUD.** `t2_qator.ota_id` (parent), `t2_qator.tartib`
(ordering key — pozitsion RAQAM emas, TARTIB kaliti), `t2_qator.daraja`
(daraja/level), `t2_qator.tuzilma_id` — bularning barchasi
`parent_id`/`ordering_key`/`entity_id` ekvivalenti. Positional
row-number logikasiga TAYANMAYDI — `tartib` raqami bo'shliqli bo'lishi
mumkin (1,2,5,10 — oraga qo'shish uchun joy qoldiriladi), UI'da esa
`daraja`+`ota_id` daraxtni quradi.

**GAP:** BL (bir ish turi) qo'shilganda uning resurslari
transactional/durable batch sifatida yaratilishi — bu RPC darajasidagi
talab, schema darajasida emas. Mavjud `operation_id` idempotency naqshi
(butun kodda standart) BU YERDA HAM qo'llanilishi kerak: BL + resurslari
BITTA RPC chaqiruvida, bitta `operation_id` bilan, partial-insert bo'lsa
esa idempotency jadvali orqali RECOVERY (qayta chaqirilsa oldin
yaratilgan qism qaytariladi, ikki marta yaratilmaydi). Bu naqsh butun
kodda allaqachon standart (`t2_kompaniya_command_log`,
`t2_onboarding_command_log` va h.k.) — YANGI naqsh YARATILMAYDI, xuddi
shu pattern BL+resurs komandasiga qo'llaniladi (implementatsiya
bosqichida).

---

## 7. TENANT ISOLATION (LRV kontekstida)

`t2_qator`/`t2_akt_qator`/`t2_narx`/`t2_ish_turi` — barchasi
`kompaniya_id not null` (company-scoped, `sb.ts`dagi `T2_GLOBAL_JADVALLAR`
ro'yxatida YO'Q, ya'ni default COMPANY-SCOPED qoidasi allaqachon
qo'llanilgan). Bu Section 6 (Construction Catalog kontraktida
batafsil) bilan bir xil qonun — takrorlanmaydi, faqat qayd etiladi:
**LRV/F2/smeta ma'lumoti default kompaniya ichida qoladi.**

---

## XULOSA

LRV CONTROL — Tizim_02'da YANGI mahsulot EMAS, balki **allaqachon ishlab
turgan `t2_qator` + `t2_akt_qator` + `t2_qator_holat` (VIEW) + `t2_lrv`
(VIEW) zanjirining rasmiy qonuni**. Foundation bosqichida qilingan ish:
- Qonunni yozma shaklda mustahkamlash (bu hujjat);
- `replaces_line_id`/`change_type` strukturaviy ustunlarini kontrakt
  sifatida belgilash (implementatsiya keyingi bosqichda).

**T2-LRV-EXACT-F2-INTEGRATION-003 bosqichida TUZATILDI** (Section 1):
foundation bosqichidagi "`summa` GENERATED — bu o'zi muammo emas" xulosasi
XATO edi. Endi tasdiqlangan: `certified_quantity`/`unit_price`/`amount`
UCHALASI ham mustaqil, GENERATED BO'LMAGAN ustunlar bo'lishi SHART —
to'liq reja `T2_LRV_EXACT_F2_INTEGRATION_003.md`da. Narx-fallback caller
audit ham YAKUNLANDI (taxmin emas, kod o'qilib isbotlandi) —
`T2_BRIDGE_CALLER_AUDIT_003.md`.

Hech qanday parallel LRV jadvali/servisi YARATILMAYDI. Bu bosqichgacha
`t2_akt_qator`/`t2_akt_yarat`ga HECH QANDAY schema/kod o'zgartirish
QILINMAGAN edi — endi source-only (production'ga qo'llanilmagan)
additive migratsiya + yangi `t2_akt_yarat_v2` RPC loyihasi yozildi,
tafsilot yuqoridagi ikkita hujjatda.
