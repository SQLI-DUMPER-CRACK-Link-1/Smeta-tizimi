# T2 daily PTO native LRV — Codex foundation

## Bajarilgan poydevor

`sbT2TreeQur()` endi `t2_qator_holat`dan kelgan kanonik F2/Fakt qiymatlarini
daraxt tuguniga yo'qotmasdan uzatadi:

- `f2ol` — tasdiqlangan F2 jami hajmi;
- `f2mum` — `max(Fakt - approved F2, 0)`;
- `stFakt`, `stF2`, `stOst` — kanonik pul read-modelidan.

Avval bu adapter F2 maydonlarini nolga aylantirar edi. Natijada native daraxt
F2 qoldig'ini noto'g'ri katta ko'rsatishi mumkin edi. Bu tuzatish hech qanday
hisob-kitob yaratmaydi; faqat bazaning mavjud read-model haqiqati yo'qolmasdan
UIga boradi.

## Tekshiruv

- `supabase.t2-tree.test.ts`: PASS — Fakt=60, F2=25, F2 mumkin=35 va aniq
  F2 summa daraxtga uzatilishi tekshirildi.
- `npx tsc -b`: PASS.
- DB/GAS/production: tegilmagan.

## Keyingi majburiy qadam

`/admin/holat/:id` hozircha eski GAS-name route'i. Uni matn nomi orqali
taxminan bog'lamasdan, faqat sonli `t2_obyekt.id` bilan ishlaydigan native
routega o'tkazish kerak. Shu native route shu adapterdan foydalanadi.
