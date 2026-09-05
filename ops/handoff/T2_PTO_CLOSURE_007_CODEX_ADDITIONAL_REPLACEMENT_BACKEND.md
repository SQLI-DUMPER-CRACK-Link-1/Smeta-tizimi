# T2-PTO-CLOSURE-007-CODEX-ADDITIONAL-REPLACEMENT-BACKEND

**Rol:** Implementation engineer (Codex)
**Branch:** yangi, `codex/t2-additional-replacement-backend-v1` — base:
`origin/integration/next-main-release-v1`
**Nega HOZIR xavfsiz**: bu ish HECH QANDAY kanonik route'ga tegmaydi —
audit tasdiqladi (`ops/handoff/T2_PTO_DAILY_WORKFLOW_CLOSURE_007.md`),
Additional/Replacement uchun HALI HECH QANDAY route yo'q. Egasi kutayotgan
katta route-cutover qaroridan MUSTAQIL — o'sha qaror qanday bo'lishidan
qat'i nazar, bu backend baribir kerak bo'ladi.

## Vazifa

`frontend/src/api/t2-additional-replacement.ts` (allaqachon merge
qilingan) `amal: 'qoshimcha_ish_yarat_v1'`, `'zamena_ish_yarat_v1'`,
`'resurs_bola_qosh_v1'` yuboradi, lekin bu RPC'lar HECH QANDAY
migratsiyada yo'q (tasdiqlangan: `grep -rl` bo'yicha 0 natija). Yoz:

1. Yangi migration: `supabase/migrations/20260924120000_t2_additional_replacement_v1.sql`
   (yoki keyingi bo'sh timestamp — `ls supabase/migrations/` bilan tekshir).
2. Uchta RPC, aniq shu nomlar bilan (client kontrakt bilan mos kelishi
   shart — `t2-additional-replacement.ts`ning `yozAmali()` chaqiruvidagi
   maydon nomlarini AYNAN ko'chir):
   - `t2_qoshimcha_ish_yarat_v1(p_kompaniya_id, p_actor_id, p_obyekt_id,
     p_ota_qator_id, p_nom, p_birlik, p_hajm, p_kod, p_keyin_qator_id,
     p_sabab, p_dalil_hujjat_id, p_operation_id, p_kutilgan_versiya)`
   - `t2_zamena_ish_yarat_v1(p_kompaniya_id, p_actor_id, p_obyekt_id,
     p_almashtirilayotgan_qator_id, p_ota_qator_id, p_nom, p_birlik,
     p_hajm, p_kod, p_keyin_qator_id, p_sabab, p_dalil_hujjat_id,
     p_operation_id, p_kutilgan_versiya)`
   - `t2_resurs_bola_qosh_v1(p_kompaniya_id, p_actor_id, p_obyekt_id,
     p_ota_qator_id, p_tur, p_nom, p_birlik, p_hajm, p_kod,
     p_keyin_qator_id, p_sabab, p_dalil_hujjat_id, p_operation_id,
     p_kutilgan_versiya)`
3. **QAT'IY QOIDA (LRV Control qonuni, `T2_LRV_PRODUCT_AUDIT_001_ANTIGRAVITY.md`
   Section 6-7):**
   - Mavjud `t2_qator` ustida quriladi (yangi `insert into t2_qator`,
     `tur`ga mos: qo'shimcha ish → `bl`/`rs`/`mat` kabi mavjud turlardan
     mos biri; resurs bola → `p_tur` bo'yicha `rs`/`mat`/`ob`).
   - `t2_qator`ga allaqachon bor `change_type`/`replaces_line_id`/
     `change_id` ustunlaridan foydalan (`20260920120000_t2_akt_qator_
     certified_v1.sql`da qo'shilgan — FK `t2_smeta_ozgarish`ga).
   - Zamena: ESKI qator (`p_almashtirilayotgan_qator_id`) HECH QANDAY
     `update`ga uchramaydi (nom/kod/birlik o'zgarmaydi). YANGI qator oddiy
     `insert`, `replaces_line_id = p_almashtirilayotgan_qator_id`.
   - `[ZAMENA]`/`[QO'SHIMCHA]` kabi matn markerlar NOMGA QO'SHILMAYDI —
     QAT'IY TAQIQ. Tur/relation orqali ajratiladi (`q.zamena`/`q.qoshimcha`
     bool ustunlar allaqachon `t2_qator`da bor — ulardan foydalan).
   - Avtorizatsiya: `t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,
     p_actor_id)` (mavjud, boshqa RPC'larda qanday chaqirilganini
     `t2_price_basis_yarat_v1` yoki `t2_object_create_v1`dan nusxa ol).
   - Idempotentlik: `p_operation_id` orqali (`t2_qator.operation_id_uniq`
     indeksi allaqachon bor — `on conflict` yoki oldindan tekshirish).
   - Optimistic lock: `p_kutilgan_versiya` — ota qator versiyasiga
     solishtirib `STALE_VERSION` qaytar (agar mos kelmasa).
   - Audit: `t2_audit_yoz(...)` chaqir (mavjud pattern).
4. `frontend/functions/api/sb-yoz.ts`ning `AMALLAR` whitelist'iga uchala
   `amal`ni qo'sh — endi RPC bor, xavfsiz ochish mumkin.
5. `.rollback.sql` va `.acceptance.sql` yoz.
6. **Sinov — SINTETIK ma'lumot bilan, HAQIQIY production'da, keyin
   TOZALAB**: yangi sintetik `t2_qator` yarat (nom="_TEST_ADDREPL_
   O'CHIRISH_MUMKIN"), uchala RPC'ni chaqir, natijani tekshir
   (`replaces_line_id` to'g'ri o'rnatilganmi, eski qator o'zgarmaganmi,
   nomda marker yo'qmi), **SO'NG o'zing yaratgan test qatorlarni
   `delete from t2_qator where nom like '_TEST_ADDREPL%'` bilan TOZALA**.
   Haqiqiy 17521 qatorga HECH TEGMA.

## QAT'IY CHEKLOVLAR

- Faqat shu bitta yangi migratsiya faylini yoz/qo'lla — boshqa hech
  qanday migratsiyaga tegma.
- Haqiqiy production ma'lumotiga (mavjud 8 obyekt/17521 qator) hech
  qanday yozish/o'zgartirish — faqat o'zing yaratgan, o'zing tozalaydigan
  sinov qatorlar.
- `frontend/src/api/t2-additional-replacement.ts`ning mavjud TYPE
  interfeysini o'zgartirma (RPC parametr nomlari shunga mos bo'lsin, aksi
  emas).
- `main`, GAS, Cloudflare deploy — tegma.

## Report

`ops/handoff/T2_PTO_CLOSURE_007_CODEX_ADDITIONAL_REPLACEMENT_BACKEND_REPORT.md`
— qaysi RPC, qanday sinaldi (aniq natija bilan), tozalash tasdiqlandimi,
gates natijasi.
