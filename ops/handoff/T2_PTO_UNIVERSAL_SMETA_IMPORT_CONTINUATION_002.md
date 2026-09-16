# T2-PTO-UNIVERSAL-SMETA-IMPORT-CONTINUATION-002

## Vazifaning yagona maqsadi

PTO operatori bir obyektning boshlang'ich smetasini turli haqiqiy Excel
tuzilmalaridan xavfsiz import qila olsin:

- LRV va RES alohida fayllarda bo'lishi mumkin;
- LRV va RES bitta XLSX ichida, bir nechta varaqlarda bo'lishi mumkin;
- bitta obyekt 4 uchastka va EO qismi kabi bir necha LRV manbasidan iborat
  bo'lishi mumkin;
- RESning shifri bo'lmasligi mumkin;
- TN qurilish hamda ABC4ga o'xshash sarlavha tuzilmalari qabul qilinishi
  kerak.

Tizim fayl yoki varaq nomiga ishonib qatorlarni import qilmaydi. U mazmun,
sarlavha, birlik, hajm, narx va RES bo'limlari asosida **aniq tahlil** beradi.
Operator tahlilni ko'rib tasdiqlamaguncha import boshlanmaydi.

## Ishchi checkout

- Ishchi papka: `C:\Temp\GAS-main-release-20260916`
- Branch: `codex/pto-smeta-package-import-v1`
- Hozirgi HEAD: `7b4539112a385e83b7dc8ce11a7b00489781f28c`
- Remote Preview: `https://codex-pto-smeta-package-impo.smeta-tizimi.pages.dev`
- `main`ga tegilmagan.
- `governance.log` untracked. Uni stage yoki commit qilish taqiqlangan.

## Rasm bilan tasdiqlangan real holat

Operatorning to'rtta yo'l uchastkasi XLSX fayli papka orqali tanlandi. UI
ularni 4 LRV manbasi hamda har birining 2 ta ichki RES varag'i sifatida
ko'rsatdi. Bu detektorning dastlabki signali ishlayotganini isbotlaydi.

Lekin import tugmasidan keyin quyidagi xato chiqdi:

```text
«1уч-к.5.05.xlsx» kanonik R2 manba hujjati sifatida qabul qilinmadi (PGRST202)
```

Bu browser yoki R2 xatosi emas. Preview kod `source_slot_key` yuborgani
uchun `/api/hujjat-yukla` yangi
`t2_document_canonical_reserve_slot_v1` RPCini chaqiradi. Production
Supabase'da `20261025090000_t2_smeta_paket_import_v1.sql` hali qo'llanmagan;
shuning uchun PostgREST RPCni topmayapti va `PGRST202` qaytaryapti.

## Bajarilgan ishlar

Quyidagilar source branchda mavjud:

1. Ko'p-faylli paket kontrakti va `t2_qator`ning yagona haqiqat bo'lib
   qolishi.
2. Har LRV/RES binary uchun alohida R2 logical slot. Bir uchastka hujjati
   boshqasini revision qilib yubormaydi.
3. RES faqat o'z LRV manbasiga biriktiriladi. Bitta tashqi RES ikki manbaga
   biriktirilishi validator orqali bloklanadi.
4. Paket import oxirida atomik yoziladi. Bir bo'lak xato bo'lsa yarim
   `t2_qator` holati chiqmaydi.
5. Papka tanlash (`webkitdirectory`) mavjud.
6. Paket modeli uchun 50 ta fokus test va app/functions TypeScript, Vite,
   lint, `tekshir`, governance tekshiruvlari o'tgan.

Tegishli fayllar:

- `frontend/src/admin/sahifalar/SmetaYuklaNative.tsx`
- `frontend/src/lib/smeta-package-import.ts`
- `frontend/src/lib/smeta-package-import.test.ts`
- `frontend/functions/api/hujjat-yukla.ts`
- `frontend/functions/api/smeta-yukla.ts`
- `supabase/migrations/20261025090000_t2_smeta_paket_import_v1.sql`
- `supabase/migrations/20261025090000_t2_smeta_paket_import_v1.acceptance.sql`
- `supabase/migrations/20261025090000_t2_smeta_paket_import_v1.rollback.sql`

## Hali bajarilishi shart bo'lgan P0 ishlar

### P0-1. Bitta aniq additive migrationni qo'llash

Faqat quyidagi migrationni Supabase project
`tuoyrzadkgoltpqkdiyx`ga qo'llash:

```text
supabase/migrations/20261025090000_t2_smeta_paket_import_v1.sql
```

`apply_migration` tranzaksiyani o'zi boshqargani uchun SQLning faqat boshidagi
`begin;` va oxiridagi `commit;` qatorlari olib tashlanadi. Boshqa matn
o'zgartirilmaydi. Boshqa pending migrationlarga tegilmaydi.

Keyin read-only tekshiruv:

- `t2_document_canonical_reserve_slot_v1` mavjud;
- `t2_smeta_paket_import_boshla_v1`, `bolak_v1`, `yakunla_v1` mavjud;
- `t2_document_registry.source_slot_key` mavjud;
- paket jadvallarida RLS yoqilgan;
- acceptance faylidagi `SMETA_PACKAGE_ACCEPTANCE_PASS` tekshiruvini
  ma'lumot qoldirmaydigan transaction ichida o'tkazish.

Bu migration faqat schema, indeks, funksiya, RLS va execute grant qo'shadi.
U mavjud biznes qatorlarini update/delete qilmaydi.

### P0-2. Universal varaq tahlili va operator tasdig'i

Hozirgi paket UI faqat `1 LRV varaq / 2 RES varaq` sonini ko'rsatadi.
Bu yetarli emas: operator varaq nomini, detektor sababini va kerak bo'lsa
tanlovni tuzata olishi shart.

Yangi pure modul yaratiladi, tavsiya etilgan joy:

```text
frontend/src/lib/smeta-source-analysis.ts
```

U quyidagilarni qaytarsin:

```ts
type SmetaSheetRole = 'lrv' | 'res' | 'ignore' | 'unknown';
type SmetaSheetAnalysis = {
  sheetName: string;
  detectedRole: SmetaSheetRole;
  confidence: 'high' | 'medium' | 'needs_review';
  selectedRole: SmetaSheetRole;
  evidence: string[];
  columns: F2ColumnConfig;
};
```

Detektor faqat deterministic, ko'rinadigan dalillar asosida ishlasin:

- LRV: ish/hajm nomi, birlik, hajm hamda summa/narx sarlavhalari;
- RES: resurs bo'lim sarlavhalari, nom/birlik/narx ustunlari, ko'p narxli
  resurs satrlari;
- shifr bo'lmasa ham nom + birlik + narx + RES bo'lim kombinatsiyasi;
- title, cover, izoh va hisob-kitob varag'i `unknown`/`ignore` bo'lsin;
- noaniq varaq hech qachon yashirin LRV yoki RESga aylantirilmasin.

`f2-import-parse/columnDetect.ts` sarlavha sinonimlarini TN va ABC4 uchun
ehtiyotkor kengaytirish mumkin: `шифр/обоснование/kod`,
`наименование работ и затрат`, `ед. изм.`, `количество/объем`,
`цена/стоимость`, `сумма/итого`. Bunda mavjud F2 parser testlari buzilmasin.

`SmetaYuklaNative.tsx`da paket uchun har fayl ichidagi har bir varaqni
ko'rsatadigan "Tahlil va tasdiqlash" jadvali bo'lsin:

- fayl va varaq nomi;
- tizim taxmini va dalili;
- operator tanlovi: `LRV`, `RES`, `E'tiborsiz`;
- yuqori/medium/noaniq belgi;
- LRV manba ichidagi RES avtomatik ravishda **faqat o'sha manbaga**
  biriktiriladi;
- tashqi RES uchun operator aynan qaysi LRV manbasi ekanini dropdown orqali
  tanlaydi;
- folder/yo'l faqat yordamchi ko'rsatma. U hech qachon kanonik bog'lash
  qoidasi emas.

Tahlil yoki tanlov o'zgarsa `tasdiqlandi=false` bo'lsin. Import faqat
operator "Tahlilni tasdiqlash" tugmasini bosgandan keyin faollashsin.
Noaniq varaqni import qilishdan oldin operator uni `LRV`, `RES` yoki
`E'tiborsiz` qilib aniq belgilashi shart.

### P0-3. Testlar

Pure tahlilga quyidagi Vitestlar qo'shilsin:

1. TN uslubidagi LRVni LRV deb topish.
2. ABC4 uslubidagi LRVni LRV deb topish.
3. Shifrsiz RESni RES deb topish.
4. Bitta XLSXdagi LRV + ikki RES varag'i.
5. Cover/izoh varag'i `unknown` yoki `ignore` bo'lishi.
6. Noaniq varaq avtomatik importga kirmasligi.
7. Bir RES ikki LRVga biriktirilmasligi.
8. Ichki RES boshqa manbaga o'tmasligi.
9. Tasdiqlashdan oldin import bloklanishi.

Shuningdek mavjud paket testlarida source-keylar kesishmasligi va qatorlar
yarim yozilmasligi saqlansin.

## Haqiqiy manba fayllari

Yo'l uchastkalari manbalari:

```text
C:\Users\PC\Desktop\Park Chizmalar UZB\Смета ФАРАВОН.ЯНГИ УЗБ.20.07.26г\1.дор.ч\1уч-к.5.05.xlsx
C:\Users\PC\Desktop\Park Chizmalar UZB\Смета ФАРАВОН.ЯНГИ УЗБ.20.07.26г\1.дор.ч\2уч-к.5.05.xlsx
C:\Users\PC\Desktop\Park Chizmalar UZB\Смета ФАРАВОН.ЯНГИ УЗБ.20.07.26г\1.дор.ч\3уч-к.5.05.xlsx
C:\Users\PC\Desktop\Park Chizmalar UZB\Смета ФАРАВОН.ЯНГИ УЗБ.20.07.26г\1.дор.ч\4уч-к.01.07.xlsx
```

ABC4 namunasi:

```text
C:\Users\PC\Downloads\Defektniy_Akt_ABC4_Shablon.xlsx
```

Ularni faqat read-only tahlil va parser testlarini tushunish uchun ochish
mumkin. Real biznes fayllarini Preview orqali import qilib doimiy qator
yaratish operatorning importdagi yakuniy tasdig'isiz bajarilmaydi.

## Majburiy yakuniy gate

1. App TypeScript.
2. Functions TypeScript.
3. Tegishli Vitestlar, keyin xotira barqaror parametr bilan to'liq Vitest.
4. `npm run lint`.
5. `npm run tekshir`.
6. `node ops/governance-check.cjs`.
7. `git diff --check`.
8. Feature branch pushidan keyin yangi Cloudflare Preview SHA va UI
   yuklanishini tekshirish.
9. PGRST202 yo'qolganini harmless runtime probe bilan tekshirish. Real
   biznes fayl importini foydalanuvchi oxirgi UI tasdig'isiz boshlamaslik.

## Qat'iy chegaralar

- `main`ga merge/push qilinmasin, bu task feature Preview bilan tugaydi.
- Hech qanday boshqa pending Supabase migration qo'llanmasin.
- Mavjud LRV/F2 biznes matematikasini UI ichida qayta hisoblash mumkin emas.
- Shifr yo'qligi importni rad etish sababi emas.
- File nomi yoki papka nomi RES bog'lashning yagona dalili bo'la olmaydi.
- `governance.log` commit qilinmasin.

---

## 2026-09-16 yakuniy bajarilish qaydi

### Supabase P0-1 — qo'llandi, chegaralangan scope

`tuoyrzadkgoltpqkdiyx` projectiga **faqat**
`20261025090000_t2_smeta_paket_import_v1.sql` qo'llandi. Source migration
fayli o'zgartirilmadi: `apply_migration` uchun faqat tashqi birinchi `begin;`
va yakuniy `commit;` olib tashlangan nusxa yuborildi. Boshqa pending migration
qo'llanmagan.

Post-apply katalog dalili:

- `t2_document_canonical_reserve_slot_v1`,
  `t2_smeta_paket_import_boshla_v1`,
  `t2_smeta_paket_import_bolak_v1`,
  `t2_smeta_paket_import_yakunla_v1` — **mavjud**;
- `t2_document_registry.source_slot_key` — **mavjud**;
- `t2_qator.smeta_paket_manba_id` provenance ustuni — **mavjud**;
- besh paket jadvalida RLS yoqilgan, to'rt command RPC uchun `service_role`
  execute granti mavjud;
- source acceptance SQL `begin; ...; rollback;` ichida exceptionlarsiz
  o'tdi. Hech qanday acceptance ma'lumoti qolmadi.

Supabase Management API migration tarixida source fayl nomi
`20261025090000_t2_smeta_paket_import_v1` sifatida saqlangan, lekin boshqaruv
API yozgan version `20260916164046`. Bu API metadata xususiyati; uni
"to'g'rilash" uchun qo'shimcha production mutatsiya qilinmadi.

Bu dalil PGRST202 ildiz sababini yo'q qiladi: `source_slot_key` bilan chaqirilgan
RPC endi production schema katalogida bor. Real authenticated upload probe
qilinmadi, chunki operator tasdig'isiz real biznes XLSXni persistent import
qilish qat'iyan taqiqlangan.

### P0-2/P0-3 — source checkpoint

Source implementation commit: `dbb7600738b447604b50aa56b37418623a67ffff`

- `SmetaYuklaNative.tsx` paketni fayl-darajasidan **har bir XLSX varag'i**
  darajasiga o'tkazdi: `tahlil → operator role/target tanlovi → tasdiq →
  import`.
- `smeta-source-analysis.ts` TN va ABC4 LRV signallari, RES bo'limlari hamda
  shifrsiz `nom + birlik + narx` RES satrlarini deterministik tahlil qiladi.
  Fayl/papka nomi hech qachon canonical binding emas.
- Noma'lum varaqning roli bo'sh qoladi va u operator `LRV`, `RES` yoki
  `E'tiborsiz` tanlamaguncha importdan chiqarilgan.
- Ichki RES faqat shu workbook ichidagi LRV manbasiga birikadi; tashqi RES
  esa dropdown orqali **aynan bitta** LRV manbaga biriktiriladi.
- `smetaPaketTasdiqImzosi` analysis/role/target/source-key snapshotidir:
  tahlil yoki tanlov o'zgarsa import qayta tasdiqlanmaguncha bloklanadi.
- Random paket-scoped `sourceKey` ishlatiladi; display filename faqat UI
  label. Duplicate source key va bir RESning noto'g'ri targeti validator bilan
  fail-closed qilinadi.

Yangi testlar:

- `frontend/src/lib/smeta-source-analysis.test.ts` — 8 Vitest: TN LRV,
  ABC4 LRV, shifrsiz RES, cover/izoh, ichki/tashqi RES isolation,
  tasdiq/analysis invalidation, source-key collision.
- fokuslangan Vitest: `58/58` PASS
  (`smeta-source-analysis`, `smeta-package-import`, `SmetaYuklaNative`).
- `npx tsc -b`, `npm run typecheck:functions`, `npm run lint`, `npm run build`,
  `npm run tekshir`, `node ops/governance-check.cjs`,
  `node tizim02/registr.gen.cjs --tekshir`, `git diff --check` — PASS.
  Lint faqat repo bo'ylab oldindan bor warnings chiqardi; error yo'q.

### Hostdagi real manba cheklovi

Quyidagi user ko'rsatgan Windows yo'llari ushbu hostda `NOT_FOUND` edi:

- `C:\Users\PC\Desktop\Park Chizmalar UZB\Смета ФАРАВОН.ЯНГИ УЗБ.20.07.26г\1.дор.ч\`
- `C:\Users\PC\Downloads\Defektniy_Akt_ABC4_Shablon.xlsx`

Shu sabab real biznes binarysi bu hostda ochilmadi yoki import qilinmadi.
Fixturelar struktural test orqali qoplandi. Previewdagi haqiqiy operator
tasdig'idan keyingi import navbatdagi xavfsiz acceptance bosqichidir.

### Release chegarasi

- `main`ga merge/push qilinmadi.
- Boshqa production migration qo'llanmagan.
- `governance.log` stage/commit qilinmagan.
- Branch pushidan so'ng Preview route load va deployment SHA alohida
  tekshiriladi; ushbu handoffning keyingi commitida qayd qilinadi.
