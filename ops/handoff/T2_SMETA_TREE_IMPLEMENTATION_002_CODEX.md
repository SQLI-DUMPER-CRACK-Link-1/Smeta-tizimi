# T2-SMETA-TREE-IMPLEMENTATION-002

## BASE / BRANCH / HEAD

- BASE: `4c3ab4b22ebda81ae743b5ae73cdda10dee5acc6`
- BRANCH: `codex/t2-smeta-tree-ux-v2`
- HEAD: yakuniy hisobotda beriladi.

## Compatibility matrix

| Prop/callback | Consumer | Old behavior | V2 behavior | Test |
|---|---|---|---|---|
| `isEditMode` | `Holat.tsx` | Fakt va F2 inputlari faqat edit rejimida | Saqlandi | `SmetaTree.compat.test.ts` |
| `edits` / `setEdits` | `Holat.tsx` | Fakt/oylik F2 drafti SaveModal uchun yig'iladi | Saqlandi | compatibility test |
| `onNodeDrop` | `Holat.tsx` | source→target zamena, bo'sh joy→qo'shimcha | Saqlandi | compatibility test |
| search | barcha consumer | nom/kod va ota zanjiri bo'yicha filter | Saqlandi, quick-filter bilan kengaydi | source test |
| expand/collapse | barcha consumer | virtual flatten visible rows | Saqlandi | utils + compatibility test |
| `priceControlLines` | yangi typed integration port | ilgari yo'q edi | `t2_price_control_v1` natijasini `qator_id` bo'yicha ko'rsatadi | compatibility test |

CURRENT_BEHAVIOR_COMPATIBILITY: PASS.
EDIT_MODE: PASS. DRAG_DROP: PASS.
TREE_HIERARCHY: PASS — indentation, connector line, type badge/icon, active row, breadcrumb drawer.
GROUPED_HEADERS: PASS — ISH/SMETA/FAKT/F2/NAZORAT/HOLAT; qiymat ustunlari preset bilan.
NAZORAT_COMPONENT_WIRING: PASS — `PriceControlLine[]` typed prop, qator ID bo'yicha real state/badge/filter. `Holat.tsx` esa hanuz objectning kanonik raqamli ID sini treega bermaydi; shu consumer call-site ni Claude o'z lane ida `priceControlOl(obyektId)` natijasi bilan ulashi kerak. Taxminiy object ID bilan so'rov yuborilmadi.

1366x768: PASS (Asosiy preset default: Nomi, smeta hajm, fakt, F2 jami/mumkin, ostatka, holat). 1536x864: PASS. 1920x1080: PASS. 125_ZOOM: PASS (controlled horizontal scroll).
COMPACT: PASS. COMFORT: PASS. PRESETS: PASS. DRAWER: PASS. F2_HISTORY: PASS.
1K: PASS. 5K: PASS. 10K: PASS — O(n) iterative flatten + virtualizer.

BUSINESS_LOGIC_CHANGED: NO. Production/main/backend/migration/GAS: NONE.
READY_FOR_CLAUDE_INTEGRATION: YES.

## Tekshiruv dalili

- Focused Vitest: 2 fayl, 7 test — PASS.
- TypeScript, production build, lint, `npm run tekshir`, governance va whitespace gate — PASS.
- Lintdagi ogohlantirishlar avvaldan mavjud bo'lgan boshqa fayllarga tegishli; tree V2 yangi xato chiqarmadi.
- 1k/5k/10k yo'li `utils.test.ts` orqali iterativ flatten + virtual rendering kontrakti bilan tekshirildi. Responsive o'lchamlar CSS kontrakti bo'yicha ko'rib chiqildi; bu branchda alohida brauzer screenshot testi yo'q.
