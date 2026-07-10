/********************************************************************
 * 00_Config.gs — MARKAZIY SOZLAMA
 * SYNCED TO NOTEBOOK — 2026-06-07 (clasp push test) ✅
 * ==================================================================
 * Anvar talablari:
 *   #1 BIRLIK QATIY — нарх faqat НОМ + БИРЛИК aynan bir xil bo'lsa
 *   #2 FAKT NARX    — global jadval SOZLAMALAR_НАРХ
 *   #3 E/F          — leaf hajmi to'g'ri ustundan (bo'sh F dan emas)
 *   #4 RAZDEL       — TN da bl/rs bo'lmagan = rz, bo'sh qatorlar o'chir
 *   LOCK            — obyekt qulflanadi, asl смета tегмайди
 *   BIRLIK_ALIAS    — м3/м³, kg/кг, pcs/шт avтомат бир хил
 *
 * LRV_PLUS USTUN JOYLASHUVI:
 *   A–F  = ASL LOKALKA (E son, F dinamik)
 *   G    = НАРХ        H = СМЕТА        I = МАРКЕР
 *   J–P  = ЧЕЛ МАШ МАТ ОБ БЕЗСКЛАД М/К КАБ
 *   Q–T  = ФАКТ / ҚОЛДИҚ / Ф2 ОЛИНГАН / Ф2 МУМКИН
 *   U–W  = ҚАВАТ 1/2/3   X = ВИД РАБОТ   Y = РАЗДЕЛ
 *   Z–AC = СТОИМОСТЬ: ресурс / факт / Ф2 / қолдиқ
 *   AE+  = ойлик Ф2 устунлари
 ********************************************************************/

var CFG = {
  SOZ:      'SOZLAMALAR',
  SOZ_KAT:  'SOZLAMALAR_KATEGORIYA',
  SOZ_NARX: 'SOZLAMALAR_НАРХ',   // eski (hali ishlaydi)
  NARXLAR:  'NARXLAR',           // yangi narxlar varag'i
  SOZ_LOCK: 'SOZLAMALAR_ҚУЛФ',
  NARX_LOG: '_NARX_LOG',
  TMP_SUF:   '_TMP_',
  NAT_SUF:   '_NAT_',
  SYS_FOLDER:'⚙️ Tizim Fayllari',
  RESURS:   'РЕСУРСЛАР',
  PLUS_SUF: '_LRV_PLUS',
  DASH:     'DASHBOARD',
  LRV_SHEET:'LRV',
  SOZ_BOG:  'SOZLAMALAR_BOGLASH',
  F2_JURNAL:'_F2_JURNAL',
  RAZDEL_SH:'РАЗДЕЛЛАР',

  C: {
    NO:1, KOD:2, NOM:3, BIRLIK:4, E:5, F:6,
    NARX:7, SMETA:8, MARKER:9,
    CHEL:10, MASH:11, MAT:12, OB:13, BEZSKLAD:14, MK:15, KAB:16,
    FAKT:17, QOLDIQ:18, F2OL:19, F2MUM:20,
    QAVAT1:21, QAVAT2:22, QAVAT3:23,
    H_BL:24, H_RAZDEL:25,
    ST_RES:26, ST_FAKT:27, ST_F2:28, ST_OST:29,
    F2_BIRINCHI:31
  },
  FIRST_NEW_COL: 7,
  HIDE_FROM: 21, HIDE_TO: 25,

  /* Svodka ustun xaritasi (1-based). Drive'dan haqiqiy svodkalardan tasdiqlangan:
   *   TN  (Amfiteatr): № НОМ БИРЛИК QTY ДОНА_НАРХ СУММА  → seksiyalar НОМ ustunida
   *   ABC (GAME CLUB): N KOD НОМ БИРЛИК QTY ДОНА_НАРХ СУММА → seksiyalar НОМ ustunida
   * NARX = DONA narx (1 ed). SUMMA = jami (faqat dona×qty tekshiruvi uchun, narx EMAS).
   * BLOK = seksiya sarlavhalari ustuni (= НОМ ustuni, narxsiz qatorlar). */
  SVOD_TN:  { BLOK:2, NOM:2, BIRLIK:3, QTY:4, NARX:5, SUMMA:6, KOD:1 },
  SVOD_ABC: { BLOK:3, NOM:3, BIRLIK:4, QTY:5, NARX:6, SUMMA:7, KOD:2 },

  DATA_QATOR: 0,
  RANG: { rz:'#FFFF00', bl:'#4A86E8', rs:null, mat:'#D9EAD3' },
  RANG_BL_FONT: '#FFFFFF',
  RANG_QOSH: '#FCE5CD',
  RANG_LOCK: '#E0E0E0',

  SVOD_KW: ['СВОД','SVOD','СВОДК','СВОДН','СМЕТН','ЦЕН','ПРАЙС','PRICE'],
  LOK_KW:  ['ЛОКАЛ','LOKAL','LRV','ЛРВ','ЛОК','LOC','РЕСУРСН','ВЕДОМ'],

  SKIP_SHEETS: ['РЕСУРСЛАР','_NARX_LOG','_KESH','SOZLAMALAR','SOZLAMALAR_KATEGORIYA','SOZLAMALAR_НАРХ',
                'SOZLAMALAR_ҚУЛФ','ОБЛОЖКА','OBLOJKA','ТИТУЛ','ТИТУЛЬНЫЙ','СОДЕРЖАНИЕ',
                'DASHBOARD','РАЗДЕЛЛАР','NARXLAR'],

  NARX_MANTIQ: 'MAX',
  BIRLIK_QATIY: true,
  /* ⚡⚡⚡ CONSTANTA NARXLASH (eng qatiy — yuridik muhim).
   * Narx FAQAT shu obyekt svodkasidan, AYNAN moslik bilan (_findPrice):
   *   - nom: faqat SON+HARF solishtiriladi (_normNomKey) — probel/belgi farqi e'tiborsiz
   *   - birlik: AYNAN bir xil (_normBirlik)
   *   - topilmasa → MISS (narx 0) → _NARX_LOG → qo'lda beriladi
   * FUZZY (taxminiy moslik), cross-obyekt narx, umumiy NARXLAR narxi, FAKT MAX —
   * HAMMASI OLIB TASHLANGAN. Quyidagi flaglar endi NARXLASHDA ISHLATILMAYDI
   * (tarixiy — referens uchun qoldi): */
  FUZZY: false, FUZZY_THR_UNIT: 0.55, FUZZY_THR_CROSS: 0.74, FUZZY_CROSS: false,
  FAKT_CROSS: false,      // cross-obyekt FAKT MAX — O'CHIRILGAN
  JACCARD_THR: 0.45,      // (eski — ishlatilmaydi)
  CATS: ['ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ'],
  BATCH_LIMIT: 50000,

  /* Birlik alias — м3/M3/m3 → М3 va h.k. */
  BIR_ALIAS: {
    'KG':'КГ','KGS':'КГ','L':'Л','LTR':'Л',
    'PCS':'ШТ','PC':'ШТ',
    'TN':'Т','TON':'Т','TONNE':'Т','TONNA':'Т',
    'KW':'КВТ','KWH':'КВТЧ'
  }
};


/* ================= ASOSIY SOZLAMA ================= */
function sozAsosiy(){
  var sh = SpreadsheetApp.getActive().getSheetByName(CFG.SOZ);
  if(!sh) throw CFG.SOZ + ' yo\'q. Avval menyudan "① Созламаларни ярат".';
  var v = sh.getDataRange().getValues(), m = {};
  for(var i=0;i<v.length;i++){
    var k=String(v[i][0]||'').trim().toUpperCase();
    if(k) m[k]=v[i][1];
  }
  var root=String(m['ROOT_FOLDER_ID']||'').trim();
  if(!root) throw 'ROOT_FOLDER_ID bo\'sh.';
  return {
    rootId:   root,
    dataQator:(m['DATA_QATOR']===''||m['DATA_QATOR']==null) ? CFG.DATA_QATOR : (Number(m['DATA_QATOR'])||0),
    narxMantiq:(String(m['NARX_MANTIQ']||'').trim().toUpperCase()) || CFG.NARX_MANTIQ,
    serverId:  String(m['SERVER_ID']||'').trim()
  };
}

function sozKategoriya(){
  var sh = SpreadsheetApp.getActive().getSheetByName(CFG.SOZ_KAT);
  if(!sh) throw CFG.SOZ_KAT + ' yo\'q.';
  var v = sh.getDataRange().getValues();
  var k = { blok:{}, kw:{KAB:[],MK:[],OB:[],BEZSKLAD:[]}, stop:[], over:[] };
  for(var i=1;i<v.length;i++){
    var tur=String(v[i][0]).trim().toUpperCase(), q=String(v[i][1]).trim();
    if(!tur) continue;
    if(tur==='BLOK_CHEL')      k.blok.CHEL=q.toUpperCase();
    else if(tur==='BLOK_MASH') k.blok.MASH=q.toUpperCase();
    else if(tur==='BLOK_MAT')  k.blok.MAT =q.toUpperCase();
    else if(tur==='BLOK_OB')   k.blok.OB  =q.toUpperCase();
    else if(tur==='KW_KAB')    k.kw.KAB=_splitKw(q);
    else if(tur==='KW_MK')     k.kw.MK =_splitKw(q);
    else if(tur==='KW_OB')     k.kw.OB =_splitKw(q);
    else if(tur==='KW_BEZSKLAD') k.kw.BEZSKLAD=_splitKw(q);
    else if(tur==='KW_STOP')   k.stop  =_splitKw(q);
    else if(tur==='OVERRIDE')  k.over.push({
        pat:q.toUpperCase(), narx:Number(v[i][2])||0,
        cat:(String(v[i][3]).trim().toUpperCase())||'МАТ' });
  }
  // Default qiymatlar — eski sozlama varaqlarida BLOK_OB bo'lmasligi mumkin
  if(!k.blok.CHEL) k.blok.CHEL = 'ЗАТРАТЫ ТРУДА';
  if(!k.blok.MASH) k.blok.MASH = 'СТРОИТЕЛЬНЫЕ МАШИНЫ';
  if(!k.blok.MAT)  k.blok.MAT  = 'СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ';
  if(!k.blok.OB)   k.blok.OB   = 'ОБОРУДОВАНИЕ';
  return k;
}
function _splitKw(s){
  return String(s).toUpperCase().split(',').map(function(x){return x.trim();}).filter(String);
}

/* Fakt narx jadvali — NOM+BIRLIK aynan kalitida */
function sozFaktNarx(){
  var sh = SpreadsheetApp.getActive().getSheetByName(CFG.SOZ_NARX);
  var map = {};
  if(!sh) return map;
  var v = sh.getDataRange().getValues();
  for(var i=1;i<v.length;i++){
    var nom = String(v[i][0]||'').trim();
    var bir = String(v[i][1]||'').trim();
    var fakt= _toNum(v[i][3]);
    if(!nom || fakt<=0) continue;
    var key = _norm(nom)+'||'+_normBirlik(bir);
    if(map[key]===undefined || fakt>map[key]) map[key]=fakt;
  }
  return map;
}


/* ================= LOCK ================= */
// Bitta ijro davomida memo — lockMap papkaSkan ichida har ob'ekt uchun
// takror chaqirilardi (har safar varaq o'qish). Memo varaq o'qishni bir martaga tushiradi.
var _LOCKMAP_MEMO=null;
function lockMap(){
  if(_LOCKMAP_MEMO) return _LOCKMAP_MEMO;
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.SOZ_LOCK);
  var m={};
  if(!sh||sh.getLastRow()<2){ _LOCKMAP_MEMO=m; return m; }
  var v=sh.getRange(2,1,sh.getLastRow()-1,4).getValues();
  for(var i=0;i<v.length;i++){
    var ob=String(v[i][0]||'').trim();
    if(!ob) continue;
    m[ob]={holat:String(v[i][1]||'').trim().toLowerCase(),
           sana:String(v[i][2]||''), izoh:String(v[i][3]||'')};
  }
  _LOCKMAP_MEMO=m;
  return m;
}
function lockMi(obyekt){
  var m=lockMap();
  var base = obyekt.split(' - ')[0].trim();
  return !!((m[obyekt] && m[obyekt].holat==='locked') || (m[base] && m[base].holat==='locked'));
}
function lockYoz(obyekt, holat, izoh){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(CFG.SOZ_LOCK);
  if(!sh){
    sh=ss.insertSheet(CFG.SOZ_LOCK);
    sh.getRange(1,1,1,4).setValues([['ОБЪЕКТ','ҲОЛАТ','САНА','ИЗОҲ']])
      .setFontWeight('bold').setBackground('#7f3d3d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1,250); sh.setColumnWidth(4,400);
  }
  var last=sh.getLastRow(), found=0;
  if(last>=2){
    var v=sh.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<v.length;i++) if(String(v[i][0]).trim()===obyekt){ found=i+2; break; }
  }
  var sana=Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Tashkent','yyyy-MM-dd HH:mm');
  var row=[obyekt, holat, sana, izoh||''];
  if(found) sh.getRange(found,1,1,4).setValues([row]);
  else sh.appendRow(row);
  _LOCKMAP_MEMO=null; // memo eskirdi — keyingi lockMap qayta o'qiydi
}

/* Tizim to'xtatib turilganligini tekshirish (butun tizim bo'yicha triggers va syncs uchun) */
function tizimMuzlatilganMi() {
  try {
    return PropertiesService.getScriptProperties().getProperty('SYSTEM_PAUSED') === 'true';
  } catch(e) {
    return false;
  }
}

// force push
