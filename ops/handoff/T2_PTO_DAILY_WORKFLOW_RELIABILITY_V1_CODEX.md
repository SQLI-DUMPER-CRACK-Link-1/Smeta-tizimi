# T2 PTO DAILY WORKFLOW RELIABILITY V1 — CODEX HANDOFF

**Holat:** manba va xavfsiz sxema qatlamlari tayyor; main/production integratsiyasi bu handoffda bajarilmadi.

## Bazaviy holat

- **BASE:** `origin/main`dagi `7a49befb611408c8b39ebd8e564465eb423b61bf` asosida ochilgan ishchi tarmoq.
- **BRANCH:** `codex/t2-daily-workflow-reliability-v1`.
- **IMPLEMENTATION HEAD:** `8c7cf3b8fb1dcdfe9601b48936f6670ba3552afb` (`feat(t2): harden PTO daily canonical workflow`). Handoffni qayd etgan yakuniy hujjat commiti shu tarmoq uchida undan keyin keladi.
- **INTEGRATION:** `origin/integration/next-main-release-v1` `46a68a3c11c146b41e03f3f2344712348dde0490`; ishchi tarmoq undan oltita keyingi hujjat/fiks commitini ham o‘z ichiga oladi.
- **MAIN:** shu ish doirasida o‘zgartirilmagan.

## Ishonchli kundalik yo‘l

1. **Obyekt → smeta:** `SmetaYuklaNative` XLSX manbasini avval xususiy R2 va hujjat reyestriga yozadi, keyin `t2_smeta_import_bulk_v1` orqali kanonik `t2_qator` daraxtini yaratadi. To‘ldirilgan obyektni jim ustidan yozmaydi.
2. **LRV/Fakt:** `sbT2TreeQur` raqamli `t2_qator.id` va `ota_id` bilan ishlaydi; fakt hajmi, qoldiq va F2 mumkin qiymati kanonik o‘qish modelidan olinadi. Manba qiymati yo‘q bo‘lsa `null` saqlanadi va UI `—` ko‘rsatadi.
3. **F2:** native tayyorlash/import oqimi eski GAS tayyorlovchisiga tayanmaydi; aniq miqdor, sertifikatlangan narx va manba summasi alohida saqlanadi. Tasdiqlanmagan akt LRVga kirmaydi.
4. **F2 tarixi:** `/admin/f2-tarix` reestr va qator tafsilotlarini ko‘rsatadi, faqat qoralama aktni tasdiqlash komandasi orqali o‘tkazadi. Tasdiqlangan tarix qayta hisoblab yozilmaydi.
5. **Narx nazorati:** `t2_qator_holat` o‘qish modelida smeta narxi, fakt/F2 narxi va narx farqi alohida maydonlar bilan uzatiladi; noma’lum qiymat nolgacha yashirilmaydi.
6. **Qo‘shimcha/zamena/resurs:** native sahifalar mavjud kanonik API portlari bilan ulanadi; zamena eski qator nomini o‘zgartirmaydi, yangi qatorni alohida munosabat sifatida ko‘rsatadi. Resurs vedomosti BL va bolalarni ikki marta sanamaslik uchun barglar bo‘yicha guruhlanadi.
7. **Nakopitelniy/Forma-2:** rollup faqat `holat='tasdiqlangan'` F2dan quriladi; qoralama hujjat tarixiy jami yoki F2 mumkin qiymatini kamaytirmaydi. Forma-3 uchun yangi huquqiy formula kiritilmadi.

## Jonli Supabase o‘zgarishi

- Manba migratsiya: `supabase/migrations/20260906130000_t2_lrv_approved_f2_rollup_v1.sql`.
- Supabase loyihasi: `tuoyrzadkgoltpqkdiyx`.
- Tool tomonidan jonli katalogga qayd etilgan versiya: `20260906141808`, nomi `t2_lrv_approved_f2_rollup_v1`.
- Read-only qabul tekshiruvi: `LRV_APPROVED_F2_ROLLUP_ACCEPTANCE_PASS`.
- Migratsiya faqat view/read-modelni yangiladi; biznes qatorlariga INSERT/UPDATE/DELETE bajarilmadi.
- Jonli tekshiruvda: `t2_qator=17521`, `t2_akt=1`, `t2_akt_qator=0`, tasdiqlangan F2 aktlari `0`, qoralama F2 aktlari `1`.

## Ko‘prik va fayl haqiqat manbai

- Canonical arxitektura saqlandi: Supabase — metama’lumot/biznes haqiqat manbai, R2 — xususiy binary haqiqat manbai, Drive/Sheets — ikkilamchi replika, GAS — asinxron ko‘prik.
- `R2_CANONICAL` binding konfiguratsiyasi mavjud; public canonical bucket ishlatilmaydi.
- T2 ko‘prigida yashirin kanonik ID, entity versiyasi, projection hash va holat maydonlari bor. Hash biznes qiymatlari va versiyani qamraydi; faqat obyekt IDsi yoki qator soniga tayanmaydi.
- Ko‘prikning Sheets tomoni hali egasi tomonidan real jadvalda yoqilmagan va haqiqiy ikki tomonlama sinovdan o‘tmagan. Shuning uchun Sheets kundalik tayyorligi `NO`.
- Google ko‘prigini yoqish bo‘yicha aniq qo‘llanma `docs/TIZIM_02_GOOGLE_BRIDGE_SETUP.md`da yangilandi.

## Xavfsizlik va xatolar

- Tasdiqlash serverda tekshirilgan sessiya aktori, kanonik akt kompaniyasi va a’zolik roli bilan cheklangan; `operation_id` majburiy va named RPCga uzatiladi.
- R2 upload, smeta import, hujjat finalize va XLSX o‘qish xatolari ichki PostgREST/parser matnini klientga qaytarmaydi.
- `SESSIYA_KALIT`, GAS tokenlari va boshqa secretlar o‘zgartirilmadi; qiymatlar logga chiqarilmadi.
- `sbT2TreeQur` uchun null regressiya testi qo‘shildi: yo‘q smeta/narx/qoldiq qiymati nolga aylantirilmaydi.

## Gate dalillari

- TypeScript (`npx tsc -b`): **PASS**.
- Build (`npm run build`): **PASS**; faqat mavjud `/grid.svg`, katta bundle va ineffective dynamic import ogohlantirishlari bor.
- Vitest: **52 fayl, 271/271 PASS**; Windows worker xotira qulashi kuzatilmadi (`--pool=forks --maxWorkers=1`).
- Lint: **PASS**, 0 ta xato; mavjud ogohlantirishlar saqlangan.
- `npm run tekshir`: **PASS**, `BUG_FOUND=0`.
- `node ops/governance-check.cjs`: **PASS** (`4 required files, 29 tasks`).
- `git diff --check`: **PASS**.

## Tayyorlik chegarasi

- **READY_FOR_WEBSITE_DAILY_USE: NO** — native yo‘l manba jihatdan tayyor va lokal gate’lar yashil, lekin aynan shu commit bilan egasining autentifikatsiyalangan to‘liq sayt sinovi va Cloudflare production deploy verifikatsiyasi bu ishda bajarilmadi.
- **READY_FOR_SHEETS_DAILY_USE: NO** — ko‘prik kodi va qo‘llanma tayyor, ammo Google jadvalida owner activation hamda real round-trip sinovi yo‘q.
- **MAIN/PRODUCTION:** tegilmadi.

## Davom ettirish uchun aniq uchta ish

1. Shu tarmoq commitini integratsiyaga olib, Cloudflare Preview’da autentifikatsiyalangan vertical-slice smoke qilish: login → obyekt → smeta → fakt → F2 import/tarix → narx nazorati → resurs/nakopitelniy.
2. Preview smoke yashil bo‘lsa, mavjud release runbook bo‘yicha main va production deployni faqat deployed SHA bilan tekshirib yakunlash.
3. Owner Google ko‘prigini qo‘llanmaga ko‘ra yoqib, bitta xavfsiz fakt o‘zgarishi bilan Sheet → Bridge → canonical Supabase → qayta projection round-tripini tasdiqlashi.
