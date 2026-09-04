# T2-LRV-CLOSURE-006-CODEX-PREAPPROVAL-UI — Codex hisobot

## Qilingan ish

`F2PreapprovalAudit` Step 2 (moslashtirish) ichida faqat F2 uchun qo'shildi.
U `aktBarglar` va mavjud `getSmetaId`dan `f2AggregatsiyaQator()` hamda
`f2IstisnolarniAniqla()` orqali istisnolarni oladi.

- `NEEDS_REVIEW`: yozish to'xtashini aniq aytadi.
- `ARITHMETIC_MISMATCH`: faqat analitik signal; hujjatdagi summa UI tomonidan
  hisoblanmaydi, yozilmaydi va tuzatilmaydi.
- `NEGATIVE_HAJM`: pererraschyot/qaytarilgan ish ehtimoli sifatida ko'rsatiladi.
- Istisno bo'lmasa, faqat halol toza-holat xabari chiqariladi; yuzlab qatorlar
  render qilinmaydi.

## Chegara

`f2-exact-payload.ts` va uning testlari o'zgartirilmadi. `yozish()` mantig'i,
DB, RPC, migration va production o'zgartirilmadi. Yangi panel read-only.

## Tekshiruv

- `f2-preapproval-audit.test.ts`: pure grouping kontrakti.
- Mavjud `f2-exact-payload.test.ts`: istisno aniqlash qonuni.
- Focused Vitest: 2 suite, 18 test PASS (16 mavjud exact-payload testi va 2
  yangi UI-helper testi).
- TypeScript, build, lint, `npm run tekshir`, `git diff --check` va governance
  check PASS.
- Lint/build chiqishidagi avvaldan mavjud ogohlantirishlar yangi F2
  preapproval kodi bilan bog'liq emas.
