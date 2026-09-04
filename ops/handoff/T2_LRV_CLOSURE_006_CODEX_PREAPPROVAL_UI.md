# T2-LRV-CLOSURE-006-CODEX-PREAPPROVAL-UI — Codex lane (DB-independent)

**Rol:** Implementation engineer (Codex)
**Branch:** yangi, `codex/t2-lrv-preapproval-ui-v1` — base: `origin/integration/next-main-release-v1`
**Bog'liq emas:** Tree V2 va DB-independent (ikkalasi ham allaqachon merge
qilingan). Bu — YANGI, alohida lane.
**Blocker:** YO'Q — to'liq DB-independent, faqat pure funksiyalar + UI.

## Nega bu lane

`ops/handoff/T2_LRV_PRODUCT_AUDIT_001_ANTIGRAVITY.md` (Antigravity'ning
o'z kontrakti) va `T2_LRV_CONTROL_001_CONTRACT.md` talabi: F2 tasdiqlashdan
OLDIN (pre-approval) ko'rib chiqish oynasi FAQAT ISTISNOLARNI ko'rsatishi
kerak — yuzlab toza qatorni qo'lda ko'rib chiqishga majburlamasdan.

Men (Claude) shu round `frontend/src/test02/f2-exact-payload.ts`ga yangi
pure funksiya qo'shdim: **`f2IstisnolarniAniqla(rows: F2ExactQator[]):
F2Exception[]`** — har qatorni tekshiradi, faqat muammoli qatorlarni
qaytaradi (toza qatorlar natijaga umuman kirmaydi):

```ts
export type F2Exception =
  | { turi: 'NEEDS_REVIEW'; qatorId: number }
  | { turi: 'ARITHMETIC_MISMATCH'; qatorId: number; hisoblangan: number; hujjatdagi: number; farq: number }
  | { turi: 'NEGATIVE_HAJM'; qatorId: number; hajm: number };
```

`ARITHMETIC_MISMATCH` — ANALITIK-FAQAT signal (LRV Control qonuni: F2
faylning o'z summasi HECH QACHON qayta yozilmaydi/tuzatilmaydi, faqat
ko'rib chiqish uchun belgi). `NEEDS_REVIEW` — yozishni TO'XTATADIGAN
qoida (allaqachon `f2ExactPayloadQur`da bor, shu yerda ham surface
qilinadi ko'rish uchun). 16 ta test bilan tekshirilgan
(`f2-exact-payload.test.ts`), shu jumladan "500 ta toza qatordan 0 ta
istisno" testi — aynan "faqat istisnolar" qonunining o'zi.

## Vazifa: Pre-approval audit UI komponenti

1. `frontend/src/test02/f2-preapproval-audit.tsx` (yoki mos nom, repo
   konvensiyasiga qara) — yangi komponent/panel. Kirish: `aktBarglar`
   (F2Daraxt tugunlari, `TestF2Import.tsx`da allaqachon bor shakl) +
   `getSmetaId` (bog'lash funksiyasi).
2. Ichida: `f2AggregatsiyaQator()` + `f2IstisnolarniAniqla()` chaqiradi
   (ikkalasi ham `f2-exact-payload.ts`dan eksport qilingan, import qil).
3. UI: FAQAT istisno qatorlarni ro'yxatda ko'rsatadi, har birini turi
   bo'yicha (NEEDS_REVIEW / ARITHMETIC_MISMATCH / NEGATIVE_HAJM) guruhlab
   yoki rangli badge bilan. Har bir istisno uchun aniq matn:
   - NEEDS_REVIEW: "Narx bor, F2 faylning o'z summasi yo'q — yozish
     to'xtaydi"
   - ARITHMETIC_MISMATCH: "Hisoblangan {hisoblangan} ≠ hujjatdagi
     {hujjatdagi} (farq {farq}) — hujjat summasi saqlanadi, tuzatilmaydi"
   - NEGATIVE_HAJM: "Manfiy hajm ({hajm}) — pererraschyot/qaytarilgan
     ish bo'lishi mumkin, tekshiring"
4. Agar istisno YO'Q bo'lsa — "Barcha N qator toza, ko'rib chiqish shart
   emas" kabi halol, ijobiy holat ko'rsatilsin (bo'sh ro'yxat emas,
   aniq xabar).
5. `TestF2Import.tsx`ning mavjud step 2/3 oqimiga integratsiya —
   **QAT'IY**: mavjud `yozish()` mantig'iga TEGMA (men shu round uni
   `f2-exact-payload.ts` funksiyalariga o'tkazdim, ishlab turibdi). Yangi
   panelni QO'SHIMCHA ko'rinish sifatida qo'sh (masalan yozishdan oldin
   ko'rsatiladigan alohida bo'lim/tab), mavjud oqimni buzmasdan.
6. Vitest: komponentning o'zi uchun emas (React component test — repo
   konvensiyasida yo'q), balki agar yangi pure helper yozsang (masalan
   istisnolarni turga qarab guruhlash) — o'shani DB-independent test bilan
   tekshir.

## QAT'IY CHEKLOVLAR

- `frontend/src/test02/f2-exact-payload.ts`/`.test.ts`ga TEGMA (men
  yozganman, mantiqqa o'zgartirish kiritsang avval sabab yoz).
- `frontend/src/umumiy/daraxt/**`, `frontend/src/api/t2-additional-replacement.ts`,
  `frontend/src/lib/catalog-ingest/**` — boshqa (allaqachon merge qilingan)
  lane'lar, tegma.
- Production/DB yozish YO'Q — bu FAQAT ko'rish (preview) UI'i, real
  yozish `f2ExactPayloadQur()`+`sbT2AktYaratV2` orqali ALLAQACHON bor
  yo'lda qoladi.

## Report

`ops/handoff/T2_LRV_CLOSURE_006_CODEX_PREAPPROVAL_UI_REPORT.md` — nima
qilindi, gates (tsc/vitest/oxlint/build) natijasi.
