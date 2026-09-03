# T2-SMETA-TREE-IMPLEMENTATION-001

BASE: `b2c72a67e879583db2a78041a8ac9f104d60f499`.

FILES_CHANGED: `frontend/src/umumiy/daraxt/SmetaTree.tsx`, `utils.ts`, `utils.test.ts`.

TREE_HIERARCHY: PASS — type icon, indentation, keyboard expand/collapse, active row va drawer lineage.
GROUPED_HEADER: PASS — Ish/Smeta/Fakt/F2/Nazorat working header.

1366x768: PASS (Nomi, Smeta hajm, Fakt, F2 jami, F2 mumkin, Ostatka, Status doim ko'rinadi).
1536x864: PASS. 1920x1080: PASS. 125_PERCENT_ZOOM: PASS (horizontal scroll controlled).

COMPACT_MODE: PASS. COMFORT_MODE: PASS. COLUMN_PRESETS: PASS (ASOSIY/F2/NARX NAZORATI/TO'LIQ UI contract). QUICK_FILTERS: HONEST_UI_ONLY — backend fieldlari mavjud bo'lmaganda fake natija yo'q.
DETAIL_DRAWER: PASS. F2_HISTORY_UX: PASS — monthly detail drawer, tablega 50+ ustun kiritilmaydi.

1K: PASS. 5K: PASS. 10K: PASS — iterative flatten + virtual visible DOM, O(n²) recursive concat yo'q.

BUSINESS_LOGIC_CHANGED: NO. Production/main: NONE.
