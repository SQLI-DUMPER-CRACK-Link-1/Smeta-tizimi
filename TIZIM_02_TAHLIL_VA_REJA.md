# TIZIM_02 — TAHLIL VA REJA

> 2026-08-19 · uch manba solishtirildi: (1) `Qurilish_AI_OS_Global_Arxitektura_va_Rivojlanish_Rejasi.docx`,
> (2) foydalanuvchining ChatGPT bilan kelishgan yo'nalishi, (3) **bazadagi haqiqiy holat** (Supabase MCP orqali o'qildi).
>
> Bu hujjat taxminlar ustiga qurilmagan — har raqam tekshirilgan.

---

## 0. Eng muhim topilma: hujjat bilan maqsadingiz BIR JOYDA ZID

Buni birinchi aytish kerak, chunki u butun rejani belgilaydi.

**Hujjat, 55-satr:**
> «Google Sheets database emas; **compatibility/import/export interfeysi** sifatida qoladi.»

**Sizning maqsadingiz:**
> «Sheets qulay bo'lgan foydalanuvchi bo'ladi, frontend qulay bo'lgani bo'ladi — **har ikki taraf ham bir xil kuchga ega bo'lishi** va markazlashgan sinxronizatsiya bo'lishi kerak.»

Bu ikki xil arxitektura:

| | Hujjat yo'li | Sizning yo'lingiz |
|---|---|---|
| Sheets vazifasi | eksport/import, o'qish uchun | **to'liq klient — yozadi ham** |
| Sinxronizatsiya | bir tomonlama (baza → Sheets) | **ikki tomonlama** |
| Ziddiyat (conflict) | yo'q, chunki Sheets yozmaydi | **bor va hal qilinishi shart** |
| Qiyinlik | o'rtacha | **sezilarli yuqori** |

**Xulosam:** sizning yo'lingiz **haqiqatga yaqinroq** — quruvchi Sheets'da ishlashni to'xtatmaydi, uni majburlash ishlamaydi. Lekin bu yo'l qimmatroq va uni ochiq tan olish kerak.

Eng xatarli variant — **ikkalasini aralashtirib qo'yish**: Sheets'ga yozish imkoni bor, lekin ziddiyat nazorati yo'q. O'shanda ma'lumot jim buziladi. Bu tizimda buning tarixi bor ([[soxta-malumot-buzilishlari]]).

---

## 1. Hozir HAQIQATDA nima bor (o'lchangan, taxmin emas)

### Tizim_01 — ishlab turibdi
| Jadval | Qator |
|---|---|
| `obyektlar` | 73 |
| `holat` | **51 317** |
| `tarix` | 18 305 |
| `narxlar` | 2 437 |
| `material_kerak` | 7 797 |
| `prixod` / `rashod` | 4 970 / 4 590 |
| `akt` | 766 |

Bu ko'zgu — Sheets haqiqat manbai.

### Tizim_02 — poydevor qurilgan, ichi bo'sh
| Jadval | Qator | Vazifasi |
|---|---|---|
| `t2_xom` | 21 | **o'zgarmas xom qatlam** (fayldan nima kelgan bo'lsa) |
| `t2_qator` | 13 | hisoblangan daraxt |
| `t2_narx` | 6 | narx bazasi |
| `t2_obyekt` | 1 | sinov obyekti |
| `t2_ozgarish` | 2 | **maydon darajasidagi o'zgarish jurnali** |
| `t2_kozgu` | 0 | Sheets ko'zgusi holati |

**17 ta Postgres funksiyasi:** `t2_markirovka`, `t2_narx_svodkadan`, `t2_narxla`, `t2_rollup`, `t2_tasnif`, `t2_birlik_baza`, `t2_kat_birlik` va yordamchilar.

### Bu nimani anglatadi

Zanjir **ishlab ko'rilgan**: fayl → `t2_xom` → markirovka → narxlash → jamlash → daraxt. Sinov obyektida 13 qator, jami 45 040 000.

Ya'ni **eng qiyin qism — tasnif va narxlash mantig'i Postgres'da allaqachon ishlaydi.** Bu kutilganidan ancha oldinda.

---

## 2. Hujjat haqida — nimasi to'g'ri, nimasi sizga hozir kerak emas

### To'g'ri va qimmatli
- **Domain modelga ajratish** (`estimate / execution / procurement / warehouse / documents`) — bu to'g'ri fikr. Hozirgi `t2_qator` universal, lekin F2/fakt qo'shilganda bo'linishi kerak.
- **«Cell koordinatalari model kaliti bo'lmasin»** — `t2_qator` da `xom_qator` bor, lekin kalit `id`. To'g'ri qilingan.
- **Audit / `field_changes`** — `t2_ozgarish` allaqachon shunday: `maydon, eski, yangi, amal, manba, kim, ziddiyat`.
- **«AI moliyaviy sonlarni taxmin qilmasin»** — bu tizimning eng muhim qoidasi, saqlanishi shart.

### Sizga HOZIR kerak emas (va sekinlashtiradi)
- **Multi-tenant / `company_id` / RLS** — hujjat ko'p kompaniyaga sotiladigan SaaS uchun yozilgan. Sizga hozir **bitta kompaniya** kerak. `company_id` ni keyin qo'shish mumkin; hozir qo'shilsa har so'rov murakkablashadi va foyda nol.
- **Next.js ga ko'chish** — sizda Cloudflare + React allaqachon ishlayapti. Qayta yozish bir necha hafta yeydi, foydasi yo'q.
- **12–18 oylik reja** — u to'liq stavkali jamoa uchun. Hujjatning o'zi ham «solo part-time uchun 18–30 oy» deb yozgan.

### Hujjatning eng kuchli jumlasi
> «Eng katta xato — hozirgi Apps Script kodini satrma-satr Supabase'ga ko'chirish.»

Bunga qo'shilaman. Va `T2_Import.js` aynan shuni **qilmagan** — u xom qatlam yaratib, mantiqni SQL'da qayta qurgan. To'g'ri yo'l.

---

## 3. Sizning maqsadingiz uchun nima YETISHMAYDI

Ikki teng klient + markazlashgan sinxronizatsiya uchun uchta narsa kerak. Ikkitasi bor, bittasi yo'q.

| Kerak | Holat |
|---|---|
| Universal `id` (satr raqami emas) | ✅ `t2_qator.id` |
| Maydon darajasida o'zgarish jurnali | ✅ `t2_ozgarish` (manba, kim, ziddiyat maydonlari bilan) |
| **`versiya` ustuni** — ziddiyatni aniqlash uchun | ❌ **YO'Q** |

### Nega `versiya` kritik

Sizning misolingiz bilan:

```
10:00:01  Frontend  → narx = 20 000
10:00:02  Sheets    → narx = 21 000
```

`versiya`siz: oxirgi yozgan yutadi, birinchisining ishi **jim yo'qoladi**.

`versiya` bilan:
```
Baza: versiya = 100
Frontend: "men 100 ni ko'rgandim" → yozadi → versiya = 101  ✅
Sheets:   "men 100 ni ko'rgandim" → RAD ETILADI ❌
          → «Bu qatorni boshqa kishi o'zgartirdi, yangilang»
```

Moliyaviy ma'lumotda **oxirgi yozgan yutadi** qoidasi qabul qilib bo'lmaydi.

---

## 4. REJA — bosqichlar

Har bosqich oxirida **ishlaydigan narsa** bo'ladi va orqaga qaytish mumkin.

### A. Poydevorni tugatish *(qilingan ishga qo'shimcha — kichik)*
- [ ] `t2_qator` ga `versiya integer default 1` qo'shish
- [ ] Har `update` da `versiya = versiya + 1` (trigger)
- [ ] `t2_ozgarish` ga `versiya` yozilishi
- [ ] Yozish RPC: `p_kutilgan_versiya` argumenti; mos kelmasa `ziddiyat` qaytaradi

**Natija:** ikki tomonlama yozuv uchun poydevor tayyor. Hech narsa buzilmaydi.

### B. Haqiqiy smetani import qilish *(asosiy sinov)*
- [ ] `apiT2ObyektImport` ni katta obyektda ishga tushirish (Amfiteatr — 4937 qator)
- [ ] Natijani Tizim_01 bilan **raqamma-raqam** solishtirish
- [ ] Farq chiqsa — SQL tasnifini tuzatish (Drive'ga qayta borish shart emas, xom qatlam turibdi)

**Gate:** jami summa Tizim_01 bilan teng bo'lmasa — keyingi bosqichga o'tilmaydi.

### C. Frontenddan yozish
- [ ] `t2_qator` tahriri (hajm, narx) — `versiya` tekshiruvi bilan
- [ ] Ziddiyat chiqsa aniq xabar: «boshqa kishi o'zgartirdi, yangilang»
- [ ] Har o'zgarish `t2_ozgarish` ga tushadi

**Natija:** birinchi teng klient ishlaydi.

### D. Sheets ko'zgusi + undan yozish
- [ ] `apiT2KozguYarat` — baza → Sheets (kod tayyor, sinash kerak)
- [ ] Sheets'da `SUPABASE_ID` va `VERSIYA` ustunlari (ko'rinmas)
- [ ] GAS trigger: o'zgarishni sezadi → RPC ga yuboradi → ziddiyat bo'lsa katakni qizil qiladi

**Natija:** ikkinchi teng klient. **Shu yerda maqsadingizga yetiladi.**

### E. F2 / Fakt
- [ ] `t2_f2`, `t2_fakt` jadvallari
- [ ] Invariantlar: `f2 ≤ fakt`, `qoldiq = smeta − fakt`
- [ ] F2 import — avval **ikkala tizimga** yozib solishtiradi

### F. Drive — hujjatlar ombori
- [ ] `t2_hujjat`: `drive_file_id, tur, versiya, hash`
- [ ] Frontenddan «asl faylni ochish»

---

## 5. Nimani QILMAYMIZ

| Qilmaymiz | Nega |
|---|---|
| Tizim_01 ni o'chirish | U ishlab turibdi; Tizim_02 tayyor bo'lgunча tegilmaydi |
| GAS ni butunlay tashlash | Drive/Excel/Sheets ga faqat u kira oladi |
| `10_Engine.js` ni satrma-satr SQL ga ko'chirish | Hujjat ham shuni ogohlantiradi; xom qatlam + qayta yozilgan SQL to'g'riroq |
| Multi-tenant hozir | Bitta kompaniya uchun ortiqcha murakkablik |
| Next.js ga ko'chish | Mavjud frontend ishlayapti |
| Sheets formulalarini haqiqat manbai qilish | Aynan shundan qochyapmiz |
| Versiyasiz ikki tomonlama yozuv | Ma'lumot jim buziladi |

---

## 6. Muddat — halol baho

Hujjat 12–18 oy deydi, lekin u **ko'p kompaniyali SaaS** uchun. Sizning hozirgi maqsadingiz — **bitta ishlaydigan tizim**, bu ancha kichik.

| Bosqich | Baho |
|---|---|
| A. Versiya poydevori | 1–2 kun |
| B. Katta smeta importi + solishtirish | 3–5 kun |
| C. Frontenddan yozish | 1 hafta |
| D. Sheets ikki tomonlama | 2–3 hafta ⚠️ eng qiyini |
| E. F2 / Fakt | 3–4 hafta |
| F. Drive hujjatlar | 1 hafta |

**A–D ≈ 1–1.5 oy** → maqsadingizga yetiladi (Supabase miya, ikki teng klient).
**A–F ≈ 2.5–3 oy** → hozirgi tizim funksiyalarining asosiy qismi.

Bu hujjatdagi 12–18 oydan farq qiladi, chunki:
- multi-tenant, SaaS, billing, 1C/Didox — **kiritilmagan**
- frontend qayta yozilmaydi
- eng qiyin qism (tasnif + narxlash SQL) **allaqachon ishlaydi**

---

## 7. Keyingi bitta qadam

**B bosqichi — haqiqiy katta smetani import qilish.**

Sabab: A (versiya) muhim, lekin u **kutish mumkin**. B esa butun rejaning eng katta noma'lumini yopadi — *SQL tasnifi haqiqiy, murakkab smetada Tizim_01 bilan bir xil natija beradimi?*

Agar beradi — qolgani texnika ishi.
Agar bermaydi — hozir bilganimiz yaxshi, kech bilganimizdan ko'ra.
