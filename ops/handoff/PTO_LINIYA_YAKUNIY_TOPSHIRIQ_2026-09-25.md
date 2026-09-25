# PTO LINIYASINI YAKUNLASH — server Claude agenti uchun topshiriq (2026-09-25)

> Buyurtmachi (mahsulot egasi): **"PTO liniyasi to'liq bo'lsin. Hamma hujjat maksimal va ideal
> aniq, HUJJAT kabi bo'lishi kerak — chernovik emas."**
> Ushbu fayl — to'liq topshiriq. Uni boshidan oxirigacha o'qing, keyin ishlang.
> Barcha izoh, commit xabari va hisobot — **o'zbek tilida**. Hujjatlarning o'zi (Excel
> chiqishlari) — **rus tilida**, qurilish hujjatlari atamalari bilan.

---

## 0. Siz kimsiz va qayerda ishlaysiz

- Repo: `SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi` (GitHub). Asos: `origin/main` @ `c74bbaa`
  (yoki undan yangi — boshlashda `git fetch` qiling va BASE SHA ni yozib qo'ying).
- Stek: React 19 + Vite + TypeScript (`frontend/`), Cloudflare Pages Functions gateway
  (`frontend/functions/api/*`, `/api/sb`), Supabase Postgres (loyiha `tuoyrzadkgoltpqkdiyx`),
  vitest (jsdom), oxlint. Prod: `https://smeta-tizimi.pages.dev`.
- Sizda **yo'q**: egasining kompyuteri, real smeta fayllari, Microsoft Excel, egasining
  brauzer sessiyasi/paroli. Shuning uchun real fayl yoki jonli login talab qiladigan
  tekshiruvlarni **UNKNOWN (egasi tekshiradi)** deb belgilaysiz — soxta PASS YOZILMAYDI.
- Excel o'rniga: LibreOffice headless (`soffice --headless --convert-to pdf|png`) bilan
  formulalarni qayta hisoblash va sahifani rasmga chiqarib **ko'z bilan tekshirish**. Muhitda
  bo'lmasa o'rnatishga harakat qiling (`apt-get install -y libreoffice-calc`); bo'lmasa —
  UNKNOWN deb yozing.

## 1. Boot protokoli (majburiy, ish boshlanishidan oldin)

1. `AGENTS.md` → `docs/governance/CONSTITUTION.md` → `docs/governance/CURRENT_STATE.md` (eng
   oxirgi addendum) → `ops/ACTIVE_TASKS.json`.
2. `docs/architecture/SMETA_ANATOMIYA_V1.md`, `docs/architecture/SMETA_F2_NAKOPITELNIY_CHANGE_CONTROL_V1.md`,
   `docs/architecture/UZ_CONSTRUCTION_DOCUMENT_CATALOG_AND_TEMPLATES_V1.md`,
   `ops/handoff/SMETA_ANATOMIYA_IKKI_QISM_2026-09-25.md`,
   `ops/handoff/T2_PTO_DAILY_WORKFLOW_CLOSURE_007.md` (DIQQAT: bu 2026-09-05 dagi audit,
   ko'p qismi eskirgan — §2 dagi joriy holat ustun).
3. `ops/ACTIVE_TASKS.json` ga o'z vazifangizni yozing: `PTO-LINIYA-YAKUN-001`, owner `claude`
   (server), branch `claude/pto-liniya-yakun-v1`, `owns` — aniq fayl yo'llari. `SMETA-ANAT-001`
   va `SMETA-ANAT-002-A` egaligidagi fayllarni ular `merged` qilinmaguncha o'zgartirish
   kerak bo'lsa — o'sha yozuvlarning `owns` ro'yxatidan fayllarni o'zingizga **ochiq ko'chiring**
   va `_izoh` ga sababini yozing (egasi 2026-09-25 da ishni bitta agentga berdi).
4. `node ops/governance-check.cjs` → PASS bo'lishi shart.

## 2. Joriy holat (2026-09-25, tekshirilgan)

**Tayyor va prodda (main):**
- `frontend/src/lib/smeta-anatomiya/` — yagona smeta o'qish moduli: varaq roli
  (lrv/res/svod/transport/erkin/bosh), ustun xaritasi (`sarlavhaBlokiniTop`, 1|2|3 qatori
  chegarasi), ichma-ich RZ yo'li (СМЕТА№ > РАЗДЕЛ > blok), titul, svod orqali obyekt,
  erkin varaqlar. Smeta importi (`SmetaYuklaNative`) uni tenglik qo'riqchisi bilan ishlatadi.
- Marshrutlar native: `/admin/holat/:id` (HolatNative), `/admin/fakt` (FaktNative),
  `/admin/f2` (F2ImportNative), `/admin/f2-tayyorlash` (F2TayyorlashNative),
  `/admin/nakopitelniy` (NakopitelniyVedomost), `/admin/f2-tarix`, `/admin/smeta-narxlash`
  (SmetaNarxlashResNative), `/admin/oferta` (OfertaNative), `/admin/hujjat-nazorat`.
- RES → bir nechta LRV (checkbox), Ostatka Excel (`lib/ostatka-export.ts`), LRV+ eksport
  (`$` siz formulalar, ish qatorida birlik narxi), Fakt qisman yangilash (`useT2Daraxt`),
  read-model tezlik kontrakti (`supabase/tests/t2_obyekt_read_model_tezlik_contract.sql`),
  gateway 3 s tezlik byudjeti (`sb_sekin_oqish` log).
- **Tender Oferta (V3) — hujjat standartining NAMUNASI** (`lib/tender-oferta*.ts`,
  `OfertaNative.tsx`): asl faylni surgical OOXML patch; oferta bloki asl jadval (СУММА)
  dan keyin D/E/F davomi sifatida, asl uslub klonlanadi, raqamlash davom etadi, birlashmalar
  cho'ziladi, print area/masshtab/qo'lda `colBreaks` moslanadi; yashirin КАТЕГОРИЯ ustuni;
  podval (склад/транспорт/ВСЕГО) asl formula ko'chirish yoki kategoriya bo'yicha SUMIFS;
  ЗАКАЗЧИК/ПОДРЯДЧИК imzo bloki; OFERTA_JAMI — egasining uslublarida ruscha svod;
  material (nom+birlik) bir marta narxlanadi; yashirin varaqlar sukut bo'yicha tanlanmaydi;
  tender paketi (ko'p fayl/papka → ZIP + paket svodi).

**Hali GAS'da yoki chala:** `/admin/narxlar` (Narxlar.tsx — `gas()` chaqiruvlari bor),
`/admin/fakturalar`; Additional/Replacement UI (migratsiya fayli bor:
`supabase/migrations/20260924120000_t2_additional_replacement_v1.sql` — prodda qo'llanganmi,
TEKSHIRING); Nakopitelniy Forma-3 yuridik jami (`FORMA3_RULE_UNRESOLVED`); F2 fayllari
R2 ga saqlanishi; Sheets ko'prigi (egasi aktivatsiyasini kutmoqda).

## 3. O'zgarmas qonunlar

1. **NULL ≠ 0.** Noma'lum qiymat hech qachon 0 ga aylantirilmaydi; noma'lum pul → REVIEW,
   yakuniy summa bo'sh qoladi. Aniq yozilgan 0 esa — ma'lum 0 (masalan smeta narxi 0).
2. **Manba qiymati va matni o'zgarmaydi.** Asl katakka (qiymat, formula, matn) tegilmaydi.
   Egasining yordamchi yozuvlari (masalan G–I ustunlaridagi `=E105*2/1000`) — muqaddas.
3. **UI == Excel.** Saytda ko'rsatilgan har bir son eksportdagi formula natijasiga teng
   (keshlangan `<v>` ham yoziladi, `fullCalcOnLoad=1`). Buni testda isbotlang.
4. **Formulalarda `$` yo'q** (iloji boricha; egasining mavjud defined name'lari bundan mustasno).
5. **Rang o'ylab topilmaydi.** styles.xml ga yangi `fill` qo'shilmaydi; yangi katak uslubi
   asl qo'shni/mos ustun katagidan klonlanadi. Yangi svod varaqlari egasining mavjud xf
   uslublaridan foydalanadi.
6. **`t2_rollup` rekursiv qilinmaydi**; obyekt jamilari (`t2_obyekt_jami`, `t2_ai_umumiy`,
   `t2_ai_kontekst`, `t2_mindmap_grafi`) barcha RZ ni qo'shadi — ularga tegmang.
7. **Mashinist mehnati** (ЗАТРАТЫ ТРУДА МАШИНИСТОВ) narxsiz — hech qachon "narxsiz" deb
   ogohlantirilmaydi (u МАШ-Ч stavkasi ichida).
8. **Production migratsiya, destruktiv DDL, real biznes ma'lumotiga yozish — FAQAT egasining
   alohida ruxsati bilan.** Parol/cookie so'ralmaydi, kiritilmaydi. Real smeta fayllari
   repoga qo'yilmaydi (repo ochiq). Test fixture'lari sintetik bo'ladi.
9. Main push + Cloudflare deploy ga egasining **umumiy ruxsati bor** — faqat barcha
   gate'lar yashil bo'lsa (§7).

## 4. HUJJAT STANDARTI — "hujjat, chernovik emas" (har bir eksport shunga javob beradi)

Har bir PTO chiqishi (LRV+, Ostatka, Forma-2/F2 akt, Nakopitelniy vedomost, Resurs vedomosti,
Oferta, paket svodi, PTO hujjat eksporti) quyidagilarning **hammasini** bajaradi:

| # | Talab | Qanday tekshiriladi |
|---|---|---|
| H1 | Asl hujjat asosida bo'lsa — asl fayl saqlanadi, yangi qism asl jadvalning DAVOMI (asl ustunlar formasida, uslub klon, raqamlash davom etadi, sarlavha/bo'lim birlashmalari cho'ziladi) | test: asl `<c>` lar bayt-bayt; yangi katak `s` = mos asl ustun `s` |
| H2 | Noldan yasalgan hujjat — rasmiy shakl: titul (obyekt, buyurtmachi, pudratchi, davr/sana), sarlavha qatori + 1-2-3 raqamlash qatori, ramkali jadval, ИТОГО/ВСЕГО qalin, son formati `# ##0` / `# ##0,00` | LibreOffice PNG ko'rinishi |
| H3 | Imzo bloki: ЗАКАЗЧИК / ПОДРЯДЧИК (va hujjat turiga qarab СОСТАВИЛ / ПРОВЕРИЛ / ТЕХНАДЗОР), nom saytdan, bo'sh bo'lsa chiziq, "(подпись)" va "М.П." | test: matn mavjud; PNG |
| H4 | Chop etish: print area butun hujjat + imzo; bitta sahifa eniga sig'adi (masshtab yoki fitToWidth); sarlavha qatori har sahifada takrorlanadi (Print_Titles); A4 | test: definedName/pageSetup; PDF sahifa soni/eni |
| H5 | Texnik/dasturchi matni YO'Q: "TAYYOR", "RESOURCE", RPC/funksiya nomlari, inglizcha yorliqlar, "sayt ko'rsatgan" kabi qatorlar hujjatga chiqmaydi. Texnik ustun kerak bo'lsa — yashirin | test: taqiqlangan so'zlar ro'yxati bo'yicha grep = 0 |
| H6 | Formulalar tirik va nisbiy (`$` siz), keshlangan qiymat bilan; UI == Excel (farq 0) | test + LibreOffice recalculation farqi 0 |
| H7 | Noma'lum/hal qilinmagan joylar hujjatda ochiq ko'rinadi ("ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ" ro'yxati), yakuniy summa bo'sh — taxmin yo'q | test |
| H8 | Fayl nomi ma'noli: `<Obyekt>_<Hujjat>_<davr>.xlsx`, `.xls` manba bo'lsa `saqlanish: qisman` halol ko'rsatiladi | test |
| H9 | Rus tilidagi hujjat atamalari (СМЕТА, ИТОГО, ВСЕГО С НДС, ВЕДОМОСТЬ, АКТ …); o'zbekcha faqat egasining o'z matni bo'lsa | ko'rib chiqish |

**Qilish kerak:** `tender-oferta-export.ts` dagi umumiy qismlarni (varaq xaritasi,
`boshUstun`, `varaqniPatchla`, `colsYoz`, print area/masshtab/colBreaks, imzo, uslub
namunasi, `xfNusxa`, `formulaKochir`) **`frontend/src/lib/hujjat-yozuvchi/`** moduliga
ajrating (`hujjat-yozuvchi/index.ts` orqali eksport), Oferta uni ishlatsin (xatti-harakat
o'zgarmasin — mavjud Oferta testlari yashil qolsin), keyin qolgan barcha eksportlarni shu
modulga o'tkazing.

## 5. Ish paketlari (tartib bo'yicha; har biri alohida commit, har birining qabul mezoni bor)

### P1. `hujjat-yozuvchi` moduli + barcha PTO eksportlarini hujjat standartiga keltirish
Fayllar: `lib/lrv-plus-export.ts`, `lib/ostatka-export.ts`, `lib/f2-native-export.ts`,
`lib/f2-akt-tn-export.ts`, `lib/nakopitelniy-vedomost-export.ts`, `lib/pto-hujjat-export.ts`,
resurs vedomosti eksporti (`T2-PTO-CLOSURE-007-CLAUDE-RESURS-VEDOMOST` natijasi),
`lib/tender-oferta-paket.ts` (paket svodi).
Qabul: har bir eksport uchun H1–H9 bo'yicha test fayli (`*.hujjat.test.ts`) + LibreOffice
PNG (repo ichida emas — hisobotga tavsif); mavjud testlar yashil.

### P2. Ostatka — to'liq smeta shaklidagi hujjat
Kanonik daraxt (ichma-ich RZ) → smeta formasidagi hujjat: har barg `ostatka = hajm − fakt`,
RZ yo'li va sarlavhalari saqlanadi, ish qatorida birlik narxi, summa formulasi, RZ bo'yicha
ИТОГО, oshib ketgan (fakt > hajm) qatorlar alohida ro'yxatda, noma'lum fakt — REVIEW.
H1–H9. `HolatNative` dagi "Ostatka Excel" tugmasi shu yangi hujjatni beradi.

### P3. Forma-2 (F2) va Nakopitelniy — hujjat standarti + ochiq qoidalar
- F2 akt (`F2TayyorlashNative`, `f2-native-export`, `f2-akt-tn-export`): davr, shartnoma,
  obyekt, bajarilgan ishlar jadvali, НДС, ВСЕГО, imzolar (ЗАКАЗЧИК, ПОДРЯДЧИК, ТЕХНАДЗОР).
- Nakopitelniy vedomost: davrlar kesimida jamg'arma, asl smeta formasida davom.
- `FORMA3_RULE_UNRESOLVED` — **egasining qarori kerak**: variantlarni (qaysi jami yuridik,
  qaysi formula) `ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md` ga aniq misol bilan yozing;
  kodda to'xtatib turing, soxta jami chiqarmang.

### P4. Oferta — qolgan ishlar
1. `tender-oferta-parser.ts` ni `smeta-anatomiya` (`kitobAnatomiyasi`) ustiga o'tkazish:
   varaq roli, ustunlar, vedomost, jamilar anatomiyadan; Oferta faqat kategoriya/narx/kaskad.
   Real-shaklli sintetik fixture'larda natija o'zgarmasligini (golden) isbotlang.
2. Podval foizi **qatorning istalgan katagida** bo'lishi mumkin (nom katagida emas —
   Pomoshnik PTO saboqi): C/D/E kataklaridagi `0,05`/`5%`/`1,12` (НДС) ni o'qing.
3. Koeffitsientlarni fayldan aniqlash: podval yozuvlaridan (транспорт 5%, склад 2%,
   М/К 0,75%, кабель 1,5%, ОБ 1,2%/2%) — barcha varaqlarda bir xil bo'lsa UI da
   "Fayldagi foizlar: … [Qo'llash]" taklifi (avtomatik qo'llanmaydi).
4. "Smeta narxi har xil" (NARX_HAR_XIL) guruhlari uchun UI: qaysi varaqda qaysi narx —
   ochiladigan tafsilot, bitta narxni tanlash tugmasi.
5. Paket: 2+ obyektli sintetik paket bilan end-to-end test (ZIP ichida har obyekt + svod,
   svod jami = obyektlar yig'indisi, imzolar, H1–H9).
6. Excel/real fayl tekshiruvi — UNKNOWN (egasi office PC da tekshiradi); hisobotda aniq
   qaysi fayllar bilan tekshirish kerakligini yozing.

### P5. Yagona yuklash liniyasi (smeta)
Bitta fayl / ko'p fayl / papka → bitta oqim: `Fayl[]` → anatomiya → bitta tekshiruv ekrani
(RZ ierarxiyasi, varaq rollari, RES↔LRV bog'lash checkbox'lari, ogohlantirishlar) → bitta
server buyrug'i. O'qish **Web Worker** da (asosiy oqim qotmaydi — 27 000 qatorli smetada
UI javob beradi). Uchta eski UI olib tashlanadi. Qabul: vitest (worker mock), UI testlari,
27k qatorli sintetik fayl bilan o'qish vaqti o'lchovi.

### P6. Anatomiyaga ko'chirish + lint qoidasi
F2 import (`f2-import-parse`), RES narxlash (`SmetaNarxlashResNative`), Nakopitelniy,
Oferta parseri — smetani faqat `smeta-anatomiya` orqali o'qiydi. `.oxlintrc.json` ga qoida:
`smeta-anatomiya/` va `f2-import-parse/xlsxReader.ts` dan tashqarida `xlsx`/`sheet_to_json`
ni yangi joyda import qilish taqiqlanadi (mavjud ruxsat etilganlar ro'yxati bilan).

### P7. Katta obyekt tezligi
Maqsad: 27 000 qatorli obyektning birinchi ochilishi < 4 s. `sbT2DaraxtOl`/`sbT2QatorHolatOl`
ga faqat kerakli ustunlar (barcha iste'molchilarni grep bilan tekshirib), payload hajmi va
vaqt oldin/keyin o'lchovi (test yoki log). Gateway `MAX_SORO`/sahifa mantig'iga tegmang.

### P8. Profillar va korpus manifesti
`frontend/scripts/korpus/`: manifest (sha256, format ABC4/TN/o'z, kutilgan barg soni, RZ
chuqurligi, vedomost soni) — real fayllar repoda emas, `KORPUS_DIR` bo'lsa korpus testlari
yuradi. Format profillari (ustun joylashuvi, sarlavha naqshlari) anatomiya ichida o'rganiladi
va `profil` sifatida saqlanadi.

### P9. PTO-007 dan qolgan kanonik bo'shliqlar
1. `/admin/narxlar` — GAS'dan Supabase-native'ga (feature flag bilan; eski yo'l flag ortida
   qoladi, egasi solishtirgach o'chiriladi).
2. Price Control kanonik LRV da (`HolatNative` → `priceControlLines` haqiqiy ma'lumot bilan).
3. Additional/Replacement: migratsiya prodda qo'llanganini tekshiring (`list_migrations` yoki
   `supabase_migrations`); qo'llangan bo'lsa — UI (LRV qatoridan "Qo'shimcha ish"/"Zamena")
   + `sb-yoz.ts` whitelist + testlar; qo'llanmagan bo'lsa — egasidan ruxsat so'rang
   (P3 dagi qarorlar fayliga yozing), o'zingiz qo'llamang.
4. F2 fayllari R2 ga (fayl haqiqati) — mavjud storage poydevori (`STOR-001`) ustida.
5. Sheets ko'prigi — egasining aktivatsiyasini kutadi; faqat holatini hisobotda yozing.

### P10. Hujjatlashtirish va yakun
- `docs/architecture/HUJJAT_STANDARTI_V1.md` — §4 standarti, `hujjat-yozuvchi` API, har bir
  hujjat turining shakli (ustunlar, imzolar, chop sozlamasi).
- `docs/governance/CURRENT_STATE.md` — yangi addendum (append-only), main SHA.
- `ops/ACTIVE_TASKS.json` — o'z vazifangiz holati, tugagan lane'lar `merged`.
- `ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md` — egasi hal qilishi kerak bo'lgan savollar.

## 6. Egasining qarori kutilayotgan masalalar (o'zingiz HAL QILMANG — faylga yozing)

1. `t2_qator_holat` ga anon SELECT grant bor va view `security_invoker` emas — yopish tavsiya.
2. `/api/agent/call` (Hermes) marshruti — Hermes ishlatilmaydi; olib tashlashni tasdiqlash.
3. "Suniy Ko'l" (obyekt 84) — eski import 2 413 vedomost qatorini ish sifatida ikki marta
   kiritgan; qayta import kerak ("Suniy Ko'l 2" = 91 to'g'ri: 24 324 barg).
4. ТЕПЛОТРАССА 02-04/02-05 — svod bilan −1,70 чел-ч farq.
5. Faravon РАЗМЕТКА joylashuvi; TN va ABC4 ishorasi farqi.
6. Nakopitelniy Forma-3 yuridik jami qoidasi.
7. Additional/Replacement migratsiyasini prodga qo'llash (agar qo'llanmagan bo'lsa).
8. Narxlar GAS→native o'tkazish strategiyasi (flag bilan bosqichma-bosqich tavsiya).

## 7. Gate'lar (hammasi yashil bo'lmasa main ga YO'Q)

```
cd frontend
npx tsc -b
npx tsc -p tsconfig.functions.json --noEmit
npx oxlint            # 0 error
npm run tekshir
npm run build
npx vitest run        # to'liq; og'ir xlsx testlari yuklama ostida 20 s dan oshsa — testni tezlashtiring, timeout'ni ko'r-ko'rona oshirmang
cd .. && node ops/governance-check.cjs && git diff --check
```

Deploy: `git push origin HEAD:main` (fast-forward) → GitHub check-runs'da Cloudflare
`completed success` → `curl https://smeta-tizimi.pages.dev/api/soglik` `ok:true`.

## 8. Bugungi saboqlar (qayta takrorlamang)

- Asl varaqda G–I ustunlarida faqat formatlangan bo'sh kataklar bo'lishi mumkin — ular
  "band" emas; lekin qiymatli yozuv bo'lsa — unga tegilmaydi, blok undan keyin.
- Egasining qo'lda `colBreaks` (jadval oxirida) — maqsad "jadval shu yerda tugaydi":
  yangi blok oxiriga ko'chiriladi. Print area va `scale` mutanosib moslanadi.
- Podval formulasidagi koeffitsient katagi (`=F237*E238`, E238 = 0,05) asl joyida qoladi —
  faqat summa ustuni havolasi ko'chadi. Shared/array formulalar ko'chirilmaydi.
- Asl'da qo'lda 0 bo'lgan склад/кабель qatorlari — kategoriya bo'yicha hisoblanadi
  (egasi qarori 2026-09-25): (МАТ+КАБ)×2% + М/К×0,75% + ОБ×1,2%; kabel КАБ×1,5%; transport
  (МАТ+М/К+БЕЗСКЛАД)×5% + ОБ×2%; yozuvdagi foiz koeffitsientdan ustun.
- Excel yashirin varaqlari (`state="hidden"`) — eski davr qoralamalari; sukut tanlovga kirmaydi.
- Bir xil material turli varaqlarda — bitta narx (asosiy = eng ko'p uchragan smeta narxi),
  farq ogohlantirish. Kalit: NBSP/qator ko'chishi/Ё→Е/`. , ; : -` bo'shliqqa.
- Smeta narxi aniq 0 → taklif 0 (ogohlantirish), bo'sh (NULL) → hal qilinmagan.
- Heredoc/shell qochirish xatolaridan qochish uchun kod o'zgarishlarini Edit/Write bilan qiling.

## 9. Yakuniy hisobot formati (o'zbek tilida)

```
BASE SHA / FINAL SHA / DEPLOYED SHA
Gate'lar: tsc … PASS | functions … | oxlint … | tekshir … | build … | vitest N passed | governance … | diff-check …
Deploy: Cloudflare check … | /api/soglik …
P1 … P10: har biri PASS / FAIL / UNKNOWN — dalil (test fayli, commit, o'lchov raqami)
Hujjat standarti (H1–H9) — har bir hujjat turi bo'yicha jadval
Egasi tekshirishi kerak (real fayl / Excel / jonli login): aniq qadamlar ro'yxati
Egasi qarorlari: ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md havolasi
```

Hech narsani "tayyor" demang, agar uni test yoki o'lchov bilan isbotlamagan bo'lsangiz.
