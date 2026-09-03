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

## 1. F2 EXACT SOURCE LAW

**HOLAT: MAVJUD, formallashtirilmoqda.**

`t2_akt_qator` (F2 qator — jadval, `r`) ustunlari aynan uchta muzlatilgan
truthni saqlaydi:

| Talab qilingan nom | Haqiqiy ustun | Turi |
|---|---|---|
| `certified_quantity` | `t2_akt_qator.hajm` | numeric |
| `certified_unit_price` | `t2_akt_qator.narx` | numeric |
| `certified_amount` | `t2_akt_qator.summa` | numeric |

Qo'shimcha (Tizim_02'da allaqachon bor, ammo talabda tilga olinmagan, LAW'ni
KUCHAYTIRUVCHI ustunlar): `baseline_narx`, `baseline_summa` (smeta narxi
F2 yozilgan payt — snapshot), `actual_narx` (haqiqiy to'langan narx, F2
narxidan farqli bo'lishi mumkin), `narx_manba` + `narx_manba_id` (narx
qayerdan kelgan — provenance), `variance_summa` (farq, hisoblanadi —
**QAYTA YOZILMAYDI**), `narx_izoh`.

### QAT'IY QONUN (kod bilan tasdiqlanishi kerak, keyingi bosqichda)

```
certified_amount  ≠  certified_quantity * smeta_price      (TAQIQ)
certified_unit_price  ≠  baseline/procurement/current market price   (TAQIQ)
approved F2 revision bilan qayta hisoblash   (TAQIQ)
```

`t2_akt_qator.hajm/narx/summa` — F2 HUJJATINING O'ZIDAN import qilinadi
(import yo'li: `t2_manba` → `t2_xom` → parse → `t2_akt_qator`, quyida
Bo'lim 2/3). Bu yozuvlar keyinchalik yangi smeta revision chiqsa ham
QAYTA HISOBLANMAYDI — `t2_smeta_revision` (mavjud, `smeta_f2_nakopitelniy`
davridan) original-baseline ledger sifatida ishlaydi, tarixiy F2 qatorini
EMAS.

### TASDIQLANGAN TOPILMA (live schema tekshiruvi, 2026-09-03) — MISMATCH flag emas, NARX PROVENANCE xavfi

Live sxemani tekshirganda (`pg_attribute`/`pg_get_functiondef`) aniqlandi:
`t2_akt_qator.summa` — Postgres **GENERATED ALWAYS AS STORED** ustun:

```sql
summa = CASE WHEN narx IS NULL THEN NULL ELSE hajm * narx END
```

Bu **o'zi qonunbuzarlik EMAS** — `certified_amount = certified_quantity ×
certified_unit_price` bir xil HUJJATNING ikkala qiymatidan hisoblansa,
bu aynan kutilgan. Muammo — `narx` ustunining O'ZI qayerdan kelishi.

Yozuvchi funksiya `t2_akt_yarat` (live, `public.t2_akt_yarat`) INSERT
ifodasi:

```sql
case when k.narx_yoq then null
     else coalesce(k.narx_kir, q.narx)   -- q.narx = SMETA narxi!
end
```

Ya'ni: agar chaqiruvchi (frontend/import) F2 qatori uchun `narx_yoq=true`ni
ANIQ yubormasa VA `narx_kir` (hujjatdagi narx) bo'sh bo'lsa — funksiya
JIMGINA smeta narxiga (`q.narx`) qaytadi. Bu — aynan Section 1'da
TAQIQLANGAN naqsh (`certified_unit_price = baseline/smeta price`), lekin
DB darajasida emas, **chaqiruvchi intizomiga bog'liq** holda.

Bu — YANGI kashfiyot emas: loyiha xotirasida allaqachon qayd etilgan
(`narx-oz-idan-toqilmaydi.md`: "F2 da narx yo'q bo'lsa BO'SH qoladi;
smeta narxidan to'ldirish = soxta hujjat") — va aynan shu sabab bilan
`narx_yoq` bayrog'i mavjud (UI'ning bu qoidani qo'lda ta'minlashi kutiladi).
**Ammo qoida hozircha faqat UI intizomida, DB CHECK constraint darajasida
EMAS** — frontend biror joyda `narx_yoq`ni to'g'ri yubormasa, jim buziladi.

**BU KONTRAKTDA HAL QILINMAYDI.** Sabab: `t2_akt_yarat` — joriy productionda
ishlab turgan F2 yozish yo'li; uning fallback xatti-harakatini o'zgartirish
frontend chaqiruvchi kodini (F2 import UI) to'liq audit qilishni talab
qiladi — "hozir har doim `narx_yoq`ni to'g'ri yuboradimi?" javobsiz savol.
Schema'ni ko'r-ko'rona o'zgartirish yangi regressiya yaratishi mumkin.

**OCHIQ TOPILMA — keyingi implementatsiya bosqichi uchun**: `t2_akt_yarat`
chaqiruvchisini (F2 import frontend/RPC) audit qilib, `narx_yoq` HAR DOIM
to'g'ri uzatilishini tasdiqlash, keyin DB darajasida qattiqroq qoida
(masalan: `narx_kir` bo'sh va `narx_yoq` false bo'lsa RAD ETISH, jim
smeta-narxga qaytmaslik) qo'shish kerak. Bu ushbu taskning SOURCE-ONLY
doirasidan tashqarida — chunki xavfsiz tuzatish uchun avval chaqiruvchi
tomonni tekshirish shart, faraz asosida schema o'zgartirilmaydi.

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
(VIEW) zanjirining rasmiy qonuni**. Ushbu bosqichda qilingan ish:
- Qonunni yozma shaklda mustahkamlash (bu hujjat);
- **Live tekshiruv orqali real topilma**: `t2_akt_yarat`'ning narx
  fallback xatti-harakati (yuqoriga qarang) — hal qilinmadi, ataylab
  ochiq holda hujjatlashtirildi (chaqiruvchi tomon auditisiz xavfsiz
  tuzatib bo'lmaydi);
- `replaces_line_id`/`change_type` strukturaviy ustunlarini kontrakt
  sifatida belgilash (implementatsiya keyingi bosqichda).

Hech qanday parallel LRV jadvali/servisi YARATILMAYDI. Bu bosqichda
`t2_akt_qator`/`t2_akt_yarat`ga HECH QANDAY schema/kod o'zgartirish
QILINMADI — faqat o'qish orqali tekshirildi.
