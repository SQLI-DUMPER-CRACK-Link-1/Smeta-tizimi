/********************************************************************
 * 25_Kesh.gs — KESH (CACHE) TIZIMI  [CacheService asosida]
 * ==================================================================
 * Avval kesh _KESH varaqida saqlanardi → o'qish/yozish sekin (~1-2 sek)
 * va 45000 belgi limiti (holat keshlanmasdi).
 *
 * ENDI: CacheService.getScriptCache() — xotirada, millisekundlik o'qish.
 *   - gzip + base64 → JSON siqiladi (~5-10x)
 *   - chunk → 100KB/kalit limitidan oshganda key__0/key__1... ga bo'linadi
 *   - 'skan' kaliti qo'shimcha _KESH varaqqa ham yoziladi (durable fallback,
 *     CacheService evict bo'lsa tiklash uchun) — holat varaqqa YOZILMAYDI.
 *
 * Tashqi API (signature O'ZGARMAYDI — chaqiruvchilarga tegmaydi):
 *   _keshYoz(key,data) / _keshOl(key) / _keshOlStale(key)
 *   apiKeshOl(key) / apiKeshHolat() / apiKeshSkanYangilash() / apiKeshYangilash()
 *
 * Yangi past-daraja API:
 *   cachePut(key,obj,ttl) / cacheGet(key) / cacheDel(key)
 *
 * Kesh kalitlari:
 *   'skan'            → papkaSkan natijalari (durable)
 *   'holat_<obyekt>'  → apiHolatOl natijalari (faqat CacheService)
 *   'boss_<obyekt>'   → apiBossObyekt natijalari
 ********************************************************************/

var _KESH_SH   = '_KESH';
var _KESH_TTL  = 3600;   // sekund — _keshOl TTL semantikasi (skan eskirishi)

/* CacheService chegaralari */
var _CACHE_TTL_DEFAULT = 21600; // 6 soat — CacheService MAX
var _CACHE_CHUNK       = 90000; // belgi — 100KB value limitidan past
var _CACHE_MAX_CHUNKS  = 12;    // ~1MB siqilgan → bir necha MB JSON

function _cache(){ return CacheService.getScriptCache(); }


/* ============ PAST-DARAJA CACHE (gzip + chunk) ============ */

function cachePut(key, obj, ttlSek){
  try{
    var ttl = ttlSek || _CACHE_TTL_DEFAULT;
    if(ttl > _CACHE_TTL_DEFAULT) ttl = _CACHE_TTL_DEFAULT;
    var json = (obj===null || obj===undefined) ? 'null' : JSON.stringify(obj);
    var gz   = Utilities.gzip(Utilities.newBlob(json));
    var b64  = Utilities.base64Encode(gz.getBytes());
    var c    = _cache();

    if(b64.length <= _CACHE_CHUNK){
      var m1 = {}; m1[key] = b64; m1[key+'__n'] = '1';
      c.putAll(m1, ttl);
      return true;
    }
    var n = Math.ceil(b64.length / _CACHE_CHUNK);
    if(n > _CACHE_MAX_CHUNKS){
      Logger.log('cachePut o\'tkazib yuborildi (juda katta '+b64.length+' belgi): '+key);
      return false;
    }
    var m = {};
    for(var i=0;i<n;i++) m[key+'__'+i] = b64.substr(i*_CACHE_CHUNK, _CACHE_CHUNK);
    m[key+'__n'] = String(n);
    c.putAll(m, ttl);
    return true;
  }catch(e){ Logger.log('cachePut xato ('+key+'): '+(e&&e.message||e)); return false; }
}

function cacheGet(key){
  try{
    var c = _cache();
    var nStr = c.get(key+'__n');
    if(nStr===null || nStr===undefined) return null;
    var n = parseInt(nStr,10) || 0;
    var b64;
    if(n <= 1){
      b64 = c.get(key);
      if(b64===null) b64 = c.get(key+'__0'); // ehtiyot
    } else {
      var keys = [];
      for(var i=0;i<n;i++) keys.push(key+'__'+i);
      var parts = c.getAll(keys), arr = [];
      for(var j=0;j<n;j++){ var p = parts[key+'__'+j]; if(p==null) return null; arr.push(p); }
      b64 = arr.join('');
    }
    if(b64==null) return null;
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/x-gzip');
    var json = Utilities.ungzip(blob).getDataAsString();
    return JSON.parse(json);
  }catch(e){ Logger.log('cacheGet xato ('+key+'): '+(e&&e.message||e)); return null; }
}

function cacheDel(key){
  try{
    var c = _cache();
    var nStr = c.get(key+'__n');
    var n = nStr ? (parseInt(nStr,10)||0) : 0;
    var keys = [key, key+'__n'];
    for(var i=0;i<Math.max(n,1);i++) keys.push(key+'__'+i);
    c.removeAll(keys);
  }catch(e){}
}


/* ============ ESKI API (signature saqlanadi) ============
 * data {ts,data} sifatida o'raladi → _keshOl TTL ni tekshira oladi. */

function _keshYoz(key, data){
  var ok = cachePut(key, {ts: Date.now(), data: data}, _CACHE_TTL_DEFAULT);
  // 'skan' — durable fallback uchun varaqqa ham yoziladi (kam tezlikda)
  if(key === 'skan'){ try{ _keshSheetYoz(key, data); }catch(e){} }
  return ok;
}

/* TTL ni tekshiradi (eskirgan bo'lsa null) */
function _keshOl(key){
  var w = cacheGet(key);
  if(w && w.ts){
    if((Date.now()-w.ts)/1000 > _KESH_TTL) return null;
    return w.data;
  }
  if(key === 'skan'){ return _keshSheetOl(key, true); }
  return null;
}

/* TTL ni hisobga olmaydi (eskisini ham qaytaradi) */
function _keshOlStale(key){
  var w = cacheGet(key);
  if(w) return w.data;
  if(key === 'skan'){ return _keshSheetOl(key, false); }
  return null;
}


/* ============ _KESH VARAQ — faqat 'skan' uchun durable fallback ============ */

/* _KESH varaq sarlavhasi (yangi tartibli format).
 * Har obyekt ALOHIDA QATOR. Ustunlar ma'noli (o'qiladi). Texnik JSON faqat
 * oxirgi tor ustunда (kod uchun) — bitta ulkan yacheyka YO'Q (qotmaydi). */
var _KESH_HDR = ['ОБЪЕКТ','ФОРМАТ','ҚУЛФ','LRV','ЛОК ФАЙЛ','СВОД ФАЙЛ','ЯНГИЛАНДИ','_json'];

function _keshSheetYoz(key, data){
  // _KESH varaq durable fallback faqat 'skan' (obyektlar massivi) uchun.
  if(key !== 'skan' || !data || data.length===undefined) return;
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(_KESH_SH);
  if(!sh) sh = ss.insertSheet(_KESH_SH);

  var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Tashkent','yyyy-MM-dd HH:mm');
  var rows = [_KESH_HDR];
  for(var i=0;i<data.length;i++){
    var o = data[i]||{};
    var oj = JSON.stringify(o);
    if(oj.length > 45000) oj = '';   // ehtiyot: bitta obyekt juda katta bo'lsa JSON yozilmaydi
    rows.push([
      o.obyekt||'', o.format||'', (o.locked ? '🔒 ҚУЛФ' : 'очиқ'),
      (o.plusBor ? '✓' : '—'), o.lokName||'', o.svodName||'', ts, oj
    ]);
  }
  // To'liq qayta yozamiz — eski o'lik qatorlar (holat_*, boss_*) tozalanadi.
  sh.clear();
  sh.getRange(1,1,rows.length,_KESH_HDR.length).setValues(rows);
  sh.getRange(1,1,1,_KESH_HDR.length)
    .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#fff');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1,180); sh.setColumnWidth(2,70); sh.setColumnWidth(3,90);
  sh.setColumnWidth(4,50);  sh.setColumnWidth(5,200); sh.setColumnWidth(6,240);
  sh.setColumnWidth(7,130);
  // texnik JSON ustunini yashiramiz — foydalanuvchi ko'rmaydi, bosolmaydi (qotmaydi)
  try{ sh.hideColumns(8); }catch(e){}
  // Varaqning o'zi KO'RINADI (foydalanuvchi tartibli jadvalni o'qiy oladi)
  try{ if(sh.isSheetHidden()) sh.showSheet(); }catch(e){}
}

function _keshSheetOl(key, checkTtl){
  try{
    if(key !== 'skan') return null;
    var sh = SpreadsheetApp.getActive().getSheetByName(_KESH_SH);
    if(!sh || sh.getLastRow()<2) return null;
    var hdr = sh.getRange(1,1,1,_KESH_HDR.length).getValues()[0];

    /* YANGI tartibli format (sarlavha ОБЪЕКТ bilan) */
    if(String(hdr[0])==='ОБЪЕКТ'){
      var n = sh.getLastRow()-1;
      var v = sh.getRange(2,1,n,_KESH_HDR.length).getValues();
      if(checkTtl && v.length){
        var age0 = (Date.now() - _keshSanaParse(v[0][6]))/1000;
        if(age0 > _KESH_TTL) return null;
      }
      var arr = [];
      for(var i=0;i<n;i++){
        var js = v[i][7];
        if(js){ try{ arr.push(JSON.parse(js)); continue; }catch(e){} }
      }
      if(!arr.length) return null;
      try{ cachePut('skan', {ts:Date.now(), data:arr}, _CACHE_TTL_DEFAULT); }catch(e){}
      return arr;
    }

    /* ESKI format (KEY|VAQT|JSON) — orqaga moslik (bir marta o'qib, yangiga o'tadi) */
    var ev = sh.getRange(2,1,sh.getLastRow()-1,3).getValues();
    for(var k=0;k<ev.length;k++){
      if(String(ev[k][0])==='skan'){
        if(checkTtl){
          var age = (Date.now() - new Date(ev[k][1]).getTime())/1000;
          if(age > _KESH_TTL) return null;
        }
        var data = JSON.parse(ev[k][2]);
        try{ cachePut('skan', {ts:Date.now(), data:data}, _CACHE_TTL_DEFAULT); }catch(e){}
        return data;
      }
    }
  }catch(e){}
  return null;
}

/* "yyyy-MM-dd HH:mm" yoki ISO sanani millisekundga — TTL hisobi uchun */
function _keshSanaParse(s){
  var t = new Date(s).getTime();
  if(!isNaN(t)) return t;
  var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]).getTime();
  return 0;
}


/* ============ PANEL API ============ */

/* _KESH varaqini tartibga keltirish — onOpen da chaqiriladi.
 *  - Eski format (bitta ulkan JSON yacheyka, KEY|VAQT|JSON) → yangi tartibli
 *    formatga (har obyekt 1 qator) avtomatik ko'chiriladi (bir martalik).
 *  - Yangi formatda: texnik JSON ustuni (8) yashirin, varaq ko'rinadi (o'qiladi).
 * Shu sababli foydalanuvchi ulkan yacheykani bosib qotmaydi. */
function _keshVaraqTuzat(){
  try{
    var sh = SpreadsheetApp.getActive().getSheetByName(_KESH_SH);
    if(!sh) return;
    if(sh.isSheetHidden()) sh.showSheet();   // endi tartibli — ko'rsatamiz
    if(sh.getLastRow()<1) return;
    var hdr = String(sh.getRange(1,1).getValue());
    if(hdr==='KEY'){
      // ESKI ulkan-yacheyka format → yangi tartibli formatga migratsiya
      var data = _keshSheetOl('skan', false);   // eski formatdan o'qiydi
      if(data && data.length){ _keshSheetYoz('skan', data); }  // yangi formatda qayta yozadi
    } else if(hdr==='ОБЪЕКТ'){
      try{ sh.hideColumns(8); }catch(e){}       // texnik JSON ustun yashirin
    }
  }catch(e){}
}

/* Panel chaqiradigan — keshdan o'qiydi (tez) */
function apiKeshOl(key){ return _keshOlStale(key); }

/* Kesh holati — diagnostika (skan ts) */
function apiKeshHolat(){
  var out = {};
  try{
    var w = cacheGet('skan');
    if(w && w.ts){
      var age = Math.round((Date.now()-w.ts)/1000);
      out['skan'] = {ts:new Date(w.ts).toISOString(), ageSek:age, eskirgan:age>_KESH_TTL, manba:'cache'};
    } else {
      var sh = SpreadsheetApp.getActive().getSheetByName(_KESH_SH);
      if(sh && sh.getLastRow()>=2){
        var v = sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
        for(var i=0;i<v.length;i++){
          var k = String(v[i][0]);
          var age2 = Math.round((Date.now()-new Date(v[i][1]).getTime())/1000);
          out[k] = {ts:v[i][1], ageSek:age2, eskirgan:age2>_KESH_TTL, manba:'sheet'};
        }
      }
    }
  }catch(e){}
  return out;
}


/* ============ KESH YANGILASH ============ */

/* Bitta ob'ekt keshini yangilash — holatni invalidatsiya qiladi */
function apiKeshBittaYangilash(obyekt){
  try{ cacheDel('holat_'+obyekt); cacheDel('boss_'+obyekt); }catch(e){}
  return {ok:true, xabar:obyekt+' kesh tozalandi (keyingi ochilishda qayta o\'qiladi)'};
}

/* Skan keshini yangilash */
function apiKeshSkanYangilash(){
  try{
    var obs = papkaSkan();
    var result = obs.map(function(o){
      var plusId = '';
      try{
        var fit = DriveApp.getFolderById(o.folderId).getFilesByName(o.obyekt+CFG.PLUS_SUF);
        if(fit.hasNext()) plusId = fit.next().getId();
      }catch(e){}
      return {
        obyekt:    o.obyekt,
        folderId:  o.folderId,
        lokId:     o.lokFile ? o.lokFile.getId() : '',
        lokName:   o.lokName,
        svodId:    o.svodFile ? o.svodFile.getId() : '',
        svodName:  o.svodName,
        format:    o.format||'TN',
        lokSheets: o.lokSheets||[],
        svodSheets:o.svodSheets||[],
        svodCols:  o.svodCols||null,     // har svodka ustun xaritasi
        narxTayyor:!!o.narxTayyor,       // ⚡ 2026-07-04: kesh whitelist'da yo'q edi —
                                          // saqlangandan keyin checkbox qayta kirganda
                                          // doim o'chib qolardi (Файл боғлаш)
        plusId:    plusId,
        plusBor:   !!plusId,
        locked:    lockMi(o.obyekt),
        candidates: (o.candidates||[])   // Файл боғлаш tab dropdownlari uchun kerak
      };
    });
    _keshYoz('skan', result);
    return result;
  }catch(e){
    Logger.log('Skan kesh xatosi: '+(e&&e.message||e));
    return [];
  }
}

/* Panel tugmasi ("Янгилаш") chaqiradigan — FAQAT skan yangilaydi (~3 sek).
 * LRV_PLUS larni OCHMAYDI — tez va bloklamaydi.
 * Holat/boss warm-up faqat fon triggerida (avtoYangilash, navbat tugadi). */
function apiKeshYangilash(){
  var t0 = Date.now(), log = [];
  try{
    var obs = apiKeshSkanYangilash();
    log.push('✓ skan: '+obs.length+' объект');
  }catch(e){ log.push('✗ skan: '+(e&&e.message||e)); }
  var sek = Math.round((Date.now()-t0)/1000);
  return {ok:true, log:log, sek:sek, xabar:'Skan yangilandi: '+log.join('; ')+' ('+sek+' sek)'};
}

/* Vaqt asosida avtomatik yangilash (trigger) */
function keshAutoYangilash(){ apiKeshYangilash(); }

/* ============ WARM-UP — keshni oldindan isitish ============
 * Trigger/navbat tugagach chaqiriladi: skan + har ob'ekt holat + boss keshini
 * oldindan to'ldiradi → birinchi panel/Boss/Telegram ochilishi ham tez bo'ladi.
 * Yengil: apiNarxlarYarat (og'ir) va UI alert chaqirmaydi. */
function _keshWarmUp(){
  var holatN=0, bossN=0;
  try{
    var sk=apiKeshSkanYangilash()||[];   // skan ni yangilaydi + keshlaydi
    for(var i=0;i<sk.length;i++){
      if(!sk[i].plusBor) continue;
      try{ apiHolatOl(sk[i].obyekt, true); holatN++; }catch(e){}
      try{ apiBossObyekt(sk[i].obyekt);    bossN++;  }catch(e){}
    }
  }catch(e){ Logger.log('_keshWarmUp xato: '+(e&&e.message||e)); }
  return {holat:holatN, boss:bossN};
}
