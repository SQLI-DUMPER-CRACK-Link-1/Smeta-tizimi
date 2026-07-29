# 🔥 ANTIGRAVITY — BUGUNGI YONIB TURGAN ISH: JAMLANGAN FAKT/F2 KIRITISH

> **Sana:** 2026-07-05. **Muallif:** Claude. **Muddat: BUGUN.**
> **Foydalanuvchining aniq talabi (so'zma-so'z mantiq):** "LRV fayllar to'g'ri qurildi —
> endi FAKTlarni va F2 larni kiritib chiqishim kerak. Ko'p smetali obyektlarda BITTADA
> hamma bo'limlariga yoza olishim kerak, chunki mendagi F2 hamma razdellar bo'yicha
> qilinadi." Ya'ni: bitta F2 akt hujjati = butun obyekt (14 lokalka) bo'ylab razdellar.
> Hozir u 14 ta lokalkaga ALOHIDA kirib yozishga majbur — bu ishni to'xtatib turibdi.
>
> Bu hujjat — ANA SHU BITTA OQIMNI boshidan oxirigacha ishlaydigan qilish rejasi.
> Boshqa hamma ish (M3/M4/M5, КС-2, AI...) BUGUNGA TO'XTATILADI.

---

## 0. NIMA ALLAQACHON TAYYOR (tekshirilgan, 2026-07-05)

Bu juda muhim — ishning ~40% allaqachon bor, QAYTA YOZMA:

| Mexanizm | Joyi | Holati |
|---|---|---|
| Parent→bolalar aniqlash `_subObyektlar(parent)` | 05_Papka.js | ✅ TAYYOR (apiOyQosh ishlatadi) |
| **Yozish marshruti `"subOb\|\|varaq"`** — `apiHolatSaqla` varaq nomida `\|\|` ko'rsa, avtomatik TO'G'RI sub-obyekt fayliga yozadi | 30_Panel.js 1632-1646 (`byV[subOb]`, `_plusTop(subOb)`) | ✅ TAYYOR — yozish yo'li allaqachon multi-lokalka! |
| Oy qo'shish parent darajasida (barcha lokalkalarga birdan) | `apiOyQosh` — subs sikli | ✅ TAYYOR |
| Yozuvdan keyin formula ta'mirlash + DASHBOARD | `lrvYoz` (12_LrvIO.js) + apiHolatSaqla `oyYozildi` bloki | ✅ TAYYOR |
| KPI/daraxt render — daraxt qanday bo'lsa shuni yig'adi | Panel.html `_kpi`/`_buildTree` | ✅ TAYYOR (jamlangan daraxt berilsa o'zi to'g'ri yig'adi) |
| F2 import daraxt + avto-moslash + tatbiq | `apiF2FaylOqi`/`f2AvtoMoslash`/`apiF2Qolla` | ✅ bor (bitta obyekt rejimida) |

**Qurish kerak bo'lgan yagona yangi narsa:** o'qish tarafda JAMLANGAN daraxt
(`apiHolatOl` parent-rejimi) + UI'da parent tanlash + 2 ta kichik marshrut yamog'i.

---

## 1-QADAM — `apiHolatOl` PARENT-REJIMI (backend yadro, ~1 soat)

**Fayl:** `30_Panel.js`, `apiHolatOl(obyekt)` funksiyasining ENG BOSHIga qo'shiladi
(mavjud bitta-obyekt mantig'iga TEGILMAYDI — u pastda o'z holicha qoladi):

```js
function apiHolatOl(obyekt){
  // ⚡ JAMLANGAN REJIM: parent papka tanlansa — barcha lokalkalar daraxti birlashtiriladi.
  // Yozish allaqachon "sub||varaq" formatini tushunadi (apiHolatSaqla) — shuning uchun
  // bu yerda har node.varaq shu formatga prefikslanadi, boshqa hech narsa o'zgarmaydi.
  var subs = _subObyektlar(obyekt);
  if (subs.length > 0) {
    var tree = [], oylarSet = {}, xatolar = [];
    for (var si = 0; si < subs.length; si++) {
      var sub = subs[si];
      try {
        var r = apiHolatOl(sub);                    // rekursiya — har sub keshdan (tez)
        (r.oylar || []).forEach(function(o){ oylarSet[o] = 1; });
        (r.tree || []).forEach(function(rz){
          rz.lokalka = sub;                          // UI badge uchun
          _varaqPrefiks(rz, sub);                    // varaq → "sub||varaq"
          tree.push(rz);
        });
      } catch(e) { xatolar.push(sub + ': ' + (e.message || e)); }
    }
    return { tree: tree, oylar: Object.keys(oylarSet), jamlangan: true,
             subs: subs, xatolar: xatolar };
  }
  // ... mavjud kod o'z holicha davom etadi ...
```

Yordamchi (shu faylga):
```js
/* Daraxt tugunlarining varaq maydonini "sub||varaq" ga prefikslaydi (rekursiv).
 * apiHolatSaqla shu formatni allaqachon parse qiladi — yozish to'g'ri faylga boradi. */
function _varaqPrefiks(node, sub){
  if (node.varaq && String(node.varaq).indexOf('||') < 0) node.varaq = sub + '||' + node.varaq;
  (node.children || []).forEach(function(c){ _varaqPrefiks(c, sub); });
}
```

**MUHIM QOIDALAR:**
1. Parent natijasini KESHLAMA (`holat_<parent>` yozma) — bolalar allaqachon keshlangan,
   birlashtirish arzon; parent keshi invalidatsiya chalkashligini keltiradi.
2. Rekursiya xavfsiz: `_subObyektlar(sub)` bola uchun bo'sh qaytadi → cheksiz sikl yo'q.
3. `oylar` — UNION (har lokalkada oy bo'lmasligi mumkin; saqlashda `oyCol[on]` topilmasa
   apiHolatSaqla shunchaki o'tkazib yuboradi — xavfsiz; foydalanuvchiga eslatma: avval
   parent darajasida "+ Oy" bosilsin — u HAMMA lokalkaga yaratadi, bu allaqachon ishlaydi).

**GATE 1:** Apps Script editorda `apiHolatOl('<parent nom>')` RUN → natijada
`jamlangan:true`, tree uzunligi = barcha lokalkalar razdellari yig'indisi, har rz'da
`lokalka` maydoni, har bl/rs `varaq` maydonida `||` bor.

---

## 2-QADAM — MARSHRUT YAMOG'I: `apiBlQosh`/`apiRsQosh` (~20 daqiqa)

Jamlangan rejimda "+ ish qo'shish"/"+ resurs" bosilsa `varaq` `"sub||varaq"` bo'lib keladi,
lekin bu ikki funksiya to'g'ridan `_plusTop(obyekt)` qiladi — YIQILADI. Yamoq (ikkala
funksiyaning boshiga, `_plusTop`dan OLDIN):

```js
  // ⚡ Jamlangan rejim marshruti: varaq "sub||varaq" bo'lsa — yozuv sub-obyektga boradi
  if (String(varaqNom).indexOf('||') >= 0) {
    var _p = String(varaqNom).split('||');
    obyekt = _p[0]; varaqNom = _p[1];
  }
```
(apiRsQosh'da o'zgaruvchi nomlari mos ravishda — funksiya boshida params'dan o'qilgan
joyidan keyin qo'y. `lrvYoz(obyekt, sh)` chaqiruvi ham avtomatik to'g'ri sub bilan ketadi.)

**GATE 2:** jamlangan rejimda bitta razdelga test-ish qo'sh → TO'G'RI lokalka LRV
fayliga tushganini fayl ochib ko'r → testni o'chir.

---

## 3-QADAM — PANEL UI: PARENT TANLASH + LOKALKA BADGE (~1-1.5 soat)

**Fayl:** `Panel.html`.

### 3a. Obyekt tanlagichga "JAMLANGAN" bandlar qo'shish
Skan ro'yxati (`OBJEKTLAR`/kesh) mavjud. Guruhlash **folderId bo'yicha** (nom prefiksiga
ishonma — " - " nomning o'zida bo'lishi mumkin):

```js
// Obyekt selectini to'ldirishda: bitta folderId'da 2+ obyekt bo'lsa —
// ro'yxat BOSHIga sintetik parent qo'shiladi
function _parentlarAniqla(obs){
  var byFolder = {};
  obs.forEach(function(o){ (byFolder[o.folderId] = byFolder[o.folderId] || []).push(o); });
  var parents = [];
  for (var fid in byFolder) {
    if (byFolder[fid].length < 2) continue;
    // parent nomi = umumiy papka nomi (skan obyektida bor: o.papka yoki nomdan ' - ' gacha
    // — qaysi maydon borligini keshdagi skan strukturasidan tekshirib ol!)
    parents.push({ nom: byFolder[fid][0].obyekt.split(' - ')[0], soni: byFolder[fid].length });
  }
  return parents;
}
```
Select'da: `📦 Suniy ko'l — ЖАМЛАНГАН (14 бўлим)` ko'rinishida, value = parent nom.
⚠️ Parent nomni aniqlashda avval keshdagi skan obyektida tayyor papka-nom maydoni
bor-yo'qligini tekshir (`_boglashOl`/`_cfgKalit` bilan izchil bo'lsin) — `split(' - ')`
faqat oxirgi chora.

### 3b. Daraxtda lokalka ko'rinishi
`_rzHtml` boshida:
```js
var lok = rz.lokalka ? '<span style="font-size:9px;color:#7dd3fc;background:rgba(125,211,252,.1);border-radius:4px;padding:0 4px;margin-right:6px">'+esc(rz.lokalka.split(' - ').pop())+'</span>' : '';
```
va rz nomidan oldin chiqarish. BOSHQA HECH NARSA o'zgarmaydi — inputlar `bl.varaq`dan
`data-varaq` oladi (allaqachon prefiksli), saqlash o'z-o'zidan to'g'ri ishlaydi.

### 3c. "+ Oy" tugmasi jamlangan rejimda
`apiOyQosh(parentNom, oyNom)` — allaqachon barcha lokalkaga qo'shadi. UI'da hech narsa
o'zgartirilmaydi, faqat CUR_OB=parent bo'lganda ham ishlashini test qil.

**GATE 3:** Panelda parent tanla → daraxtda hamma lokalka razdellari badge bilan →
KPI = hammasining yig'indisi → bitta bl'ga FAKT kirit + saqla → TO'G'RI lokalka
fayliga yozilganini LRV faylni ochib tasdiqla → F2 oy qiymati kirit + saqla →
ST_F2 o'zgarganini ko'r.

---

## 4-QADAM — F2 IMPORT JAMLANGAN REJIMDA (~1 soat)

F2 akt butun obyekt bo'ylab — endi import ham parent bilan ishlashi kerak.

1. **O'ng panel (smeta daraxti):** F2 import modali `apiHolatOl(CUR_OB)` natijasini
   ishlatadi — CUR_OB=parent bo'lsa jamlangan daraxt AVTOMATIK keladi (1-QADAM tufayli).
   Hech narsa yozma, faqat TEKSHIR: modal parent rejimda ochilganda daraxt chiqadimi
   (K1 bugi shu yerda bo'lsa — birinchi shu tuzatiladi: `_f2Dopps` va konteyner ID
   allaqachon to'g'rilangan, qolgani konsol xatosidan ko'rinadi).
2. **Avto-moslash:** `f2AvtoMoslash` indeksi jamlangan daraxt ustidan quriladi —
   kod+nom+birlik bo'yicha BARCHA lokalkalar ichidan qidiradi. Kod o'zgarishsiz ishlashi
   kerak (daraxt qanday bo'lsa shuni indekslaydi) — TEKSHIR.
3. **Tatbiq (`apiF2Qolla`):** ichida `apiOyQosh(obyekt...)` (parent — hamma lokalkaga oy)
   va `apiHolatSaqla` (prefiksli varaq — to'g'ri marshrutlanadi). Dopps yo'li 2-QADAM
   yamog'i bilan ishlaydi. TEKSHIR: parent rejimda bitta aktни import qilib 2 xil
   lokalkaga tegishli qatorlarga qiymat tushsin.

**GATE 4 (YAKUNIY, foydalanuvchi bilan):** Real obyekt (Suniy ko'l yoki foydalanuvchi
tanlagan ko'p-smetali obyekt) + real F2 akt: import → avto-moslash → tatbiq →
Panel KPI'da F2 summa ko'tarildi → kamida 2 turli lokalka LRV faylida oy ustunlariga
qiymat tushgan → DASHBOARD yangilangan (`selftestLrvOqi` farq≈0).

---

## 5. TAQIQLAR (bugungi ish davomida)

1. `10_Engine.js` narxlash motori, `_ishlaObyekt`, `_faktSaqla/_faktQayta` — TEGILMAYDI.
2. `apiHolatSaqla`ning `||` parse bloki va `oyYozildi` ta'mirlash bloki — TEGILMAYDI
   (ular shu rejaning poydevori).
3. `lrvOqi` faqatJami himoya bloki (marker-oldin-tekshirish) — TEGILMAYDI.
4. Parent keshlash QILINMAYDI (yuqorida sabab).
5. Har QADAM = alohida `clasp push` + o'z GATE'i. GATE o'tmasa — keyingisiga O'TILMAYDI.
6. Ish tugagach foydalanuvchidan deploy ruxsati so'raladi (`clasp push` deploy EMAS).

## 6. ISH TARTIBI XULOSA

```
1-QADAM apiHolatOl parent-rejim (backend)   → GATE 1 (editor test)
2-QADAM apiBlQosh/apiRsQosh || marshruti    → GATE 2 (fayl tekshiruv)
3-QADAM Panel UI parent tanlash + badge     → GATE 3 (fakt/F2 saqlash test)
4-QADAM F2 import parent rejimda            → GATE 4 (real akt, foydalanuvchi bilan)
```

Umumiy hajm: ~4 soat toza ish. Hammasi mavjud mexanizmlar ustiga — YANGI arxitektura
YO'Q, faqat tayyor qismlarni ulash. Omad! 🔥
