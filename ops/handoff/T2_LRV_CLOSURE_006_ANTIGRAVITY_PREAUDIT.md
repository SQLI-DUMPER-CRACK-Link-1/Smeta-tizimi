# T2-LRV-CLOSURE-006-ANTIGRAVITY-PREAUDIT — Antigravity lane (early, partial audit)

**Rol:** Independent auditor (Antigravity)
**Holat:** QISMAN audit — **FINAL audit EMAS**. T2-LRV-CLOSURE-006 (Claude) Section 5
qoidasiga ko'ra "Codex Tree V2 integratsiyasi VA isolated DB acceptance ikkalasi
ham tugamaguncha FINAL deb e'lon qilinmaydi". Bu lane shu ikkisidan MUSTAQIL —
allaqachon integration branch'ga tushgan qismlarni ERTAROQ tekshirish uchun.

## Nima allaqachon mavjud (sen o'zing tekshirgan narsalar)

Ushbu worktree'da (asosiy `C:\Users\PC\Documents\GAS`) sen ilgari uchta kontrakt/audit
hujjat yozgansan: `T2_LRV_EXACT_F2_AUDIT_003_ANTIGRAVITY.md`,
`T2_LRV_PRODUCT_AUDIT_001_ANTIGRAVITY.md`, `T2_SMETA_TREE_UX_REDESIGN_001_ANTIGRAVITY.md`
(va Company Control uchun yana uchtasi). **Bular hali commit qilinmagan** (git status'da
untracked) — shuning uchun boshqa worktree/agentlar (shu jumladan Codex va bu Claude
sessiyasi) ularni hozircha KO'RA OLMAYDI. Birinchi qadam: shu hujjatlarni tekshirib,
agar hali dolzarb bo'lsa — commit qilib push qil (yoki Claude bilan muvofiqlashtir),
aks holda bu lane'dagi topilmalar ular bilan ziddiyatga tushishi mumkin.

`T2_LRV_EXACT_F2_AUDIT_003_ANTIGRAVITY.md`dagi ikkita P0 (`F2_EXACT_AMOUNT`,
`F2_PRICE_SOURCE`) — Claude tomonidan `T2_LRV_EXACT_F2_INTEGRATION_003.md` va undan
keyingi roundlarda (`certified_quantity/unit_price/amount`, `t2_akt_yarat_v2`, no
smeta-price fallback) tuzatilgan deb da'vo qilingan. **Shu da'voni MUSTAQIL qayta
tekshir** — quyida aniq nima ko'rish kerakligi yozilgan.

## Vazifa: quyidagilarni MUSTAQIL, kod o'qib tekshir (Claude'ning "PASS" so'ziga ishonma)

### 1. F2 exact-source qonuni — haqiqatan tuzatilganmi?

- `supabase/migrations/20260920120000_t2_akt_qator_certified_v1.sql` — `certified_amount`
  ustuni GENERATED emasligini, va freeze trigger'ning ishlash mantig'ini tekshir.
- `supabase/migrations/20260920130000_t2_akt_yarat_v2.sql` — `MISSING_CERTIFIED_PRICE`/
  `MISSING_CERTIFIED_AMOUNT` haqiqatan batch'ni rad etadimi (qisman yozish yo'qmi)?
  Smeta narxiga fallback QAYERDA HAM bo'lmasligini tasdiqla (butun faylni grep qil).
- `frontend/src/test02/f2-exact-payload.ts` + `.test.ts` (YANGI, bu round Claude
  yozgan) — `f2ExactPayloadQur`ning NEEDS_REVIEW qoidasi: narxi bor-yu summasi yo'q
  BITTA qator butun partiyani to'xtatishimi? Test faylidagi 8 ta testni o'zing
  qayta o'qib, ular haqiqatan da'vo qilingan narsani isbotlaydimi (tautologik
  test emasmi) tekshir.
- `frontend/src/test02/TestF2Import.tsx`ning `yozish()` — F2 fayldan o'qilgan
  `summa` haqiqatan `certified_amount`ga boryaptimi, yoki oralig'ida yana biror
  joyda `hajm*narx` bilan almashtirilyaptimi (butun chaqiruv zanjirini kuzat).

### 2. Price Control — "накрутка EMAS" qonuni haqiqatan ushlanyaptimi?

- `supabase/migrations/20260921120000_t2_price_control_v1.sql` —
  `t2_price_basis_resolve_v1` write-time snapshot (`basis_approved_price_snapshot`,
  `reference_basis_line_id`) haqiqatan APPROVAL vaqtida muzlatilyaptimi, keyingi
  smeta revizyasi uni o'zgartira olmaydimi? Buni funksiya kodidan (READ vaqtida
  qayta hisoblanmasligini) tasdiqla.
- `price_state` 5 xil holat (`NORMAL`/`BELOW_REFERENCE`/`ABOVE_REFERENCE_JUSTIFIED`/
  `ABOVE_REFERENCE_MISSING_BASIS`/`ABOVE_APPROVED_BASIS`) — har biri REAL erishib
  bo'ladigan holatmi (Codex'ning ilgari topilgan "unreachable branch" bugidek
  yana bir joy bormi)? Owner'ning worked example'lari bilan qo'lda hisobla:
  ref=100/F2=80/qty=500→frozen=10000; ref=100/F2=120/protocol=115→ABOVE_APPROVED_BASIS.
- `frontend/src/test02/TestNarxNazorati.tsx` — kartalar (🔒/⚠/🔴/📄) haqiqiy
  ma'lumotga ulanganmi, yoki demo/statik qiymatmi?

### 3. Baseline/manifest yondashuvi (bu round, Claude yozmoqda)

`supabase/baseline/` papkasida Claude READ-ONLY schema introspection orqali
production'dan (production'ga hech qanday DDL/DML YO'Q, faqat SELECT) inventar
(jadval/funksiya/trigger/policy ro'yxati) yig'moqda, va bir `production_schema_baseline.manifest.json`
tayyorlamoqda. Tekshir:
- Manifest'dagi `included_migrations` ro'yxati HAQIQATAN production'ning
  `list_migrations` natijasiga mos keladimi (Claude hisobotidagi raqamlarni
  o'zing Supabase MCP orqali qayta so'ra, qiyosla).
- Claude "BASELINE_EXPORT_TOOL_REQUIRED" deb pg_dump/psql yo'qligi sababli to'liq
  DDL export QILMAGANINI aniq yozganmi, yoki buni yashirib "baseline tayyor" deb
  yolg'on da'vo qilganmi?

## QAT'IY CHEKLOVLAR

- Bu lane **READ-ONLY / AUDIT-ONLY**. Kod yozish/o'zgartirish YO'Q (agar aniq bug
  topsang — kodni O'ZGARTIRMA, topilmani yoz, Claude/Codex tuzatadi).
- Production'ga hech qanday yozish (DDL/DML) — audit faqat mavjud migration
  fayllarini va (agar Supabase MCP mavjud bo'lsa) READ-ONLY SELECT orqali.
- `main`ga hech narsa YO'Q.

## Report

`ops/handoff/T2_LRV_CLOSURE_006_ANTIGRAVITY_PREAUDIT_RESULT.md` — har band uchun
PASS/FAIL/PARTIAL + aniq kod-sitata (fayl:qator) bilan dalil. Xulosa:
"FINAL_READY: NO (Tree V2 + isolated DB hali yo'q)" — bu qat'iy, bu lane FINAL'ni
o'zgartirmaydi, faqat integratsiya qilingan qismning sifatini erta tekshiradi.
