# T2 PTO — Shartnoma qamrovi va nakrutka V1

## Holat

- BASE: `origin/main` @ `0079c4a7aeed94f241744494340e8d77eae67f26`
- BRANCH: `codex/pto-res-boundary-main-v1`
- HEAD: `99e16e8`
- Production DB tekshiruvi: `t2_shartnoma_qator_qamrov` mavjud emas; mavjud
  nakrutka RPC lar bor, lekin contract-qator scope yo'q.
- Production/main/GAS/Cloudflare o'zgartirilmadi.

## Qabul qilingan arxitektura

`t2_qator` yagona kanonik smeta qatori bo'lib qoladi. Yangi qatlam qatorni
ko'chirmaydi va o'chirmaydi; `t2_shartnoma_qator_qamrov` faqat shartnoma
kesimidagi qarorni saqlaydi:

- yozuv yo'q: qator kiritilgan deb qaraladi;
- `kiritilgan`: qator shu shartnoma hisobiga kiradi;
- `chiqarilgan`: qator shu shartnoma hisobidan chiqariladi;
- `hajm_override`: ixtiyoriy, faqat shu shartnoma hisobidagi summani
  proporsional o'zgartiradi; `t2_qator` asl hajm/summasi o'zgarmaydi;
- chiqarish yumshoq bo'lib, sabab, actor, operation_id va versiya bilan
  auditlanadi.

Shu model bir shartnoma ostidagi barcha obyektlarga bir xil qo'llanadi. Yangi
qo'shimcha yoki replacement qatorlar mavjud kanonik qator commandlari orqali
yaratiladi va qamrov oynasida avtomatik ko'rinadi; parallel smeta jadvali
yaratilmaydi.

## O'zgargan yo'llar

- `supabase/migrations/20261027090000_t2_shartnoma_qamrov_v1.sql`
  - qamrov jadvali, RLS/revoke;
  - actor/tenant/object/line scope tekshiruvli read/write RPC;
  - idempotency va optimistic locking;
  - mavjud `t2_nakrutka_koef_ol_v1` va `t2_obyekt_nakrutka_v1` ni shartnoma
    qamroviga mos additive `create or replace` bilan kuchaytiradi.
- `supabase/migrations/20261027090000_t2_shartnoma_qamrov_v1.acceptance.sql`
  - izolyatsiyalangan DB uchun PASS sentinel va majburiy acceptance ssenariylari.
- `supabase/migrations/20261027090000_t2_shartnoma_qamrov_v1.rollback.sql`
  - faqat foydalanishdan oldingi rollback; mavjud nakrutka funksiyalari
    avvalgi ta'riflariga tiklanadi, keyin yangi qatlam olib tashlanadi.
- `frontend/functions/api/sb.ts`
  - faqat nomlangan `shartnoma_qamrov_ol_v1` read RPC allow-listga qo'shildi.
- `frontend/functions/api/sb-yoz.ts`
  - faqat nomlangan `shartnoma_qamrov_saqla` write command allow-listga
    qo'shildi; actor sessiyadan olinadi.
- `frontend/src/api/t2-shartnoma-qamrov.ts`
  - typed read/write adapter.
- `frontend/src/admin/sahifalar/NakrutkaNative.tsx`
  - shartnoma tanlash, contract coefficient override, obyektlar filtri va
    qatorlarni kiritish/chiqarish paneli.
- `frontend/src/api/t2-shartnoma-qamrov.test.ts`
  - adapter payload regression testlari.
- `frontend/testlar/t2_kompaniya.test.cjs`
  - writer allow-list 93 ta domen amaliga yangilandi.

## Muhim xavfsizlik qoidalari

- Client yuborgan `actor_id` ishlatilmaydi.
- Boshqa tenant, boshqa shartnoma yoki boshqa obyekt qatori RPC ichida
  rad etiladi.
- Qatorni hard-delete qilish yo'q.
- Takroriy `operation_id` avvalgi natijani qaytaradi.
- Eski versiya bilan yozish `VERSION_CONFLICT` qaytaradi.
- Contract-specific nakrutka explicit contract-object bog'lanishini
  tekshirmasdan hisoblanmaydi.

## Tekshiruvlar

- `npx tsc -b --force`: PASS
- `npm run build`: PASS
- `npm run test`: PASS — 71 fayl, 496 test
- yangi adapter testlari: PASS — 2 fayl, 5 test
- `npm run lint`: PASS — faqat oldindan mavjud warninglar
- `npm run tekshir`: PASS
- `node ops/governance-check.cjs`: PASS; CURRENT_STATE main_sha bo'yicha
  oldindan mavjud stale warning bor.
- `git diff --check`: PASS
- Supabase production: faqat read-only migration/function inventory bajarildi;
  yangi migration qo'llanmadi.

## Keyingi integratsiya qadami

1. Migrationni isolated/test DB'da forward + acceptance bilan sinash.
2. `t2_shartnoma_qator_qamrov` mavjud bo'lmaguncha Preview'dagi yangi panel
   qamrov RPC xatosini xavfsiz ko'rsatadi; eski kompaniya nakrutkasi ishlashda
   davom etadi.
3. Acceptance o'tgach migrationni alohida release qarori bilan qo'llash.
4. So'ng shartnoma selector + qamrov panelini authenticated Preview smoke'da
   tekshirish: ikkita obyekt, bitta chiqarilgan resurs, bitta qo'shilgan
   kanonik qator, ikki xil shartnoma koeffitsienti.
