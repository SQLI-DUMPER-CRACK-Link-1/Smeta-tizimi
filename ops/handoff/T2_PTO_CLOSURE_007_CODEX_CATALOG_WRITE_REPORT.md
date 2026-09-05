# T2 PTO Closure 007 — Katalog observation yozuvi

## Holat

`t2_catalog_write_v1` production sxemaga qo‘llandi. U smeta/F2 importidan
kelgan kuzatuvlarni faqat kompaniya va obyekt doirasida, idempotent buyruq
jurnaliga yozadi.

## Deterministik bog‘lash

Ish turi faqat `kod + nom + birlik` uchalasi aynan bir xil bo‘lsa avtomatik
bog‘lanadi. Bitta aniq moslik bo‘lsa `tasdiqlangan`, qolgan holatlar
`kutmoqda` bo‘lib qoladi.

Material/narx uchun mavjud jadvalda kod yo‘q. Shuning uchun unga nisbatan
"aniq uchlik mosligi"ni soxta da’vo qilish taqiqlangan: material kuzatuvi
ko‘rib chiqish navbatida qoladi. `sourcePrice` kuzatuvning o‘zida biznes
narxiga aylantirilmaydi va `t2_narx`ga yozilmaydi.

## Himoya

- Har import satrida barqaror `source_line_key` bor; Sheet/Excel qator raqami
  identifikator emas.
- `operation_id` replayni qaytaradi, boshqa mazmundagi replay esa rad etiladi.
- Kompaniya, obyekt, manba hujjati va revision bir-biriga tegishli ekani
  tekshiriladi.
- A’zoligi bekor qilingan aktor va boshqa kompaniya scope’i fail-closed rad
  etiladi.
- Bir import ichida takrorlangan manba satri rad etiladi.

## Production qabul sinovi

O‘rnatilgan sxemada `BEGIN … ROLLBACK` ichida ish turi uchun aniq moslik,
material uchun pending holati, replay, duplicate source line, soxta kompaniya
scope’i va revoke qilingan a’zolik tekshirildi. Sinov tugagach
`_TEST_CATALOG_` kompaniyasi qoldig‘i `0`.

## Qaytarish

`20260924130000_t2_catalog_write_v1.rollback.sql` faqat ishlatishdan oldingi
rollbackdir. Buyruq jurnali ishlatilgan bo‘lsa, tarixni yo‘qotmaslik uchun
ataylab to‘xtaydi.
