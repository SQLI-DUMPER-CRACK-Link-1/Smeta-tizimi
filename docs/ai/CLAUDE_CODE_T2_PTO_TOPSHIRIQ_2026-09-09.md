# CLAUDE CODE UCHUN TOPSHIRIQ
## Tizim-2 PTO yo‘nalishini canonical tizim sifatida yakunlash

**Sana:** 2026-09-09  
**Loyiha:** `C:\Users\PC\Documents\GAS`  
**Ustuvorlik:** P0/P1 — Tizim-2 PTO  
**Holat:** tayyorlash va xavfsiz bajarish uchun topshiriq

---

## 1. Asosiy qaror — bundan chekinilmaydi

### Tizim-2 — yagona canonical va operatsion tizim

Ushbu loyihada Tizim-1 va Tizim-2 parallel source-of-truth emas.

```text
TIZIM-2 = yagona maqsadli, canonical va kundalik ishlatiladigan tizim
TIZIM-1 = legacy/reference; kundalik ishlatilmaydi
```

Tizim-1 (`Smeta tizimi/`, GAS, Google Sheets/Drive) faqat quyidagilar uchun
reference bo‘lishi mumkin:

- eski biznes mantiqini tushunish;
- bir martalik migratsiya uchun format/fixture sifatida foydalanish;
- Tizim-2 natijasini tarixiy natija bilan solishtirish.

Tizim-1:

- Tizim-2 uchun fallback emas;
- PTO ishlash yo‘lining dependency’si emas;
- yangi biznes mantiq yoziladigan joy emas;
- production hisob-kitob yoki yozish manbai emas.

Tizim-1 katta smetalarda GAS’ning 6 daqiqalik execution limitiga urilgani uchun
Tizim-2 qurilgan. Maqsad — katta obyektlar va katta smetalarni GAS limitisiz,
barqaror va kuzatiladigan tarzda ishlatish.

### Tizim-2 qatlamlari

- **Supabase/Postgres:** Tizim-2 canonical biznes ma’lumotlari, hisob-kitob,
  entity/state, transaction, audit va version.
- **Cloudflare Pages Functions:** auth, tenant/object scope, named API/RPC
  gateway, background job, upload gateway.
- **React:** PTO ishchi interfeysi; biznes matematikasini o‘zboshimchalik bilan
  qayta hisoblamaydi.
- **R2/Drive:** Tizim-2 hujjatlari va binary manbalar; biznes haqiqatining
  o‘rnini bosmaydi.
- **Hermes/AI:** read-only tahlil, izoh va approval uchun draft; moliyaviy
  source-of-truth emas.
- **GAS/Tizim-1:** faqat reference/migration evidence. Oddiy T2 PTO oqimida
  chaqirilmasligi kerak.

---

## 2. Sening roling

Sen senior architect, backend/database engineer va release validator sifatida
ishlaysan. Maqsad — mavjud kodga tasodifiy patch qo‘shish emas, Tizim-2 PTO’ni
real ishlaydigan vertical slice sifatida yopish.

## 2A. MAXIMAL AVTONOM REJIM — ROUTINE PERMISSION SO‘RAMA

Ushbu topshiriq Claude Code’ni maksimal avtonom rejimda ishlatish uchun yozilgan.
Quyidagi ishlar uchun foydalanuvchidan har qadamda alohida ruxsat so‘rama:

- repository ichidagi fayllarni o‘qish, yaratish, o‘zgartirish va refaktor qilish;
- test, lint, typecheck, build va local profilingni ishga tushirish;
- local fixture, test migration va contract test yozish;
- local/disposable database yoki test schema’da migrationni tekshirish;
- T2 PTO uchun kerakli API, RPC draft, UI, adapter va testlarni yaratish;
- mavjud kod xatosini topib, acceptance criteria buzilmasa, o‘zing tuzatish;
- kerakli dependency’ni development scope’da o‘rnatish yoki yangilash;
- audit, status, reconciliation va release report fayllarini yaratish;
- xavfsiz default bo‘yicha texnik qaror qabul qilib, ishni to‘xtatmasdan davom etish.

Har bir oddiy fayl o‘zgarishi uchun confirmation kutma. Birinchi navbatda
`git status` va mavjud dirty diff’ni saqla, keyin ishni mustaqil davom ettir.
Noaniq texnik tanlovda PTO data integrity, security va backward-safety’ni
ustun qo‘yib, qarorni reportga yoz.

**Qattiq xavfsizlik chegarasi:** production Supabase/Cloudflare/R2/Drive holatini
qaytarib bo‘lmaydigan o‘zgartirish, mass deletion, force-push, secret rotation
va egasi tasdiqlamagan biznes qoidasini almashtirishni avtomatik bajarib yuborma.
Bunday holatga kelganda barcha local tayyorgarlikni yakunla, aniq command/payload
va oqibatni yoz, keyin faqat shu bitta tashqi approval nuqtasida to‘xta. Qolgan
local ishlarni approval kutmasdan davom ettir.

Hujjatlarda “tayyor”, “100%”, “production” deb yozilgan da’volarni kod, test,
deployed readback yoki real fixture bilan tasdiqlamaguncha fakt deb qabul qilma.
Agar dalil bo‘lmasa, `UNPROVEN` yoki `BLOCKED` deb yoz.

Hech qachon quyidagilarni qilma:

- Tizim-1ga qaytib, yangi PTO mantiqini GAS’da yozma;
- GAS’ni T2 uchun fallback sifatida ulama;
- Supabase service-role kalitini frontendga berma;
- klient yuborgan `kompaniya_id`, `obyekt_id` yoki storage path’ni ko‘r-ko‘rona
  ishonchli deb qabul qilma;
- LLM orqali pul/hajm/jami hisoblama;
- mavjud dirty working tree fayllarini ko‘r-ko‘rona almashtirma;
- production migration, deploy, destructive delete yoki auth/RLS arxitektura
  o‘zgarishini egasining aniq tasdig‘isiz bajarma.

---

## 2B. CLAUDE CODE’NI ISHGA TUSHIRISH PROFILI

Agar Claude Code lokal/dev ishlarni maksimal avtonom bajarishi kerak bo‘lsa, repo
rootidan quyidagi rejimdan foydalanish mumkin:

```bash
claude --dangerously-skip-permissions --effort max -p "@docs/ai/CLAUDE_CODE_T2_PTO_TOPSHIRIQ_2026-09-09.md faylini to‘liq o‘qi va topshiriqni bajar. Avval 0-bosqich auditini qil, keyin T2 PTO bo‘yicha implementatsiyani boshlagin. Har bir oddiy fayl o‘zgarishi uchun ruxsat so‘rama. Tizim-1/GAS’ni fallback yoki yangi writer sifatida ishlatma. Production migration/deploy/destructive actionni avtomatik bajarib yuborma." --max-turns 100
```

`--dangerously-skip-permissions` faqat ishonchli local repository/dev muhitida
ishlatiladi. Bu flagni qo‘llash production Supabase, Cloudflare, R2 yoki Drive’da
qaytarib bo‘lmaydigan amallarni bajarishga ruxsat bermaydi: topshiriqdagi hard
safety boundary o‘z kuchida qoladi.

Agar interaktiv rejimda ishlatilsa:

```bash
claude --dangerously-skip-permissions --effort max
```

So‘ng Claude Code’ga quyidagini yubor:

```text
@docs/ai/CLAUDE_CODE_T2_PTO_TOPSHIRIQ_2026-09-09.md ni to‘liq o‘qi.
Maksimal avtonom rejimda ishlagin: routine fayl, test, build va local migration
uchun confirmation so‘rama. Avval audit va gap matrixni yarat, keyin P0’dan
boshlab Tizim-2 PTO’ni implement qil. Tizim-1/GAS’ni kundalik PTO oqimiga
ulama. Har bosqichni real test bilan tekshir.
```

## 3. Ish boshlashdan oldingi majburiy tekshiruv

Avval hech qanday kod yozmasdan quyidagilarni bajargin:

1. `git status --short --branch` va `git diff --stat`ni ol.
2. Joriy branchni aniqlagin. `origin/main` bilan farqni ko‘r.
3. `CLAUDE.md`, `AGENTS.md` va ulardagi loyiha qoidalarini o‘qi.
4. Quyidagi authority hujjatlarni o‘qi:
   - `00_BOSH_QONUN.md`
   - `docs/product/PTO_TARGET_STATE.md`
   - `docs/product/PTO_ACCEPTANCE_MATRIX.md`
   - `docs/audit/HERMES_FULL_SYSTEM_AUDIT_2026_09.md`
   - `HERMES_UCHUN_MUAMMOLAR_2026-09-09.md` — agar joriy branchda bo‘lmasa,
     `git show origin/main:HERMES_UCHUN_MUAMMOLAR_2026-09-09.md` orqali o‘qi.
5. `frontend/`, `frontend/functions/`, `supabase/migrations/` va
   `supabase/tests/`ni actual kod sifatida tekshir.
6. Joriy dirty o‘zgarishlar qaysi fayllarda ekanini yozib ol. Ularni yo‘qotma.
7. `origin/main`dagi yangi T2 kodini joriy branchga ko‘r-ko‘rona merge qilma.
   Avval uch tomonlama diff va conflict/reconciliation ro‘yxatini tuz.

Birinchi natija sifatida quyidagi audit faylini yarat:

```text
docs/audit/T2_PTO_CLOSURE_AUDIT_2026-09-09.md
```

Auditda har bir band uchun quyidagi jadval bo‘lsin:

```text
Talab | Hozirgi kod | Tizim-2 canonical yechim | Dalil | Status | Keyingi ish
```

Statuslardan foydalan:

```text
PROVEN | PARTIAL | BLOCKED | UNPROVEN | MISSING | LEGACY_REFERENCE_ONLY
```

---

## 4. Birinchi darajali kamchiliklar

### P0-A — Auth, tenant va data isolation

Tizim-2 production’da ishlashi uchun barcha read/write yo‘llarida kompaniya va
obyekt ownership’i server/RPC/DB qatlamida tekshirilishi kerak.

Quyidagilarni tekshir va yop:

1. `/api/sb`:
   - faqat `kompaniya_id=eq.N` bo‘lsa tekshirish kabi qisman mantiq qolmasin;
   - object-only read, unfiltered read va relationship read ham serverda scope
     qilinsin;
   - klient `select`/relationship embedding orqali ortiqcha ma’lumot ololmasin.
2. `/api/sb-yoz`:
   - `kompaniya_id` yuborilmagan operation’lar object/record ownership’i orqali
     serverda tekshirilsin;
   - expected version va operation ID moliyaviy writes uchun majburiy bo‘lsin;
   - eski sessiya membership’siz bo‘lsa fail-open bo‘lmasin.
3. `/api/upload`:
   - session va tenant/object membership tekshiruvi bo‘lsin;
   - R2 key server tomonidan yaratilisin;
   - client yuborgan `kompaniya_id`, `obyekt_id`, filename ownership sifatida
     qabul qilinmasin;
   - size/MIME allowlist, overwrite protection, file hash, status va audit
     bo‘lsin;
   - public URL faqat ruxsat etilgan read oqimi orqali berilsin.
4. `/api/payment`:
   - authsiz, signature’siz, replay protection’siz moliyaviy RPC chaqiruvi
     qolmasin;
   - provider signature/shared secret/timestamp/replay va amount reconciliation
     bo‘lsin;
   - transaction holati serverdagi mavjud payment bilan tekshirilsin.
5. `/api/gas`:
   - T2 PTO normal oqimidan chiqarilsin;
   - agar legacy compatibility route vaqtincha qolsa, aniq read-only/reference
     allowlist bo‘lsin;
   - arbitrary `api*` dispatcher orqali privileged writer chaqirishga yo‘l
     qolmasin.
6. Login/session:
   - membership enrichment ishlamasa sessiya kengaytirilgan huquq bilan
     chiqarilmasin;
   - tenant claim yo‘q bo‘lsa request rad etilsin;
   - role/tenant/object scope serverdan kelib chiqsin;
   - logout, expiry va role change/readback test qilinsin.
7. Supabase:
   - barcha T2 jadvallarida RLS/policy/grant holati migration bilan canonical
     bo‘lsin;
   - `SECURITY DEFINER` RPC’lar `search_path`, revoke/grant va membership’ni
     aniq tekshirsin;
   - service-role faqat Cloudflare serverida bo‘lsin.

Majburiy security testlar:

- authsiz read/write — `401`;
- A kompaniya useri B kompaniya obyektini o‘qiy olmaydi;
- A useri B obyektiga write/upload/payment qila olmaydi;
- object-only query cross-tenant ma’lumot qaytarmaydi;
- client storage path ownership’ni o‘zgartira olmaydi;
- replay qilingan operation/payment qayta qo‘llanmaydi;
- service-role key frontend bundle’da chiqmaydi.

---

### P0-B — Tizim-2 canonical schema va ownership

`supabase/migrations/` Tizim-2ning to‘liq forward schema source-of-truth’i bo‘lishi
kerak. Yangi T2 muhitini noldan tiklash mumkin bo‘lmagan holat qabul qilinmaydi.

Quyidagilarni qil:

1. T2 PTO uchun kerakli table/view/RPC/trigger/index’larni inventory qil.
2. Frontend chaqirayotgan, lekin migration’da aniqlanmagan RPC’larni ro‘yxatla.
3. Har bir entity uchun writer/read model/relation/audit/version jadvalini tuz.
4. `UUID` va `bigint` project/object ID aralashuvini Tizim-2 uchun yakuniy bitta
   modelga keltir. T1 schema’ni T2ga majburan ko‘chirma.
5. `t2_kompaniya`, `t2_loyiha`, `t2_obyekt`, `t2_qator`, `t2_qator_holat`,
   `t2_akt`, `t2_akt_qator`, F2 import/job, document/source/revision va audit
   entity’larini canonical bog‘la.
6. Migration’lar toza database’da ketma-ket ishlashini local test bilan tekshir.
7. Har bir financial RPC uchun transaction boundary, constraint, idempotency,
   expected version va authorization ko‘rinsin.
8. Faqat “table/function mavjud” testi bilan cheklanma; real insert/update,
   rollback, duplicate, version conflict va cross-tenant test qil.

Migration yoki production DB o‘zgarishi kerak bo‘lsa, migration faylini tayyorla,
lekin production’da qo‘llama. Approval talab qilinadigan ishlarni alohida
`AUTH_OR_APPROVAL_REQUIRED` deb belgila.

---

### P0-C — Yagona PTO workspace context

Tizim-2 PTO’da obyekt tanlovi page-local bo‘lmasin. Canonical context:

```text
Company → Project → Object → Period → Source document/revision → PTO workspace
```

Majburiy:

- validated numeric company ID;
- company bilan tekshirilgan project/object ID;
- explicit period key;
- source document/revision;
- optimistic version;
- context status: loading, valid, stale, missing, forbidden, unavailable;
- refresh va direct URL context’ni tiklaydi;
- kompaniya o‘zgarsa project/object/period tozalanadi yoki qayta tekshiriladi;
- birinchi obyektni jim tanlash yo‘q;
- URL query/path orqali context tiklanadi.

Tekshir:

- `KompaniyaTanlov.tsx`;
- `TestF2.tsx`;
- `TestF2Import.tsx`;
- `TestDaraxt.tsx`;
- `TestSklad.tsx`;
- `WrapperPortfel.tsx`;
- `WrapperMoliya.tsx`;
- `App.tsx` route’lari.

Bitta `PTOWorkspaceContext` yoki mavjud architecture’ga mos ekvivalent yarat.
Har bir ekran shu context orqali ishlasin.

---

### P0-D — Smeta/LRV/RES’ni T2ga o‘tkazish

Tizim-2 PTO normal ishlashi uchun Smeta/LRV/RES ma’lumotlari T2 canonical
modelga import qilinadi. Foydalanuvchining kundalik ishlashida GAS 6 daqiqalik
chegaraga bog‘liqlik qolmasin.

Majburiy import modeli:

```text
source file/document
 → source hash/revision
 → raw import
 → normalized rows
 → hierarchy/classification
 → price/unit validation
 → canonical T2 rows
 → derived status/rollup
 → audit/reconciliation
```

Har bir qator uchun kamida:

- stable row/entity ID;
- company/project/object;
- source document/revision/hash;
- sheet/row/source location;
- parent/section/work/resource relation;
- type: `rz/bl/rs/mat/ob`;
- code/name/unit;
- norma va hajm alohida;
- source price/source amount alohida;
- derived amount alohida;
- import status/exception/reason;
- version/operation/actor/time.

Qoidalar:

- `NULL` narxni `0`ga almashtirma;
- unit mismatch’ni avtomatik yutma;
- parent va child’ni ikki marta jamlama;
- `JAMI`, `NORMA`, `ITOGO` qatorlarini oddiy resurs deb olma;
- manfiy correction’ni yo‘qotma;
- local filename yagona identity bo‘lmasin;
- source amount’ni `qty × price` bilan jim almashtirma;
- katta import background/resumable job bo‘lsin;
- retry idempotent bo‘lsin;
- partial failure qayta tiklanadigan bo‘lsin;
- importdan keyin canonical T2 readback bo‘lsin.

T1 parser yoki eski fayl formatidan foydalanish mumkin, ammo parser T2
canonical persistence’ga yozsin va normal PTO oqimi GAS WebApp’ni chaqirmasin.

---

### P1-A — Fakt/F2 moliyaviy yadro

T2 PTO’da quyidagi zanjir deterministik bo‘lsin:

```text
SMETA → FAKT → F2 → QOLDIQ
```

Majburiy qoidalar:

- `F2(oylik) ≤ FAKT ≤ SMETA` — policy bo‘yicha hard block yoki warning ekanini
  canonical config/test’da aniq belgila;
- approved F2 tarixiy qayta hisoblashdan o‘zgarmasin;
- Fakt/F2 qatori actor, sana, period, unit, version, operation ID bilan yozilsin;
- negative correction alohida reason va `correction_of` bilan ko‘rinsin;
- draft, rejected, approved, superseded holatlari aralashmasin;
- parent `bl` va resurs child double-count bo‘lmasin;
- F2 source amount va derived amount saqlansin;
- optimistic locking majburiy;
- retry duplicate qator yaratmasin;
- server write’dan keyin canonical readback qilinsin;
- `NAKRUTKA` core PTO qoldig‘iga qo‘shilmasin.

F2 lifecycle:

```text
draft → checked/pre-approval → approved
                          ↘ rejected/cancelled/superseded
```

Approval/history uchun append-only history yoki immutable approved snapshot
bo‘lsin. UI’da “Tasdiqlash” tugmasi mavjudligi yetarli dalil emas.

---

### P1-B — Targeted Smeta re-import

Bu resumable F2 importdan alohida feature.

Talab:

1. eski canonical T2 revision va yangi faylni stable code/row/source key bo‘yicha
   solishtirish;
2. o‘zgargan qatorlarni yangi revisionga chiqarish;
3. yo‘qolgan qatorlarni o‘chirmasdan `removed/missing/superseded` sifatida
   belgilash;
4. oldingi Fakt, F2, correction va qo‘shimcha ishlarni saqlash;
5. foydalanuvchi mapping’ini saqlash;
6. import diff’ini preview’da ko‘rsatish;
7. destructive delete’ni default qilmaslik;
8. har bir diff source/revision/audit bilan yozilishi;
9. katta faylda background/resumable bo‘lishi;
10. rollback yoki supersede imkoniyati bo‘lishi.

Alohida acceptance fixture yarat:

- yangi qator;
- o‘zgargan qator;
- o‘chirilgan qator;
- bir xil nom, boshqa code;
- bir xil code, boshqa unit;
- oldingi Fakt/F2 mavjud qator;
- correction va zamena mavjud qator.

---

### P1-C — LRV_PLUS eksport v2

GitHub `origin/main`da mavjud MVP eksportni tekshir, lekin uni tayyor deb qabul
qilma. `frontend/src/lib/lrv-plus-export.ts` va testini T2 canonical backend
modeliga ulang.

Eksportda bo‘lishi kerak:

- Tizim-1 LRV_PLUS ierarxiyasiga mos parent/child grouping;
- `№`, code, name, unit, norma, smeta hajmi/narxi/summasi;
- `FAKT`;
- `F2 OLINGAN`;
- `F2 OLINISHI MUMKIN`;
- `OSTATKA/QOLDIQ`;
- kerakli `F2` period ustunlari;
- source row/document/revision belgisi yoki evidence metadata;
- `rz/bl/rs/mat/ob` tiplari;
- parent total double-count bo‘lmasligi;
- `NULL` qiymat `0` emas, ko‘rinadigan `—` yoki Excel blank semantics;
- narxsiz qatorlar ochiq ogohlantirilishi;
- `rz/bl/rs/mat` rangli dizayn;
- Excel formula/number format/freeze/filter/grouping;
- katta obyekt uchun export job yoki memory-safe oqim;
- eksportdan keyin file registry/hash/readback.

`xlsx-js-style` faqat dependency bo‘lishi yetarli emas — style real XLSX output’da
tekshirilsin.

Acceptance:

- kichik fixture;
- kamida 1 000 qator;
- katta synthetic fixture;
- parent/child jami;
- NULL/narxsiz;
- manfiy correction;
- F2 qoldiq;
- range/style/format snapshot testi;
- eksport faylini qayta ochib readback qilish.

---

### P1-D — Hujjatlar va storage

Drive/R2/Supabase uchligini Tizim-2 ownership bilan yop:

- original source document;
- document ID/revision/hash;
- company/project/object/period linkage;
- upload status: reserved/uploading/stored/failed/superseded;
- actor/time/operation ID;
- R2 object key serverdan;
- Supabase registry canonical metadata;
- signed/read-authorized access;
- readback va hash verification;
- failed/ghost upload cleanup;
- delete/supersede audit.

Drive/GAS’dan fayl o‘qilsa, bu faqat T2 import adapteri sifatida bo‘lsin. T2
canonical row va revision Supabase’da saqlansin.

---

## 5. Nimalar hozir scope’dan tashqarida

PTO end-to-end yopilmaguncha quyidagilarga katta yangi feature boshlama:

- CRM;
- 3D dashboard;
- yangi AI provider;
- Forma-3/KS-3 legal formula — authoritative rule source bo‘lmasa;
- umumiy ERP kengaytmalari;
- ko‘rinish uchun mock KPI;
- Tizim-1ni yanada rivojlantirish.

Bu modullar bo‘yicha mavjud kodni buzma, ammo PTO release’ni ularga bog‘lama.

---

## 6. Kod sifati va test talablari

Har bir o‘zgarishdan keyin haqiqiy command’larni ishga tushir:

```bash
cd frontend
npm test
npm run tekshir
npm run lint
npm run build
```

Qo‘shimcha:

```bash
node testlar/t2_tenant_izolyatsiya.test.cjs
```

Tizim-2 uchun alohida testlar qo‘sh:

- Supabase/RLS cross-tenant negative test;
- Cloudflare auth/upload/payment contract test;
- canonical import/revision/diff test;
- Fakt/F2 invariant test;
- idempotency/concurrency/version conflict test;
- LRV export output/style/readback test;
- workspace URL/reload/company-switch test;
- large fixture performance test;
- partial failure/resume/retry test.

Static regex testni runtime test deb atama. Test o‘tgan bo‘lsa command, scope,
fixture va natijani ko‘rsat. Lint warning’larini “pass” deb yashirma.

---

## 7. Ishlash usuli

Ishni quyidagi bosqichlarga bo‘l:

### Bosqich 0 — Audit va plan

- `git status`, branch divergence va dirty files;
- canonical T2 inventory;
- gap matrix;
- approval talab qiladigan ishlar;
- aniq implementation plan.

### Bosqich 1 — P0 security boundary

- auth/session fail-closed;
- tenant/object server scope;
- upload/payment/generic gateway;
- RLS/grants;
- negative tests.

### Bosqich 2 — P0 canonical T2 schema/context

- migration ownership;
- stable IDs;
- workspace context;
- entity relation/audit/version;
- clean bootstrap test.

### Bosqich 3 — P1 PTO core

- Smeta/LRV/RES import;
- Fakt/F2;
- qoldiq;
- correction/idempotency;
- targeted re-import.

### Bosqich 4 — P1 export/document

- LRV_PLUS v2;
- F2 approval/history;
- R2/Drive document registry;
- readback.

### Bosqich 5 — Release gate

- real large fixture;
- browser owner smoke;
- two-tenant isolation;
- build/lint/tests;
- rollback/readback;
- final NO-GO/GO report.

Har bosqichda kichik, tekshiriladigan vertical slice qil. Bir vaqtning o‘zida
hamma modulni refactor qilma.

---

## 8. Approval va xavfsizlik chegarasi

Quyidagilarda oldindan explicit human approval ol:

- production Supabase migration;
- destructive SQL/delete;
- RLS/auth arxitekturasi o‘zgarishi;
- Cloudflare production deploy;
- Drive/R2 mass data change;
- F2/Smeta biznes qoidasini o‘zgartirish;
- secret rotation yoki secret storage o‘zgarishi;
- force-push/history rewrite.

Approval bo‘lmasa:

- local code/test/migration draft tayyorla;
- production’ga yuborma;
- `AUTH_REQUIRED` yoki `APPROVAL_REQUIRED` deb hisobotda ko‘rsat.

Secretlarni hech qachon chatga, Markdown’ga, source’ga yoki gitga yozma.

---

## 9. Yakuniy acceptance criteria

Ish “done” deyilishi uchun quyidagilarning barchasi bajarilgan bo‘lishi kerak:

- Tizim-2 PTO normal oqimida Tizim-1/GAS dependency yo‘q;
- Supabase canonical T2 schema’ni toza muhitda tiklash mumkin;
- har bir read/write tenant/object scope bilan himoyalangan;
- authsiz va cross-tenant negative testlar pass;
- company/project/object/period context refresh/direct URL bilan tiklanadi;
- birinchi obyekt jim tanlanmaydi;
- Smeta/LRV/RES T2 canonical lineage bilan import qilinadi;
- katta import timeout’siz, resumable va idempotent ishlaydi;
- Fakt/F2/qoldiq deterministik va double-count’siz;
- NULL, zero, unit mismatch, negative correction to‘g‘ri ko‘rsatiladi;
- F2 approval/history immutable snapshot yoki append-only tarix bilan yopilgan;
- targeted re-import oldingi Fakt/F2 va qo‘shimcha ishlarni yo‘qotmaydi;
- LRV_PLUS eksporti barcha talab qilingan ustun, rang va jami bilan real XLSX’da
  readback testdan o‘tadi;
- R2/Drive/Supabase document registry va ownership readback bilan tasdiqlanadi;
- `npm test`, `npm run tekshir`, `npm run lint`, `npm run build` real bajarilgan;
- large-object test natijalari bor;
- authenticated browser owner smoke o‘tgan;
- production deploy/migration faqat tasdiq bilan bajarilgan;
- yakuniy hisobotda o‘zgargan fayllar, command natijalari, dalillar, qolgan
  muammolar va `GO/NO-GO` qarori bor.

Static test yoki UI tugmasi mavjudligi production tayyorlik isboti emas.

---

## 10. Yakuniy hisobot formati

Claude Code ish oxirida quyidagi formatda qaytarsin:

```text
STATUS: GO / NO-GO / BLOCKED

1. Nima o‘zgardi
   - file:path:line — o‘zgarish

2. Tizim-2 canonical qarorlar
   - writer/reader/ownership

3. Security dalillari
   - auth/tenant/upload/RLS negative tests

4. PTO dalillari
   - import/Fakt/F2/qoldiq/export/readback

5. Testlar
   - command — exit code — natija

6. Production’da bajarilmagan ishlar
   - migration/deploy/Drive/R2/Supabase/runtime

7. Qolgan muammolar
   - P0/P1/P2

8. Owner qarorini talab qiladigan bandlar
   - aniq savol va tanlovlar
```

Hech qachon “hammasi tayyor” deb yozma, agar yuqoridagi acceptance criteria’lardan
bittasi ham isbotlanmagan bo‘lsa.

---

## Qisqa maqsad

Maqsad yangi ekranlar sonini ko‘paytirish emas. Maqsad:

> **Tizim-2 ichida foydalanuvchi o‘z obyektida katta smeta bilan PTO ishini
> Smeta → Fakt → F2 → Qoldiq → Tasdiq → Eksport → Hujjat zanjiri bo‘yicha
> ishonchli, xavfsiz va GAS 6 daqiqalik limitisiz bajara olishi.**
