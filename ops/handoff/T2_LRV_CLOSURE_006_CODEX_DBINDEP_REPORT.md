# T2-LRV-CLOSURE-006-CODEX-DBINDEP — Codex hisobot

## Chegara

Bu branch DB-independent. Production Supabase, migration, `sb-yoz` whitelist,
GAS va `frontend/src/umumiy/daraxt/**` o'zgartirilmaydi.

## Qo'shimcha/Zamena klient kontrakti

`frontend/src/api/t2-additional-replacement.ts` uchta faqat-tayyorlov
wrapperini beradi: `sbT2QoshimchaIshYarat`, `sbT2ZamenaIshYarat`,
`sbT2ResursBolaQosh`. Har birida `operationId` va `expectedVersion` majburiy.
Ular `/api/sb-yoz`ga taklif qilingan amal nomlari bilan murojaat qiladi, lekin
server RPC/whitelist hali yo'q. Demak bu UI ga ulanmagan kontrakt, tayyor
backend deb talqin qilinmaydi.

Taklif qilingan RPC signaturelari: `qoshimcha_ish_yarat_v1`,
`zamena_ish_yarat_v1`, `resurs_bola_qosh_v1`. Isolated DB qabulidan keyin
Claude tomonidan kanonik qilib tasdiqlanishi kerak.

## Catalog ingestion parseri

`frontend/src/lib/catalog-ingest/` pure adapter: BL dan work-type, RS/MAT/OB
dan resource observation hosil qiladi. Har yozuv o'z company/object/document
scope ini saqlaydi. Auto-link faqat bitta company ichidagi yagona exact
`code + name + unit` mosligida mumkin. Birlik/nom farqi, yo'q moslik yoki bir
necha nomzod `candidate_review`/`unmatched` bo'lib qoladi. Price canonical
qiymatga ko'chirilmaydi va boshqa objectga uzatilmaydi.

## Tekshiruv

- Unit testlar: DB va tarmoqsiz wrapper payload hamda parser/match kontrakti.
- DB write/read: NOT_TESTED (bu branch ataylab DB ga ulanmaydi).
- Backend RPC: NOT_IMPLEMENTED (isolated DB qabulidan keyingi Claude lane).
