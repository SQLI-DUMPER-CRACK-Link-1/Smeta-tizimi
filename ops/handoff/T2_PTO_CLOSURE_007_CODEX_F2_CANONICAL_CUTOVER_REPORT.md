# F2 kanonik cutover — Codex

BASE: 0ce99a6e88591b14260c013e9428f00cf7dd691a
BRANCH: codex/t2-f2-canonical-cutover-v1

## Bajarildi

- `/admin/f2`: localStorage `t2-f2-native-mode`, default OFF. Mavjud
  komponent tanasi F2ImportLegacy nomi bilan aynan saqlandi; test git
  bazasiga solishtiradi. Yangi rejimning o'z raqamli obyekt tanlagichi
  bor; bir vaqtda faqat bitta rejim/tanlagich render bo'ladi.
- Yangi oqim mavjud readXlsx/f2FaylOqiCore va `/api/f2-moslash`ni ishlatadi.
  Fayl brauzerda o'qiladi, matcher Cloudflare'da. Yangi matcher yozilmadi.
- Varaq/ustun/davrni foydalanuvchi tekshiradi. Bosqichlar ko'rinadi.
  15 MB fayl va 20 000 varaq/smeta qatori chegarasi bor.
- Yozish faqat sbT2AktYaratV2. Narx/summa matcher natijasidan olinmaydi;
  manba kataklari mustaqil tekshiriladi. Parent+child ikki marta hisoblanmaydi.
- F2PreapprovalAudit, ixtiyoriy 50-qatorli bog'lanish tafsiloti, foydalanuvchi
  tekshirganini tasdiqlash, source snapshot, qayta urinishda barqaror operation_id.
- Kompaniya almashganda komponent/import holati yangilanadi. Eski asinxron
  o'qish javobi yangi kompaniya holatiga tushmaydi. Payload/provenance O(n).

## Mantiqiy topilmalar va cheklovlar

1. Mavjud parser bo'sh/noto'g'ri raqamni 0 qiladi. Yangi adapter asl
   katakdan raqamni qat'iy tekshiradi; parseFloat('123abc') qabul qilinmaydi.
2. Shared f2AggregatsiyaQator `summaBor: !!s` sabab nol summani yo'q deb
   biladi, f2ExactPayloadQur esa narx bo'lmasa avtomatik intentional-absent
   qiladi. Bu fayllarga tegish taqiqlangan. Shu sabab yangi rejim nol/yo'q
   narx yoki summani fail-closed bloklaydi. Nol hujjat summasi qonuniy
   bo'lishi mumkin; qo'llab-quvvatlash uchun shared kontrakt tuzatilishi kerak.
3. Turli narxlar bir canonical qatorga tushsa yozish bloklanadi; narxlar
   orasidan birinchisini jim tanlash yo'q. Moslashmagan qatorlar ham yozishni
   bloklaydi. Qo'lda qayta bog'lash UI'i hali yo'q.
4. Parser nol hajmli qatorlarni chiqarib tashlaydi. Bu shared parserning
   qolgan cheklovi; ushbu branch uning xatti-harakatini o'zgartirmaydi.
5. Jonli authenticated Preview va haqiqiy XLSX bilan ushbu yangi ekran
   hali sinalmagan. R2 fayl arxivi va resumable job shu lane'da yo'q.

## Tekshiruvlar

- TypeScript (app + Functions), build, lint (0 error), tekshir PASS.
- To'liq Vitest: 37 fayl / 213 test PASS; keyin qo'shilgan 2 ekran testi
  alohida PASS (jami 215). Ekran testi mocked I/O, production dalili emas.
- Legacy tana aynan saqlanishi, source 1234.49, yo'q qiymat, turli narx,
  noto'g'ri raqam, no-match, kompaniya almashish, V2 retry tekshirildi.
- governance-check va git diff --check PASS.

CLAUDE_REVIEW: tayyor.
READY_FOR_OWNER_DAILY_USE: NO — yuqoridagi source kontrakt cheklovlari,
qo'lda bog'lash va authenticated Preview dalili qolgan.
Production/main/GAS/Cloudflare: tegilmadi.
