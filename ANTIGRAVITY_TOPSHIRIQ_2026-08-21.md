# ANTIGRAVITY UCHUN TOPSHIRIQ — 2026-08-21 dan dushanbagacha

Bu hujjat Claude tomonidan yozilgan. Maqsad: ish uzilmasin va
takrorlanmasin. **Avval to'liq o'qing, keyin boshlang.**

---

# 0. HOZIRGI HOLAT — TASDIQLANGAN FAKTLAR

Bular taxmin emas, bugun o'lchangan.

| Narsa | Qiymat |
|---|---|
| GAS versiyasi | **v361**, 20 deployment + @HEAD = **21/21** |
| Oxirgi commit | `73ac73d` |
| Frontend | Cloudflare Pages, `smeta-tizimi.pages.dev` |
| Supabase loyiha | `tuoyrzadkgoltpqkdiyx` |
| Testlar | 8 to'plam, **220 tekshiruv**, hammasi o'tadi |

## Ma'lumot holati

| Obyekt | Qator | Jami | Izoh |
|---|---:|---:|---|
| Fast food 1этаж | 1 447 | **744 054 071.73** | LRV_PLUS bilan mos |
| Amfiteatr | 10 537 | **43 596 859 620.62** | ОБ = 269 qator |
| `t2_akt` / `t2_akt_qator` | **0** | — | hujjat hali yaratilmagan |

⚠️ **Bu ikki raqamni yodda tuting.** Har o'zgarishdan keyin ular
o'zgarmaganini tekshiring. O'zgargan bo'lsa — nimadir buzilgan.

```sql
select o.nom, count(*) qator,
       to_char(sum(q.summa),'FM999,999,999,990.00') jami
from t2_qator q join t2_obyekt o on o.id=q.obyekt_id
where q.tur in ('rs','mat','ob') group by o.nom;
```

## Reja fazalari

| Faza | Holat |
|---|---|
| 1 — T2 yadro | ✅ markirovka / narxlash / rollup |
| 2 — Amfiteatr solishtiruv | ✅ Tizim_01 bilan **1 %** farq |
| 3 — Versiya / konflikt | ✅ + idempotentlik |
| 4 — Frontend klient | ✅ |
| 5 — Sheets klient | ✅ ikki tomonlama, avto-sinx, halqa himoyasi |
| 6 — F2 / Fakt / Nakopitelniy | ✅ backend + darvoza + ekran |
| 6b — **F2 fayl importi** | ✅ **yangi** (quyida) |
| 7 — Sklad / xarid | ⬜ **KEYINGI** |
| 10 — Benchmark | ✅ o'lchandi |

## F2 fayl importi — 2026-08-21 da qo'shildi

Tashqi Excel F2/AKT faylini smetaga bog'laydi. `/admin/test/f2-import`

| Qism | Joyi |
|---|---|
| Faylni o'qish | `apiF2FaylOqi` (30_Panel.js) — **Tizim_01 niki, qayta ishlatiladi** |
| Ko'prik | `T2_F2Import.js` — daraxtni tekislaydi, ota blok belgilarini qo'shadi |
| Moslashtirish | `t2_f2_moslash()` — faqat o'qiydi |
| Import | `t2_f2_import()` — moslashtirish + hujjat |
| Ekran | `TestF2Import.tsx` — uch qadam |

⚠️ **MOSLASHTIRISH IERARXIK.** Fast food da 1 262 resurs qatori bor,
lekin unikal (nom, birlik) juftligi atigi **404** — bir resurs
o'rtacha 3 marta uchraydi. Jonli sinovda ota ma'lumotisiz bitta nom
**106 nomzod** bergan. Shuning uchun avval ota blok, keyin resurs
o'sha blok ichida qidiriladi.

⚠️ **NOANIQLIK JIM HAL QILINMAYDI.** Bir nechta nomzod chiqsa qator
«ikkilamchi» bo'ladi va hujjatga **kirmaydi**. Tavakkaliga birinchisini
tanlash — pulni boshqa blokka yozish demak.

⚠️ **REESTR KAFOLATI:** `kirgan = hujjatga kirdi + ikkilamchi +
topilmadi`. Ekranda ko'rsatiladi; buzilsa import tugmasi bloklanadi.

---

# 1. QAT'IY QOIDALAR — BULARNI BUZMANG

Har biri **haqiqiy xatodan** tug'ilgan. Buzsangiz o'sha xato qaytadi.

## 1.1 NARX O'ZIDAN TO'QILMAYDI

Narx topilmasa maydon **BO'SH** qoladi. `0` yozish «bepul» degani va
soxta hujjat yasaydi.

Foydalanuvchi so'zi: *«bazi resurslar o'zi narxlanmagan bo'ladi,
ularga ham narx qo'yib mani qamatib yubormasin»*.

Bazada bu qulflangan: `t2_akt_qator.summa` — **generated** ustun,
`narx IS NULL → summa NULL`. Uni qo'lda yozishga urinish xato beradi.

## 1.2 MANFIY HAJM BLOKLANMAYDI

ПЕРЕРАСЧЁТ (qayta hisob) manfiy korrektirovka bilan keladi va u
**haqiqiy hujjat**. Tekshiruv `> 0` emas, **yig'indi chegarasi**
bo'yicha bo'lishi kerak.

## 1.3 NORMA ≠ HAJM

Lokalkada ikkita miqdor ustuni:

| Ustun | Ma'nosi |
|---|---|
| 5 — «на ед. измерения» | **NORMA** (blok birligiga) |
| 6 — «по проектным данным» | **HAJM** (haqiqiy jami) |

Blokda 6-ustun bo'sh. Resursda **hajm = ota_blok.hajm × norma** va
u **HISOBLANADI**, fayldan o'qilmaydi (Tizim_01 qoidasi,
`30_Panel.js:1921`).

Buni chalkashtirish jamini ikki baravarga yaqin shishirdi
(1.5 mlrd ↔ 744 mln).

## 1.4 KATEGORIYA

- **ЧЕЛ / МАШ** — FAQAT birlikdan (`ЧЕЛ.-Ч`, `МАШ.-Ч`)
- **ОБ** — svodka SEKSIYA sarlavhasidan (`ОБОРУДОВАНИЕ`)
- Qolgani — МАТ

⚠️ Seksiya sarlavhasi **birlashgan katakda** bo'lishi mumkin —
qiymat eng chap ustunda turadi (`t2_ilk_matn` shuni hal qiladi).
Amfiteatrda aynan shu tufayli 17.5 mlrd uskuna materialda o'tirgan edi.

## 1.5 `t2_qator` GA TO'G'RIDAN-TO'G'RI `UPDATE` QILMANG

`t2_qator.summa` — **generated EMAS**. Hajmni to'g'ridan-to'g'ri
o'zgartirsangiz summa eski qiymatda qoladi va jim nomuvofiqlik
yasaydi.

Doim **`t2_qator_tahrir` RPC** ishlating — u summani qayta hisoblaydi
va `t2_rollup` ni chaqiradi.

## 1.6 QAYTA IMPORT MOLIYAVIY HUJJATNI YO'Q QILADI

`t2_akt_qator.qator_id → t2_qator(id) ON DELETE CASCADE`, va
`t2_markirovka` qatorlarni o'chirib qayta quradi.

Himoya qo'yilgan: **`t2_markirovka_himoya()`** — tirik hujjat
bog'liq bo'lsa import to'xtaydi va qaysi hujjat to'sayotganini
aytadi. **Bu himoyani olib tashlamang.**

---

# 2. DEPLOY TARTIBI — ADASHMANG

## 2.1 GAS

```bash
cd "Smeta tizimi"
git status --porcelain .          # begona .js bormi — MAJBURIY
# 79_WebAPI.js dagi KOD_VERSIYA ni QO'LDA oshiring
npx clasp push --force
npx clasp create-version "izoh"
```

Keyin **HAMMA 20 deployment** ni yangilang:

```bash
npx clasp list-deployments | grep -oP 'AKfycb\S+' \
  | grep -v '^AKfycbxhZgAn59VJOiwcUxqw4MhrlNMOCHd4AJDnEtzwJ7DL$' > /tmp/dep.txt
while read -r id; do
  npx clasp deploy --deploymentId "$id" --versionNumber <N> --description "v<N>"
done < /tmp/dep.txt
npx clasp list-deployments | grep -c '@<N>'    # 20 bo'lishi SHART
```

⚠️ **Bittasini deploy qilish YETMAYDI.** 21 ta deployment bor va
sayt ularning birini ishlatadi. `KOD_VERSIYA` bilan tekshiring:
`apiKodVersiya()` qaytargan raqam kutilganidan kichik bo'lsa —
kodni qidirmang, qayta deploy qiling.

⚠️ **`clasp push` yiqilsa, `create-version` NI CHAQIRMANG** — u eski
koddan versiya yasaydi. Menda shunday bo'ldi (v349 eski koddan chiqdi).

## 2.2 Frontend

```bash
cd frontend
npx tsc --noEmit -p tsconfig.node.json     # Pages Functions
npx tsc --noEmit -p tsconfig.app.json      # React
node testlar/hammasi.cjs                    # 194 tekshiruv
git add -A && git commit && git push origin main
```

Cloudflare push'dan keyin o'zi quradi.

⚠️ Mashina xotirasi siqilsa `vite build` «Fatal process out of
memory» beradi. `NODE_OPTIONS=--max-old-space-size=1536` bilan
o'tadi — bu kod xatosi emas.

---

# 3. OCHIQ TEXNIK QARZ

## 3.1 SESSIYA_KALIT — XAVFSIZLIK TESHIGI (ochiq, ataylab)

`frontend/functions/_shared/auth.ts` da zaxira kalit yozilgan:

```
Boshlangich_Maxfiy_Kalit_123
```

Repozitoriy **ochiq**, ya'ni bu kalit hammaga ma'lum va uni bilgan
har kim sessiya cookie'sini imzolab **admin bo'lib kira oladi**.

Bu ataylab qoldirilgan: kalit majburiy qilinganda Cloudflare'da
`SESSIYA_KALIT` ko'rinmadi va hech kim kira olmadi. Foydalanuvchi
ishdan to'xtab qolgani uchun to'siq olib qo'yildi — **uning ongli
qarori**.

**Yopish tartibi:**
1. Cloudflare Pages → Settings → Environment variables →
   `SESSIYA_KALIT` ni **Production VA Preview** ga qo'yish
2. Deployments → **Retry deployment** (bindinglar har deployment'ga
   suratga olinadi — qayta deploysiz eski qiymat qoladi)
3. `/api/sessiya` javobida `zaxira_kalit: false` bo'lganini tekshirish
4. `auth.ts` da `ZAXIRA` ni olib tashlab `throw` ni qaytarish

Tashxis vositalari saqlangan: `kalitBormi()`, `kalitTashxis()` —
«o'rnatdim lekin ishlamadi» holatini taxminsiz aniqlaydi.

⚠️ **Antigravity o'zi bu ishni QILMASIN** — foydalanuvchi bilan
kelishilgandan keyin.

## 3.2 Reconciliation — `rs` +5.06 %

Tizim_01 va Tizim_02 jamisi 1 % farq qiladi, lekin `rs` qatorlari
bo'yicha +5.06 % (+644 597 023).

Foydalanuvchi: *«tizim1 sheetsda ishlanganda balki o'zgargan bo'lish
ehtimoli katta, shuning uchun unga etibor berma»*.

**Ya'ni bu ta'qib qilinmaydi.** Bu ochiq qoldirilgan qaror, xato emas.

## 3.3 Qoralama nakopitelniyga kiradi

`t2_qator_holat` `holat <> 'bekor'` bo'yicha yig'adi — ya'ni
**qoralama ham** qoldiqni kamaytiradi. Bu ataylab (ikki qoralama
bir xil qoldiqni ikki marta da'vo qila olmasin), lekin bilib turish
kerak.

---

# 4. TOPSHIRIQLAR — USTUVORLIK BO'YICHA

Har topshiriqdan keyin: **testlar → deploy → commit → hisobot**.
Farq yopilmasa keyingisiga o'tmang.

## TOPSHIRIQ A — F2/Fakt ekranini HAQIQIY ma'lumotda sinash
**Ustuvorlik: eng yuqori. Kod yozilgan, lekin odam qo'li bilan
sinalmagan.**

`/admin/test/f2` sahifasi tayyor va `sbT2AktYarat/Tasdiqlash/Bekor`
ni ishlatadi. Backend 11 ta sinovdan o'tgan, lekin **ekran orqali**
hech kim hujjat yaratmagan.

Bajaring:
1. Fast food obyektida **fakt** hujjati yarating (2–3 qator)
2. Tasdiqlang
3. Nakopitelniy o'zgarganini tekshiring (`t2_qator_holat`)
4. O'sha qatorlarga **F2** yarating — u faktdan oshmasligi kerak
5. Ataylab **smetadan oshiq** fakt yozing — bloklanishi va qaysi
   qator buzganini aytishi kerak
6. **Manfiy hajm** (ПЕРЕРАСЧЁТ) yozing — o'tishi kerak
7. Bekor qiling — nakopitelniy qaytishi kerak

Topilgan har bir kamchilikni tuzating. **Sinovdan keyin ma'lumotni
tozalang** (`t2_akt` bo'sh qolsin) va Fast food jamisi
`744 054 071.73` ekanini tasdiqlang.

## TOPSHIRIQ A2 — F2 IMPORTNI HAQIQIY FAYLDA SINASH
**Ustuvorlik: A bilan teng. Baza tomoni sinovdan o'tgan, HAQIQIY
Excel fayli bilan sinalmagan.**

Baza funksiyalari 6 holatda tekshirilgan (ota bilan / otasiz /
topilmagan / aralash / f2>fakt / takroriy). Lekin **haqiqiy F2 Excel
fayli** hali o'tkazilmagan.

Bajaring:
1. Foydalanuvchidan yoki `Ой` papkasidan **haqiqiy F2 faylini** oling
2. `/admin/test/f2-import` da «Ko'rish» bosing
3. Qarang: nechta moslandi, nechtasi ikkilamchi
   - **Ikkilamchi ko'p bo'lsa** — bu kutilgan holat emas. Sabab:
     F2 faylida blok qatorlari yo'q yoki `apiF2FaylOqi` ularni
     `bl` deb tanimagan. `_t2F2Tekisla` ota belgilarini o'sha
     `type:'bl'` tugunlaridan oladi.
4. Import qiling, `t2_akt` da hujjat va qatorlar borligini tekshiring
5. **Tozalang** va Fast food jamisi o'zgarmaganini tasdiqlang

Agar ustunlar avtoaniqlanmasa `mode:'config'` qaytadi — hozircha bu
holat ekranda faqat aytiladi, sozlash oynasi YO'Q. Kerak bo'lsa
qo'shing (Tizim_01 dagi «Ф2 Импорт» oynasi namuna).

## TOPSHIRIQ B — Fayl yuklashdagi «Internal Error»

Foydalanuvchi `.xlsx` yuklaganda Drive konverti «Internal Error»
bergan. Hajm 0.1 MB, ya'ni chegara sabab emas.

Qo'yilgan: `.xlsx` ZIP imzosi (`PK\003\004`) yuborishdan oldin
tekshiriladi va eski `.xls` (`D0 CF`) alohida aytiladi. Konvert
yiqilsa chetlab o'tish yo'li ko'rsatiladi.

**Hali tasdiqlanmagan** — foydalanuvchi qayta sinamagan.

Bajaring: foydalanuvchidan o'sha faylni so'rang yoki `_MANBA`
papkasidan oling, `apiT2FaylYukla` ni sinang. Chiqqan xabarga qarab:
- «ESKI .xls» → hujjatga yozing, foydalanuvchiga aytiladi
- «birinchi baytlar: …» → format aniqlang
- yana «Internal Error» → chetlab o'tish yo'li ishlashini tasdiqlang

## TOPSHIRIQ C — FAZA 7: Sklad / xarid

Reja PHASE 7: `purchase → receipt → issue → material balance →
supplier links`.

⚠️ **Avval mavjudni o'rganing.** Tizim_01 da `prixod` (4 970 qator)
va `rashod` (4 590 qator) allaqachon bor. Yangi model yozishdan oldin
ular qanday ishlashini tushuning.

Faza 6 dagi naqshni takrorlang — u ishladi:
1. Jadval (immutable ID, `versiya`, `operation_id`)
2. Domen RPC (generic endpoint YO'Q)
3. Yozish darvozasiga **nomlangan amal** qo'shish
4. Ekran

## TOPSHIRIQ D — Markirovkani haqiqiy profillash

Benchmark: 52.7k → markirovka **33 s** (butun zanjirning 66 %).

Men optimallashtirishga urindim — **natija bermadi** va o'lchov
tarqoqligi ~15 % bo'lgani uchun farqni ajratib bo'lmadi.

**Taxmin bilan optimallashtirmang.** `EXPLAIN (ANALYZE, BUFFERS)`
bilan markirovkaning ICHKI so'rovlarini alohida o'lchang — 33
soniyani qaysi biri yeyayotgani hozir **noma'lum**.

Va avval savol bering: **50 soniya muammomi?** Import bo'lakli va
jarayon ko'rinib turadi. Muammo bo'lmasa — bu ish kerak emas.

---

# 5. NIMA QILMANG

1. **Tizim_01 ni buzmang.** U ishlab turgan produksiya.
2. **Big-bang migratsiya yo'q.**
3. **Generic SQL / write endpoint ochmang.** Har yozish — nomlangan
   domen RPC.
4. **Soxta ma'lumot qo'shmang.** Sinov ma'lumotini ishlatgan bo'lsangiz
   tozalang.
5. **O'lchamasdan «tezlashtirdim» demang.**
6. **Borini takrorlab yozmang.** Menda shu xato bo'ldi: Drive konvert
   kodini qaytadan yozdim, holbuki `_excelToNative` (05_Papka.js)
   allaqachon to'g'ri ishlaydi va zaxira yo'li ham bor.
7. **`clasp push` oldidan begona `.js` tekshiring** — produksiyaga
   tushib ketishi mumkin.
8. **Xatoni jim yutmang.** Har `catch` yo loglaydi, yo foydalanuvchiga
   aytadi.

---

# 6. FOYDALI HUJJATLAR

| Fayl | Nima |
|---|---|
| `T2_RECONCILIATION_AMFITEATR.md` | Tizim_01 ↔ Tizim_02 solishtiruv |
| `T2_FAZA6_AKT_YADRO.md` | F2/Fakt yadrosi + hayotiy sikl + CASCADE xavfi |
| `T2_BENCHMARK.md` | O'lchov natijalari va muvaffaqiyatsiz optimallashtirish |
| `00_BOSH_QONUN.md` | Loyihaning oliy qoidasi |
| `TIZIM_02_TAHLIL_VA_REJA.md` | Umumiy reja |

## Foydali SQL

```sql
-- Obyekt holati
select * from t2_obyekt_jami;

-- Invariant tekshiruvi
select t2_akt_tekshir(<obyekt_id>);

-- Benchmark (⚠️ ma'lumotni qayta quradi)
select t2_benchmark(<obyekt>, <lokalka_manba>, <svodka_manba>);

-- Manba ro'yxati
select id, obyekt_id, rol, varaq, holat from t2_manba order by obyekt_id, id;
```

---

# 7. HAR TOPSHIRIQ HISOBOTI

1. Nima topildi
2. Nima o'zgardi va **nega**
3. Qaysi fayllar
4. Qaysi testlar o'tdi
5. **Fast food va Amfiteatr jamisi o'zgarmaganini tasdiqlash**
6. Qanday deploy qilindi (GAS versiyasi, 21/21 mi)
7. Ochiq qolgan narsa
8. Keyingi bitta topshiriq

---

**Oxirgi so'z:** bu loyihada eng qimmat xato turi — **ishonch bilan
aytilgan noto'g'ri raqam**. U hech qanday ogohlantirish bermaydi va
odam unga qarab moliyaviy qaror qabul qiladi. Shubhangiz bo'lsa
o'lchang; o'lchay olmasangiz — shuni ochiq ayting.
