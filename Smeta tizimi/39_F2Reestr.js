/**
 * 39_F2Reestr.js — F2 REESTR (KIRITILGAN HUJJATLAR DAFTARI)
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN (2026-08-15):
 * Foydalanuvchi: «man shu paytgacha o'tkazgan f2 171 122 545 454 so'm
 * bo'lsa 171 122 545 454 so'm smeta nakopitelnimizda ham to'g'ri va aniq
 * kirita olishimiz kerak!»
 *
 * ┌─ ILDIZ MUAMMO ───────────────────────────────────────────────────┐
 * │ Tizimda REESTR yo'q edi. F2 import oy ustunlariga yozardi va     │
 * │ tarqab ketardi. Hech qayerda saqlanmasdi:                        │
 * │   • qaysi F2 hujjati kiritildi, qachon, kim tomonidan            │
 * │   • hujjatning O'Z jami qancha edi                               │
 * │   • smetaga QANCHA tushdi                                        │
 * │   • farq bormi                                                   │
 * │                                                                  │
 * │ `f2uid` izohi — har qatordagi mayda iz, lekin SARLAVHA YOZUVI    │
 * │ yo'q edi. Shuning uchun «171 mlrd kiritdim, 171 mlrd tushdimi?»  │
 * │ degan savolga tizim javob BERA OLMASDI — solishtirish uchun      │
 * │ ikkinchi tomon yo'q edi.                                         │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * BU FAYL: har kiritilgan F2 uchun BITTA qator yozadi va
 *   Σ HUJJAT_JAMI  ↔  Σ YOZILGAN_JAMI
 * solishtiruvini doimiy mumkin qiladi. Farq = 0 → KAFOLAT.
 *
 * MUHIM QOIDA: bu daftar HECH QACHON taxmin qilmaydi. HUJJAT_JAMI
 * bo'sh bo'lsa — bo'sh turadi va holat «ТЕКШИРИЛМАГАН» bo'ladi.
 * Bo'sh joyni to'ldirish uchun son o'ylab topilmaydi.
 */

var F2R_VARAQ = 'F2_REESTR';
var F2R_USTUN = ['F2_ID','OBYEKT','OY','FAYL_NOM','FAYL_ID','SANA','KIM',
                 'HUJJAT_JAMI','YOZILGAN_JAMI','FARQ',
                 'QATOR_JAMI','QATOR_YOZILDI','HOLAT','VARAQLAR','IZOH'];

/* Ustun indeksi (0 dan) — nom bo'yicha */
function _f2rIdx(nom){ return F2R_USTUN.indexOf(nom); }

function _f2rSheet(){
  return _erpSheet(F2R_VARAQ, F2R_USTUN);
}

/* Holatni FAQAT mavjud raqamlardan aniqlaydi — taxmin yo'q */
function _f2rHolat(hujjatJami, yozilganJami){
  var h = Number(hujjatJami)||0, y = Number(yozilganJami)||0;
  if(!h) return 'ТЕКШИРИЛМАГАН';        // hujjat jami noma'lum — baho bermaymiz
  var farq = Math.abs(h - y);
  if(farq <= Math.max(1, h*0.0001)) return 'ТЎЛИҚ';   // 0.01% chidam
  if(y === 0) return 'ЁЗИЛМАГАН';
  return 'ҚИСМАН';
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2ReestrYoz(yozuv) — daftar qatorini qo'shadi yoki yangilaydi
 *
 * yozuv: {f2Id, obyekt, oy, faylNom, faylId, hujjatJami,
 *         yozilganJami, qatorJami, qatorYozildi, varaqlar, izoh}
 *
 * f2Id bo'lsa va topilsa — YANGILAYDI (takror qator yasamaydi).
 * ══════════════════════════════════════════════════════════════════ */
function apiF2ReestrYoz(yozuv){
  try{
    yozuv = yozuv || {};
    if(!yozuv.obyekt || !yozuv.oy) return {ok:false, xabar:'obyekt/oy керак'};

    var sh = _f2rSheet();
    var f2Id = String(yozuv.f2Id || ('F2-' + Date.now() + '-' +
                Math.random().toString(36).slice(2,7))).trim();

    var hj = (yozuv.hujjatJami === '' || yozuv.hujjatJami === null ||
              yozuv.hujjatJami === undefined) ? '' : (Number(yozuv.hujjatJami)||0);
    var yj = Number(yozuv.yozilganJami)||0;
    var farq = (hj === '') ? '' : (hj - yj);

    var kim = '';
    try{ kim = Session.getActiveUser().getEmail() || ''; }catch(e){}

    var qator = [];
    qator[_f2rIdx('F2_ID')]        = f2Id;
    qator[_f2rIdx('OBYEKT')]       = yozuv.obyekt;
    qator[_f2rIdx('OY')]           = yozuv.oy;
    qator[_f2rIdx('FAYL_NOM')]     = yozuv.faylNom || '';
    qator[_f2rIdx('FAYL_ID')]      = yozuv.faylId  || '';
    qator[_f2rIdx('SANA')]         = new Date();
    qator[_f2rIdx('KIM')]          = kim;
    qator[_f2rIdx('HUJJAT_JAMI')]  = hj;
    qator[_f2rIdx('YOZILGAN_JAMI')]= yj;
    qator[_f2rIdx('FARQ')]         = farq;
    qator[_f2rIdx('QATOR_JAMI')]   = Number(yozuv.qatorJami)||0;
    qator[_f2rIdx('QATOR_YOZILDI')]= Number(yozuv.qatorYozildi)||0;
    qator[_f2rIdx('HOLAT')]        = _f2rHolat(hj, yj);
    qator[_f2rIdx('VARAQLAR')]     = (yozuv.varaqlar||[]).join(' | ');
    qator[_f2rIdx('IZOH')]         = yozuv.izoh || '';

    /* Mavjud f2Id ni qidiramiz */
    var mavjud = _erpRows(sh), topRow = 0;
    for(var i=0;i<mavjud.length;i++){
      if(String(mavjud[i][_f2rIdx('F2_ID')]||'').trim() === f2Id){ topRow = i+2; break; }
    }

    if(topRow) sh.getRange(topRow, 1, 1, F2R_USTUN.length).setValues([qator]);
    else       sh.appendRow(qator);

    return {ok:true, f2Id:f2Id, holat:qator[_f2rIdx('HOLAT')],
            farq:farq, yangilandi:!!topRow};
  }catch(e){
    return {ok:false, xabar:'apiF2ReestrYoz: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2ReestrOl(obyekt) — daftar + KAFOLAT hisobi
 *
 * obyekt bo'sh bo'lsa — BARCHA obyektlar (171 mlrd tekshiruvi shu).
 * ══════════════════════════════════════════════════════════════════ */
function apiF2ReestrOl(obyekt){
  try{
    var sh = _f2rSheet();
    var rows = _erpRows(sh);
    var out = [], sHujjat = 0, sYozilgan = 0;
    var nomalum = 0;   // HUJJAT_JAMI kiritilmagan yozuvlar soni

    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      var ob = String(r[_f2rIdx('OBYEKT')]||'');
      if(obyekt && ob !== obyekt) continue;

      var hjRaw = r[_f2rIdx('HUJJAT_JAMI')];
      var hj = (hjRaw === '' || hjRaw === null) ? null : (Number(hjRaw)||0);
      var yj = Number(r[_f2rIdx('YOZILGAN_JAMI')])||0;

      if(hj === null) nomalum++; else sHujjat += hj;
      sYozilgan += yj;

      out.push({
        f2Id:    String(r[_f2rIdx('F2_ID')]||''),
        obyekt:  ob,
        oy:      String(r[_f2rIdx('OY')]||''),
        faylNom: String(r[_f2rIdx('FAYL_NOM')]||''),
        faylId:  String(r[_f2rIdx('FAYL_ID')]||''),
        sana:    r[_f2rIdx('SANA')] ? new Date(r[_f2rIdx('SANA')]).toISOString() : '',
        kim:     String(r[_f2rIdx('KIM')]||''),
        hujjatJami:   hj,
        yozilganJami: yj,
        farq:    (hj === null) ? null : (hj - yj),
        qatorJami:    Number(r[_f2rIdx('QATOR_JAMI')])||0,
        qatorYozildi: Number(r[_f2rIdx('QATOR_YOZILDI')])||0,
        holat:   String(r[_f2rIdx('HOLAT')]||''),
        varaqlar:String(r[_f2rIdx('VARAQLAR')]||''),
        izoh:    String(r[_f2rIdx('IZOH')]||''),
        satr:    i+2
      });
    }

    out.sort(function(a,b){ return (b.sana||'') < (a.sana||'') ? -1 : 1; });

    return {ok:true, obyekt:obyekt||'(барчаси)', yozuvlar:out, soni:out.length,
            /* KAFOLAT: bu ikki raqam teng bo'lishi kerak */
            jamiHujjat:   sHujjat,
            jamiYozilgan: sYozilgan,
            farq:         sHujjat - sYozilgan,
            /* HALOL OGOHLANTIRISH: nomalum yozuvlar jamiHujjat ga kirmaydi,
             * shuning uchun farq ular soniga qarab ishonchsiz bo'ladi */
            hujjatJamiKiritilmagan: nomalum,
            ishonchli: nomalum === 0};
  }catch(e){
    return {ok:false, xabar:'apiF2ReestrOl: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2ReestrHujjatJami(f2Id, summa) — hujjat jamini QO'LDA kiritish
 *
 * Eski (retro) yozuvlar uchun: yozilgani ma'lum, lekin hujjat jami
 * noma'lum. Foydalanuvchi F2 faylidan o'qib kiritadi, holat qayta
 * hisoblanadi.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2ReestrHujjatJami(f2Id, summa){
  try{
    if(!f2Id) return {ok:false, xabar:'f2Id керак'};
    var sh = _f2rSheet(), rows = _erpRows(sh);
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][_f2rIdx('F2_ID')]||'').trim() !== String(f2Id).trim()) continue;
      var hj = Number(summa)||0;
      var yj = Number(rows[i][_f2rIdx('YOZILGAN_JAMI')])||0;
      var r = i+2;
      sh.getRange(r, _f2rIdx('HUJJAT_JAMI')+1).setValue(hj);
      sh.getRange(r, _f2rIdx('FARQ')+1).setValue(hj - yj);
      sh.getRange(r, _f2rIdx('HOLAT')+1).setValue(_f2rHolat(hj, yj));
      return {ok:true, f2Id:f2Id, farq:hj-yj, holat:_f2rHolat(hj, yj)};
    }
    return {ok:false, xabar:'F2_ID топилмади: '+f2Id};
  }catch(e){
    return {ok:false, xabar:'apiF2ReestrHujjatJami: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2ReestrTikla(obyekt) — RETRO TO'LDIRISH
 *
 * Reestr yo'q paytda kiritilgan oylarni daftarga tushiradi.
 * `apiF2Nazorat` bilan LRV_PLUS dan haqiqiy yozilgan summani o'qiydi.
 *
 * ⚠ HUJJAT_JAMI ni BO'SH qoldiradi — chunki eski hujjat jamisi
 * LRV_PLUS da saqlanmagan. Uni foydalanuvchi kiritadi
 * (`apiF2ReestrHujjatJami`). SON O'YLAB TOPILMAYDI.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2ReestrTikla(obyekt){
  var t0 = Date.now();
  try{
    if(!obyekt) return {ok:false, xabar:'Обект берилмади'};
    var n = apiF2Nazorat(obyekt);
    if(!n.ok) return n;

    var qoshildi = 0, yangilandi = 0, natija = [];
    for(var i=0;i<n.oylar.length;i++){
      var o = n.oylar[i];
      var f2Id = 'RETRO-' + obyekt + '-' + o.nom;   // barqaror ID → takrorlanmaydi
      var varaqlar = (o.varaqlar||[]).map(function(v){ return v.varaq; });

      var r = apiF2ReestrYoz({
        f2Id: f2Id, obyekt: obyekt, oy: o.nom,
        faylNom: '', faylId: '',
        hujjatJami: '',                    // ← ATAYLAB BO'SH
        yozilganJami: o.summa,
        qatorJami: o.qatorlar, qatorYozildi: o.qatorlar,
        varaqlar: varaqlar,
        izoh: 'Реестрсиз даврдан тикланди' +
              (o.ikkiBaravarXavfi ? ' ⚠ қатламлар: '+o.pulliQatlamlar.join('+') : '')
      });
      if(r.ok){ r.yangilandi ? yangilandi++ : qoshildi++; }
      natija.push({oy:o.nom, summa:o.summa, qatorlar:o.qatorlar, ok:r.ok});
    }

    return {ok:true, obyekt:obyekt, qoshildi:qoshildi, yangilandi:yangilandi,
            oylar:natija, vaqt:((Date.now()-t0)/1000).toFixed(1)+'s',
            eslatma:'HUJJAT_JAMI бўш қолдирилди — эски ҳужжат жамиси LRV_PLUS да '+
                    'сақланмаган. Уни Ф2 файлидан ўқиб киритинг, шунда фарқ '+
                    'ҳисоби ишончли бўлади.'};
  }catch(e){
    return {ok:false, xabar:'apiF2ReestrTikla: '+(e && e.message ? e.message : e)};
  }
}
