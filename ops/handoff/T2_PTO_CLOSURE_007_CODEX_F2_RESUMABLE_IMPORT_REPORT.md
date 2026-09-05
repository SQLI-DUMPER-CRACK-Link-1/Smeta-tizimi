# T2-PTO-CLOSURE-007 — F2 resumable import, Codex poydevori

## Holat

**SOURCE_READY, UI_WIRING_PENDING.** Bu branch faqat ledgerdagi Codex
ownershipiga tegadi: import-job migratsiyasi va uning qabul/rollback dalillari.
`F2ImportNative.tsx`, API gateway va Cloudflare funksiyalari ushbu lane
ownershipiga kirmaydi; ular ulanmasdan 30 ming qatorlik foydalanuvchi oqimi
yakunlangan deb e'lon qilinmaydi.

## Qayta ko'rib chiqishda topilgan va yopilgan xatolar

1. `operation_id` ixtiyoriy edi. Endi import job uchun majburiy va bir
   kompaniya ichida qayta urinishda ayni job qaytadi.
2. `total_rows` noma'lum/cheksiz edi. Endi 1–100000 oralig'i qat'iy; bu
   brauzer xotirasini cheklashning ochiq kontrakti, 20 minglik eski devor emas.
3. Job progress manfiy yoki mantiqsiz delta qabul qilishi mumkin edi. Endi
   `matched + unmatched <= processed`, manfiy delta yo'q, terminal job qayta
   yurmaydi va `completed` faqat hamma qator ishlanganda mumkin.
4. Draft mappingda optimistic lock yo'q edi. Endi mavjud qator har doim
   `expected_versiya` bilan yoziladi; eski oyna `STALE_DRAFT_VERSION` oladi.
   Per-job advisory lock ko'p satrli saqlashni ham seriallashtiradi.
5. Qayta ochilgan sahifa durable mappingni o'qiy olmas edi. Yangi
   `t2_f2_import_draft_royxat_v1` aynan kanonik qatorlar va versiyalarni
   qaytaradi; localStorage faqat ikkilamchi kesh bo'lishi mumkin.
6. Oldingi audit yozuvi job IDni obyekt ID o'rniga yuborardi va foreign-key
   xatosi bilan job yaratilishini to'xtatardi. Audit endi haqiqiy `obyekt_id`
   bilan yoziladi.
7. Barcha besh RPC `PUBLIC`, `anon`, `authenticated`dan revoke qilinib,
   faqat `service_role`ga aniq grant berildi. Source document berilsa uning
   kompaniya/loyiha/obyekt doirasi ham tekshiriladi.

## Jonli, lekin rollback qilingan sinov

Production loyiha `tuoyrzadkgoltpqkdiyx`da yangi jadval va RPC yo'qligi
read-only tekshirildi. Quyidagi sinovlarning har biri `BEGIN ... ROLLBACK`
ichida bajarildi, hech qanday job/draft/audit yozuvi saqlanmagan:

- DDL va barcha besh RPC kompilyatsiyasi: PASS.
- Faol obyekt/aktor bilan job yaratish: PASS.
- 500 qatorlik checkpoint (`row=32000`) va `running` holatiga o'tish: PASS.
- Draftni saqlash, eski versiyani rad etish (`STALE_DRAFT_VERSION`), joriy
  versiya bilan yangilash hamda durable ro'yxatdan qayta o'qish: PASS.
- Begona aktor bilan job yaratish: `42501` / AUTH_REJECTED, PASS.

## Qolgan majburiy ulash

Claude yoki aniq ownership berilgan integrator quyidagilarni bitta feature-flag
ostida ulaydi:

1. Verified sessiondan olingan actor bilan service-only API adapter;
   actor browser request body'dan ishonch manbasi bo'la olmaydi.
2. `F2ImportNative`da 20 ming qatorlik rad etish o'rniga 2–5 minglik batch,
   `t2_f2_import_job_ilgarilash_v1` checkpointi va `draft_saqla_v1` yozuvi.
3. Sahifa qayta ochilganda `job_holat_v1` + `draft_royxat_v1`dan tiklash.
4. 30 ming qatorlik sintetik XLSX bilan feature-flag ON oqimining end-to-end
   browser testi. F2ning exact source yozish yo'li (`t2_akt_yarat_v2`) bu
   integratsiyada o'zgarmaydi.

## Production

**Qo'llanmagan.** Ledgerdagi `production_write_allowed: false` holati
saqlandi. Bu branch production/main/GAS/Cloudflarega tegmaydi.

## Rollback

`20260922120000_t2_f2_import_job_v1.rollback.sql` yangi read RPCni ham
o'chiradi va avvalgi PRE-USE qoidasini saqlaydi: real job/draft bo'lsa drop
qat'iyan rad etiladi.

## Handoff

| Maydon | Qiymat |
|---|---|
| Base | `883ef2079da46fddfe9c6df7ff4e451256dc7564` |
| Branch | `codex/t2-f2-resumable-import-v1` |
| Migration | `20260922120000_t2_f2_import_job_v1` |
| Production/main | Tegilmagan |
| Claude integratsiyasiga tayyor | **NO — API/UI ownership ulanmaguncha** |
