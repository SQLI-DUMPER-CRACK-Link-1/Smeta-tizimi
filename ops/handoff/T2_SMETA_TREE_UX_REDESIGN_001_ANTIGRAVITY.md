# T2-SMETA-TREE-UX-REDESIGN-001

**Role:** INDEPENDENT PRODUCT / UX / VISUALIZATION ARCHITECT
**Date:** 2026-09-03
**Status:** READY FOR IMPLEMENTATION REVIEW

Ushbu hujjat Tizim_02 ning Smeta/LRV (Local Resource View) daraxtini noldan, PTO muhandislari uchun professional darajada qayta ishlashga (UX Redesign) qaratilgan. Hujjat arxitektura qonuni (Contract) bo'lib xizmat qiladi.

---

## 1. JORIY HOLAT AUDITI VA NATIJALAR

- **CURRENT_UI:** **FAIL** (Joriy UI juda tartibsiz, ustunlar ko'p, qayerga qarashni bilib bo'lmaydi, kichik ekranda gorizontal scroll professional emas).
- **HIERARCHY:** **FAIL** (RZ/BL/RS kabi ierarxiyalar faqat bo'sh joy (indent) bilan ajratilgan, ko'z bilan tez ilg'ash qiyin).
- **RESPONSIVE_1366:** **FAIL** (1366x768 da muhim raqamlar kesilib qoladi, "hech balo ko'rinmaydi" degan e'tiroz yuzaga keladi).
- **COLUMN_ARCHITECTURE:** **FAIL** (Hajm va Summa bir-biriga aralashib ketgan, ustun guruhlari (Header Groups) vizual ajratilmagan).
- **TREE_TABLE_MODEL:** **FAIL** (Daraxt va jadval gibridi to'liq professional emas, ba'zan oddiy ro'yxatga o'xshab qolgan).
- **ADDITIONAL_REPLACEMENT_VISUAL:** **FAIL** (Hozircha tizimda Qo'shimcha/Zamena yozuvlari vizual professional ko'rsatilmagan).
- **WARNING_VISUALIZATION:** **FAIL** (Raqamlar qizarib qolishi bilan kifoyalangan, real warning markazlashgan tizimi yo'q).
- **F2_HISTORY_UX:** **FAIL** (Hozirgi qator ichidagi detalizatsiya (RowDetailPanel) gorizontal juda uzun, 50+ ustunni tiqib yuborish ehtimoli bor).
- **PERFORMANCE_UX:** **FAIL** (React-based rendering minglab qatorlarda to'nkazilib qoladi, virtualizatsiya to'liq barqaror emas).

**TOP_P0_FINDINGS:**
1. Kichik ekranda (1366x768) PTO ishlashining deyarli iloji yo'q.
2. Ierarxiya va qator tiplarini farqlash vizual juda og'ir.
3. Asosiy ustunlar va yordamchi ustunlar orasida aniq chegara yo'q.

**TOP_P1_FINDINGS:**
1. F2 oylik ma'lumotlar juda ko'p joyni egallaydi.
2. Filterlar top-barda emas, tarqoq yoki yo'q.

---

## 2. T1 VS T2 UX MATRIX

| T1 Feature | T1 Strength | T1 Weakness | Current T2 Problem | New T2 UX Requirement | Acceptance Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Smeta Ierarxiyasi** | Ranglar va qalin harflar orqali farq qilingan | Katta hajmlarda tartibsiz | Indentation aniq sezilmaydi, adashib ketish oson | Connector lines, ikonkalari va clear nesting darajasi | User 5 soniyada qaysi RZ, qaysi BL ekanini topa olishi |
| **Guruhlangan Ustunlar** | Yo'q, oddiy jadval | O'qish qiyin | Ustunlar guruhlanmagan | [SMETA], [FAKT], [F2] kabi guruhlangan "Header Group"lar | Guruh sarlavhalari ostida ustunlar mantiqiy turishi |
| **Qo'shimcha/Zamena** | Orqa fon rangi bilan (dop, zamena) | Nomiga yozuv tiqilgan | Vizual belgilanmagan | Nom buzilmaydi, vizual badge/icon orqali ko'rsatiladi | Jadvalda `[QO'SHIMCHA]` yozuvi chiqmasligi (badge bo'lishi) |
| **Kichik Ekran (1366)** | Umuman ishlamaydi | Zoom out qilish majburiy | Scroll tartibsiz | Chap qism (Nom) sticky, gorizontal scroll faqat metrikalarda | 1366x768 da scroll ichida yo'qolmasdan ishlay olishi |
| **Warning / Errors** | Faqat qizil text | Izohi yo'q | Faqat `text-red-400` ishlatilgan | Tooltip bilan aniq vizual warning (Narx/Ostatka) | Warning ustiga borganda qoidabuzarlik ko'rinishi |
| **F2 Tarixi** | Excel formati | O'ta ko'p ustun | Drawer/Panel juda egallab oladi | Default holatda yashirin, "Expand" orqali guruh bo'lib ochilishi | Default ko'rinishda 50+ ustun yuklanmasligi |

---

## 3. ASOSIY PRODUCT LAW VA IDEAL HIERARCHY

Bu interfeys bitta working control surface bo'lishi shart. User bir qarashda hamma holatni tushunishi kerak.

**Hierarchy Rendering:**
- **RZ (Razdel):** Qalin shrift, to'q fon, chapda papka (Folder) ikonka.
- **BL (Ish / Base Line):** Normal qalinlik, chapda ish ikonka (masalan, kran/bolg'a).
- **RS / MAT / OB (Resurslar):** Ochiqroq shrift, connector chiziq (L-chiziq) orqali ota ishga (BL) bog'langan.
- Ota qatorda child qatorlar soni (Badge) ko'rinishi.
- Color-blind friendly: Ranglardan tashqari shakl va ikonka ham farq qilsin.

**Tree-Table Hybrid:**
Chap tomon (Nom, Kod) qotirilgan (Sticky). O'ng tomon ma'lumotlari guruhlarga ajratilgan holda skroll qilinadi.

---

## 4. RESPONSIVE ACCEPTANCE (P0: 1366x768)

- **1366×768 (P0 target):** Jadval chapidagi NOMI va KODI ustunlari doim qotirilgan (sticky left). O'ngdagi ustunlar orasida "Responsive Priority" o'rnatiladi. Eng muhim (Hajm, Fakt, Qoldiq) doim ko'rinadi. Oylik/qo'shimcha ustunlar yashirinib, gorizontal scroll orqali o'tiladi.
- **1536×864:** Qulay ish tartibi, 70% ustunlar ekranda sig'adi.
- **1920×1080:** To'liq analitik ko'rinish (hamma ustun bitta ekranda ochiq).

### Compact vs Comfort Mode
- **COMFORT:** 40px row height, aniq badge'lar, ochiq padding.
- **COMPACT:** 28px row height, minimal padding, PTO operatori tezkor ishlashi uchun. User preference browser localStorage'da saqlanadi.

---

## 5. WIREFRAME-LEVEL DESCRIPTION

**1. TOP BAR & FILTER BAR (Tepadagi boshqaruv bloki)**
- Chapda "Kompaniya / Obyekt / Smeta" breadcrumb.
- O'ngda Mode (Compact/Comfort) va ustunlarni yoqish/o'chirish tugmasi.
- O'rtada Chips/Toggel: "Muammoli", "Faqat BL", "Faqat Material", "F2 Olish Mumkin".
- Qidiruv (Search Input) -> Kod, Nom bo'yicha filter.

**2. TREE HEADER (Ustun Sarlavhalari)**
- **Sticky Top.**
- **Grouped Headers:** 
  - `[ ISH MA'LUMOTI ]`: Kod, Nom, Birlik (Sticky Left).
  - `[ SMETA ]`: Hajm, Narx, Summa.
  - `[ FAKT (M.B) ]`: Hajm, Summa.
  - `[ F2 (IJRO) ]`: Jami, Mumkin, Joriy.
  - `[ NAZORAT ]`: Ostatka, Status.

**3. STICKY LEFT & SCROLLABLE METRICS (Jadval Tana qismi)**
- Chapdagi 2-3 ustun scroll bo'lmaydi.
- O'ng qism scrollable. Connector chiziqlar faqat chap ustunda ko'rinadi.

**4. ROW (Qator)**
- Expand/Collapse ikonka chap eng chekkada.
- Qo'shimcha ish bo'lsa: Kichik `[+]` yashil badge chap tomonda (nomning ichida emas!).
- Zamena bo'lsa: Kichik `[↔]` ko'k badge.
- Warning bo'lsa: O'ng tomondagi "Status" ustunida 🔴/🟠 ikonkalar (Ustiga borganda Tooltip chiqadi).

**5. DETAIL DRAWER (Yon tomondagi oyna)**
- Qator ustiga bosilganda o'ng tomondan Drawer ochiladi.
- Drawer ichida: F2 History (oyliklar), Price Analysis, Zamena asosi (Source), Warning detallari yoziladi.
- Jadval tana qismi toza qoladi, 50 ta oy jadvalga tiqilmaydi.

**6. BOTTOM STATUS (Pastki panel)**
- "Tanlangan qatorlar soni", "Ekranda jami summa", "Jami F2".

---

## 6. CLAUDE MUST IMPLEMENT

1. Jadvalni **Virtuoso** yoki React Table + Virtualization orqali qayta yozish (Performans uchun).
2. **Sticky Header** va **Sticky Left Column (Kod, Nom)** realizatsiyasi.
3. Oylik F2 ma'lumotlarini qator ichidagi detal panelga (Drawer) olib chiqish.
4. **Header Groups** (`[SMETA]`, `[FAKT]`, `[F2]`) qo'shish.
5. Mode Selector (Compact / Comfort) yaratish.
6. Connector lines (ierarxiya chiziqlari) va iconkalar (Folder, Hammer kabi) qo'shish.
7. Qo'shimcha/Zamena uchun nomda matn (text) emas, alohida Badge komponentlarini ishlatish.

---

## 7. CODEX MUST AUDIT

1. **Responsive Test:** 1366x768 rezolyutsiyada gorizontal skroll ishlayotgani va chap ustunlar qotirilganligini tekshirish.
2. **Performance Oracle:** 10 000 (10k) qatorli fixture orqali scroll 60FPS ishlayotganini o'lchash. "Expand All" brauzerni qotirib qo'ymasligini tekshirish.
3. **Hierarchy Accuracy:** Nested qatorlarning tartibi va indentatsiyasi buzilmasligini vizual tasdiqlash.
4. **Regression:** Eski ma'lumotlarni o'qiganda qator yo'qolib qolmasligi.
5. **Zoom Limit:** Browser 125% zoom holatida interfeys buzilmasligini tekshirish.

---

**CLAUDE_IMPLEMENTATION_SCOPE:**
- `SmetaTree.tsx` ni to'liq qayta arxitektura qilish (Virtual Table).
- Drawer Component (Row Details) qo'shish.
- Filter Bar va Quick Chips UI yaratish.

**READY_FOR_IMPLEMENTATION_REVIEW: YES**
