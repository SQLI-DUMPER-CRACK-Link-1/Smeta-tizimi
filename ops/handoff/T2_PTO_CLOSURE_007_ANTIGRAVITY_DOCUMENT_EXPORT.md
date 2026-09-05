# T2-PTO-CLOSURE-007-ANTIGRAVITY-DOCUMENT-EXPORT

**Rol:** Implementation engineer (Antigravity)
**Katta ish** — egasi aniq aytdi: "katta ishlar bering, goal qilib beraman,
shu bilan ishlab yuraveradi". Bu mayda, bir soatlik vazifa EMAS —
bir necha bosqichli haqiqiy loyiha, o'zing ichki rejalashtirasan. Har
bosqichda ISHLAYDIGAN, TEST QILINGAN narsa qoldir — oxirigacha kutib
"bittada katta tashlash" qilma.

**Branch:** yangi, `codex/t2-document-export-v1` yoki
`antigravity/t2-document-export-v1` — base:
`origin/integration/next-main-release-v1`

**MUHIM KONTEKST (egasining 2026-09-05 qarori)**: repo ildizida
`docs/architecture/UZ_CONSTRUCTION_DOCUMENT_CATALOG_AND_TEMPLATES_V1.md`
hujjati bor. Egasi buni **ALLAQACHON yuristdan o'tgan, tasdiqlangan
shablon** sifatida qabul qilishni aytdi — yurist qidirib alohida kutish
SHART EMAS. Shu hujjatni BOSHIDAN OXIRIGACHA o'qi, ayniqsa:
- Bo'lim 4 — DOC-01..18 hujjat katalogi (ayniqsa DOC-12 Forma-3, DOC-13
  Nakopitelnaya vedomost, DOC-05/06 F-2 shakllari).
- TPL-05/06/07 — har hujjat turining ANIQ ustun/qator tarkibi.
- Bo'lim 9 — "tizim o'zidan to'qimasligi kerak" qonunlar ro'yxati
  (imzo/sertifikat o'ylab topilmaydi, soliq/QQS formulasi o'zi
  hisoblanmaydi — bular HALI HAM haqiqiy shartnoma ma'lumoti bo'lmasa
  `unknown`/`FORMA3_RULE_UNRESOLVED` bo'lib qoladi, bu qaror bilan
  BEKOR BO'LMAYDI).

## Nima uchun bu katta va real ish

Men (Claude) bugun `frontend/src/lib/construction-document-control/` va
`frontend/src/components/construction-document-control/` deb nomlangan,
BOSHQA sessiya tomonidan allaqachon qurilgan, ancha PUXTA subsystem
topdim: Nakopitelniy/F2/Closeout/Change-control hisob-kitob dvigateli
(`calculateProgressValuation`), to'liq test qamrovi bilan (5 ta test
fayl: workbench/document-fidelity/adversarial-release/large-data/
release-performance), va HAQIQIY, reachable, ishlaydigan sahifa:
`/admin/hujjat-nazorat` (`HujjatNazoratPage.tsx`, `AdminShell.tsx:34`da
navigatsiyada ko'rinadi — orphan route emas).

Men bugun shu dvigateldagi BITTA kichik bo'shliqni yopdim (TPL-07
"Holat" ustuni — normal/chegara/ortiqcha). Lekin KATTA bo'shliq ochiq
qoldi: **`ExportPreview.tsx`/`createExportPreview()` FAQAT ekrandagi
JSX xulosani ko'rsatadi — HAQIQIY yuklab olinadigan hujjat (Excel/Word,
TPL-05/06/07 aniq shakliga mos) HECH QAYERDA yaratilmaydi.** Bu —
missiya ro'yxatidagi "F2 hujjat generatsiyasi" bosqichining aynan
o'zi, va u hali qilinmagan.

## Vazifa — bosqichlar

**1-bosqich — Hujjat va mavjud dvigatelni chuqur o'rgan.**
- `UZ_CONSTRUCTION_DOCUMENT_CATALOG_AND_TEMPLATES_V1.md` TPL-05/06/07'ni
  ustun-ustun o'qi. Har biri UCHUN aniq qaysi maydon qayerdan kelishi
  kerakligini yoz (masalan TPL-07 "Bazaviy hajm" = `ProgressLineResult.
  baselineQuantity`, "Tasdiqlangan o'zgarish" = `approvedChangeQuantity`,
  h.k. — `frontend/src/lib/construction-document-control/types.ts`da
  ANIQ mos maydonlar bor, men buni bugun tekshirib chiqqanman).
- `calculation.ts`, `validation.ts` (`createExportPreview`,
  `closeoutJson`), 5 ta test faylini o'qi — bu dvigatel JUDA yaxshi
  ishlangan (idempotent, pure, frozen-history immutable, F2/actual/
  baseline narxlarni aralashtirmaydi). SEN BUNI QAYTA YOZMAYSAN —
  faqat undan hujjat yasaysan. Xato topsang — alohida, kichik, aniq
  PR bilan tuzat, katta refactor qilma.
- Qaysi kutubxona bilan `.xlsx` yaratish qulay ekanini tanla (masalan
  `exceljs` — hujayra formatlash, formula, shrift kerak bo'ladi, oddiy
  `xlsx`/`sheetjs` faqat yozish uchun kambag'alroq). Yangi dependency
  qo'shish MUMKIN (`npm install`), bu — qaytariladigan, oddiy amal.

**2-bosqich — Har hujjat turi uchun HAQIQIY generator.**
Uchtasini alohida, mustaqil qil (birma-bir tugat, hammasini birdan
boshlab, birontasini ham tugatmay qolib ketma):
- **Nakopitelnaya vedomost (TPL-07)** — `ProgressLineResult[]` dan
  TO'LIQ mos ustunlar bilan `.xlsx`. Bugun qo'shilgan `nakopitelniyHolat()`
  (`calculation.ts`)ni ISHLAT — qayta hisoblama.
  `NAKOPITELNIY_MISMATCH` reconciliation xatosi bo'lsa, hujjat baribir
  yaratiladi, lekin sahifada/hujjatda ANIQ ogohlantirish bilan (jim
  yashirilmaydi).
- **F-2 (progress akt)** — bitta davr uchun, joriy oy qatorlari.
- **Forma-3** — **QAT'IY**: `FORMA3_RULE_UNRESOLVED` hali ham HAQIQIY
  holat (soliq/QQS/tutib qolish formulasi shartnomadan olinmaguncha).
  Bu holatda hujjat YOKI yaratilmaydi (aniq xabar bilan) YOKI faqat
  jismoniy hajm/summa qismini chiqaradi, moliyaviy-huquqiy jamlarni
  BO'SH/`—` qoldiradi. Hech qanday QQS foizi, ushlab qolish foizi
  O'ZINGDAN TO'QIB CHIQARILMAYDI — bu 0-BOSHQA HUJJATDAN OLINMAGAN
  raqam qonundan tashqari.
- Har hujjat: sarlavha/kompaniya/obyekt/davr metama'lumoti, hujjat
  raqami (mavjud reestr naqshiga qara — GAS tomonda qanday raqamlangani
  uchun `Smeta tizimi/`dagi tegishli faylni o'qi, o'xshash konventsiya
  qo'lla).

**3-bosqich — UI'ga ulash.**
- `ExportPreview.tsx`ga (yoki yangi kichik komponentga) "Yuklab olish"
  tugmasi qo'sh — bosilganda generatorni chaqirib, brauzerda faylni
  saqlashga taklif qiladi (standart blob/download naqsh).
- `HujjatNazoratPage.tsx`/`ConstructionDocumentWorkbench.tsx`ga ulash —
  mavjud sahifaga QO'SHIMCHA, hozirgi ko'rinishni o'zgartirmasdan.

**4-bosqich — Testlar.**
- Har generator uchun: mavjud `navoi-park` fixture (`fixtures/navoi-park/
  acceptance.ts`) yoki `document-fidelity.ts` fixture'idan foydalanib,
  yaratilgan `.xlsx` faylni PARSE qilib (masalan `exceljs`ning o'zi
  bilan qayta o'qib) kutilgan qiymatlar bilan solishtiruvchi test yoz.
  "Fayl yaratildi, xato bermadi" YETARLI EMAS — HAQIQIY qiymatlar
  to'g'ri joyda ekanini tekshir.
- Forma-3 uchun alohida test: `FORMA3_RULE_UNRESOLVED` holatida hujjat
  soxta QQS/jami bilan YARATILMASLIGINI isbotlovchi test (bu ENG MUHIM
  test — soxta moliyaviy hujjat chiqarish oldini oladi).

## QAT'IY CHEKLOVLAR

- `calculation.ts`/`types.ts`/`validation.ts`dagi mavjud, sinalgan
  hisob-kitob mantig'iga TEGMA — faqat undan o'qi, natijani formatlab
  hujjat qil.
- Hech qanday moliyaviy/huquqiy raqam (QQS foizi, ushlab qolish foizi,
  soliq stavkasi) O'ZINGDAN TO'QILMAYDI — manba yo'q bo'lsa hujjatda
  ochiq `—`/`FORMA3_RULE_UNRESOLVED` qoladi.
- `main`, GAS, Cloudflare deploy — tegma.
- Production'ga DB yozish YO'Q — bu ish faqat MAVJUD o'qilgan
  ma'lumotdan fayl generatsiya qiladi, yangi jadval/RPC kerak emas
  (agar kerak bo'lib qolsa — ALOHIDA, kichik migratsiya, faqat shu
  uchun, va nega kerakligini hisobotda tushuntir).

## Report

`ops/handoff/T2_PTO_CLOSURE_007_ANTIGRAVITY_DOCUMENT_EXPORT_REPORT.md`
— har hujjat turi uchun holat (tayyor/qisman/sabab bilan qoldirilgan),
test dalili (haqiqiy qiymat solishtiruv bilan), gates.
