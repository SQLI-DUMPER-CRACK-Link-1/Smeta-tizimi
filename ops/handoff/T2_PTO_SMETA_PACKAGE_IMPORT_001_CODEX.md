# T2-PTO-SMETA-PACKAGE-IMPORT-001 — Codex handoff

## Maqsad

Bitta obyektning 4 ta uchastkasi va EO qismi kabi ko'p mustaqil LRV/RES
manbasini bir marta, kanonik va izchil import qilish. Bu `bitta fayl = bitta
obyekt` taxminini yo'qotadi, ammo `t2_qator`ni yagona qator haqiqati sifatida
saqlaydi.

## Nega eski yo'l yetarli emas

`t2_smeta_import_*_v1` faqat bitta `source_document_id` qabul qiladi va
obyektda birinchi qator paydo bo'lgach `SMETA_ALREADY_EXISTS` qaytaradi.
Shuningdek `t2_document_registry` avval `(company, project, object,
document_type)` bo'yicha revision qilgani uchun beshta LRVni bir xil
`smeta` turida saqlash ularni bir-birining revisioniga aylantiradi.

## Yangi kontrakt

- `t2_smeta_paket` — obyektning boshlang'ich smeta paketi.
- `t2_smeta_paket_manba` — har bir uchastka/EO bo'lagi; uning yagona LRV
  kanonik hujjati bor.
- `t2_smeta_paket_res_manba` — RES hujjati aynan qaysi bo'lakka tegishli
  ekanini saqlaydi. Global RES narxlash yo'q.
- `t2_qator.smeta_paket_manba_id` hamda mavjud `source_document_id` har
  kanonik qatorning qaysi LRV manbasidan kelganini saqlaydi.
- `source_slot_key` R2 reyestrida LRV/RES hujjatlarini bo'lak bo'yicha
  revisionlaydi. Boshqa bo'laklar bir-birini `superseded` qilmaydi.
- `t2_smeta_paket_import_*_v1` paketni bo'laklab qabul qiladi, oxirida bitta
  transaction ichida `t2_qator`ga yozadi. Bitta qator/manba xato bo'lsa,
  hech qanday qator ko'rinmaydi.

## Frontend oqimi

`SmetaYuklaNative.tsx`da eski bitta XLSX oqimi saqlangan. Uning ostidagi
**Ko'p faylli smeta paketi** oqimi:

1. Operator bitta tanlovda barcha LRV faylini qo'shadi yoki obyektning
   butun papkasini tanlaydi. Papka yo'li kanonik identifikator emas: tizim
   har XLSX ichidagi varaq mazmunidan LRV/RES turini aniqlaydi.
2. RES fayllarini qo'shadi; papkadan topilgan alohida RES ham shu ro'yxatga
   keladi.
3. Har RES faylini tegishli uchastka/EO bo'lagiga dropdown orqali biriktiradi.
   Tanlanmagan RES importni bloklaydi; narx boshqa bo'lakka taxminan
   tarqatilmaydi.
4. Har manba R2ga alohida slot sifatida yuklanadi.
5. Paket RPC qatorlarni o'z manba identifikatori bilan atomik yozadi.

Bir XLSX ichida LRV + RES varaqlari bo'lsa, ichki RES faqat o'sha XLSX/LRV
bo'lagiga qo'llanadi. Alohida RES hujjati faqat operator biriktirgan bo'lakka
qo'llanadi.

## O'zgargan fayllar

- `frontend/src/lib/smeta-package-import.ts`
- `frontend/src/lib/smeta-package-import.test.ts`
- `frontend/src/admin/sahifalar/SmetaYuklaNative.tsx`
- `frontend/functions/api/smeta-yukla.ts`
- `frontend/functions/api/hujjat-yukla.ts`
- `supabase/migrations/20261025090000_t2_smeta_paket_import_v1.sql`
- uning `.acceptance.sql` va `PRE-USE ONLY` `.rollback.sql` fayllari.

## Tekshiruvlar

- `npx tsc --noEmit -p tsconfig.app.json` — PASS.
- `npx tsc --noEmit -p tsconfig.functions.json` — PASS.
- Paket/unit + mavjud RES testlari — 50/50 PASS.
- `npx vite build` — PASS.
- `npm run lint` — yangi error yo'q; avvaldan mavjud warninglar bor.
- `npm run tekshir` — PASS.
- Production sxemasiga hech narsa saqlanmagan: migration + acceptance
  `BEGIN … ROLLBACK` ichida mavjud production sxemasida kompilyatsiya qildi.

Windowsdagi to'liq `tsc -b`/to'liq Vitest ishga tushirishida umumiy Node
jarayonlari sabab native `Zone` xotira xatosi kuzatildi. Alohida app/functions
type gate, fokus testlar, Vite build va `tekshir` muvaffaqiyatli yakunlandi.

## Qasddan keyinga qoldirilganlar

- Faol paketdagi bitta bo'lakni revision sifatida almashtirish. Bu qatorlarni
  o'chirish emas, Change Control/approved revision oqimi bilan bo'lishi kerak.

## Deploy holati

Bu feature branch source holatida. Migration productionga qo'llanmagan,
Cloudflare deploy qilinmagan, `main`ga tegilmagan.
