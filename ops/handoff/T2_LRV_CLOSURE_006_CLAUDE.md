# T2-LRV-CLOSURE-006 — blocker resolution + final integration (Claude, round 1)

**Rol:** Chief Integrator / Release Owner (Claude)
**Base:** `6cf5b7a` (integration/next-main-release-v1)
**Holat:** Section 0 (Tree V2) va Section 1 (isolated DB) — HALI BLOKLANGAN
(tashqi tomondan kutilmoqda). Section 2 — preflight qatlami YOZILDI va
sinovdan o'tdi, lekin DB'ga ulanadigan qismi YANGI ANIQLANGAN ikkinchi
blocker sababli hali ishga tushirilmaydi. Section 3 — bitta haqiqiy
DB-independent yetkazma tugallandi. **FINAL EMAS** (Section 5 shartiga
ko'ra: Tree V2 integratsiyasi VA isolated DB acceptance ikkalasi ham
hali yo'q).

---

## 0. Tree V2 (Section 0) — o'zgarishsiz BLOKLANGAN

`git ls-remote origin | grep -i "tree-ux-v2\|smeta-tree"` — faqat
`codex/t2-smeta-tree-ux-v1` (allaqachon ko'rib chiqilgan, ADAPT holatda —
`T2_SMETA_TREE_IMPLEMENTATION_001_CLAUDE.md`). `v2` branch hali push
qilinmagan. Kutilmoqda.

## 1. Isolated DB (Section 1) — o'zgarishsiz BLOKLANGAN + YANGI IKKINCHI TO'SIQ ANIQLANDI

Docker/Podman/WSL2/local-Postgres yo'qligi va Supabase Pro-plan talabi —
avvalgi xulosa o'zgarishsiz (qayta tekshirildi: `docker --version`,
`which psql pg_ctl` — hammasi yo'q).

**Bu safar YANGI, MUSTAQIL ikkinchi to'siq topildi**, "PREPARE LOCAL TEST
SCRIPT" (Section 2) ustida ishlashda: `supabase/migrations/` papkasi
**yolg'iz o'zi bo'sh Postgresni ishga tushira olmaydi**. Tekshirildi:

```
grep -il "create table.*t2_kompaniya" supabase/migrations/*.sql   -> 0 natija
grep -il "create table.*t2_qator"      supabase/migrations/*.sql   -> 0 natija
```

37 ta forward migration (`20260829050000` .. `20260921120000`) bor, lekin
ULARNING BIRONTASIDA asos jadvallar (`t2_kompaniya`, `t2_obyekt`,
`t2_qator`, `t2_foydalanuvchi`, `t2_azolik` va h.k.) uchun `CREATE TABLE`
yo'q — ular FAQAT allaqachon shu jadvallar bor bazaga qo'llash uchun
yozilgan (`ALTER TABLE`/`CREATE OR REPLACE FUNCTION` ko'rinishida).

Sabab `supabase/baseline/README.md`da ochiq yozilgan (bu safar o'qildi):

> "This directory is intentionally outside `supabase/migrations/`... a
> live project that predates its canonical migration tree... After a
> reviewed `supabase db pull`, place the resulting single baseline in
> `supabase/migrations/`... Do not turn old ad-hoc SQL into a second
> baseline or replay it against production."

Ya'ni: bu loyiha ilgari (migration-tree'siz) qo'lda qurilgan, va rasmiy,
**ko'rib chiqilgan** (reviewed) baseline dump hali olinmagan/joylashtirilmagan.
`supabase/baseline/pending/` faqat bitta boshqa masala uchun (Control
Signal Engine prototipi) — bu asos-jadval bo'shlig'iga aloqasi yo'q.

**Xulosa**: "isolated Postgres → apply repo migrations" bosqichi
Section 1'dagi Docker/Pro-plan qaroridan **MUSTAQIL, QO'SHIMCHA** bir
egasi qarorini talab qiladi: yoki (a) tasdiqlangan `supabase db pull`
baseline tayyorlanishi kerak, yoki (b) migratsiya ro'yxati boshiga asos
jadvallar DDL'i qo'shilishi kerak. Bu men tomonimdan o'zboshimchalik
bilan hal qilinmadi (production'ga o'qish uchun ham ulanish talab
qilinishi mumkin — bu ham egasining ruxsatisiz qilinmaydi).

`BASELINE_REQUIRED` — Section 1'ning `PRO_PLAN_REQUIRED: YES` xulosasiga
QO'SHIMCHA, uni ALMASHTIRMAYDI.

## 2. Local test script (Section 2) — preflight qatlami tayyor va sinovdan o'tdi

`supabase/isolated-test/`:
- `env-guard.cjs` — production-aniqlash guard (avvalgi rounddan, 8/8 o'z-o'zini
  sinovi o'tgan, o'zgarishsiz).
- `package.json` — standalone `pg` bog'liqligi (frontend build'iga
  qo'shilmaydi).
- **`run.cjs` (YANGI)** — orkestrator skript. Haqiqiy va ishlaydigan
  qatlamlar: (1) `env-guard` chaqiruvi (production'ga ulanishni
  bloklaydi), (2) baseline preflight (`ISOLATED_BASELINE_SQL` yo'q yoki
  fayl topilmasa — aniq `BASELINE_REQUIRED` xabari bilan to'xtaydi), (3)
  `supabase/migrations/*.sql` ro'yxatini (37 ta, `.rollback`/`.acceptance`
  chiqarib tashlab) xronologik tartibda o'qish. DB'ga ulanadigan qism
  (migratsiya qo'llash, sintetik fixture seed, `.acceptance.sql`
  tekshiruvlarini qayta ishga tushirish, teardown) **ATAYLAB
  `NOT_IMPLEMENTED` bilan to'xtatilgan** — soxta PASS ko'rsatishdan ko'ra
  aniq ishlamayapti deyish afzal (vazifaning o'z qoidasi: "do not fake DB
  PASS"). Uch holatda sinovdan o'tkazildi (bo'sh manzil → GUARD rad etadi;
  mahalliy manzil-u baseline yo'q → BASELINE_REQUIRED; mahalliy manzil-u
  baseline fayli mavjud emas → aniq xato) — hammasi kutilganidek ishladi.

## 3. DB-independent ish (Section 3) — bitta haqiqiy yetkazma

### F2 exact-payload aggregatsiyasi — pure funksiyaga chiqarildi + vitest

`TestF2Import.tsx`ning `yozish()` ichida yashiringan (avvalgi rounddagi P0
tuzatish — F2 SUMMA ustunini `certified_amount`ga forward qilish) mantiq
endi `frontend/src/test02/f2-exact-payload.ts`da PURE, eksport qilingan
funksiyalar:

- `f2AggregatsiyaQator(nodes, getSmetaId)` — bir xil `qator_id`ga
  bog'langan bir necha F2 qatorini hajm/summa bo'yicha qo'shib bitta
  yozuvga yig'adi (avvalgi inline `Map` mantig'i bilan bayt-baytiga bir
  xil).
- `f2ExactPayloadQur(rows)` — NEEDS_REVIEW ambiguity qoidasini qo'llaydi
  (narxi bor-yu F2 faylning o'z summasi yo'q qator — butun partiyani
  RAD ETADI, qty×narx bilan HECH QACHON to'qilmaydi) va `t2_akt_yarat_v2`
  RPC shakliga map qiladi.

`f2-exact-payload.test.ts` — **8 ta yangi test**, DB'siz, egasining o'z
misollari bilan tekshirilgan:
- bir necha F2 qatori bitta smeta qatoriga qo'shilganda hajm/summa
  QO'SHILISHI;
- bog'lanmagan tugunlar aggregatsiyaga QO'SHILMASLIGI;
- summaBor flag'ining to'g'ri xatti-harakati (0/undefined summa holatlarida);
- narx <=0 "narx yo'q" deb HISOBLANISHI (0ga aylantirilmasdan);
- **NEEDS_REVIEW**: narxi bor-yu summasi yo'q BITTA qator BUTUN partiyani
  to'xtatishi (qisman yozish YO'Q);
- narxi umuman yo'q qator — muammo EMASLIGI (`priceIntentionallyAbsent`);
- **egasining aniq misoli** (qty=10, narx=123.45, F2 summa=1234.49 —
  qty×narx=1234.50 dan 1 tiyin farqli) — `certified_amount` hujjatning
  O'Z raqami sifatida O'ZGARTIRILMASDAN saqlanishi;
- to'liq-toza partiyaning to'g'ri RPC shaklga map bo'lishi.

`TestF2Import.tsx`ning `yozish()` funksiyasi shu ikki funksiyani
chaqirishga o'tkazildi (52 qatorlik takrorlangan inline mantiq → 2 ta
funksiya chaqiruvi) — **xulq bayt-baytiga saqlangan**, faqat endi
DB'siz mustaqil test qilinadigan.

Qolgan Section 3 band'lari (pre-approval frontend, price-control frontend
holat kengaytmalari, bridge logic davomi, catalog ingestion adapter,
additional/replacement API/client contract'lari, tree-v2 checklist) —
**BU ROUNDDA BOSHLANMAGAN**, keyingi checkpoint'ga qoladi.

## Gates (bu round, faqat o'zgargan/qo'shilgan fayllar uchun)

| Gate | Natija |
|---|---|
| `vitest run src/test02/f2-exact-payload.test.ts` | ✅ PASS (8/8) |
| `vitest run` (to'liq) | ✅ PASS (138/138, 27 fayl — avvalgi 130/130 + 8 yangi) |
| `tsc -b` | ✅ PASS (toza, xatosiz) |
| `oxlint` (o'zgargan fayllar) | ✅ 0 YANGI ogohlantirish (`f2-exact-payload.*` — 0; `TestF2Import.tsx`dagi 5 ogohlantirish — hammasi men tegmagan qatorlarda, oldindan mavjud) |
| `node supabase/isolated-test/run.cjs` (3 holat: bo'sh/local-no-baseline/local-missing-baseline-file) | ✅ Kutilgan xatti-harakat — hech qanday DB ulanish urinilmadi |

## PRODUCTION_RESIDUE

NONE — bu round hech qanday DB'ga ulanmadi (na production, na boshqa).
Faqat git/fayl operatsiyalari va lokal `node`/`vitest`/`tsc` ishga
tushirildi.

## Keyingi qadam

1. Egasidan Section 1 (Docker/WSL2 yoki Supabase hosted isolated) VA
   yangi topilgan Section 1b (baseline: reviewed `supabase db pull` yoki
   asos-jadval DDL'i) bo'yicha qaror kutilmoqda.
2. Codex Tree V2 push kutilmoqda.
3. Shu ikkalasi kelmaguncha: Section 3'ning qolgan DB-independent
   band'lari ustida davom etiladi (keyingi checkpoint'da report qilinadi
   — "Scope tugamaguncha micro-status bermagin" qoidasiga ko'ra).
