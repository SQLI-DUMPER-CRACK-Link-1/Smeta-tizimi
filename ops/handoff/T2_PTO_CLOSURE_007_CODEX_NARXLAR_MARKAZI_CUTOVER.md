# T2-PTO-CLOSURE-007-CODEX-NARXLAR-MARKAZI-CUTOVER

**Rol:** Implementation engineer (Codex)
**Katta ish** — egasi aniq aytdi: "katta ishlar bering, goal qilib beraman,
shu bilan ishlab yuraveradi". Bu bitta-o'tirishda tugaydigan mayda vazifa
EMAS — bir necha bosqichli, o'zing rejalashtiradigan haqiqiy loyiha.
Baribir HAR BOSQICHDA ishlaydigan, test qilingan narsa qoldirasan — oxirigacha
kutib, bittada "katta tashlash" qilma.

**Branch:** yangi, `codex/t2-narxlar-markazi-cutover-v1` — base:
`origin/integration/next-main-release-v1`

## Nima uchun bu katta va real ish

`/admin/narxlar` (Narxlar.tsx) — egasining kunlik ishlatadigan sahifasi —
HALI HAM 100% GAS orqali ishlaydi (`apiNarxlarOl`, `apiNarxBelgilanganSaqla`,
`apiOraliqlarOl/Skan/Saqla`). Lekin men tekshirganimda ANIQLADIM: bu domen
uchun Supabase tomoni SIZ O'YLAGANDAN KO'P TAYYOR:

- **O'QISH deyarli 100% tayyor va hujjatlashtirilgan**:
  `frontend/src/api/t2-narx.ts` — `t2_narx_markaz` (asosiy narx markazi
  ko'rinishi, `MAX(belgilangan, smeta_max, sana_max)` qoidasi, xavf/farq_koef
  bilan), `t2_topilmaganlar` (narxi topilmagan resurslar), `t2_narx_qol_xavf`
  (himoyasiz qo'lda tahrirlar). Bu fayl JUDA yaxshi hujjatlashtirilgan —
  har bir maydonning MA'NOSI va NEGA shunday ekanligi izohlangan. O'QI,
  hurmat qil, qayta yozma.
- **YOZISH gateway qismi TAYYOR**: `frontend/functions/api/sb-yoz.ts`
  satr 46-47 (whitelist) va 481-528 (`narx_belgila`/`narx_sana_qosh`
  amallari) — parametr shakllantirish, validatsiya (narx musbat son,
  sana formati, "kirgan=yozildi+tashlandi" kafolati) ALLAQACHON YOZILGAN.
  Sen FAQAT shu ANIQ kontraktga mos RPC yozasan — kontrakt allaqachon
  qat'iy belgilangan (o'zgartirma, RPC shunga moslashsin).
- **RPC'larning O'ZI YO'Q**: `t2_narx_belgila`, `t2_narx_sana_qosh` — HECH
  QANDAY migratsiyada yo'q (tasdiqlandi: `grep -rli` bo'yicha 0 natija).
  `t2_narx_markaz`/`t2_topilmaganlar`/`t2_narx_qol_xavf` view'lari HAM
  local migratsiyalarda topilmadi — **BIRINCHI QADAM sifatida sen o'zing
  production'da haqiqatan mavjudmi tekshir** (`list_tables`/`list_views`
  yoki `select * from t2_narx_markaz limit 1`). Agar mavjud bo'lsa — ular
  boshqa yo'l bilan (migratsiyasiz) yaratilgan, sen ularni HURMAT qilib,
  qayta yaratmaysan, faqat RPC'larni qo'shasan. Agar mavjud EMAS bo'lsa —
  ham view'larni, ham RPC'larni sen yaratasan.
- **UI ALLAQACHON BOR, lekin faqat TEST'da**: `frontend/src/test02/
  TestNarxlar.tsx` (264 qator) — `t2-narx.ts`ning barcha funksiyalarini
  chaqiradigan, ishlaydigan UI. Buni QAYTA YOZMA — F2Import.tsx qanday
  qilib TestF2Native.tsx'ni "TestF2Native asosida, lekin yozish qismi
  tuzatilgan" qilib kanonik qilgani kabi, SHU NAMUNAGA ERGASH.

## Bosqichlar (o'zing tafsilotini rejalashtirasan, lekin shu ketma-ketlik)

**1-bosqich — Tekshirish va backend.**
- Production'da `t2_narx_markaz`/`t2_topilmaganlar`/`t2_narx_qol_xavf`/
  `t2_narx_sana` mavjudligini tekshir. Natijani hisobotda aniq yoz.
- `t2_narx_belgila(p_nom, p_birlik, p_narx, p_kat, p_izoh,
  p_kutilgan_versiya, p_manba, p_kim)` — `sb-yoz.ts:493-503`dagi ANIQ
  parametr nomlariga mos. `p_kutilgan_versiya` optimistic lock (`null`
  bo'lsa versiya tekshiruvisiz birinchi marta belgilash). Narx qanday
  saqlanadi (qaysi jadval — ehtimol `t2_narx` allaqachon bor, tekshir)?
  ЧЕЛ/МАШ uchun kategoriya QULFLANGAN qoidasini frontend qanday
  qo'llayotganini `Narxlar.tsx:13-16` (`QULF` konstantasi)dan o'qi —
  backend HAM shu qoidani QAYTA tasdiqlashi kerak (frontend'ga ishonma,
  backend o'z ichida ЧЕЛ/МАШ kategoriyasini birlikdan qat'iy hisoblasin).
- `t2_narx_sana_qosh(p_sana, p_qatorlar, p_manba, p_kim)` — bozor
  narxlari. **QAT'IY**: yaroqsiz qator (narx yo'q/manfiy, nom bo'sh) JIM
  TASHLANMAYDI — javobda alohida sanaladi (`tashlangan_qatorlar`), va
  `kirgan = yozildi + tashlandi` kafolati SAQLANADI (`t2-narx.ts:196-199`
  o'zi shuni talab qiladi — buni SINOVDA aniq tekshir).
- Idempotentlik/audit — bu sessiyada qurilgan boshqa RPC'lardagi bilan
  bir xil pattern (`t2_actor_kompaniya_azo_tekshir`, `t2_audit_yoz`,
  operation_id orqali replay — agar `t2-narx.ts` clientida operation_id
  hali yo'q bo'lsa, QO'SH, chunki narx yozish moliyaviy amal).

**2-bosqich — Kanonik UI'ga flag bilan ulash.**
- `Narxlar.tsx`ni F2Import.tsx pattern'i bo'yicha wrapper qil: yangi
  `localStorage` flag (masalan `t2-narxlar-native-mode`), default O'CHIQ,
  flag YONIQ bo'lsa yangi `NarxlarNative.tsx` (TestNarxlar.tsx asosida,
  lekin endi HAQIQIY `t2_narx_belgila`/`t2_narx_sana_qosh` RPC orqali
  yozadigan) render qilinadi. Flag O'CHIQ — eski `Narxlar.tsx` BAYT-
  BAYTIGA o'zgarishsiz (buni test bilan isbotla, xuddi F2ImportNative
  qilgani kabi — `git show`dan asl kodni olib solishtir).
- ORALIQLAR bloki (`Narxlar.tsx:139-275`, svodka kategoriya oraliqlarini
  skanlash/saqlash) — bu HALI ALOHIDA GAS API (`apiOraliqlarOl/Skan/
  Saqla`), Supabase tomonida yo'q. Bu ish SCOPE'iga KIRMAYDI — faqat
  narx belgilash/sana narxlari bilan cheklan, oraliqlarga tegma.

**3-bosqich — Testlar va sinov.**
- Pure funksiyalar uchun unit test (`ЧЕЛ/МАШ birlikdan qulflangan`,
  `kirgan=yozildi+tashlandi`, `optimistic lock STALE_VERSION`).
- UI test (F2ImportNative.ui.test.tsx uslubida) — flag yoniq/o'chiqni,
  serverdan noto'g'ri/muvaffaqiyatsiz javobni qamrab oladigan.
- Production'da SINTETIK resurs nomi bilan sinash (masalan
  `_TEST_NARX_BELGILA_` prefiksli), keyin albatta TOZALASH. Haqiqiy
  1615 resursga (yoki necha bo'lsa) tegma.

## QAT'IY CHEKLOVLAR

- `t2-narx.ts`ning mavjud tiplariga/funksiyalariga TEGMA — faqat yangi
  RPC qo'sh, kontrakt allaqachon aniq.
- `sb-yoz.ts:481-528`dagi parametr shakllantirish MANTIG'INI o'zgartirma —
  RPC shu kontraktga moslashadi, aksincha emas.
- Narx hech qachon "0" yoki taxminiy raqam bilan to'ldirilmaydi —
  noma'lum narx `null` bo'lib qoladi (`t2-narx.ts` o'zi buni bir necha
  joyda ta'kidlagan — QAT'IY QONUN, boshqa hech qanday moliyaviy
  ma'lumot bilan aralashtirilmaydi).
- Faqat shu domen (narxlash) — Additional/Replacement, Catalog write,
  F2 resumable import ishlariga tegma (ular boshqa branch/lane).
- Production'ga haqiqiy yozish — faqat sintetik, tozalanadigan
  ma'lumot bilan.

## Report

`ops/handoff/T2_PTO_CLOSURE_007_CODEX_NARXLAR_MARKAZI_CUTOVER_REPORT.md`
— har bosqich uchun nima qilingani, production tekshiruv natijasi,
gates, sinov dalili.
