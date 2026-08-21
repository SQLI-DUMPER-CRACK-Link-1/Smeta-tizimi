# TIZIM_01 ↔ TIZIM_02 RECONCILIATION — Amfiteatr

**Sana:** 2026-08-21
**Reja bo'yicha:** TASK 03 (Tizim_01 vs Tizim_02 solishtiruvi)
**Usul:** to'g'ridan-to'g'ri SQL, ikkala tomon ham Supabase'da

---

## 0. Avvalgi noto'g'ri raqam — tuzatildi

Oldingi suhbatda «Tizim_01 = 25 644 397 430» deb aytilgan edi. **Bu xato.**
O'sha o'lchov noto'g'ri ustunlar bo'yicha olingan. To'g'ri raqam quyida.

Bu muhim, chunki xato raqamga qarab «ikki tizim juda uzoq» degan noto'g'ri
xulosa chiqarilgandi. Aslida ular **1% farq** bilan yaqin.

---

## 1. Manba va uning chegarasi

| | Manba | Izoh |
|---|---|---|
| Tizim_01 | `holat` jadvali | LRV_PLUS ning Supabase'dagi **ko'zgusi** |
| Tizim_02 | `t2_qator` (obyekt_id=6) | to'g'ridan-to'g'ri |

⚠️ **Chegara:** `holat` — Tizim_01 ning o'zi emas, ko'zgusi. Amfiteatr
qatorlari 2026-07-12 dan 2026-08-19 gacha bosqichma-bosqich sinxlangan
(oxirgi yangilanish 19-avgust). Ya'ni ba'zi qatorlar eskiroq bo'lishi
mumkin. Yakuniy tasdiq uchun LRV_PLUS dan to'g'ridan-to'g'ri o'qish kerak.

---

## 2. JAMI — asosiy natija

| | Qator (resurs) | Summa |
|---|---:|---:|
| **Tizim_01** | 9 543 | **43 165 388 534** |
| **Tizim_02** | 9 448 | **43 596 859 621** |
| Farq | −95 | **+431 471 087  (+1.00 %)** |

Ya'ni ikki tizim **1% ichida**. Bu «mos» degani emas, lekin
«butunlay boshqacha» ham emas — aniq va tor farq.

---

## 3. Kategoriya bo'yicha

⚠️ **Kategoriyani to'g'ridan-to'g'ri solishtirib bo'lmaydi**, chunki
Tizim_01 ko'zgusida **1 382 qator kategoriyasiz** (30.4 mlrd, jamining
70%). Bu Tizim_02 nuqsoni emas — ko'zgu `kategoriya` ustunini
to'ldirmagan.

Shuning uchun solishtirish `tur` bo'yicha qilindi.

### ОБ (uskuna) — MOS KELDI

Ikki tizim uskunani **boshqacha yozadi**, lekin ayni bir narsani:

| | Qanday saqlaydi | Qator | Summa |
|---|---|---:|---:|
| Tizim_01 | `tur='ob'` | 270 | 17 520 991 104 |
| Tizim_02 | `tur='mat'` + `kat='ОБ'` | 269 | 17 519 108 752 |
| Farq | | −1 | **−1 882 352 (0.011 %)** |

**Xulosa: ОБ mos keldi.** Bu bugungi tuzatishning tasdig'i — ilgari
Tizim_02 da ОБ 0 turgan edi.

### Qolgan turlar

| tur | T01 qator | T02 qator | T01 summa | T02 summa | farq % |
|---|---:|---:|---:|---:|---:|
| rs | 8 161 | 8 078 | 12 749 221 457 | 13 393 818 480 | **+5.06 %** |
| mat (ОБ siz) | 1 112 | ~1 101 | 12 895 175 973 | ~12 683 932 389 | **−1.64 %** |
| bl | 878 | 868 | — | — | −10 qator |
| rz | 0 | 221 | — | — | ko'zguda razdel yo'q |

`bl` va `rz` summalari solishtirilmaydi: ular bolalarining yig'indisi,
ikki tizimda ierarxiya boshqacha qurilgan.

---

## 4. Ochiq farqlar — ustuvorlik bo'yicha

### P1 — `rs` +5.06 % (+644 597 023)

Resurs qatorlarining summasi Tizim_02 da yuqoriroq, qator soni esa 83
tага KAM. Ya'ni gap qator sonida emas, **narx yoki hajmda**.

Tekshirish kerak: bir xil resursni ikkala tomondan olib, `hajm` va
`narx` ni yonma-yon qo'yish. Ehtimoliy sabab — norma×blok hisobidagi
yaxlitlash yoki narx manbaining farqi.

### P2 — qator soni farqi (rs −83, bl −10, mat +12)

Kichik, lekin sababi aniqlanishi kerak. Ehtimol tasnif chegaralari
(takroriy sarlavha, soxta razdel) ikki tizimda biroz boshqacha.

### P3 — ko'zgu to'liqligi

`holat` da razdel qatorlari yo'q va 1 382 qator kategoriyasiz.
Solishtiruvni mustahkamlash uchun LRV_PLUS dan to'g'ridan-to'g'ri
o'qiladigan harness kerak.

---

## 5. Keyingi qadam

Reja (TASK 03) «faqat deterministik farqlarni tuzatish» deydi.
Shu bo'yicha keyingi bitta ish:

> **`rs` +5.06 % farqining ildizini topish** — bir xil resursning
> hajm va narxini ikki tizimdan olib solishtirish.

Undan oldin boshqa modulga o'tilmaydi.

---

## 6. Nima o'zgardi (bugun)

- `t2_kat_seksiya` + `t2_ilk_matn` — svodka seksiya sarlavhasi
  birlashgan katakda bo'lsa ham topiladi → ОБ 0 dan 17.5 mlrd ga
- `t2_narx_svodkadan` — ustunlar sarlavhadan aniqlanadi, «КОЛ-ВО» ham
  tanilaadi
- Bu o'zgarishlar natijasida ОБ Tizim_01 bilan 0.011 % farq bilan mos
  keldi
