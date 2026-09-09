# HERMES UCHUN — MA'LUM MUAMMOLAR RO'YXATI — 2026-09-09

Bu hujjat Claude tomonidan yozilgan. Maqsad: egasi (anvar.ahatqulov@gmail.com)
tizimdagi barcha ma'lum muammolarni Hermes'ga ko'rsatishi uchun bitta joyda
jamlash. Pastdagi hammasi shu sessiyada (va undan oldingi ishlarda) real
tekshirilgan, taxmin emas.

---

## 0. HOZIRGI HOLAT

| Narsa | Qiymat |
|---|---|
| Oxirgi commit (push qilingan) | `7dc1039` |
| Branch | `main` |
| Frontend | Cloudflare Pages (`smeta-tizimi.pages.dev`) |
| Backend | Cloudflare Pages Functions + Supabase/Postgres |
| Supabase loyiha | `tuoyrzadkgoltpqkdiyx` |
| Fayl saqlash | Cloudflare R2 |
| Eski tizim | Google Apps Script (GAS) + Google Sheets/Drive ("Tizim 1"), bosqichma-bosqich almashtirilmoqda |

---

## 1. BU SESSIYADA TUZATILGAN MUAMMOLAR

Har biri jonli (production) ma'lumotda tekshirilgan va `main`ga push qilingan.

### 1.1 T2-OBYEKT-NAME-REUSE-001 — korzinkaga tashlangan obyekt nomini qayta ishlatib bo'lmasdi
- **Muammo:** obyektni "o'chirsa" (aslida `holat='bekor'` — soft delete), o'sha nom bilan yangi obyekt ochib bo'lmasdi — baza xato (23505) berardi.
- **Sabab:** unique indeks TO'LIQ edi (bekor qilinganlarni ham hisobga olardi).
- **Tuzatish:** indeks PARTIAL qilindi (`WHERE holat <> 'bekor'`) + tushunarli xato xabari (`OBYEKT_NOM_MAVJUD`).
- Commit: `d206625`

### 1.2 T2-SMETA-RETRY-CLEAR-001 — xato yuklangan smetani obyektni o'chirmasdan qaytadan yuklab bo'lmasdi
- **Muammo:** smeta noto'g'ri/eskirgan chiqsa, butun obyektni o'chirib qaytadan yaratishdan boshqa yo'l yo'q edi.
- **Tuzatish:** yangi RPC (`t2_smeta_tozalash_v1`) — obyektning o'zini saqlab, faqat smeta qatorlarini tozalaydi (agar fakt/narx-asos yozuvlari BO'LMASA).
- Commit: `3d9edb9`

### 1.3 T2-SMETA-TOZALASH-TIMEOUT-001 — ⚠️ YUQORIDAGI TUZATISHNING O'ZIDA KATTA XATO
- **Muammo (egasi xabar bergan, joriy sessiyada):** "smetani tozalab qaytadan yuklash" tugmasini bosganda katta smetada **57014 (statement timeout)** xatosi.
- **Sabab:** yangi `t2_smeta_tozalash_v1` `t2_qator`ni ommaviy o'chirishdan oldin `t2.manba` ni belgilamagan edi. Bu jadvalda ikkita trigger bor — ular `t2.manba` import/rollup rejimida bo'lmasa HAR BIR o'chirilgan qator uchun alohida audit-log yozadi va signalni qayta hisoblaydi. Minglab qatorli smetada bu 30 soniyalik limitdan oshib ketadi.
- **Muhim:** bu ANIQ SHU KASALLIK avvalroq boshqa joyda (import RPC'da, commit `793e716`) allaqachon tuzatilgan edi — men o'zim yangi kodda qaytadan qildim.
- **Tuzatish:** o'chirishdan oldin `set_config('t2.manba','import',true)`.
- **Tekshiruv:** 4001 qatorli sun'iy smetada — tuzatishdan oldin 60 soniyadan oshgan, tuzatishdan keyin 0.4 soniya.
- Commit: `7dc1039`
- **Xulosa Hermes uchun:** `t2_qator` jadvaliga ommaviy yozadigan HAR QANDAY yangi kod yozilganda, albatta shu ikkita trigger bilan mos kelishini tekshirish kerak — bu takrorlanuvchi xato sinfi.

### 1.4 T2-F2-IMPORT-TUR-CASCADE-001 — F2 import sessiyasini davom ettirganda rs/mat/ob turi yo'qolardi
- **Muammo:** F2 import "qoralama"sini saqlab, keyin davom ettirilsa, barcha qatorlar majburan "rs" turiga aylanardi (mat/ob farqi yo'qolardi).
- **Tuzatish:** `tur` maydoni butun zanjir bo'ylab (saqlash → o'qish → tiklash) saqlanadigan qilindi.
- Commit: `5020635`

### 1.5 T2-LEGACY-DRIVE-SCAN-COMPANY-LEAK-001 — ⚠️ XAVFSIZLIK/MAXFIYLIK: bir kompaniya boshqa kompaniyaning obyektlarini ko'rardi
- **Muammo:** egasi tomonidan avvalroq tasvirlangan "tizimda BARCHA smetalar ro'yxati chiqib qolyapti" degan sirli muammo — tasdiqlandi.
- **Sabab:** eski GAS funksiyasi (`apiPapkaSkan`) BUTUN Google Drive ildizini skanerlaydi — kompaniya (tenant) tushunchasi umuman yo'q edi. Bu xom natija ~13 ta eski sahifada (Obyektlar, Hujjatlar, F2Import, Ierarxiya, Sozlamalar, Shartnoma, FaylBoglash, Holat, Narxlar, Monitoring, F2Tayyorlash, CommandPalette, TezlikSinovi) to'g'ridan-to'g'ri ko'rsatilardi.
- **Tuzatish:** xom Drive skanini kanonik (Supabase) kompaniya-obyektlar ro'yxati bilan filtrlanadi — faqat shu kompaniyaga tegishli nomlar qoladi.
- Commit: `9efcec8`

### 1.6 T2-HUJJAT-IDEAL-ZANJIR-001 — "arvoh" hujjat yozuvi + osilib qolgan yuklashlar to'liq aniqlanmasdi
- **Egasining talabi:** "hujjatlarga etibor ber, muammo bo'lmasligi kerak — ideal zanjir bo'lsin har bir hujjatda."
- **Topilgan real muammo:** bitta hujjat yozuvi (`id=2`) hech qachon yakunlanmagan, hech kim ishlatmaydigan "arvoh" holatda turgan edi — tozalandi (`status='superseded'`).
- **Topilgan gap:** osilib qolgan yuklashni aniqlash faqat BITTA holatni (`reserved`, 30 daqiqadan ortiq) tekshirardi — endi `stored`/`failed`dan boshqa BARCHA holatlar tekshiriladi, va bu endi hujjatning o'zida (aggregat hisobotda emas) `'ERROR'` sifatida ko'rinadi.
- Commit: `56d3f0b`

### 1.7 T2-RUXSAT-QOSHIMCHA-001 — direktor a'zolarning ruxsatlarini boshqara olmasdi
- **Egasining talabi:** "rol va ruxsatlarni ham hal qilib ber."
- **Tuzatish:** direktor endi a'zoning rolini o'zgartirmasdan, unga QO'SHIMCHA aniq ruxsatlar bera oladi (13 ta ruxsat turidan).
- **⚠️ OCHIQ CHEGARA (egasi bilan kelishilgan, lekin Hermes bilishi kerak):** bu qo'shimcha ruxsat FAQAT `t2_effective_authorization_v1` chaqiradigan tekshiruvlarga ta'sir qiladi (hozircha faqat `/api/company?authorize=1`). Ko'pchilik yozuv RPC'lari (`t2_qator_tahrir`, `t2_smeta_import_*`, `t2_fakt_yoz`, `t2_narx_belgila` va h.k.) O'ZINING mustaqil, qattiq kodlangan rol tekshiruviga ega — ular bu markazlashgan tizimga ULANMAGAN. Ya'ni: ruxsat berish tizimi TO'LIQ markazlashmagan — bu katta arxitektura kamchiligi, hali hal qilinmagan.
- Commit: `c48a3ea`

---

### 1.8 T2-F2-IMPORT-NARXSIZ-BLOK-001 — ⚠️ ENG KATTA TOPILMA: F2 zanjiri UMUMAN ishlamayotgan edi
- **Qanday topildi:** LRV eksportiga FAKT/F2 ustunlarini qo'shayotib, bazani tekshirdim — butun bazada FAKT va F2 **mutlaqo nol** (36 654 qatorning hammasida). Sabab read-model emas: `t2_akt_qator` jadvali **butunlay bo'sh**.
- **Ildiz sabab:** `F2ImportNative.tsx`dagi `exactWrite` funksiyasi bitta ham narxi nol/yo'q qator uchrasa BUTUN faylni rad etardi:
  ```js
  if (nodes.some(n => n.narx == null || n.narx <= 0 || n.summa == null || n.summa === 0)) throw ...
  ```
- **Nega bu halokatli:** haqiqiy Amfiteatr F2 faylida 1054 qatordan **164 tasi** aynan shunday, va ular **buzuq emas**:
  - `000003` ЗАТРАТЫ ТРУДА МАШИНИСТОВ — obyektdagi **782 tadan 782 tasi (100 %) narxsiz**. Bu qoida: mashinist soati mashina narxi ichida, alohida puli yo'q. (Taqqoslang: `000001` ЗАТРАТЫ ТРУДА РАБОЧИХ — 852/852 = 100 % **narxlangan**.)
  - `009219` ВОДА, `035567` ОЧЕС ЛЬНЯНОЙ, `064848` — hammasi smetada ham narxsiz.
  - Bu 164 tadan **159 tasi allaqachon moslashgan** edi — ya'ni operator 34 ta noaniq qatorni qo'lda hal qilsa ham tugma o'lik qolaverardi. Faylni **hech qachon** yozib bo'lmasdi.
- **Oqibati (jonli izlar):** `t2_f2_import_job` da 2 ta ish — 06.09 (obyekt 6, 1.63 mlrd so'm) va 08.09 (obyekt 56, 1.75 mlrd so'm) — ikkalasi ham `status='running'`, `cursor.phase='review'`, `completed_at=null`. Ya'ni ikki marta oxirigacha borib, jim to'xtab qolgan.
- **Tuzatish:** to'siq olib tashlandi. To'g'ri yo'l ALLAQACHON qurilgan va testlar bilan qoplangan edi: `f2ExactPayloadQur` narxsiz qatorga `priceIntentionallyAbsent: true` qo'yadi, `t2_akt_yarat_v2` esa uni `provenance_status='price_intentionally_absent'` bilan yozadi (hajm yoziladi, pul yozilmaydi). Ya'ni to'siq o'zi chaqiradigan kontraktga zid edi.
- **Himoyalar KUCHAYTIRILDI, kamaytirilmadi:**
  - `AMOUNT_WITHOUT_PRICE` — summasi bor-u birlik narxi yo'q qator endi aniq to'xtatiladi (RPC uni `null` qilib **pulni yo'qotardi**).
  - Qisman summa — bir smeta qatoriga birlashgan bo'laklarning birida pul bo'lmasa, yig'indi buni yashirmasin (hajm hammasidan qo'shiladi, pul esa emas). `summasizBolak` sanaladi → `NEEDS_REVIEW`. **Bu regressiyani mavjud test tutdi.**
- Commit: `da26170`
- **⚠️ Hermes/egasi uchun keyingi qadam:** endi F2 importini qaytadan yurgizib ko'rish kerak. Qolgan 34 ta noaniq qator — bular yangi ish EMAS, balki kodi smetada juda ko'p marta uchraydigan (`000001` 852 marta, `000762` 408 marta) resurslar, ya'ni ko'p nomzodli qatorlar; ular workbench'da qo'lda bog'lanadi.

### 1.9 T2-LRV-PLUS-EXPORT-002 — LRV_PLUS eksporti haqiqiy tuzilishga keltirildi
- v1 atigi 9 ustunli MVP edi. Endi **26 ustun**, haqiqiy T1 fayl tartibida, T1 rang sxemasi bilan (rz sariq, bl ko'k+oq shrift, mat yashil), va HAR BIR qatorda FAKT / OSTATKA / F2 ОЛИНГАН / F2 ОЛИНИШИ МУМКИН.
- Excelning O'ZIDA jonli formulalar (T1 naqshi): `ОБЪЁМ(rs)=НОРМА×ОБЪЁМ(bl)`, `СУММА=ОБЪЁМ×ЦЕНА`, bl/rz uchun SUMIF, `ОСТАТКА=SMETA−ФАКТ`, `ОСТАТКА Ф2=ФАКТ−ЗАБРАН`.
- Rang uchun `xlsx-js-style` qo'shildi — oddiy SheetJS Community yozishda katak rangini **umuman** qo'llab-quvvatlamaydi (Pro xususiyat).
- Commit: `cb5075e`

---

## 2. HOZIR OCHIQ (HAL QILINMAGAN) MUAMMOLAR

### 2.0 ⭐ F2 ni oxirigacha yurgizish — ZANJIR TEKSHIRILDI, EGASINING TASDIG'I KUTILMOQDA

**Jonli bazada, orqaga qaytariladigan tranzaksiyada (`rollback`) uchidan-uchiga tekshirildi** — qotib qolgan haqiqiy qoralamaning (job 2, obyekt 6 «Amfiteatr») o'zi bilan. Bazada hech narsa o'zgarmadi.

| Tekshiruv | Natija |
|---|---|
| Payload | 1020 qator, shundan **159 tasi narxsiz** |
| `t2_akt_yarat_v2` javobi | `ok: true` — ilgari bu chaqiruvgacha ham yetib borilmasdi |
| `t2_akt_qator` | **1020 qator** yozildi, jami `certified_amount` = **1 633 694 097.50** |
| Narxsiz qatorlar | **159 tasi** `provenance_status='price_intentionally_absent'` bilan (hajm bor, pul yo'q) |
| Read-model (`t2_qator_holat`, faqat barglar) | 1020 qator, jami `f2_summa` = **1 633 694 097.50** |
| **Kirgan = tushdi farqi** | **0.00** ✅ |
| Manfiy (storno) qatorlar | 79 tasi saqlandi, jim tashlanmadi |
| Nol hajm — lekin summasi bor (fantom pul) | 0 ✅ |

Ya'ni zanjir **butunlay ishlaydi**: qoralama → `t2_akt` → `t2_akt_qator` → `t2_qator_holat` → LRVdagi FAKT/F2 ustunlari, tiyinigacha aniq.

**⛔ QOLGAN YAGONA QADAM — EGASINING TASDIG'I:** haqiqiy (rollback'siz) importni bajarish 1.63 mlrd so'mlik moliyaviy hujjatni productionga yozadi. Bu topshiriqdagi «hard safety boundary» ostiga tushadi, shuning uchun avtomatik bajarilmadi. Egasi tasdiqlasa — F2 import ekranidan qaytadan yurgizilsa yetarli (kod tuzatilgan), yoki shu payload bilan RPC to'g'ridan-to'g'ri chaqiriladi.
- Shuningdek `t2_akt` da bitta g'alati yozuv bor: `id=19`, `tur='f2'`, `holat='tasdiqlangan'` (26.08 da yaratilgan) — lekin **ichida bironta qator yo'q**. Tasdiqlangan, lekin bo'sh hujjat. Buni alohida ko'rib chiqish kerak.

### 2.1 ~~ENG SO'NGGI TALAB~~ — LRV_PLUS Excel eksporti (1.9-bandda BAJARILDI, egasi ko'rib chiqmoqda)
- **Egasining so'zi (aynan):** "San qilib bergan tizim umuman unaqa ishlamayapdi jigar" — keyin aniq talab: smeta strukturasi shaklida, narxlangan F2 kiritilgan, butun obyektni to'liq nazorat qilinayotganini ko'rsatadigan, **LRV kabi ranglangan dizayndagi** hujjat kerak. **Har bir qatorda** aniq qiymat: FAKT, SMETA, OSTATKA, F2 OLINGAN, F2 OLINISHI MUMKIN.
- **Holat:** ishlanmoqda, TUGALLANMAGAN.
  - Tadqiqot bosqichi tugallangan: real Tizim-1 LRV_PLUS fayli (Google Drive'dan) yuklab olinib, ustunlar/formulalar bayt darajasida o'rganilgan (36 ustun, rz/bl/rs/mat kaskad formulalari, oylik F2 ustunlari, rang sxemasi: rz=sariq, bl=ko'k+oq shrift, mat=yashil).
  - Kod tomoni: `frontend/src/lib/lrv-plus-export.ts` da hozircha faqat MVP versiya bor — 9 ustun (№, Шифр, Наименование, Ед.изм, Норма, Объём, Цена, Сумма, Даража), FAKT/OSTATKA/F2 ustunlari YO'Q, rang YO'Q.
  - Rang chizish uchun kerakli kutubxona (`xlsx-js-style`) SHU SESSIYADA qo'shildi (`frontend/package.json`), lekin hali export kodiga ULANMAGAN.
  - Kerakli ma'lumot manbasi (`T2QatorHolat` — `fakt_hajm`, `f2_hajm`, `f2_mumkin_hajm`, `qoldiq_hajm` va h.k.) allaqachon backend'da mavjud va HAR BIR qator (rz/bl/rs/mat/ob) uchun tayyor hisoblangan holda keladi — faqat frontend eksport kodiga ulanishi kerak.
- **Keyingi qadam:** `lrv-plus-export.ts` v2 — yuqoridagi ustunlar + rang qo'shish, `HolatNative.tsx`ga ulash, test yozish, egasi tekshirishi uchun namuna fayl yuborish.

### 2.2 Qisman (targeted) smeta qayta importi — holat noaniq
- Avvalroq egasi bilan kelishilgan qoida bor edi: smetani qayta yuklaganda eski va yangi fayldagi qatorlar kod bo'yicha solishtirilib, o'zgarganlar yangilanishi, olib tashlanganlar esa O'CHIRILMASDAN faqat BELGILANISHI kerak (egasi shu variantni tanlagan edi).
- **Bu funksiya HALI KODDA TOPILMADI/TASDIQLANMADI** — ehtimol hali yozilmagan. Hermes buni alohida tekshirishi kerak.

### 2.3 Ruxsatlar markazlashmagan (1.7-band bilan bog'liq, lekin kattaroq)
- Ko'pchilik yozuv RPC'lari o'z rol-tekshiruvini o'zi qiladi, `t2_effective_authorization_v1`dan foydalanmaydi. Bu degani: yangi ruxsat turi qo'shilganda, uni HAR BIR RPC'ga alohida qo'lda qo'shish kerak — markaziy joydan boshqarib bo'lmaydi. Katta refaktoring talab qiladi.

---

## 3. TAKRORLANUVCHI XATO SINFI (Hermes uchun ogohlantirish)

Shu sessiyada (va undan oldin) BIR NECHA MARTA xuddi shu xato takrorlangan:
кod ko'rinishda TO'G'RI, kichik/sun'iy ma'lumotda ishlaydi, lekin HAQIQIY
hajmda (minglab qator, real fayl) buziladi. Misollar: 8 soniyalik
PostgREST timeout, narx=0 bo'lib qolgan RES-narxlash xatosi, va yuqoridagi
1.3-band (57014 timeout). **Xulosa:** `t2_qator` jadvaliga ommaviy
yoziladigan har qanday YANGI kod — albatta katta hajmda (minglab qator)
sinalishi shart, faqat kichik test yetarli emas.

---

*Hujjatni Claude yozgan, 2026-09-09.*
