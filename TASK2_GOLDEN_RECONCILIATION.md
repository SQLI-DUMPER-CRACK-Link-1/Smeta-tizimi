# TASK 2 — Golden Dataset Reconciliation (Amfiteatr) — 2026-08-28

> GPT master reja TASK 2: "Amfiteatr 4,937 qatorli golden migration/
> reconciliation uchun aniq execution plan ber." Bajarildi — QISMAN,
> haqiqiy cheklov bilan (pastda tushuntirilgan).

## ⚠️ Muhim topilma — "4,937" raqami ESKIRGAN

Amfiteatr (`t2_obyekt.id=6`) da hozir **10,537 ta qator** bor
(`t2_qator`), "4,937" emas. Ikki ehtimol:
1. Smeta (Tizim_01 Sheets) haqiqatan o'sgan — yangi ish/material
   qo'shilgan (eng ehtimolli, chunki loyiha faol ishlaydi).
2. "4,937" allaqachon eskirgan reference raqam (hujjat necha oy oldin
   yozilgan).

**Bu o'z-o'zidan MUAMMO EMAS** — lekin "golden dataset" degan narsa
DOIM yangilanib turishi kerak, statik raqam emas. Reconciliation
skripti HAR SAFAR JORIY Tizim_01 holatini o'qishi kerak, qattiq
yozilgan "4,937" bilan emas.

## ⚠️ Haqiqiy cheklov — men bu yerdan Tizim_01 (GAS)ni JONLI so'ray olmayman

Bu muhitda GAS Web API (`GAS_URL`/`GAS_TOKEN`) maxfiy kalitlariga
kirish yo'q — ular faqat Cloudflare Pages production muhitida bor.
Men faqat **Postgres (Tizim_02) ichida** so'rov yubora olaman.
Shuning uchun to'liq "Tizim_01 vs Tizim_02" solishtirish **hozir
BAJARILMADI** — buni yoki (a) foydalanuvchi/Antigravity haqiqiy
production muhitda ishga tushirishi, yoki (b) men uchun GAS'da yangi
`apiReconciliationHisobot` funksiyasi yozib, uni chaqirib olib kelish
kerak (bu YANGI KOD — TASK 1/2 "yangi feature yozma" qoidasiga zid,
shuning uchun ATAYLAB qilmadim).

## ✅ Men BAJARA OLGANIM — Postgres ICHKI izchillik tekshiruvi

Bu ham qimmatli: agar Postgres o'zining ICHIDA izchil bo'lmasa,
Tizim_01 bilan solishtirish ma'nosiz. Natija (Supabase MCP, jonli):

| Tekshiruv | Natija |
|---|---|
| `t2_qator` qator soni (obyekt_id=6) | **10 537** |
| `t2_qator_holat` qator soni (bir xil view, boshqa manba) | **10 537** ✅ mos |
| Jami smeta hajmi (`t2_qator_holat.smeta_hajm` yig'indisi) | 921 740.12 |
| Jami FAKT hajmi | **0** |
| Jami F2 hajmi | **0** |
| `t2_akt`/`t2_akt_qator` yozuvlari (obyekt_id=6) | **0 ta** |

**Xulosa**: `t2_qator` ↔ `t2_qator_holat` mos keladi (10 537 = 10 537) —
bu ICHKI izchillik yaxshi belgi. Lekin Amfiteatr'da hali BITTA HAM
F2/Fakt hujjati yo'q — ya'ni F2/Fakt/qoldiq zanjirining reconciliation
qismi bu obyekt uchun HALI SINALMAGAN (0=0 — trivial, real tekshiruv
emas). Reconciliation to'liq bo'lishi uchun kamida bitta F2 yoki Fakt
hujjati kerak (`TestFakt.tsx` orqali, Antigravity yaqinda qurgan).

## Tavsiya etilgan keyingi qadam (bajarilmadi, sabab yuqorida)

1. Production muhitda (Cloudflare Pages, real `GAS_URL` bilan)
   `/admin/tezlik` yoki shunga o'xshash sahifadan Amfiteatr'ning
   HOZIRGI Tizim_01 jami summasini (LRV_PLUS dan) qo'lda o'qib,
   yuqoridagi Postgres 921 740.12 raqami bilan solishtirish — ODAM
   qiladigan, 5 daqiqalik tekshiruv (skript emas).
2. Kamida bitta obyektda F2/Fakt to'liq zanjirini sinash (Amfiteatr
   yoki boshqa) — F2_REESTR kafolatini ("Hujjat Jami − Yozilgan Jami =
   0") haqiqiy hujjat bilan tekshirish.
3. Agar bu ikkalasi mos kelsa — "golden dataset" rasmiy deb e'lon
   qilinadi va shu raqamlar (10 537 / 921 740.12) YANGI reference
   sifatida yoziladi, "4,937" chiqarib tashlanadi.
