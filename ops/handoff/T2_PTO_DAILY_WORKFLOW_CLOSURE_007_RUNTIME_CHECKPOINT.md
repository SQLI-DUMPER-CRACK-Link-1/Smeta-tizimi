# 2026-09-06 — so‘nggi native PTO release checkpointi

## Masofaviy release dalili

- `origin/integration/next-main-release-v1`: `46a68a3c11c146b41e03f3f2344712348dde0490`.
- `origin/main` governance checkpointi: `6d64f66d7cbe71fc3a145b86bc1de505a8de1f0d`.
- Cloudflare Pages deploy `97676085.smeta-tizimi.pages.dev` aynan `6d64f66` commitidan muvaffaqiyatli yaratilgan.
- `/` va `/admin/fakt` HTTP 200; `/api/soglik` HTTP 200 va `service_role` rolini qaytardi.
- Anonim `/api/sessiya` va `/api/hujjat-royxat` so‘rovlari 401 bilan fail-closed ishladi.
- R2 binding `R2_CANONICAL` private `smeta-tizimi-canonical` bucketiga ulangan.
- To‘liq autentifikatsiyalangan biznes smoke egasining real sessiyasini talab qiladi; bu muhitda parol yoki cookie saqlanmagan.

## Yangi yopilgan uzilish

- Candidate: `f527200a0ce119086ea9c38c43e96c5dbc850ed4`.
- `t2_fakt_belgila_v2` production katalogga `20260906120454` sifatida additive
  qo‘llandi. Bu sxema va RPC qo‘shilishi bo‘lib, real biznes qatorlariga test
  yozuvi kiritilmadi.
- Fakt native sahifasida avvalgi `Ustiga qo‘shish` oqimi saqlandi va alohida
  `Jami qiymat` oqimi qo‘shildi. Jami tahrir serverdagi kanonik joriy qiymatni
  expected qiymat bilan solishtiradi; boshqa sessiya qiymatni o‘zgartirgan
  bo‘lsa, `FAKT_CONFLICT` xavfsiz xabar bilan ko‘rsatiladi va ma’lumot qayta
  yuklanadi.
- Gateway allowlist `fakt_belgila_v2` ni faqat nomlangan
  `t2_fakt_belgila_v2` RPC’ga bog‘laydi; actor so‘rov tanasidan olinmaydi.
- Regressiya testi: `FaktNative.test.tsx` 3/3; standart qo‘shish, jami
  optimistic update va conflict xabari qamrab olingan.

## Gate dalili

- `npx tsc -b --force` — PASS.
- `npm run typecheck:functions` — PASS.
- `npx vitest run --pool=threads --maxWorkers=1 --no-file-parallelism` — 52
  fayl, 263 test, PASS.
- `vite build` — PASS; Windows xotira bosimi sabab CPU-affinity bilan qayta
  ishga tushirilgan, mahsulot xatosi aniqlanmadi.
- `npm run lint` — 0 error, faqat mavjud warninglar.
- `npm run tekshir` — PASS.
- `node ops/governance-check.cjs` — PASS.

## Chegara

Bu candidate Cloudflare Production’ga chiqarilguncha oldingi deploy holati
saqlanadi. F2 tasdiqlash, F2 eksporti va tarixiy F2 qiymatlari bu o‘zgarishdan
ta’sirlanmaydi; Fakt jami faqat kanonik Fakt hujjati orqali o‘zgaradi.

# T2 PTO kundalik oqim — 2026-09-06 runtime checkpoint

## Tayanch

- Release checkpointi: `5edc7f31bc2536f69f7a555348479fd8de46ded2`; native UI kodi `a755cec5bfb6da9d9652f3c7242b4eefc8f98492` commitida.
- Branchlar: `codex/t2-daily-native-lrv-v1`, `origin/integration/next-main-release-v1` va `origin/main` shu kod holatida.
- Ish prinsipi: eski GAS biznes mantiqi ko‘chirilmaydi; T2 native oqim canonical Supabase/R2 contractidan foydalanadi.

## Bajarilgan va tekshirilgan oqim

- Obyektlar → kanonik raqamli `t2_obyekt.id`.
- LRV → `t2_qator` va `t2_qator_holat` o‘qishlari, Smeta/Fakt/F2 ko‘rsatkichlari.
- Fakt → native `t2_fakt_yoz_v2`, operation ID va server-side tenant tekshiruvi.
- F2 tayyorlash → Fakt qoldig‘i, exact source quantity/price/amount, qoralama va Forma-2 Excel.
- F2 import → native import job/draft yo‘li va deterministic matching.
- Narx nazorati → `t2_price_control_v1` read model.
- Qo‘shimcha/Zamena/Resurs → mavjud native RPC wrapperlar va optimistic version bilan ishlaydigan panel.
- Resurs vedomosti → `t2_qator_holat`dan kategoriya bo‘yicha derived ko‘rinish.
- Canonical fayl oqimi → R2 private binding va Supabase document registry.

## 2026-09-06 integratsiya o‘zgarishi

`HolatNative` endi tanlangan kanonik obyekt kontekstida quyidagi panellarni birlashtiradi:

1. Smeta XLSX yuklash;
2. Qo‘shimcha ish / Zamena / Resurs qo‘shish;
3. Resurs vedomosti;
4. Narx nazorati.

Panellar `details` yopiq paytda mount qilinmaydi. Shu sabab har bir panel o‘zicha
obyekt qidirib, boshqa obyekt ma’lumotini ko‘rsatmaydi va yopiq holatda ortiqcha
network o‘qishi sodir bo‘lmaydi.

## Dalil

- `npm run build` — PASS.
- `npx tsc -b --force` — PASS.
- `npx vitest run --pool=threads --maxWorkers=1 --no-file-parallelism` — 51 fayl, 260 test, PASS.
- `npm run lint` — xatosiz; mavjud warninglar bor.
- `npm run tekshir` — barcha tekshiruvlar PASS.
- `node ops/governance-check.cjs` — PASS.
- Production `/api/soglik` — avvalgi deployda `ok=true`, Supabase/R2/auth konfiguratsiyasi mavjudligi tasdiqlangan.

## Hali dalil talab qiladigan chegaralar

- Real egasining authenticated production smoke sessiyasi bu muhitda bajarilmadi.
- Google Bridge kodi tayyor, lekin real Sheet triggerlari faollashtirilmagan; shu sabab
  `READY_FOR_SHEETS_DAILY_USE` hali `NO`.
- Eski T1 GAS modullari repositoryda compatibility sifatida qoladi, lekin ular T2
  kundalik canonical route uchun fallback sifatida ishlatilmaydi.

## Keyingi ish

Keyingi alohida milestone: `T2-GAS-EXIT-001` — qolgan core GAS dependencylarini
inventory qilib, faqat deterministik shared engine orqali bosqichma-bosqich chiqarish.
