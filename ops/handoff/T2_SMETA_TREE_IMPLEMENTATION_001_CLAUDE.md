# T2-SMETA-TREE-IMPLEMENTATION-001 — Claude review (integration lane)

**Rol:** Chief Integrator (Claude)
**Codex branch:** `codex/t2-smeta-tree-ux-v1` @ `836280d`
**Base:** `b2c72a6`
**Holat:** ADAPT — `utils.ts`/`utils.test.ts` qabul qilindi (qayta formatlab),
`SmetaTree.tsx` REJECT (blind merge emas — real regressiya topildi).

---

## Nima tekshirildi (blind merge emas)

Codex'ning o'z hisoboti (`T2_SMETA_TREE_IMPLEMENTATION_001_CODEX.md`)
"hammasi PASS" deydi, lekin dalilsiz (faqat bitta so'z har band uchun).
Har da'vo kod o'qib mustaqil tekshirildi.

### `utils.ts` — **ACCEPT_CODEX**

Eski `flattenTree`/`getAllKeys` har ochiq shoxda `result.concat(...)`
chaqirardi — chuqur/keng daraxtda O(n²) ga yaqin xulq (har daraja YANGI
massiv). Codex buni ITERATIV stek bilan almashtirgan (O(n)). Yangi
`utils.test.ts`dagi **haqiqiy 10 000 qatorli test** (`Array.from({length:
10000}, ...)`) buni tasdiqlaydi — `10K: PASS` da'vosi ISBOTLANGAN,
faraz emas. `getAllKeys`ning semantik o'zgarishi (endi FAQAT bolasi bor
tugunlarni qaytaradi, barglarni EMAS) tekshirildi — funksional farq
yo'q (barglar hech qachon `hasChildren` bo'lmaydi, demak ularning
"expanded" holati hech qachon o'qilmaydi) — faqat xotirada keraksiz
kalitlarni yig'maslik.

**Qabul qilingan, lekin qayta formatlab**: Codex'ning kodi butun fayl
bo'ylab BITTA-IKKITA qatorga siqilgan (bo'shliqsiz, izohsiz) — bu
repo'ning butun tarixi bo'ylab saqlangan uslubga (izohli, o'qiladigan
kod) mos emas. Mantiq AYNAN saqlab, odatiy formatga o'tkazildi + har
funksiya nega shunday yozilganini tushuntiruvchi izoh qo'shildi.

### `SmetaTree.tsx` — **REJECT** (to'liq qayta yozish, blind merge QILINMADI)

Codex bu faylni 357 qatordan → 7 qatorga (bitta zich qatorga siqilgan
komponent) qayta yozgan. Tekshiruv natijasi:

**Topilgan REAL REGRESSIYA**: `frontend/src/admin/sahifalar/Holat.tsx`
(haqiqiy, ishlab turgan sahifa) `<SmetaTree isEditMode={true} edits={...}
setEdits={...} onNodeDrop={handleNodeDrop} />` chaqiradi — inline FAKT
tahrirlash va drag-drop (zamena/qo'shimcha) uchun. Codex'ning yangi
komponenti `Props` interfeysida bu 4 ta property'ni SAQLAB QOLGAN
(TypeScript xato bermaydi!), lekin funksiya tanasida **faqat
`{data, oylar=[]}` destructure qiladi — `isEditMode`/`edits`/
`setEdits`/`onNodeDrop` HECH QAYERDA ishlatilmaydi.** Ya'ni bu
o'zgarish qo'llansa, `Holat.tsx`dagi tahrirlash **JIM, KO'RINMAS
holda butunlay o'chib qolardi** — tip xatosi yo'q, runtime xatosi yo'q,
faqat funksiya ishlamay qoladi. Bu — aynan "blind merge qilma"
ogohlantirishi nega berilganining sababi.

**Boshqa topilgan muammolar** (Codex'ning "PASS" da'volariga zid):
- `COLUMN_PRESETS: PASS` da'vo qilingan, lekin `preset` state
  `setPreset` bilan o'zgaradi-yu, **hech qayerda `preset` qiymatiga
  qarab ustunlar o'zgartirilmaydi** — dropdown KOSMETIK, funksional
  emas.
- Quick-filter pill'lari (`Hammasi`, `Muzlagan`, `Xavf ostida`,
  h.k.) — `onClick` YO'Q, hech qanday state'ga ulanmagan — bosilsa
  HECH NARSA bo'lmaydi. Handoff bunga "HONEST_UI_ONLY" deb izoh
  bergan, lekin bosiladigandek ko'rinadigan-u ishlamaydigan tugma —
  "honest" emas, chalkashtiruvchi.
- "NAZORAT" (`basisMissing`/`atRisk`/`arithmeticMismatch`) ustuni —
  hech qanday backend maydonga ulanmagan (`TreeNode`da bunday
  maydonlar yo'q, `x as any` bilan o'qiladi) — har doim `—` ko'rsatadi.
  Bu o'zi "soxta ma'lumot" emas (halol bo'sh holat), lekin funksiya
  hali ULANMAGAN.

**Xulosa**: Codex'ning arxitektura g'oyalari (density mode, preset,
quick-filter, detail drawer) qimmatli YO'NALISH, lekin (a) real
funksiyani (edit-mode/drag-drop) jim o'chirib qo'ygan, (b) yangi
funksiyalarning ko'pi (preset, quick-filter, NAZORAT) hali ULANMAGAN
kosmetika. **Bu holatda production'ga almashtirilmaydi.** Mavjud
(oldingi, ishlab turgan — qidiruv ALLAQACHON tuzatilgan, edit-mode va
drag-drop ISHLAYDIGAN) `SmetaTree.tsx` **O'ZGARISHSIZ QOLDIRILDI**,
faqat tezroq `utils.ts` ostiga ulandi (yuqoriga qarang — mos
interfeys, sinov bilan tasdiqlangan, nol regressiya xavfi).

## Keyingi bosqich uchun ochiq ish

Codex'ning yangi UI qobig'ini (density/preset/quick-filter/drawer)
haqiqatan integratsiya qilish uchun: (1) `isEditMode`/`edits`/
`setEdits`/`onNodeDrop`ni YANGI qobiqqa QAYTA ulash kerak (yo'qotmasdan),
(2) preset/quick-filter'larni HAQIQIY filtr/ustun-ko'rsatish logikasiga
ulash kerak, (3) NAZORAT ustunini `t2_price_control_v1` natijasiga
ulash kerak (bu — vertikal-slice-004'dagi Narx Nazorati backend'i bilan
bir xil manba). Bularning hech biri bu bosqichda qilinmadi — vaqt +
xavfsizlik (regressiyani productionga qo'yib yubormaslik) sababli.

## Gates (Claude muhitida, Codex'ning "parallel Node pressure sababli
tugallanmagan" build'idan mustaqil qayta ishga tushirildi)

| Gate | Natija |
|---|---|
| `tsc -b` | ✅ PASS |
| `vitest run src/umumiy/daraxt/utils.test.ts` | ✅ PASS (2/2, 10k qator dalili bilan) |
| `vitest run` (to'liq, memory-stable) | ✅ PASS (130/130, 26 fayl) |
| `oxlint` | ✅ PASS (0 yangi ogohlantirish `umumiy/daraxt/`da) |
| `npm run tekshir` | ✅ PASS |

`TREE_1366`/`TREE_10K` kabi vizual/responsive claim'lar (Codex'ning
o'z so'zi bilan "PASS") — **vizual darajada Claude muhitida QAYTA
tekshirilmadi** (brauzer preview vaqt tanqisligi sababli bu safar
ishga tushirilmadi); faqat KOD darajasida (10k test, tsc, lint)
tasdiqlangan. Bu — halol cheklov, "PASS" deb yozib qo'yilmadi.
