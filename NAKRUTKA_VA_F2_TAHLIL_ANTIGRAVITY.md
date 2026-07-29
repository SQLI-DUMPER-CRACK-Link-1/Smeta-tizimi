# 🔍 НАКРУТКА va F2 — TO'LIQ TAHLIL (Claude → Antigravity / kelasi ishlovchi uchun)

> Sana: 2026-07-05. Bu fayl — foydalanuvchi bergan **aniq raqamli misol** asosida
> накрутка (устама) tizimidagi mantiqiy nosozlikni ILDIZIGACHA tahlil qiladi, allaqachon
> QILINGAN tuzatishlarni sanaydi, va QOLGAN barcha muammolarni ustuvorlik tartibida
> ro'yxatlaydi. Maqsad — keyingi ishlovchi (Antigravity yoki boshqa) buni QAYTA
> boshidan tekshirmasdan, TO'G'RI joydan davom etishi.
>
> ⛔ **Avval albatta o'qi:** `ANTIGRAVITY_UCHUN.md` (BUZILMAS QOIDALAR bo'limi) —
> git checkout/stash bilan jonli kodni bosib ketish incidenti ALLAQACHON 2 marta
> bo'lgan (2026-06-25 va yaqinda). Har ish boshida **`clasp pull`** bilan boshla,
> **HECH QACHON** `git checkout <fayl>` yoki `git reset --hard` qilma.

---

## 1. FOYDALANUVCHI XABAR QILGAN MUAMMO (aynan matn)

> "Xolat va f2 da umumiy smeta summasi 10mlrd nakrutka bilan hisoblangani 9mlrd
> 770mln deyapdi, fakt pulda nakrutkani qayerdan hisoblayapdi ko'rib bo'lmayapdi"

Ya'ni: Panel → Ҳолат va Ф2 tabida "💰 Умумий смета" KPI kartasi ~10 mlrd so'm
ko'rsatadi. Shu kartaning yonidagi 🧮 (накрутка chipi) bosilganda ochiladigan
oyna (`apiObyektNakrutka`) esa "ВСЕГО СТОИМОСТЬ... " = **9,770,218,766 сўм** deb
chiqaradi — ya'ni **накрутка (устама) билан НАРХ, устамасиз сметадан КАМ** chiqib
turibdi. Bu mantiqan MUTLAQO noto'g'ri — устама (transport+склад+прочие+НДС)
qo'shilganda narx albatta OSHISHI kerak, hech qachon kamaymaydi.

Foydalanuvchi to'liq накрутка jadvalini yubordi:

```
ЧЕЛ                         1 330 558 469
МАШ                         4 102 314 177
МАТ (КАБ=0)                 1 020 734 467
ОБ                            965 130 507
ИТОГО ПРЯМЫЕ ЗАТРАТЫ        7 418 737 621   ← БАЗА (bu смета EMAS!)
...
ВСЕГО (НДС билан)           9 770 218 766   ← БУНИ "10 mlrd smeta" bilan solishtirgan
```

---

## 2. ILDIZ SABAB — TOPILDI VA TASDIQLANDI

### 2.1. Ikki xil "СМЕТА" bor, ular BIR-BIRIGA TENG BO'LISHI KERAK edi, lekin emas edi

Tizimda smeta summasi **ikki mustaqil joyda** hisoblanadi:

| Manba | Fayl/funksiya | Nimadan hisoblaydi |
|---|---|---|
| **"Umumiy smeta" KPI** (Ҳолат va Ф2 tab) | `Panel.html` → `_kpi()` | LRV_PLUS'ni **to'g'ridan-to'g'ri** o'qib, daraxtdagi HAR bir `bl`/`mat` tugunning (shu jumladan `+` қўшимча/замена tugunlarning ham!) `smeta` maydonini yig'adi |
| **Накрутка bazasi (ПРЯМЫЕ)** | `20_Server.js` → `serverYozFile()` → `DASHBOARD` varaqi → `80_Shartnoma.js` → `apiObyektNakrutka()` | LRV_PLUS'ni **DASHBOARD orqali bilvosita** o'qiydi — DASHBOARD qatori faqat `serverYozFile` ishga tushganda (`[Ишла]` yoki avtomatik trigger vaqtida) yangilanadi |

**Muammo:** `serverYozFile()` ichida (20_Server.js, 38-39 qatorlar, ESKI kod):

```js
var m=String(g[i][iMark]||'').trim().toLowerCase();
if(m!=='rs'&&(m !== 'mat' && m !== 'ob') ) continue;   // ⚠️ '+' TASHLANMAGAN!
```

LRV_PLUS'da қўшимча/замена qatorlar marker sifatida `"rs+"`, `"mat+"`, `"ob+"`
(oxirida **PLUS belgisi bilan**) saqlanadi (oddiy `"rs"` emas). Yuqoridagi tekshiruv
`m!=='rs'` — bu **ANIQ SATRLARNI SOLISHTIRISH**, `"rs+"` hech qachon `"rs"` ga teng
bo'lmaydi → natijada **BARCHA қўшимча/замена ишлар DASHBOARD hisobidan
BUTUNLAY TUSHIB QOLGAN** (na smeta, na ЧЕЛ/МАШ/МАТ/ОБ kategoriyalarga, na
ФАКТ/Ф2/ҚОЛДИҚ summalariga қўшилмаган).

Shu bilan bir vaqtda, Panel.html'dagi `_kpi()` (KPI "Umumiy smeta" hisoblovchi)
BUNDAY filtrlash qilmaydi — u LRV daraxtidagi **HAMMA** `bl`/`mat` tugunni
(қўшимча bo'lса ham) yig'adi.

**Natija:** agar obyektda F2 import orqali ko'p miqdorda замена/қўшимча ish
qo'shilgan bo'lsa (bu obyekt aynan shunday — F2 import bilan ko'p ishlangan),
DASHBOARD'dagi "ПРЯМЫЕ" (7.42 mlrd) haqiqiy to'liq smetadan (KPI'dagi ~10 mlrd)
**2.5+ mlrd (deyarli 26%) KAM** chiqadi — bu farq aynan tushib qolgan
қўшимча ишлар summasiga to'g'ri keladi. Накрутка shu **KICHIKROQ** bazadan
hisoblab, 32% qo'shsa ham, natija katta ehtimol bilan to'liq (KPI) smetadan
hali ham kam yoki unga yaqin chiqadi — aynan foydalanuvchi ko'rgan holat.

### 2.2. Bu XATOLIK TURI birinchi marta emas — allaqachon BOSHQA joyda topilgan va tuzatilgan edi

`Smeta tizimi/CLAUDE.md` fix **#63** xuddi shu muammoni `apiTashxis` (30_Panel.js)
funksiyasida topib, tuzatgan edi ("Қўшимча ишлар асл сметага аралашиб кетарди").
Ammo o'sha tuzatish **faqat apiTashxis'ga** qo'llangan, **`20_Server.js`dagi
`serverYozFile` esa unutilib qolgan** — aynan накрутка/DASHBOARD/Buxgalteriya
shu funksiyaga tayangani uchun muammo u yerda "yashiringan" holda qolaverdi.

**SABOQ Antigravity uchun:** `marker` (`I` ustun, rz/bl/rs/mat/ob) bilan solishtirish
qiladigan **HAR QANDAY** yangi kod yozganda, albatta:
```js
var mk = String(cell).trim().toLowerCase().replace(/\+$/,'');  // ⚡ '+' ni tashlash SHART
```
qoidasiga rioya qiling — aks holda қўшимча/замена ишлар jimgina yo'qolib ketadi.
Repo bo'yicha `grep -n "!=='rs'\|!== 'rs'\|!='rs'"` bilan tekshiring — ushbu
patternni ishlatuvchi HAR bir joyda `.replace(/\+$/,'')` borligini tasdiqlang.

### 2.3. ✅ BUGUN QILINGAN TUZATISH (Claude, 2026-07-05, push qilindi, DEPLOY @89)

1. **`20_Server.js` → `serverYozFile()`** — marker endi `.replace(/\+$/,'')` bilan
   normallashtiriladi (asosiy tuzatish — DASHBOARD, накрутка, Buxgalteriya,
   Boss tezkor kartasi hammasi shu funksiyadan oziqlanadi).
2. **`10_Engine.js` → `_resurslarYig()`** — xuddi shunday marker normalizatsiyasi
   (RESURS varag'i uchun, kichikroq ta'sir — faqat resurs ro'yxati dedup sifatida).
3. **`10_Engine.js` → `_sumif2col`/`_sumifLeaf`** — RZ (razdel) darajasidagi SUMIF
   formulalar endi `"bl+"`/`"mat+"`/`"ob+"`/`"rs+"` variantlarini ham qo'shib
   hisoblaydi (agar қўшимча ish RAZDEL ostiga TO'G'RIDAN-TO'G'RI, bl ichiga emas,
   qo'shilgan bo'lsa — bu RZ jamisidan ham tushib qolmasin uchun).

### 2.4. ⚠️ QOLGAN NOANIQLIK — KEYINGI ISHLOVCHI HAL QILISHI KERAK (mantiqiy/konseptual savol)

Tuzatishdan keyin ham накрутка "ВСЕГО" bilan "Umumiy smeta" KPI **matematik jihatdan
teng bo'lishi SHART EMAS** — chunki ular ikki BUTUNLAY BOSHQA narsani anglatadi:

- **"Umumiy smeta"** = LRV'dagi har resursning **G (НАРХ)** ustuni (SVODKA'dan olingan,
  ya'ni bozor/joriy narx — CLAUDE.md fix #46 "CONSTANTA narxlash") × hajm — bu allaqachon
  **YAKUNIY, JORIY BOZOR NARXI** asosidagi summa.
- **Накрутка "ВСЕГО"** = ПРЯМЫЕ ЗАТРАТЫ (ЧЕЛ+МАШ+МАТ+ОБ xarajat) ustiga
  transport/склад/прочие 18%/НДС 12% каби устама foizlarini QATLAM-QATLAM
  QO'SHIB chiqarilgan "ҳисоблаб топилган" narx — bu klassik **"базис нарxлардан
  жорий нархга"** (СТРОИТЕЛЬСТВО В ТЕКУЩИХ ЦЕНАХ) o'zbek qurilish smeta
  metodologiyasi bo'lib, u ПРЯМЫЕ xarajat **BAZAVIY (arzon, eski/normativ)
  narx** bo'lishini taxmin qiladi.

Bizning tizimda esa G (НАРХ) ustuni SVODKA'dan — ya'ni **ALLAQACHON JORIY BOZOR
narxi** (fix #46: "EXACT, FUZZY yo'q, faqat shu obyekt svodkasidan"). Demak LRV'dagi
ЧЕЛ/МАШ/МАТ/ОБ ustunlariga yozilgan qiymatlar HAM allaqachon svodka (joriy) narxda —
ular "baza narx" emas. Накрутка zanjiri bularning USTIGA yana 32% qo'shsa,
natija — **ikki marta narxlash** (svodka joriy narxi + yana ustama) bo'lishi mumkin,
YOKI aksincha накрутка foizlari picha kichikroq konfiguratsiya qilingani uchun,
natija tasodifan smeta darajasiga yaqin/kam chiqishi mumkin — bu HOZIRGI holat.

**Bu — kod xatosi emas, BIZNES-MANTIQ SAVOLI.** Ikki variantdan biri tanlanishi kerak
(foydalanuvchi bilan gaplashib hal qilinishi kerak, taxmin qilib "tuzatib" bo'lmaydi):

- **(A) Накрутка = alohida, mustaqil hisobot** ("agar smetani bazaviy narxlardan
  qursak, joriy narxga qancha bo'lardi" — faqat tahliliy/taqqoslash uchun, "Umumiy
  smeta" bilan TENGLASHTIRILMAYDI, alohida modal sifatida qoladi, lekin izohida
  aniq yozib qo'yiladi: "Bu — TAXMINIY qurilish narxi, siz LRV'dagi smeta bilan
  bir xil emas").
- **(B) Накрутка = LRV smeta ustiga QO'SHIMCHA qatlam** — ya'ni "Umumiy smeta"
  (bozor narxidagi to'liq smeta) ni BOSHLANG'ICH nuqta qilib, накрутка foizlarini
  ANIQ shu summaga (yoki uning bir qismiga, masalan faqat МАТ transport/склад'iga)
  qo'llash — bu holda ЧЕЛ+МАШ+МАТ+ОБ endi DASHBOARD'dan emas, balki **to'g'ridan-
  to'g'ri "Umumiy smeta" tarkibidagi kategoriya yig'indilaridan** olinishi kerak
  (ikkalasi bitta manbadan kelib chiqsin — hozir ikkita mustaqil yo'l bor, shuning
  uchun ular delta bo'lib chiqadi).

**Tavsiya:** foydalanuvchidan so'rang — "Накрутка nima uchun kerak: (1) faqat
tahlil/taqqoslash uchunmi, yoksa (2) mijozga taqdim etiladigan RASMIY YAKUNIY
NARXmi?" Javobga qarab yuqoridagi (A) yoki (B) yo'lni tanlang.

---

## 3. BOSHQA TOPILGAN, LEKIN TASDIQLANMAGAN IKKINCHI DARAJALI MUAMMO

`nakrutkaHisob()` (80_Shartnoma.js) ichida `mk` (М/К) va `kab` (КАБЕЛЬ) va `bez`
(БЕЗ СКЛАД) kategoriyalari **hech qachon LRV'da to'ldirilmaydi** — butun kodni
qidirib chiqilganda (`grep -n "col.MK\b\|col.KAB\b\|col.BEZSKLAD\b" 10_Engine.js`)
faqat **tozalash** (bo'sh qilish) va **jami formulasi** joylarida uchraydi, lekin
HECH BIR joyda haqiqiy qiymat yozilmaydi — user "qo'lda to'ldiradi" deb izoh
qoldirilgan (10_Engine.js qator 690: *"N=БЕЗ СКЛАД, O=М/К, P=КАБ TEGILMAYDI —
user qo'lda to'ldiradi"*), lekin bu ustunlarni to'ldirish uchun UI mavjud emas.
**Natija:** накрутка zanjiridagi "Транспорт расходы на кабели 1.5%" va "М/К 0.75%"
qatorlari **HAR DOIM 0** chiqadi (foydalanuvchi dumpida ham aynan shunday
ko'ringan). Bu — kichik ta'sir (jami summaning ~1-2%), lekin agar kelajakda
kabel/М-К xarajatlari katta ulush tashkil qiladigan obyekt bo'lsa, накрутка
пастроқ chiqadi. **Tavsiya:** Panelга М/К va КАБЕЛЬ uchun qo'lda belgilash UI'si
qo'shish (masalan resurs qatoriga kichik dropdown: ЧЕЛ/МАШ/МАТ/ОБ/М-К/КАБ/БЕЗ),
yoki hozircha shunday qoldirish (kichik ta'sir) — foydalanuvchi bilan tekshirilsin.

---

## 4. BUGUN (2026-07-05) BOSHQA QILINGAN TUZATISHLAR — QISQA RO'YXAT

| # | Muammo | Fayl | Holat |
|---|---|---|---|
| 1 | F2 "olingan" summasi 0 bo'lib qolishi | `10_Engine.js` (`_oyFormulaToldur`), `30_Panel.js` (`apiOyQosh`, `apiHolatSaqla`) | ✅ Tuzatildi — ildiz sabab: `bl`/`mat`/`ob` qatorlarga НАРХ/СУММА formulasi hech qachon to'ldirilmasdi (faqat `rs`ga). Endi "+ Oy" bosilganda (mavjud oy bo'lsa ham) va F2 saqlanganda avtomatik ta'mirlanadi |
| 2 | Накрутка KPI (asos + qo'shimcha) hisoblanishi | `Panel.html` (`_kpi`, `_nakrChipNode`, `_nakrExtra`) | ✅ Tuzatildi — endi "asos + Σ (kf−1)×barg" formulasi, natija HECH QACHON asosdan kam chiqmaydi (oldingi "barglar bo'yicha to'liq qayta yig'ish" usuli ba'zi barglarni yo'qotib, kamroq ko'rsatardi) |
| 3 | Остатка (қилинмаган ҳажм/summa) ko'rinmasligi | `Panel.html` (KPI 5-karta, rz badge, bl-stats) | ✅ Qo'shildi |
| 4 | DASHBOARD қўшимча ишларни yo'qotishi (bu faylning asosiy mavzusi) | `20_Server.js`, `10_Engine.js` | ✅ Tuzatildi (yuqorida 2.3-bo'lim) |

Barchasi push qilindi, deploy qilindi (@89, foydalanuvchi tasdig'i bilan).

---

## 5. QOLGAN OCHIQ MUAMMOLAR — TO'LIQ RO'YXAT (ustuvorlik tartibida)

Foydalanuvchi so'zma-so'z aytgan tartib: **"birinchi f2 masalasini ideal qilib hal
qil keyin nakrutkani keyin shaxsiy smetani"** — F2 asosiy qismi va накрутка asosiy
sabab bugun hal qilindi. Qolganlari:

### 5.1. F2 IMPORT — hali TEKSHIRILMAGAN/HAL QILINMAGAN qismlar

1. **F2 import o'ng panelda smeta daraxti umuman ochilmayapti** ("бу ochmayapdi
   hech narsa yo'q va bo'lgan taqdirda ham mani talablarimga mos ishlamayotgandi
   mantig'i"). — ⚠️ **KEYINGI ENG YUQORI USTUVORLIK.** `apiF2FaylOqi`/frontend
   `drawF2Node`/daraxt render funksiyalarini (`Panel.html`, F2 import modal qismi)
   qaytadan tekshirish kerak — ehtimol `apiHolatOl`/smeta daraxtini yuklovchi
   chaqiruv modal ochilganda umuman ishga tushmayapti, yoki DOM konteyner ID/CSS
   muammosi bor.
2. **Keraksiz tasdiqlash so'rovlari** — F2 import paytida kod/nom/birlik 100% mos
   kelgan qatorlar uchun ham har safar so'raladi. `f2AvtoMoslash` (CLAUDE.md fix
   #66) allaqachon aniq (bir nomzodli) qatorlarni avtomatik bog'lashi KERAK edi —
   nega hali ham so'ralayotganini TEKSHIRISH kerak (ehtimol bu funksiya chaqirilmay
   qolgan, yoki "bir nechta nomzod" holati noto'g'ri aniqlanmoqda).
3. **Замена/қўшимча qatorning joylashuvi** — ro'yxat oxiriga tushib ketishi.
   Memory (`antigravity-regressiya-stash.md` #25) bo'yicha "razdel tanlash modal"
   qo'shilgan edi (targetRow=tanlangan razdelning oxiri) — **TEKSHIRILMAGAN, real
   testda tasdiqlash kerak**.
4. **Замена resurslari (material/mexanizm) yo'qolishi** — faqat ish nomi qo'shilib,
   tagidagi resurslar ulanmasligi. Qisman urinilgan (memory #25), **to'liq
   tasdiqlanmagan**.
5. **"Yangi oy yaratish" darhol "kiritilgan" ko'rsatishi** — status/foiz hisoblash
   mantig'idagi xato. **Manbai hali TOPILMAGAN** — `apiHolatOl` yoki Panel.html'da
   `pct`/statusni belgilaydigan joyni qidirish kerak (ehtimol yangi oy ustuni
   qo'shilganda ОБЪЁМ=0 bo'lsa ham, boshqa (eski) oy qiymati asosida hisoblangan
   umumiy F2 foizi "0 emas" bo'lib ko'rinishi — ya'ni bu YANGILIK emas, balki
   ESKI oylar ustidan hisoblangan umumiy foiz sifatida noto'g'ri talqin qilinishi
   mumkin. Aniq skrinshot/reproduksiya kerak).

### 5.2. UI / GOOGLE SHEETS

6. **`ReferenceError: document is not defined @ test.gs:1666`** — ✅ **TEKSHIRILDI:
   HOZIRGI JONLI (`clasp pull`) va LOKAL kod 100% BIR XIL, `test.gs` fayli
   UMUMAN MAVJUD EMAS** (na jonli, na lokal), `document.`/`window.` so'zlari kodda
   faqat `'application/vnd.openxmlformats-officedocument...'` MIME-type satrida
   uchraydi (haqiqiy DOM chaqiruvi EMAS — false positive). **Xulosa:** bu xato
   ESKI, ALLAQACHON tuzatilgan kod holatiga tegishli bo'lgan, YOKI foydalanuvchi
   brauzer/Sheets keshi eski holatni ko'rsatgan. **Tavsiya:** foydalanuvchi
   Google Sheets faylni to'liq yopib qaytadan ochsin (Ctrl+F5 ekvivalenti). Agar
   xato QAYTA chiqsa — aniq qaysi menyu punkti bosilganda va to'liq xato matnini
   (stack trace) so'rab, keyin qidirish kerak.
7. **"Lot qo'shish" tugmasi ishlamaydi** — ❌ Hali qidirilmagan. Panel.html'da
   "Lot" so'zi bilan `grep -n "Lot" Panel.html` qilib tugma va uning `onclick`
   handler'ini topish, keyin backend API mavjudligini tekshirish kerak.
8. **Reestr paneli ko'rinmaydi/ishlamaydi** — Backend (`apiReestrOl`/`apiReestrSaqla`,
   30_Panel.js ~2614/2619) MAVJUD (oddiy JSON — Document Properties'da saqlanadi),
   lekin **frontend UI qismi (tab/render) yo'q yoki ulanmagan**. Bundan tashqari,
   foydalanuvchi Reestr va Шартнома (80_Shartnoma.js) tab'lari **mantiqan bir xil
   vazifani** bajarayotganini ta'kidladi — ya'ni ular DUBLIKAT. **Qaror kerak:**
   ikkalasini birlashtirish (Шартнома tab asosiy, Reestr funksiyasi shunga
   integratsiya qilinadi) — Antigravity/keyingi ishlovchi buni ATTENTIVE tarzda
   loyihalashi kerak (ikki xil ma'lumot manbai — Document Properties JSON vs
   SOZLAMALAR_ШАРТНОМА varag'i — birlashtirilishi kerak).

### 5.3. KENGROQ FUNKSIONAL TALABLAR

9. **Multi-lokalka obyektlarni JAMLAB ko'rsatish** — hozir bitta papkada 14 ta
   alohida lokalka bo'lsa, foydalanuvchi har biriga ALOHIDA kirishga majbur.
   Kerak: bitta "ota" obyekt tanlanganda BARCHA lokalkalar yig'indisi (jamlangan
   daraxt/KPI) bitta oynada ko'rinishi. `_subObyektlar(parent)` (05_Papka.js)
   allaqachon parent→child aniqlashni beradi — `apiHolatOl` ni parent uchun
   chaqirilganda BARCHA subObyektlarning daraxtlarini BIRLASHTIRIB qaytarish
   kerak bo'ladi (murakkab — har bir subObyekt alohida LRV_PLUS fayl, alohida
   `varaq` maydoni bilan; UI'da qaysi qism qaysi lokalkaga tegishli ekanini
   ko'rsatish kerak).
10. **Ierarxiya tabida BARCHA obyektlarni birdan tortish** — hozir bitta-bitta.
    `apiOraliqlarSkan`/РАЗДЕЛЛАР bilan ishlaydigan joy — barcha obyektlar
    ustidan navbat/tsikl bilan ishlaydigan variant kerak (`50_Navbat.js`dagi
    navbat patternidan foydalanish mumkin, chunki bitta so'rovda hammasi 6
    daqiqa timeout'ga tushishi mumkin).
11. **Shaxsiy smeta — F2 import uslubida ishlashi** ("f2 import kabi... chapda
    ish turlari qidiriladi va o'nga tortib tanlanadi, razdellar ham qo'shib
    borish"). Hozirgi shaxsiy smeta UI (bu sessiyada qurilgan, `Panel.html`
    `pane-shsm`) oddiy qidiruv+ro'yxat shaklida — F2 importdagi kabi
    drag-drop/tortib olish + RAZDEL boshqaruvi YO'Q. Qayta dizayn kerak.
12. **Sozlamalarda universal AI API kalit** — foydalanuvchi istagan AI provayder
    (OpenAI/boshqa) kalitini kiritsa, BUTUN tizim (barcha AI chaqiruvlar) o'sha
    provayderdan foydalansin. Hozir `aiCall()` (00_AI_Gateway.js) Groq→Gemini
    zanjiri hardcoded. Kerak: Script Property'da "AI_PROVIDER" tanlovi +
    universal `aiCall` adapter (OpenAI-compatible chat completions formatiga
    ko'plab provayderlar mos keladi — shu formatga moslab yozish eng oson yo'l).

---

## 6. ANTIGRAVITY UCHUN ISH TARTIBI TAVSIYASI

1. `clasp pull` bilan boshla (bu faylda tavsiflangan barcha tuzatishlar
   allaqachon jonli @89'da).
2. Navbat: **5.1-band #1 (F2 import o'ng panel daraxti)** — foydalanuvchi buni
   eng ko'p tilga oladi, ishlab chiqarish uchun eng katta to'siq.
3. Keyin 5.1-band #2-4 (avto-moslashtirish, zamena joylashuvi/resurslar) —
   REAL BROWSER TEST bilan tasdiqlash (F2 fayl import qilib, natijani ko'rish),
   faqat kod o'qib "to'g'ri bo'lishi kerak" deb xulosa qilmaslik — bu funksiyalar
   allaqachon "tuzatilgan" deb hisoblangan, lekin foydalanuvchi amalda hali
   buzuq deb aytmoqda.
4. Har o'zgarishdan keyin: **kamida shu obyekt uchun `[Ишла]` qayta ishlatib**,
   накрутка/DASHBOARD sonlarini QAYTA solishtiring (bu fayldagi 2-bo'lim kabi) —
   raqamlar konsistent ekanini o'zingiz tekshiring, foydalanuvchiga "tuzatdim"
   demasdan oldin.
5. Bo'lim 2.4 (накрутка konseptual savoli) — **KODGA TEGISHDAN OLDIN foydalanuvchidan
   javob so'rang** ((A) yoki (B)). Bu aniq mantiqiy qaror, taxmin qilib
   o'zgartirish yana bir "xato tuzatish" ni keltirib chiqarishi mumkin.

---

*Bog'liq fayllar: `ANTIGRAVITY_UCHUN.md` (qat'iy qoidalar), `Smeta tizimi/CLAUDE.md`
(to'liq texnik tarix, fix #46/#62/#63 bu faylga bevosita bog'liq).*
