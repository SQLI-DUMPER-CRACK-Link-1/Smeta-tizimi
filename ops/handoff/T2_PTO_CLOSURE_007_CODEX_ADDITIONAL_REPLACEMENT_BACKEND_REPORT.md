# T2 PTO Closure 007 — Qo‘shimcha va zamena backend

## Holat

`t2_additional_replacement_v1` production sxemaga qo‘llandi. Bu migratsiya
alohida buyruq jurnali, idempotent RPClar va audit izini qo‘shadi; mavjud
qatorlarning nomi, narxi yoki miqdorini qayta yozmaydi.

## Buyruqlar

- `t2_qoshimcha_ish_yarat_v1` — yangi BL qatorini yaratadi.
- `t2_zamena_ish_yarat_v1` — eski qatorni o‘zgartirmasdan, `replaces_line_id`
  bilan yangi BL qatorini yaratadi.
- `t2_resurs_bola_qosh_v1` — mavjud BL ostiga RS/MAT/OB resursini yaratadi.

Har uchalasi serverdagi tasdiqlangan aktorni oladi, kompaniya a’zoligini
har chaqiruvda tekshiradi, `operation_id` bilan takroriy yuborishni xavfsiz
qaytaradi va `expected_version` eskirgan bo‘lsa rad etadi.

## Saqlangan qonunlar

- Zamena eski qatorning `nomi` yoki qiymatlarini mutatsiya qilmaydi.
- Qo‘shimcha/zamena aloqasi strukturaviy ustunlarda, banner yoki nomga matn
  qo‘shish orqali emas, saqlanadi.
- Bola resursida miqdor majburan to‘qilmaydi: kiritilmasa `NULL` qoladi.
- Obyekt, ota qator va dalil hujjati bir kompaniya doirasida tekshiriladi.
- Resurs daraxtidagi ish yarim holatda ko‘rinib qolmasligi uchun bitta
  tranzaksion buyruqda yaratiladi.

## Production qabul sinovi

O‘rnatilgan migratsiya ustida `BEGIN … ROLLBACK` doirasida quyidagilar
tekshirildi: normal qo‘shimcha, takroriy operation, operation ziddiyati,
eskirgan versiya, zamena aloqasi, eski qator muzlashi, resurs bolasi, revoke
qilingan a’zolik. Sinovdan keyin `_TEST_ADDREPL_` kompaniyasi qoldig‘i `0`.

## Qaytarish

`20260924120000_t2_additional_replacement_v1.rollback.sql` faqat ishlatishdan
oldingi holat uchun himoyalangan rollback. Buyruq jurnali yozuvga ega bo‘lsa,
u ataylab to‘xtaydi; tarixni o‘chirib yubormaydi.

## Chegara

Frontend faqat Cloudflare `sb-yoz` orqali uchta nomlangan amalni yuboradi.
U foydalanuvchi yuborgan actor qiymatiga ishonmaydi va xom PostgREST xatosini
brauzerga bermaydi.
