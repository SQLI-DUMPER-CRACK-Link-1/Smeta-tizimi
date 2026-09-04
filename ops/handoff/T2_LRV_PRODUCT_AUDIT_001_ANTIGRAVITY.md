# T2-LRV-PRODUCT-AUDIT-001

**Role:** INDEPENDENT PTO PRODUCT / UX / DATA-INTEGRITY AUDITOR
**Sana:** 2026-09-03
**Status:** READY FOR IMPLEMENTATION REVIEW

Ushbu hujjat Tizim_01 ning (T1) Local Resource View (LRV) yutuqlarini va xatolarini tahlil qilib, Tizim_02 (T2) uchun qat'iy P0 qoidalarini hamda Acceptance (qabul qilish) mezonlarini belgilaydi. Bu hujjat Claude va Codex uchun arxitektura va implementatsiya qonuni (Contract) bo'lib xizmat qiladi.

---

## 1. T1_REFERENCE_SUMMARY

**T1'dan real o'rganilgan faktlar (Dalillar `F2Import.tsx` va `F2Tayyorlash.tsx` dan olindi):**
- **LRV_PLUS & _ISHTURLAR:** T1 smeta daraxtini qismlarga (razdel, ish, resurs) ajratib, "LRV_PLUS" formatida o'qiydi.
- **F2 Columns:** Oylik ijrolar (Fakt/F2) alohida ustunlarda (hajm, narx, summa) saqlanadi. 
- **Qo'shimcha & Zamena (Drag & Drop):** T1 da yangi Excel qatori smeta qatoriga tashlanganda (drop), tizim uni "Bog'lash" (moslik), "Zamena" (replaces) yoki "Qo'shimcha" (dop) sifatida belgilaydi.
- **Qoldiq (Ostok):** `F2Tayyorlash` modulida faqat "bajarish mumkin bo'lgan qoldiqdan" (smeta - jami F2) yangi F2 shakllantiriladi.
- **F2 Jami & Oylik Triplets:** Har bir oy uchun `{hajm, narx, summa}` alohida qayd etiladi.

---

## 2. P0_PRODUCT_LAWS

T2 Tizimida LRV (Local Resource View) bitta yaxlit, ishchi oynada (Single Working Control View) quyidagi ustun/ma'lumotlarni yo'qotmasligi SHART:
1. **SMETA:** Original smeta miqdori, narxi va summasi.
2. **FAKT:** Qurilish maydonidagi haqiqiy fakt (prorabdan).
3. **OST.SMETA:** Hali bajarilmagan, qoldiq smeta hajmi.
4. **F2 JAMI:** Shu paytgacha tasdiqlangan jami F2 (barcha oylar yig'indisi).
5. **F2 MUMKIN:** Joriy oyda qilinishi mumkin bo'lgan maksimal F2 (OST.SMETA ga teng yoki undan kichik).
6. **RESOURCES:** Ish qatorining ichidagi materiallar, mexanizmlar va ish haqi.
7. **ADDITIONAL:** QO'SHIMCHA ishlar (Smetada yo'q, lekin qo'shilgan).
8. **REPLACEMENT:** ZAMENA qilingan ishlar/materiallar.
9. **F2 HISTORY:** Oylar bo'yicha tarixiy ijro (F2 reestr).

---

## 3. EXACT_F2_ACCEPTANCE (F2 SOURCE FIDELITY)

**QAT'IY QOIDA:** Matematik hisob-kitob (qty * price) tufayli source (asl) hujjatdagi summa (amount) buzilmasligi shart!

* **Ssenariy:** F2 source faylida qty = 10, price = 123.45, amount = 1234.49 ko'rsatilgan.
* **T2 dagi holat:** qty = 10, price = 123.45, amount = 1234.49 saqlanishi SHART.
* **Qoidabuzarlik (P0 FAIL):** Tizim frontend yoki backend darajasida 10 * 1234.45 = 1234.50 qilib `amount`ni qayta hisoblab yuborsa, bu P0 FAIL hisoblanadi. Asl hujjat summasi (source amount) saqlanib qolishi shart. T1 da bu qoida `son(d.summa) || son(d.obyom) * son(d.narx)` shaklida to'g'ri ishlangan.

---

## 4. CATALOG_ACCEPTANCE

T2 tizimiga har qanday smeta yoki F2 yuklanganda Katalog bilan tekshiruv (matching) quyidagicha ishlashi shart:
- **Identifikatsiya:** Yangi "Ish turi" (work type), material, uskuna/resurs katalogdan topildimi?
- **Provenance (Kelib chiqishi):** Har bir yozuvning qayerdan (qaysi obyekt, qaysi sana) kelib chiqqanligi saqlanadimi?
- **Duplicate boshqaruvi:** Bir xil kodli elementlar dublikat qilinmasligi, aniq boshqarilishi shart.
- **Ambiguous Identity:** Shubhali (bir xil nomli, lekin kodi yo'q) yozuvlar avtomatik birlashtirilmasligi (no auto-merge) kerak. Inson tasdig'i talab etiladi.

---

## 5. CROSS-OBJECT PRICE SAFETY (P0)

**QAT'IY QOIDA:** Katalogdagi element identifikatsiyasi obyektlararo umumiy bo'lishi mumkin, lekin **NARX** (price) qat'iy ravishda `source/object/date` doirasida izolyatsiya qilinishi shart!

* **Ssenariy:** "Sement M400" materiali Object A'da 100 000 so'm, Object B'da 150 000 so'm.
* **P0 FAIL:** Tizim avtomatik ravishda Object B'dagi 150 000 so'mni Object A smetasiga yoki narxiga ta'sir qildirib qo'ysa, tizim yaroqsiz deb topiladi (P0).

---

## 6. ADDITIONAL_ACCEPTANCE (QO'SHIMCHA ISH UX)

Qo'shimcha ishlarni (DOP) boshqarish:
- **Professional ko'rinish:** Qo'shimcha ish qatori oddiy ish qatori kabi ko'rinishi va ishlashi kerak.
- **Resource bolalari:** O'z ichiga material/mexanizm resurslarini to'liq olishi shart.
- **Metadata:** Smetaga nisbatan "qo'shimcha" ekanligi nomida emas, balki "hidden metadata" (relation) orqali saqlanishi kerak.
- **P0 FAIL:** Nomga `[QO'SHIMCHA]` degan "textual garbage" qo'shib qo'yilmasligi shart.

---

## 7. REPLACEMENT_ACCEPTANCE (ZAMENA UX)

Zamena (o'zgartirish) ishlarni boshqarish:
- **Eski Qator (OLD):** Asl smeta qatori O'ZGARISHSIZ (unchanged) qolishi shart.
- **Yangi Qator (NEW):** Normal qator bo'lib qo'shiladi.
- **Relation (Aloqa):** Tizim "NEW replaces OLD" munosabatini bazada saqlashi kerak.
- **Ko'rinish:** Foydalanuvchi eski va yangi qatorni yonma-yon ko'ra olishi va tarixini kuzatishi shart.
- **P0 FAIL:** Eski smeta qatorining NOMI ni o'zgartirib yuborish (mutation). Masalan, nom oxiriga `[ZAMENA]` qo'shish qat'iyan man etiladi.

---

## 8. SHEETS_SYNC_ACCEPTANCE (SHEETS ↔ SUPABASE)

Google Sheets faqat interfeys (view) hisoblanadi. Supabase (backend) esa YAGONA HAQIQAT (Single Source of Truth).
**Adversarial Matrix:**
1. **Supabase → Sheet:** Backenddagi o'zgarish darhol Sheet'ga yozilishi kerak.
2. **Sheet → Supabase:** Foydalanuvchi Sheet'da raqamni o'zgartirsa, tasdiqlangandan keyin Supabase'ga yozilishi shart.
3. **Simultaneous edit:** Bir qatorda bir vaqtda tahrir bo'lsa, Optimistic Locking orqali hal etilishi (yoki so'nggi vaqt muhriga qaralishi).
4. **Offline edit:** Sheet offline o'zgartirilib, keyin tarmoqqa ulansa, conflict resolution oynasi chiqishi.
5. **Sort / Filter:** Sheet'da sort/filter qilinganda, Supabase'dagi satrlar adashib ketmasligi (satr ID'siga tayanish).
6. **Row move / Duplicate event:** Qatorlar o'rni almashganda yoki nusxalanganda ID'lar orqali to'g'ri bog'lanishi.
7. **Deleted row:** Sheet'dan qator o'chirilsa, Supabase'da o'chmasligi, balki UI'da "Delete warning" chiqishi kerak.
8. **Approved F2 manual edit:** Tasdiqlangan (Approved) F2 ni Sheet'dan o'zgartirish block qilinishi shart (Faqat read-only cell).

---

## 9. P0: SHEETS IS NOT TRUTH

Agar Google Sheet to'liq o'chib ketsa, buzilsa yoki API ishlamay qolsa ham, tizimdagi **KANONIK MA'LUMOTLAR YO'QOLMASLIGI SHART**. 
Tizim istalgan vaqtda Supabase va R2 da saqlangan ma'lumotlar orqali Sheet proyeksiyasini 100% qayta qura olishi (rebuild projection) shart.

---

## 10. HUMAN UX

Oddiy PTO muhandisi ma'lumotlar bazasi (DB), Sync, Conflict, IDlar haqida o'ylamasligi kerak.
- Uning ishi: Fakt kiritish, F2 yuklash, Qoldiqni ko'rish, F2 shakllantirish, Qo'shimcha/Zamena qo'shish.
- Sync xatosi yoki conflict ro'y berganda "SQL Error" emas, balki **"Ma'lumotlar mos kelmadi. Yangi versiyani yuklab oling"** kabi professional xabarlar chiqishi shart.

---

## 11. T1 VS T2 MATRIX

| T1 Feature | T1 Strength | T1 Defect | T2 Required Behavior | Acceptance Test |
| :--- | :--- | :--- | :--- | :--- |
| **Smeta Daraxti (LRV_PLUS)** | Barcha obyektlar bir joyda ko'rinadi | Daraxt juda sekin ishlaydi | Virtualized Row / Caching orqali 60fps tezlikda ko'rsatish | Minglab qatorlarni 1 soniya ichida yuklash va scroll qilish |
| **F2 Yuklash (Bog'lash)** | Drag & Drop ishlashi qulay | Narxlarni avtomat qayta hisoblab, source summani buzib yuborish holatlari (floating point) | Source (Excel) dagi amount O'ZGARISHSIZ (literal) saqlanishi | F2 faylidagi 1234.49 Supabase va UI'da aynan 1234.49 ko'rsatilishi |
| **Zamena / Qo'shimcha** | Vizual farqlash (ranglar orqali) ishlangan | Qator nomiga manfiy o'zgartirish (mutation) kiritish | Asl qator o'zgarmaydi, relation saqlanadi, izoh tag'i qo'shilmaydi | `[Qo'shimcha]` deb nomni buzganda P0 FAIL |
| **Google Sheet orqali F2** | Sheet qulay | Sheet buzilsa DB ham buzilishi yoki desync | Sheet faqat yuzaki UI (Projection). Supabase = Truth. | Sheet'ni butunlay o'chirib tashlab, yana yangidan Generate qilib ko'rish |

---

## 12. XULOSA VA KEYINGI QADAMLAR

**RISKS:**
- **Data Precision Risk:** T2 da JavaScript'ning floating point muammosi F2 summasini buzishi eng katta xavf. Numeric tiplar to'g'ri tanlanishi shart.
- **Sync Mismatch:** Foydalanuvchilar Sheetda noto'g'ri ishlashi orqali DBni bulg'atish xavfi.

**P0 BLOCKERS (Implementation uchun):**
- F2 Exact Amount fidelity.
- Cross-object price safety (Isolation).
- No name mutation on Replacements/Additions.

**READY_FOR_IMPLEMENTATION_REVIEW: YES**

Codex va Claude ushbu hujjatdagi qoidalarga (qonunlarga) to'liq bo'ysungan holda T2-LRV modulining implementatsiyasini boshlashlari mumkin.
