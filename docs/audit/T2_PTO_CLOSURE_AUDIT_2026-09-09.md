# T2 PTO CLOSURE AUDIT — 2026-09-09

**Topshiriq:** `docs/ai/CLAUDE_CODE_T2_PTO_TOPSHIRIQ_2026-09-09.md` (Bosqich 0).
**Bajaruvchi:** Claude Code. **Bosqich:** 0 — audit va plan.

Status lug'ati: `PROVEN | PARTIAL | BLOCKED | UNPROVEN | MISSING | LEGACY_REFERENCE_ONLY`.

> Qoida: dalilsiz hech narsa `PROVEN` emas. Quyidagi har bir `PROVEN` yozuv
> ostida aniq fayl:qator, buyruq natijasi yoki jonli baza o'qishi turadi.

---

## 0. Boshlang'ich holat (majburiy tekshiruv, topshiriq §3)

| Tekshiruv | Natija |
|---|---|
| `git status --short --branch` | `## main...origin/main` — **ishchi daraxt toza, dirty fayl yo'q** |
| `git diff --stat` | bo'sh |
| Branch divergensiyasi | `main` == `origin/main` (`cee1c85` dan keyin rebase qilindi) |
| Saqlanishi kerak bo'lgan dirty ish | **yo'q** — hech narsa yo'qotilmadi |

### Topshiriqda ko'rsatilgan authority hujjatlar

| Hujjat | Holat |
|---|---|
| `CLAUDE.md` | BOR (shim → `AGENTS.md`) |
| `AGENTS.md` | BOR — haqiqiy boot zanjiri shu yerda |
| `00_BOSH_QONUN.md` | BOR (644 qator) |
| `HERMES_UCHUN_MUAMMOLAR_2026-09-09.md` | BOR |
| `docs/product/PTO_TARGET_STATE.md` | **MISSING** |
| `docs/product/PTO_ACCEPTANCE_MATRIX.md` | **MISSING** |
| `docs/audit/HERMES_FULL_SYSTEM_AUDIT_2026_09.md` | **MISSING** |

**A-1 topilma (MISSING):** topshiriq mavjud emas deb topilgan uchta hujjatga
authority sifatida murojaat qiladi. Ular repoda ham, boshqa nom ostida ham yo'q
(`find` bilan tekshirildi). Ya'ni PTO target state va acceptance matritsasi
uchun yozma manba **yo'q** — acceptance mezonlari faqat shu topshiriq
faylining o'zida. Egasi ularni bermaguncha, acceptance yagona manbasi
`docs/ai/CLAUDE_CODE_T2_PTO_TOPSHIRIQ_2026-09-09.md` §9 hisoblanadi.

`AGENTS.md` ko'rsatgan haqiqiy zanjir o'qildi: `docs/governance/CONSTITUTION.md`,
`docs/governance/CURRENT_STATE.md`, `ops/ACTIVE_TASKS.json`.

---

## 1. GAP MATRIX

### P0-A — Auth, tenant va data isolation

| Talab | Hozirgi kod | Tizim-2 canonical yechim | Dalil | Status | Keyingi ish |
|---|---|---|---|---|---|
| `/api/payment` authsiz moliyaviy RPC qolmasin | `functions/api/payment.ts` — **29 qator, auth YO'Q, signature YO'Q, replay himoya YO'Q, summa rekonsiliatsiyasi YO'Q**. `transaction_id` va `amount` to'g'ridan-to'g'ri request body'dan olinib, service-role kalit bilan `t2_tolov_tasdiqla` ga uzatiladi | Endpoint olib tashlanadi (frontendda birorta chaqiruvchi yo'q) | `payment.ts:4-21`; `grep -rn "api/payment" src/ functions/` → **0 natija** | **BLOCKED → tuzatildi (§2)** | Egasi to'lov oqimini qayta qursa, signature+replay+reconciliation bilan yangidan yozilsin |
| `/api/upload` session va ownership tekshirsin, R2 key serverdan bo'lsin | `functions/api/upload.ts` — **auth YO'Q, a'zolik tekshiruvi YO'Q**; `kompaniya_id`/`obyekt_id` **klientdan olinib, R2 kalitiga tozalanmasdan** qo'yiladi (`upload.ts:24`) → path traversal; size/MIME allowlist yo'q; overwrite himoyasi yo'q; hash/status/audit yo'q | Kanonik `/api/hujjat-yukla` allaqachon mavjud va to'g'ri: `tekshir()` auth, ikki fazali reserve→put→finalize, sha256, o'lcham chegarasi, `R2_CANONICAL` | `upload.ts:1-48`; `hujjat-yukla.ts:26,77,84,94,101,138,149` | **BLOCKED → tuzatildi (§2)** | — |
| Upload runtime'da ishlaydimi | `upload.ts:38` `ctx.env.R2_ARCHIVE` ga murojaat qiladi. `wrangler.toml` da **faqat `R2_CANONICAL`** bor; izohda dashboarddan binding qo'shish **bloklangani** yozilgan | Kanonik yo'lga o'tkazish | `wrangler.toml:12-16`; `grep R2_ARCHIVE` → faqat `upload.ts:38` | **PROVEN (buzuq edi)** | — |
| `/api/sb` server tomonda scope qilsin | Sessiya majburiy (`tekshir`), company-scoped va global/reference jadvallar ajratilgan, `kompaniya_id` a'zolikka solishtiriladi | Mavjud model saqlanadi | `sb.ts:28,123-130,149,251-271` | **PARTIAL** | Cross-tenant negative test yozilmagan — Bosqich 1 |
| `/api/sb-yoz` ownership + expected version | 1972 qator, alohida tekshirilmadi | — | — | **UNPROVEN** | Bosqich 1 |
| `/api/gas` normal oqimdan chiqarilsin | `CURRENT_STATE.md`: kundalik native LRV/Fakt/F2 oqimida GAS bog'liqligi topilmagan | — | `CURRENT_STATE.md:133 old_gas_boundary` | **PARTIAL** | Allowlist qat'iyligi tekshirilmagan |
| Soxta ma'lumot bo'lmasin (Konstitutsiya) | `functions/api/didox-webhook.ts` — chaqiruvchisiz, authsiz endpoint **to'qilgan sonlar** qaytaradi (`topildi: 5`, `parse_qilingan_qatorlar: 12`) | O'chirish yoki haqiqiy integratsiya | `didox-webhook.ts:11,16` | **BLOCKED** | Egasi qarori: o'chirilsinmi yoki real Didox integratsiyasi yozilsinmi |
| Majburiy security negative testlar | Yo'q | — | — | **MISSING** | Bosqich 1 |

### P0-B — Canonical schema va ownership

| Talab | Hozirgi kod | Dalil | Status | Keyingi ish |
|---|---|---|---|---|
| Migration'lar toza bazada ketma-ket ishlashi | Tekshirilmadi | — | **UNPROVEN** | Bosqich 2 |
| Frontend chaqirayotgan, migration'da yo'q RPC'lar ro'yxati | Tuzilmadi | — | **MISSING** | Bosqich 2 |
| Repo↔prod drift | `CURRENT_STATE.md`: `t2_resource_command_v2` / `t2_mindmap_request_identity_v2` drift **ochiq** deb qayd etilgan | `CURRENT_STATE.md:98` | **PARTIAL** | Bosqich 2 |

### P0-C — Yagona PTO workspace context

| Talab | Hozirgi kod | Dalil | Status | Keyingi ish |
|---|---|---|---|---|
| `Company → Project → Object → Period → Source doc → workspace` yagona konteksti | **`PTOWorkspaceContext` yo'q.** Mavjud: `KompaniyaKontekst.tsx` (faqat kompaniya), `routeScope.ts`, `RuxsatGuard.tsx` | `ls frontend/src/umumiy/kontekst/`; `grep PTOWorkspaceContext` → 0 | **MISSING** | Bosqich 2 |
| Period va source document/revision konteksti | Yo'q | — | **MISSING** | Bosqich 2 |

### P0-D / P1-A — Import, Fakt/F2 moliyaviy yadro

| Talab | Holat | Dalil | Status |
|---|---|---|---|
| F2 import zanjiri oxirigacha ishlashi | **Ishlamayotgan edi — tuzatildi.** `exactWrite` narxi nol qator uchrasa butun faylni rad etardi; haqiqiy faylda 1054 qatordan 164 tasi shunday (`000003` МАШИНИСТОВ — obyektda 782/782 = 100 % narxsiz, bu qoida). Natijada butun bazada `t2_akt_qator` = **0 qator** | commit `da26170`; `HERMES_UCHUN_MUAMMOLAR_2026-09-09.md` §1.8 | **PROVEN (tuzatildi)** |
| `SMETA → FAKT → F2 → QOLDIQ` deterministik, double-count'siz | Jonli bazada rollback tranzaksiyasida uchidan-uchiga tekshirildi: 1020 qator yozildi, akt summasi **1 633 694 097.50**, read-modeldagi barglar summasi **aynan bir xil**, **farq 0.00**; 79 manfiy (storno) qator saqlandi; fantom pul 0 | Ushbu sessiya, Supabase `DO $$ ... rollback` | **PROVEN** |
| `NULL` narx `0` ga aylanmasin | `price_intentionally_absent` bayrog'i bilan yoziladi; `certified_amount` null qoladi | `t2_akt_yarat_v2` (`20260920130000`); `f2-exact-payload.ts` | **PROVEN** |
| Qisman summa yashirilmasin | Yangi qoida: bo'laklarning birida pul yo'q bo'lsa `NEEDS_REVIEW` | `f2-exact-payload.ts` `qismanSumma`; test | **PROVEN** |
| Haqiqiy (rollback'siz) import bajarilishi | **Bajarilmadi** — 1.63 mlrd so'mlik moliyaviy hujjat, egasining tasdig'i kerak | — | **APPROVAL_REQUIRED** |
| Targeted smeta re-import (P1-B) | Yo'q | `HERMES...md` §2.2 | **MISSING** |

### P1-C — LRV_PLUS eksport v2

| Talab (topshiriq §P1-C) | Holat | Status |
|---|---|---|
| parent/child grouping, `№`, code, name, unit, norma, smeta hajm/narx/summa | Bor | **PROVEN** |
| `FAKT`, `F2 OLINGAN`, `F2 OLINISHI MUMKIN`, `OSTATKA` | Bor — har bir qatorda (rz/bl/rs/mat/ob) | **PROVEN** |
| `rz/bl/rs/mat` rangli dizayn | Bor; test faylning **o'z `xl/styles.xml`** i ustidan tekshiradi | **PROVEN** |
| Excel formula | Bor (norma kaskadi, SUMIF, ostatka, F2 mumkin) | **PROVEN** |
| parent total double-count bo'lmasligi | Yashirin `Даража` ustuni + SUMIF | **PROVEN** |
| `rz/bl/rs/mat/ob` tiplari | `ТИП` ustuni | **PROVEN** |
| **`F2` period (oylik) ustunlari** | **YO'Q** — T1 faylida `Mart 2026` kabi oylik uchlik ustunlar bor, eksportda yo'q | **MISSING** |
| **source row/document/revision evidence metadata** | **YO'Q** | **MISSING** |
| **`NULL` → ko'rinadigan `—` yoki Excel blank** | **QISMAN** — narxsiz qatorda `0` yoziladi, `—` emas | **PARTIAL** |
| **narxsiz qatorlar ochiq ogohlantirilishi** | **YO'Q** — eksportda belgilanmaydi | **MISSING** |
| **freeze/filter/grouping** | **YO'Q** — SheetJS CE freeze panes'ni yozmaydi | **MISSING** |
| **≥1000 qatorli va katta fixture acceptance** | **YO'Q** — testlar kichik fixture'da | **MISSING** |
| **export job / memory-safe oqim** | **YO'Q** — brauzerda bir martada quriladi | **UNPROVEN** |
| **file registry/hash/readback** | **YO'Q** | **MISSING** |

**Xulosa:** eksport egasining so'nggi talabini (fakt/smeta/ostatka/F2 har qatorda,
rangli) qondiradi, lekin topshiriq §P1-C ro'yxatining **7 bandi hali yopilmagan**.
`PARTIAL`.

### P1-D — Hujjat va storage

| Talab | Holat | Status |
|---|---|---|
| Kanonik yuklash: reserve→put→finalize, hash, status, audit | `/api/hujjat-yukla` da bor | **PROVEN (source)** |
| Himoyasiz parallel yuklash yo'li bo'lmasligi | `/api/upload` bor edi | **tuzatildi (§2)** |
| Osilib qolgan/arvoh yuklash tozalanishi | `t2_document_registry_v1` kengaytirildi | **PARTIAL** |
| Readback + hash verification (jonli) | Bajarilmadi | **UNPROVEN** |

### Release gate (Konstitutsiya §Release gate)

| Talab | Holat | Status |
|---|---|---|
| Authenticated owner vertical smoke | `CURRENT_STATE.md:16` — egasining haqiqiy sessiyasi yo'qligi sabab **isbotlanmagan** | **BLOCKED** |
| `frontend/functions/**` TS gate | `npm run tekshir` ichida ishlaydi, PASS | **PROVEN** |

---

## 2. Ushbu bosqichda bajarilgan tuzatish (Bosqich 1 — birinchi vertical slice)

**T2-PTO-P0A-UNAUTH-ENDPOINTS-001**

1. `functions/api/payment.ts` — **o'chirildi**. Authsiz, signature'siz,
   replay himoyasiz moliyaviy endpoint; frontendda birorta chaqiruvchisi yo'q edi.
2. `functions/api/upload.ts` — **o'chirildi**. Authsiz, klient boshqaradigan R2
   kalitli, o'lcham/MIME chegarasiz, overwrite himoyasiz; ustiga `R2_ARCHIVE`
   bindingi umuman mavjud emas (ya'ni allaqachon buzuq edi).
3. `src/api/t2-hujjat.ts` `uploadFayl` — kanonik `/api/hujjat-yukla` ga
   o'tkazildi (sha256, `operation_id`, `size` bilan). Uning yagona chaqiruvchisi
   `test02/TestHujjat.tsx` shu bilan **birinchi marta haqiqatan ishlaydi**.
4. `src/api/supabase.ts` `sbFakturaFaylYoz` — **o'chirildi** (chaqiruvchisi yo'q edi).

Dalil: testlar va gate natijalari §3 da.

---

## 3. Keyingi bosqichlar (rejalashtirilgan tartib)

1. **Bosqich 1 (davomi)** — `/api/sb-yoz` ownership/version auditi; cross-tenant
   negative testlar; `didox-webhook` bo'yicha egasining qarori.
2. **Bosqich 2** — frontend chaqirayotgan RPC'lar ↔ migration inventarizatsiyasi;
   toza bazada migration bootstrap testi; `PTOWorkspaceContext`.
3. **Bosqich 3** — targeted smeta re-import (P1-B).
4. **Bosqich 4** — LRV eksport §P1-C ning yopilmagan 7 bandi.
5. **Bosqich 5** — release gate: katta fixture, authenticated owner smoke.

---

## 4. Egasining qarorini talab qiladigan bandlar

1. **Haqiqiy F2 importini bajarish** — 1.63 mlrd so'mlik hujjat productionga
   yoziladi. Kod tayyor va rollback bilan isbotlangan.
2. **`didox-webhook`** — o'chirilsinmi yoki haqiqiy integratsiya yozilsinmi?
   Hozir u to'qilgan sonlar qaytaradi (Konstitutsiya buzilishi).
3. **Yo'q authority hujjatlar** (`PTO_TARGET_STATE.md`,
   `PTO_ACCEPTANCE_MATRIX.md`, `HERMES_FULL_SYSTEM_AUDIT_2026_09.md`) —
   berilsinmi yoki acceptance manbasi shu topshiriq faylining o'zi bo'lib
   qolsinmi?
4. **Authenticated owner smoke** — bu muhitda brauzer bor, lekin egasining
   hisob ma'lumotlari yo'q va ular so'ralmaydi. Smoke'ni egasi bajaradi.
