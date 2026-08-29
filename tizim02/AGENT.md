# AI AGENT SHARTNOMASI — TIZIM_02 ga ko'chirish

> **Governance V2 compatibility note (2026-08-30):** first read the repository
> root `AGENTS.md`, then `docs/governance/CONSTITUTION.md`,
> `CURRENT_STATE.md` and `ops/ACTIVE_TASKS.json`. This legacy contract is
> retained for project detail; `MULOQOT.md` is an append-only historical
> journal and is not current-state authority.

> Bu faylni **har bir agent ish boshlashdan oldin to'liq o'qiydi.**
> Claude, Antigravity yoki boshqasi — farqi yo'q. Qoidalar bir xil.
>
> ⚠️ **Ikki agent bir vaqtda ishlaydi.** Ish olishdan oldin
> `tizim02/MULOQOT.md` (reja + jurnal) va `tizim02/navbat.json`
> (kim qaysi domenni olgan) ni ko'ring. **O'z hududingizdan
> tashqariga chiqmang.**

---

## 0. Bir daqiqada: nima qilyapmiz

Tizim_01 (Google Apps Script + Sheets) **ishlab turibdi va to'xtamaydi**.
Tizim_02 (Supabase + Cloudflare) yonida quriladi. Funksiyalar bittalab
ko'chiriladi. Har ko'chirilgan funksiya uchun Tizim_01 dagi asli
**o'z joyida qoladi** — ishonch hosil qilinmaguncha o'chirilmaydi.

Holat: **`tizim02/KEYINGI.md`** (avtomat yasaladi, qo'lda tahrirlamang).

---

## 1. Keyingi ishni qanday olasiz

```bash
node tizim02/registr.gen.cjs
```

Keyin `tizim02/KEYINGI.md` da **O'Z NOMINGIZ ostidagi** bo'limni
oching — masalan «🔵 claude — keyingi ish» yoki
«🟢 antigravity — keyingi ish». U sizga tegishli birinchi tugallanmagan
domenni va uning funksiyalarini ko'rsatadi.

Bitta domenni **oxirigacha** oling — yarim qoldirilgan domen keyingi
agent uchun eng yomon meros. Olganingizda `tizim02/navbat.json` da
`holat` ni `ishlanmoqda` qiling va **darrov commit qiling**, shunda
ikkinchi agent buni ko'radi.

⚠️ **Boshqa agentning domenini olmang.** Kim nimani olgani
`tizim02/navbat.json` → `hudud` da. Navbat tartibi
`tizim02/tasnif.json` → `keyingiNavbat.tartib` da (qiymat bo'yicha).
Taqsimotni o'zgartirish — odamning qarori.

---

## 2. Qatlam qaysi — o'ylab o'tirmang, reestrda yozilgan

| Qatlam | Ma'nosi |
|---|---|
| `SUPABASE` | Postgres RPC + tipli frontend chaqiruvi. Ko'chiriladi. |
| `GAS` | Drive/Sheets/Excel/AI kalitiga bog'langan. **Joyida qoladi.** |
| `KOPRIK` | Ikki tizim orasidagi eshik. GASda, lekin T2 shakliga o'giradi. |
| `YOQ` | Sheets keshi yoki diagnostika — Tizim_02 da keraksiz. |

`GAS` deb belgilangan funksiyani **ko'chirmang**. U qarz emas.
Excel o'qish, `.xlsx` ni faqat qiymat bilan ochish (`#REF!` himoyasi),
MIME xavfsizligi, F2 moslashtirish dvigateli — bularning har biri
haqiqiy moliyaviy xatodan keyin sozlangan. Qayta yozish = yo'qotish.

---

## 3. QAT'IY QOIDALAR — buzilsa ish qabul qilinmaydi

### 3.1 Narx o'zidan to'qilmaydi
Hujjatda narx yo'q bo'lsa **BO'SH qoladi**. Smeta narxidan to'ldirish,
0 yozish yoki taxmin qilish — soxta moliyaviy hujjat.
Bazada bu `t2_akt_qator.summa` generated ustuni bilan mustahkamlangan:
`narx IS NULL → summa NULL`. `t2_akt_yarat` ga `narx_yoq: true` bering.

### 3.2 Taxmin qilinmaydi
Moslik noaniq bo'lsa qator **bog'lanmaydi** va SABAB aytiladi.
«Ehtimol shudir» deb yozilgan hajm — jim moliyaviy xato: ogohlantirish
chiqmaydi, hujjat to'g'ri ko'rinadi.

### 3.3 Reestr kafolati
Har import/hisobda tenglik javobda qaytarilsin:
`kirgan = joylashgan + joylashmagan`. Buzilsa — amal bajarilmaydi.

### 3.4 Manfiy hajm bloklanmaydi
ПЕРЕРАСЧЁТ haqiqiy hujjat. Tekshiruv `> 0` emas, **yig'indi chegarasi**
bo'yicha. `Number(x)` ishlating, `x > 0` emas.

### 3.5 Idempotentlik chaqiruvchidan
`operation_id` (UUID) **chaqiruvchi** beradi. Serverda yasab bermang —
o'shanda qayta urinish yangi UUID bilan ketib ikkinchi hujjat yaratadi.

### 3.6 Optimistik qulf
Tahrirda `versiya` ustuni va `p_kutilgan_versiya`. Konflikt bo'lsa
**xato qaytaring**, oxirgi yozuvchi yutmasin.

### 3.7 Tizim_01 buzilmaydi
`30_Panel.js`, `10_Engine.js`, `35_F2Moslash.js` — produksiya.
Ularga tegish uchun aniq sabab va odamning ruxsati kerak.
Kerak bo'lsa **yoningizda zaxira yozing**, ularni tahrirlamang.

---

## 4. Bir funksiyani ko'chirish tartibi

1. **Aslini o'qing.** `REGISTR.json` da `fayl:qator` bor. To'liq o'qing —
   yarmini o'qib qayta yozish shu loyihada bir necha marta pulni
   yo'qotgan.
2. **Nima haqiqiy qoida, nima tasodif** ekanini ajrating. Izohlarda
   ko'pincha «bu 2.2 mlrd xatodan keyin qo'shildi» deb yozilgan.
3. **Postgresda yozing** (`apply_migration`). Har moliyaviy amal —
   bitta tranzaksiya. Izohda **NEGA** shunday ekanini yozing.
4. **Frontendda tipli chaqiruv** qo'shing (`frontend/src/api/`).
   Yozuv amallari `functions/api/sb-yoz.ts` dagi nomli ro'yxatdan o'tadi —
   ixtiyoriy SQL frontenddan yuborilmaydi.
5. **Test yozing — regex emas, XATTI-HARAKAT.**
   ⚠️ Bu yerda katta tuzoq bor: «filoncha funksiya chaqirilyaptimi»
   degan regex testi noto'g'ri amalga oshirishda ham YASHIL bo'ladi.
   Bir marta shunday bo'lgan. Haqiqiy ma'lumot bilan sinang.
6. **Reestrni yangilang:** `tizim02/tasnif.json` → `holat` ga
   `{"qopladi": "...", "toliq": true}` qo'shing, keyin generatorni
   ishga tushiring.
7. **Darvozalardan o'ting** (pastda).

---

## 5. Darvozalar — har qadamdan keyin

```bash
node tizim02/registr.gen.cjs        # reestrni yangila
cd frontend && npx tsc --noEmit -p tsconfig.app.json     # tiplar
cd frontend && node testlar/hammasi.cjs   # barcha tekshiruvlar
```

⚠️ **`npx tsc --noEmit` (parametrsiz) HECH NARSANI TEKSHIRMAYDI.**
Ildizdagi `tsconfig.json` da `"files": []` + `references` bor
(loyiha ikkiga bo'lingan: app + node). Parametrsiz `tsc` bu holatda
**referencelarni aylanib chiqmaydi** va jim "0 xato" qaytaradi — hatto
fayl umuman kompilyatsiya qilinmaydigan bo'lsa ham.
2026-08-25 da bu **butun sessiya davomida** shu tarzda ishlatilgan va
haqiqiy sintaksis xatolari (import qilinayotgan funksiya eksport
qilinmagan, yo'q modul) hech qachon ko'rinmagan. Har doim
**`-p tsconfig.app.json`** bilan chaqiring.

GASga tegilgan bo'lsa, qo'shimcha:

```bash
cd "Smeta tizimi" && npx clasp push -f
```

⚠️ `clasp push` dan **oldin** `git status` bilan begona `.js` fayl
yo'qligini tekshiring — kuzatilmagan patch-skript GASga tushsa
produksiya yiqiladi.

⚠️ `clasp push` xato bersa **`clasp version` QILMANG** — u eski server
kodidan versiya yasaydi. Bu bir marta bo'lgan.

**Deployment 21 ta.** Bittasini yangilash YETMAYDI:

```bash
cd "Smeta tizimi" && npx clasp deployments
# har biri uchun: npx clasp deploy -i <id> -V <versiya> -d "Update to vN"
```

`79_WebAPI.js` dagi `KOD_VERSIYA` yasalgan versiya raqamiga
teng bo'lsin — «tuzalmadi» deganda avval **versiyani** so'rang, kodni emas.

---

## 6. Nima QILMASLIK kerak

- ❌ Yangi moslashtirish/matcher yozish. `f2MoslashEngine` bor.
- ❌ Og'ir mantiqni frontendga qo'yish. Frontend — oyna.
- ❌ Ikkita haqiqat manbai yaratish (bir mantiq ham SQLda, ham JSda).
- ❌ Sana yoki vaqt tamg'asini generatsiya chiqishiga qo'shish —
  drift testi har safar yiqiladi va unga qarashni bas qilishadi.
- ❌ «Optimallashtirish» ni o'lchamasdan da'vo qilish. Bir marta
  «tezlashtirish» aslida 33.2s → 38.6s qilgan.
- ❌ Test ma'lumotini produksiya obyektiga yozish.

---

## 7. Odamdan so'rash shart bo'lgan holatlar

- Ma'lumot **o'chirish** yoki `ON DELETE CASCADE` qo'shish
  (bir marta re-import moliyaviy qatorlarni jimgina o'chirgan)
- `main` ga push (Cloudflare jonli saytni yangilaydi)
- Tizim_01 produksiya faylini tahrirlash
- Navbatdan tashqari domenni olish
- Xavfsizlik sozlamasini o'zgartirish

---

## 8. Foydali manzillar

| Nima | Qayerda |
|---|---|
| Ish taqsimoti va jurnal | `tizim02/MULOQOT.md`, `tizim02/navbat.json` |
| Ko'chirish holati | `tizim02/KEYINGI.md`, `tizim02/REGISTR.json` |
| Tasnif (qo'lda) | `tizim02/tasnif.json` |
| Qatlam arxitekturasi | `tizim02/ARXITEKTURA.md` — **avval shuni o'qing** |
| Butun ekotizim vizyoni | `ARXITEKTURA.md` (ildizda) |
| Baza qabul testlari | `tizim02/sinov/*.sql` |
| Bosh reja | `MASTER_TAHLIL_VA_QAYTA_QURISH_REJASI.md` |
| Tizim_01 holati | `Smeta tizimi/CLAUDE.md` (ba'zi joyi eskirgan — **kodga ishoning**) |
| F2 sinov stendi | `_f2lab/` — deploysiz, Node'da haqiqiy kod |
| Testlar | `frontend/testlar/hammasi.cjs` |

---

## 9. Ishni topshirish

Tugatgach quyidagilarni yozing (o'ylab topmang — o'lchang):

- Qaysi funksiyalar ko'chirildi, qaysilari **qolmadi va nega**
- Nechta tekshiruv o'tdi (aniq raqam)
- Nima **sinalmadi** — masalan haqiqiy ma'lumot bilan tekshirilmagan bo'lsa
- GAS versiyasi va nechta deployment yangilangani

«Hammasi ishlaydi» deb yozmang. Nima o'lchanganini yozing.
