# T2-PTO-CLOSURE-007 — Narxlar markazi GAS’siz cutover hisoboti

## Holat

`SOURCE_READY`, lekin kanonik `/admin/narxlar` yo‘liga ulash alohida integrator
o‘zgarishini talab qiladi. Yangi native ekran, ikki yozish RPCsi va ularning
qaytariladigan qabul sinovi shu branchda tayyor.

## Asos va branch

- Asos: `883ef2079da46fddfe9c6df7ff4e451256dc7564`
- Branch: `codex/t2-narxlar-markazi-cutover-v1`
- Asosiy manba commit: `cfb58fe799526030428f00be3cc4c1cf50c16eb6`

## Yaratilgan kanonik yozish kontrakti

### `t2_narx_belgila`

- `sb-yoz.ts`dagi mavjud `narx_belgila` argumentlari bilan mos.
- Faol foydalanuvchi email/loginidan aniqlanadi; brauzerdagi `kompaniya_id`
  qabul qilinmaydi.
- Bir faol kompaniya a’zoligi bo‘lsa ishlaydi. Bir nechta kompaniya a’zoligida
  `COMPANY_CONTEXT_REQUIRED` bilan rad etadi: tenant taxmin qilinmaydi.
- `boss`/`rahbar` roliga yozish ruxsati berilmaydi.
- Narx nol yoki manfiy bo‘la olmaydi.
- `ЧЕЛ` va `МАШ` birlikdan qat’iy aniqlanadi; brauzerdan yuborilgan kategoriya
  ular uchun ustun kelmaydi.
- Mavjud qator uchun `versiya` majburiy; eskirgan versiya
  `STALE_VERSION` qaytaradi. Shu bilan ikki operatorning jim ustma-ust yozishi
  to‘xtatiladi.
- Har muvaffaqiyatli o‘zgarish `t2_audit_yoz`ga yoziladi.

### `t2_narx_sana_qosh`

- `sb-yoz.ts`dagi mavjud `narx_sana_qosh` argumentlari bilan mos.
- Bir so‘rovdagi takroriy tabiiy kalit, bo‘sh nom va nol/manfiy narx jim
  yutilmaydi: `tashlangan_qatorlar`da sabab bilan qaytadi.
- Javob invariantni qaytaradi: `kirgan = yozildi + tashlandi`.
- `t2_narx_sana.nom_key` va `birlik_key` hisoblangan ustun ekanligi inobatga
  olindi; ularga bevosita yozilmaydi.
- Har muvaffaqiyatli paket auditi yoziladi.

## Real sxema bilan qabul sinovi

Ikkala migratsiya va qabul skripti production sxemasida bitta
`BEGIN … ROLLBACK` tranzaksiyasi ichida ishlatildi. Hech qanday funksiya,
grant yoki biznes qatori saqlanib qolmadi.

Natija: `T2_NARXLAR_MARKAZI_ACCEPTANCE_PASS`.

Sinov quyidagilarni qamradi:

- mashina birligi soxta `МАТ` kategoriyasidan ustun kelishi;
- yangi registr qatorining versiyasi `1` bo‘lishi;
- eskirgan versiyaning rad etilishi;
- versiyali yangilashda eski `100`, yangi `101` narxining qaytishi;
- sana narxlari paketida 4 kirishdan 1 yozuv va 3 aniq rad sababi;
- a’zoligi bo‘lmagan aktyorning rad etilishi.

## GAS’siz ekran

`NarxlarNative.tsx`:

- GAS chaqirmaydi;
- o‘qishni `t2_narx_markaz` va `t2_topilmaganlar`ning mavjud Supabase read
  adapterlari orqali bajaradi;
- obyekt kesimidagi topilmagan resursni yoki registr qatorini qo‘lda narxlashga
  imkon beradi;
- versiyani faqat kompaniyaning registr qatoridan o‘qib, yozishga uzatadi;
- boshqa obyekt narxini joriy obyektga avtomatik qo‘llamaydi;
- smeta qatorini jim qayta narxlamaydi;
- soxta F2, qoldiq yoki xavf qiymatini hisoblamaydi.

## Majburiy integratsiya chegarasi

Amaldagi task `owns` ro‘yxati `Narxlar.tsx`ni qamramaydi. Shu fayl hozir
kanonik route’da eski GAS hooklarini ishlatadi. Shuning uchun ushbu branch
unga yashirin tahrir kiritmaydi.

Claude/integrator `Narxlar.tsx`ni quyidagicha ulashi kerak:

1. `t2-narxlar-native-mode` localStorage flag yoqilganida `NarxlarNative`ni
   ko‘rsatish;
2. flag o‘chiq bo‘lsa mavjud ekran o‘zgarishsiz qolishi;
3. flagli yo‘lda GAS importi yoki GAS hooki ishga tushmasligi.

Bu ownership chegarasi bajarilmaguncha `/admin/narxlar` cutoveri yakunlangan
deb e’lon qilinmaydi.

## Tekshiruvlar

- `git diff --check`: PASS.
- `npm run lint`: PASS; faqat asosiy branchdagi avvaldan mavjud ogohlantirishlar.
- `npx vitest run --maxWorkers=1`: PASS — 42 fayl, 234 test.
- `npx tsc -b` va `npm run build`: yangi moduldan emas, base’dagi
  `ResursVedomostNative.test.tsx:19` `TS2556` xatosidan BLOCKED. Ushbu xato
  `883ef207…` asos commitining o‘zida mavjud.
- `npm run tekshir`: BLOCKED. `t2_kompaniya.test.cjs`ning qat’iy RPC ro‘yxati
  76 nom kutadi, lekin asosdagi `sb-yoz.ts`ning o‘zida 80 ta ataylab
  oq-ro‘yxatlangan RPC bor. Farq qilayotgan to‘rtta avvaldan mavjud amal:
  `t2_catalog_observation_yoz_v1`, `t2_qoshimcha_ish_yarat_v1`,
  `t2_resurs_bola_qosh_v1`, `t2_zamena_ish_yarat_v1`. Ushbu lane
  `frontend/testlar/t2_kompaniya.test.cjs`ga egalik qilmagani uchun test
  ro‘yxati yashirin tahrir qilinmadi. `node ops/governance-check.cjs`: PASS.

## Production chegarasi

`ACTIVE_TASKS.json`da bu lane uchun `production_write_allowed: false`.
Shu sabab migratsiyalar productionga doimiy qo‘llanmadi. Qabul sinovi haqiqiy
sxemada qaytariladigan tranzaksiya bilan tugadi; persistent production o‘zgarishi
qilinmadi.

## Keyingi aniq ish

1. Integrator ownershipini moslashtirib, flagli `Narxlar.tsx` wrapperini ulaydi.
2. Native flag bilan `/admin/narxlar` preview smoke o‘tkaziladi.
3. Faqat shundan keyin source migratsiyalar odatiy release tartibida doimiy
   qo‘llashga nomzod bo‘ladi.
