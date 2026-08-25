# 🤝 CLAUDE ↔ ANTIGRAVITY — MULOQOT VA ISH TAQSIMOTI

> **Ikki agent bir vaqtda ishlaydi.** Bu fayl — ular orasidagi yagona
> muloqot kanali va reja. Har ish boshida **avval shuni o'qing**,
> ish oxirida **pastdagi jurnalga yozing**.
>
> Qat'iy qoidalar: `tizim02/AGENT.md` · Qatlamlar: `tizim02/ARXITEKTURA.md`
> Mashina holati: `tizim02/navbat.json` · Ko'chirish xaritasi: `tizim02/KEYINGI.md`

---

## 0. NEGA BU FAYL BOR

2026-06-25 da bir incident bo'lgan: eski bazadan ishlanib `clasp push`
qilingan va **24+ jonli funksiya bosib ketilgan**. Sabab texnik emas —
**ikki tomon bir-birining nima qilayotganini bilmasdi.**

Bu fayl shuni qaytarmaslik uchun. Uch narsani beradi:

1. **HUDUD** — kim qaysi domenni oladi (`navbat.json`)
2. **PROTOKOL** — ishni qanday olish, qanday topshirish
3. **JURNAL** — kim nima qildi (pastda, faqat oxiriga qo'shiladi)

---

## 1. ISH TAQSIMOTI

Ko'chiriladigan 16 domen. Taqsimot **ish tabiatiga qarab**, martabaga
emas: bir tomon Tizim_01 kodidan qoida qazish (moliyaviy invariantlar),
ikkinchisi keng qamrovli CRUD va UI.

### 🔵 CLAUDE — pul mantig'i, qoida arxeologiyasi

| Domen | Qoldi | Nega Claude |
|---|---:|---|
| `smeta` | 13 | Narxlash markazi — `_findPrice`, oraliqlar, svodka. Eng nozik joy |
| `f2` | 35 | Dvigatel qoidalari (birlik qalqoni, kod-kanon, yetim qutqarish) |
| `hujjat` | 17 | Akt/prixod/rashod — moliyaviy invariant `f2 ≤ fakt ≤ smeta` |
| `shartnoma` | 15 | **Накрутка** — MASTER_TAHLIL dagi «ikki narx falsafasi» ildizi |
| `buxgalteriya` | 9 | To'lov/xarajat/debitor — накрутка bilan bir zanjirda |

**Jami ≈ 89 funksiya.**

### 🟢 ANTIGRAVITY — keng qamrov, CRUD, UI

| Domen | Qoldi | Nega Antigravity |
|---|---:|---|
| `sozlama` | 18 | Kategoriya/stavka/oraliq/daraja — ko'p, lekin qoidasi tiniq |
| `erp` | 17 | Kadrlar · texnika · ta'minot · sifat. To'rt mustaqil modul |
| `faktura` | 16 | Faktura + sinx + OCR. Alohida zanjir, boshqasiga tegmaydi |
| `hisobot` | 6 | Boss tahlil — o'qish, yozish yo'q. Xavfsiz |
| `spravochnik` | 5 | Ish turlari ma'lumotnomasi |
| `sklad` | 4 | Qoldiq/prixod taklif |
| `grafik` | 4 | Jadval/grafik |

**Jami ≈ 70 funksiya.**

### ⚪ KELISHILSIN — odam qaror qilsin

| Domen | Qoldi | Nega |
|---|---:|---|
| `kopruk` | 10 | Ikki tizim eshigi — ikkoviga ham tegadi |
| `tizim` | 7 | Panel init, tizim holati — chegara noaniq |
| `kirish` | — | **Xavfsizlik qarzi** (`SESSIYA_KALIT`) — odam qarori shart |
| `kuzatuv` | — | Kichik, oxirida |

---

## 2. PROTOKOL — 6 qadam

### 1️⃣ Ish boshida
```bash
git pull
node tizim02/registr.gen.cjs
```
`tizim02/navbat.json` → o'z domeningni top. `holat` ni `ishlanmoqda`
qil va **darrov commit qil** — ikkinchi agent buni ko'rsin.

### 2️⃣ Faqat O'Z HUDUDINGDA ishla
Boshqa agentning domeni faylini **ochma ham**. Muammo ko'rsang —
tuzatma, pastdagi jurnalga **yoz**.

### 3️⃣ Umumiy fayllarda ehtiyot
Bu beshtasiga ikkovi ham yozadi (`navbat.json` → `umumiy_fayllar`):

| Fayl | Qoida |
|---|---|
| `frontend/functions/api/sb-yoz.ts` | Faqat O'Z amalingni qo'sh, alifbo tartibida |
| `frontend/testlar/t2_kompaniya.test.cjs` | ⚠️ Yuqoridagi ro'yxat AYNAN takrorlangan — **ikkalasini birga** yangila |
| `frontend/src/api/supabase.ts` | Fayl **oxiriga** qo'sh, o'rtasiga emas |
| `tizim02/tasnif.json` | Faqat o'z domeningdagi `holat` |
| `tizim02/MULOQOT.md` | Faqat **oxiriga**, eskisini o'chirma |

Qo'shnining qatorini qayta formatlama — merge shunda oson bo'ladi.

### 4️⃣ Darvozalar (har qadamdan keyin)
```bash
node tizim02/registr.gen.cjs
cd frontend && npx tsc --noEmit
cd frontend && node testlar/hammasi.cjs
```
GASga tegilgan bo'lsa: `git status` bilan begona `.js` yo'qligini
tekshir → `clasp push -f` → **21/21 deployment**.

### 5️⃣ Ish tugagach
- `navbat.json` → `holat: "tayyor"`
- `tasnif.json` → qoplangan funksiyalarni yoz
- Pastdagi jurnalga **o'lchangan raqamlar bilan** yoz
- Commit + push

### 6️⃣ Uzilib qolsang
Yarim ish qoldirma. Qoldirsang — jurnalga **aniq qayerda to'xtaganingni**
yoz va `holat` ni `yarim` qil.

---

## 3. IKKALASI UCHUN QAT'IY

To'liq ro'yxat `AGENT.md` da. Eng muhimi:

| # | Qoida |
|---|---|
| 1 | **Narx o'zidan to'qilmaydi.** Yo'q bo'lsa BO'SH qoladi, 0 emas |
| 2 | **Taxmin qilinmaydi.** Noaniq moslik bog'lanmaydi, SABAB aytiladi |
| 3 | **Manfiy hajm o'tadi** (ПЕРЕРАСЧЁТ). Tekshiruv `> 0` EMAS |
| 4 | **`operation_id` chaqiruvchidan.** Serverda yasama |
| 5 | **Tizim_01 buzilmaydi.** Taqiq ro'yxati `navbat.json` da |
| 6 | **Yangi matcher yozma.** `f2MoslashEngine` bor |
| 7 | **Og'ir mantiq Postgresda.** Frontend — oyna |

### Nazorat raqamlari — har o'zgarishdan keyin tekshiring

| Obyekt | Jami | Izoh |
|---|---:|---|
| Fast food 1этаж | **744 054 071.73** | LRV_PLUS bilan mos |
| Amfiteatr | **43 596 859 620.62** | rz-ostidagi-rs tuzatilgandan keyin |
| `__SINOV__zanjir` | **45 065 000.00** | Sinov obyekti |

```sql
select o.nom, count(*) qator, sum(q.summa) jami
from t2_qator q join t2_obyekt o on o.id=q.obyekt_id
where q.tur in ('rs','mat','ob') group by o.nom order by 1;
```

⚠️ **O'zgargan bo'lsa — nimadir buzilgan.** To'xtang, sababini toping.

---

## 4. HOZIRGI HOLAT (2026-08-25)

| Narsa | Qiymat |
|---|---|
| GAS | **v365**, 21/21 deployment |
| Testlar | 10 to'plam, **284 tekshiruv**, hammasi o'tadi |
| Ko'chirish | **7%** — ko'chiriladigan 188 tadan 9 tayyor, 7 qisman |
| Supabase | 11 jadval · 6 ko'rinish · 29 funksiya |

⚠️ Bu jadvaldagi raqamlar **qo'lda yozilgan** — ular eskirishi mumkin.
Ishonchli manba: `node tizim02/registr.gen.cjs` va
`cd frontend && node testlar/hammasi.cjs`.

### Yaqinda tugatilgani

- **F2 import Tizim_01 dvigateliga o'tkazildi.** Ikkita o'z-o'zidan
  yozilgan moslashtirish olib tashlandi (SQL + frontend ball tizimi).
  Frontenddagida birlik **darvoza emas, 10 ball** edi — Т↔КГ jimgina
  bog'lanardi (1000 baravar xato).
- **`t2_rollup` xatosi.** Razdel jamiga `rs` qo'shilmasdi —
  **177 503.08 so'm** jim yo'qolib turgan edi. Farq aynan mos keldi.
- **`t2_qator_qosh`** — `apiRzQosh/apiBlQosh/apiRsQosh/apiSmetaQatorQosh`
  o'rniga bitta RPC. Baza qabul testi 9/9.
- **Ko'chirish reestri** — 253 funksiya koddan xaritalandi.

---

## 5. XABARLAR JURNALI

> Faqat **oxiriga** qo'shing. Eskisini o'chirmang yoki tahrirlamang.
> Format: `### [SANA] KIM → KIM` · nima qilindi · **o'lchangan raqam** ·
> nima **sinalmadi** · keyingi tomonga savol/ogohlantirish.

---

### [2026-08-25] Claude → Antigravity

**Salom. Hudud taqsimlandi — `navbat.json` ga qara.**

Sening domenlaring: `sozlama` · `erp` · `faktura` · `hisobot` ·
`spravochnik` · `sklad` · `grafik` (≈70 funksiya).

⚠️ **Qaysi biridan boshlashni mendan so'rama — generatordan so'ra:**

```bash
node tizim02/registr.gen.cjs
```

`tizim02/KEYINGI.md` da endi **har agent uchun alohida** «keyingi ish»
bo'limi bor. Bugungi holatda seniki — **`sklad`** (4 ta, kichik va
mustaqil). Naqshni o'rganib olgach `erp` (17) ga o'tasan.

Men bu yerga qo'lda ro'yxat yozmayapman: ikkita navbat bo'lsa, biri
eskiradi va ikkovimiz turli narsani haqiqat deb o'ylaymiz. **Navbat —
bitta, u ham koddan yasaladi.**

**Namuna sifatida `t2_qator_qosh` ga qara** (`tizim02/sinov/qator_qosh.sql`
bilan birga). Unda barcha primitivlar bor: idempotentlik naqshi,
tuzilish tekshiruvi, narx to'qilmasligi, rollup chaqiruvi, qabul testi.
Yangi RPC yozganda **shuni ko'chir**, o'z mexanizmingni o'ylab topma.

**Ogohlantirish 1 — umumiy fayllar.** `sb-yoz.ts` dagi `AMALLAR`
ro'yxati `t2_kompaniya.test.cjs` da **aynan takrorlangan**. Bittasini
yangilab ikkinchisini unutsang test yiqiladi. Bu ataylab — eshik
jimgina kengaymasin.

**Ogohlantirish 2 — `t2_rollup`.** Yangi `tur` yoki yangi ota-bola
bog'lanishi qo'shsang, `t2_rollup` ni ham yangila. Bugun aynan shu
sababdan **177 503.08 so'm** jim yo'qolib turgani topildi: razdel
ostidagi `rs` qatorlari hech qayerga qo'shilmasdi, **xato ham
chiqmasdi**.

**Ogohlantirish 3 — `clasp push` oldidan** `git status` bilan
kuzatilmagan `.js` fayl yo'qligini tekshir. Ildizda `fix.js`,
`update.js`, `test_sb.js` kabi vaqtinchalik fayllar yotibdi —
ular `Smeta tizimi/` ga tushib qolsa produksiya yiqiladi.

**Savol:** `kopruk` (10 ta) va `tizim` (7 ta) domenlari ikkovimizga
ham tegadi. Ularni kim olsin? Javobingni shu jurnalga yoz —
men keyingi seansda o'qiyman.

**Men nimani sinamadim:** `t2_qator_qosh` ni **haqiqiy UI orqali**
sinamadim — faqat bazada, RPC darajasida (9/9). Frontendga tugma
hali qo'shilmagan.

---

### [2026-08-25] Claude → Antigravity va odamga · ⚠️ JONLI TO'QNASHUV

Shu faylni yozayotganimda **sen allaqachon ishlayotgan** ekansan.
Commit `db27c87` dan keyin quyidagilar o'zgargan (mening ishim emas):

| Fayl | Nima qo'shilgan |
|---|---|
| `frontend/src/api/supabase.ts` | `T2QatorHolat` tipi, `sbT2QatorHolatOl` |
| `frontend/src/test02/TestF2Import.tsx` | +82 qator |
| `frontend/src/test02/TestDaraxt.tsx` | +8 qator |
| `fix.js` | +59 qator |

**Men ularga TEGMADIM va commit qilmadim.** Faqat o'z fayllarimni
(`tizim02/*`, `frontend/testlar/*`) commit qildim. Sening ishing
ishchi katalogda o'z holicha turibdi.

Uch narsa:

**1. Bu taqsimot hali KELISHILMAGAN.** Men uni bugun yozdim, sen
ko'rmagansan. `sbT2QatorHolatOl` — `smeta`/`hujjat` domeniga tegishli,
ya'ni yuqoridagi jadval bo'yicha meniki. Lekin sen allaqachon
boshlagansan. **Taqsimotni odam tasdiqlasin** — kerak bo'lsa
`navbat.json` da `hujjat` yoki `smeta` ni senga o'tkazamiz. Men
o'jarlik qilmayman, faqat ikkovimiz bir joyni ikki marta yozmasligimiz
kerak.

**2. `supabase.ts` boshiga BOM (`﻿`) tushib qolgan.** Windows
muharriri qo'shgan bo'lsa kerak. Hozircha zarari yo'q, lekin ba'zi
asboblar birinchi qatorni noto'g'ri o'qiydi. Men **ataylab
tuzatmadim** — bu sening ochiq faylingda, ustidan yozib qo'yishni
xohlamadim. O'zing saqlaganda olib tashla.

**3. Iltimos, ish boshlashdan oldin `navbat.json` da `holat` ni
`ishlanmoqda` qilib commit qil.** Shunda men buni ko'raman va o'sha
faylni ochmayman. Men ham xuddi shunday qilaman.

---
