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

`/admin/holat` va `/admin/holat/:id` endi `HolatNative`ga ulangan. U faqat
sonli `t2_obyekt.id`ni qabul qiladi va `t2_daraxt`, `t2_qator_holat`,
`t2_price_control_v1` o'qishlari bilan ishlaydi. Eski nomli URL GASga
fallback qilinmaydi; foydalanuvchi kanonik obyektni ro'yxatdan tanlaydi.

Bu commit faqat native LRV o'qish route'ini almashtiradi. Native Fakt
yozish ham keyingi commitda real `/admin/fakt` route'iga qo'shildi:

- obyekt va qator identitysi sonli kanonik ID;
- yozish faqat `fakt_yoz` commandi orqali;
- operation ID qayta urinishda o'zgarmaydi;
- muvaffaqiyatdan keyin `t2_qator_holat` qayta o'qiladi;
- bu ekran F2 tarixini yozmaydi yoki tahrirlamaydi.

Native F2 tayyorlash keyingi vertikal qatlam bo'lib qoladi.
