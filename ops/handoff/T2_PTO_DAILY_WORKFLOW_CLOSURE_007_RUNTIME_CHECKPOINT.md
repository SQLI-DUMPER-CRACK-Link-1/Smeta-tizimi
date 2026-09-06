# T2 PTO kundalik oqim — 2026-09-06 runtime checkpoint

## Tayanch

- Release checkpointi: `9ee8462d4695eff44203faee6f8ad1430fb1d890`; native UI kodi `a755cec5bfb6da9d9652f3c7242b4eefc8f98492` commitida.
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
