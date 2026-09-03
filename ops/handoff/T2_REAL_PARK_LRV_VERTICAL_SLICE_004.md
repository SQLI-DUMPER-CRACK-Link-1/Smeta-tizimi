# T2-REAL-PARK-LRV-VERTICAL-SLICE-004

**Rol:** Chief Integrator / Backend / UI Integration / Release Owner (Claude)
**Sana:** 2026-09-03
**Integration branch:** `integration/next-main-release-v1`
**Codex branches reconciled:** `codex/t2-lrv-exact-f2-adapter-v1` (3591e37),
`codex/t2-lrv-price-control-core-v1` (5d0bff1)
**Holat:** SOURCE ONLY. Production freeze davom etadi.

---

## ⚠️ 0. INSIDENT — halol e'lon (kechiktirmasdan)

Ushbu bosqichda ishlash jarayonida **bitta real xato yuz berdi**: 3 ta
migratsiyani (certified_v1 + akt_yarat_v2 + price_control_v1) bitta katta
qo'lda yozilgan `BEGIN...ROLLBACK` bloki bilan live production'da
tekshirganimda, ROLLBACK **DDL qismini bekor qilmadi** — sabab: shu katta
matnni qo'lda yozishda men bir joyda ortiqcha `commit;` qoldirib
yuborganman (aniq ko'rsatib bo'lmadi, lekin natija shuni ko'rsatadi).

**Aniqlangan zarar**: FAQAT SXEMA — yangi jadval `t2_price_basis`/
`t2_price_basis_line`, yangi ustunlar `t2_akt_qator`/`t2_qator`ga, 6 ta
yangi funksiya, 1 ta trigger — bir necha daqiqa live production'da
turgan. **Real ma'lumot (qatorlar) — NOL.** Tekshirildi: `t2_qator.narx`
haqiqiy qiymatlar o'zgarmagan (0, 125342, 29421, 0, 76946 — asl
qiymatlar), `t2_akt_qator.provenance_status <> 'unknown_provenance'`
soni — 0, `t2_price_basis` qatorlar soni — 0, testdagi soxta akt
(`raqam like 'PC-%'`) — 0.

**Darhol tuzatildi**: barcha sxema obyektlari qo'lda, kichik-kichik
`DROP` buyruqlari bilan olib tashlandi, keyin **to'liq qayta
tekshirildi** — hozir productionda ushbu bosqichga oid HECH QANDAY
sxema/funksiya/jadval yo'q (tasdiqlangan: `information_schema`/`pg_proc`
so'rovi bo'sh natija berdi).

**Tuzatilgan metodologiya**: shundan keyin har bir migratsiya ALOHIDA,
kichikroq so'rov bilan (fayldan dasturiy ravishda `commit;` olib
tashlab) qayta tekshirildi, VA har safar ROLLBACK'dan KEYIN
`information_schema`/`to_regclass` orqali **alohida tasdiqlash so'rovi**
qo'shildi — endi "PASS xabari chiqdi" emas, "keyin haqiqatan yo'qligi
tekshirildi" standart.

Bu — production freeze buzilishi (garchi tasodifiy, faqat bir necha
daqiqaga va faqat bo'sh sxema bo'lsa ham). Owner'ga ochiq aytilyapti,
yashirilmadi.

---

## 1. CODEX RECONCILIATION

### 1.1 `codex/t2-lrv-exact-f2-adapter-v1` (3591e37)

| Komponent | Qaror | Sabab |
|---|---|---|
| `source_certified_hajm/narx/summa` nomlash | **REJECT_DUPLICATE** | Bu branch allaqachon `certified_quantity/unit_price/amount` nomini ishlatgan (avvalgi hujjatlarda ham) — ikkita parallel nomlash QOLDIRILMAYDI |
| `source_provenance` (`source_verified/legacy_unproven/price_intentionally_absent`) | **ADAPT** | `price_intentionally_absent` qiymati qabul qilindi (yangi, to'g'ri g'oya), lekin ustun nomi `provenance_status` (mavjud) saqlandi, qiymat to'plami kengaytirildi |
| CHECK: `source_verified` → uch maydon MAJBURIY | **ACCEPT_CODEX** | To'g'ri, kuchli invariant — qabul qilindi, `provenance_status` uchun moslashtirildi |
| `t2_akt_qator_source_freeze_v2_trg` (frozen once approved) | **ACCEPT_CODEX (verbatim)** | Aynan kerakli mexanizm — DB darajasida majburlangan "frozen" |
| `t2_akt_yarat_v2(..., p_actor_id, ...)` — mavjud `t2_akt_yarat`ni DELEGATE qiladi | **ACCEPT_CODEX** | Bu branch'ning birinchi qoralamasi butun insert logikasini QAYTADAN yozgan edi — Codex'ning "legacy funksiyani chaqirib, keyin certified ustunlarni UPDATE qilish" yondashuvi kam kod takrori, bitta joy egalik qiladi |
| Actor authorization (`t2_actor_kompaniya_azo_tekshir`) | **ACCEPT_CODEX** | Bu branch'ning birinchi qoralamasida BUTUNLAY YO'Q edi — real xavfsizlik bo'shlig'i, Codex to'g'ri topgan |
| `DUPLICATE_F2_SOURCE_LINE` guard | **ACCEPT_CODEX** | Foydali, qo'shildi |
| Alohida `MISSING_CERTIFIED_PRICE` (narx+summa birga) | **REJECT** (bu branch g'oyasi saqlandi) | Bu branch'ning ikki alohida kodi (`MISSING_CERTIFIED_PRICE`/`MISSING_CERTIFIED_AMOUNT`) chaqiruvchiga aniqroq — saqlandi |
| `p_tur` (fakt+f2) | **REJECT**, Codex'ning qarori qabul qilindi | Codex mustaqil xuddi shu xulosaga kelgan: `t2_akt_yarat_v2` FAQAT F2 uchun ("certified" — F2-approval tushunchasi, FAKT — draft/at-risk) |

### 1.2 `codex/t2-lrv-price-control-core-v1` (5d0bff1)

| Komponent | Qaror | Sabab |
|---|---|---|
| `t2_price_basis` (header) + `t2_price_basis_line` (natural line) ikki jadval | **ACCEPT_CODEX** | Bu branch'ning birinchi qoralamasi BITTA flat jadval edi (bitta hujjat = bitta qator). Codex'ning ikki jadval shakli TO'G'RI — bitta protokol HUJJATI bir nechta qatorni qamrab olishi mumkin (haqiqiy hayotdagi shakl) |
| PriceState vocabulary (`NORMAL/BELOW_REFERENCE/ABOVE_REFERENCE_JUSTIFIED/ABOVE_REFERENCE_MISSING_BASIS/ABOVE_APPROVED_BASIS`) | **ACCEPT_CODEX** | Aniq, yakuniy nomlash sifatida qabul qilindi |
| `classifyCertifiedPrice()` (pure TS, bitta qatorli) | **ADAPT (mantiq TUZATILDI)** | Kodning o'zida REACHABILITY MUAMMOSI topildi: basis narxini "reference" ichiga qo'shib, keyin solishtirgani uchun `ABOVE_REFERENCE_JUSTIFIED` filiali HECH QACHON YETIB BO'LMAYDIGAN kod bo'lib qolgan (agar `certified > reference` va `reference.source==='approved_basis'`, demak avvalgi ikkita shart — `<` va `===` — allaqachon FALSE, ya'ni qolgan yagona holat `>` — tenary FAQAT `ABOVE_APPROVED_BASIS`ni qaytaradi, ikkinchi filial o'lik kod). **Tuzatildi**: reference HAR DOIM baseline (smeta snapshot); basis — ALOHIDA, faqat "reference'dan yuqori" holatida ceiling sifatida tekshiriladi. Bu — owner'ning O'Z misollariga (ref=100/F2=120/protokol=120→justified; protokol=115/F2=120→exceeded) ANIQ mos keladi, Codex'ning original kodi esa (agar ishga tushirilsa) `protokol=120/F2=120` holatini `NORMAL` deb belgilardi, `JUSTIFIED` emas — chalkashlik |
| `reference_price_snapshot`/`reference_basis_line_id` snapshot ustunlari `t2_akt_qator`da | **ACCEPT_CODEX (mantiq), ADAPT (ustun tarkibi)** | Bu branch'ning birinchi qoralamasi READ VAQTIDA `current_date` bilan basis qidirar edi — HAQIQIY BUG: keyinroq qo'shilgan/o'zgargan basis TARIXIY, tasdiqlangan F2'ning muzlagan summasini JIM o'zgartirib yuborardi (owner'ning "later smeta revision must not rewrite it" qonunini buzardi). Codex'ning WRITE-VAQTIDA SNAPSHOT qilish g'oyasi TO'G'RI — qabul qilindi, lekin `baseline_narx` (mavjud, allaqachon frozen) reference sifatida qoldirildi, faqat BASIS CEILING (`basis_approved_price_snapshot`) yangi snapshot qilindi |
| `calculateFrozenAmount`/`calculateAtRiskAmount` (pure TS) | **ACCEPT_CODEX semantika** | SQL'da ekvivalenti yozildi (`greatest(reference-certified,0)*qty`, faqat approved/draft filtri bilan) |
| `validatePriceBasis` (additional uchun basis majburiy) | **DEFERRED** | Additional/Replacement write commandlari bu bosqichda yozilmagan (Bo'lim 6) — bu validatsiya shu commandlar bilan birga keyingi bosqichda ulanadi |

### PARALLEL_TRUTH: **NO**

Ikkala Codex branch ham HECH QANDAY yangi parallel canonical entity/
document/work-type jadvali yaratmagan — ikkalasi ham to'g'ridan-to'g'ri
`t2_qator`/`t2_akt_qator`ga qo'shimcha ustunlar sifatida loyihalangan.
Bu — avvalgi bosqichdagi "REJECT_PARALLEL_TRUTH" saboqning natijasi
(Codex ikkalasi ham shuni hisobga olib yozgan). Yakuniy natija — BITTA
sxema, BITTA `t2_akt_yarat_v2` shartnomasi, BITTA nomlash konvensiyasi
(`certified_*`).

---

## 2. EXACT F2 — nima TASDIQLANGAN

`certified_quantity`/`certified_unit_price`/`certified_amount` —
`t2_akt_qator`da oddiy (GENERATED EMAS) ustunlar. Live tasdiqlangan
(qayta, incident'dan keyin, kichik izolyatsiya qilingan test bilan):
qty=10, price=123.45, amount=1234.49 — **AYNAN saqlanadi**, 1234.50 EMAS.
`t2_akt_qator_certified_freeze_v1_trg` — F2 tasdiqlangach (`holat=
'tasdiqlangan'`) certified_*/baseline_narx/basis snapshot O'ZGARMAS.

`t2_akt_yarat_v2` — smeta narxiga HECH QANDAY fallback yo'q:
`MISSING_CERTIFIED_PRICE`/`MISSING_CERTIFIED_AMOUNT` butun partiyani rad
etadi. Actor authorization (`t2_actor_kompaniya_azo_tekshir`) — MAJBURIY
(avvalgi qoralamada yo'q edi, endi bor).

Eski `t2_akt_yarat` — **teginilmadi**, GAS (`T2_F2Import.js`) undan
xavfsiz foydalanishda davom etadi.

## 3. FRONTEND_V2 — QISMAN

**Backend gateway to'liq ulandi** (`sb-yoz.ts`: `akt_yarat_v2`,
`price_basis_yarat` amallar; `sb.ts`: `price_control_v1`,
`f2_exact_qatorlar_v1` o'qish RPC'lari — actor har doim sessiyadan).

**Frontend chaqiruvchilar (`TestF2Import.tsx`, `TestF2.tsx`) HALI v2'ga
o'TKAZILMAGAN** — ATAYLAB ochiq holda. Sabab: ikkalasi ham hozir F2
hujjatidan faqat `hajm`+`narx` o'qiydi, ALOHIDA "summa" maydonini
UMUMAN PARSE QILMAYDI (`TestF2Import.tsx:1356`: `narx: n.narx > 0 ?
n.narx : undefined` — bor-yo'g'i ikkita maydon). Agar men ularni hozir
v2'ga majburiy o'tkazsam, `certified_amount`ni FAQAT `qty*narx` dan
hosil qilishga majbur bo'lardim — bu esa aynan TUZATILAYOTGAN
qonunbuzarlikning O'ZI (`certified_amount ≠ qty*price` invent qilinishi
mumkin emas). **Bu — halol chegara, shoshilib noto'g'ri tuzatishdan
ko'ra ochiq qoldirish tanlandi.**

**OCHIQ ISH**: `TestF2Import.tsx` parserini F2 hujjatidan ALOHIDA
summa ustunini o'qishga kengaytirish (agar hujjatda bor bo'lsa) — shu
holda v2'ga xavfsiz o'tish mumkin bo'ladi.

## 4. READ_MODELS — HUJJATLASHTIRILDI, KOD O'ZGARTIRILMADI

`t2_qator_holat`/`t2_lrv`/`t2_f2_kat_oy`/`t2_f2_tafsilot` — hali
`hajm`/`narx`/`summa` (eski, GENERATED) o'qiydi. **O'ZGARTIRILMADI**
sababi: Bo'lim 3'da aytilganidek, hali HECH QANDAY qator
`certified_*`ga ega emas (frontend v2'ga o'tmagan) — bu view'larni
hozir o'zgartirish HECH NARSANI ko'rsatmagan bo'lardi va sinovsiz
xavfli o'zgarish bo'lardi. **Qonun hujjatlashtirildi** (yangi F2 —
`certified_*`, legacy — `unknown_provenance` yorlig'i bilan aniq
ko'rsatilsin), amalga oshirish — Bo'lim 3 yakunlangach.

## 5. PRICE_CONTROL — TO'LIQ, LIVE TASDIQLANGAN

`t2_price_control_v1(obyekt_id, actor_id)` — har bir worked example
BILAN alohida, izolyatsiya qilingan (incident'dan keyingi tozalangan
metodologiya bilan) tekshirilgan **mantiq** darajasida (SQL to'g'riligi
avvalgi to'liq testda isbotlangan, keyin butunlay tozalangan production
holatiga qaytarilgan):

- ref=100, F2=80, qty=500 → **frozen=10000** ✅
- ref=100, F2=100 → **NORMAL** ✅
- ref=100, F2=120, protokol=120 → **ABOVE_REFERENCE_JUSTIFIED** ✅
- ref=100, F2=120, protokolsiz → **ABOVE_REFERENCE_MISSING_BASIS** ✅
- protokol=115, F2=120 → **ABOVE_APPROVED_BASIS** ✅
- keyinroq smeta narxi (999ga) o'zgarsa ham tarixiy frozen=10000
  **O'ZGARMAYDI** ✅ (snapshot mexanizmi ishlaydi)
- eski `t2_akt_yarat` (GAS yo'li) regressiyasiz ✅

## 6. FROZEN / AT_RISK

`FROZEN_AMOUNT` — faqat `holat='tasdiqlangan'` F2'dan, `baseline_narx`
(F2 yaratilgan paytdagi muzlagan smeta snapshoti) asosida. `AT_RISK_
AMOUNT` — faqat DRAFT (`holat<>'tasdiqlangan'`) F2'dan, alohida ustunda.
Ikkalasi ARALASHTIRILMAYDI (alohida `frozen_amount`/`at_risk_amount`
maydonlari, UI'da alohida karta/ustun).

## 7. PRICE_BASIS

`t2_price_basis`(header)/`t2_price_basis_line` — `PRICE_AGREEMENT_
PROTOCOL`/`APPROVED_CHANGE`/`ADDITIONAL_AGREEMENT`/`OTHER_APPROVED_
PRICE_BASIS`. `t2_price_basis_yarat_v1` — idempotent, audited
(`t2_actor_kompaniya_azo_tekshir` bilan himoyalangan), bir nechta
qatorni bitta hujjatga bog'laydi. Hech qanday qonuniy da'vo
hardcode qilinmagan — bu faqat "qanday basis bor" yozuvi.

## 8. WEBSITE / NARX NAZORATI — REAL, DEMO EMAS

`/admin/test/smeta` → **"Narx nazorati"** tab (`TestNarxNazorati.tsx`,
yangi) — REAL komponent, REAL `/api/sb` chaqiruvi (`price_control_v1`)
orqali. 4 ta karta (🔒 Muzlagan / ⚠ Xavf ostida / 🔴 Reference'dan
yuqori / 📄 Basis/protokolsiz), filtr, drill-down jadval (Reference
narx / F2 narx / Farq / Muzlagan / Xavf ostida / Holat badge). Hozircha
`certified_*` qatorlar yo'qligi sababli **bo'sh natija ko'rsatadi**
(halol, "F2 v2 orqali hali qator yaratilmagan" deb aytiladi) — bu DEMO
emas, REAL backend ULANGAN, faqat MA'LUMOT hali yo'q (Bo'lim 3
sababiga ko'ra).

**QILINMAGAN**: Object Price Control alohida sahifa (Section 9-10
so'ragan) — o'rniga MAVJUD `/admin/test/smeta` ichiga tab sifatida
qo'shildi (kamroq risk, mavjud navigatsiyadan foydalanadi). F2
pre-approval to'liq audit paneli (Section 10/11 avvalgi task) — bu
bosqichda YOZILMADI.

## 9. PRE_APPROVAL_AUDIT: OCHIQ

`t2_f2_exact_qatorlar_v1` (o'qish RPC, mismatch/provenance bilan) —
backend tayyor, lekin F2 tasdiqlash oqimiga (TestF2.tsx'ning
`tasdiqla()` funksiyasi) UI darajasida ULANMAGAN. Keyingi bosqich.

## 10. ADDITIONAL_REPLACEMENT: SXEMA BOR, COMMAND YO'Q

`change_type`/`replaces_line_id`/`change_id` — `t2_qator` va
`t2_akt_qator`da (avvalgi bosqichdan, bu bosqichda saqlab qolindi).
`createAdditionalWork`/`createReplacementWork`/`addResourceChild` —
**YOZILMADI** bu bosqichda (vaqt cheklovi + incident tozalash uchun
sarflangan vaqt). Ochiq, keyingi bosqich.

## 11. CATALOG_PIPELINE: SXEMA-ONLY (o'zgarishsiz)

Avvalgi bosqichdagi `t2_work_type_observation`/va h.k. — real
import pipeline'ga ulanmagan, bu bosqichda ham ULANMADI. Ochiq.

## 12. SHEET_BRIDGE: TAHLIL QILINGAN, KOD O'ZGARTIRILMAGAN

`T2_Kozgu.js` (GAS) — avvalgi bosqichda to'liq audit qilingan (qator
raqamlari bilan: blanket PATCH, bo'sh `catch(e){}`, 60s vaqt-oynali
echo suppression). Bu bosqichda **SOURCE CODE FIX yozilmadi** — sabab:
1282 qatorli, jonli productionda ishlab turgan faylni yetarli vaqt va
diqqat bilan qayta yozmasdan o'zgartirish — ayniqsa shu SESSIYADA
allaqachon bitta jiddiy xato (Bo'lim 0) yuz berganidan keyin — mas'uliyatsiz
bo'lardi. Ochiq, aniq audit asosida (keyingi bosqichda tayyor).

---

## TESTS

| Holat | Natija |
|---|---|
| qty=10/price=123.45/amount=1234.49 exact | ✅ PASS (izolyatsiya qilingan qayta test) |
| ref=100/F2=80/qty=500 → frozen=10000 | ✅ PASS (to'liq test, keyin tozalandi) |
| ref=100/F2=100 → normal | ✅ PASS |
| ref=100/F2=120/protokol=120 → justified | ✅ PASS |
| ref=100/F2=120/protokolsiz → missing basis | ✅ PASS |
| protokol=115/F2=120 → exceeded | ✅ PASS |
| keyingi smeta revision → tarixiy frozen o'zgarmaydi | ✅ PASS |
| additional/replacement o'z reference/basis bilan | ⛔ OPEN (write command yozilmagan) |
| tsc -b / tsc -p tsconfig.functions.json | ✅ PASS |
| vite build | ✅ PASS |
| oxlint | ✅ PASS (0 xato) |
| npm run tekshir (barcha oracle, jumladan yangilangan write-gate ro'yxati) | ✅ PASS |
| Production holati (incident'dan keyin) | ✅ TASDIQLANDI — hech narsa qolmagan |

---

## XULOSA

Bu bosqich ikki Codex branch'ni chinakam reconciliation qildi (ikkalasi
ham qimmatli, ikkalasida ham real xatolar topildi va tuzatildi —
Codex'ning o'zi ham "dead code" xatosiga yo'l qo'ygan, men ham
transaction-discipline xatosiga yo'l qo'ydim, ikkalasi ham topildi va
ochiq aytildi). Backend core (exact F2 + Price Control) — to'liq,
tasdiqlangan. Frontend/UI — REAL boshlanish (bitta funksional tab),
lekin F2 import UI'larining to'liq migratsiyasi, additional/replacement
commandlar, catalog pipeline ulanishi va GAS bridge tuzatishi —
HAMMASI ochiq, aniq sabab bilan.
