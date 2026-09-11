# Topshiriq: Claude → Codex / Hermes (2026-09-11)

Bu hujjat 2026-09-10..11 sessiyasining yakuni. Egasi (Anvar) jonli tizimda
test qilib, ketma-ket haqiqiy xatolar topdi. Bir qismi tuzatildi va `main`ga
push qilindi, bir qismi **ochiq qoldi**. Quyida: nima qilindi, nima qolgan,
va ishni davom ettirish uchun kerak bo'ladigan predmet bilimi.

---

## 0. Muhit faktlari (avval shuni o'qing)

| Nima | Qiymat |
|---|---|
| Ish katalogi | `/home/user/sqli-dumper-crack-link-1/smeta-tizimi` |
| Remote | `https://github.com/SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi.git` |
| Branch | `main` |
| Supabase project id | `tuoyrzadkgoltpqkdiyx` |
| Jonli sayt | `https://smeta-tizimi.pages.dev` |
| Kompaniya (test) | id **17** — NEW TIMES BUILDINGS |
| Loyiha | id **7** — Navoiy bog' |

⚠️ **Diqqat:** bu sessiyaning GitHub MCP tool'lari `sqli-dumper-crack-link-1/
sqli-dumper-10.5-for-windows` deb nomlangan **aldamchi (decoy) repo**ga
ulangan. U bu loyihaga **aloqasi yo'q**. Barcha git amallari to'g'ridan-to'g'ri
`git` buyrug'i bilan, yuqoridagi katalogda bajariladi.

### Tekshiruv buyruqlari

```bash
cd frontend
npx tsc -b          # toza bo'lishi shart
npx vitest run      # 458/458 o'tadi (2026-09-11 holati)
npm run tekshir     # loyihaning o'z gate'i — "✅ Barcha tekshiruvlar o'tdi"
```

`npm run tekshir` ichida `pre_main_release_qa.test.cjs` bor — u migratsiya
ID'lari **noyob va leksikografik tartibda** ekanini tekshiradi. Yangi
migratsiya qo'shganda ID mavjudlaridan **keyin** bo'lsin (oxirgisi
`20261024090000`). Bu sessiyada bir marta shu tuzoqqa tushildi.

---

## 1. Bu sessiyada tuzatilganlar (qayta qilmang)

Commit'lar `400fde6..7caec39` oralig'ida.

| Commit | Nima |
|---|---|
| `52f044f` | LRV eksporti yangi obyektda abadiy `PERIOD_CONTEXT_REQUIRED` bilan bloklanishi |
| `84806ba` | LRV Excel: E/F ustunida obyom ikki marta; Q ustunida `#ЗНАЧ!`; `RESURS_VEDOMOST` varag'i qo'shildi |
| `4b51084` | `Ost.Sum`/`F2 M.Sum` almashib ketgani; PTO scope obyekt bilan sinxron emasligi; RES'da М/К noto'g'ri aniqlanishi |
| `8854512` | Narxsiz qatorlar sababi bilan ro'yxatda; RES varaqlari oldindan ko'rsatiladi; mindmap chiziqlari ortogonal |
| `7c6aa16` | `t2_obyekt_jami.narxsiz` faqat `NULL` sanardi — hech qachon ishlamagan |
| `ccecc53` | Narx birlik bo'yicha topiladi (ЧЕЛ-Ч/МАШ-Ч), nomlar farq qilganda ham |
| `b9e4e0b` | Eksport gate'i uchun regression test |
| `63c3557` | Ustunlar sarlavha so'zi bo'yicha aniqlanadi (ABC4 + TN Qurilish) |
| `e372638` | ОБ ni МАТ dan ajratish: bo'lim nomi + podval foizi |
| `7caec39` | **Birlik eng ustun** — ЧЕЛ-Ч/МАШ-Ч hech qachon МАТ bo'lmaydi |

### Bazaga qo'llanganlar (production)

1. `t2_mindmap_actor_tekshir` — `boss` endi bloklanmaydi (faqat `rahbar`).
   Repoda tuzatish 3 kun turgan, lekin production'ga qo'llanmagan edi.
2. `t2_obyekt_jami` view — `narxsiz` endi `narx IS NULL OR narx = 0` sanaydi.
   Fayl: `supabase/migrations/20261024090000_t2_obyekt_jami_narxsiz_nol.sql`
3. Ma'lumot tuzatildi (kompaniya 17): `t2_resurs_kategoriya`dan 21 ta
   noto'g'ri М/К yozuvi (19 → МАТ, 2 → КАБ); Stella (obyekt 71) smetasida
   38 qator. Obyekt jami o'zgarmadi — bu faqat kategoriya edi.

---

## 2. OCHIQ ISHLAR (asosiy qism)

Muhimlik tartibida.

### 2.1. `БЕЗ СКЛАД` kategoriyasi umuman yo'q — PULGA TA'SIR QILADI

**Holat:** ochiq. Egasidan bitta javob kutilyapti.

Egasining tasdiqlangan F2'sida ustunlar aynan shunday:

```
ЧЕЛ | МАШ | МАТ | ОБ | БЕЗ СКЛАД | М/К | ПРОВОД
```

Nakrutka qatlami `БЕЗСКЛАД`ni **biladi**:
- `supabase/migrations/20261014090000_t2_nakrutka_v1.sql:121`
- `frontend/src/api/t2-nakrutka.ts:39`
- `frontend/src/admin/sahifalar/NakrutkaNative.tsx:142`

Lekin resurs kategoriyalari ro'yxatida **yo'q**:
```ts
// frontend/src/api/supabase.ts:1011
export type T2ResursKategoriya = 'ЧЕЛ' | 'МАШ' | 'МАТ' | 'ОБ' | 'М/К' | 'КАБ';
```

Ya'ni birorta resurs hech qachon `БЕЗСКЛАД` bo'la olmaydi → o'sha ustun doim
nol → **beton, suv kabi inert materiallarga skladskiy rasxod (2%) noto'g'ri
qo'shilyapti**.

Egasining ta'rifi (aynan): *«bez sklad faqat inert materiallarga masalan
beton, suv kabi skladga tiqib bo'lmaydigan narsalarga skladskiy rasxod
berilmagani uchun ajratib olinishi kerak bo'ladi shuning uchun alohida
ustunda summ yig'ilishi kerak har biridan»*.

**Blokirovka:** qaysi materiallar inert hisoblanishini egasi aytishi kerak —
qat'iy ro'yxatmi (beton/suv/qum/щебень/раствор…), yoki RES faylida biror
belgi bilan ko'rsatiladimi. **Taxmin qilmang** — bu sessiyada taxmin qilib
bir marta adashilgan (pastdagi 4-bo'limga qarang).

**Ish hajmi:** `T2ResursKategoriya`ga 7-qiymat; `resursMkKabAniqla`ga qoida;
registr/UI ro'yxatlariga qo'shish; `resurs-vedomost.ts`dagi `KATEGORIYA_TARTIB`.

### 2.2. Mavjud obyektga qayta import qilib bo'lmaydi

**Holat:** ochiq. Yechim bazada tayyor, klientga ulanmagan.

Import `SMETA_ALREADY_EXISTS` bilan to'xtaydi:
`frontend/src/admin/sahifalar/SmetaYuklaNative.tsx` (~1010-qator).

Bazada `t2_smeta_tozalash_v1(p_kompaniya_id, p_actor_id, p_obyekt_id,
p_operation_id)` bor va **hech qayerdan chaqirilmaydi**. U:
- fakt (`t2_akt_qator`) yoki narx-asos (`t2_price_basis_line`) bo'lsa
  `SMETA_HAS_DEPENDENT_DATA` qaytaradi — ya'ni xavfsizlik bor
- aks holda import sessiyalari + `t2_qator`ni o'chiradi
- `p_operation_id` bo'yicha idempotent

**Kerak:** import panelida `SMETA_ALREADY_EXISTS` chiqqanda "mavjud smetani
tozalab, qaytadan import qilish" yo'li. Bu **destruktiv** — tasdiqlash oynasi
va nima o'chishi aniq yozilishi shart. Egasi bu ishni boshlashdan oldin
tasdiqlashini so'ragan edi — **avval undan so'rang**.

Egasi hozircha buni aylanib o'tyapti: yangi obyekt yaratib (Stella → Stella2),
o'sha yerga import qilyapti.

### 2.3. PTO scope paneli eksportni bloklardi (tepadagi tanlagichlar)

**Holat:** HAL QILINDI (2026-09-11, commit `8b73a5f`). Egasi ikkinchi marta
"shu tepadagi belgilanadigan joy naxxuy kerak o'zi?" deb so'ragach, 1+2
variantlarning aralashmasi tanlandi: **eksport bloklanmaydi, provenance
bo'lsa yoziladi.**

Ilgari eksport gate'i manba hujjat + revision + sha256 tanlanishini
**talab qilardi**, lekin bu maydonlar hech qayerga yozilmasdi — ya'ni
foyda yo'q, faqat to'siq. Yangi/ko'p manbali obyektda "hujjat markazi"da
yozuv bo'lmagani uchun eksport abadiy bloklanardi.

Endi:
- Gate FAQAT haqiqiy shartlarni tekshiradi: `OBJECT_CONTEXT_REQUIRED`
  (qaysi obyekt) + `READ_MODEL_NOT_COMPLETE` (daraxt to'la yuklangan) +
  kompaniya (kontekst uchun). Loyiha/davr/manba/revision/checksum —
  **ixtiyoriy provenance**.
- Eksport konteksti tepadagi PTO scope'dan emas, **sahifa ochgan
  obyektdan** olinadi (`HolatNative.tsx`) — tepadan hech narsa tanlash
  shart emas.
- Manba hujjat/revision/checksum scope'da tanlangan bo'lsa, ular faylning
  alohida **"МАНБА"** varag'iga yoziladi (`lrvPlusFaylBaytlari`). Hech
  narsa tanlanmasa varaq qo'shilmaydi, eksport baribir ochiladi.
- Reason-kod satrlari va context maydonlari type ichida **saqlab qolindi**
  — kelajakda provenance siyosati qayta yoqilsa yoki audit jurnaliga
  yozilsa ishlatiladi.

⚠️ Bu **HERM-001** provenance siyosatini yumshatadi (egasining aniq,
takroriy so'rovi bilan). `t2_pto_closure_hermes.test.cjs` yangi invariantga
moslandi.

### 2.4. Narxsiz qolgan obyektlarni qayta narxlash

**Holat:** ochiq, egasining ishi (SQL bilan tegmang).

`t2_obyekt_jami.narxsiz` tuzatilgandan keyin haqiqiy manzara (kompaniya 17):

| Obyekt | id | Narxsiz qator |
|---|---|---|
| Amfiteatr2 | 56 | **9 448** |
| Fast Food 1etaj | 26 | **1 262** |
| Stella2 | 72 | 187 |
| Karting2 | 70 | 206 |

Amfiteatr2 va Fast Food deyarli butunlay narxsiz — jamisi ishonchsiz.
Ularni RES fayli bilan qayta narxlash kerak.

⚠️ **Narxlarni SQL bilan boshqa obyektdan ko'chirmang.** Bu sessiyada
Karting2'ning ishchi soati stavkasi (29 421) Stella'ga ham to'g'ri keladi deb
o'ylangan edi — egasi to'xtatdi, Stella'niki **24 517.700** ekan. Har
obyektning o'z narx bazasi bor.

### 2.5. LRV Excel: sarlavhalar, freeze panes, katak kengligi

**Holat:** son formati + kenglik BAJARILDI (2026-09-11); sarlavhalar va
freeze panes ochiq.

Egasining so'rovi (aynan): *«mos ravishda hujjatlarga mos sarlavhalar qo'y
freeze qil kerakli joyidan. son tekst formatlari yacheyka ichiga kirib
ketmasligi kerak ideal ko'rinishi kataklar kengaya olishi kerak»*.

Bajarilgan (2026-09-11, commit `5110e47` + `7c53d82`):
- Pul ustunlariga `#,##0.00`, hajm ustunlariga `#,##0.####` son formati —
  endi katta summa `471209797.5111` xom ko'rinmaydi.
- Nom ustuni (C) `wrapText` bilan o'raladi (uzun rus nomlari kesilmaydi).
  ⚠️ `xlsx-js-style` `wrapText`ni faylga yozadi, lekin qayta o'qiganda
  `s.alignment`ni tiklamaydi — shuning uchun testda `exceljs` bilan
  tekshirilgan (`lrv-plus-export.test.ts`).
- Asosiy varaqning pul ustunlari (СУММА, ЧЕЛ..М/К jamilari, ФАКТ/ОСТАТКА/F2
  суммы) milliardli jamiga sig'adigan kenglikka (15–17) kengaytirildi.

Bajarilmagan: hujjatga mos sarlavhalar, freeze panes.

⚠️ **Freeze panes:** `xlsx-js-style` uni varaq darajasida qo'llab-quvvatlamaydi
(bu sessiyada XML darajasida tekshirildi — `XLSX.write` `<sheetView>`ga
`<pane>` yozmaydi, `!freeze`/`!views` e'tiborsiz qoladi). Ya'ni oddiy yo'l
bilan bo'lmaydi — yo ZIP/XML'ni post-processing qilish, yo boshqa kutubxona
(masalan `exceljs` — allaqachon to'g'ridan-to'g'ri bog'liqlik va freeze'ni
qo'llab-quvvatlaydi, lekin uslub yo'qolishi xavfi bor).
**Egasiga avval shuni ayting**, va'da bermang.

### 2.6. Obyekt o'chirish ro'yxatdan yo'qolmaydi

**Holat:** BAJARILDI (2026-09-11, commit `2665c47`).

Egasi obyektni o'chirmoqchi bo'lgan, o'chmagan. Tekshirildi: Stella (71)
bazada `holat='bekor'` — ya'ni **o'chirish ishlagan**, va `t2_obyekt_jami`
view'i `holat <> 'bekor'` bilan filtrlaydi, ya'ni baza to'g'ri.

Haqiqiy sabab — **uch mustaqil obyekt keshi bir-biriga mos emas edi**:
1. React Query `['obyektlar']` (`useObyektlar`, staleTime 10 daq) — yon panel
   va ko'p sahifa.
2. `TestObyektlar.tsx` lokal state (`yukla`) — obyektlar sahifasining o'zi.
3. `PTOWorkspaceContext` lokal state — PTO scope tanlagichi.

`/admin/obyektlar` → `TestObyektlar` (o'chirish tugmasi shu yerda). U
mutatsiyadan keyin faqat o'z lokal ro'yxatini yangilardi; (1) va (3) 10
daqiqagacha eski qolib, o'chirilgan obyekt ko'rinaverar, yangi yaratilgani
esa scope/panelda paydo bo'lmasdi.

**Yechim:** `sinxronla()` — har muvaffaqiyatli yaratish/o'chirish/tahrirdan
keyin uchala keshni ham qo'zg'atadi (`yukla()` + `qc.invalidateQueries` +
`workspace.refresh()`). 10 daqiqalik staleTime oddiy navigatsiya uchun
saqlanib qoldi.

Yo'l-yo'lakay topilgan (hali ochiq): `Obyektlar.tsx:23` da `dbObyektlar`
state yuklanadi va **hech qayerda ishlatilmaydi** — o'lik kod (Tizim_01
arxiv sahifasi, past ustuvorlik).

### 2.7. ОБ ajratishni haqiqiy faylda tekshirish

**Holat:** tuzatildi, lekin **tasdiqlanmagan**.

ОБ ikki yo'l bilan aniqlanadi:
1. bo'lim sarlavhasi `ОБОРУДОВАНИЕ`
2. sarlavha bo'lmasa — podval foizi:
   `ЗАГОТОВИТЕЛЬНО-СКЛАДСКИЕ РАСХОДЫ=1,2%` → ОБ
   `…=2% И М/К=0,75%` → МАТ (ajratuvchi belgi — `М/К` so'zi)

⚠️ **Stella'da oborudovaniye umuman yo'q** (egasi tasdiqladi). Ya'ni
Stella2'da `ОБ = 0` bo'lishi **to'g'ri**. ОБ ajratishni Stella'da sinab
bo'lmaydi — oborudovaniyesi bor boshqa obyekt kerak.

⚠️ **Xavf:** egasining manba fayli **ko'p obyektli** (ichida `протокол
Амфитеатр`, `общий Навоий`, Лист3/4/5/6/19). Bunday fayldan bitta varaq
import qilinsa, podval qoidasi qo'shni blok qatorlarini noto'g'ri
belgilashi mumkin. Sarlavhasi bor fayl topilsa — sarlavhaga tayaning,
podvalni faqat zaxira sifatida qoldiring.

### 2.8. Agent uchun tarmoq ruxsati va o'z-o'zini tekshirish

**Holat:** ochiq, egasi qilishi kerak.

Sandbox'dan chiqish bloklangan (egress proxy → 403):
```
smeta-tizimi.pages.dev            → BLOCKED
tuoyrzadkgoltpqkdiyx.supabase.co  → BLOCKED
```

Shuning uchun **hech bir agent o'z tuzatishini brauzerda tekshira olmaydi** —
faqat testlar va baza (Supabase MCP alohida kanal orqali ishlaydi).

Kerak, tartib bilan:
1. Muhitning **network/egress policy**siga yuqoridagi ikki hostni qo'shish
   (Claude Code on the web → Environments). Chromium + Playwright sandbox'da
   allaqachon o'rnatilgan (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`),
   `playwright install` qilmang.
2. **Alohida test akkaunt** (boss roli, alohida test kompaniyada) — egasining
   o'z akkaunti emas.
3. **Etalon obyekt**: jamisi oldindan ma'lum bitta smeta. Shunda har qanday
   agent import qilib, natijani etalon bilan solishtirib **o'zini o'zi**
   tekshiradi. Hozir buning yo'qligi sababli har bir raqamni egasi qo'lda
   tasdiqlashga majbur.

---

## 3. Predmet bilimi (egasidan olingan — qayta so'ramang)

### 3.1. O'zbekistonda ikki smeta dasturi

`ABC4` va `TN Qurilish`. Formatlari farq qiladi, ustunlar joylashuvi esa
smetachiga qarab ham farq qiladi. Karting — ABC4, Amfiteatr — TN Qurilish.
Shuning uchun ustunlar **pozitsiya bo'yicha emas, sarlavha so'zi bo'yicha**
topiladi (`lib/f2-import-parse/columnDetect.ts`).

Haqiqiy sarlavhalar (fayllardan aynan ko'chirilgan):

```
Karting RES (ABC4):
  N п.п. | Шифр номера нормативов… | Наименование работ и затрат |
  Единица измерения | Количество | Сметная стоимость → на.ед.изм. | общая

Stella RES:
  N п/п | НАИМЕНОВАНИЕ | ЕД. ИЗМ. | КОЛ-ВО | ЦЕНА ЗА ЕД. | СУММА (сум)

F2 akt:
  … | НАИМЕНОВАНИЕ РАБОТ И РЕСУРСОВ | ЕД.ИЗМ | НА ЕДИНИЦУ | ПО ПРОЕКТУ |
  на.ед.изм. | общая
```

⚠️ `columnDetect.ts`da sarlavha so'zlari **bosqichli** (avval aniq ibora,
keyin umumiy). Buni buzmang: umumiy `ОБЪЕМ`ni birinchi qo'yish «ФОРМА»
shablonida `Объем по смете`ni `Объем по проекту` o'rniga oldirib, tarixiy
off-by-one xatosini qaytaradi. Mavjud test buni ushlaydi.

### 3.2. Kategoriya aniqlash tartibi (egasining qoidasi)

```
1. BIRLIK eng ustun — uni hech narsa bosa olmaydi:
     ЧЕЛ-Ч → ЧЕЛ      (ЗАТРАТЫ ТРУДА МАШИНИСТОВ → МАШ, chunki u МАШ-Ч
                        stavkasi ichida hisoblangan; narxlanmaydi ham)
     МАШ-Ч → МАШ
2. NOM: КАБЕЛ…/ПРОВОД… → КАБ   (ПРОВОЛОКА kabel EMAS — u bog'lash simi, МАТ)
3. NOM + BIRLIK: nomi tayyor konstruksiya bilan boshlansa VA birligi
   кг/т bo'lsa → М/К
     ⚠️ «АРМАТУРА ДЛЯ … КОНСТРУКЦИЙ», «ПРОКАТ ДЛЯ АРМИРОВАНИЯ …» — bular
     konstruksiya UCHUN xomashyo, М/К EMAS. Egasi aynan bundan ogohlantirgan.
4. МАТ va ОБ farqi — faqat bo'lim sarlavhasi yoki podval foizidan.
   Birlik buni ayta olmaydi: шт, м2, компл ikkalasida ham uchraydi.
```

Egasining so'zi: *«haqiqiy mk bu tayyor konstruksiya kg yoki tonnada
belgilanadigan narsaga aytiladi. kabel provod ham shunaqa … metr yoki km da
berilgan narsalarga»*.

### 3.3. RES fayl tuzilishi

Egasiga ko'ra har bir RES faylda bloklar shu tartibda:
`ЗАТРАТЫ ТРУДА` → `МАШИНА-ЧАС` → `МАТЕРИАЛ` → `ОБОРУДОВАНИЕ`.

Amalda sarlavhalar har xil yoziladi — masalan Stella faylida:
`ЗАТРАТЫ ТРУДА`, `СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ`,
`СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ И КОНСТРУКЦИИ` (va `ОБОРУДОВАНИЕ` sarlavhasi
umuman yo'q).

`М/К`, `КАБЕЛЬ` va `БЕЗ СКЛАД` materiallari LRV_PLUS'ning J–O ustunlarida
**ikki marta** turishi mumkin: bir marta o'z kategoriyasida, bir marta
umumiy МАТ da.

### 3.4. Nakrutka

Kaskad tuzilishi va foizlar **allaqachon to'g'ri** — egasining tasdiqlangan
F2'sidagi podval bilan bir-biriga aynan mos (Fast food F2'sida tekshirilgan):

```
ЗТР (СОЦСТРАХ)                       12%
Транспорт материал                    5%
Складские материал                    2%   (М/К uchun 0.75%)
Транспорт кабель                    1.5%
Прочие подрядчика                    18%
Транспорт оборудование                2%
Заготовительно-складские оборуд.    1.2%
Страхование объекта                0.32%
```

Qo'lda foiz kiritish sahifasi **bor**: `/admin/nakrutka` (`NakrutkaNative.tsx`),
`t2_nakrutka_koef_ol_v1` / `t2_nakrutka_koef_saqla_v1`. Standart qiymatlar
`t2_nakrutka_default_v1()` dan keladi.

⚠️ `t2_nakrutka_koef` jadvali **bo'sh** — hech bir kompaniya uchun qiymat
kiritilmagan, ya'ni hamma joyda standart foizlar ishlayapti. Egasi o'zi
kiritishini aytgan.

Nakrutka noto'g'ri chiqayotgani formuladan emas edi — ОБ bo'sh bo'lgani
uchun oborudovaniye tarmog'i nolga hisoblanardi (2.1 va 2.7 ga qarang).

---

## 4. Bu sessiyada yo'l qo'yilgan xatolar (takrorlamang)

Halol yozilyapti, chunki ikkalasi ham egasining vaqtini yegan.

1. **М/К qoidasi nomga qarab yozilgan edi.** Egasi to'xtatdi: *«sani mantiqing
   bo'yicha armatura balo battar hamma prokatlar mk ga kirib ketadi»*. Nom +
   birlik juftligi kerak edi. **Predmet qoidasini taxmin qilmang — so'rang.**

2. **Podval qoidasi butun blokni bosib o'tgan.** ОБ ni ajratish uchun
   qo'shilgan retro-belgilash `undefined` bo'lgan hamma qatorni МАТ qilib
   qo'ygan — ЧЕЛ-Ч va 70+ МАШ-Ч qatorni ham. Egasi ko'rdi: *«mash chas
   aniqku bazilarida mat deb tashlagan»*. `7caec39`da tuzatildi (birlik eng
   ustun). **Yangi qoida qo'shganda eski, to'g'ri ishlayotgan qoidani bosib
   o'tmasligini tekshiring.**

Umumiy xulosa: bu kod bazasida har bir "kichik yaxshilash" haqiqiy pulga
ta'sir qiladi. Har o'zgarishga egasining **haqiqiy fayllaridan** olingan
test yozing (bu sessiyada shunday qilingan — izohlarda egasining aynan
so'zlari keltirilgan).

---

## 5. Tavsiya etilgan tartib

1. **2.8** — tarmoq ruxsati + test akkaunt + etalon obyekt. Busiz qolgan
   hamma ish "ko'r-ko'rona" bajariladi.
2. **2.1** — `БЕЗ СКЛАД` (egasidan inert material qoidasini oling).
3. **2.7** — ОБ ajratishni oborudovaniyesi bor obyektda tasdiqlang.
4. **2.4** — Amfiteatr2 va Fast Food'ni qayta narxlash (egasi bilan birga).
5. **2.2** — qayta import (egasining tasdig'i bilan).
6. **2.3** — PTO scope: egasining qaroriga qarab.
7. **2.5 / 2.6** — Excel ko'rinishi va obyekt o'chirish.

---

## 6. Egasi bilan ishlash haqida

- U **haqiqiy mahsulot egasi**, jonli tizimda test qiladi va predmetni
  sizdan yaxshiroq biladi. Qoidani u aytsa — o'sha to'g'ri.
- Raqam noto'g'ri bo'lsa u darhol sezadi (T1 bilan solishtiradi).
- Uning so'zi: *«Bunaqa qo'pol xato bilan man qamalib ketishim tayin»* —
  bu hujjatlar soliq/nazoratga ketadi. Taxminiy raqam yozishdan ko'ra
  "topilmadi" deb qoldirish **har doim yaxshiroq**.
- O'zbek tilida yozadi, javobni ham o'zbekcha kuting.
