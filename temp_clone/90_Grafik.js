/* ============================================================================
 * ГРАФИК РАБОТ (Gantt) — ЧЕЛ-Ч (мехнат соати) асосида, ПАРК бўйича умумий
 * ишчилар сонидан фойдаланиб, қолган ишлар учун тахминий муддатни ҳисоблайди.
 * ============================================================================
 * МОДЕЛЬ (2026-07-10, фойдаланувчи қарори):
 *   1) Фойдаланувчи ПАРК (барча объектлар) бўйича УМУМИЙ ишчилар сонини киритади.
 *   2) Улар ОБЪЕКТЛАР орасида — ҳар объектнинг ҚОЛГАН (ostatka) ЧЕЛ-Ч оғирлигига
 *      ПРОПОРЦИОНАЛ таqсимланади (кўпроқ иш қолган объект — кўпроқ ишчи олади).
 *   3) Ҳар объект ИЧИДА — ажратилган ишчилар РАЗДЕЛЛАР орасида ХУДДИ ШУНДАЙ
 *      (қолган ЧЕЛ-Ч оғирлиги) қоидаси билан таqсимланади.
 *   4) Ҳар РАЗДЕЛ ИЧИДА — иш турлари (BL/mat/ob) СМЕТА ТАРТИБИДА (LRV қатор
 *      тартиби) КЕТМА-КЕТ бажарилади.
 *   5) Объектлар ва разделлар ПАРАЛЛЕЛ — лойиҳа тугаши = ЭНГ УЗОҚ занжир.
 *   6) ФАҚАТ ҚОЛГАН иш ҳисобланади.
 *
 * ⚡⚡⚡ 2026-07-10 ИККИ ЖИДДИЙ ТУЗАТИШ (фойдаланувчи хабар қилган):
 *   A) ФОН ЖАРАЁНИ (async, навбат pattern): аввал ҳисоблаш БИТТА HTTP сўровда
 *      барча объектларни (ва уларнинг барча sub-обyektларини) кетма-кет очиб
 *      чиқарди — катта паркда 6 daqiqalik GAS лимитидан ошиб, "10 daqiqa
 *      осилиб қолиш" муаммосини берарди. Энди ҳар объект АЛОҲИДА триггерда
 *      ишланади (50_Navbat.js даги "Ишла" схемаси билан БИР ХИЛ, синалган
 *      андоза) — ҳеч қачон timeout бўлмайди, натижа КЕШДА сақланади, Panel/
 *      Boss уни ДАРҲОЛ (ҳисоблашсиз) ўқийди.
 *   B) ЧЕЛ-Ч БЎЛМАГАН ИШЛАР ЙЎҚОЛИБ КЕТМАСЛИГИ (масалан электр монтажи,
 *      видеокамера — кўпинча меҳнат соати смeтада кўрсатилмайди): аввал бундай
 *      қатор оddiy ТАШЛАБ ЮБОРИЛАРДИ (жадвалдан бутунлай йўқолиб қоларди).
 *      Энди: ЧЕЛ-Ч бўлмаса → МАШ-Ч (машина-соати) fallback; у ҳам бўлмаса →
 *      шу объект бўйича ЧЕЛ-Ч/сумма ЎРТАЧА нисбатидан тахминий ҳисобланади;
 *      охирги вариант — 1 кунлик минимал заҳира. Ҳар иш `manba` майдони билан
 *      белгиланади ('chel'|'mash'|'taxminiy') — UI буни визуал фарқлайди.
 * ============================================================================ */

var _GRAFIK_PROPS_KEY = { ISHCHI:'GRAFIK_ISHCHI', SOAT:'GRAFIK_SOAT', SANA:'GRAFIK_SANA' };
var _GRAFIK_QUEUE_KEY = 'GRAFIK_QUEUE';
var _GRAFIK_PARAM_KEY = 'GRAFIK_PARAM';
var _GRAFIK_ACC_CACHE = 'grafik_acc';
var _GRAFIK_STATUS_CACHE = 'grafik_status';
var _GRAFIK_NATIJA_CACHE = 'grafik_natija';
var _GRAFIK_TRIGGER_FN = '_grafikNavbatQadam';

function apiGrafikSozlamaOl(){
  var props = PropertiesService.getDocumentProperties();
  return {
    umumiyIshchilar: Number(props.getProperty(_GRAFIK_PROPS_KEY.ISHCHI))||0,
    soatKuni: Number(props.getProperty(_GRAFIK_PROPS_KEY.SOAT))||8,
    boshlanishSana: props.getProperty(_GRAFIK_PROPS_KEY.SANA) || Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd')
  };
}
function _grafikDStr(d){ return Utilities.formatDate(d, 'Asia/Tashkent', 'yyyy-MM-dd'); }

/* Barcha (jamlangan-guruhlangan, PARENT darajasidagi) obyekt nomlarini qaytaradi. */
function _grafikParentObyektlar(){
  var obs = papkaSkan();
  var byFolder = {}, seen = {}, out = [];
  obs.forEach(function(o){ (byFolder[o.folderId]=byFolder[o.folderId]||[]).push(o); });
  for(var fid in byFolder){
    var arr = byFolder[fid];
    var nom = arr.length>1 ? arr[0].obyekt.split(' - ')[0] : arr[0].obyekt;
    if(!seen[nom]){ seen[nom]=true; out.push(nom); }
  }
  return out;
}

/* Bitta obyektning RZ→BL(ketma-ket) qolgan ЧЕЛ-Ч tuzilishini hisoblaydi.
 * ⚡ Fallback zanjiri (B tuzatish) — hech qanday ish yo'qolib ketmasligi uchun. */
function _grafikObyektChel(obNom){
  var data;
  try { data = apiHolatOl(obNom); } catch(e){ return null; }
  var rzList = [];
  var chelSummaPairs = [];   // faqat ЧЕЛ-Ч mavjud tasklar — fallback koeffitsienti uchun

  function taskInfo(n){
    var chelChild=0, mashChild=0;
    (n.children||[]).forEach(function(c){
      if(c.kat==='ЧЕЛ') chelChild += (c.f||0);
      else if(c.kat==='МАШ') mashChild += (c.f||0);
    });
    var frac = (n.smetaHajm>0) ? Math.max(0, Math.min(1, (n.qoldiq||0)/n.smetaHajm)) : 0;
    var qoldiqSumma = (n.smeta||0) * frac;
    return {chel: chelChild*frac, mash: mashChild*frac, summa: qoldiqSumma, frac: frac};
  }

  function walk(nodes){
    nodes.forEach(function(n){
      if(n.type==='rz'){
        var rzAcc = {nom:n.nom, blList:[]};
        (n.children||[]).forEach(function(c){
          if(c.type!=='bl' && c.type!=='mat' && c.type!=='ob') return;
          var info = taskInfo(c);
          if(info.frac<=0.0001) return;   // to'liq bajarilgan — o'tkazamiz
          var item = {nom:c.nom, row:c.row, varaq:c.varaq, chelQolgan:info.chel, _mash:info.mash, _summa:info.summa, manba:'chel'};
          rzAcc.blList.push(item);
          if(info.chel>0.0001) chelSummaPairs.push({chel:info.chel, summa:info.summa});
        });
        if(rzAcc.blList.length) rzList.push(rzAcc);
      } else if(n.children && n.children.length) walk(n.children);
    });
  }
  walk(data.tree||[]);
  if(!rzList.length) return null;

  // ⚡ FALLBACK: ЧЕЛ-Ч yo'q ishlar uchun — MASH-Ч, keyin taxminiy (summa nisbati),
  //   oxirida minimal 1 kunlik zaxira. Hech narsa jadvaldan yo'qolib ketmaydi.
  var avgRatio = 0;
  if(chelSummaPairs.length){
    var sC=0, sS=0;
    chelSummaPairs.forEach(function(p){ sC+=p.chel; sS+=p.summa; });
    avgRatio = sS>0 ? sC/sS : 0;
  }
  var objChel = 0;
  rzList.forEach(function(rz){
    var rzChel=0;
    rz.blList.forEach(function(bl){
      if(bl.chelQolgan<=0.0001 && bl._mash>0.0001){
        bl.chelQolgan = bl._mash; bl.manba='mash';
      } else if(bl.chelQolgan<=0.0001 && avgRatio>0 && bl._summa>0){
        bl.chelQolgan = bl._summa*avgRatio; bl.manba='taxminiy';
      } else if(bl.chelQolgan<=0.0001){
        bl.chelQolgan = 8; bl.manba='taxminiy';   // 1 kunlik (8 soat) minimal zaxira
      }
      delete bl._mash; delete bl._summa;
      rzChel += bl.chelQolgan;
    });
    rz.chelQolgan = rzChel;
    objChel += rzChel;
  });
  if(objChel<=0.0001) return null;
  return {obyekt:obNom, chelQolgan:objChel, rzList:rzList};
}

/* Taqsimlash: to'plangan objData (barcha obyektlar) → park→obyekt→razdel→BL jadvali. */
function _grafikYakunlaHisob(objData, umumiyIshchilar, boshlanishSanaStr, soatKuni){
  umumiyIshchilar = Number(umumiyIshchilar)||0;
  soatKuni = Number(soatKuni)||8;
  var boshlanish = boshlanishSanaStr ? new Date(boshlanishSanaStr) : new Date();
  boshlanish.setHours(0,0,0,0);
  if(isNaN(boshlanish.getTime())) boshlanish = new Date();

  var parkChel = 0;
  objData.forEach(function(od){ parkChel += od.chelQolgan; });
  if(parkChel<=0.0001) return {ok:false, xabar:'Ҳеч қандай қолган иш топилмади — барча ишлар бажарилганми?'};

  var tasks = [], objSummary = [];
  var parkTugash = new Date(boshlanish);

  objData.forEach(function(od){
    var objIshchilar = umumiyIshchilar * (od.chelQolgan/parkChel);

    // ⚡⚡⚡ 2026-07-10 TUZATILDI (foydalanuvchi tushuntirgan qurilish mantiqi):
    //   Avval RAZDELLAR obyekt ichida PARALLEL (barchasi bir kunda boshlanardi) —
    //   bu XATO edi: "ЗЕМЛЯНЫЕ РАБОТЫ / ФУНДАМЕНТ / СТЕНА" каби структура ишлари
    //   тугамасдан ЭЛЕКТР МОНТАЖИ ёки ВИДЕОКАМЕРА (finishing/MEP) БОШЛАНМАЙДИ —
    //   реал қурилишда razdellar SMETA TARTIBIDA (LRV qator tartibida — bu odatda
    //   aynan qurilish bosqichi tartibi) KETMA-KET bajariladi. Endi HAR OBYEKT
    //   ichida BITTA umumiy kursor: razdellar navbat bilan, HAR BIRI shu obyektning
    //   TO'LIQ ajratilgan ishchisini oladi (parallel emas). Faqat OBYEKTLAR
    //   (turli binolar/joylar — alohida brigada bo'lishi mumkin) parallel qoladi.
    var cursor = new Date(boshlanish);

    od.rzList.forEach(function(rz){
      rz.blList.forEach(function(bl){
        var kunlar = bl.chelQolgan / (objIshchilar*soatKuni);
        if(!(kunlar>0) || !isFinite(kunlar)) return;
        var kunSoni = Math.max(1, Math.ceil(kunlar));
        var taskStart = new Date(cursor);
        var taskEnd = new Date(cursor); taskEnd.setDate(taskEnd.getDate()+kunSoni);
        tasks.push({
          id: 't'+tasks.length,
          name: bl.nom,
          obyekt: od.obyekt, razdel: rz.nom,
          start: _grafikDStr(taskStart), end: _grafikDStr(taskEnd),
          ishchilar: Math.round(objIshchilar*10)/10,
          kunlar: kunSoni,
          chelQolgan: Math.round(bl.chelQolgan*10)/10,
          manba: bl.manba||'chel',
          progress: 0
        });
        cursor = taskEnd;
      });
    });
    var objTugash = cursor;   // oxirgi razdelning oxirgi ishi tugashi = obyekt tugashi

    objSummary.push({
      obyekt: od.obyekt,
      ishchilar: Math.round(objIshchilar*10)/10,
      chelQolgan: Math.round(od.chelQolgan),
      tugashSana: _grafikDStr(objTugash),
      kunQoldi: Math.round((objTugash-boshlanish)/86400000)
    });
    if(objTugash>parkTugash) parkTugash = objTugash;
  });

  objSummary.sort(function(a,b){ return a.tugashSana<b.tugashSana?1:-1; });

  return {
    ok:true, tasks:tasks, objSummary:objSummary,
    parkTugash:_grafikDStr(parkTugash),
    parkKunQoldi: Math.round((parkTugash-boshlanish)/86400000),
    parkChelQolgan: Math.round(parkChel),
    umumiyIshchilar:umumiyIshchilar, soatKuni:soatKuni, boshlanish:_grafikDStr(boshlanish),
    hisoblandi: new Date().toISOString()
  };
}

/* ============ ФОН ЖАРАЁНИ (async, 50_Navbat.js "Ишла" андозаси билан БИР ХИЛ) ============
 * Ҳар объект АЛОҲИДА триггерда ишланади — ҳеч қачон 6 daqiqalik GAS лимитига
 * урилмайди. Натижа кешда сақланади, Panel/Boss дарҳол (ҳисоблашсиз) ўқийди. */
function apiGrafikYangilashBoshla(ishchilar, boshlanishSanaStr, soatKuni){
  ishchilar = Number(ishchilar)||0;
  if(ishchilar<=0) return {ok:false, xabar:'Умумий ишчилар сонини киритинг'};
  soatKuni = Number(soatKuni)||8;

  var docProps = PropertiesService.getDocumentProperties();
  docProps.setProperty(_GRAFIK_PROPS_KEY.ISHCHI, String(ishchilar));
  docProps.setProperty(_GRAFIK_PROPS_KEY.SOAT, String(soatKuni));
  if(boshlanishSanaStr) docProps.setProperty(_GRAFIK_PROPS_KEY.SANA, boshlanishSanaStr);

  var scriptProps = PropertiesService.getScriptProperties();
  scriptProps.setProperty(_GRAFIK_PARAM_KEY, JSON.stringify({ishchilar:ishchilar, boshlanishSana:boshlanishSanaStr||'', soatKuni:soatKuni}));
  var parents = _grafikParentObyektlar();
  scriptProps.setProperty(_GRAFIK_QUEUE_KEY, JSON.stringify(parents));

  cachePut(_GRAFIK_ACC_CACHE, [], 3600);
  cachePut(_GRAFIK_STATUS_CACHE, {holat:'ishlanmoqda', jami:parents.length, bajarildi:0, boshlandi:new Date().toISOString()}, 3600);

  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()===_GRAFIK_TRIGGER_FN) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger(_GRAFIK_TRIGGER_FN).timeBased().after(300).create();

  return {ok:true, jami:parents.length};
}

function _grafikNavbatQadam(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()===_GRAFIK_TRIGGER_FN) ScriptApp.deleteTrigger(t); });

  var scriptProps = PropertiesService.getScriptProperties();
  var queue = JSON.parse(scriptProps.getProperty(_GRAFIK_QUEUE_KEY)||'[]');
  var acc = cacheGet(_GRAFIK_ACC_CACHE) || [];
  var status = cacheGet(_GRAFIK_STATUS_CACHE) || {jami:queue.length, bajarildi:0};

  if(queue.length===0){
    try{
      var param = JSON.parse(scriptProps.getProperty(_GRAFIK_PARAM_KEY)||'{}');
      var natija = _grafikYakunlaHisob(acc, param.ishchilar, param.boshlanishSana, param.soatKuni);
      if(natija.ok) cachePut(_GRAFIK_NATIJA_CACHE, natija, 21600);
      cachePut(_GRAFIK_STATUS_CACHE, {holat: natija.ok?'tayyor':'xato', xabar: natija.ok?'':natija.xabar,
        jami:status.jami, bajarildi:status.jami, tugadi:new Date().toISOString()}, 3600);
    }catch(e){
      cachePut(_GRAFIK_STATUS_CACHE, {holat:'xato', xabar:String(e.message||e)}, 3600);
    }
    return;
  }

  var obNom = queue.shift();
  scriptProps.setProperty(_GRAFIK_QUEUE_KEY, JSON.stringify(queue));
  try{
    var od = _grafikObyektChel(obNom);
    if(od) acc.push(od);
  }catch(e){ /* bitta obyekt xato bo'lsa ham davom etamiz */ }
  cachePut(_GRAFIK_ACC_CACHE, acc, 3600);
  cachePut(_GRAFIK_STATUS_CACHE, {holat:'ishlanmoqda', jami:status.jami, bajarildi:(status.bajarildi||0)+1, hozir:obNom}, 3600);

  ScriptApp.newTrigger(_GRAFIK_TRIGGER_FN).timeBased().after(300).create();
}

function apiGrafikHolatOl(){
  return cacheGet(_GRAFIK_STATUS_CACHE) || {holat:'yoq'};
}
function apiGrafikNatijaOl(){
  return cacheGet(_GRAFIK_NATIJA_CACHE) || null;
}

/* ⚡ Kunlik avtomat yangilash (avtoYangilash, 50_Navbat.js) chaqiradi — oxirgi
 * saqlangan sozlamalar bilan fon jarayonini boshlaydi, toza FAKT ma'lumot bilan
 * ertalabgacha tayyor bo'lib turadi. Sozlama yo'q bo'lsa — jim o'tkazadi. */
function _grafikAvtoYangilash(){
  try{
    var s = apiGrafikSozlamaOl();
    if(s.umumiyIshchilar>0) apiGrafikYangilashBoshla(s.umumiyIshchilar, s.boshlanishSana, s.soatKuni);
  }catch(e){ Logger.log('grafik avto: '+e); }
}
