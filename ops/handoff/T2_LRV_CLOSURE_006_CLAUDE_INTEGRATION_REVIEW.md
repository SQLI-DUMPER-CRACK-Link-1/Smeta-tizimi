# T2-LRV-CLOSURE-006 — Codex branch review + integration (Claude, round 3)

**Rol:** Chief Integrator (Claude)
**Reviewed:** `codex/t2-smeta-tree-ux-v2` @ `9cbd869`, `codex/t2-lrv-dbindep-v1` @ `199a572`
**Holat:** Ikkalasi ham **ACCEPT_CODEX**, integration branch'ga merge qilindi
(component-by-component ko'rib chiqilgan, blind merge emas — quyida dalillar).

---

## Tree V2 (`codex/t2-smeta-tree-ux-v2`) — ACCEPT_CODEX

V1 (836280d, avval REJECT bo'lgan — `T2_SMETA_TREE_IMPLEMENTATION_001_CLAUDE.md`)
butun komponentni 357 qatordan 7 qatorga qayta yozib, `isEditMode`/`edits`/
`setEdits`/`onNodeDrop`ni jim o'chirib qo'ygan edi. V2 — bu safar **mavjud,
ishlab turgan `SmetaTree.tsx`ning USTIGA qo'shilgan incremental diff**
(357 qatorlik fayl → 129 qator o'zgardi/qo'shildi, qayta yozilmadi), qolgan
diffstat: `SmetaTree.compat.test.ts` (yangi) + hujjat.

### Mustaqil tekshirilgan (Codex'ning "PASS" so'ziga ishonmasdan)

1. **Edit-mode/drag-drop haqiqatan saqlanganmi?** `git diff` da
   `draggable={isEditMode}`, `onDragStart`, `onDragOver`, `onNodeDrop(draggedNode,
   node)`/`onNodeDrop(draggedNode)` handler TANALARI **o'zgarmagan** — faqat
   atrofdagi CSS/layout o'zgargan. Bu V1'dagi aynan regressiya nuqtasi edi;
   endi yo'q.
2. **Preset/quick-filter haqiqiy ishlaydimi?** `showMoney`/`showSmetaAndFakt`
   flag'lari JSX'da haqiqiy ustunlarni ko'rsatish/yashirishga ta'sir qiladi
   (V1'da `preset` state o'zgarardi-yu hech narsaga ta'sir qilmasdi). Quick-filter
   pill'larida endi haqiqiy `onClick={() => setQuickFilter(id)}` bor va
   `tezMos()` funksiyasi daraxtni HAQIQATAN filtrlaydi.
3. **NAZORAT ustuni haqiqiy manbaga ulanganmi?** `priceControlLines?:
   readonly PriceControlLine[]` — bu tur `frontend/src/api/t2-price-control.ts`
   dan (Codex O'ZGARTIRMAGAN, allaqachon mavjud edi, `git diff` bilan
   tasdiqlandi) import qilingan, HAQIQIY `t2_price_control_v1` natijasi.
   Prop berilmasa "Ma'lumot ulanmagan" — soxta ma'lumot yo'q, halol bo'sh holat.
4. **`SmetaTree.compat.test.ts`** — matn-asosli ("source contains X") testlar,
   to'liq behavioral emas, lekin V1'dagi aynan regressiyani (props saqlanib,
   funksiya tanasidan olib tashlash) ANIQ ushlaydi. Cheklov sifatida qayd etildi.
5. **Whitelist/backend tegilmaganmi?** `git diff --stat` `ops/` va
   `frontend/functions/` ustida — faqat yangi hujjat qo'shilgan, boshqa hech
   narsa. `main`/production/GAS — tegilmagan (Codex'ning da'vosi to'g'ri).

### Mustaqil gates (alohida worktree, `npm install` bilan, Codex'ning o'z
build'idan MUSTAQIL qayta ishga tushirildi)

| Gate | Natija |
|---|---|
| `tsc -b` | ✅ toza |
| `vitest run src/umumiy/daraxt/` | ✅ 7/7 (Codex'ning da'vosi bilan bir xil) |
| `vitest run` (to'liq) | ✅ 143/143 (138 baza + 5 yangi tree test) |
| `oxlint src/umumiy/daraxt/` | ✅ 0 ogohlantirish |
| `vite build` | ✅ toza (mavjud, aloqasiz ogohlantirishlardan tashqari) |

### Tekshirilmagan / halol cheklov

**Vizual/responsive claim'lar (1366x768/1536x864/1920x1080/125%-zoom, compact/
comfort, drawer)** — Codex'ning o'z hisobotida ochiq yozilgan: "bu branchda
alohida brauzer screenshot testi yo'q", faqat CSS ko'rib chiqilgan. Men ham
BU ROUNDDA brauzer orqali QAYTA tekshirmadim — `preview_start` faqat sessiyaning
asosiy loyiha katalogiga (`C:\Users\PC\Documents\GAS`, foydalanuvchining
DIRTY worktree'si — tegilmaydi) bog'langan, alohida review worktree'ni
xavfsiz preview qila olmadim. Bu — kod darajasida tasdiqlangan, vizual
darajada YO'Q — halol cheklov, "PASS" deb yozib qo'yilmadi.

### Qolgan ochiq ish (Codex o'zi ham aytgan)

`Holat.tsx` hali kanonik obyekt ID va `priceControlOl(obyektId)` natijasini
`<SmetaTree priceControlLines={...} />`ga UZATMAYDI — bu "consumer wiring"
ATAYLAB bu branchda qilinmagan (Codex: "taxminiy ID bilan so'rov yuborilmadi").
**Bu — Claude lane'ining keyingi ishi** (pastga qara).

---

## DB-independent adapterlar (`codex/t2-lrv-dbindep-v1`) — ACCEPT_CODEX

Toza, faqat qo'shimcha fayl (6 ta yangi, 0 ta o'zgargan mavjud fayl) — merge
konflikti xavfi nol.

### Mustaqil tekshirilgan

1. **`t2-additional-replacement.ts`** — `yozAmali()` (mavjud, umumiy yozish
   dispatch funksiyasi, Codex O'ZGARTIRMAGAN) orqali `/api/sb-yoz`ga
   `amal: 'qoshimcha_ish_yarat_v1'` va h.k. yuboradi. **`sb-yoz.ts`ning
   `AMALLAR` whitelist'iga HECH NARSA qo'shilmagan** (tasdiqlandi, `git diff`) —
   ya'ni bu RPC hali productionda ishlamaydi, faqat kelajakdagi kontrakt
   TAKLIFI, aynan Codex aytganidek.
2. **Testlar tautologik emas** — `t2-additional-replacement.test.ts` `fetch`ni
   mock qilib, HAQIQIY so'rov tanasini (`amal`, `operation_id`,
   `kutilgan_versiya` va h.k.) tekshiradi.
3. **`catalog-ingest`** — `matchCatalogObservations()`da
   `candidate.companyId === observation.scope.companyId` — QAT'IY kompaniya
   doirasi tekshiruvi (cross-object/cross-company narx sizishi TAQIQ qonuniga
   mos). Testda ANIQ shu holat sinaldi ("boshqa kompaniya katalogi... narxi
   observationga sizmaydi"). Faqat aniq (normallashtirilgan) `code+nom+birlik`
   uch tomonlama moslik bo'lsa `auto_linked`; bir nechta nomzod bo'lsa
   `candidate_review` (fuzzy auto-merge YO'Q); mos kelmasa `unmatched`.

### Mustaqil gates

| Gate | Natija |
|---|---|
| `tsc -b` | ✅ toza |
| `vitest run` (to'liq) | ✅ 145/145 (138 baza + 7 yangi) |
| `oxlint` | ✅ 0 ogohlantirish |

---

## Integratsiya

Ikkalasi ham `--no-ff` merge bilan `integration/next-main-release-v1-local2`ga
qo'shildi (avval `origin/integration/next-main-release-v1`ning eng so'nggi
holatiga — Antigravity'ning ikkita commiti bilan birga — mos qilindi).
**Konflikt YO'Q** — ikkala Codex branch turli fayllarga tegdi.

To'liq integratsiyalangan holatda gates qayta ishga tushirildi:

| Gate | Natija |
|---|---|
| `tsc -b` | ✅ toza |
| `vitest run` | ✅ **150/150** (30 fayl) |
| `oxlint` | ✅ 0 YANGI ogohlantirish (mavjud fayllardagi eski ogohlantirishlar o'zgarmagan) |
| `vite build` | ✅ toza |
| `npm run tekshir` | ✅ PASS |
| `node ops/governance-check.cjs` | ✅ PASS (15 task) |

## Keyingi qadam — QISMAN BAJARILDI (shu round)

**Muhim tuzatish**: birinchi qoralamada "`Holat.tsx`ga ulash kerak" deb
yozgan edim — bu NOTO'G'RI edi. `Holat.tsx` — ESKI, GAS-asosli admin panel
(`apiPapkaSkan`/`apiHolatOl`, `obyekt: string` — Drive papka nomi), Tizim_02
Supabase'ning `t2_obyekt.id` (raqamli) bilan HECH QANDAY tayyor moslashtiruvchi
(bridge) yo'q. Bu ikkisini xato bog'lash — mavjud bo'lmagan GAS↔Supabase
identity xaritasini o'ylab topish bilan barobar edi — qilinmadi.

O'rniga: **`frontend/src/test02/TestDaraxt.tsx`** — Tizim_02'ning O'ZI
(`sbT2ObyektlarOl`, `T2Obyekt.id` raqamli, izohida ochiq yozilgan: "Nom → id
kerak, chunki t2_daraxt obyekt_id bo'yicha filtrlaydi (matn emas, son)") —
aynan shu yerga ulandi:
- `priceControlOl(ob.id)` `ochish()` ichida, daraxt bilan PARALLEL (asosiy
  daraxtni bloklamaydi, xato bo'lsa jim bo'sh massiv qoladi — soxta
  ma'lumot yo'q).
- `<SmetaTree data={tree} priceControlLines={priceControlLines} />`.

Gates: `tsc -b` toza, `vitest run` 150/150 (o'zgarmadi — bu sof wiring,
yangi test qo'shilmadi), `oxlint` 0 ogohlantirish.

**Hali ochiq**: `Holat.tsx` (eski GAS panel) hech qachon `priceControlLines`
ola olmaydi, chunki uning obyekt identity tizimi boshqa — bu real, hal
qilinmagan arxitektura savoli (GAS obyekt ↔ t2_obyekt xaritasi kerakmi,
yoki `Holat.tsx`ning o'zi asta-sekin Tizim_02'ga ko'chiriladimi — T2-GAS-EXIT-001
qamrovi, bu taskning EMAS). Vizual/responsive tasdiqlash ham hali brauzerda
QAYTA tekshirilmagan (yuqoridagi halol cheklovga qara).
