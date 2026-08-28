# AUDIT — Maqsad vs Haqiqiy holat (2026-08-28)

> Foydalanuvchi maqsadi (o'z so'zlari bilan):
> *«Rahbar mindmapni ochsa butun tashkilotiga nima bo'layotganini ko'rib
> turishi kerak. Masalan PTO Amfiteatrga parapet kerak, 90 metr zayavka
> qilsa — o'sha Amfiteatrda bir tick paydo bo'ladi, ya'ni shu obyekt
> uchun bildirishnoma bo'ladi.»*
>
> Bu hujjat — **jonli bazadan va koddan** olingan haqiqiy holat, taxmin
> emas. Har raqam `SELECT` bilan tekshirilgan.

---

## 1. Maqsad qismlarga bo'linganda

Rahbarning «tirik xarita»si uchun 4 narsa kerak:

| # | Kerak | Holat |
|---|---|---|
| A | Zayavka yozish (PTO: «Amfiteatrga 90 m parapet») | 🟡 Jadval bor, **yozish yo'li BUZUQ** |
| B | Hodisa oqimi (nima bo'layotgani yozib borilishi) | 🔴 **Jadval bor, lekin BO'SH — hech narsa yozmaydi** |
| C | Mindmap tugunida belgi/tick ko'rinishi | 🔴 **UMUMAN YO'Q** |
| D | Jonli yangilanish (rahbar ochib tursa o'zi yangilansin) | 🔴 **YO'Q** (faqat qo'lda «Yangilash») |

**Ya'ni aytgan aniq stsenariyingiz hozir 0% ishlaydi.** Sababi pastda.

---

## 2. A — Zayavka: jadval BOR, yozish yo'li YO'Q

`t2_erp_taminot` jadvali aynan shu ish uchun:
```
id, kompaniya_id, obyekt_id, buyurtma_raqami, maxsulot, miqdor, birlik,
holat, yaratilgan_vaqt
```
«Amfiteatr / parapet / 90 / metr / yangi» — bemalol sig'adi.

**LEKIN:**
- `sb-yoz.ts` da `erp_amal` amali `t2_erp_amal` RPC'sini chaqiradi —
  **bu RPC bazada UMUMAN YO'Q** (`SELECT count(*) FROM pg_proc … = 0`).
  Ya'ni yozish urinishi 404 bilan qaytadi.
- `TestErp.tsx` (Tizim_02) da zayavka qo'shish formasi ham **yo'q** —
  faqat o'qiydi.
- Jadvalda **0 qator**.

⚠️ **Muhim**: bu funksiya **Tizim_01 da ISHLAYDI** — `ErpTaminot.tsx`
`useZayavkaQosh`/`useZayavkaHolatYangila` orqali GAS'ga yozadi (Google
Sheets). Ya'ni **ko'chirilmagan**, yo'qolgan emas.

---

## 3. B — Hodisa oqimi: jadval bor, BO'SH

`t2_audit_log` + `t2_audit_reestr` + `t2_audit_yoz` RPC — hammasi bor
va ishlaydi (qurilgan, sinalgan).

**Lekin `SELECT count(*) FROM t2_audit_log` = 0.**

Sabab: `t2_audit_yoz` ni **hech kim chaqirmaydi**. Har amal (smeta
tahriri, F2 yozish, sklad harakati, bog'lanish) o'z ishini qiladi-yu,
audit yozuvini qoldirmaydi. Ya'ni «nima bo'layotgani» yozilmaydi —
rahbarga ko'rsatadigan narsaning o'zi yo'q.

**To'g'ri yechim**: har RPC ichida qo'lda `t2_audit_yoz` chaqirish
EMAS (unutiladi), balki **Postgres trigger** — jadval o'zgarsa
avtomatik yoziladi. Antigravity ham shuni taklif qilgan edi.

---

## 4. C — Mindmap tugunidagi belgi: umuman yo'q

Hozir `t2_mindmap_grafi` har tugun uchun faqat quyidagini qaytaradi:
`id, tur, nom, meta, x, y`.

**Yo'q narsalar:** ochiq zayavkalar soni, ogohlantirishlar, oxirgi
harakat vaqti, «e'tibor kerak» belgisi. Mindmap **statik tuzilma
xaritasi** — «tirik holat paneli» emas.

---

## 5. D — Jonli yangilanish: yo'q

Butun loyihada Supabase Realtime / WebSocket / SSE **ishlatilmaydi**
(`grep` bilan tekshirildi — faqat bitta `useF2Store` da ichki
`subscribe`, u Zustand, tarmoq emas). Rahbar xaritani ochib tursa,
yangi zayavka o'zi paydo bo'lmaydi — «Yangilash» bosishi kerak.

---

## 6. Umumiy holat — nima HAQIQATAN bor (jonli raqamlar)

| Qatlam | Yozuv soni | Baho |
|---|---|---|
| Smeta qatorlari (`t2_qator`) | **14 653** | ✅ Haqiqiy, ishlaydi |
| Viborka (material ehtiyoji) | **870** | ✅ Haqiqiy |
| Obyektlar | 5 | ✅ |
| Sklad harakati / qoldiq | 11 / 5 | 🟡 Boshlangan |
| Shartnoma | 1 | 🟡 |
| F2/Fakt hujjati | **1** | 🔴 Deyarli bo'sh |
| To'lov / Xarajat | **0 / 0** | 🔴 Bo'sh |
| AOSR | **0** | 🔴 Bo'sh |
| Grafik (Gantt) | **0** | 🔴 Bo'sh |
| Zayavka | **0** | 🔴 Yozib bo'lmaydi |
| Audit log | **0** | 🔴 Hech narsa yozmaydi |

**Xulosa**: **smeta yadrosi haqiqiy va kuchli** (14 653 qator — bu jiddiy
ish). Undan yuqoridagi **operatsion qatlamlar deyarli bo'sh** — chunki
ularning ko'pi yo yozish yo'li buzuq, yo umuman ko'chirilmagan.

Sizning «10% dan past» degan bahoyingiz **to'g'ri** — men buni
raqamlar bilan tasdiqlayman.

---

## 7. Maqsadga yetish uchun aniq ketma-ketlik

Aytgan stsenariyingiz (PTO zayavka → Amfiteatrda tick) uchun **4 qadam**
kerak, tartibi muhim:

**1-qadam — Zayavka yozish yo'lini tuzatish** (eng kichik, eng foydali)
- `t2_zayavka_yoz` / `t2_zayavka_holat` RPC qurish (`t2_erp_amal`
  o'rniga — u umumiy «amal» blob'i edi, loyiha konvensiyasiga zid).
- `TestErp.tsx` ga zayavka qo'shish formasi.
- Tizim_01 dagi ishlaydigan mantiqni qoida sifatida ko'chirish.

**2-qadam — Hodisa oqimini yoqish** (trigger)
- Muhim jadvallarga (`t2_erp_taminot`, `t2_akt`, `t2_sklad_harakat`,
  `t2_tolov`, `t2_qator`) trigger → `t2_audit_log` avtomat to'ladi.
- Qo'lda chaqirish EMAS — unutiladi.

**3-qadam — Mindmapga «tirik» ustunlar**
- `t2_mindmap_grafi` har obyekt tugunига qo'shsin:
  `ochiq_zayavka`, `ogohlantirish`, `oxirgi_harakat`.
- Tugunda rangli belgi/son ko'rinsin (aynan siz aytgan «tick»).

**4-qadam — Jonli yangilanish**
- Supabase Realtime yoki oddiy 15-30 soniyalik polling.
- Realtime chiroyliroq, lekin polling **ancha sodda va yetarli** —
  rahbar paneli uchun 30 soniya kechikish muammo emas.

---

## 8. Halol ogohlantirish

Bu 4 qadam **mindmapni tirik qiladi**, lekin «butun tashkilotni
boshqarish» degani emas. Undan keyin ham qoladi: F2/Fakt kundalik
ishlashi, to'lov/xarajat oqimi, AOSR, Gantt — bularning hammasi
hozir **bo'sh** va har biri alohida ish.

Ya'ni: 4 qadam — bu «rahbar ko'radi» darajasi.
«Rahbar boshqaradi» darajasi — undan keyingi katta bosqich.
