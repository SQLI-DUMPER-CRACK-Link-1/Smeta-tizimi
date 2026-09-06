# TIZIM_02 Google Bridge — o‘rnatish

Bu loyiha eski `Smeta tizimi/` GASidan mutlaqo alohida. U kanonik hisob-kitob
qilmaydi; Supabase/Cloudflare haqiqat, Google Sheet esa boshqariladigan ishchi
proyeksiya.

1. Google Drive’da `TIZIM_02 — BOSHQARUV` nomli yangi Spreadsheet yarating.
2. Shu jadvalda **Extensions → Apps Script** oching. Bridge bound-script:
   boshqaruv jadvali, trigger va nazorat tablari bitta aniq joyda bo‘lishi uchun
   shunday tanlandi.
3. `tizim02/gas/appsscript.json` hamda `tizim02/gas/T2Bridge.gs` fayllarini
   yangi Apps Script loyihasiga aynan shu nomlar bilan joylang. `Smeta tizimi/`
   fayllaridan hech narsa nusxalanmaydi.
4. Spreadsheet URLidagi `/d/` va keyingi `/edit` orasidagi qiymat — Spreadsheet
   ID. Uni Script Properties’da `T2_BRIDGE_CONTROL_SPREADSHEET_ID`ga yozing.
5. Script Properties (Project Settings → Script properties):

   - `T2_BRIDGE_CONTROL_SPREADSHEET_ID` = 4-qadamdagi boshqaruv Spreadsheet ID;
   - `T2_BRIDGE_API_URL` = Cloudflare’dagi `https://<sizning-pages-domeningiz>/api/t2-bridge`;
   - `T2_BRIDGE_SHARED_SECRET` = Cloudflare’da **aynan bir xil**, yangi uzun tasodifiy secret;

   Secretlarni Gitga, katakka yoki chatga yozmang.
6. Cloudflare Pages environmentiga quyidagilarni qo‘shing: `T2_BRIDGE_SHARED_SECRET`
   (5-qadamdagi qiymat) va `T2_BRIDGE_ACTOR_ID` (bridge nomidan yozishga ruxsatli,
   faol T2 foydalanuvchi IDsi). `SUPABASE_URL`/`SUPABASE_KEY` mavjud Pages secretlari
   bo‘lib qoladi, Google’ga berilmaydi.
7. Apps Script editorida `t2BridgeBootstrap` funksiyasini bir marta ishga
   tushiring va Google so‘ragan Spreadsheet, external request hamda trigger
   ruxsatlarini tasdiqlang. U `SOZLAMALAR`, `SINXRON`, `NAVBAT`, `PROEKSIYALAR`,
   `HUJJATLAR`, `XATOLAR`, `CONFLICTLAR`, `AUDIT` tablarini va 5-daqiqalik
   `t2BridgeTick` triggerini yaratadi.
8. `PROEKSIYALAR` tabiga bitta satr qo‘shing:
   `obyekt_id | spreadsheet_id | tab | last_projection_hash | last_synced_at | holat`.
   Ikkinchi Spreadsheet ID — obyekt ishchi jadvalining URLidan olinadi; `tab`
   masalan `ISHCHI SMETA`. Ikkinchi obyekt uchun shu kodni emas, faqat yana bir
   satrni qo‘shasiz.
9. Birinchi sinov: `t2BridgeTick`ni qo‘lda ishlating. Obyekt tabida yashirin
   `t2_entity_id`, `t2_entity_version`, `t2_projection_hash` ustunlari paydo
   bo‘ladi. Ularni tahrir qilmang. Sort/move ular bilan birga yuradi.
10. `fakt_hajm`ni ruxsat etilgan bir qatorida o‘zgartiring, yana `t2BridgeTick`
    ishga tushiring. Cloudflare serveri eski jami bilan solishtiradi; mos bo‘lsa
    kanonik Fakt hujjati yaratiladi va keyingi proyeksiya Website hamda Sheetda
    bir xil qiymatni ko‘rsatadi. Bir paytda Website o‘zgargan bo‘lsa yozish
    rad qilinadi va `CONFLICTLAR` tabiga tushadi — jim last-write-wins yo‘q.

`clasp` bilan ishlatish ixtiyoriy: Apps Script loyihasida **Project Settings →
Script ID**ni olib, lokal alohida papkada `clasp clone <SCRIPT_ID>` qiling,
keyin yuqoridagi ikki faylni joylab `clasp push` bering. Web App deployment
kerak emas: trigger Pages API’ga chiqadi. Bridge T1 GASdan Script ID, property,
trigger va kod jihatidan alohida qoladi.
