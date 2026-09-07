# T2 overnight native core — mustaqil reconciliation checkpointi

**Sana:** 2026-09-07
**Rol:** mustaqil integrator/auditor
**Holat:** `SOURCE_RECONCILED`, main/productionga qo‘shilmagan

## Tekshirilgan manbalar

- **Integration baza:** `50e1fb72a81e187ba495865ce8515b13603dd9be`
- **Overnight Codex commit:** `472ddd896054fb4ba716a19a3f8cb6bf4a8be40b`
- **Overnight merge/main:** `eb190c4b1bb13a750e7aa19fb082b8636b167de8`
- **Integration Preview:** `https://a5db2041.smeta-tizimi.pages.dev`
- **Main Preview:** `https://d0cf4c36.smeta-tizimi.pages.dev`

Remote branchlar mustaqil `git ls-remote` bilan tekshirildi. Asl foydalanuvchi
worktree’si (unborn/dirty holat) o‘zgartirilmadi.

## Qaror

`472ddd8` to‘liq ko‘r-ko‘rona integratsiya qilinmadi. U o‘z branchida
kompilyatsiya va testlardan o‘tadi, lekin `50e`dagi keyingi native release
fixlarini va bridge ma’lumotni saqlash qonunlarini orqaga qaytaradigan aniq
regressiyalar bor. `472ddd8` tarixda va remote branchda saqlanadi; quyidagi
reconciliation branch faqat tasdiqlangan xavfsiz qismlarni oladi.

## Tasdiqlangan overnight natijalari

- Overnight native-core source oracle: **23/23 PASS**.
- Overnight full Vitest: **52 fayl, 263/263 PASS**.
- Overnight ilova va Functions typecheck: **PASS**.
- Overnight `npm run tekshir`: **PASS**, lekin u integration’dagi keyingi
  qamrovni to‘liq meros qilmaydi.

Bu dalillar source-level hisoblanadi; autentifikatsiyalangan owner vertical
smoke emas.

## Integratsiyaga rad etilgan regressiyalar

1. `frontend/functions/api/t2-bridge.ts`dagi overnight `projectionHash`
   qatorlarni saralamaydi. Sheet sort/reorder qilinsa, biznes qiymati
   o‘zgarmagan bo‘lsa ham xesh o‘zgaradi. Integration’dagi saralangan,
   to‘liq projection maydonlari saqlandi.
2. Overnight `T2Bridge.gs` `clearContent()` bilan butun Sheetni tozalab,
   proyeksiyani qayta yozadi. Bu qo‘lda kiritilgan boshqarilmaydigan ustunlar,
   eski ko‘rinadigan qatorlar yoki hali hal qilinmagan Sheet o‘zgarishlarini
   yo‘qotish xavfini tug‘diradi. ID bo‘yicha incremental merge saqlandi.
3. Overnight `fakt.write` gateway’i `qator_id` shu `obyekt_id`ga tegishli
   ekanini alohida tekshirmaydi. Integration’dagi `qatorVersion` query’si
   `qator_id + obyekt_id` juftligini tekshiradi va saqlandi.
4. Overnight `F2TayyorlashNative` F2 tarixiga o‘tish tugmasi va
   `useNavigate`ni olib tashlaydi. Bu foydalanuvchi workflow regressiyasi;
   integration’dagi navigatsiya saqlandi.
5. Overnight `hammasi.cjs` xavfsiz upstream-error, NULL-workbench va PTO
   visible-surface testlarini ro‘yxatdan chiqargan. Ular reconciliation’da
   qayta saqlandi; overnight branchdagi 263 test integration’dagi 277 test
   bilan teng qamrov emas.
6. Overnight bridge faqat qisqartirilgan beshta projection ustunini qaytaradi;
   amaldagi integration bridge’ning narx, qoldiq, F2 va nazorat maydonlari
   yo‘qolmasligi kerak.

## Qabul qilingan xavfsiz tuzatish

Reconciliation branchda amaldagi integration `T2Bridge.gs` saqlanib,
`t2BridgeTick()` atrofiga `LockService.getScriptLock()` qo‘shildi. Bu bir
vaqt triggerlari ustma-ust ishlaganda bir xil Sheet tahririni parallel
jo‘natish ehtimolini kamaytiradi. Kanyonik idempotency, actor va optimistic
version tekshiruvlari baribir Cloudflare/Supabase’da qoladi.

## Regression oracle

`frontend/testlar/t2_overnight_reconciliation.test.cjs` 15 ta tekshiruv bilan:

- native kundalik route’larda eski GAS requesti qaytmaganini;
- projection xeshi saralangan canonical IDdan foydalanishini;
- Fakt qatori obyekt ichida tekshirilishini;
- operation/base-version/error boundary saqlanganini;
- Sheet incremental ID merge ishlatishini va `clearContent()` yo‘qligini;
- NULL/identity/visible-surface regression testlari master suite’da qolganini

qo‘riqlaydi. Bu source oracle runtime owner smoke o‘rnini bosmaydi.

## Reconciliation gate’lari

Reconciliation branchda:

- ilova typecheck: **PASS**;
- Cloudflare Functions typecheck: **PASS**;
- build: **PASS**;
- native reconciliation oracle: **15/15 PASS**;
- GAS bridge stdin syntax check: **PASS**;
- Vitest baza: **53 fayl, 277/277 PASS**;
- `npm run tekshir`: **PASS**;
- `git diff --check`: **PASS**;
- governance: **PASS**, faqat tarixiy `CURRENT_STATE.main_sha` overnight
  `eb190c4`ni hali qayd qilmagani haqida warning bor.

## Taqiqlangan/tegmagan qatlamlar

- main va production push/deploy qilinmadi;
- Supabase migration yoki business data yozilmadi;
- Cloudflare secret/config o‘zgartirilmadi;
- GAS deploy qilinmadi;
- asl dirty/unborn worktree o‘zgartirilmadi;
- overnight branch qayta yozilmadi yoki force-push qilinmadi.

## Keyingi aniq qadam

Avval ushbu reconciliation branchni integration release owner ko‘rib chiqadi.
Authenticated owner smoke aynan integration Preview’da o‘tkazilmaguncha main
release “tayyor” deb belgilanmaydi. `replica.*` canonical commandlari esa
alohida contract/test bilan, mavjud file-truth RPC’lari bilan mosligi isbot
qilingandan keyin ko‘riladi; overnight’dagi qisqartirilgan bridge ularning
tayyor implementatsiyasi deb qabul qilinmaydi.
