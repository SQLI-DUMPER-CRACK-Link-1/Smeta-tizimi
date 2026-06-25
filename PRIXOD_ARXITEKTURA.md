# 📦 PRIXOD (СКЛАД) TIZIMI — IDEAL ARXITEKTURA (Antigravity davom ettiradi)

> Material kirim/sklad tizimini ekotizimga **ideal va kuchli** ulash. Bu hujjat — to'liq dizayn.
> Claude poydevorni qo'ydi (8-bo'lim), Antigravity 9-bo'limdagi bosqichlar bo'yicha davom ettiradi.
> Bog'liq: `AKT_ARXITEKTURA.md`, `ANTIGRAVITY_UCHUN.md`, `SUPABASE_SYNC.md`, `Smeta tizimi/CLAUDE.md`.

---

## 1. MUAMMO (hozir) va MAQSAD (ideal)

**Hozir:** Prixod — alohida Google Sheet (`1vchaALF...`), Smeta `45_Hujjatlar.js` o'qiydi/yozadi.
Ustunlar: `0№ 1Наименование 2Раздел 3Ед.изм 4Объем 5Дата 7Поставшик 9Цена 13остатка`.
- ❌ Panel faqat 150 so'rardi → hammasi chiqmasdi *(tuzatildi: 0=barchasi)*.
- ❌ Flat ro'yxat → chalkash *(tuzatildi: раздел bo'yicha yig'iladigan guruh)*.
- ❌ Faqat **kirim (prihod)** bor — **chiqim (расход)** yo'q → haqiqiy qoldiq hisoblanmaydi.
- ❌ **Obyekt** ustuni yo'q → material qaysi obyektga ketgani bilinmaydi.
- ❌ Deficit/anti-fraud nazorati yo'q; smeta ehtiyoji (kerak) bilan bog'lanmagan.

**Maqsad (ideal — to'liq SKLAD tizimi):**
1. **Kirим (prihod) + Chiqim (rashod) → Qoldiq (ostatka)** har material bo'yicha.
2. **Obyekt + postavshik + sana + narx** kuzatuvi → analitika.
3. **Deficit nazorati:** kerak (smeta) vs kelgan (prihod) vs ishlatilgan (rashod).
4. **Anti-fraud:** narx sakrashi, ortiqcha kirim, manfiy qoldiq, takror yozuv.
5. Registr: guruhlangan, filtrlangan, qidiriladigan, tez.
6. Frontend/Supabase'da to'liq sklad ko'rinishi.

---

## 2. DOMEN MODELI — SKLAD

```
KERAK (smeta)          KIRИМ (prihod)         CHIQIM (rashod)        QOLDIQ
material ehtiyoji  →   omborga keldi      →   ishga berildi      =   ombordagi qoldiq
(Smeta material_kerak) (Prixod ledger)        (YANGI — kerak)        (Σkirim − Σchiqim)
```

**Asosiy obyektlar:**
- **Prihod yozuvi** — bitta yetkazib berish: material, hajm, birlik, sana, postavshik, narx, obyekt.
- **Rashod yozuvi** (YANGI) — ishga berish: material, hajm, sana, obyekt, kim oldi/qaysi ish.
- **Material (sklad karta)** — agregat: Σkirim, Σchiqim, qoldiq, o'rtacha narx.

**Munosabatlar:**
```
POSTAVSHIK ──1:N── PRIHOD ──N:1── MATERIAL ──N:1── RASHOD ──N:1── OBYEKT/ИШ
                                      │
                            (manual link, ixtiyoriy) SMETA material_kerak
```

---

## 3. ⭐ MATERIAL-KALITI va SMETA bilan bog'lanish

**Sklad ICHIDA** (agregatsiya/dedup uchun): `material_key = _normNomKey(nom) || _normBirlik(bir)`.

**SMETA bilan bog'lanish:** ⚠️ Material nomlari Smeta ↔ Prixod ↔ Viborkada **mos kelmaydi**
(qarang `[[material-mustaqil-tizimlar]]`). Shuning uchun:
- **Majburiy avto-moslik YO'Q.**
- Deficit kerak bo'lsa — **qo'lда bog'lash + AI/fuzzy taklif** (akt kabi): prihod materiali →
  smeta material_kerak nomzodlari (nom o'xshashligi / Claude) → inson tasdiqlaydi → doimiy.
- Bog'lanmasa ham Prixod **mustaqil** to'liq ishlaydi (o'z sklad qoldig'ini hisoblaydi).

---

## 4. REGISTR ARXITEKTURASI (chalkashmaslik)

- **Guruh:** раздел bo'yicha yig'iladigan bo'limlar *(qilingan)*. Yana: material bo'yicha agregat ko'rinish, postavshik bo'yicha.
- **Filtr chiplari:** раздел, postavshik, obyekt, sana oralig'i, "qoldiq>0 / deficit".
- **Qidiruv:** material nomi, раздел *(server-side bor)*.
- **Agregat ko'rinish:** har material — Σkirim, Σchiqim, qoldiq, o'rtacha narx (transaksiya emas, jamlanган).
- **Tezlik:** REYESTR bitta batch; frontend uchun Supabase indeks + pagination.

---

## 5. ⭐ SKLAD LEDGER — KIRИМ + CHIQИМ + QOLDIQ (eng muhim qo'shimcha)

Hozir faqat **kirим**. Ideal tizim **chiqимni** ham yuritadi:
- **Rashod varag'i** (YANGI): material, hajm, sana, obyekt, ish/oluvchi, izoh.
- **Qoldiq** = Σ(kirим shu material) − Σ(chiqим shu material) — **formula bilan avtomat**, qo'lда emas.
- **Obyekt ustuni** (kirим va chiqимда) → har obyekt bo'yicha material harakati.
- Hujjatlar: **ПКО** (prihod orderi), **material berish kartasi** (chiqим), **qoldiq vedomosti**.

---

## 6. NAZORAT (deficit + anti-fraud)

Anomaliya invariantlari (Supabase `anomaliya` ga → frontend/Telegram bayroq):
- 🔴 **Manfiy qoldiq** (chiqим > kirим) — bo'lmasligi kerak (ombor minusga ketmaydi).
- 🟠 **Ortiqcha kirим** — kelgan > kerak (smeta) × 1.25 (agar bog'langan bo'lsa).
- 🟠 **Narx sakrashi** — prihod narxi > smeta/o'rtacha × 1.4 (qimmatga olingan).
- 🟡 **Takror yozuv** — bir material + sana + postavshik + hajm bir necha marta.
- 🟡 **Birlik/narx yo'q** — material kiritilgan, lekin birlik yoki narx bo'sh.

> Viborka allaqachon o'xshash anti-fraud qiladi (Перерасход >25%, narx >40%) — lekin **mustaqil**
> (План vs Қабул). Prixod o'z transaksion ledger anti-fraud'ini qiladi. Ulamaymiz.

---

## 7. SUPABASE DATA MODELI (frontend uchun)

- **`prixod`** (bor — Smeta `supabasePrixodPush` push qiladi): id, nom, razdel, birlik, hajm, narx,
  summa, ostatka, sana, postavshik + **obyekt** (qo'shilsin).
- **`rashod`** (YANGI): id, material_key, nom, birlik, hajm, sana, obyekt, ish, izoh.
- **`sklad_ostatka`** (YANGI yoki VIEW): material_key, nom, birlik, kirim, chiqim, qoldiq, ort_narx.
- RLS + realtime. Frontend: sklad ko'rinishi, qoldiq, postavshik analitikasi, deficit.

---

## 8. ✅ CLAUDE QO'YGAN POYDEVOR (qayta qilma)

**`Smeta tizimi/45_Hujjatlar.js`:** `apiPrixodOl(limit,q)` (limit=0 → barchasi, qidiruv),
`apiPrixodYoz(data)` (nom, razdel, birlik, hajm, sana, postavshik, narx).
**`Smeta tizimi/70_Supabase.js`:** `supabasePrixodPush()` → `prixod` jadval (soatlik sinx).
**`Smeta tizimi/Panel.html`** (Ҳужжатлар→Приход): hamma yozuv (0), **раздел bo'yicha yig'iladigan guruh**,
"➕ Янги приход" tugmasi **har doim** ko'rinadi, jami sanoq.

---

## 9. ANTIGRAVITY DAVOM ETTIRADI (bosqichlar)

**P2 — Sklad ledger (5-bo'lim):** Prixod hujjatiga **ОБЪЕКТ** ustuni + alohida **РАСХОД** varag'i.
Qoldiq = Σkirим − Σchiqим (formula). `apiRashodOl/Yoz`, panel "➖ Чиқим" tugmasi.

**P3 — Agregat/material ko'rinishi (4-bo'lim):** har material bo'yicha jami (kirим/chiqим/qoldiq/
o'rtacha narx) — transaksiya emas. Material bo'yicha guruh + postavshik bo'yicha.

**P4 — Nazorat (6-bo'lim):** anti-fraud + deficit invariantlari → Supabase `anomaliya`.

**P5 — Smeta-bog'lash (3-bo'lim):** prihod material ↔ smeta material_kerak — qo'lда + AI taklif
(Claude allaqachon ulangan). Bog'lanса — deficit (kerak−kelgan) aniq hisoblanadi.

**P6 — Supabase sklad (7-bo'lim) + Frontend:** `rashod`/`sklad_ostatka` jadval/view, frontend
sklad ko'rinishi (qoldiq, postavshik analitikasi, deficit), Telegram bayroq.

---

## 10. TAMOYILLAR (buzilmasin)
- Prixod = **transaksion sklad ledger** (har kirим/chiqим yozuvi). Qoldiq = **formula** (qo'lда emas).
- Material nomlari Smeta/Viborka bilan **mos kelmaydi** → majburiy ulash YO'Q; faqat qo'lда + taklif.
- Viborka (План vs Қабул) — **mustaqil**, Prixod bilan ulanmaydi.
- Manfiy qoldiq mumkin emas (ombor minusga ketmaydi) — nazorat bayroq beradi.
- Prixod Sheet = yagona manba; Supabase = mirror; frontend = o'qiydi.

_Oxirgi yangilanish: 2026-06-19. Poydevor: Claude. Davomi: Antigravity (9-bo'lim)._
