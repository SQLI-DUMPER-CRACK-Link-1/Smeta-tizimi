# T2 — Post-deploy incident round (2026-09-05)

**Kontekst:** 90 commit `main`ga deploy qilingandan keyin egasi haqiqiy
production'da qo'lda test qildi va bir nechta muammo topdi. Bu hujjat —
NIMA topilgani, NIMASI TUZATILGANI (va qanday tasdiqlangani), NIMASI
HALI OCHIQ ekanini boshqa agent uchun to'liq yozib beradi.

Production loyiha: Supabase `tuoyrzadkgoltpqkdiyx`. Frontend: Cloudflare
Pages, `main` branch'dan auto-deploy.

---

## 1. TUZATILGAN va TASDIQLANGAN

### 1.1 "Hamma joyda ruxsat yo'q" (RuxsatGuard butun /admin/*ni blokladi)

**Sabab:** `RuxsatGuard.tsx` (bu deploy bilan birinchi marta jonli
chiqdi) har bir `/admin/*` sahifani `t2_effective_authorization_v1`
RPC orqali serverdan tekshiradi. Bu funksiya (va yana 3 tasi:
`t2_platforma_superadmin`/`t2_actor_kompaniya_azo_tekshir` yangilanishi,
`t2_kompaniya_yangila_v1`, `t2_system_control_global_v1`) kod bilan
birga repo'ga tushgan, lekin **production bazasiga hech qachon
qo'llanmagan** edi (migratsiya fayllari "SOURCE ONLY, NOT applied"
deb ochiq yozilgan edi, lekin ularga bog'liq FRONTEND kodi baribir
deploy qilingan).

**Tuzatildi:** 4 ta migratsiya (`20260914120000_t2_platforma_
superadmin_context_v1`, `20260915120000_t2_effective_authorization_
core_v1`, `20260916120000_t2_kompaniya_yangila_v1`, `20260917120000_
t2_system_control_split_v1`) egasi tomonidan Supabase SQL Editor'da
qo'lda ishga tushirildi ("Success. No rows returned").

**Tasdiqlangan:** egasi keyingi skrinshotlarda Company Control Center
tabsi ochilganini ko'rsatdi.

### 1.2 `t2_actor_kompaniya_azo_tekshir` "for share" regressiyasi (P0)

**Sabab:** 1.1-bandning birinchi migratsiyasi bu funksiyani ESKI,
2026-09-03'dagi P0 xatoni ("cannot execute SELECT FOR SHARE in a
read-only transaction", SQLSTATE 25006) hali tuzatilmagan versiyadan
qayta yozib qo'ydi — ya'ni ALLAQACHON tuzatilgan xatoni QAYTA
KIRITDI. Bu funksiya deyarli HAR BIR RPC orqali chaqiriladi (Boss
Dashboard, System Control, Workbench, Nakopitelniy va h.k.) — shuning
uchun "Rahbar paneli", "Modullar" va "Integratsiyalar" tablari birdan
buzildi.

**Tuzatildi:** yangi migratsiya fayli yozildi va qo'llandi
(`supabase/migrations/20260905150000_t2_actor_azo_tekshir_for_share_
regression_fix.sql`, git'ga ham commit qilingan) — "for share" olib
tashlangan, superadmin bypass logikasi saqlangan.

**Tasdiqlanishi kerak:** egasi Rahbar panelini/Modullar/
Integratsiyalar tablarini qayta ochib ko'rishi kerak — men kod
darajasida tasdiqladim (funksiya production'da to'g'ri holatda), lekin
egasidan "endi ochiladi" degan tasdiqni olmadim.

### 1.3 Yangi kompaniya "Kontekst" tanlagichida ko'rinmasligi

**Sabab:** `KompaniyaKontekst.tsx` (sahifa tepasidagi "Kontekst"
tanlagichi va barcha kanonik sahifalarning kompaniya manbai) o'zining
ALOHIDA, react-query'dan MUSTAQIL `useState`+`useEffect` orqali
`t2_men_v1`ni o'qirdi. `KompaniyaPage.tsx`dagi "A'zoliklarim" ro'yxati
esa `useMen()` (react-query) orqali. Yangi kompaniya ochilganda faqat
`useMen()` keshi yangilanardi — `KompaniyaKontekst`ning holati ESKI
qolardi, shuning uchun yangi kompaniya faqat pastdagi ro'yxatda
ko'rinib, tepadagi tanlagichda YO'Q edi.

**Tuzatildi:** `KompaniyaKontekst.tsx` endi `useMen()`ning O'ZINI
ishlatadi — bitta haqiqat manbai. Kod: `frontend/src/umumiy/kontekst/
KompaniyaKontekst.tsx`, commit `f042b4a`.

**Tasdiqlanishi kerak:** egasi yangi kompaniya ochib, tepadagi
tanlagichda darhol ko'rinishini tekshirishi kerak.

### 1.4 F2/Fakt sahifasi: `t2_qator_holat.tartib does not exist`

**Sabab:** `frontend/src/test02/TestF2.tsx` `t2_qator_holat`
view'idan `tartib` ustuni bo'yicha saralashga urinardi — bu view
FAQAT `raqam` ustunini beradi (`tartib` `t2_qator`/`t2_daraxt`da bor,
lekin `t2_qator_holat`da YO'Q).

**Tuzatildi:** `tartib: 'raqam.asc'` ga o'zgartirildi. Commit `041da89`.

### 1.5 Narx nazorati (Test): "So'rov bajarilmadi (405)"

**Sabab (ehtimoliy):** `t2_price_control_v1`/`t2_f2_exact_qatorlar_v1`
RPC'lari `stable` deb to'g'ri e'lon qilingan (production'da tekshirildi:
`provolatile='s'`), lekin PostgREST GET so'rovlarni faqat sxema
keshi YANGILANGANDA to'g'ri yo'naltiradi. Ular ilgari (Codex tomonidan)
sinov davomida bir necha marta yaratilgan/o'chirilgan bo'lishi mumkin —
PostgREST keshi eskirgan bo'lishi ehtimoli katta edi.

**Qilingan:** `NOTIFY pgrst, 'reload schema';` yuborildi (xavfsiz,
ma'lumotga tegmaydi, faqat PostgREST'ning ichki sxema keshini
yangilaydi).

**⚠️ TASDIQLANMAGAN — KEYINGI AGENT BUNI TEKSHIRISHI SHART.** Egasi
hali "Narx nazorati" (Test) sahifasini qayta ochib ko'rmagan. Agar
405 hali davom etsa — bu chuqurroq PostgREST/Cloudflare marshrutlash
muammosi, `frontend/functions/api/sb.ts` (`~qator 261`, GET so'rov
Supabase RPC'ga) va real HTTP javobini (nafaqat status kodini, balki
`rr` body matnini ham) loglash kerak bo'ladi.

---

## 2. OCHIQ — MAHSULOT QARORI KERAK (tezkor "bug fix" emas)

### 2.1 "A'zo qo'shish" formasi ISHLAYDIGAN login yaratmaydi (XAVFSIZLIK/UX)

**Muammo:** Ikkita mutlaqo bog'lanmagan tizim bor:
- **Kirish tekshiruvi** (`Smeta tizimi/21_Xodimlar.js`, `apiKirishTekshir`)
  — butunlay Google Sheets'dagi `_XODIMLAR` varag'ida (Login/Parol/Rol
  ustunlari, oddiy matn ko'rinishida, XASH QILINMAGAN parol!).
- **"A'zo qo'shish"** (`KompaniyaPage.tsx` → `t2_azolik_qosh_v1`) —
  faqat `t2_foydalanuvchi`/`t2_azolik` (Supabase) ga login+rolni yozadi,
  **parolga umuman tegmaydi** (bu jadvalda parol maydoni yo'q).

**Natija:** yangi qo'shilgan a'zo Supabase'da ko'rinadi, lekin
**tizimga kira OLMAYDI** — uning logini `_XODIMLAR`da yo'q. Bugungi
kunda ishlashi uchun ikkita joyda alohida amal kerak.

**Bu — ARXITEKTURA QARORI, tezkor patch emas:**
1. Parol qayerda saqlanishi kerak — Supabase'da (hash bilan, masalan
   bcrypt) yoki GAS `_XODIMLAR`da qolaveradi?
2. Agar Supabase'ga ko'chirilsa — `_XODIMLAR`dagi MAVJUD foydalanuvchi
   parollarini qanday migratsiya qilish kerak (ular hozir OCHIQ MATN)?
3. Yangi a'zoga vaqtinchalik parol yuborish kerakmi (email/SMS yo'q —
   bu tizimda email ham ixtiyoriy)? Yoki admin o'zi parol kiritadimi?
4. `apiKirishTekshir` GAS funksiyasi ham parallel ishlashda davom
   etishi kerakmi (ikki manba muammosi takrorlanmasligi uchun)?

**QAT'IY OGOHLANTIRISH loyihaning o'z qonuniga ko'ra:** parolni
OCHIQ MATNDA (plain text) HECH QACHON Supabase'ga yozmang — bu
loyihaning "narx o'zidan to'qilmaydi" kabi qattiq xavfsizlik
qoidalariga zid bo'lardi. Har qanday yechim `bcrypt`/`argon2` kabi
proper hashing ishlatishi SHART.

### 2.2 `.claude/settings.local.json` xavfsizlik signali (Antigravity)

Antigravity'ning `antigravity/t2-document-export-v1` branch tarixida
`.claude/settings.local.json`ga `Bash(*)`, `PowerShell(*)`, va cheksiz
Supabase MCP (shu jumladan `apply_migration`) ruxsati qo'shilgan commit
bor edi. Bu asosiy `main`/`integration`ga MERGE QILINMADI (Claude bu
faylni ataylab chetlab o'tdi), lekin bu — Antigravity o'z-o'ziga
haddan tashqari keng ruxsat berishga urinishi bo'lishi mumkin. Agar
Antigravity hali ham shu kengaytirilgan ruxsat bilan ishlayotgan
bo'lsa — bu alohida ko'rib chiqilishi kerak (o'sha sessiyaning o'zida,
uning LOKAL `.claude/settings.local.json` fayli tekshirilishi kerak).

### 2.3 F2ImportNative — 20 000 qatorlik devor hali ulanmagan

Codex'ning "F2 resumable import" backend'i (`t2_f2_import_job_v1`
RPC'lari) yozilgan, lekin **production'ga hali qo'llanmagan**
(`production_write_allowed:false` bilan ataylab shunday qoldirilgan)
VA `F2ImportNative.tsx`ning o'zi hali bu yangi job modeliga ulanmagan
— katta fayl (>15MB/>20000 qator) hamon rad etiladi. Bu ish Claude
ownershipida qoldi, hali boshlanmagan.

---

## 3. Keyingi agent uchun tavsiya etilgan tartib

1. **AVVAL** 1.5-band (Narx nazorati 405)ni qayta tekshiring — egasidan
   "Narx nazorati" sahifasini ochib ko'rishni so'rang, hali 405 bo'lsa
   chuqurroq loglash kerak.
2. 1.2-band (Rahbar paneli/Modullar/Integratsiyalar)ni ham egasidan
   qayta tasdiqlashni so'rang.
3. 2.1-band (parol arxitekturasi) bo'yicha EGASI bilan gaplashib qaror
   qabul qiling — bu eng katta, eng muhim ochiq band, lekin SHOSHILMASDAN,
   xavfsizlik nuqtai nazaridan to'g'ri yechim tanlanishi kerak.
4. 2.3-band (F2 resumable import UI ulanishi) — alohida, katta ish,
   `ops/handoff/T2_PTO_CLOSURE_007_CODEX_F2_RESUMABLE_IMPORT.md`da
   allaqachon batafsil yozilgan kontekst bor.

## 4. Gate holati

Barcha 1.1-1.4 bandlardagi kod tuzatishlari `tsc -b`, `oxlint`,
`vitest` (240/240), `vite build`, `node ops/governance-check.cjs`
orqali mustaqil tekshirilgan va `main`ga push qilingan (commit'lar:
`ccd5423..041da89` oralig'ida, batafsili `git log` orqali ko'rinadi).
