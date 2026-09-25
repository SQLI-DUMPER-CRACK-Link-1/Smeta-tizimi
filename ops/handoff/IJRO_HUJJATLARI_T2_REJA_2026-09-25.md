# Ijro hujjatlari (АОСР, промежуточная приемка, испытания, лаборатория) — T2 native reja

Sana: 2026-09-25 · Vazifa: `PTO-LINIYA-YAKUN-001` (egasi javoblari) ·
Qaror: `PTO_EGASI_QARORLARI_2026-09-25.md` Q12 — egasi: **(a) Tizim2 ga to'liq
ko'chiramiz**.

Holat: **REJA. Kod va migratsiya yozilmagan.** Sabab — real blanklar yo'q;
Konstitutsiya: shakl o'ylab topilmaydi. Blanklar kelgach shu reja bo'yicha
boshlanadi.

---

## 1. T1 dan nima bor (kod bilan tekshirildi)

| Manba | Nima |
|---|---|
| `Akt generator/Code.js` (GAS, alohida loyiha) | АОСР generatori: `REYESTR` Google Sheet; blank `MASTER_SPREADSHEET` ichidagi `TPL_WITH_SUB` (subpudratchili) va `TEMPLATE_NO_SUB_SHEET` (subpudratchisiz) varaqlari → `AKT_SYSTEM_TEMPLATES` fayli |
| REYESTR ustunlari | `ACT_NUMBER, WORK_NAME, OBJECT_NAME, GEN_NAME, SUB_NAME, CUSTOMER_ORG, PROJECT_ORG, GEN/SUB/TEX/PROJ _FIO/_POS, PROGRESS, PROJECT_DOC, MATERIAL, DEVIATION, START_DATE, END_DATE, NEXT_WORK, ACT_FILE_URL, PDF_URL, SMETA_REF` |
| Blank kataklari | `A6, A7, D9, F11, B31, A33, A38, A42, E45, E46, A50`; komissiya `A13…A24`; imzolar `F55…F64` (subpudratchili/siz farqli) |
| Holatlar | ichki: `DRAFT → CREATED → SYNCED/MOVED …`; imzo: `Не отправлено → … → Подписано обеими сторонами / Возврат на доработку` |
| `Smeta tizimi/45_Hujjatlar.js` | `apiAktIshlar` (fakt > 0 ishlar), `_YASHIRIN_KW` (ФУНДАМЕНТ, АРМАТУР, ГИДРОИЗОЛ …), `apiAktCoverage` ("fakt bor, akt yo'q"), `apiAktSmetadan` |
| `Smeta tizimi/67_AI_Akt.js` | AI faqat matnni tozalaydi; raqam/material o'ylab topilmaydi |
| T2 katalog | `docs/architecture/UZ_CONSTRUCTION_DOCUMENT_CATALOG_AND_TEMPLATES_V1.md`: `aosr_v1` (ShNQ 3.01.01-22, 6-ilova), `aosr_register_v1` |

T1 bog'lanishi `SMETA_REF = obyekt||varaq||qator` — matn; qayta importda
uziladi. T2 da bog'lanish faqat `t2_qator.id`.

## 2. Ma'lumot modeli (additiv migratsiya — egasi ruxsati bilan qo'llanadi)

`t2_ijro_hujjat`
- `id, kompaniya_id, obyekt_id, tur` (`aosr` | `oraliq_qabul` | `sinov` |
  `laboratoriya` | `boshqa`), `raqam` (obyekt ichida unikal, tur bo'yicha),
  `sana, blank_varianti` (`subpudratchili` | `subpudratchisiz`),
- ish mazmuni: `ish_nomi, loyiha_hujjati, materiallar, chetlanishlar,
  boshlanish, tugash, keyingi_ishga_ruxsat`,
- komissiya: `jsonb` (rol, tashkilot, FIO, lavozim — T1 REYESTR ustunlari),
- `holat` (`qoralama → yuborilgan → pudratchi_imzoladi → buyurtmachi_imzoladi
  → imzolangan`; `qaytarilgan`, `bekor`), `imzolangan_fayl` (R2 kalit, sha256),
- `versiya, operation_id, yaratdi, yaratildi, yangilandi` + audit.

`t2_ijro_hujjat_qator` — hujjat ↔ smeta: `ijro_hujjat_id, qator_id →
t2_qator.id, hajm` (qisman hajm mumkin), `izoh`.

`t2_ijro_hujjat_fayl` — laboratoriya protokoli / sertifikat / sinov natijasi
(R2), bir fayl — ko'p hujjat/ish (`ijro_hujjat_id` yoki `qator_id`).

RPC (security definer, a'zolik tekshiruvi): `t2_ijro_hujjat_yarat_v1`,
`_holat_v1`, `_royxat_v1`, `t2_ijro_qamrov_v1` (har ish: fakt hajm,
АОСР bilan qoplangan hajm, farq).

## 3. Generator (hujjat-yozuvchi, H1–H9)

- LRV/Fakt sahifasida ish (bl) tanlanadi → АОСР qoralamasi: ish nomi, hajm,
  materiallar (bolalar `mat`), loyiha hujjati — smetadan; komissiya — obyekt
  tomonlari (`HujjatTomonlari`) dan.
- Shakl: **egasining real blanki** (H1 — asl blank davomi; kataklar xaritasi
  T1 dagi kabi); Excel + PDF. AI faqat matnni tozalaydi (T1 qoidasi).
- Reestr: `aosr_register_v1` — raqamli ro'yxat (Печать китоби o'rnida).

## 4. Nazorat

- "Fakt bor — АОСР yo'q": yashirin ishlar (T1 `_YASHIRIN_KW` + operator
  belgisi) bo'yicha qamrov; Fakt/LRV/F2 sahifalarida signal.
- F2 tayyorlashda: АОСР bilan qoplanmagan yashirin ish — **ogohlantirish**
  (bloklash — egasi qarori (c)).
- Oraliq qabul (ответственные конструкции) va sinov aktlari — o'sha jadval,
  tur bo'yicha.

## 5. T1 dan ko'chish

1. T1 `REYESTR` → bir martalik import (dry-run hisobot: nechta akt, qaysi
   `SMETA_REF` T2 `t2_qator.id` ga moslandi / moslanmadi).
2. Moslanmaganlar — operator qo'lda bog'laydi (taxmin yo'q).
3. GAS generatori faqat o'qish rejimiga, egasi solishtirgach o'chiriladi.

## 6. Egasidan kerak (bularsiz boshlanmaydi)

1. **Real blanklar (Excel):** `AKT_SYSTEM_TEMPLATES` faylidagi
   `TPL_WITH_SUB` va `TEMPLATE_NO_SUB_SHEET` varaqlari; oraliq qabul
   (промежуточная приемка ответственных конструкций) akti; sinov akti
   namunalari; laboratoriya protokoli namunasi. Repo ochiq — fayllar repoga
   qo'yilmaydi, faqat tuzilma (kataklar xaritasi) sintetik testga olinadi.
2. АОСР yo'qligida F2 ni **bloklash** yoki faqat **ogohlantirish**.
3. Migratsiyani production ga qo'llashga ruxsat.
4. T1 REYESTR ga o'qish kirish (bir martalik import uchun).
