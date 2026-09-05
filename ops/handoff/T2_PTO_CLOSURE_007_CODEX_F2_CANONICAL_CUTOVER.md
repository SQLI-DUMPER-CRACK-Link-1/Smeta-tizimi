# T2-PTO-CLOSURE-007-CODEX-F2-CANONICAL-CUTOVER

**Rol:** Implementation engineer (Codex)
**Branch:** yangi, `codex/t2-f2-canonical-cutover-v1` — base:
`origin/integration/next-main-release-v1`
**Egasining qarori (2026-09-05)**: GAS'dan Supabase-native'ga o'tish
**BOSQICHMA-BOSQICH (feature flag)** bilan bo'ladi — yangi yo'l ESKI bilan
BIR VAQTDA ishlaydi, egasi solishtirib ko'rgach eskisi o'chiriladi.

## Nima uchun aynan shu route birinchi

`ops/handoff/T2_PTO_DAILY_WORKFLOW_CLOSURE_007.md` audit natijasi: 4 ta
kanonik route'dan (`/admin/f2`, `/admin/f2-tayyorlash`, `/admin/narxlar`,
`/admin/holat`) F2 import ENG TAYYOR holatda — GAS'siz dvigatel
(`f2-match-engine`, `f2-import-parse`, `/api/f2-moslash`) allaqachon
qurilgan va real production fayli bilan sinalgan, faqat `/admin/test/
f2native` (TestF2Native.tsx)da "isbot" sifatida yotibdi.

## MUHIM TUZATISH — TestF2Native.tsx'ni AYNAN nusxalama

`TestF2Native.tsx` HALI legacy `t2_akt_yarat` (v1) orqali yozadi —
`sbT2AktYarat`, EXACT SOURCE qonuniga rioya QILMAYDI. Kanonik cutover
uchun bu QABUL QILINMAYDI. Sen qurishing kerak bo'lgan versiya
`t2_akt_yarat_v2` (`sbT2AktYaratV2`, `frontend/src/api/supabase.ts`da
allaqachon bor) orqali yozishi SHART — xuddi `TestF2Import.tsx`ning
`yozish()` funksiyasi (`f2-exact-payload.ts`dagi `f2AggregatsiyaQator`/
`f2ExactPayloadQur`) qanday qilgani kabi. Ya'ni: TestF2Native'ning FAYL
O'QISH/MOSLASHTIRISH qismini (parser+matcher, bular to'g'ri) ol, lekin
YOZISH qismini TestF2Import'nikidek qur (certified_quantity/
certified_unit_price/certified_amount, hech qachon qty*narx backfill).

## Vazifa: F2Import.tsx (kanonik `/admin/f2`)ga feature-flag qo'shish

1. **Flag mexanizmi — ODDIY, DB'siz, xavfsiz**: `localStorage`da saqlangan
   boolean, masalan `t2-f2-native-mode` kaliti. Sahifada aniq ko'rinadigan
   tugma/switch: **"Yangi (GAS'siz) rejim — sinov"**. Default: **O'CHIQ**
   (hech kim majburan yangi rejimga tushmaydi, mavjud foydalanuvchilar
   HECH NARSANI sezmaydi). Bu — DB capability-registry emas (u hali
   frontend'da ishlatilmagan, qo'shimcha murakkablik keltirar edi) —
   sodda va tezkor yechim, egasining o'zi taklif qilgan "Yangi rejim
   tugmasi" g'oyasiga mos.
2. `F2Import.tsx` ichida: flag YONIQ bo'lsa, GAS-asosli mavjud UI o'rniga
   YANGI komponent render qilinadi (masalan yangi fayl
   `frontend/src/admin/sahifalar/F2ImportNative.tsx` — TestF2Native.tsx
   asosida, lekin yuqoridagi YOZISH tuzatishi bilan). Flag O'CHIQ bo'lsa —
   **mavjud kod BAYT-BAYTIGA o'zgarishsiz** ishlaydi (hech qanday
   regressiya xavfi yo'q, chunki eski yo'l umuman qo'zg'atilmaydi).
3. Yangi komponent ichida bosqichlar aniq ko'rsatilsin (Section 7 talabi):
   "Fayl o'qilmoqda" → "Moslashtirilmoqda" → "Narxlanmoqda" (agar kerak
   bo'lsa) → "Yozilmoqda" → "Tayyor / Ko'rib chiqish kerak". Katta fayl
   (>15MB yoki >20000 qator) hali TestF2Native'dagidek rad etiladi (aniq
   xabar bilan) — resumable job modeli (`t2_f2_import_job_v1`, allaqachon
   migratsiya sifatida bor, hali qo'llanmagan) bu CUTOVER'ning qamroviga
   KIRMAYDI (alohida keyingi bosqich).
4. F2PreapprovalAudit komponentini (allaqachon merge qilingan) shu yangi
   oqimga ham ulash — F2 yozishdan oldin istisnolarni ko'rsatish.
5. Obyekt tanlash: yangi rejim uchun `sbT2ObyektlarOlKomp`/raqamli
   `t2_obyekt.id` ishlatiladi (TestF2Native/TestF2Import'dagidek) — bu
   `Holat.tsx`ning GAS-nom muammosidan MUSTAQIL, chunki F2Import.tsx
   allaqachon o'z obyekt tanlash mexanizmiga ega (buni tekshir — agar u
   ham GAS-nom asosida bo'lsa, ikkala rejim uchun BITTA aniq obyekt
   tanlagich kerak bo'ladi, ikkitasi emas).

## QAT'IY CHEKLOVLAR

- Flag O'CHIQ holatdagi xatti-harakat 100% o'zgarishsiz qolishi SHART —
  buni ALOHIDA test bilan isbotla (masalan mavjud F2Import testlari, agar
  bo'lsa, o'zgarishsiz o'tishi kerak).
- `t2_akt_yarat` (legacy v1) YANGI rejimda ISHLATILMAYDI — faqat v2.
- Hech qanday GAS kodi (`Smeta tizimi/*.js`) o'zgartirilmaydi/deploy
  qilinmaydi.
- `TestF2Native.tsx`, `TestF2Import.tsx`, `f2-exact-payload.ts`,
  `f2-match-engine/`, `f2-import-parse/` — mavjud fayllarga TEGMA (faqat
  IMPORT qil, logikasini qayta yozma).
- Production'ga yozish sinovlari — SINTETIK ma'lumot bilan, keyin
  tozalab (avvalgi brif'lardagi bilan bir xil intizom).

## Report

`ops/handoff/T2_PTO_CLOSURE_007_CODEX_F2_CANONICAL_CUTOVER_REPORT.md` —
flag qanday ishlashi, eski rejim o'zgarishsiz qolgani dalili, yangi rejim
qanday sinalgani (haqiqiy .xlsx bilan, agar mumkin bo'lsa), gates.
