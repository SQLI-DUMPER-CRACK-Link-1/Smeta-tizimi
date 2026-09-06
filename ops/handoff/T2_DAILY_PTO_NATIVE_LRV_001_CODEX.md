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

### Fakt V2 qatlamining sababi

Eski `t2_fakt_yoz` hujjat yaratish mexanizmi saqlab qolindi, ammo yangi
brauzer oqimi unga to'g'ridan-to'g'ri ishonmaydi. `20260926120000_t2_fakt_yoz_v2`
faqat native T2 yo'li uchun qo'shimcha command-boundary beradi:

- `p_actor_id` HTTP so'rovidan emas, tasdiqlangan sessiyadan keladi;
- obyektning kompaniyasi va actor a'zoligi DBda tekshiriladi;
- har bir `qator_id` shu obyektning kanonik qatori bo'lishi shart;
- bo'sh, nol yoki takrorlangan qatorlar rad etiladi;
- `operation_id` majburiy: uzilgan tarmoqdan keyin qayta yuborish ikkinchi
  Fakt hujjatini yaratmasligi kerak;
- Fakt append-only hujjat bo'lgani uchun satrni "oxirgi yozgan yutadi" usulida
  almashtirmaydi; concurrency receipt `operation_id` bilan yuritiladi.

`/api/sb-yoz` native ekran uchun endi faqat `fakt_yoz_v2`ni oq ro'yxatda
ushlaydi. Eski GAS/bridge chaqiruvlari uchun legacy RPC o'zgartirilmagan.

Mahalliy sana hisoblash ham UTC kesimiga bog'liq bo'lmay qoldi: Toshkentdagi
kun almashishida Fakt noto'g'ri sanaga tushmaydi.

### V2 tekshiruvlari

- `frontend/testlar/t2_kompaniya.test.cjs`: 25/25 PASS; V2 RPC oq ro'yxati,
  sessiya actor-IDsi va majburiy UUID qo'riqchisi regression bilan qoplandi.
- `npx tsc -b --force`: PASS.
- `npm run build`: PASS (mavjud `grid.svg` va bundle-size ogohlantirishlari
  build xatosi emas).
- Migratsiya hali productionga qo'llanmagan; acceptance skripti faqat
  `BEGIN ... ROLLBACK` muhitida real actor/qator bilan ishlatiladi.

Native F2 tayyorlash keyingi vertikal qatlam bo'lib qoladi.

## Native F2 tayyorlash

`/admin/f2-tayyorlash` endi `F2TayyorlashNative`ga ulanadi. Eski
`F2Tayyorlash.tsx` o'chirilmagan, biroq T2 kundalik route'ida chaqirilmaydi.
Yangi oqim:

1. joriy kompaniyaning kanonik obyektini sonli ID bilan tanlaydi;
2. faqat `t2_qator_holat.f2_mumkin_hajm > 0` qatorlarini o'qiydi;
3. foydalanuvchi F2 hujjatidan hajm, narx, summa va manba sahifasini kiritadi;
4. hajm Fakt qoldig'idan oshsa, manba/narx/summa bo'lmasa yozish rad etiladi;
5. `qty * price != document amount` bo'lsa, farq ochiq belgilanadi, ammo
   aynan hujjat summasi `certified_amount` sifatida saqlanadi;
6. `sbT2AktYaratV2` kanonik qoralama yaratadi; tasdiqlash alohida,
   versionli boshqaruv amali bo'lib qoladi.

`f2-native-preparation.ts` pure kontrakti smeta narxiga fallbackni ataylab
bilmaydi. `f2-native-preparation.test.ts` exact 1-tiyin farqi, Fakt limiti va
bo'sh manba narxini regression bilan tekshiradi.
