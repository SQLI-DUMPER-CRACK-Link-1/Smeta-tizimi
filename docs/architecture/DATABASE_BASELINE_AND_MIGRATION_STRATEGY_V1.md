# TIZIM_02 Database baseline va migration strategiyasi V1

## Qaror

2026-08-29 dan boshlab `supabase/migrations/` — TIZIM_02 schema o'zgarishlarining yagona Git manbasi. Bu hujjatdagi baseline **productionga apply qilinadigan migration emas**. U 2026-08-29 04:23:22 UTC dagi live `public` sxema uchun faqat aniqlangan holat (known-state) hisoblanadi.

Bu hujjatdagi original capture productionga DDL, data yoki migration yubormadi. Keyingi reconciliation paytida remote history 109 versiyaga yetgani aniqlandi; bu tashqi o'zgarishlar 106-versiyali capture'dan alohida qayd etiladi.

## Live inventory (capture)

| Narsa | Qiymat |
| --- | ---: |
| Remote migration yozuvlari (original capture) | 106 |
| `public` jadvallar | 74 |
| `public` viewlar | 44 |
| Materialized viewlar | 0 |
| Ustunlar | 1,280 |
| Primary keylar | 73 |
| Foreign keylar | 108 |
| Indekslar | 182 |
| Funksiya/RPC | 121 |
| User triggerlar | 25 |
| RLS yoqilgan jadvallar | 74 / 74 |
| RLS policylar | 19 |
| `public` enumlar | 0 |

`public` relatsiyalari ikki qatlamga bo'linadi: eski integratsiya qatlamining `akt`, `holat`, `obyektlar`, `prixod`, `rashod`, `shartnoma`, `tolovlar` kabi jadvallari va `t2_*` kanoniklashayotgan qatlam. Live sxemada 44 view orasida `t2_akt_reestr`, `t2_aosr_reestr`, `t2_bux_dashboard`, `t2_loyiha_royxat`, `t2_sklad_konsolidatsiya`, `t2_overbilling_radar`, `t2_zayavka_royxat` mavjud. Materialized view aniqlanmadi.

T2 yadro jadval zanjiri: `t2_kompaniya` -> `t2_loyiha` -> `t2_obyekt` -> `t2_qator`; tenant resurslari `t2_kontragent`, `t2_shartnoma`, `t2_narx`, `t2_sklad_harakat`, `t2_tolov`, `t2_xarajat` orqali `t2_kompaniya`ga FK bilan ulanadi. Live katalogda 108 FK, jumladan obyekt–loyiha, shartnoma–obyekt, akt–qator, sklad–obyekt, to'lov–shartnoma va ichki `t2_tuzilma.ota_id` bog'lari bor.

Funksiya/RPC inventoryi 121 signaturedan iborat. Muhim oilalar: `t2_akt_*`, `t2_aosr_*`, `t2_azolik_*`, `t2_birja_*`, `t2_fakt*`, `t2_faktura_*`, `t2_loyiha_*`, `t2_narx_*`, `t2_qator_*`, `t2_shartnoma_*`, `t2_sklad*`, `t2_tolov_*`, `t2_viborka_*`, `t2_xarajat_*`. 25 trigger ichida audit, kompaniya merosi, versiya, akt-kozgu va akt-sklad sinxronizatsiyasi bor. RLS yoqilgan bo'lsa ham 19 policydan ko'pi eski qatlamda `authenticated` uchun `USING (true)` SELECT beradi; bu baseline fakti, approval emas.

Inventory qayta olinishi uchun (faqat read-only) katalog qamrovi: `pg_class`/`pg_attribute` (table, column, view, matview), `pg_constraint` (PK/FK/check), `pg_indexes`, `pg_proc`, `pg_trigger`, `information_schema.role_table_grants`, `pg_policies`, `pg_type`/`pg_enum`. Capture vaqtida shu kataloglar to'liq so'raldi.

## Canonical baseline holati

Live migration tarixi mavjud, lekin original 106 ta versioned SQL fayl repoda yo'q; keyingi remote reconciliation 109 versiyani ko'rsatdi. Gitda qayta-apply qilinmaydigan full-DDL baseline dump hali mavjud emas. Bu ishda uni uydirib yozish xavfli: 1,280 ustun, 108 FK, 182 indeks, 121 funksiya/RPC, trigger, grant va RLS ta'riflarini taxmin bilan tiklash schema driftini yashiradi.

Canonical baseline qabul qilinishi uchun P0 artefakt quyidagi nom bilan yaratiladi, lekin **`supabase/migrations/` ichiga qo'yilmaydi**:

```text
supabase/baselines/20260829T042322Z_live_public_schema.sql
```

Fayl boshida `DO NOT APPLY TO PRODUCTION` va capture metadata bo'ladi. U `public` DDL, function/view/trigger/policy/grant/type va index definitionsini saqlaydi; data, auth userlari, Storage obyektlari va Supabase-managed sxemalar kiritilmaydi. Faylning SHA-256 si shu hujjatga qo'shiladi. Baseline faqat diff/review va disposable local database uchun ishlatiladi; remote `db push`ga hech qachon berilmaydi.

Hozirgi bloklovchi: bu sessiyada Supabase CLI PATHda yo'q, `SUPABASE_ACCESS_TOKEN` ham DB password ham yo'q, Windows uchun `npx supabase@latest` binary paketi topilmadi. MCP live katalogni o'qiy oladi, ammo raw `pg_dump`/`db pull` DDL faylini eksport qilmaydi. Shu sababli V1 capture inventory sifatida aniq, ammo full-DDL snapshot artefakti P0 pending.

## Repo bilan solishtirish

| Toifa | Live holat | Repo holat | Natija / prioritet |
| --- | --- | --- | --- |
| Migration history | 109 remote version (106 at original capture) | canonical tree now contains reviewed contract files | Full baseline dump and history reconciliation P0 |
| SQL artefaktlar | Live final schema aniq | 21 ta sochilgan `.sql`; version/timestamp yo'q | Ular migration emas; P0 canonicalization |
| `tizim02/sinov/*.sql` | Ayrim live obyektlarga mos nomlar bor | Test/deploy handoff skriptlari | Repo-only source-of-truth emas; P1 review |
| `Smeta tizimi/supabase_schema.sql` | Legacy/T2 bilan aralash live qatlam | 47 CREATE, 16 ALTER; destructive legacy patternlar | Hech qachon baseline yoki migration emas; P0 exclude |
| `tizim02/sinov/07_korzinka_va_sklad_f2.sql` | Exact diff ishonchli emas | 2,812 NUL byte | Decode/normalize qilinmaguncha P1 evidence only |
| `t2_signal` | Remote history has 20260829051309 plus read-model follow-ups | Proposal remains pending outside executable chain | Live-only source export and review P1 |

`01_T2_LOYIHA_MIGRATSIYA (1).sql` duplicate artefakt bo'lishi mumkin, lekin bu ishda o'chirilmadi yoki almashtirilmadi. Har bir eski SQL faylning presence'i live apply qilinganini isbotlamaydi; shu sababli live-only/repo-only obyektlar uchun aniq object-level differ faqat full-DDL dump olingach yakunlanadi.

## Forward-only qoida

1. Baseline qabul qilingach oldingi 109 history qayta yaratilmaydi va remotega push qilinmaydi.
2. Har yangi schema o'zgarishi faqat `supabase/migrations/<UTC-14digit>_<snake_case_nomi>.sql` bilan keladi. Masalan: `20260829050000_t2_signal_engine.sql`.
3. Timestamp remote dagi eng katta versiyadan katta, UTC, noyob va immutable bo'ladi. Commitdan keyin fayl nomi yoki mazmuni tahrir qilinmaydi; tuzatish yangi migration.
4. Bir migration bitta atomik domen o'zgarishi bo'ladi: DDL, index, RLS/policy, grant va RPC contracti birga review qilinadi. `DROP`, type rewrite, data backfill va long index alohida rollout/reversal rejasiga ega bo'ladi.
5. Dashboard SQL Editor va Table Editor production schema uchun taqiqlanadi. Istisno avariya bo'lsa, darhol read-only diff, incident yozuvi va keyingi forward migration bilan tarixga qaytariladi.
6. Har PR local disposable DBda `supabase db reset`, test, `supabase db diff` va `supabase migration list` bilan tekshiriladi. Faqat bitta release owner remote `db push`ni bajaradi.
7. `migration repair` faqat remote schema va migration-history farqi isbotlangan holda, alohida approval bilan ishlatiladi; u ham bu task doirasida bajarilmadi.

## `t2_signal` forward migration

supabase/baseline/pending/20260829050000_t2_signal_engine.sql.pending — baseline'dan keyingi proposal. Remote history'dagi 20260829051309 va read-model migrationlari tashqarida qo'llangan; ularning exact source SQL'i olmaguncha pending fayl executable migration sifatida ko'chirilmaydi.

Exact remote t2_signal SQL source'i olinmaguncha uning FK, RLS, grant va idempotency xususiyatlari bu repoda canonical deb da'vo qilinmaydi. Uni keyingi forward migration sifatida ko'chirishdan oldin authenticated identity mapping va tenant-scoped policylar alohida review/test qilinadi.

## Qabul mezoni va navbat

| Prioritet | Ish | Qabul mezoni |
| --- | --- | --- |
| P0 | CLI yoki ishonchli DB export yo'lini tiklash | Full-DDL baseline fayli, SHA-256, no-apply header, object counts live inventory bilan mos |
| P0 | Repo migration bootstrap | `supabase/migrations/` va baseline exclusion qoidasi reviewdan o'tgan; remotega hech narsa push qilinmagan |
| P1 | Object-level diff | Live-only, repo-only va definition mismatch jadvali full dumpga asoslangan |
| P1 | T2 RLS identity canonicalization | `t2_signal` va keyingi jadvallarda tenant policylar integration test bilan isbotlangan |
| P1 | Corrupt test SQL normalization | `07_korzinka_va_sklad_f2.sql` faqat yangi forward migrationga ajratilgach decode qilinadi |
| P2 | Legacy qatlam retirement | Legacy `public` jadvallar uchun ownership, consumer va archival qarori |

## Bu ishda qilinmaganlar

- Original capture paytida productionga migration, db push, migration repair, DDL yoki data change yuborilmadi; keyingi remote 109-version history tashqi reconciliation sifatida qayd etilgan.
- Feature branchlar merge qilinmadi va boshqa agent branchlari o'zgartirilmadi.
- Duplicate `(1)` fayl o'chirilmadi/almashtirilmadi.
- Full-DDL baseline dump hali P0 blocker; bu hujjat uni tayyor deb da'vo qilmaydi.
