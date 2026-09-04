# T2-LRV-CLOSURE-006-ANTIGRAVITY-MERGE-AUDIT — Antigravity lane (davomi)

**Rol:** Independent auditor (Antigravity)
**Holat:** QISMAN audit, FINAL EMAS (avvalgi lane'dagi bir xil qoida:
Tree V2 + isolated DB ikkalasi ham to'liq tugamaguncha FINAL_READY: NO).

Rahmat oldingi Round 2 auditing uchun — Supabase MCP'ing yo'qligini ochiq
aytganing to'g'ri qaror edi (soxta "tekshirdim" deb yozishdan ko'ra).

## Nima o'zgardi (sen oxirgi marta ko'rgandan keyin)

`origin/integration/next-main-release-v1` yangilandi: `20a2908` (sening
oxirgi push'ing) → **`6da04f489f403fb0a4e185fae58a637cf1feda20`**. Bu
oraliqda Claude ikkita Codex branch'ni (`codex/t2-smeta-tree-ux-v2`,
`codex/t2-lrv-dbindep-v1`) ko'rib chiqib merge qildi, va
`frontend/src/test02/TestDaraxt.tsx`ni `priceControlOl()`ga ulab qo'ydi.

## Vazifa 1: Merge'ni mustaqil tekshir (Claude'ning review hujjatiga ishonmasdan)

`ops/handoff/T2_LRV_CLOSURE_006_CLAUDE_INTEGRATION_REVIEW.md` — Claude'ning
o'z da'volari. Sen buni QAYTA hosil qil:

1. `git pull origin integration/next-main-release-v1` (yoki fetch+checkout).
2. `frontend/src/umumiy/daraxt/SmetaTree.tsx`ni oching: `isEditMode`,
   `edits`/`setEdits`, `onNodeDrop` HAQIQATAN funksiya tanasida
   ishlatilyaptimi (faqat Props interfeysida emas)? Aniq qatorlarni top:
   `draggable={isEditMode}`, `onDragStart`, `onNodeDrop(draggedNode, node)`.
3. `frontend/src/test02/TestDaraxt.tsx`ni oching: `priceControlOl(ob.id)`
   haqiqatan chaqirilyaptimi, va natija `<SmetaTree priceControlLines={...}>`
   ga uzatilyaptimi? `Holat.tsx`ga TEGILMAGANINI tasdiqla (git diff'da
   bu fayl bo'lmasligi kerak).
4. `frontend/src/lib/catalog-ingest/index.ts`dagi
   `matchCatalogObservations()`ni o'qi: `candidate.companyId ===
   observation.scope.companyId` tekshiruvi HAQIQATAN bor-yo'qligini
   tasdiqla (Section 5 — Cross-Object Price Safety, sening o'z
   kontrakting `T2_LRV_PRODUCT_AUDIT_001_ANTIGRAVITY.md`dan).
5. `npm ci && npx tsc -b && npx vitest run` — o'zing ishga tushir, natija
   150+ testdan (yangi qo'shimchalar bilan ko'proq) barchasi PASS bo'lishi
   kerak. Agar biror joyda FAIL topsang — bu HAQIQIY topilma, aniq yoz.

## Vazifa 2: Yangi pure funksiyani tekshir — `f2IstisnolarniAniqla`

`frontend/src/test02/f2-exact-payload.ts` (oxiri) — yangi
`f2IstisnolarniAniqla(rows): F2Exception[]` funksiyasi qo'shildi
(NEEDS_REVIEW / ARITHMETIC_MISMATCH / NEGATIVE_HAJM). Bu — sening
`T2_LRV_PRODUCT_AUDIT_001_ANTIGRAVITY.md`dagi "pre-approval faqat
istisnolarni ko'rsatsin" talabini qondirish uchun (Codex hozir shu asosda
UI qurmoqda, `T2_LRV_CLOSURE_006_CODEX_PREAPPROVAL_UI.md`ga qara).

Tekshir: `ARITHMETIK_TOLERANS = 0.005` (yarim tiyin) — bu tanlov to'g'rimi?
Egasining o'z misoli (qty=10, narx=123.45, summa=1234.49 — hisoblangan
1234.50 dan 1 tiyin farq) HAQIQATAN `ARITHMETIC_MISMATCH` sifatida
ANIQLANADIMI (`f2-exact-payload.test.ts`dagi shu nomdagi testni o'qib,
qo'lda hisoblab tasdiqla)? Sening fikringcha yana qanday istisno turlari
(masalan: bir xil `qator_id`ga ikki xil narx kelishi, yoki hajm=0-yu
narx>0) qo'shilishi kerakmi — agar shunday desang, aniq misol bilan yoz,
Codex/Claude keyingi round'da ko'rib chiqadi.

## Vazifa 3: `T2_LRV_PRODUCT_AUDIT_001_ANTIGRAVITY.md`ning boshqa
bo'limlari haliyam bajarilmaganini tasdiqla (P1, keyingi navbat uchun)

Sening o'z hujjating Section 6 (ADDITIONAL_ACCEPTANCE UX) va Section 7
(REPLACEMENT_ACCEPTANCE UX) — Codex'ning `t2-additional-replacement.ts`
(hozir MERGE qilingan) faqat CLIENT KONTRAKT, hali RPC/UI yo'q. Tasdiqla:
hozircha production'da bu funksiyalar chaqirilganda `UNKNOWN_AMAL` qaytishi
kerak (backend hali yo'q) — bu XATO EMAS, aniq belgilangan holat. Agar
boshqacha topsang (masalan kimdir whitelist'ga sirg'alib qo'shib qo'ygan
bo'lsa) — bu P0 topilma, darhol yoz.

## QAT'IY CHEKLOVLAR

READ-ONLY/AUDIT-ONLY. Kod o'zgartirish yo'q. Production yozish yo'q.
`main`ga hech narsa yo'q.

## Report

`ops/handoff/T2_LRV_CLOSURE_006_ANTIGRAVITY_MERGE_AUDIT_RESULT.md` — har
band uchun PASS/FAIL/PARTIAL + fayl:qator dalil bilan.
