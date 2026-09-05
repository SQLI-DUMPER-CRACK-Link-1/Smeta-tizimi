# T2-PTO-CLOSURE-007-CLAUDE-RESURS-VEDOMOST

**Rol:** Implementation engineer (Claude) — egasining o'z so'rovi bo'yicha
uchinchi mustaqil goal (Codex — Narxlar cutover, Antigravity — hujjat
export, Claude — shu).

## Egasining so'rovi (2026-09-05, verbatim ma'no)

Hozirgi Forma-2/Nakopitelniy hujjatlarida yo'q, lekin bo'lsa chiroyli
bo'ladigan narsa: **butun smeta va F2'dan har bir KATEGORIYA (ЧЕЛ/МАШ/
МАТ/ОБ/КАБ/М-К) resurslarining yig'ma vedomosti**.

## Nima qilindi

- `frontend/src/lib/resurs-vedomost.ts` — pure, DB-mustaqil aggregatsiya:
  `resursVedomostQur()` (`t2_qator_holat` qatorlarini kategoriya+nom+
  birlik bo'yicha jamlaydi, faqat `tur in (rs,mat,ob)` — razdel/ish
  qatorlari chiqarib tashlanadi, aks holda ish narxi ikki marta
  hisoblangan bo'lardi) va `resursVedomostKategoriyalarga()` (kategoriya
  bo'yicha guruhlab, jami summalarni hisoblaydi).
  **Yangi hisob-kitob YO'Q** — `t2_qator_holat` (bu sessiyada certified_*
  ustuvorligini tuzatgan edim) allaqachon to'g'ri; bu fayl faqat
  mavjud haqiqatni jamlaydi.
- `frontend/src/admin/sahifalar/ResursVedomostNative.tsx` — o'z raqamli
  obyekt tanlovchisi bilan (Additional/Replacement'dagi kabi mustaqil,
  Holat.tsx'ning GAS-nom muammosidan chetlab o'tadi), kategoriya-kategoriya
  jadval, qidiruv.
- `Holat.tsx`ga ikkinchi yopiq/ixtiyoriy `<details>` bo'lim sifatida
  qo'shildi (Additional/Replacement bilan bir xil naqsh) — mavjud
  oqimga hech narsa o'zgartirmaydi.
- `T2QatorHolat` TypeScript tipi tuzatildi: `tur`/`kod`/`birlik`/`kat`
  maydonlari YO'Q edi, holbuki `t2_qator_holat` SQL view'i ularni
  ALLAQACHON qaytaradi (migratsiya SQL'idan to'g'ridan-to'g'ri
  tasdiqlandi). Bu — `T2Qator.versiya` bilan bo'lgani kabi, TS tipi
  DB sxemasidan orqada qolgan xato.

## Gates holati (HALOL)

- `oxlint` — toza.
- `vitest` (maqsadli, `resurs-vedomost.test.ts` + `ResursVedomostNative.
  test.tsx`) — 10/10 o'tdi.
- **`tsc -b` va `vite build` — bu safar TEKSHIRILMADI.** Mashina hozir
  3 agent (Claude+Codex+Antigravity) bir vaqtda katta ishlar ustida
  ishlayotgani sababli xotira tanqisligida (6 marta ketma-ket
  "Fatal process out of memory" — Windows commit-limit darajasida,
  V8'ning o'z heap chegarasi emas). Buning o'rniga QO'LDA tekshirdim:
  `T2QatorHolat` kengaytirilgan yagona xavfli o'zgarish edi — `grep`
  bilan BARCHA ishlatilgan joylarni tekshirdim, hech qayerda bu tip
  uchun to'liq literal (barcha maydon talab qilinadigan) qurilish yo'q,
  faqat funksiya parametri/qaytish tipi sifatida ishlatiladi — xavfsiz.
  **Keyingi imkoniyatda `tsc -b`/`vite build`ni albatta qayta ishga
  tushirib tasdiqlash kerak** — bu hozircha ochiq qoldirilgan yagona
  band.

## Keyingi qadam (o'zim yoki keyingi sessiya uchun)

- Xotira bo'shaganda `npx tsc -b` va `npx vite build`ni qayta ishga
  tushirib, ushbu hisobotni "TO'LIQ TASDIQLANDI" deb yangilash.
- Antigravity'ning hujjat-export ishi tugagach, "resursiy vedomost"ni
  ham TO'RTINCHI hujjat turi sifatida yuklab olinadigan formatga
  qo'shish mumkin (bu fayl shuning uchun tayyor poydevor) — lekin bu
  ALOHIDA, kelajakdagi qaror, hozir shart emas.
