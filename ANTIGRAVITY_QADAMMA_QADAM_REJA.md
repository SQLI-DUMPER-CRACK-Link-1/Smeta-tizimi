# 📋 ANTIGRAVITY UCHUN QADAMMA-QADAM IJRO REJASI

> **Sana:** 2026-07-05. **Tuzuvchi:** Claude (butun tizim auditi asosida).
> **Tartib printsipi:** ASOSIY MANTIQ (ma'lumot qatlami) BIRINCHI — UI/bezak keyin.
> Chunki hozirgi barcha "sirli" xatolar (10 mlrd vs 9.77 mlrd, F2=0, status noto'g'ri)
> ma'lumot qatlamining tarqoqligidan kelib chiqqan. Poydevor tuzalmaguncha UI tuzatish —
> qumga qurish.
>
> **Bog'liq hujjatlar (ALBATTA o'qib chiq, ishga kirishishdan OLDIN):**
> 1. `MASTER_TAHLIL_VA_QAYTA_QURISH_REJASI.md` — nima uchun aynan shu reja (kontekst)
> 2. `NAKRUTKA_VA_F2_TAHLIL_ANTIGRAVITY.md` — накрутка ildiz tahlili
> 3. `ANTIGRAVITY_UCHUN.md` — buzilmas qoidalar (git/clasp falokatlari tarixi)
> 4. `Smeta tizimi/CLAUDE.md` — texnik ma'lumotnoma (ustunlar, fix tarixi)

---

## ⛔ 0-BLOK — HAR SEANS OLDIDAN (MAJBURIY, O'TKAZIB BO'LMAYDI)

### Qadam 0.1 — Jonli kodni olish
```bash
cd "Smeta tizimi"
clasp pull          # JONLI MANBA = clasp. GIT EMAS!
```
- ❌ **HECH QACHON:** `git checkout <fayl>`, `git reset --hard`, `git stash` (pop qilmasdan).
  Bu buyruqlar 2 marta falokat keltirgan (bir haftalik ish yo'qolgan).
- ❌ **HECH QACHON:** faylni to'liq qayta yozish (rewrite) — faqat nuqtali Edit.

### Qadam 0.2 — Ish oldidan holatni qulflash
- Apps Script editorда `selftestFunksiyalar()` RUN → natija **121/121** (yoki joriy son)
  bo'lishi shart. Bitta ham "ТОПИЛМАДИ" bo'lsa — TO'XTA, avval sababini top.
- Shu natija sonini yozib qo'y — ish oxirida solishtirasan.

### Qadam 0.3 — Har push oldidan
1. `node --check <o'zgargan .js fayllar>` — sintaksis.
2. Panel.html o'zgargan bo'lsa:
   ```bash
   node -e "const fs=require('fs');const h=fs.readFileSync('Panel.html','utf8');[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>{try{new Function(m[1])}catch(e){console.log('Blok '+i+': '+e.message)}});console.log('tekshirildi')"
   ```
3. `clasp push --force` → keyin `selftestFunksiyalar()` qayta RUN → son KAMAYMAGAN bo'lsin.
4. **Deploy** (`clasp deploy -i AKfycbx0tzNBlYPgaks51yZk6hU3d5UU32LjXvybSJWXekup7HxgjcCk86gVrCy_9X12dQIbTQ`) —
   FAQAT foydalanuvchi aniq "deploy qil" desa. Push ≠ deploy!

### Qadam 0.4 — Marker OLTIN QOIDASI (yodlab ol)
LRV `I` ustuni (MARKER) ni o'qiydigan HAR QANDAY kod:
```js
var mk = String(cell||'').trim().toLowerCase().replace(/\+$/,'');  // '+' TASHLASH SHART
```
`'+'` = qo'shimcha/zamena qator (`rs+`,`bl+`,`mat+`,`ob+`). Tashlamasang — bu qatorlar
jimgina hisobdan tushib qoladi (bu xato 3 marta takrorlangan: apiTashxis, serverYozFile,
_resurslarYig).

---

# 1-BLOK — ASOSIY MANTIQ: YAGONA O'QISH QATLAMI `lrvOqi()`

> **Nega birinchi:** LRV'dan o'qiydigan kod 7 joyda takrorlangan, har birida bir xil
> qoidalar (marker, kategoriya, start-qator) qayta yozilgan — har yangi nusxada yangi xato.
> Bu blok tugagach, "KPI bir son, DASHBOARD boshqa son" sinfi xatolar ILDIZI bilan yo'qoladi.

### Qadam 1.1 — Yangi fayl yaratish: `12_LrvIO.js`
Yangi fayl (mavjudlarini buzmaslik uchun alohida). Ichida BITTA asosiy funksiya:

```js
/* ================= LRV O'QISHNING YAGONA STANDARTI =================
 * BARCHA modullar (DASHBOARD, Tashxis, Boss, Resurs, Supabase, Panel)
 * LRV varag'ini FAQAT shu funksiya orqali o'qiydi.
 * Qoidalar BIR joyda: marker normalize, kategoriya aniqlash, start-qator. */
function lrvOqi(sh, opts){
  opts = opts || {};
  var a = sozAsosiy(), col = CFG.C;
  var last = sh.getLastRow();
  var start = a.dataQator > 0 ? a.dataQator : _autoData(sh);
  var n = last - start + 1;
  if (n < 1) return [];
  var g = sh.getRange(start, 1, n, col.ST_OST).getValues();
  var rows = [];
  for (var i = 0; i < n; i++) {
    var mkRaw = String(g[i][col.MARKER-1]||'').trim().toLowerCase();
    var isQosh = /\+$/.test(mkRaw);
    var mk = mkRaw.replace(/\+$/,'');
    if (mk!=='rz' && mk!=='bl' && mk!=='rs' && mk!=='mat' && mk!=='ob') continue;
    if (opts.faqatLeaf && (mk==='rz' || mk==='bl')) continue;
    // KATEGORIYA — yagona qoida (ustunda qiymat bor-yo'qligi bo'yicha)
    var kat = '?';
    if      (_toNum(g[i][col.CHEL-1]) > 0) kat = 'ЧЕЛ';
    else if (_toNum(g[i][col.MASH-1]) > 0) kat = 'МАШ';
    else if (_toNum(g[i][col.OB-1])   > 0) kat = 'ОБ';
    else if (_toNum(g[i][col.MK-1])   > 0) kat = 'М/К';
    else if (_toNum(g[i][col.KAB-1])  > 0) kat = 'КАБ';
    else if (_toNum(g[i][col.MAT-1])  > 0) kat = 'МАТ';
    rows.push({
      row: start+i, tur: mk, isQosh: isQosh, kat: kat,
      nom: String(g[i][col.NOM-1]||'').trim(),
      birlik: String(g[i][col.BIRLIK-1]||'').trim(),
      kod: String(g[i][col.KOD-1]||'').trim(),
      e: _toNum(g[i][col.E-1]), f: _toNum(g[i][col.F-1]),
      narx: _toNum(g[i][col.NARX-1]),
      smeta: _toNum(g[i][col.ST_RES-1]),
      stFakt: _toNum(g[i][col.ST_FAKT-1]),
      stF2: _toNum(g[i][col.ST_F2-1]),
      stOst: _toNum(g[i][col.ST_OST-1]),
      fakt: _toNum(g[i][col.FAKT-1]),
      f2ol: _toNum(g[i][col.F2OL-1]),
      f2mum: _toNum(g[i][col.F2MUM-1])
    });
  }
  return rows;
}

/* Obyektning BARCHA LRV varaqlari bo'yicha lrvOqi — jami hisoblagichlar uchun */
function lrvOqiHammasi(plusSS, opts){
  var out = [], sheets = plusSS.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    if (sheets[s].getName().indexOf(CFG.LRV_SHEET) !== 0) continue;
    var rows = lrvOqi(sheets[s], opts);
    for (var i = 0; i < rows.length; i++) { rows[i].varaq = sheets[s].getName(); out.push(rows[i]); }
  }
  return out;
}
```

**Tekshiruv (gate 1.1):** `node --check 12_LrvIO.js` → push → `selftestFunksiyalar()`
son kamaymagan. Hali hech kim ishlatmayapti — xavfsiz.

### Qadam 1.2 — Solishtirish testi yozish (migratsiyadan OLDIN!)
`98_SelfTest.js`ga qo'shish:
```js
/* lrvOqi eski o'quvchilar bilan RAQAMLAB solishtiriladi — migratsiya darvozasi */
function selftestLrvOqi(obyekt){
  var plus=_plusTop(obyekt); if(!plus) return {ok:false, xato:'LRV_PLUS topilmadi'};
  var rows=lrvOqiHammasi(plus,{faqatLeaf:true});
  var smeta=0,fakt=0,f2=0;
  rows.forEach(function(r){ smeta+=r.smeta; fakt+=r.stFakt; f2+=r.stF2; });
  // DASHBOARD dagi qiymat bilan solishtir
  var dash=_dash(_serverSS(sozAsosiy()));
  var v=dash.getRange(2,1,dash.getLastRow()-1,11).getValues();
  for(var i=0;i<v.length;i++){
    if(String(v[i][0]).trim()!==obyekt) continue;
    var dSm=_toNum(v[i][1]);
    return {ok: Math.abs(dSm-smeta)<1, lrv:smeta, dashboard:dSm, farq:dSm-smeta,
            fakt:fakt, f2:f2, qatorlar:rows.length};
  }
  return {ok:false, xato:'DASHBOARD da topilmadi'};
}
```
**Gate 1.2:** Bitta obyektda (masalan GAME CLUB) `[Ишла]` qilib DASHBOARD yangilangach,
`selftestLrvOqi('GAME CLUB')` RUN → `ok:true, farq:0` bo'lishi SHART. Bo'lmasa — farq
sababini top (katta ehtimol yana bir joyda marker/filtr farqi), tuzat, keyin davom et.

### Qadam 1.3 — O'quvchilarni BIRMA-BIR ko'chirish (har biri alohida push!)
Tartib (xavfsizdan xavfliroqqa). **Har ko'chirishdan keyin:** push → o'sha obyektda
funksiyani RUN qilib ESKI natija bilan YANGI natija AYNAN teng ekanini tekshir → keyingisiga o't.

| # | Funksiya | Fayl | Nima qilinadi | Tekshiruv |
|---|---|---|---|---|
| 1 | `_resurslarYig` | 10_Engine.js | Ichki sikl o'rniga `lrvOqi(shi,{faqatLeaf:true})` dan nom/birlik/narx olish | RESURS varag'i qator soni o'zgarmagan |
| 2 | `serverYozFile` | 20_Server.js | Sikl o'rniga `lrvOqiHammasi(plusSS,{faqatLeaf:true})`; kategoriya yig'ish `r.kat` bo'yicha | `selftestLrvOqi` farq=0 qoladi |
| 3 | `apiTashxis` | 30_Panel.js | leaf sikli lrvOqi'ga | Ташхис jamlari avvalgidek |
| 4 | `apiBossObyekt` | 30_Panel.js | leaf qismi lrvOqi'ga (oyTrend qismi joyida qoladi) | Boss kartadagi sonlar o'zgarmagan |
| 5 | Supabase push (holat) | 70_Supabase.js | o'quvchi qismi lrvOqi'ga | supabase holat jadvali qator soni bir xil |
| 6 | `apiHolatOl` | 30_Panel.js | ⚠️ ENG MURAKKAB — daraxt quruvchi. OXIRIGA qoldir. Faqat leaf-qiymat o'qish qismini lrvOqi'ga o'tkaz, daraxt yig'ish mantig'iga TEGMA | Panel daraxti vizual bir xil + KPI bir xil |

- ❌ Bir push'da 2+ funksiya ko'chirma — xato chiqsa qaysinisidan ekani bilinmaydi.
- ❌ `apiHolatOl` daraxt mantig'ini (curRz/curBl, bo'sh rz filtri — fix #68) QAYTA YOZMA.

### Qadam 1.4 — Kelishuv invariantini doimiy qilish
`selftestBarcha()` ichiga har obyekt uchun `selftestLrvOqi` chaqiruvini qo'sh —
`|LRV−DASHBOARD| ≥ 1 so'm` bo'lsa test YIQILADI. Anomaliya skanerga ham qo'sh
(`supabaseAnomaliyaPush`): farq → `anomaliya` jadvaliga `SMETA_DASHBOARD_FARQ` qoidasi.

**1-BLOK TUGADI degan holat:** 7 o'quvchi bitta eshikdan o'tadi, selftest farq=0 ni qulflagan.

---

# 2-BLOK — ASOSIY MANTIQ: YAGONA YOZISH QATLAMI `lrvYoz()`

> **Nega:** F2=0 xatosi yozuvchilar tarqoqligidan chiqdi (`_oyFormulaToldur` bl ni unutgan,
> `apiRsQosh` noto'g'ri formula ishlatgan, `apiBlQosh` oy ustunlariga umuman formula yozmagan).

### Qadam 2.1 — `12_LrvIO.js`ga yozuvchi qo'shish
```js
/* LRV'ga FAKT/F2 yozishning YAGONA eshigi. Har yozuvdan keyin:
 * formulalar ta'minlanadi + kesh invalidatsiya + DASHBOARD yangilanadi. */
function lrvYoz(obyekt, sh, edits){
  // 1) qiymatlarni yozish (hozirgi apiHolatSaqla ichidagi mantiq shu yerga ko'chadi)
  // 2) MAJBURIY yakun (hech qanday holatda o'tkazib yuborilmaydi):
  var a=sozAsosiy(), st=a.dataQator>0?a.dataQator:_autoData(sh), ls=sh.getLastRow();
  if(ls>=st){ try{ _oyFormulaToldur(sh, st, ls); }catch(e){} }
  try{ _oyYigindiFormulalarYangila(sh); }catch(e){}
  _holatInvalidate(obyekt);
  try{ serverYozFile(obyekt, sh.getParent(), a); }catch(e){}   // DASHBOARD darhol jonli
  if(typeof _sbDirty==='function'){ try{ _sbDirty(obyekt); }catch(e){} }
}
```

### Qadam 2.2 — Yozuvchilarni ko'chirish (birma-bir, 1.3 uslubida)
| # | Yozuvchi | Hozirgi muammosi |
|---|---|---|
| 1 | `apiHolatSaqla` | 2026-07-05 ta'mirlash qo'shilgan — endi lrvYoz'ga rasmiylashtiriladi |
| 2 | `apiF2Qolla` | apiHolatSaqla orqali yozadi — avtomatik qamraladi, faqat test |
| 3 | `apiBlQosh` | 🔴 yangi qator qo'shganda MAVJUD oy ustunlariga formula YOZMAYDI (K4/M-xatolar manbai) — lrvYoz oxiridagi `_oyFormulaToldur` buni avtomatik yopadi. Insert qismiga tegma, faqat yakunda lrvYoz ta'mirini chaqir |
| 4 | `apiRsQosh` | F2OL/ST_F2 formulasi 2026-07-04 tuzatilgan — lrvYoz bilan yakunlash qo'shiladi |

**Gate 2:** test-stsenariy (real obyektda): (a) panelда bitta bl'ga F2 obyom kirit →
saqla → ST_F2 > 0 bo'ldi; (b) yangi ish qo'sh (+) → yangi qatorda oy ustunlarida
formula BOR; (c) `selftestLrvOqi` farq=0 (DASHBOARD darhol yangilangan).

---

# 3-BLOK — F2 IMPORT OQIMINI YOPISH (K1-K5)

> Endi poydevor mustahkam — F2 muammolarini yopamiz. **Har birida REAL F2 fayl bilan
> test qilinadi** ("kod to'g'ri ko'rinyapti" YETARLI EMAS — bu xatolar allaqachon
> "tuzatilgan" hisoblanib, amalda buzuq chiqqan).

### Qadam 3.1 — K1: o'ng panelda smeta daraxti ochilmaydi (ENG SHOSHILINCH UI)
1. Panel.html'da F2 import modalini top (qidiruv: `f2Import`, `drawF2Node`, `f2cc_`).
2. O'ng panel daraxti qanday yuklanadi — `apiHolatOl(CUR_OB)` chaqiruvimi yoki
   allaqachon yuklangan `TREE_DATA` dan mi? Aniqlash uchun brauzer konsolida modal
   ochilganda network/log kuzat.
3. Ehtimoliy sabablari (tartib bilan tekshir):
   a. Modal ochilganda `CUR_OB` bo'sh (obyekt tanlanmagan holat) → guard qo'shish
      ("avval obyekt tanlang" xabari) yoki avtomatik tanlash.
   b. Render konteyner `id` ziddiyati (fix #69 dagi `f2cc_undefined` sinfi xato) —
      `document.querySelectorAll('[id="..."]').length` bilan tekshir.
   c. `apiHolatOl` javobi kelayapti-yu render funksiya exception bilan yiqilayapti —
      konsol xatosini o'qi.
4. **Gate:** real obyekt + real F2 fayl bilan modal och → chapda F2 daraxti, O'NGDA
   smeta daraxti IKKALASI ko'rinadi, razdellar mustaqil ochilib-yopiladi.

### Qadam 3.2 — K2: keraksiz tasdiqlashlar
1. `f2AvtoMoslash` (Panel.html) chaqirilayaptimi — import daraxti qurilgach log qo'shib tekshir.
2. Har F2 qatori uchun `_f2ByKod`/`_f2ByNomBir` indeksidan nomzod sonini logla:
   `console.log(kod, nomzodlar.length)`.
3. Kutilgan xulosalardan biri chiqadi:
   - Indeks kaliti normalize F2 fayl qiymatiga mos kelmayapti (masalan kod «1.1-2» vs «1.1-2 »)
     → normalize'ni moslashtir (`_normNomKey` bilan BIR XIL qoidada, yangi qoida O'YLAB TOPMA).
   - Bir kod bir nechta qatorda uchraydi (occurrence) → "band qilinmagan birinchisini olish"
     qoidasini qo'sh (fix #67 dagi band-tekshirish bilan).
4. **Gate:** 100% mos (kod+nom+birlik) qatorlar SO'RALMASDAN avtomatik bog'lanadi;
   faqat farqlilar so'raydi. Real faylda kamida 10 qator bilan tekshir.

### Qadam 3.3 — K3: zamena qatori o'z razdeli ICHIGA tushsin

> ⚡ **2026-07-05 qo'shimcha (foydalanuvchidan real stsenariy):** "Перевозка 20 км"
> smetada, lekin fakt "Перевозка 1 км" — bu boshqa РАСЦЕНКА (norma/resurs tarkibi
> masofaga chiziqli emas, 20km'da 2 rs bo'lsa 1km'da 3-4 rs bo'lishi mumkin). Bunday
> holat uchun tizimda MANUAL yo'l ALLAQACHON TO'G'RI ISHLAYDI: Panel → BL → "➕ Шу
> ишдан кейин янги иш тури" → kutubxonadan qidirish → `apiIshTurQosh`. Buning
> `afterRow`i Panel.html'da `blLastRow` (bl'ning OXIRGI rs bolasi qatori) sifatida
> hisoblanadi — natijada yangi zamena qatori ANIQ o'sha smeta bl'ning TAGIGA tushadi
> (razdel oxiriga emas!). **F2 import K3'ni ANA SHU pozitsion mantiqqa moslashtir**:
> "razdel oxiri" o'rniga — agar F2 qatori import daraxtida biror ANIQ smeta bl'ga mos
> kelsa (yoki foydalanuvchi shunday belgilasa) — targetRow = O'SHA bl'ning oxirgi
> bola qatori (`apiIshTurAfterRow(obyekt,varaq,blRow)` funksiyasini TO'G'RIDAN-TO'G'RI
> chaqir, qayta yozma). Faqat F2 qatori HECH QANDAY aniq smeta bl'ga mos kelmasa
> (butunlay yangi razdel-darajadagi ish) — o'shanda "razdel oxiri" fallback ishlatiladi.

1. Hozirgi holat: razdel-tanlash modali qo'shilgan (`_smetaRazdellar`, targetRow=razdel oxiri).
   Real faylda sinab ko'r — ishlayaptimi?
2. Ishlamasa: `apiBlQosh` insert `afterRow` parametri qayerdan kelayotganini kuzat
   (klient `f2DopQil` → server). Log: tanlangan razdel nomi + hisoblangan targetRow +
   haqiqiy insert qatori.
3. Qo'shimcha talab: F2 qatori allaqachon smeta razdeliga MOS bo'lsa (chap daraxtda qaysi
   razdel ichida turganini bilamiz) — modal so'ramasdan O'SHA razdelni default tanlash.
   Yanada aniqrog'i: agar F2 qatori bitta ANIQ smeta bl'ning "o'xshash/zamena"si
   ekani bilinsa (masalan foydalanuvchi shu bl ustida "+ zamena" bosgan bo'lsa) —
   `apiIshTurAfterRow` bilan O'SHA bl'ning ostiga, razdel emas.
4. **Gate:** zamena qo'shilgach LRV'da yangi qator TANLANGAN razdelning (yoki mos
   bl'ning) oxirgi qatoridan keyin turadi (ro'yxat oxirida EMAS), marker `bl+`.

### Qadam 3.4 — K4: zamena resurslari (bolalari) yo'qolmasin
1. F2 fayldan qo'shilayotgan ish `_ISHTURLAR` kutubxonasida bormi (nom+birlik yoki kod
   bo'yicha, `apiIshTurQidir`)?
   - BOR → `apiIshTurQosh(key, hajm, afterRow)` ni TO'G'RIDAN-TO'G'RI chaqir — u bl+
     va UNING BARCHA rs+ (nechta bo'lsa shuncha, kutubxonadagi haqiqiy tarkib bilan)
     bittada, to'g'ri joyga qo'yadi. Qo'lda rs sikli YOZMA — bu funksiya allaqachon bor.
   - YO'Q → F2 faylning o'zida shu ish ostidagi rs qatorlari bo'lsa (import daraxtida
     bolalar ko'rinadi) — `apiBlQosh` (bo'sh bl+) + har rs uchun `apiRsQosh` sikli bilan.
2. **Gate:** zamena qo'shilgach yangi bl+ ostida rs+ bolalari bor, ularning F (hajm)
   formulasi bl'ga bog'langan (`=E$blRow*E`), oy ustunlarida formula bor (2-BLOK ta'mini).

### Qadam 3.5 — K5: "yangi oy = kiritilgan" statusi
1. Reproduksiya: yangi oy yarat → status qayerda ko'rinadi (skrinshot foydalanuvchidan bor).
2. Statusni hisoblovchi kodni top (Panel.html'da oy badge/foiz — qidiruv: oy nomi render,
   `kiritilgan`, foiz hisoblash).
3. Ehtimoliy sabab: foiz BARCHA oylar yig'indisidan (F2OL umumiy) hisoblanadi — yangi oy
   uchun ham o'sha ko'rsatiladi. To'g'risi: har oy o'z ustunidan (`Σ shu oy ОБЪЁМ > 0`).
4. **Gate:** yangi oy yaratilganda 0%/"kiritilmagan", eski oylar o'z holatida.

---

# 4-BLOK — PANEL UX (mantiq tayyor bo'lgach)

### Qadam 4.1 — M1: Multi-lokalka JAMLANGAN ko'rinish
1. Backend TAYYOR mexanizmlar: `_subObyektlar(parent)` (05_Papka.js), `apiHolatSaqla`
   `subOb||varaq` formati, `apiOyQosh` parent-sikli. YANGI backend yozish SHART EMAS.
2. `apiHolatOl(parent)`ga parent-rejim qo'sh: `_subObyektlar` bo'sh bo'lmasa → har sub
   uchun (keshdan) daraxt olib, `tree` larni birlashtir; har rz tuguniga `lokalka` maydoni;
   `varaq` maydonlarini `subOb+'||'+varaq` formatiga o'tkaz (saqlash allaqachon tushunadi!).
3. UI: obyekt ro'yxatida papka-obyektlar uchun "📦 JAMLANGAN" belgisi; daraxtda har rz
   badge'ida lokalka nomi.
4. **Gate:** 14-lokalkali obyekt tanlanganda bitta daraxt, KPI = hammasining yig'indisi,
   ixtiyoriy lokalka qatoriga fakt kiritish O'SHA lokalka fayliga yoziladi.

### Qadam 4.2 — M3: Reestr ⇄ Shartnoma birlashtirish
1. Reestr ma'lumotini o'qi (`apiReestrOl` — Document Properties JSON, 30_Panel.js ~2614).
2. Bir martalik migratsiya funksiyasi: JSON yozuvlarini `SOZLAMALAR_ШАРТНОМА` varag'iga
   ko'chir (dublikat bo'lsa — shartnoma NO bo'yicha yangilash, o'chirib tashlamaslik!).
3. Shartnoma tabiga "Reestr ko'rinishi" jadval qo'sh; Reestr tabini olib tashla
   (funksiyalarni O'CHIRMA — `apiReestrOl/Saqla` qoladi, faqat UI yo'nalishi o'zgaradi).
4. **Gate:** eski reestr yozuvlari Shartnoma tabida ko'rinadi; hech narsa yo'qolmagan.

### Qadam 4.3 — M4: Shaxsiy smeta — F2 import uslubida
1. F2 import modalining UI patternini QAYTA ISHLAT (70% shu kod): chap panel =
   `_ISHTURLAR` kutubxona qidiruvi (`apiIshTurQidir` TAYYOR), o'ng panel = qurilayotgan
   smeta daraxti.
2. O'ng panelda: "➕ Razdel qo'shish" tugmasi (nom so'raydi), tanlangan ishlar tegishli
   razdel ostiga tushadi, drag yoki tugma bilan.
3. Saqlash: mavjud `apiShaxsiySmetaYarat(config, items)` backend TAYYOR — faqat items
   strukturasiga `razdel` maydoni qo'sh.
4. **Gate:** 2 razdel + 3 ish bilan shaxsiy smeta yaratiladi → LRV_PLUS'da rz/bl/rs
   daraxti to'g'ri, narxlar kutubxonadan.

### Qadam 4.4 — M2: Ierarxiya "hammasini tort"
`50_Navbat.js` patternidan foydalain: "📥 Hammasini LRV'ga qo'y" tugmasi → har obyekt
navbatga → har biri alohida trigger-ijroda (6 daqiqa limitiga tushmaydi).
**Gate:** tugma bosilgach barcha obyekt ierarxiyasi fon rejimda yoziladi, progress ko'rinadi.

### Qadam 4.5 — M5: "Lot qo'shish" tugmasi
1. `grep -n "Lot" Panel.html` → tugma va onclick topiladi.
2. Handler bormi? Backend api bormi? Yo'q bo'lsa — foydalanuvchidan SO'RA: bu tugma nima
   qilishi kerak edi? (Hujjatlarda ta'rifi yo'q!) Javobga qarab yoz yoki olib tashla.

### Qadam 4.6 — M8: М/К va КАБ belgilash UI (foydalanuvchi xohlasa)
Resurs qatorida kichik kategoriya dropdown (ЧЕЛ/МАШ/МАТ/ОБ/М-К/КАБ/БЕЗ) → tegishli ustunga
`=$H{r}` ko'chirish. **Foydalanuvchidan avval so'ra** — balki kerak emas (hozir jami ~1-2% ta'sir).

---

# 5-BLOK — KENGAYTIRISH (4-blok gate'lari o'tgach)

### Qadam 5.1 — M6: Universal AI kalit
`00_AI_Gateway.js`: Script Property `AI_PROVIDER`/`AI_BASE_URL`/`AI_MODEL`/`AI_KEY`;
`aiCall` zanjiri: custom (sozlangan bo'lsa) → Groq → Gemini. OpenAI-compatible
`/chat/completions` format (Groq klienti shablon — `groqFetchRaw` dan nusxa ol).
Sozlamalar tabida forma. **Kalit hech qachon kodda emas.**
**Gate:** OpenRouter/OpenAI kalit kiritilsa AI savol-javob o'sha provayder orqali ishlaydi;
kalit o'chirilsa Groq→Gemini'ga qaytadi.

### Qadam 5.2 — G2: КС-2/КС-3 avto-generatsiya
Template Sheets fayl (rasmiy forma) → LRV oy ustunidan to'ldirish → PDF → `03_ARXIV_F2`.
Batafsil dizayn alohida kelishiladi (foydalanuvchining rasmiy forma namunasi kerak).

### Qadam 5.3 — G4/G3: Akt work-key + sklad chiqim ledger
`AKT_ARXITEKTURA.md` / `PRIXOD_ARXITEKTURA.md` bo'yicha (dizayn tayyor, o'qib chiq).

---

## 🚦 UMUMIY TARTIB-XULOSA

```
0-BLOK (har seans) → 1-BLOK lrvOqi (poydevor o'qish)
                   → 2-BLOK lrvYoz (poydevor yozish)
                   → 3-BLOK F2 import K1-K5 (foydalanuvchi kundalik ishi)
                   → 4-BLOK Panel UX (M1-M5, M8)
                   → 5-BLOK kengaytirish (AI kalit, КС-2, akt/sklad)
```

- Har qadam = alohida push. Har blok = foydalanuvchiga hisobot + tasdiq.
- ⚠️ 3.1 (K1, sof frontend bug) foydalanuvchi juda shoshsa 1-2 blokdan OLDIN qilinishi
  mumkin — u ma'lumot qatlamiga bog'liq emas. Qolgan K2-K5 esa 2-BLOK tugagach qilinsin
  (aks holda "tuzatildi-yu yana buzildi" takrorlanadi).
- Savol tug'ilsa — foydalanuvchidan so'ra, TAXMIN bilan "tuzatma" (bu loyihada taxminlar
  3 marta regressiya keltirgan).
- Har blok yakunida: `selftestBarcha()` + ushbu fayl va `MASTER_TAHLIL_VA_QAYTA_QURISH_REJASI.md`
  dagi tegishli bandlarni ✅ belgila.
