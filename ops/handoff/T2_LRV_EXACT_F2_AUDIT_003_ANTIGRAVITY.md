# T2-LRV-EXACT-F2-AUDIT-003

**Role:** INDEPENDENT AUDITOR
**Date:** 2026-09-03
**Target Claude:** `T2_LRV_CONTROL_001_CONTRACT.md`
**Target Codex:** Commit `bbf55c8`

## FINAL RESULTS

- **COMPANY_CONTROL:** PASS (Ko'rib chiqildi, T2_COMPANY_CONTROL_REAUDIT_003_ANTIGRAVITY.md)
- **F2_EXACT_AMOUNT:** **FAIL** (P0)
- **F2_PRICE_SOURCE:** **FAIL** (P0)
- **F2_PROVENANCE:** **PASS**
- **PARALLEL_TRUTH:** **FAIL** (ADAPT_REQUIRED)
- **CATALOG:** **PASS**
- **ADDITIONAL:** **PASS**
- **REPLACEMENT:** **PASS**
- **BRIDGE:** **PASS**

---

## DETAILED FINDINGS

### 1. F2_EXACT_AMOUNT: FAIL (P0)
**Claude Kontrakti:** `t2_akt_qator.summa` ustuni Postgres'da `GENERATED ALWAYS AS STORED (hajm * narx)` deb belgilangan.
**Tahlil:** Ushbu qaror to'g'ridan-to'g'ri User Law'ga ziddir. Agar Source hujjatida `qty=10, price=123.45, amount=1234.49` bo'lsa, avtomatik `hajm*narx` generator uni `1234.50` ga aylantirib, Asl (Truth) qiymatni buzib yuboradi. "Generated amount is okay" degan tushuntirish qabul qilinmaydi. Asl source amount (summa) qat'iy saqlanishi kerak.

### 2. F2_PRICE_SOURCE: FAIL (P0)
**Claude Kontrakti:** `t2_akt_yarat` funksiyasi F2 narxi (price) mavjud bo'lmaganda va `narx_yoq` bayrog'i jo'natilmaganda, avtomatik ravishda smeta narxiga (fallback) murojaat qiladi.
**Tahlil:** Fallback qilish noto'g'ri. Agar F2 narx manbasi mavjud bo'lmasa, tizim smeta narxini soxtalashtirmasdan rad etishi (explicit exception) shart.

### 3. F2_PROVENANCE: PASS
**Codex (bbf55c8):** Har bir F2 qatori (`t2_lrv_document_line`) aniq `revision_id`, `external_row_key` va `raw_snapshot` larni saqlaydi. Tizim qaysi fayldan, qaysi qatordan va asl son/narx nima ekanini to'liq isbotlay oladi.

### 4. PARALLEL_TRUTH: FAIL (ADAPT_REQUIRED)
**Codex (bbf55c8):** Haqiqiy mustaqil F2 amount (source-certified) ni yaratishda Codex mavjud `t2_qator` va `t2_akt_qator` ga moslashish (adapt) o'rniga, butunlay yangi parallell jadvallar (`t2_lrv_entity`, `t2_lrv_approved_f2`, `t2_lrv_document`) tuzib chiqqan.
**Tahlil:** To'g'ri arxitektura bo'lsa-da, bu mavjud tizimda (legacy jadvallar bilan) **Parallel Canonical Truth** ni keltirib chiqaradi. Buni avtomatik qabul qilib bo'lmaydi; mavjud `t2_akt_qator` ga birlashtirilishi (adapt qilinishi) talab etiladi.

### 5. CATALOG: PASS
Codex kodi: `exact identity automatic`, shubhali obyektlarda auto merge yo'q. Dastlabki narx (price) invent qilinmasligi ta'minlangan (Cross-object price leak yo'q).

### 6. ADDITIONAL & REPLACEMENT: PASS
Codex: Qatorlar o'zining mustaqil entity va version'lariga ega. `replacement_of_id` ishlatilgan, eski (OLD) o'zgarmas (unchanged) qoladi, text nomida hech qanday vizual axlat (`[ZAMENA]`) o'rnashmagan. O'z resource bolalariga ega.

### 7. BRIDGE (SHEETS ↔ SUPABASE): PASS
Codex: `t2_lrv_sync_event` va `t2_lrv_sync_conflict` jadvallari (frozen_f2, stale_version, row_mapping_missing) konfliktlarini fail-closed rejimda mukammal hal etadi. Offline, duplicate, echo ssenariylar yopilgan.

---

## CONCLUSION

**P0 BLOCKERS:**
- O'chirilishi kerak bo'lgan `GENERATED ALWAYS` (hajm * narx) generator.
- Olib tashlanishi kerak bo'lgan "Smeta narxiga Fallback" xatti-harakati.
- Yangi parallell yechim (Codex jadvallari) va joriy `t2_qator`/`t2_akt_qator` o'rtasida qaror qabul qilinishi (Adaptation).

**READY_FOR_REAL_PARK_VERTICAL_SLICE: NO** (Kritik hisob-kitob xatolari va Parallel Truth saqlanib qolmoqda).
