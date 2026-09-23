# T2 PTO Tender Oferta — Codex handoff

## Holat

- **Vazifa:** PTO tender oferta uchun asl RES/ABC/TN faylini saqlagan holda deterministik narxlash va eksport.
- **Egasi:** Codex, alohida ishchi kompyuter.
- **Bazaviy commit:** `ec28b61271a56192fe88b0e63816abb15cc57a5c`
- **Branch:** `codex/t2-tender-oferta-v1`
- **MAIN/PRODUCTION:** tegilmadi.

## O‘zgarmas biznes qoidasi

1. **Asl fayl — yagona hujjat manbasi.** Foydalanuvchi yuklagan workbook qayta qurilmaydi; mavjud varaqlar, qatorlar, nomlar va manba qiymatlari saqlanadi.
2. **Yangi format yo‘q.** Eksport faqat tanlangan RES yoki transport varag‘ining o‘ng tomoniga ikki ustun qo‘shadi: `Pudratchi birlik narxi` va `Pudratchi taklif summasi`.
3. **Rol nomdan emas, mazmundan aniqlanadi.** LRV, RES va transport varaq rollari sarlavha, birlik, hajm, narx, summa va transport belgilarining kombinatsiyasi bilan aniqlanadi; nom faqat dalil sifatida ishlatiladi. Yakuniy tanlov foydalanuvchi tasdig‘idan keyin qilinadi.
4. **Kod bo‘lmagan RES satri ham haqiqiy satr.** Resurs nomi, birlik, hajm yoki manba summasi mavjud bo‘lsa, shifr bo‘shligi sababli yo‘qotilmaydi.
5. **`JAMI` resurs emas.** `JAMI/ИТОГО/ВСЕГО` nazorat yoki subtotal sifatida saqlanadi, alohida narxlanmaydi. `smetaJami` va `ofertaJami` faqat narxlanadigan barg satrlarini hisoblaydi.
6. **Sklad/transport agregatlari hajmga ko‘paytirilmaydi.** Ular manbada berilgan umumiy summa yoki aniq qo‘lda kiritilgan agregat summa asosida hisoblanadi; aks holda 20 mlrd → 38 mlrd kabi ikki marta hisoblash paydo bo‘ladi.
7. **Noma’lum qiymat nolga aylantirilmaydi.** Yetishmayotgan hajm, narx yoki manba summa xato holati sifatida qoladi.
8. **Bir xil RES va RES_A ikki marta qo‘shilmaydi.** Mazmunan bir xil varaq alternativ nusxa sifatida belgilanadi; boshqa paketga tegishli, mazmuni farqli varaq esa mustaqil tanlanadi.

## Amalga oshirilgan qismlar

- `frontend/src/lib/tender-oferta.ts` — foizli va qo‘lda narxlash, resurs/`JAMI`/sklad/transport rollari, jami va double-count himoyasi.
- `frontend/src/lib/tender-oferta-parser.ts` — ABC/TN/LRV mazmuniy tahlili, kodsiz resurslar, bo‘limlar, ichki `JAMI`, transport agregatlari va alternativ varaqlar.
- `frontend/src/lib/tender-oferta-export.ts` — aynan yuklangan `.xls/.xlsx/.xlsm` faylni saqlab, faqat tanlangan RES/transport varaqlariga ikki ustun va Excel formulalarini qo‘shish.
- `frontend/src/admin/sahifalar/OfertaNative.tsx` — `/admin/oferta` sahifasi, varaq roli dalillari, foydalanuvchi tanlovi, foiz/qo‘lda narx rejimi va asl fayl eksporti.
- `frontend/src/App.tsx` va `frontend/src/admin/AdminShell.tsx` — ruta va menyu.
- `frontend/src/lib/f2-import-parse/xlsxReader.ts` — real LRV_PLUS `.xlsx` fayllarda OOXML o‘quvchi ishlamasa, mavjud SheetJS yordamida xavfsiz o‘qish fallback’i.

## Haqiqiy fayllar bilan tekshiruv

- ABC tipidagi `Copy_of_2436...xls`: `RES` va `RES_A` topildi, `RES_A` mazmuniy alternativ sifatida ikki marta hisobdan chiqarildi, LRV alohida qoldi.
- TN tipidagi transport fayli: transport satrlari `manba_jami` sifatida ajratildi; ular hajm × narx qilib noto‘g‘ri ko‘paytirilmaydi.
- `doroga_LRV_PLUS (1).xlsx`: LRV sifatida o‘qildi; avvalgi `Blob.stream` muammosi fallback orqali yopildi.

## Tekshiruvlar

- TypeScript: PASS.
- Build: PASS.
- To‘liq Vitest: PASS — 75 fayl, 516 test.
- Oferta/parser/export/xlsxReader fokus testlari: PASS — 4 fayl, 20 test; generic bo‘lim qamrovi regressiyasi qo‘shildi.
- Lint: PASS, yangi xatolar yo‘q; qolgan ogohlantirishlar avvaldan mavjud.
- `npm run tekshir`: PASS.
- `git diff --check`: PASS.
- Governance check: yakuniy handoffdan oldin ishga tushiriladi.

## Chegara

Bu branch faqat manba RES/ABC/TN faylini taklif narxlashga tayyorlashni qo‘shadi. Supabase, GAS, R2, production migratsiya, `main` va Cloudflare production deploy bu vazifada o‘zgartirilmagan.

## Integratsiya

Claude ushbu branchni ko‘rib, `integration/next-main-release-v1`ga alohida integratsiya qilishi mumkin. Integratsiyadan keyin Preview’da `/admin/oferta` orqali real ABC/TN fayllar bilan smoke test qilinadi.
