# T2-PTO-CLOSURE-007 — F2 exact narx ziddiyati hardening (Codex)

## Maqsad

Bir xil kanonik `qator_id`ga bog'langan F2 manba qatorlarida turli
`certified_unit_price` bo'lsa, avvalgi oqim diagnostikada buni ko'rsatgan,
ammo payloadda birinchi uchragan narxni tanlab yuborishi mumkin edi. Bu
sertifikatlangan moliyaviy haqiqatni yo'qotadi: bitta `t2_akt_qator` ikki
xil unit-price'ni halol ifodalay olmaydi.

## Tuzatish

- `f2ExactPayloadQur()` endi `CONFLICTING_PRICES`ni fail-closed sabab sifatida
  qaytaradi. Birorta qator yozilmaydi; qisman payload ham yaratilmaydi.
- `TestF2Import` foydalanuvchiga aniq, xavfsiz izoh beradi: manba qatorlarini
  alohida bog'lash yoki hujjatni tekshirish kerak. Birinchi narx tanlanmaydi.
- `F2ImportNative.exactWrite()` alohida takroriy tekshiruv o'rniga umumiy
  exact-payload kontraktidan foydalanadi; ikki route bitta qonunga bo'ysunadi.
- Pre-approval oynasidagi `CONFLICTING_PRICES` matni endi noto'g'ri
  "birinchi narx ishlatiladi" demaydi. Shu JSX qatorda mavjud sintaksis xatosi
  ham tuzatildi; aks holda komponent importida build buzilardi.

## Saqlangan qonunlar

- `ARITHMETIC_MISMATCH` hanuz analitik signal: hujjatdagi summa hech qachon
  qayta hisoblanmaydi yoki o'zgartirilmaydi.
- `NEEDS_REVIEW` hanuz fail-closed.
- Manfiy hajm semanticsi o'zgartirilmadi.
- Hech qanday DB, migration, GAS yoki production o'zgartirilmadi.

## Tekshiruv

| Tekshiruv | Natija |
|---|---|
| `git diff --check` | PASS |
| Fokuslangan Vitest (exact payload, pre-approval helper, native import) | PASS — 4 fayl, 36 test |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| `npm run lint` | PASS — faqat mavjud ogohlantirishlar |
| `node ops/governance-check.cjs` | PASS |

`npm run tekshir` bu branchga aloqasiz, integration bazasidagi mavjud test
nomuvofiqligida yiqildi: `testlar/t2_security_p0.test.cjs` hali
`20260905150000_t2_actor_azo_tekshir_for_share_regression_fix.sql` ichida
anon/authenticated revoke qatorlarini kutadi, lekin integration'dagi
`53013d4` commit shu avvalgi share-lock o'zgarishini qayta olib tashlagan.
Bu F2 fayllariga tegmagan va ushbu branch keltirib chiqarmagan; security
ownershipi ostida test va tasdiqlangan migration kontrakti bir-biriga mos
qilinishi kerak.

## Handoff

- Base: `c95a4923a8c8c7fb3330584c37d6b9c863321c30`
- Branch: `codex/t2-f2-exact-conflict-hardening-v1`
- Production/main: tegilmagan
- Claude integratsiyasiga tayyor: **YES**, security-test nomuvofiqligi esa
  alohida, oldindan mavjud release-gate masalasi sifatida qayd etilgan.
