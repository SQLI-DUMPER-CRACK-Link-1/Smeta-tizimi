# T2-SHEETS-SUPABASE-BRIDGE-001 — CONTRACT

**Rol:** Chief Integrator / Backend Architect (Claude)
**Sana:** 2026-09-03
**Bosqich:** T2-GAS-EXIT-LRV-CONTROL-001 foundation.
**Holat:** SOURCE ONLY / DIZAYN HUJJATI. Ushbu bosqichda schema
o'zgartirilmadi — sabab pastda, Bo'lim 0'da aniq aytiladi.

---

## 0. Nega bu hujjatda YANGI migratsiya YO'Q

`T2_LRV_CONTROL_001_CONTRACT.md`da xuddi shu ehtiyot choralari qo'llanildi:
GAS/Sheets bridge — **hozir ISHLAB TURGAN, jonli** mexanizm
(`t2_ozgarish`, `t2_kozgu`, `t2_kopruk_navbat`). Uni GAS tomonidagi
yozuvchi kodni (`Smeta tizimi/*.js`) to'liq audit qilmasdan schema
darajasida o'zgartirish — kutilmagan sinxronizatsiya uzilishi xavfini
tug'diradi. Bu hujjat — **kelgusi implementatsiya bosqichi uchun aniq
dizayn kontrakti**, real gap tahlili bilan, lekin productionga tegmaydi.

---

## 1. Nima MAVJUD (live sxema tekshiruvi, 2026-09-03)

| Talab qilingan tushuncha | Mavjud | Turi | Izoh |
|---|---|---|---|
| Change log / outbox | `t2_ozgarish` | jadval (`r`) | `id, vaqt, obyekt_id, qator_id, jadval, maydon, eski, yangi, amal, manba, kim, kozguga_yozildi, ziddiyat, izoh, kompaniya_id, versiya, obyekt_nom` |
| Mirror/replica state | `t2_kozgu` | jadval (`r`) | `obyekt_id, fayl_id, oxirgi_yozish, qator_soni, barmoq_izi (fingerprint!), holat, xato, kompaniya_id` |
| Bridge pending-sync queue | `t2_kopruk_navbat` | **VIEW** (`v`) | `id, vaqt, obyekt, qator_id, maydon, eski, yangi, amal, manba, kim, ziddiyat` — `t2_ozgarish`dan hosil bo'ladigan proyeksiya (nomi — "ko'prik navbati" — aynan BRIDGE QUEUE) |

**Muhim kuzatuv**: `t2_kozgu.barmoq_izi` — Section 10'dagi
`projection_hash` bilan BIR XIL g'oya, allaqachon mavjud (nomi boshqa).
`t2_ozgarish.ziddiyat` — Section 10/11'dagi conflict-flag/dead-letter
g'oyasining boshlang'ich shakli. `t2_ozgarish.kozguga_yozildi` (boolean)
— "bu o'zgarish ko'zguga (Sheets'ga) yozib bo'lindimi" flag — ya'ni
**at-least-once delivery kuzatuvi allaqachon boshlangan**, faqat
to'liq retry/dead-letter siyosati yo'q.

`t2_ozgarish`ga yozuvchi RPC (`t2_ozgarish_yoz` kabi nom bilan)
Supabase'da **topilmadi** — bu ustunga yozish, ehtimol, TRIGGER orqali
yoki to'g'ridan-to'g'ri GAS/Cloudflare kod ichidan amalga oshiriladi.
Bu — keyingi bosqichda GAS kod auditi bilan aniqlanishi kerak nuqta,
bu hujjatda TAXMIN QILINMAYDI.

---

## 2. SUPABASE = CANONICAL, SHEETS = SECONDARY REPLICA, GAS = BRIDGE ONLY

Bu qonun — loyiha xotirasida allaqachon qayd etilgan asosiy printsip
(`Ko'prik: Claude↔Antigravity darvoza`, `soxta-malumot-buzilishlari`
memory yozuvlari: "Sheets → Supabase yozish ikki manba yaratadi").
`sb.ts`ning o'zi ham (Bo'lim yuqorida ko'rilgan) "FAQAT O'QISH DARCHASI"
sifatida ishlaydi — bu aynan shu qonunning HTTP darajasidagi
ta'minoti.

### Ikki yo'nalish (dizayn, hali to'liq amalga oshirilmagan qismi bilan)

```
SUPABASE (canonical write, masalan t2_kompaniya_yangila_v1 kabi
          audited command)
   → t2_ozgarish (outbox yozuvi — TRIGGER yoki explicit call bilan)
   → t2_kopruk_navbat (VIEW: kozguga_yozildi=false bo'lganlar)
   → GAS bridge worker Supabase'dan navbatni o'qiydi
   → Sheets'ga proyeksiya yozadi (t2_lrv kabi view'lardan format qilib)
   → t2_ozgarish.kozguga_yozildi = true qiladi

SHEETS (whitelisted editable field — Bo'lim 5'ga qara)
   → GAS trigger/menu ushlaydi
   → Bridge/API (Cloudflare) chaqiradi
   → CANONICAL COMMAND (masalan, kelajakdagi addAdditionalWork/replaceWork)
   → SUPABASE yozadi
   → t2_ozgarish (yana outbox)
   → t2_kopruk_navbat
   → Sheets confirmation (masalan, hujayra rangini/izohini yangilash)
```

Ikkinchi yo'nalish (Sheets → canonical command) — hozir **faqat dizayn**;
"GAS faqat adapter" qoidasi Bo'lim 12'da batafsil.

---

## 3. SYNC SAFETY — talab qilingan vs mavjud

| Talab | Mavjud | Holat |
|---|---|---|
| `canonical_entity_id` | `t2_ozgarish.qator_id` | QISMAN — faqat `qator_id`, umumiy entity turi yo'q (`t2_qator` deb taxmin qilinadi) |
| `canonical_version` | `t2_ozgarish.versiya` | BOR |
| `sheet_file_id` | `t2_kozgu.fayl_id` | BOR |
| `sheet_tab_id` | — | **YO'Q** |
| `sheet_row_mapping` | — | **YO'Q** (row raqami identity emasligi — Section 10 qonuni — hozir TEKSHIRILMAGAN) |
| `projection_hash` | `t2_kozgu.barmoq_izi` | BOR (nomi boshqa) |
| `operation_id` / idempotency | — (faqat `t2_ozgarish.id`) | **YO'Q** — outbox yozuvi operation_id bilan bog'lanmagan |
| `base_version` / optimistic lock | `t2_ozgarish.versiya` (yozib qo'yiladi, lekin write-time CHECK yo'q) | QISMAN |
| `sync cursor` | — | **YO'Q** (GAS qaysi `t2_ozgarish.id`dan davom etishini qanday bilishi noaniq) |
| `origin` (echo suppression) | `t2_ozgarish.manba` | QISMAN — manba bor, lekin "bu Sheets editdan qaytgan echomi" ANIQ ajratilmagan |
| `change hash` | `t2_kozgu.barmoq_izi` (fayl darajasida) | QATOR darajasida YO'Q |
| `retry` | — | **YO'Q** |
| `dead-letter/conflict queue` | `t2_ozgarish.ziddiyat` | BOSHLANG'ICH — flag bor, alohida navbat/UI yo'q |

**XULOSA**: infratuzilma NOLDAN emas — 60% asos allaqachon bor
(outbox, mirror-state, fingerprint, conflict-flag, delivery-flag). Yetishmayotgani:
`sheet_tab_id`, `sheet_row_mapping`, `operation_id`, `sync cursor`,
qator-darajasidagi `change hash`, `retry` hisoblagichi — bularning
barchasi **ADDITIVE** (yangi ustunlar `t2_ozgarish`/`t2_kozgu`ga,
mavjudlarini o'zgartirmasdan) qo'shilishi mumkin, lekin GAS yozuvchi
tomonini avval audit qilmasdan bu ustunlarni "to'ldirishga majburlash"
xavfli (yozuvchi kod ularni bilmaydi — NULL qoladi, foydasiz bo'lib
qoladi yoki xato beradi, agar NOT NULL qilib qo'yilsa).

---

## 4. LOOP PREVENTION

Talab: "Supabase → Sheets change yana Sheets → Supabase yangi user edit
deb qaytmasin." Hozir buning uchun DB darajasida aniq meхanizm
ko'rinmadi (`manba` ustuni yordam berishi mumkin, lekin uning
qiymatlar to'plami — masalan `'frontend'`/`'sheets'`/`'system'` —
GAS kodini ko'rmasdan tasdiqlanmadi). **Kelgusi implementatsiya
talabi**: har bir GAS→Supabase yozuvida `origin_event_id` (o'sha
`t2_ozgarish.id` yoki `operation_id`) saqlansin, Sheets'dan GAS orqali
kelgan o'zgarish shu ID bilan "bu allaqachon bizning yozuvimiz edi"
deb aniqlansin va qayta outbox'ga yozilmasin.

---

## 5. SHEETS EDIT POLICY

Talab: faqat whitelisted maydonlar tahrirlanadigan; approved tarixiy F2
— READ-ONLY proyeksiya. Bu qonun `t2_lrv` view'ining o'zi orqali
QISMAN allaqachon ta'minlangan (VIEW — Sheets'ga proyeksiya sifatida
yoziladi, lekin Supabase tarafida SHEETS'dan TO'G'RIDAN-TO'G'RI o'qib
yozib bo'lmaydi — u view, jadval emas). Muammo — teskari yo'nalish
(Sheets'dagi qo'lda tahrir GAS orqali qanday cheklanadi) GAS kod
tarafida, bu sessiyada tekshirilmagan.

**Qo'shimcha/zamena uchun Sheets menu ham canonical Cloudflare
commandni chaqirishi kerak** — `LRV_CONTROL_001` kontraktining
Bo'lim 5 (`addAdditionalWork`/`replaceWork`) bilan bir xil talab:
bu komandalar yozilgach, GAS menu ularni **to'g'ridan-to'g'ri
Supabase yozish o'rniga** chaqirishi kerak (GAS = adapter, business
logic emas).

---

## 6. DOCUMENT INGESTION PIPELINE (Section 15)

Talab: Browser → Cloudflare → R2 → document registry → durable parse
job → source lines → catalog observations → match → canonical LRV
proyeksiya, 50k qator uchun ham async/chunk/checkpoint/resume.

**Mavjud qismlar**: R2 canonical storage (`file_truth_FILE_TRUTH_001`,
LIVE), Document Center registry (`t2_document_registry_v1`, LIVE),
`t2_manba`/`t2_xom` (source document/line, smeta uchun). **Yo'q qism**:
durable/resumable parse JOB queue — hozirgi import (F2/smeta) sinxron
so'rov ichida ishlaydi (`Katta obyekt _NAT_ timeout` memory yozuvi —
katta fayllarda AYNAN shu muammo allaqachon qayd etilgan: "konvert
fayllar ko'payishi + timeout"). `t2_job` jadvali (CTRL-001'dan,
`t2_system_control_v1` orqali ko'rinadigan) — umumiy job-boshqaruv
infratuzilmasi ALLAQACHON bor (`t2_job_control_v1`: pause/resume/retry).
**Kelgusi taklif**: katta hujjat parse ishini `t2_job`ning bitta
`job_kod`i sifatida ro'yxatga olish — parallel job-tizimi yaratmasdan,
mavjudini qayta ishlatib, checkpoint/resume ustunlarini
(`t2_manba`ga: `parse_checkpoint jsonb`) additive qo'shish.

---

## XULOSA

GAS↔Supabase↔Sheets ko'prigi — Section 9-12, 15'dagi qonunlarning aksariyati
uchun ALLAQACHON qisman infratuzilmaga ega (`t2_ozgarish`/`t2_kozgu`/
`t2_kopruk_navbat`/`t2_job`). Bu kontrakt GAP'larni ANIQ sanab o'tdi
(`operation_id`, `sync cursor`, `sheet_tab_id`/`sheet_row_mapping`,
`retry`, `origin_event_id` loop-prevention) va ularni **additive** deb
belgiladi — lekin GAS yozuvchi kodini avval ko'rmasdan schema'ni
o'zgartirish BU BOSQICHDA QILINMADI. Keyingi implementatsiya bosqichi:
avval GAS bridge kodini (`Smeta tizimi/*.js`, ko'prik bilan bog'liq
fayllar) o'qib chiqish, keyin shu gap'larni additive migratsiya bilan
yopish.
