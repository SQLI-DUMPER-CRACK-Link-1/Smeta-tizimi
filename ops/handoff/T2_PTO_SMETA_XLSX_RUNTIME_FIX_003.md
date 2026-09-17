# T2 PTO XLSX runtime tuzatishi — 003

## Holat

- Base: `438012ea8a6c793fdab19f3b31430512a0d4c652`
- Recovery branch: `codex/pto-smeta-package-import-recovery-v1`
- `main` va productionga tegilmagan.

## Aniqlangan sabab

Bu ikkita alohida parser-bardoshlilik nuqtasi ekanligi aniqlandi:

1. Paket importining custom XLSX o'qigichi DEFLATE-siqlilgan XML qismlarini
   `Blob.stream()` orqali ochardi. Bu API to'liq bo'lmagan browser/test
   muhitida mavjud bo'lmagani uchun compressed-XLSX yo'li yiqilishi mumkin edi.
2. Haqiqiy yo'l TN smetalarida A va F kabi uzoq ustunlar to'ldirilib,
   oradagi kataklar XMLda umuman yozilmagan. JavaScript buni siyrak massiv
   sifatida beradi. LRV/RES tahlilchisi shu teshikni `undefined` deb olib,
   `.length` so'rardi. Operator ko'rgan aynan
   `Cannot read properties of undefined (reading 'length')` xatosining
   haqiqiy ildiz sababi shu bo'ldi.

Bu R2, Supabase RPC yoki foydalanuvchi faylining buzilganini anglatmaydi.
`20261025090000_t2_smeta_paket_import_v1` allaqachon production katalogida
mavjud: paketning reserve/start/chunk/final RPC va zarur ustunlari bor.

## Tuzatish

`frontend/src/lib/f2-import-parse/xlsxReader.ts`dagi compressed-XLSX yo'li
endi mustaqil `ArrayBuffer`dan `Response(...).body` Web Stream hosil qiladi va
keyin `DecompressionStream('deflate-raw')`ga uzatadi. Shuningdek XMLdan
chiqqan har siyrak satr bir marta `null` katakli zich satrga aylantiriladi.
`smeta-source-analysis.ts` va `SmetaYuklaNative.tsx` ham tashqi gridni ayni
qoidada normalizatsiya qiladi.

Shunday qilib `Blob.stream()`ga bog'liqlik va `undefined` katakning UIga
o'tishi olib tashlandi; XLSX mazmuni, satrlar yoki qurilish hisoblari
o'zgartirilmagan.

## Dalil

Ishxona kompyuteridagi haqiqiy manbalar read-only smoke orqali ochildi:

- `1уч-к.5.05.xlsx`
- `2уч-к.5.05.xlsx`
- `3уч-к.5.05.xlsx`
- `4уч-к.01.07.xlsx`
- `Defektniy_Akt_ABC4_Shablon.xlsx`

Beshalasi ham varaq ro'yxati va satr massivi bilan muvaffaqiyatli o'qildi.
Bu test biznes ma'lumotini Supabase/R2ga yozmagan.

## Regression himoyasi

`xlsxReader.test.ts`ga oddiy DEFLATE-siqlilgan `.xlsx` fixture qo'shildi.
U parser `Blob.stream()`siz ham normal Excel faylini o'qishini tekshiradi.

## Gates

- Fokuslangan import/testlar: 83/83 PASS (shu jumladan haqiqiy 4 yo'l XLSX
  hamda ABC4 shabloni read-only smoke)
- Functions TypeScript: PASS
- Brauzer TypeScript: PASS
- Vite build: PASS
- Lint: PASS, oldindan mavjud warnings
- `npm run tekshir`: PASS
- Governance: PASS; faqat `CURRENT_STATE.md`dagi oldindan mavjud `main_sha`
  eskirganligi haqida warning bor.

## Keyingi amal

Recovery branch push qilingach Cloudflare Preview avtomatik yig'iladi.
Operator Previewda 4 yo'l XLSXni `Paket papkasi` orqali yana tanlaydi:
avval varaq tahlili chiqishi, so'ng operator tasdiqi, undan keyin import
yo'li ishlashi kerak. Agar API/R2 qatlamida yangi xato chiqsa, UI xabaridagi
aniq kod bilan alohida diagnostika qilinadi; bu parser xatosini qayta
niqoblamaydi.
