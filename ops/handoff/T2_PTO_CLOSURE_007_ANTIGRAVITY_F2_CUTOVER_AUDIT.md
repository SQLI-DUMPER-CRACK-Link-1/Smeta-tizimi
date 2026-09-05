# T2-PTO-CLOSURE-007-ANTIGRAVITY-F2-CUTOVER-AUDIT

**Rol:** Independent auditor (Antigravity)
**Holat:** Read-only/audit-only. Claude bu branch'ni mustaqil ko'rib
chiqmoqda (parallel) — sen ALOHIDA, undan mustaqil tekshir, keyin
ikkalamiz natijani solishtiramiz.

## Nima tekshirish kerak

`origin/codex/t2-f2-canonical-cutover-v1` (HEAD `161d5c9`) — F2 import
kanonik `/admin/f2` sahifasiga "Yangi (GAS'siz) rejim" feature-flag'i.
Egasi tanlagan strategiya: bosqichma-bosqich (eski yo'l ESKI QOLADI, yangi
yo'l ixtiyoriy tugma orqali).

Fayllar: `frontend/src/admin/sahifalar/F2Import.tsx` (o'zgargan),
`F2ImportNative.tsx` (yangi), `F2ImportNative.test.ts` (yangi),
`F2ImportNative.ui.test.tsx` (yangi).

## Aniq tekshiruv ro'yxati (Codex'ning o'z so'ziga ishonmasdan)

1. **Flag O'CHIQ holatda eski xatti-harakat HAQIQATAN o'zgarmaganmi?**
   Codex o'z testida (`F2ImportNative.test.ts`, "legacy komponent tanasi
   o'zgarmagan") `git show 0ce99a6:...`dan olingan ESKI kod bilan
   `F2ImportLegacy` funksiyasi tanasini SATRA-SATR solishtiradi. Buni
   o'zing QAYTA tekshir: `F2Import.tsx`ni o'qi, `F2ImportLegacy`
   funksiyasining ichini `0ce99a6` commit'idagi asl `F2Import`ning ichi
   bilan qo'lda solishtir (yoki xuddi shu diff mantig'ini o'zing ishga
   tushir). Bitta ham qator farq bo'lmasligi kerak.
2. **`t2_akt_yarat_v2` ishlatilganmi (legacy `t2_akt_yarat` EMAS)?**
   `F2ImportNative.tsx`da `sbT2AktYaratV2` import qilinganini va
   `sbT2AktYarat` (v1) HECH QAYERDA ishlatilmaganini tasdiqla.
3. **Manba summasi haqiqatan o'zgarmasdan saqlanadimi?**
   `exactWrite()` funksiyasini o'qi — `f2AggregatsiyaQator`/
   `f2ExactPayloadQur` (allaqachon mavjud, sinalgan pure funksiyalar)ni
   chaqiradi, o'zi qty*narx hisoblamaydi. `F2ImportNative.ui.test.tsx`dagi
   testni diqqat bilan o'qi: fetch mock'i ATAYLAB NOTO'G'RI
   `summa:999999, narx:999999` qaytaradi (matcher javobidan), va test
   yakuniy yozuv `certifiedAmount: 1234.49, certifiedUnitPrice: 123.45`
   (haqiqiy FAYL qiymatlari) bilan chaqirilganini tasdiqlaydi. Bu —
   "matcher qaytargan narx/summa manba emas" degan izohning haqiqatan
   amalda ekanligini isbotlaydi. O'zing solishtirib tasdiqla.
4. **Moslashtirilmagan yoki ziddiyatli qator jim o'tkazib
   yuborilmaydimi?** `exactWrite()`dagi tekshiruvlarni ko'r: mapping'da
   yo'q uid, narx/summa yo'q/nol, ko'p-narx ziddiyati — barchasi
   `throw` qiladi (yozishni TO'XTATADI), jim tashlab ketmaydi. Bunga mos
   6 ta test bor `F2ImportNative.test.ts`da — ularning har biri
   HAQIQATAN da'vo qilingan holatni sinaydimi (tautologik emasmi)
   tekshir.
5. **Kompaniya almashganda eski obyekt tanlovi tozalanadimi?**
   `F2ImportNative.ui.test.tsx`ning 2-testini o'qi va mantiqini tasdiqla
   (`key={joriy.id}` orqali `NativeSession` butunlay qayta yaratiladi —
   `F2ImportNative` komponentining oxirgi qatoriga qara).
6. **O'zing gates'ni QAYTA ishga tushir** (alohida worktree/checkout,
   Claude'ning yoki Codex'ning natijasiga ishonmasdan):
   `npx tsc -b`, `npx tsc -p tsconfig.functions.json`,
   `npx vitest run frontend/src/admin/sahifalar/F2ImportNative.test.ts
   frontend/src/admin/sahifalar/F2ImportNative.ui.test.tsx`,
   `npx oxlint frontend/src/admin/sahifalar/F2Import*.tsx`.

## Codex o'zi ochiq qoldirgan narsalar — bularni HAM tasdiqla (yoki rad et)

Codex o'z hisobotida shuni aytgan: "mavjud parser/yordamchilarda nol
qiymatlarni noto'g'ri talqin qilish bor — yangi rejim bunday yozuvlarni
bloklaydi" va "qo'lda moslashtirish va jonli Preview tekshiruvi hali
qolgan". Sen buni tekshir: `exactWrite()` HAR qanday narx=0 yoki
summa=0/undefined holatini yozishni butunlay TO'XTATADI (`f2ExactPayloadQur`
o'zi bunday holatlarni `priceIntentionallyAbsent` sifatida ruxsat berishi
mumkin bo'lsa ham). Bu — TestF2Import.tsx'dagi mavjud xatti-harakatdan
QATTIQROQ (konservativroq). Sening fikringcha bu to'g'ri muvozanatmi, yoki
haqiqiy "narx yo'q" holatlarni ham noto'g'ri bloklaydimi? Aniq misol bilan
javob ber (masalan: F2 faylida ba'zi resurslar narxsiz bo'lishi normal
holatmi — agar shunday bo'lsa, bu qattiq bloklash haqiqiy foydalanuvchini
to'xtatib qo'yishi mumkin).

## QAT'IY CHEKLOVLAR

READ-ONLY/AUDIT-ONLY. Kod o'zgartirish yo'q. Production'ga yozish yo'q —
bu safar hali DB ham kerak emas (barcha testlar mock bilan).

## Report

`ops/handoff/T2_PTO_CLOSURE_007_ANTIGRAVITY_F2_CUTOVER_AUDIT_RESULT.md`
— har band uchun PASS/FAIL/PARTIAL, fayl:qator dalil bilan.
