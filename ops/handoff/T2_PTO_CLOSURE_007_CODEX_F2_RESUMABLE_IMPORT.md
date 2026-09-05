# T2-PTO-CLOSURE-007-CODEX-F2-RESUMABLE-IMPORT

**Rol:** Implementation engineer (Codex)
**Branch:** yangi, `codex/t2-f2-resumable-import-v1` — base:
`origin/integration/next-main-release-v1`
**Nega HOZIR xavfsiz**: bu ish HAM hech qanday kanonik route'ning DEFAULT
xatti-harakatini o'zgartirmaydi — faqat `/admin/f2`dagi "Yangi (GAS'siz)
rejim" flag YONIQ bo'lgandagina ta'sir qiladi (flag hali default O'CHIQ).

## Kontekst — nega bu ANIQ shu ish

Sen o'zing to'g'ri aniqlagan 4 ta ochiq muammo bor edi: 20k-qator chegarasi,
50k-qator uchun durable job yo'qligi, draft/mapping saqlanmasligi, R2 fayl
saqlash yo'qligi. Bularning HAMMASINI birdan "tahlil qilish" KERAK EMAS —
faqat BITTASI, aniq tugaydigan holatda.

`supabase/migrations/20260922120000_t2_f2_import_job_v1.sql` allaqachon
mavjud (boshqa vazifadan meros, sarlavhasida "SOURCE ONLY — NOT applied to
production. NOT reviewed" deb yozilgan). Bu fayl aynan shu muammoni hal
qilish uchun mo'ljallangan: `t2_f2_import_job` (resumable job, `cursor`
checkpoint bilan) + `t2_f2_import_draft_qator` (durable per-row draft) +
4 ta RPC (`t2_f2_import_job_yarat_v1`, `_holat_v1`, `_ilgarilash_v1`,
`t2_f2_import_draft_saqla_v1`). Ular BUTUNLAY ishlatilmagan.

## Vazifa — aniq va yakuniy

1. **Migration'ni O'ZING qayta tekshir** (u "NOT reviewed" deb belgilangan):
   `t2_f2_import_job`/`t2_f2_import_draft_qator` sxemasi, RPC imzolari,
   idempotentlik (`operation_id`), optimistic lock (`p_expected_versiya`)
   mantig'ini o'qi. Agar to'g'ri deb top(sang) — SHU faylni ishlatasan
   (qayta yozmaysan). Agar xato top(sang) — tuzatib, nima uchun tuzatilgani
   `.acceptance.sql`da yoz.
2. **Production'ga qo'll** (hali qo'llanmagan — `list_migrations`da yo'q).
3. **`F2ImportNative.tsx`ga ulash**:
   - Hozirgi qattiq rad etish (`>15MB yoki >20000 qator`) o'rniga: fayl
     `t2_f2_import_job_yarat_v1` bilan JOB sifatida boshlanadi.
   - Fayl bo'laklarga (masalan 2000-5000 qatorlik) bo'lib qayta ishlanadi;
     har bo'lakdan keyin `t2_f2_import_job_ilgarilash_v1` chaqiriladi
     (`cursor` yangilanadi, `processed_rows`/`matched_rows` oshadi).
   - Har mos/qo'lda tuzatilgan qator `t2_f2_import_draft_saqla_v1` orqali
     DARHOL saqlanadi (localStorage FAQAT ikkinchi darajali kesh sifatida
     qolishi mumkin, hech qachon yagona manba emas).
   - Sahifa qayta ochilganda (yoki xato/tanaffusdan keyin): `t2_f2_import_
     job_holat_v1` orqali oxirgi `cursor`/`status` o'qiladi, ishlov ODDIY
     1-qatordan emas, checkpoint'dan DAVOM ETADI.
   - Yangi qattiq chegara (agar kerak bo'lsa) ancha kattaroq bo'lishi
     mumkin (masalan 100000 qator) — lekin BUTUNLAY olib tashlashning
     ILOJI yo'q, chunki brauzer xotira/vaqt cheklovi baribir bor; aniq
     yangi sonni O'ZING tanla va sababini hisobotda yoz.
4. **Yozish qonuni O'ZGARMAYDI**: hali ham FAQAT `t2_akt_yarat_v2`
   (`sbT2AktYaratV2`) orqali, `f2AggregatsiyaQator`/`f2ExactPayloadQur`
   orqali — bu vazifa FAQAT o'qish/progress/checkpoint qatlamini
   qo'shadi, EXACT SOURCE yozish mantig'ini o'zgartirmaydi.
5. **R2 fayl saqlash HAM Nakopitelniy HAM bu safar KIRMAYDI** — ataylab
   qamrovdan chiqarilgan (alohida keyingi lane, agar kerak bo'lsa). Buni
   hisobotda ochiq deb belgilab qo'y, lekin BU SAFAR QILMA.

## "Tugadi" mezoni (aniq, o'lchanadigan)

Sintetik `.xlsx` fayl ~30000 qator bilan yaratiladi (production'ga
yozilmaydi — faqat parser/job oqimi sinaladi). Shu fayl "Yangi (GAS'siz)
rejim" orqali yuklanadi va:
- Hozirgi kod bilan (bu branch'dan OLDIN) 20000 qator chegarasida RAD
  ETILGAN bo'lardi — endi RAD ETILMAYDI.
- Import jarayonida sahifa qayta yuklansa (simulyatsiya: state'ni qo'lda
  tozalab qayta ochish), oxirgi checkpoint'dan davom etadi — 1-qatordan
  emas.
- Yakuniy natija baribir F2ImportNative'ning mavjud qat'iy tekshiruvlariga
  bo'ysunadi (narx/summa yo'q qator — yozishni to'xtatadi, va h.k.).

Shu ssenariy ushbu branch'da AVTOMATIK test (mock bilan, DB'siz) + kamida
bitta qo'lda/sintetik-production sinovi bilan isbotlanishi SHART.

## QAT'IY CHEKLOVLAR

- Faqat shu bitta migratsiya (`t2_f2_import_job_v1`, agar tuzatsang xuddi
  shu fayl ustida) — boshqa hech qanday migratsiyaga tegma.
- `main`, GAS, Cloudflare deploy — tegma.
- Haqiqiy production ma'lumotiga (17521 qator) hech qanday yozish/
  o'zgartirish yo'q — faqat sintetik, tozalanadigan sinov.
- `TestF2Native.tsx`, `f2-match-engine/`, `f2-import-parse/`,
  `f2-exact-payload.ts` — mavjud pure mantiqqa TEGMA.
- **Yangi kashfiyot/tahlil/qayta audit YO'Q.** Muammolar allaqachon aniq —
  sen ularni ALLAQACHON to'g'ri tasvirlab bergansan. Bu vazifa faqat
  BITTASINI yopish uchun.

## Report

`ops/handoff/T2_PTO_CLOSURE_007_CODEX_F2_RESUMABLE_IMPORT_REPORT.md` —
migration qanday tekshirildi/tuzatildi, qanday ulandi, "tugadi" mezoni
qanday isbotlandi (aniq sonlar bilan: necha qator, checkpoint'dan qayta
tiklash sinovi natijasi), gates.
