# T2-LRV-CLOSURE-006-ANTIGRAVITY-PREAUDIT-RESULT

**Rol:** Independent auditor (Antigravity)
**Holat:** PRE-AUDIT (Final emas)

## Xulosa
**FINAL_READY: NO** (Tree V2 + isolated DB hali yo'q). Bu qat'iy holat. Ushbu hisobot faqat hozirgacha integratsiya qilingan qismlar sifatini erta tekshirishdan iborat.

Oldingi `ops/handoff/T2_*_ANTIGRAVITY.md` hujjatlarim saqlab qo'yildi va `integration/next-main-release-v1` ga push qilindi.

---

## 1. F2 EXACT-SOURCE QONUNI — P0

### 1.1 `certified_amount` ustuni GENERATED emasligi
**Natija: PASS**
- **Dalil:** `supabase/migrations/20260920120000_t2_akt_qator_certified_v1.sql` (satr ~45): `add column if not exists certified_amount numeric,`. U hecham `GENERATED ALWAYS AS (hajm*narx)` deb berilmagan.
- **Trigger ishlashi:** `t2_akt_qator_certified_freeze_v1` (satr ~72) qat'iy tekshiradi: `a.holat = 'tasdiqlangan'` bo'lsa, xato beradi (`errcode = '23514'`). 

### 1.2 `t2_akt_yarat_v2` RPC va Smeta narxiga qaytmaslik qonuni
**Natija: PASS**
- **Dalil:** `supabase/migrations/20260920130000_t2_akt_yarat_v2.sql`. Kodda `MISSING_CERTIFIED_PRICE` (satr ~74) va `MISSING_CERTIFIED_AMOUNT` (satr ~81) aniq ushlangan. Agar bittagina qatorda `price_intentionally_absent` yo'q bo'lsa va narx yuborilmasa, butun batch rad etiladi.
- **Smeta narxi fallback yo'q:** Butun SQL kodida smeta narxidan o'qib olish (fallback) mantig'i mavjud emas.

### 1.3 `frontend/src/test02/f2-exact-payload.ts` + `.test.ts`
**Natija: PASS**
- **Dalil:** `f2-exact-payload.test.ts` faylidagi 8 ta test mustaqil tekshirildi. Ayniqsa 3-test ("the worked example..."): 
`{ uid: 'a', hajm: 10, narx: 123.45, summa: 1234.49 }` yuborilgan, natijada `.certifiedAmount` aynan `1234.49` ga tengligini va aritmetik mahsulotga (`1234.50`) teng Emasligini tekshiradi (`expect(...).not.toBe(...)`). Test tautologik emas, aynan biznes qonunini tasdiqlaydi.

### 1.4 `TestF2Import.tsx` UI
**Natija: PASS**
- **Dalil:** `TestF2Import.tsx` faylida F2 faylidan olingan `summa` to'g'ridan-to'g'ri `f2ExactPayloadQur(rows)` orqali backend'ning `certified_amount` maydoniga yetkazilmoqda, hech qanday `hajm*narx` bilan o'zboshimchalik qayta hisoblash kuzatilmadi.

---

## 2. PRICE CONTROL — "QO'YILGAN QONUNLAR"

### 2.1 Write-time snapshot approval paytida muzlashi
**Natija: PASS**
- **Dalil:** `supabase/migrations/20260921120000_t2_price_control_v1.sql` migratsiyasida `t2_akt_qator_certified_freeze_v1_trg` trigeri KENGAYTIRILGAN. Triger ichiga `new.reference_basis_line_id` va `new.basis_approved_price_snapshot` qo'shilgan, ya'ni tasdiqlangandan so'ng bu maydonlarni ham o'zgartirish qat'iyan taqiqlangan (`23514` xatolik). Bu ularning o'qish (READ) vaqtida smeta reviziyasi orqali o'zgarib ketishiga ishonchli to'sqinlik qiladi.

### 2.2 `price_state` 5 xil holati mantig'i
**Natija: PASS**
- **Dalil:** `t2_price_control_v1` (satr ~170-177) kodida `case` bloklari mustaqil hisob-kitob orqali tasdiqlandi. Misollar:
  - *ref=100/F2=80/qty=500*: `pl.certified_price_approved (80) < pl.reference_price_approved (100)`. Bu `BELOW_REFERENCE` natijasini beradi. `frozen_amount = (100 - 80) * 500 = 10 000`. (Muzlagan summa to'g'ri keldi).
  - *ref=100/F2=120/protocol=115*: `pl.certified_price_approved (120) > pl.basis_price_approved (115)`. Natija: `ABOVE_APPROVED_BASIS`.
Bu barcha stsenariylar real erishiladigan xavotirsiz yozilgan, hech qanday "unreachable branch" (o'lik kod) yo'q.

### 2.3 `TestNarxNazorati.tsx` ma'lumoti ulanishi
**Natija: PASS**
- **Dalil:** `TestNarxNazorati.tsx` komponentini o'rganib chiqdim (satr ~32). U yerda `priceControlOl(obyektId)` API'si (real backend call) ishlatilgan va natijadan to'g'ridan-to'g'ri `x.frozen_amount`, `x.at_risk_amount` larni jamlab (`reduce`) UI'ga ko'rsatmoqda. Bu demo/statik ma'lumot emas.

---

## 3. BASELINE / MANIFEST YONDASHUVI

### Claude'ning hisoboti
**Natija: PASS (Yolg'on aralashtirilmagan, holat to'g'ri izohlangan)**
- **Dalil:** `ops/handoff/T2_LRV_CLOSURE_006_CLAUDE.md` hujjatida Claude "production_schema_baseline.manifest.json tayyor" deb **yolg'on da'vo qilmagan**. Aksincha, u `BASELINE_REQUIRED` ekanligini yozgan: migratsiyalar papkasida asosiy `CREATE TABLE` komandalar yo'qligi sababli, egasining ruxsatisiz production DB ga ulanib sxemalarni o'g'irlash yoki ad-hoc baza tuzish mumkin emasligini ochiq aytgan. Claude rostdan ham "DB-independent" (isolated DB siz) cheklovini qat'iy saqlab qolgan va ishonchni suiiste'mol qilmagan.
