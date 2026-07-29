/********************************************************************
 * 91_BossTahlil.js — BOSS PANEL: PARK DARAJASIDA TAHLIL (fon jarayoni)
 * ==================================================================
 * Maqsad: Boss.html hozirgi holatda faqat Смета/Факт/Ф2/Қолдиқ ko'rsatadi —
 * tizimda ALLAQACHON mavjud (lekin faqat bitta obyekt uchun, Panel chatida
 * qo'lda so'ralganda ishlaydigan) anomaliya/prognoz mexanizmini (68_AI_Tahlil.js
 * _aiAnomOl/_aiPrognozHisob — bular SOF MATEMATIK, Gemini/AI kaliti SHART EMAS)
 * BUTUN PARK bo'ylab yig'ib, "qaysi obyektlar xavfli", "qачон tugaydi" degan
 * yagona ko'rinish beradi.
 *
 * ⚡ ASYNC/NAVBAT ANDOZASI (90_Grafik.js bilan BIR XIL — [[park-bolib-hisoblash-async-qoida]]):
 * butun parkni bitta so'rovda skanlash GAS 6-daqiqalik limitiga uradi. Shuning
 * uchun har obyekt ALOHIDA triggerda ishlanadi.
 ********************************************************************/

var _BOSSTAHLIL_QUEUE_KEY   = 'BOSSTAHLIL_QUEUE';
var _BOSSTAHLIL_ACC_CACHE   = 'bosstahlil_acc';
var _BOSSTAHLIL_STATUS_CACHE= 'bosstahlil_status';
var _BOSSTAHLIL_NATIJA_CACHE= 'bosstahlil_natija';
var _BOSSTAHLIL_TRIGGER_FN  = '_bossTahlilNavbatQadam';

/* Fon jarayonini boshlaydi — Boss.html "🤖 Хавфли объектлар / трend" tugmasi chaqiradi. */
function apiBossTahlilBoshla(){
  var parents = (typeof _grafikParentObyektlar==='function') ? _grafikParentObyektlar() : [];
  if(!parents.length) return {ok:false, xabar:'Обyektlar topilmadi'};

  var scriptProps = PropertiesService.getScriptProperties();
  scriptProps.setProperty(_BOSSTAHLIL_QUEUE_KEY, JSON.stringify(parents));

  cachePut(_BOSSTAHLIL_ACC_CACHE, {xavfli:[], prognoz:[], oylik:{}, rzFlat:[]}, 3600);
  cachePut(_BOSSTAHLIL_STATUS_CACHE, {holat:'ishlanmoqda', jami:parents.length, bajarildi:0, boshlandi:new Date().toISOString()}, 3600);

  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()===_BOSSTAHLIL_TRIGGER_FN) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger(_BOSSTAHLIL_TRIGGER_FN).timeBased().after(300).create();

  return {ok:true, jami:parents.length};
}

function apiBossTahlilHolatOl(){
  var st = cacheGet(_BOSSTAHLIL_STATUS_CACHE);
  if(!st) return {holat:'yoq'};
  return st;
}

function apiBossTahlilNatijaOl(){
  var r = cacheGet(_BOSSTAHLIL_NATIJA_CACHE);
  if(!r) return {ok:false, xabar:'Ҳали ҳисобланмаган'};
  return r;
}

/* Har ijroda BITTA obyektni ishlaydi (navbat-pattern — 50_Navbat.js/90_Grafik.js bilan bir xil). */
function _bossTahlilNavbatQadam(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()===_BOSSTAHLIL_TRIGGER_FN) ScriptApp.deleteTrigger(t); });

  var scriptProps = PropertiesService.getScriptProperties();
  var navbat = [];
  try{ navbat = JSON.parse(scriptProps.getProperty(_BOSSTAHLIL_QUEUE_KEY)||'[]'); }catch(e){}
  if(!navbat.length){ _bossTahlilYakunla(); return; }

  var obNom = navbat.shift();
  scriptProps.setProperty(_BOSSTAHLIL_QUEUE_KEY, JSON.stringify(navbat));

  try{
    var acc = cacheGet(_BOSSTAHLIL_ACC_CACHE) || {xavfli:[], prognoz:[], oylik:{}, rzFlat:[]};
    if(!acc.rzFlat) acc.rzFlat=[];
    var b = apiBossObyekt(obNom);
    var t = b.total||{};
    var smeta=_toNum(t.res), fakt=_toNum(t.fakt), f2=_toNum(t.f2), ost=_toNum(t.ost);

    // 1) ANOMALIYA (sof matematik — _aiAnomOl AI kalitisiz ham ishlaydi, chunki
    //    faqat apiAiAnomaliya (matn) AI talab qiladi, _aiAnomOl EMAS)
    if(typeof _aiAnomOl==='function'){
      try{
        var an = _aiAnomOl(obNom) || [];
        an.forEach(function(a){ acc.xavfli.push({obyekt:obNom, qoida:a.qoida, tavsif:a.tavsif, qiymat:a.qiymat||0, daraja:a.daraja||'ogohlantirish'}); });
      }catch(e){}
    }

    // 2) PROGNOZ (sof matematik)
    if(typeof _aiPrognozHisob==='function' && smeta>0){
      try{
        var p = _aiPrognozHisob(obNom);
        if(!p.error){
          acc.prognoz.push({obyekt:obNom, smeta:smeta, fakt:fakt, f2:f2, ost:ost,
            progress:t.progress||0, velocity:p.velocity||0, oyQoldi:p.oyQoldi||0,
            tugashSana:p.tugashSana||'', f2Orqada:!!p.f2Orqada});
        }
      }catch(e){}
    }

    // 3) OYLIK TREND — park bo'ylab F2 summasini oy nomi bo'yicha qo'shamiz
    (b.oylar||[]).forEach(function(o){
      var oy=String(o.oy||'').trim(); if(!oy) return;
      var val=_toNum(o.val);
      acc.oylik[oy] = (acc.oylik[oy]||0) + val;
    });

    // 4) RAZDEL darajasidagi xom ma'lumot — YAKUNDA Д1-Д5 (РАЗДЕЛЛАР reestr)
    //    bilan birlashtirib, PARK darajasidagi ИЕРАРХИЯ daraxti quriladi
    //    (foydalanuvchi talabi: "Boss panel ham to'liq ierarxiya bo'yicha
    //    ochib bera olishi kerak" — avval faqat Shartnoma→Obyekt→Razdel FLAT edi).
    (b.rzList||[]).forEach(function(rz){
      acc.rzFlat.push({obyekt:obNom, rzNom:rz.nom, res:_toNum(rz.res), fakt:_toNum(rz.fakt),
        f2:_toNum(rz.f2), ost:_toNum(rz.ost)});
    });

    cachePut(_BOSSTAHLIL_ACC_CACHE, acc, 3600);
  }catch(e){
    Logger.log('bossTahlil xato ('+obNom+'): '+e);
  }

  var totalQueued = JSON.parse(scriptProps.getProperty(_BOSSTAHLIL_QUEUE_KEY)||'[]').length;
  var st = cacheGet(_BOSSTAHLIL_STATUS_CACHE) || {jami:0, bajarildi:0};
  st.bajarildi = (st.jami||0) - totalQueued;
  st.hozir = obNom;
  cachePut(_BOSSTAHLIL_STATUS_CACHE, st, 3600);

  if(navbat.length){
    ScriptApp.newTrigger(_BOSSTAHLIL_TRIGGER_FN).timeBased().after(300).create();
  } else {
    _bossTahlilYakunla();
  }
}

function _bossTahlilYakunla(){
  var acc = cacheGet(_BOSSTAHLIL_ACC_CACHE) || {xavfli:[], prognoz:[], oylik:{}, rzFlat:[]};

  // Xavf darajasi bo'yicha tartiblash (kritik birinchi)
  var rank={kritik:0, xato:1, ogohlantirish:2};
  acc.xavfli.sort(function(a,b){ return (rank[a.daraja]||9)-(rank[b.daraja]||9); });

  // Prognoz: Ф2 orqada qolganlarni va tez orada tugamaydiganlarni birinchi ko'rsatamiz
  acc.prognoz.sort(function(a,b){
    if(!!b.f2Orqada !== !!a.f2Orqada) return (b.f2Orqada?1:0)-(a.f2Orqada?1:0);
    return (b.oyQoldi||0)-(a.oyQoldi||0);
  });

  // Oylik trend — kalendar tartibida (kalit "MM.yyyy" yoki "Oy nomi yyyy" bo'lishi mumkin,
  // shuning uchun _oyKey bilan solishtirib emas, faqat MATN sifatida saqlab qaytaramiz —
  // Boss.html eng oxirgi ~12 tasini ko'rsatadi).
  var oylikArr = Object.keys(acc.oylik).map(function(k){ return {oy:k, val:Math.round(acc.oylik[k])}; });

  // ⚡ 2026-07-13: PARK DARAJASIDAGI Д1-Д5 ИЕРАРХИЯ — Panel.html _buildTree bilan
  // BIR XIL qoida (rzNom kalit — bir xil nomli razdel bir xil tasnifni ulashadi).
  var ierarxiya = _bossIerarxiyaQur(acc.rzFlat||[]);

  var natija = {ok:true, xavfli:acc.xavfli, prognoz:acc.prognoz, oylik:oylikArr,
    ierarxiya:ierarxiya, hisoblandi: new Date().toISOString()};
  cachePut(_BOSSTAHLIL_NATIJA_CACHE, natija, 21600);
  cachePut(_BOSSTAHLIL_STATUS_CACHE, {holat:'tayyor', jami:(cacheGet(_BOSSTAHLIL_STATUS_CACHE)||{}).jami||0}, 3600);
}

/* rzFlat=[{obyekt,rzNom,res,fakt,f2,ost}] + РАЗДЕЛЛАР reestr (Д1-Д5) dan
 * Д1→Д2→Д3 (nested) moliyaviy daraxt quradi. Tasniflanmagan (Д1 yo'q) razdellar
 * "Тасниф йўқ" guruhida yig'iladi — hech narsa yo'qolmasin. */
function _bossIerarxiyaQur(rzFlat){
  var darajalar = (typeof apiDarajalarBarchaOl==='function') ? apiDarajalarBarchaOl() : [];
  var pathMap = {};   // rzNom -> [d1,d2,d3]
  darajalar.forEach(function(r){
    var path=[r.d1,r.d2,r.d3].filter(Boolean);
    if(path.length) pathMap[r.rzNom]=path;
  });

  var root = {label:'ROOT', ch:{}, jami:{res:0,fakt:0,f2:0,ost:0}, razdellar:[]};
  var tasniflanmagan = {label:'Тасниф йўқ', razdellar:[], jami:{res:0,fakt:0,f2:0,ost:0}};

  function getOrCreate(parent, label){
    if(!parent.ch[label]) parent.ch[label] = {label:label, ch:{}, jami:{res:0,fakt:0,f2:0,ost:0}, razdellar:[]};
    return parent.ch[label];
  }
  function qoshJami(node, rz){
    node.jami.res+=rz.res; node.jami.fakt+=rz.fakt; node.jami.f2+=rz.f2; node.jami.ost+=rz.ost;
  }

  rzFlat.forEach(function(rz){
    var path = pathMap[rz.rzNom];
    if(!path || !path.length){
      tasniflanmagan.razdellar.push(rz);
      qoshJami(tasniflanmagan, rz);
      return;
    }
    var cur = root;
    path.forEach(function(lbl){ cur = getOrCreate(cur, lbl); qoshJami(cur, rz); });
    cur.razdellar.push(rz);
    qoshJami(root, rz);
  });
  if(tasniflanmagan.razdellar.length){
    qoshJami(root, tasniflanmagan);
    root.ch[tasniflanmagan.label]=tasniflanmagan;
  }

  // Chuqur ob'ektni JSON-serializable (massiv, ch obyekt emas) shaklga o'giramiz
  function toArr(node){
    return {
      label: node.label, jami: node.jami,
      razdellar: node.razdellar,
      children: Object.keys(node.ch||{}).map(function(k){ return toArr(node.ch[k]); })
        .sort(function(a,b){ return b.jami.res-a.jami.res; })
    };
  }
  return toArr(root).children;
}
