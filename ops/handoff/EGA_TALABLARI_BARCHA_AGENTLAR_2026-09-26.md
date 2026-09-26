# EGA TALABLARI — barcha agentlar uchun yagona topshiriq (2026-09-26)

> Bu hujjat egasining (PTO/obyekt egasi) shu kungacha aytgan BARCHA talablarini bir joyga
> yig'adi. Istalgan agent (server Claude, Codex, noutbuk Claude, boshqa) ishni shu yerdan
> boshlaydi. Avval `AGENTS.md` → Constitution → `ops/CURRENT_STATE*` → `ops/ACTIVE_TASKS.json`
> ni o'qing, keyin shu hujjatni. Ziddiyat bo'lsa — egasining shu yerdagi so'zi ustun, lekin
> Constitution'dagi xavfsizlik va tasdiq qoidalari buzilmaydi.

---

## 0. Ish tartibi (hamma agentga majburiy)

1. **Til.** Egasi bilan barcha yozishma, izoh, hisobot — **o'zbek tilida**. Hujjatlar
   (Excel/PDF/print chiqishlari) — **rus tilida**, O'zbekiston qurilish hujjatlari shaklida.
2. **Hujjat sifati.** Har bir chiqish "HUJJAT, CHERNOVIK EMAS": asl shablon uslubi (shrift,
   chegaralar, birlashgan kataklar, raqam formati, print maydoni, masshtab, sahifa bo'linishi),
   sarlavha, imzo joylari (Заказчик / Подрядчик — lavozim, F.I.O., imzo, sana), jami qatorlar.
   Formulalar ishlaydigan, `$` siz (egasi talabi), `#REF!` yo'q. "Ideal va aniq" — egasining so'zi.
3. **Boshqa agent ishini yo'qotmaslik.** Hech qachon `git push --force` yo'q. Push'dan oldin
   `git fetch` + `git rebase origin/main` (yoki merge), keyin push. Server agenti va noutbuk
   agenti bir vaqtda `main` ga yozadi — deploy'dan keyin ikkala tomon commit'lari tarixda
   borligini `git merge-base --is-ancestor` bilan tekshiring. Birovning faylini "tozalash"
   uchun o'chirmang; `ops/ACTIVE_TASKS.json` dagi `owns` ro'yxatiga qarang.
4. **Main + deploy ruxsati (doimiy).** Gate'lar yashil bo'lsa `main` ga push va Cloudflare
   deploy egasidan so'ramasdan qilinadi. Gate'lar:
   `npx tsc -b` · `npx tsc -p tsconfig.functions.json --noEmit` · `npx oxlint src` (0 error) ·
   `npm run tekshir` · `npm run build` · `npx vitest run` · `node ops/governance-check.cjs` ·
   `git diff --check`. Deploy'dan keyin: GitHub check-run "Cloudflare Pages" = `completed success`
   va `https://smeta-tizimi.pages.dev/api/soglik` → `ok:true`.
5. **Alohida tasdiq kerak:** production migratsiya, destruktiv DDL, RLS/auth o'zgarishi,
   ma'lumot o'chirish — faqat egasining aniq "ha" sidan keyin.
6. **Parol/kalit.** Egasi chatda login bergan bo'lsa ham agent hech qachon parol yozmaydi,
   saqlamaydi, qayta ishlatmaydi — egasi o'zi brauzerda kiradi.
7. **Tugadi mezoni.** "Tugadi" = kod + test + gate'lar + deploy + haqiqiy fayl/ma'lumot bilan
   sinov. Haqiqiy sinov qilinmagan bo'lsa — hisobotda ochiq ayting.
8. **Hisobot.** Oxirida o'zbekcha qisqa hisobot: nima qilindi, qaysi commit, deploy holati,
   nima qolgan, egasidan qaysi qaror kerak. `ops/ACTIVE_TASKS.json` va `ops/CURRENT_STATE*`
   yangilanadi.
9. **Excel makroslari (VBA).** Egasi bergan `VBA EXCEL.xlsm`, `Pomoshnik_PTO_*.bas` —
   **faqat foydali mantiq olinadi**, fayllar ta'mirlanmaydi.

---

## 1. Tender OFERTA (asosan bajarilgan — saqlash va takomillashtirish)

Kod: `frontend/src/lib/tender-oferta*.ts`, `OfertaNative.tsx`, `res-kategoriya.ts`,
`tender-oferta-paket.ts`. Testlar: `tender-oferta-v3.test.ts`.

- Egasining RES fayli ustiga **jarrohlik** bilan yoziladi (OOXML patch): oferta ustunlari asl
  СУММА ustunidan keyin (yoki egasining G–I izohlaridan keyin); qiymatli katak hech qachon
  ustidan yozilmaydi; uslub asl kataklardan klonlanadi; raqamlash 7-8-9; merge'lar kengayadi;
  print area / scale / colBreaks siljiydi.
- Formulalarda **`$` yo'q**.
- **Mashinist** (ЗАТРАТЫ ТРУДА МАШИНИСТОВ) hech qachon "narxsiz" deb belgilanmaydi — uning
  narxi bo'lmaydi, bu normal.
- Bitta material ko'p RES varag'ida bo'lsa — **BITTA narx**, panelda **bir marta** ko'rinadi
  ("40 ta varaqda voda bo'lsa 40 marta narx yozmayman").
- Har RES varag'i oxirida **Заказчик va Подрядчик imzo bloki** (lavozim, F.I.O., imzo, sana).
- **Podval foizlari** har varaq/kategoriya uchun individual: asl faylda formula bo'lsa —
  o'sha formula bizning ustunga ko'chiriladi; formula bo'lmasa — tizim o'zi o'qib tushunadi.
  Asl faylda 0 turgan qatorlar — **foiz bo'yicha hisoblanadi** (egasi qarori). Uskuna bloki
  foizsiz bo'lsa koeffitsiyent, aralash blok — kategoriya foizlari.
- **OFERTA_JAMI** — ruscha svod, egasining uslubida.
- **Tender paketi**: bir nechta obyekt/hujjat bir paketda, svod + ZIP.
- Yashirin varaqlar sukut bo'yicha chiqariladi.

## 2. F2 IMPORT — "maksimal mukammal, maksimal oson, aniq, xatosiz" (ASOSIY ISH)

Egasi: "hozir juda abgor". Avval mantiq: **F2 ↔ smeta/LRV ↔ Nakopitelniy**. Arxitektura:
`docs/architecture/F2_IMPORT_V3.md`. Vazifa: `F2-IMPORT-V3-001` (ACTIVE_TASKS).

### 2.1 Tushunish (qat'iy faktlar)
- F2 paketi: ОБЛОЖКА + СЧЁТ-ФАКТ + akt varag'i (LRV smeta shaklida) → "Итого по ранее
  оформленным Формам №2", "Разница", imzolar. Bir oyda bir smeta bo'yicha bir nechta F2.
- **F2 dagi lokal smeta № smetadagi raqamdan FARQ QILADI — raqam bilan bog'lab bo'lmaydi.**
- F2 dagi ish tartib raqamlari smeta raqamlari emas.
- Zamena/qo'shimcha fayl ichida belgilanmaydi — tizim aniqlaydi, operator tasdiqlaydi.
- `#REF!` (tashqi havola), manfiy hajm (перерасчет), bo'sh hajmli ish (bajarilmagan) bor.
- Real F2 lar: Drive papkasi `10vYz4gmwobnufel_MawNQG_68n-dKcwr`; mahalliy korpus testi
  `smeta-anatomiya/korpus/f2.korpus.test.ts` (`F2_KORPUS_DIR`).
- **Tizim1** importerini o'rganing (`Smeta tizimi/35_F2Moslash.js`, `Panel.html f2Imp*`,
  `37_F2TezYoz`, `38_F2Nazorat`, `39_F2Reestr`) — "xuddi shunaqa yoki undan yaxshi".

### 2.2 Avto-bog'lash — qavatma-qavat moslik
Qavatlar **aynan shu tartibda**, qancha ko'p qavat mos bo'lsa — shuncha mos variant:
1. razdel nomi → 2. ish shifri → 3. ish nomi → 4. birlik (farqli = avto YO'Q, qalqon) →
5. ish resurslari (rs / mat / ob — tarkib, norma, tartib) → 6. **ish hajmi — ENG OXIRGI**.

**Hajm eng oxirgi va jarimasiz** (egasi tuzatishi): F2 ish hajmini ko'pincha qisman oladi,
hajm nomzodni hech qachon yo'qotmasligi kerak — faqat teng nomzodlarni ajratadi. Qoldiqdan
oshish — ball emas, ogohlantirish. Marka farqi (В15↔В25, ПК↔ПБ) → ehtimoliy zamena, avto yo'q.
Resurslar faqat bog'langan ish ichida moslanadi. Kod: `lib/f2-moslash-v3/index.ts`.

### 2.3 Ikki oynali ekran — drag-drop
Chapda F2, o'ngda smeta (smeta hajmi / oldin F2 / shu F2 / qoldiq). **Ikki oyna bir-biriga
ochilganda drag-drop** bilan (Tizim1 semantikasi), shuningdek "tanla → bos" muqobili:
- ish → o'sha ish: resurslari bilan bog'lanadi;
- ish → boshqa ish: so'raladi — Bog'lash / ⇄ Zamena / ＋ Qo'shimcha;
- ish → razdel: qo'shimcha ish (F2 resurslari bilan yaratiladi);
- resurs → resurs: bog'lash yoki ⇄ **zamena material**;
- resurs → smeta ishi: qo'shimcha resurs;
- razdel → razdel: razdel o'rgatiladi, qayta moslanadi.
**Universal**: smetada yo'q ishlar, zamena ishlar, qo'shimcha ishlar, zamena material — hammasi.
Holatlar: ✓ / ◐ taklif (tasdiqlash) / ✕ topilmadi / – aktga kiritilmaydi. Nomzodlar qavat
ballari bilan. "Keyingi hal qilinmagan". Yozish faqat ✕/◐ = 0 bo'lganda.
Holat: F3 bajarildi — `/admin/f2` → `F2ImportV3.tsx` + `F2V3Workbench.tsx` + `ishJoyi.ts`
(commit `b4b4f7a`). Eski ekran `/admin/f2-eski` (zaxira; V3 sinovdan o'tgach olib tashlanadi).

### 2.4 Qolgan F2 ishlari
- **F4 — yozish yo'li oxirigacha:** qoralama `t2_akt_yarat_v2` (ish = hajm, resurs = pul,
  `raw_snapshot.manba='f2_v3'` + imzolar) → **tasdiqlash** `t2_akt_tasdiqlash` → Nakopitelniy.
  Tasdiqlash tugmasi F2 oqimiga ulanmagan — ulash kerak. F2 REESTR: hujjat jami ↔ yozilgan,
  farq 0; oy muhri; bekor qilish (undo).
- **Haqiqiy sinov:** kamida 3 ta real F2 (Водопровод, Озеро, ТРОТУАР — Suniy ko'l obyekti)
  ekrandan to'liq o'tkazilsin: yuklash → bog'lash → saqlash → tasdiqlash → Nakopitelniyda
  ko'rinish. Brauzerda egasi o'zi kiradi.
- Xotira: keyingi oy o'sha F2 imzolari avtomatik ✓ bo'lishini tekshiring.
- "Ранее оформленным" ↔ Nakopitelniy oldingi summa solishtiruvi (ma'lumot sifatida).
- Ko'p tanlab bir vaqtda tortish (Tizim1 multi-select) — ixtiyoriy yaxshilash.
- **F5:** Nakopitelniy va F2 eksportlari — hujjat standartida (§0.2).

## 3. PTO liniyasini tugatish (server agent — davom etmoqda)

To'liq ro'yxat: `ops/handoff/PTO_LINIYA_YAKUNIY_TOPSHIRIQ_2026-09-25.md` (rejalangan, lekin
bitmagan ishlar ham u yerda). Asosiy talab: **hamma hujjat maksimal ideal va aniq, hujjat
kabi, chernovik emas** — Ф-2 akti, Ф-2 loyihasi, Nakopitelniy, Ostatka, Slichitelniy, RES,
oferta; ikki narx (to'g'ri xarajat va к оплате), nakrutka podvali; saytda hujjatdagiday
ko'rish. Egasi qarorlari: `ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md`.

## 4. Egasidan qaror kutilayotgan ochiq masalalar

- `t2_qator_holat` ga anon grant;
- `/api/agent/call`;
- ruflo hook;
- Suniy Ko'l 84 qayta import;
- ТЕПЛОТРАССА −1.70 farqi;
- Озеро F2 hujjatidagi formula xatosi (224 112 178 — 26 va 27-ishlar ИТОГО formulasiga
  kirmagan) — faqat ma'lumot, tizim jim tuzatmaydi.

Bularni o'zingiz hal qilmang — hisobotda egasiga savol sifatida qo'ying.
