# 🤝 ANTIGRAVITY UCHUN — TO'LIQ HANDOFF (Claude → Antigravity)

> Bu fayl — Claude (Opus) bilan o'tkazilgan ish seansining **to'liq konteksti**.
> Antigravity, iltimos shuni **boshidan oxirigacha o'qib chiq** — keyin loyiha holatini,
> qilingan ishlarni, qabul qilingan qarorlarni va HOZIRGI MUAMMONI to'liq bilasan.
> Sana: 2026-06-19. Bog'liq fayllar: `ARXITEKTURA.md`, `SUPABASE_SYNC.md`,
> `Smeta tizimi/CLAUDE.md` (loyihaning to'liq texnik xotirasi).

---

## ⛔ BUZILMAS QOIDALAR (HARD RULES) — AVVAL SHUNI O'QI

> 2026-06-25: bir incident bo'ldi — eski git bazasidan ishlanib, `clasp push` bilan jonli
> deployed kod (24+ funksiya: multi-lokalka, Akt integratsiya, Supabase soatlik sinx,
> dashboard reconcile, system-pause) BOSIB KETILDI. Quyidagilar shuni QAYTARMASLIK uchun.

**1. JONLI MANBA = clasp deployed kod, GIT HEAD EMAS.** Git tarixi orqada (ko'p ish git'ga
   commit qilinmagan, to'g'ridan clasp'ga push qilingan). **Har ish boshida `clasp pull` qil** →
   jonli kodni ol → ustiga qur. Git HEAD'dan boshlama (eskirgan).

**2. `clasp push` REMOTE'NI TO'LIQ ALMASHTIRADI.** Mahalliy fayllar to'plami = remote bo'ladi.
   Eskirgan/kam mahalliy holatni push qilsang → jonli funksiyalar O'CHADI. **Push'dan oldin
   ALBATTA `clasp pull` qilib merge qil.**

**3. `git stash` QILMA** (yoki qilsang — push'dan oldin QAYTA POP qil). Stash qilib, toza eski
   bazadan ishlab, push qilsang — stashdagi ish deploy'dan yo'qoladi (aynan shu bo'lgan edi).

**4. FUNKSIYA YO'QOTMA.** Push'dan oldin `selftestFunksiyalar()` (98_SelfTest.js) ni RUN qil —
   agar biror registr funksiyasi "ТОПИЛМАДИ" desa → **TO'XTA, push QILMA**, yo'qolganini qaytar.
   `selftestBarcha()` — to'liq tekshiruv.

**5. MAVJUD FAYLNI QAYTA YOZMA (rewrite).** Faqat KERAKLI qismni Edit qil. Butun faylni
   almashtirsang, bilmagan funksiyalaringni o'chirib qo'yasan. Ayniqsa `10_Engine.js`,
   `05_Papka.js`, `70_Supabase.js`, `30_Panel.js`, `45_Hujjatlar.js` — ko'p funksiyali, ehtiyot.

**6. NARXLASH/MOTOR FUNKSIYALARI MUQADDAS** (`_findPrice`, `_priceDB`, `_normNomKey`, `_cfgKalit/
   _cfgMos/_cfgNorm/_svodColsFolder/_subObyektlar`, `_ishlaObyekt`). Bularga TEGMA — multi-lokalka
   narxlash (split obyektlar: Sun'iy ko'l/Amfiteatr) shularга bog'liq. O'chirsang narxlash buziladi.

**7. HUDUD (qaysi fayl kimники):** Antigravity → `frontend/` (Next.js), `Panel.html`/`Boss.html` UI.
   Backend motor (`00,05,10,20,25,50,70,71_Supabase`, narxlash) — EHTIYOT, faqat kelishilgan o'zgarish.

**8. ISH TUGAGACH:** (a) `selftestFunksiyalar()` toza, (b) `clasp pull` bilan merge tekshir,
   (c) keyin push, (d) `selftestBarcha()` jonli tekshir.

**9. MATERIALLARNI KATEGORIYAGA AJRATISH (MASH/CHEL/MAT/OB):** (2026-06-30 qat'iy qoida)
   - Hech qachon material nomidan so'z qidirib (masalan "Kabel", "Mashinist") taxmin qilmang (`_refine` funksiyasi butunlay o'chirib tashlandi va QAYTARILMASIN).
   - Agar lokalkadagi birlik `чел-час` bo'lsa -> Qat'iy **CHEL** ustuniga.
   - Agar lokalkadagi birlik `маш-час` bo'lsa -> Qat'iy **MASH** ustuniga.
   - Boshqa BARCHA birliklar (шт, м3, т...) FAQATGINA Svodkadagi oraliq (range) joylashuviga qarab MAT yoki OB ga bo'linadi. 
   - Agar biror material Svodkada MASH deb xato kiritilgan bo'lsa ham yoki Narxlar bazasida (nkMap) MASH deb tasdiqlangan bo'lsa ham, uning haqiqiy birligi `маш-час` bo'lmasa u QAT'IYAN MASH ustuniga kiritilmaydi.

---

## 0. UMUMIY MANZARA

Ekotizim — Navoiy "Yangi O'zbekiston bog'i" (32 ga) qurilishini boshqarish.
**3 ta mustaqil GAS loyiha** + **Supabase** (markaziy "miya") + **Next.js frontend**:

```
C:\Users\PC\Documents\GAS\
  ├── Smeta tizimi/   (moliya/smeta — asosiy; git + clasp; frontend shu ichida)
  ├── Akt generator/  (yashirin ishlar aktlari — clasp)
  └── Viborka/        (material ta'minot nazorati — clasp)
```

**Mas'uliyat taqsimoti (KELISHILGAN):**
- **Antigravity** — frontend (Next.js: 3D/motion dizayn, dashboard) + `05_Papka.js` multi-lokalka bo'lish mantig'i.
- **Claude** — backend Supabase integratsiya qatlami (`70_Supabase.js`), buxgalteriya (`85_Buxgalteriya.js`), mantiqiy bog'lanishlar auditi.

⚠️ **Konfliktdan saqlanish:** `05_Papka.js` va `30_Panel.js` va `Panel.html`/`Boss.html` —
Antigravity hududi. `70_Supabase.js`, `85_Buxgalteriya.js`, `supabase_schema.sql` — Claude hududi.
`10_Engine.js` (narxlash dvigateli) — EHTIYOT bilan, ikkalamiz ham tegmaslikka harakat qilamiz.

---

## 1. CLAUDE BU SEANSDA NIMA QILDI (backend Supabase + buxgalteriya)

### A. Supabase soatlik to'liq sinx (`70_Supabase.js` + `supabase_schema.sql`)
Avval faqat 5 jadval push qilinardi (obyektlar, holat, oylik_f2, narxlar, tarix).
Endi **13 jadval, 3 qatlam sinx** (event → soatlik → kunlik):
- **Yangi jadvallar:** `material_kerak`, `shartnoma`, `topilmaganlar`, `akt`, `prixod`,
  `viborka_nazorat`, `tolovlar`, `anomaliya`.
- **Dirty-tracking:** `_holatInvalidate` ichida `_sbDirty(obyekt)` → soatlik sinx faqat
  o'zgargan obyektlarni push qiladi (`SB_DIRTY` Script Property).
- **Triggerlar:** `supabaseTriggerOrnat()` → soatlik (`supabaseSoatlikSinx`) + kunlik 03:00
  (`supabaseToliqSinx`). Hech narsa yo'qolmaydi (event o'tib ketsa soat/tun tutadi).

### B. Anomaliya skaneri (nazorat invariantlari) — `supabaseAnomaliyaPush`
Har obyekt uchun avtomat tekshiradi → `anomaliya` jadvaliga (hal bo'lsa yo'qoladi):
- Obyekt: `F2>SMETA`, `FAKT>SMETA`, `F2>FAKT`, `OSTATKA<0`
- Qator: nechta qatorda hajm oshib ketgan; narx topilmaganlar soni

### C. Buxgalteriya (`85_Buxgalteriya.js` — YANGI FAYL)
- **ТЎЛОВЛАР** varaq (avtomat yaratiladi): `САНА│ШАРТНОМА_NO│ОБЪЕКТ│СУММА│ТУР│ИЗОҲ`
  (ТУР: Аванс/Тўлов/Қайтарим). `apiTolovOl/Yoz/Ochir`.
- `apiBuxDashboard` — har shartnoma: dog_summa, bajarilgan (Ф2/КС-2), to'langan,
  **ДЕБИТОР** (bizga qarz), **АВАНС**, %.
- Moliyaviy nazorat: `KS2>DOGOVOR` (overbilling, kritik), `TOLOV>DOGOVOR` (kritik),
  `TOLOV>BAJARILGAN` (avans, ogohlantirish).
- `shartnoma` jadvali boyitildi: НДС, dog_summa, qoldiq, bajarilgan%, tolangan, debitor.

### D. Akt + Viborka mustaqil push (har biri o'z loyihasidan)
- `Akt generator/Supabase.js` → `akt` jadvali (REYESTR) + soatlik trigger
  (`aktSupabaseSozlash`, `aktSupabasePush`, `aktTriggerOrnat`).
- `Viborka/Supabase.js` → `viborka_nazorat` (TO'LIQ: plan/qabul/qoldiq/holat) + soatlik
  (`vibSupabaseSozlash`, `vibSupabasePush`, `vibTriggerOrnat`).

### E. Backend mantiqiy bog'lanishlar auditi (tuzatilgan xatolar)
- `holat.kategoriya` yozilmasdi → rs `kat` endi yoziladi.
- rs node'da `narx` yo'q edi (har doim 0) → birlik narxi = ST_RES summa ÷ hajm.
- `material_kerak` ish haqini (ЧЕЛ/МАШ) material deb qo'shardi → endi faqat material.
- **obyekt↔shartnoma bog'lanishi yo'q edi** → `obyektlar.shartnoma_no` qo'shildi
  (obyektlar ↔ shartnoma ↔ tolovlar endi `shartnoma_no` orqali bog'langan).
- anomaliya o'chirishda `>` URL kodlanmagan → `encodeURIComponent`.

---

## 2. MUHIM ME'MORIY QARORLAR (BUZILMASIN)

1. **CONSTANTA narxlash (yuridik):** narx FAQAT o'sha obyekt svodkasidan, AYNAN
   nom (`_normNomKey`) + birlik (`_normBirlik`) mosligi bilan. FUZZY/cross-object YO'Q.
   (Batafsil: `Smeta tizimi/CLAUDE.md` fix #46.)

2. **Smeta ↔ Viborka materiallari ATAYLAB ULANMAYDI.** Material nomlari har tizimda
   har xil yoziladi (`_normNomKey` vs `AI_NormalizeName` — butunlay boshqacha natija).
   Majburiy moslash xato beradi → har tizim **mustaqil** ishlaydi. Viborka deficitni
   **o'zida** hisoblaydi (План−Қабул). "Yagona material katalog" g'oyasini taklif qilma.

3. **Format yuridik:** LRV sahifalari `copyTo` bilan format saqlanadi, BO'LINMAYDI.
   Bitta hujjat — bitta natija.

4. **Maxfiy kalitlar** (service_role, ANTHROPIC_API_KEY) — faqat serverda
   (Script Property / Edge Function), HECH QACHON frontendda yoki jadvalda emas.

---

## 3. ✅ HAL QILINDI (Claude, 2026-06-19) — MULTI-LOKALKA NARXLASH/ORALIQ

> **DIQQAT ANTIGRAVITY:** Bu muammoni Claude allaqachon TUZATDI. Quyidagi tahlil — kontekst uchun.
> Sen bu narxlash/oraliq mantig'iga QAYTA TEGMA. `_cfgKalit`/`_cfgNorm`/`_cfgMos`/`_svodColsFolder`
> (05_Papka.js) — yangi izchil tizim. Tarqoq `split(' - ')` prefiks hiylalari OLIB TASHLANDI.
>
> **Qilingan tuzatish:** narxlash sozlamasi (oraliq, svod ustun xaritasi, ЧЕЛ-Ч stavka) endi
> **SVODKAga (papkaga) tegishli** — obyekt nomiga emas. Kalit = papka nomi, normallashtirilgan
> moslik (katta/kichik harf, probel, apostrof ʻʼ'`´, ё/е farqi e'tiborsiz). svodCols papka bo'yicha
> meros olinadi (yangi lokalka avtomat oladi). Tegilgan fayllar: `05_Papka.js`, `10_Engine.js`,
> `30_Panel.js` (faqat `_oraliqlarOl/_stavkaOl/_stavkaYoz/apiOraliqlarSaqla/apiSvodUstunSaqla`).
> Foydalanuvchi: keshni yangilab, har papka uchun oraliq/svod ustunni BIR MARTA qayta saqlasa
> (yoki avvalgisi papka nomiga mos bo'lsa — o'zi ishlaydi), barcha lokalka birdaniga to'g'ri narxlanadi.

### (Kontekst — muammo nima edi)

### Nima bo'ldi
Antigravity `05_Papka.js` `_skanObyekt` ni o'zgartirdi: bitta papkada ko'p lokalka
bo'lsa, har biri alohida obyekt → nom `"Papka - lokalka"` (masalan `"Suniy ko'l - ozera"`).
Bu juda kerakli funksiya — LEKIN narxlash/oraliq buzildi.

### Nega buzildi (ildiz sabab)
Narxlash sozlamasi (oraliqlar, svod ustunlari, stavka) **obyekt NOMI bo'yicha** saqlanadi:
`_oraliqlarOl(ob.obyekt)`, `_svodCfg(ob)`, `_stavkaOl(ob.obyekt)` (hammasi `10_Engine.js`/
`05_Papka.js` da). Obyekt nomi o'zgargani uchun eski nom ostidagi sozlamalar yetim qoldi
→ `hasRanges=false` → ЧЕЛ/МАШ/МАТ/ОБ noto'g'ri ajraladi → "mantiqdan chiqib ketdi".

### Antigravity allaqachon nima urindi (qisman yamoq)
- `_oraliqlarOl`: `base = obyekt.split(' - ')[0]` → split nom uchun asosiy papka nomidan qidiradi.
- `_stavkaOl`: xuddi shunday prefix.
- `svodCols/format/svodSheets`: `override[subNom] || override[nom]` fallback.

### Nega bu yamoq YETARLI EMAS (Claude tahlili)
1. **Identifikator fayl nomidan yasalgan** → beqaror (fayl qayta nomlansa yoki nomida
   `" - "` bo'lsa, `split(' - ')[0]` noto'g'ri prefiks beradi → sozlama yo'qoladi).
2. **Har xil sozlama har xil mexanizm** (oraliq=split-prefix, svodCols=override-fallback)
   → nomuvofiq; bittasi mos kelmasa jim buziladi.
3. **Qatlam xato:** oraliq/svodCols/stavka aslida lokalkaga emas, **СВОДКАga** tegishli
   (bir svodka — bir sozlama). Obyekt nomiga bog'lab, keyin prefiks bilan qaytarib olish — mo'rt.
4. **Eng ehtimoliy aniq sabab:** saqlangan oraliq kaliti (eski nom) hozirgi papka nomi
   bilan aynan teng emas (kirill/lotin/apostrof farqi) → `base` mos kelmaydi → `ranges=0`.

### ✅ TO'G'RI YECHIM (Antigravity buni qilishi kerak)
**Narxlash sozlamasini obyekt nomiga emas, SVODKA / FOLDER barqaror kaliti ostiga
ko'chir.** Bir svodka — bir sozlama, `svodId` yoki `folderId` bo'yicha saqlanadi va o'qiladi.
Har bir lokalka-obyekt o'z papkasi/svodkasi orqali shu sozlamani to'g'ridan-to'g'ri oladi.
Shunda HECH QANDAY `split(' - ')` prefiks hiylasi kerak emas va fayl qayta nomlansa ham buzilmaydi.

**Aniqlash (debug):** `_oraliqlarOl` ichiga `Logger.log('OB='+obyekt+' base='+base+' ranges='+r.length)`
qo'sh, bitta split obyektni [Ишла] qil:
- `ranges=0` → kalit mos kelmayapti (saqlangan nom ≠ papka nomi).
- `ranges>0` lekin kategoriya hali xato → `svodCols` yoki o'qilayotgan svod varaqlari mos emas.

---

## 4. HOZIRGI HOLAT — ISHGA TUSHIRISH (bir marta)

Supabase to'liq ishlashi uchun (foydalanuvchi noutbukida kalitlar allaqachon ulangan):
| Loyiha | Apps Script → Run |
|--------|-------------------|
| Smeta | `supabase_schema.sql` SQL Editor'da RUN → `supabaseSozlash(url,key)` → `supabaseToliqSinx()` → `supabaseTriggerOrnat()` |
| Akt | `aktSupabaseSozlash(url,key)` → `aktSupabasePush()` → `aktTriggerOrnat()` |
| Viborka | `vibSupabaseSozlash(url,key)` → `vibSupabasePush()` → `vibTriggerOrnat()` |

> Uchchalasiga **bir xil** Supabase URL + service_role key (umumiy hub).
> `supabase_schema.sql` da yangi ustunlar (`obyektlar.shartnoma_no`, `shartnoma.tolangan/debitor`)
> va yangi jadvallar bor → schema'ni QAYTA RUN qilish kerak.

---

## 5. KEYINGI ISHLAR (rejada)
- ✅ multi-lokalka narxlash/oraliq — HAL QILINDI (Claude, 3-bo'lim). Qayta tegma.
- Frontend: 3D/motion dizayn (Antigravity davom etmoqda), Vercel deploy.
- Frontend'da yangi jadvallarni ko'rsatish: anomaliya (nazorat), buxgalteriya (debitor/kreditor),
  viborka_nazorat (material deficit), akt ro'yxati.
- To'lovlar uchun panel/frontend kiritish formasi (hozir ТЎЛОВЛАР varag'iga qo'lda yoziladi).

---

## 6. ANTIGRAVITY UCHUN QISQA XULOSA
- Claude backend Supabase qatlamini (13 jadval, soatlik sinx, buxgalteriya, anomaliya nazorati)
  qurdi va push qildi — bu sezilmasdan ishlaydi, sening frontend ishingga xalaqit bermaydi.
- **Multi-lokalka narxlash muammosi HAL QILINDI** (Claude) — `05_Papka.js` `_cfgKalit/_cfgNorm/
  _cfgMos/_svodColsFolder` yangi izchil tizim. Narxlash/oraliq mantig'iga QAYTA TEGMA.
- `70_Supabase.js`, `85_Buxgalteriya.js`, `supabase_schema.sql`, narxlash sozlama kaliti — Claude hududi.
- **Sening fokusing:** frontend (3D/motion, Vercel deploy) + yangi Supabase jadvallarini ko'rsatish.
- Savol bo'lsa — `SUPABASE_SYNC.md` (data kontrakt) va `Smeta tizimi/CLAUDE.md` (to'liq tarix) da bor.
