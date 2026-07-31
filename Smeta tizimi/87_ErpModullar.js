/********************************************************************
 * 87_ErpModullar.js — ERP: Kadrlar, Texnika, Ta'minot, Sifat
 * ==================================================================
 * ⚡ 2026-07-31: Frontend'dagi Kadrlar/Texnika/Ta'minot/Sifat sahifalari
 * TO'LIQ SUN'IY (mock, Math.random) ma'lumot bilan ishlab kelgan edi —
 * hech qanday real GAS backend yo'q edi. Bu fayl shu 4 modul uchun
 * HAQIQIY, varaqqa asoslangan backend beradi.
 *
 * Barcha yangi varaqlar markaziy _SERVER_DASHBOARD faylida yashaydi
 * (xuddi ХАРАЖАТЛАР kabi, _serverSS(sozAsosiy()) orqali).
 *
 * ⚠️ MUHIM: Bu varaqlar YANGI va DASTLAB BO'SH. Dashboardlar haqiqiy
 * nol/bo'sh holatni ko'rsatadi — bu SOXTA raqamlardan ko'ra to'g'ri.
 * Haqiqiy foydalanish uchun frontendda "qo'shish" formalari kerak
 * (alohida bosqichda qo'shiladi).
 ********************************************************************/

function _erpSS(){ return _serverSS(sozAsosiy()); }

function _erpSheet(nom, headers){
  var ss=_erpSS();
  var sh=ss.getSheetByName(nom);
  if(!sh){
    sh=ss.insertSheet(nom);
    sh.appendRow(headers);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#f3f4f6');
    sh.setFrozenRows(1);
  }
  return sh;
}

function _erpRows(sh){
  var last=sh.getLastRow();
  if(last<2) return [];
  return sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
}

function _erpId(prefix){
  return prefix + Utilities.getUuid().slice(0,8);
}

function _erpBugun(){
  return Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd');
}

/* ══════════════════════════════════════════════════════════════════
 * 1) KADRLAR VA TABEL
 * ══════════════════════════════════════════════════════════════════ */
function _ishchilarSheet(){ return _erpSheet('ISHCHILAR', ['ID','ISM','KASB','STAVKA','BRIGADA','OBYEKT','TELEFON','STATUS']); }
function _tabelSheet(){ return _erpSheet('TABEL', ['ISHCHI_ID','SANA','HOLAT']); }

function apiKadrlarDashboard(oy){
  oy = oy || Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM');
  var ishRows = _erpRows(_ishchilarSheet());
  var ishchilar = ishRows.map(function(r){
    return { id:String(r[0]), ism:String(r[1]||''), kasb:String(r[2]||''), stavka:_toNum(r[3]),
      brigada:String(r[4]||''), obyekt:String(r[5]||''), telefon:String(r[6]||''),
      status: String(r[7]||'faol').trim() || 'faol' };
  }).filter(function(x){ return x.id; });

  var tabRows = _erpRows(_tabelSheet()).map(function(r){
    return { ishchiId:String(r[0]), sana:String(r[1]||''), holat:(String(r[2]||'').trim()||null) };
  }).filter(function(x){ return x.ishchiId && x.sana; });

  var bugun = _erpBugun();
  var oydagiKunlarSoni = new Date(Number(oy.split('-')[0]), Number(oy.split('-')[1]), 0).getDate();

  var tabellar = ishchilar.map(function(ish){
    var oyTab = tabRows.filter(function(t){ return t.ishchiId===ish.id && t.sana.indexOf(oy)===0; });
    var kunlar = [];
    var ishlaganKunlar = 0;
    for(var i=1;i<=oydagiKunlarSoni;i++){
      var sanaStr = oy+'-'+(i<10?'0'+i:i);
      var rec = oyTab.filter(function(t){ return t.sana===sanaStr; })[0];
      var holat = rec ? rec.holat : null;
      if(holat==='keldi') ishlaganKunlar++;
      kunlar.push({ sana:i, holat:holat });
    }
    return { ishchiId:ish.id, oy:oy, kunlar:kunlar, ishlaganKunlar:ishlaganKunlar,
      xisoblanganOylik: ishlaganKunlar*ish.stavka };
  });

  var faolIshchilar = ishchilar.filter(function(x){ return x.status==='faol'; });
  var bugunKelganlar = tabRows.filter(function(t){ return t.sana===bugun && t.holat==='keldi'; }).length;
  var bugungiDavomat = faolIshchilar.length>0 ? Math.round(bugunKelganlar/faolIshchilar.length*100) : 0;
  var oylikFond = tabellar.reduce(function(acc,t){ return acc+t.xisoblanganOylik; },0);

  return {
    ishchilar: ishchilar,
    tabellar: tabellar,
    jamiFaolIshchilar: faolIshchilar.length,
    bugungiDavomat: bugungiDavomat,
    oylikFond: oylikFond,
    berilganAvanslar: 0 // hali alohida avans varaqi yo'q — soxta raqam qo'yilmaydi
  };
}

function apiIshchiQosh(d){
  if(!d || !d.ism) throw 'ISM kerak';
  var sh=_ishchilarSheet();
  var id=_erpId('ish_');
  sh.appendRow([id, String(d.ism).trim(), String(d.kasb||''), _toNum(d.stavka),
    String(d.brigada||''), String(d.obyekt||''), String(d.telefon||''), 'faol']);
  return {ok:true, id:id};
}

function apiIshchiTahrir(d){
  if(!d || !d.id) throw 'ID kerak';
  var sh=_ishchilarSheet();
  var rows=_erpRows(sh);
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][0])===String(d.id)){
      var row=i+2;
      sh.getRange(row,1,1,8).setValues([[d.id, String(d.ism||rows[i][1]), String(d.kasb||rows[i][2]),
        d.stavka!=null?_toNum(d.stavka):rows[i][3], String(d.brigada||rows[i][4]), String(d.obyekt||rows[i][5]),
        String(d.telefon||rows[i][6]), String(d.status||rows[i][7])]]);
      return {ok:true};
    }
  }
  throw 'Ishchi topilmadi: '+d.id;
}

function apiIshchiOchir(id){
  // Soft-delete: yozuvni o'chirmaymiz, "bo'shatilgan" deb belgilaymiz (tarix yo'qolmasin)
  return apiIshchiTahrir({id:id, status:'bo\'shatilgan'});
}

function apiTabelBelgila(d){
  if(!d || !d.ishchiId || !d.sana) throw 'ishchiId va sana kerak';
  var sh=_tabelSheet();
  var rows=_erpRows(sh);
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][0])===String(d.ishchiId) && String(rows[i][1])===String(d.sana)){
      sh.getRange(i+2,3).setValue(String(d.holat||''));
      return {ok:true};
    }
  }
  sh.appendRow([String(d.ishchiId), String(d.sana), String(d.holat||'')]);
  return {ok:true};
}

/* ══════════════════════════════════════════════════════════════════
 * 2) TEXNIKA VA YOQILG'I
 * ══════════════════════════════════════════════════════════════════ */
function _texnikaSheet(){ return _erpSheet('TEXNIKA', ['ID','NOM','DAVLAT_RAQAMI','TURI','HOLAT','OBYEKT','HAYDOVCHI','SOATLIK_NORMA','OLDINGI_QOLDIQ']); }
function _texnikaTarixSheet(){ return _erpSheet('TEXNIKA_TARIX', ['ID','TEXNIKA_ID','SANA','KIRIM_LITR','CHIQIM_LITR','MOTOCHAS','IZOH']); }

function apiTexnikaDashboard(){
  var texnikalar = _erpRows(_texnikaSheet()).map(function(r){
    return { id:String(r[0]), nom:String(r[1]||''), davlatRaqami:String(r[2]||''), turi:String(r[3]||'Boshqa'),
      holat:String(r[4]||'Kutishda'), obyekt:String(r[5]||''), haydovchi:String(r[6]||''),
      soatlikNorma:_toNum(r[7]), oldingiQoldiq:_toNum(r[8]) };
  }).filter(function(x){ return x.id; });

  var tarix = _erpRows(_texnikaTarixSheet()).map(function(r){
    return { id:String(r[0]), texnikaId:String(r[1]), sana:String(r[2]||''), kirimLitr:_toNum(r[3]),
      chiqimLitr:_toNum(r[4]), motochas:_toNum(r[5]), izoh:String(r[6]||'') };
  }).filter(function(x){ return x.id; });

  var hisoblanganTexnikalar = texnikalar.map(function(t){
    var qoldiq = t.oldingiQoldiq;
    tarix.filter(function(tr){ return tr.texnikaId===t.id; }).forEach(function(h){
      if(h.kirimLitr) qoldiq += h.kirimLitr;
      if(h.chiqimLitr) qoldiq -= h.chiqimLitr;
      if(h.motochas && t.soatlikNorma) qoldiq -= (h.motochas*t.soatlikNorma);
    });
    return Object.assign({}, t, {yoqilgiQoldiq:qoldiq});
  });

  var oy = Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM');
  var oylikYoqilgi = tarix.filter(function(t){ return t.sana.indexOf(oy)===0; })
    .reduce(function(acc,t){ return acc+(t.kirimLitr||0); },0);

  return {
    texnikalar: hisoblanganTexnikalar,
    tarix: tarix,
    jamiTexnika: texnikalar.length,
    faolTexnika: texnikalar.filter(function(t){ return t.holat==='Ishlayapti'; }).length,
    remontda: texnikalar.filter(function(t){ return t.holat==='Remontda'; }).length,
    oylikYoqilgi: oylikYoqilgi,
  };
}

function apiTexnikaQosh(d){
  if(!d || !d.nom) throw 'NOM kerak';
  var sh=_texnikaSheet();
  var id=_erpId('tex_');
  sh.appendRow([id, String(d.nom).trim(), String(d.davlatRaqami||''), String(d.turi||'Boshqa'),
    String(d.holat||'Ishlayapti'), String(d.obyekt||''), String(d.haydovchi||''),
    _toNum(d.soatlikNorma), _toNum(d.oldingiQoldiq)]);
  return {ok:true, id:id};
}

function apiTexnikaTahrir(d){
  if(!d || !d.id) throw 'ID kerak';
  var sh=_texnikaSheet();
  var rows=_erpRows(sh);
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][0])===String(d.id)){
      var row=i+2;
      sh.getRange(row,1,1,9).setValues([[d.id, String(d.nom||rows[i][1]), String(d.davlatRaqami||rows[i][2]),
        String(d.turi||rows[i][3]), String(d.holat||rows[i][4]), String(d.obyekt||rows[i][5]),
        String(d.haydovchi||rows[i][6]), d.soatlikNorma!=null?_toNum(d.soatlikNorma):rows[i][7],
        d.oldingiQoldiq!=null?_toNum(d.oldingiQoldiq):rows[i][8]]]);
      return {ok:true};
    }
  }
  throw 'Texnika topilmadi: '+d.id;
}

function apiTexnikaTarixQosh(d){
  if(!d || !d.texnikaId) throw 'texnikaId kerak';
  var sh=_texnikaTarixSheet();
  var id=_erpId('tt_');
  sh.appendRow([id, String(d.texnikaId), String(d.sana||_erpBugun()), _toNum(d.kirimLitr),
    _toNum(d.chiqimLitr), _toNum(d.motochas), String(d.izoh||'')]);
  return {ok:true, id:id};
}

/* ══════════════════════════════════════════════════════════════════
 * 3) TA'MINOT VA OMBOR
 * ==================================================================
 * materiallar — HAQIQIY apiSkladQoldiq() (86_Sklad.js, Приход/Расход
 * varaqlaridan) dan olinadi. Sklad markazlashgan (bitta ombor), shuning
 * uchun har bir material uchun obyekt="Markaziy Sklad". Sklad narx
 * (smeta/fakt) hisobini yuritmaydi — faqat miqdor — shuning uchun
 * smetaNarxi/faktNarxi=0 (SOXTA raqam qo'yilmaydi).
 * zayavkalar/postavshiklar uchun tizimda hali manba yo'q edi — yangi
 * ZAYAVKA/POSTAVSHIK varaqlari yaratildi (dastlab bo'sh).
 * ══════════════════════════════════════════════════════════════════ */
function _zayavkaSheet(){ return _erpSheet('ZAYAVKA', ['ID','SANA','OBYEKT','PRORAB','MATERIAL','BIRLIK','MIQDOR','STATUS','IZOH']); }
function _postavshikSheet(){ return _erpSheet('POSTAVSHIK', ['ID','NOM','TELEFON','YETKAZILGAN_SUMMA','QARZIMIZ']); }

function apiTaminotDashboard(){
  var sklad;
  try{ sklad = apiSkladQoldiq(); }catch(e){ sklad = {ok:false, materiallar:[]}; }
  var materiallar = (sklad.ok!==false ? (sklad.materiallar||[]) : []).map(function(m, idx){
    return { id:'mat_'+idx, guruh:'Asosiy', nom:m.nom, birlik:m.birlik, obyekt:'Markaziy Sklad',
      qoldiq:m.qoldiq, minQoldiq:0, smetaNarxi:0, faktNarxi:0 };
  });

  var zayavkalar = _erpRows(_zayavkaSheet()).map(function(r){
    return { id:String(r[0]), sana:String(r[1]||''), obyekt:String(r[2]||''), prorab:String(r[3]||''),
      material:String(r[4]||''), birlik:String(r[5]||''), miqdor:_toNum(r[6]), status:String(r[7]||''), izoh:String(r[8]||'') };
  }).filter(function(x){ return x.id; });

  var postavshiklar = _erpRows(_postavshikSheet()).map(function(r){
    return { id:String(r[0]), nom:String(r[1]||''), telefon:String(r[2]||''), yetkazilganSumma:_toNum(r[3]), qarzimiz:_toNum(r[4]) };
  }).filter(function(x){ return x.id; });

  var yangiZayavkalarSoni = zayavkalar.filter(function(z){
    return z.status==='Obyektdan so\'rov' || z.status==='Omborda tekshirilmoqda';
  }).length;
  var kritikMateriallarSoni = materiallar.filter(function(m){ return m.qoldiq<=m.minQoldiq; }).length;
  var jamiQarzimiz = postavshiklar.reduce(function(acc,p){ return acc+p.qarzimiz; },0);
  var smetaNarxidanOshganlar = materiallar.filter(function(m){ return m.faktNarxi>m.smetaNarxi; }).length;

  return {
    zayavkalar: zayavkalar,
    materiallar: materiallar,
    postavshiklar: postavshiklar,
    yangiZayavkalarSoni: yangiZayavkalarSoni,
    kritikMateriallarSoni: kritikMateriallarSoni,
    jamiQarzimiz: jamiQarzimiz,
    smetaNarxidanOshganlar: smetaNarxidanOshganlar,
  };
}

function apiZayavkaQosh(d){
  if(!d || !d.material) throw 'MATERIAL kerak';
  var sh=_zayavkaSheet();
  var id=_erpId('z_');
  sh.appendRow([id, String(d.sana||_erpBugun()), String(d.obyekt||''), String(d.prorab||''),
    String(d.material).trim(), String(d.birlik||''), _toNum(d.miqdor), String(d.status||'Obyektdan so\'rov'), String(d.izoh||'')]);
  return {ok:true, id:id};
}

function apiZayavkaHolatYangila(id, status){
  var sh=_zayavkaSheet();
  var rows=_erpRows(sh);
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][0])===String(id)){ sh.getRange(i+2,8).setValue(String(status)); return {ok:true}; }
  }
  throw 'Zayavka topilmadi: '+id;
}

function apiPostavshikQosh(d){
  if(!d || !d.nom) throw 'NOM kerak';
  var sh=_postavshikSheet();
  var id=_erpId('p_');
  sh.appendRow([id, String(d.nom).trim(), String(d.telefon||''), _toNum(d.yetkazilganSumma), _toNum(d.qarzimiz)]);
  return {ok:true, id:id};
}

function apiPostavshikTahrir(d){
  if(!d || !d.id) throw 'ID kerak';
  var sh=_postavshikSheet();
  var rows=_erpRows(sh);
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][0])===String(d.id)){
      var row=i+2;
      sh.getRange(row,1,1,5).setValues([[d.id, String(d.nom||rows[i][1]), String(d.telefon||rows[i][2]),
        d.yetkazilganSumma!=null?_toNum(d.yetkazilganSumma):rows[i][3],
        d.qarzimiz!=null?_toNum(d.qarzimiz):rows[i][4]]]);
      return {ok:true};
    }
  }
  throw 'Postavshik topilmadi: '+d.id;
}

/* ══════════════════════════════════════════════════════════════════
 * 4) SIFAT NAZORATI (TEXNADZOR)
 * ══════════════════════════════════════════════════════════════════ */
function _nuqsonSheet(){ return _erpSheet('NUQSON', ['ID','OBYEKT','PRORAB','SANA','MUDDAT','TAVSIF','DARAJA','STATUS','IZOH']); }

function apiSifatDashboard(){
  var nuqsonlar = _erpRows(_nuqsonSheet()).map(function(r){
    return { id:String(r[0]), obyekt:String(r[1]||''), prorab:String(r[2]||''), sana:String(r[3]||''),
      muddat:String(r[4]||''), tavsif:String(r[5]||''), daraja:String(r[6]||'Oddiy'),
      status:String(r[7]||'Yangi'), izoh:String(r[8]||'') };
  }).filter(function(x){ return x.id; });

  var bugun=_erpBugun();
  // Muddati o'tgan bo'lsa-yu hali "Tuzatildi" bo'lmasa, statusni real vaqtga qarab yangilaymiz
  nuqsonlar.forEach(function(n){
    if(n.status!=='Tuzatildi' && n.muddat && n.muddat<bugun) n.status='Muddati o\'tgan';
  });

  return {
    nuqsonlar: nuqsonlar,
    jamiNuqsonlar: nuqsonlar.length,
    tuzatilganlar: nuqsonlar.filter(function(n){ return n.status==='Tuzatildi'; }).length,
    muddatOtilgan: nuqsonlar.filter(function(n){ return n.status==='Muddati o\'tgan'; }).length,
    kritik: nuqsonlar.filter(function(n){ return n.daraja==='Kritik' && n.status!=='Tuzatildi'; }).length,
  };
}

function apiNuqsonQosh(d){
  if(!d || !d.tavsif) throw 'TAVSIF kerak';
  var sh=_nuqsonSheet();
  var id=_erpId('n_');
  sh.appendRow([id, String(d.obyekt||''), String(d.prorab||''), String(d.sana||_erpBugun()),
    String(d.muddat||''), String(d.tavsif).trim(), String(d.daraja||'Oddiy'), String(d.status||'Yangi'), String(d.izoh||'')]);
  return {ok:true, id:id};
}

function apiNuqsonHolatYangila(id, status){
  var sh=_nuqsonSheet();
  var rows=_erpRows(sh);
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][0])===String(id)){ sh.getRange(i+2,8).setValue(String(status)); return {ok:true}; }
  }
  throw 'Nuqson topilmadi: '+id;
}
