# 📋 AKT TIZIMI — IDEAL ARXITEKTURA (Antigravity davom ettiradi)

> Yashirin ishlar aktlari (Акт освидетельствования скрытых работ) tizimini katta
> ekotizimga **ideal va kuchli** ulash. Bu hujjat — to'liq dizayn. Claude poydevorni
> qo'ydi (8-bo'lim), Antigravity 9-bo'limdagi bosqichlar bo'yicha davom ettiradi.
> Bog'liq: `ANTIGRAVITY_UCHUN.md`, `ARXITEKTURA.md`, `Smeta tizimi/CLAUDE.md`.

---

## 1. MUAMMO (hozir) va MAQSAD (ideal)

**Hozir:**
- Aktlar Akt generator hujjatining **REYESTR** varag'ida (500+). Smeta paneli ularni o'qiydi.
- ❌ Panel faqat 100 ta so'rardi → hammasi chiqmasdi *(tuzatildi: 0=barchasi)*.
- ❌ Flat 500 qatorli ro'yxat → chalkash *(tuzatildi: obyekt bo'yicha yig'iladigan guruh)*.
- ❌ Akt ↔ smeta ish turi bog'lanishi **mo'rt** (`obyekt||varaq||qator` — re-process'da qator suriladi → buziladi).
- ❌ Eski 500 aktni smeta ishlariga ulash mexanizmi yo'q.

**Maqsad (ideal):**
1. **Hamma akt** oson, guruhlangan, filtrlangan, tez ko'rinadi.
2. Har akt **smetadagi bir nechta ish turiga** bog'lanadi — **barqaror kalit** bilan (re-process buzmaydi).
3. Eski 500 aktni ham smetaga ulash — **AI/fuzzy taklif + inson tasdig'i** bilan oson.
4. **Nazorat:** qaysi bajarilgan (yashirin) ish akt bilan qoplangan/qoplanmagan.
5. Frontend/Supabase'da to'liq, realtime, qidiriladigan registr.

---

## 2. DOMEN MODELI

**AKT** — bitta hujjat, **bir yoki bir nechta** ish turini qoplaydi (1→N).
Hayot sikli: `DRAFT → CREATED (doc) → ОТПРАВЛЕНО → ПОДПИСАНО (bosqichma-bosqich) → АРХИВ`.
Komissiya: ГЕН / СУБ / ТЕХ / ПРОЕКТ (FIO+POS+ORG). Materiallar, hajm, sanalar, loyiha hujjati.
**QOG'OZ akt** — tizimdan oldingi, faqat skan (generatsiyasiz, registr uchun).

**Munosabatlar:**
```
OBYEKT ──1:N── AKT ──N:M── ISH TURI (smeta bl/mat)
                 │
                 └── KOMISSIYA, MATERIAL, SANA, SCAN
```

---

## 3. ⭐ ENG MUHIM: BARQAROR ISH-KALITI (work-key)

Akt↔ish bog'lanishining **kaliti** — bu butun tizimning yuragi.

❌ **Yomon (hozirgi):** `obyekt || varaq || qator` — smeta qayta ishlanganda (yoki yangi versiya)
qator raqami suriladi → bog'lanish yo'qoladi.

✅ **Ideal:** `obyekt || КОД || nom_key`
- **КОД** — расценка kodi (foydalanuvchi tasdiqlagan: kodlar o'zgarmas) → eng barqaror langar.
- **nom_key** — `_normNomKey(nom)` (faqat son+harf) — kod bo'lmasa zaxira.
- Kod bo'lsa: `obyekt||КОД`; kod yo'q bo'lsa: `obyekt||nom_key`.
- Bir kod obyektда takror bo'lsa — akt odatda **ish TURINI** qoplaydi (barcha nusxa), shuning uchun
  kod+nom darajasi yetarli. Agar aniqroq kerak bo'lsa — hajm bilan (lekin razdel/qavat ISHLATILMAYDI:
  ular qo'lда to'ldiriladi, beqaror — qarang `[[narxlash-sozlama-svodka-kaliti]]` mantig'i).

**SMETA_REF** ustuni = shu work-key'lar ro'yxati, `;` bilan. Bitta akt N ta ishni o'z ichiga oladi.

**Coverage tekshiruvi:** har bajarilgan ish uchun work-key hisoblanadi → biror aktning
SMETA_REF to'plamida bormi (`_aktRefSet`).

> ⚠️ MIGRATSIYA: hozir `apiAktSmetadan` `obyekt||varaq||qator` beradi (vaqtinchalik poydevor).
> Antigravity buni **`obyekt||КОД||nom_key`** ga ko'chirishi kerak (apiHolatOl node'iga `kod`
> qo'shib — LRV B ustuni). Shunda re-process/versiya bog'lanishni buzmaydi.

---

## 4. REGISTR ARXITEKTURASI (chalkashmaslik)

- **Guruh:** obyekt bo'yicha yig'iladigan bo'limlar *(qilingan)*.
- **Filtr chiplari (qo'shilsin):** status (подписано / в процессе / қоғоз), bog'langan/bog'lanmagan, sana oralig'i.
- **Qidiruv:** akt №, ish nomi, obyekt *(server-side bor)*.
- **Tezlik:** REYESTR bitta batch o'qishda; frontend uchun Supabase indeks bilan filter/pagination.
- **Har akt qatorida:** № · ish · status · sana · [PDF/↗] · **bog'langan ishlar soni** (badge).

---

## 5. ⭐ BOG'LASH UX — eski 500 akt uchun (kuchli qism)

Nomlar smeta bilan **mos kelmaydi** (akt WORK_NAME erkin matn, расценка nomi boshqacha).
Shuning uchun **avtomatik moslik ishonchsiz** — lekin to'liq qo'lда ham 500 akt uchun og'ir.
**Yechim — yarim-avtomat (inson hal qiladi):**

1. **Yangi akt (smetadan):** ishlarni checkbox bilan tanlaysan → bog'lanadi *(qilingan)*.
2. **Eski aktni ulash:** har akt uchun tizim **nomzod ishlarni taklif qiladi**:
   - Obyekt bo'yicha filtr (akt OBJECT_NAME → smeta obyekti).
   - Nom o'xshashligi (fuzzy/`_normNomKey` qisman moslik) **yoki Claude** (WORK_NAME → eng yaqin расценка lar).
   - Inson 1-2 tugma bilan tasdiqlaydi → SMETA_REF ga yoziladi → **doimiy** (qaytarilmaydi).
3. **Bulk-linking oynasi:** bog'lanmagan aktlar ro'yxati → har biriga taklif → tez tasdiq.

> Bu — material/versiya muammosining aynan yechimi: avto-moslik MAJBURLAMAYDI; ishonchli
> taklif qiladi, inson tasdiqlaydi, natija eslab qolinadi.

---

## 6. NAZORAT (coverage invariant)

- Har obyektда **bajarilgan** ishlar (FAKT>0) ro'yxati → har biriga akt bor/yo'q (`_aktRefSet`).
- **Yashirin ish** (akt talab qiladigan) belgisi: kalit-so'z ro'yxati (землян, фундамент, арматур,
  гидроизол, засыпк...) **yoki** qo'lда flag. Yashirin + FAKT bor + akt yo'q → 🔴 anomaliya.
- Supabase `anomaliya` ga: `YASHIRIN_AKT_YOQ` qoidasi.
- Frontend: obyekt bo'yicha "qoplanish matritsasi" (qaysi ish qoplangan).

---

## 7. SUPABASE DATA MODELI (frontend uchun)

- **`akt`** (bor — Akt generator/Supabase.js push qiladi): act_id, obyekt, work_name, act_number,
  status, sana, komissiya, act_url, pdf, **smeta_ref** (qo'shilsin).
- **`akt_ish`** (YANGI link jadval — N:M so'rovlar uchun): `akt_id, obyekt, work_key`.
  → "qaysi ish qoplangan", "qaysi akt qaysi ishlarni qoplaydi", coverage JOIN (holat ↔ work_key).
  → Akt generator yoki Smeta SMETA_REF ni split qilib push qiladi.
- RLS + realtime (akt, akt_ish).

---

## 8. ✅ CLAUDE QO'YGAN POYDEVOR (qayta qilma)

**`Smeta tizimi/45_Hujjatlar.js`:**
- `_aktSheet(ss)` — REYESTR varag'ini nomi bilan ochadi (TEMPLATE emas) — **"топилмади" xatosi tuzatildi**.
- `apiAktlarOl(limit,q)` — limit=0 → barchasi; status statistikasi, qidiruv.
- `apiAktIshlar(obyekt)` — bajarilgan ishlar + akt bor-yo'qligi (`_aktRefSet`).
- `apiAktSmetadan(ob,varaq,qator)` / `apiAktSmetadanKop(ob, items[])` — smetadan avto-to'ldirish
  (ish nomi, hajm=FAKT, materiallar=rs tarkibi, refs).
- `apiAktYoz(data)` — `refs[]` (ko'p ish), `material`, `pdf` (skan), `status` (NEW/QOGOZ) yozadi.
- `_aktRefSet()` — SMETA_REF `;` split → coverage to'plami.

**`Akt generator/Code.js`:** `REY.SMETA_REF` ustuni (setupAll bir marta → REYESTR'ga qo'shiladi).

**`Smeta tizimi/Panel.html`** (Ҳужжатлар→Актлар): hamma akt (0), **obyekt bo'yicha yig'iladigan guruh**,
status rangi, [🧩 Сметадан] (checkbox ko'p tanlash), [➕ Янги акт] (Тури=NEW/QOGOZ + скан), tugmalar har doim ko'rinadi.

---

## 9. ANTIGRAVITY DAVOM ETTIRADI (bosqichlar)

**P2 — Barqaror work-key (3-bo'lim):** `apiHolatOl` node'iga `kod` (LRV B ustuni) qo'sh →
`apiAktSmetadan`/`apiAktIshlar` work-key'ni `obyekt||КОД||nom_key` ga o'tkaz. Eski `obyekt||varaq||qator`
SMETA_REF larni migratsiya qil (bir martalik skript).

**P3 — Bulk-linking UI (5-bo'lim):** bog'lanmagan aktlar → nomzod taklif (fuzzy/Claude) → tasdiq.
Claude API allaqachon ulangan (`60_Maslahatchi.js`). Akt WORK_NAME + obyekt → eng yaqin 3-5 расценка.

**P4 — Registr filtr/UI:** status va bog'lanish filtr chiplari, sana oralig'i, bog'langan ishlar badge.

**P5 — Supabase `akt_ish` + coverage:** link jadval, push, anomaliya `YASHIRIN_AKT_YOQ`, frontend matritsa.

**P6 — Frontend (Next.js):** aktlar registri (obyekt bo'yicha, filtr, qidiruv), coverage ko'rinishi,
har bajarilgan ish yonida akt holati, PDF yuklab olish.

---

## 10. TAMOYILLAR (buzilmasin)
- Akt↔ish bog'lanish **QO'LDА** (nomlar mos kelmaydi) — avto-moslik faqat **taklif**, majburlamaydi.
- Bog'lanish kaliti **barqaror** (КОД+nom, qator EMAS).
- Bitta akt **N ta ishni** qoplashi mumkin (N:M).
- Qog'oz/eski aktlar ham registrga kiradi (status QOGOZ).
- REYESTR = yagona manba; Supabase = mirror; frontend = o'qiydi.

_Oxirgi yangilanish: 2026-06-19. Poydevor: Claude. Davomi: Antigravity (9-bo'lim)._
