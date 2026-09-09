# HERMES UCHUN TOPSHIRIQ — Tizim-2 PTO liniyasini oxirigacha yopish

**Sana:** 2026-09-09 · **Muallif:** Claude Code · **Ustuvorlik:** P0/P1
**Kutilayotgan hajm:** bir necha soatlik uzluksiz ish, 6 ta ish paketi.

Bu hujjat sovuqdan boshlanadi: seni hech qanday oldingi suhbat kontekstisiz
ishlay oladigan qilib yozilgan. Pastdagi «isbotlangan faktlar» bo'limi —
qayta tekshirishga vaqt sarflamasliging uchun; ularning har biri jonli
bazada yoki kodda o'lchangan.

---

## 0. BOOT — avval shularni shu tartibda o'qi

1. `AGENTS.md` — boot protokoli (yagona).
2. `docs/governance/CONSTITUTION.md` — buzib bo'lmaydigan qoidalar.
3. `docs/governance/CURRENT_STATE.md` — o'lchangan holat (jurnal emas).
4. `docs/ai/CLAUDE_CODE_T2_PTO_TOPSHIRIQ_2026-09-09.md` — egasining asosiy
   PTO topshirig'i. **Sening ishing shuni yopish.**
5. `docs/audit/T2_PTO_CLOSURE_AUDIT_2026-09-09.md` — Bosqich 0 auditi va
   gap matrix. **Bu sening ish ro'yxating.**
6. `HERMES_UCHUN_MUAMMOLAR_2026-09-09.md` — tuzatilgan/ochiq muammolar.

Konstitutsiyadan eng muhim uchtasi, esda tut:
- `NULL` — «noma'lum», hech qachon jim `0` ga aylantirilmaydi.
- Soxta narx/hajm/sana/KPI/moliyaviy ma'lumot yo'q.
- Har bir yozuv nomlangan RPC orqali; tenant chegarasi bazada ham tekshiriladi.

---

## 1. ISH TARTIBI VA TO'QNASHUVNI OLDINI OLISH

```bash
git fetch origin main
git checkout -B hermes/t2-pto-closure-v1 origin/main
```

- **`main` ga push qilma.** O'z branchingda ishla.
- `ops/ACTIVE_TASKS.json` ga o'z yozuvingni qo'sh (`owner: "hermes"`,
  `owns: [...]`, `production_write_allowed: false`), `owns` ro'yxatidan
  tashqaridagi fayllarni tahrirlama.
- Har handoffdan oldin: `node ops/governance-check.cjs`.
- Boshqa agent (Claude) `main` da ishlayapti — muntazam `git fetch origin main`
  qilib rebase qil, konflikt bo'lsa uch tomonlama diff bilan hal qil.

### Qattiq xavfsizlik chegarasi

Egasining aniq tasdig'isiz **bajarma**: production Supabase migration,
destructive SQL/delete, RLS/auth arxitekturasi o'zgarishi, Cloudflare deploy,
Drive/R2 ommaviy o'zgarish, F2/Smeta biznes qoidasini almashtirish, secret
rotation, force-push. Bunday joyga kelsang: local tayyorgarlikni **oxirigacha**
qil, aniq command/payload va oqibatni yoz, `APPROVAL_REQUIRED` deb belgila,
**qolgan ishni davom ettir**. To'xtab qolma.

Productionda tekshirish kerak bo'lsa — **faqat rollback tranzaksiyasida**
(§7 dagi tayyor naqsh).

---

## 2. ISBOTLANGAN FAKTLAR — qayta tekshirma, tayan

| Fakt | Dalil |
|---|---|
| Supabase loyiha `tuoyrzadkgoltpqkdiyx` | — |
| `t2_qator` = 36 654 qator; faol obyektlar 8 ta | jonli `count(*)` |
| **`t2_akt_qator` = 0 qator.** Butun bazada birorta F2/Fakt hujjat qatori yo'q | jonli `count(*)` |
| Shuning uchun `t2_qator_holat` da FAKT va F2 **hamma joyda nol** | jonli `group by tur` |
| `t2_akt` da 1 ta yozuv: `id=19`, `tur='f2'`, `holat='tasdiqlangan'`, lekin **ichida 0 qator** — arvoh tasdiqlangan hujjat | jonli o'qish |
| 2 ta F2 import ishi `review` bosqichida qotib qolgan: job 2 (obyekt 6, 1.63 mlrd), job 3 (obyekt 56, 1.75 mlrd), ikkalasi `status='running'`, `completed_at=null` | `t2_f2_import_job` |
| Sabab (TUZATILDI, commit `da26170`): `exactWrite` narxi nol qator uchrasa BUTUN faylni rad etardi | `F2ImportNative.tsx` |
| Haqiqiy faylda 1054 qatordan **164 tasi narxsiz**, ulardan **159 tasi allaqachon moslashgan** edi | `t2_f2_import_draft_qator` |
| `000003` ЗАТРАТЫ ТРУДА МАШИНИСТОВ — obyekt 6 da **782/782 = 100 % narxsiz** (qoida: mashinist soati mashina narxi ichida). Taqqoslash: `000001` РАБОЧИХ — **852/852 narxlangan**, narx 24517.7 | jonli `group by kod` |
| F2 zanjiri uchidan-uchiga **ishlaydi**: rollback tranzaksiyasida 1020 qator yozildi, akt summasi **1 633 694 097.50**, read-modeldagi barglar summasi **aynan shu**, **farq 0.00**; 79 manfiy (storno) qator saqlandi; fantom pul 0 | jonli rollback testi |
| `/api/payment` va `/api/upload` — authsiz edi, **o'chirildi** (commit `edc3977`) | audit §2 |
| `R2_ARCHIVE` bindingi `wrangler.toml` da umuman yo'q edi | `wrangler.toml` |
| `PTOWorkspaceContext` **mavjud emas** — faqat `KompaniyaKontekst` (kompaniya darajasi) | `frontend/src/umumiy/kontekst/` |
| `docs/product/PTO_TARGET_STATE.md`, `PTO_ACCEPTANCE_MATRIX.md`, `docs/audit/HERMES_FULL_SYSTEM_AUDIT_2026_09.md` — **repoda yo'q** | `find` |
| Authenticated owner smoke — **hech qachon bajarilmagan** (egasining sessiyasi kerak) | `CURRENT_STATE.md` |

### ⚠️ Ikki marta takrorlangan xato — sen ham tushib qolma

**(a) `t2_qator` ga ommaviy yozishdan oldin `t2.manba` ni belgila.**
Bu jadvalda ikkita trigger bor (`t2_ozgarish_qayd`, `t2_signal_source_trigger`);
ular `current_setting('t2.manba')` `'import'|'markirovka'|'narxlash'|'rollup'`
bo'lmasa **har bir qator uchun** audit-log va signal-refresh ishlatadi. Minglab
qatorda bu 57014 (statement_timeout) beradi. Naqsh:

```sql
perform set_config('t2.manba', 'import', true);
delete from public.t2_qator where obyekt_id = p_obyekt_id;
```

Bu xato commit `793e716` da tuzatilgan, keyin yangi RPC'da **qaytadan**
paydo bo'lgan (`7dc1039`). Yangi ommaviy yozuvchi yozsang — birinchi navbatda
shuni tekshir.

**(b) Kichik ma'lumotda ishlagan kod katta ma'lumotda buziladi.** Har bir
yangi yozuv yo'lini kamida **1000+ qatorli** haqiqiy hajmda sina.

---

## 3. ISH PAKETLARI

Tartib muhim: WP-1 va WP-2 keyingilarining poydevori. Har bir paket
oxirida §6 gate'ini yurgiz va commit qil.

### WP-1 — F2 zanjirini haqiqatan yopish (P1-A)

**Nega:** kod tuzatilgan va rollback bilan isbotlangan, lekin bazada hamon
0 ta akt qatori bor. Zanjir amalda ishlayotganini hech kim ko'rmagan.

1. `t2_akt` `id=19` — tasdiqlangan, lekin bo'sh hujjat. Nima uchun paydo
   bo'lganini top (`t2_audit`, `t2_onboarding_command_log`). Bu holat
   qaytarilmasligi uchun **tekshiruv qo'sh**: qatori yo'q aktni
   `tasdiqlangan` ga o'tkazib bo'lmasin (RPC yoki CHECK).
2. F2 lifecycle'ni yop: `draft → checked → approved`, yon shoxlar
   `rejected/cancelled/superseded`. Hozir `holat` maydoni bor, lekin
   o'tishlar boshqarilmaydi. Ruxsat etilgan o'tishlar jadvalini RPC'da
   majburiy qil.
3. Tasdiqlangan F2 **o'zgarmas** bo'lsin: keyingi qayta hisoblash tarixiy
   tasdiqlangan hujjatni o'zgartirmasin (append-only tarix yoki immutable
   snapshot).
4. Manfiy correction qatorlari `correction_of` va `sabab` bilan ko'rinsin
   (hozir 79 tasi bor, lekin sababsiz).
5. `F2(oy) ≤ FAKT ≤ SMETA` invarianti: hard block'mi yoki warning'mi —
   canonical config'da **aniq** belgila va testga tushir.

**Acceptance:** rollback tranzaksiyasida to'liq lifecycle testi (draft →
approved → tasdiqlangandan keyin o'zgartirishga urinish rad etiladi →
superseded), va invariant buzilishining aniq xato kodi.

### WP-2 — Canonical schema va bootstrap (P0-B)

**Nega:** yangi T2 muhitini noldan tiklab bo'lishi kerak; hozir buni hech
kim tekshirmagan.

1. Frontend/functions chaqirayotgan **barcha RPC nomlarini** yig'
   (`grep -rn "rpc/" frontend/functions/ frontend/src/`), `supabase/migrations/`
   da aniqlanganlari bilan solishtir. Farqni jadval qilib yoz.
2. Repo↔prod drift: `t2_resource_command_v2`, `t2_mindmap_request_identity_v2`
   (`CURRENT_STATE.md` da ochiq deb qayd etilgan). Qaysi versiya to'g'ri —
   aniqla, migration bilan yopish rejasini yoz (**qo'llama**).
3. Toza bazada migration bootstrap testi: barcha migration ketma-ket
   ishlaydimi? Buni **disposable** muhitda qil (local Postgres yoki Supabase
   branch), productionda emas.
4. Har bir PTO entity uchun writer/read-model/relation/audit/version jadvali.

**Acceptance:** `docs/audit/T2_SCHEMA_INVENTORY_2026-09.md` — RPC inventari,
drift ro'yxati, bootstrap natijasi (exit code bilan).

### WP-3 — PTO workspace context (P0-C)

**Nega:** hozir obyekt tanlovi sahifa-lokal; refresh yoki to'g'ridan-to'g'ri
URL kontekstni tiklamaydi.

Canonical zanjir: `Company → Project → Object → Period → Source document/revision`.

1. `PTOWorkspaceContext` yarat (mavjud `KompaniyaKontekst` ustiga, uni
   almashtirmasdan).
2. Majburiy: tekshirilgan numeric company ID; company bilan tasdiqlangan
   project/object; explicit period key; source document/revision; optimistic
   version; holat: `loading | valid | stale | missing | forbidden | unavailable`.
3. URL query/path orqali tiklanadi; refresh kontekstni yo'qotmaydi.
4. **Birinchi obyektni jim tanlash yo'q.** Kompaniya o'zgarsa quyi kontekst
   tozalanadi yoki qayta tekshiriladi.
5. Shu ekranlarni ulash: `HolatNative`, `F2ImportNative`, `SmetaYuklaNative`,
   `F2TayyorlashNative`, `NarxlarNative`.

**Acceptance:** refresh/direct-URL/company-switch testlari (vitest), va
«birinchi obyekt jim tanlanmaydi» regressiya testi.

### WP-4 — Targeted smeta re-import (P1-B)

**Nega:** butunlay yo'q. Egasi avval qoidani tanlagan: **yo'qolgan qator
o'chirilmaydi, faqat belgilanadi.**

1. Eski canonical revision va yangi faylni stable code/row/source key
   bo'yicha solishtir.
2. O'zgargan qatorlar yangi revisionga; yo'qolganlar `removed/missing/
   superseded` deb **belgilanadi**, o'chirilmaydi.
3. Oldingi Fakt/F2/correction/qo'shimcha ishlar **saqlanadi**.
4. Import diff preview'da ko'rinadi; destructive delete default emas.
5. Katta faylda resumable; retry idempotent.

**Majburiy acceptance fixture** (topshiriq §P1-B): yangi qator · o'zgargan
qator · o'chirilgan qator · bir xil nom boshqa kod · bir xil kod boshqa
birlik · oldingi Fakt/F2 mavjud qator · correction va zamena mavjud qator.

### WP-5 — LRV_PLUS eksportini yopish (P1-C)

Eksport ishlaydi (`frontend/src/lib/lrv-plus-export.ts`), ustun tartibi
haqiqiy T1 bilan bir xil, ranglar va guruhlash bor. **Yopilmagan 7 band:**

1. Oylik F2 period ustunlari (T1 da `Mart 2026` / `₊нарх` / `₊сумма` uchligi).
2. Source row/document/revision evidence metadata.
3. `NULL` → ko'rinadigan `—` yoki Excel blank (hozir `0` yoziladi).
4. Narxsiz qatorlar ochiq ogohlantirilishi (hozir belgilanmaydi —
   ular 164 ta bo'lishi mumkin, foydalanuvchi bilishi shart).
5. Freeze panes (SheetJS CE yozmaydi — yechim topilsin yoki `UNPROVEN` deb yoz).
6. ≥1000 qatorli va katta synthetic fixture acceptance testi.
7. Katta obyekt uchun export job / memory-safe oqim + file registry/hash/readback.

**Diqqat:** rang testi faylning **o'z `xl/styles.xml`** i ustidan boradi,
chunki SheetJS o'qishda `.s` ni qayta qurmaydi. Mavjud naqshni
`lrv-plus-export.test.ts` dan ko'chir.

### WP-6 — Security boundary'ni yopish (P0-A qoldig'i)

1. `frontend/functions/api/sb-yoz.ts` (1972 qator) — har bir operation uchun
   ownership va expected-version tekshiruvi bormi? Jadval qilib chiqar.
   `kompaniya_id` yuborilmagan operationlar record ownership orqali
   tekshirilsinmi — tekshir.
2. **Cross-tenant negative testlar** (hozir umuman yo'q):
   authsiz read/write → 401 · A kompaniya useri B obyektini o'qiy olmaydi ·
   B obyektiga write/upload qila olmaydi · object-only query cross-tenant
   ma'lumot bermaydi · replay qilingan operation qayta qo'llanmaydi ·
   service-role kalit frontend bundle'da yo'q.
3. `frontend/functions/api/didox-webhook.ts` — **to'qilgan sonlar** qaytaradi
   (`topildi: 5`, `parse_qilingan_qatorlar: 12`), auth yo'q, chaqiruvchisi yo'q.
   Konstitutsiya buzilishi. Egasidan so'ra: o'chirilsinmi yoki haqiqiy
   integratsiya yozilsinmi. Javob kelguncha `APPROVAL_REQUIRED`.
4. `/api/gas` — allowlist qat'iyligini tekshir: ixtiyoriy `api*` dispatcher
   orqali privileged writer chaqirib bo'lmasin.

---

## 4. SCOPE'DAN TASHQARI

PTO uchidan-uchiga yopilmaguncha boshlama: CRM, 3D dashboard, yangi AI
provider, Forma-3/KS-3 huquqiy formulasi (authoritative manba yo'q), umumiy
ERP kengaytmalari, ko'rinish uchun mock KPI, Tizim-1/GAS'ni rivojlantirish.

**Tizim-1/GAS** — faqat reference/migration. Kundalik PTO oqimiga ulama,
fallback qilma, yangi biznes mantiqni u yerda yozma.

---

## 5. EGASINING QARORINI KUTAYOTGAN BANDLAR

Bularni o'zing hal qilma, lekin ular seni **to'xtatmasin**:

1. **Haqiqiy F2 importi** — job 2/3 ni oxirigacha yurgizish productionga
   1.63 mlrd so'mlik hujjat yozadi. Kod tayyor, rollback bilan isbotlangan.
2. **`didox-webhook`** — o'chirilsinmi yoki real integratsiya?
3. **Yo'q authority hujjatlar** — `PTO_TARGET_STATE.md`,
   `PTO_ACCEPTANCE_MATRIX.md`, `HERMES_FULL_SYSTEM_AUDIT_2026_09.md`.
4. **Authenticated owner smoke** — egasining sessiyasi kerak; hech qachon
   parol/cookie so'rama, egasi o'zi bajaradi.

---

## 6. GATE — har bir paketdan keyin

```bash
cd frontend
npx tsc -b                                   # exit 0 bo'lishi shart
npx tsc -p tsconfig.functions.json --noEmit  # alohida qatlam, tsc -b qamramaydi
npx vitest run
npm run tekshir
npm run lint                                 # 0 error (warning'lar eskidan bor)
npm run build
node ../ops/governance-check.cjs
```

Joriy bazaviy holat (buzilmasin): **vitest 377/377**, lint **0 error**,
qolgan hammasi PASS.

Testda: static regex testni runtime test deb atama. Test o'tgan bo'lsa
command, scope, fixture va natijani ko'rsat.

---

## 7. PRODUCTIONDA XAVFSIZ TEKSHIRISH NAQSHI

Jonli bazada isbotlash kerak bo'lsa — **hech narsa yozmasdan**:

```sql
do $$
declare v_log jsonb;
begin
  -- ... haqiqiy ma'lumot bilan yozish/o'qish ...
  v_log := jsonb_build_object('natija', ...);
  raise exception 'NATIJA=%', v_log;   -- majburiy rollback + natijani ko'rsatadi
end $$;
```

`raise notice` ishlatma — MCP qatlami uni qaytarmaydi. Natijani `raise
exception` xabariga jamla. Har bir bunday testdan keyin **albatta**
tekshir: `select count(*) from ...` — hech narsa qolmaganini tasdiqla.

---

## 8. YAKUNIY HISOBOT FORMATI

```text
STATUS: GO / NO-GO / BLOCKED

1. Nima o'zgardi          — file:path:line
2. Canonical qarorlar     — writer/reader/ownership
3. Security dalillari     — auth/tenant/negative testlar
4. PTO dalillari          — import/Fakt/F2/qoldiq/export/readback
5. Testlar                — command — exit code — natija
6. Productionda bajarilmagan
7. Qolgan muammolar       — P0/P1/P2
8. Egasining qarorini talab qiladigan bandlar
```

Acceptance mezonlaridan bittasi ham isbotlanmagan bo'lsa, **«hammasi tayyor»
deb yozma.** Dalil bo'lmasa `UNPROVEN` yoki `BLOCKED` deb yoz.

---

## Qisqa maqsad

> Foydalanuvchi o'z obyektida katta smeta bilan PTO ishini
> **Smeta → Fakt → F2 → Qoldiq → Tasdiq → Eksport → Hujjat** zanjiri bo'yicha
> ishonchli, xavfsiz va GAS 6 daqiqalik limitisiz bajara olishi.

Hozir bu zanjirning **Smeta** va **Eksport** qismi ishlaydi, **Fakt/F2**
qismi kodda tuzatilgan lekin bazada hali bo'sh, **Tasdiq** lifecycle'i
boshqarilmaydi, **kontekst** va **re-import** yo'q. Sening ishing — shu
bo'shliqlarni yopish.
