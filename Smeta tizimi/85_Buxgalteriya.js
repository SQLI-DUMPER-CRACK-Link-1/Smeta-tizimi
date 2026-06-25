/********************************************************************
 * 85_Buxgalteriya.gs — TO'LOVLAR REGISTRI + MOLIYAVIY NAZORAT
 * ==================================================================
 * Buxgalteriya uchun PUL HARAKATI qatlami. Shartnoma (dogovor) bo'yicha
 * kelgan pul (avans/to'lov) yoziladi → debitor/kreditor avtomat hisoblanadi.
 *
 *   bajarilgan (Ф2/КС-2)  − to'langan  =  ДЕБИТОР (bizga qarz)
 *   to'langan  − bajarilgan (agar +)   =  АВАНС (oldindan to'lov)
 *
 * Varaq: ТЎЛОВЛАР (qo'lda ham yoziladi, panel/telegram orqali ham):
 *   САНА | ШАРТНОМА_NO | ОБЪЕКТ | СУММА | ТУР | ИЗОҲ
 *   ТУР: Аванс / Тўлов / Қайтарим
 ********************************************************************/

var _TOLOV = 'ТЎЛОВЛАР';

function _tolovSheet(){
  return _shSheet(_TOLOV,
    ['САНА','ШАРТНОМА_NO','ОБЪЕКТ','СУММА','ТУР','ИЗОҲ'],
    [110,120,220,150,110,300]);
}

/* ============ O'QISH ============ */
function apiTolovOl(){
  var sh=_tolovSheet();
  if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,6).getValues()
    .map(function(r,i){ return {
      sana:_buxSana(r[0]), shNo:String(r[1]||'').trim(), obyekt:String(r[2]||'').trim(),
      summa:_toNum(r[3]), tur:String(r[4]||'Тўлов').trim(), izoh:String(r[5]||''), row:i+2
    };})
    .filter(function(x){ return x.shNo || x.summa; });
}

/* ============ YOZISH ============ */
// d = {sana, shNo, obyekt, summa, tur, izoh}
function apiTolovYoz(d){
  if(!d || !d.shNo) throw 'ШАРТНОМА_NO керак';
  if(!_toNum(d.summa)) throw 'СУММА керак';
  var sh=_tolovSheet();
  sh.appendRow([ d.sana||Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy'),
    String(d.shNo).trim(), String(d.obyekt||''), _toNum(d.summa),
    String(d.tur||'Тўлов'), String(d.izoh||'') ]);
  SpreadsheetApp.flush();
  try{ if(typeof supabaseTolovPush==='function') supabaseTolovPush(); }catch(e){}
  try{ if(typeof supabaseShartnomaPush==='function') supabaseShartnomaPush(); }catch(e){}
  return {ok:true, xabar:'Тўлов қўшилди: '+d.shNo+' — '+_toNum(d.summa).toLocaleString()};
}
function apiTolovOchir(row){
  var sh=_tolovSheet(); row=parseInt(row,10);
  if(row>=2 && row<=sh.getLastRow()) sh.deleteRow(row);
  try{ if(typeof supabaseTolovPush==='function') supabaseTolovPush(); }catch(e){}
  return {ok:true};
}

/* ============ TO'LOV YIG'INDISI (shartnoma bo'yicha) ============ */
// → { shNo: {tolangan, avans, qaytarim} }
function _tolovYigindi(){
  var t=apiTolovOl(), map={};
  for(var i=0;i<t.length;i++){
    var no=t[i].shNo||'—';
    if(!map[no]) map[no]={tolangan:0, avans:0, qaytarim:0};
    var tur=t[i].tur.toLowerCase();
    if(tur.indexOf('қайт')>=0 || tur.indexOf('кайт')>=0 || tur.indexOf('qayt')>=0)
      map[no].qaytarim += t[i].summa;
    else if(tur.indexOf('аванс')>=0 || tur.indexOf('avans')>=0){
      map[no].avans += t[i].summa; map[no].tolangan += t[i].summa;
    } else map[no].tolangan += t[i].summa;
  }
  // qaytarimni jami to'langandan ayiramiz
  for(var k in map) map[k].tolangan -= map[k].qaytarim;
  return map;
}

/* ============ BUXGALTERIYA DASHBOARD (debitor/kreditor) ============ */
function apiBuxDashboard(){
  var d=(typeof apiShartnomaDashboard==='function')?apiShartnomaDashboard():{shartnomalar:[]};
  var ty=_tolovYigindi();
  var out=[], jami={dog:0, bajarilgan:0, tolangan:0, debitor:0, avans:0};
  (d.shartnomalar||[]).forEach(function(g){
    if(g.no==='—') return;
    var m=g.meta||{}, dog=_toNum(m.jami)||_toNum(g.jamiSmeta), baj=_toNum(g.jamiF2);
    var tl=(ty[g.no]&&ty[g.no].tolangan)||0;
    var debitor=baj-tl;                                 // bizga qarz (+) / oldindan (−)
    out.push({no:g.no, nomi:m.nomi||'', taraf:m.taraf||'',
      dog_summa:dog, bajarilgan:baj, tolangan:tl,
      debitor:debitor>0?debitor:0, avans:debitor<0?-debitor:0,
      bajarilgan_pct:dog>0?Math.round(baj/dog*100):0,
      tolangan_pct:dog>0?Math.round(tl/dog*100):0, holat:m.holat||''});
    jami.dog+=dog; jami.bajarilgan+=baj; jami.tolangan+=tl;
    jami.debitor+=(debitor>0?debitor:0); jami.avans+=(debitor<0?-debitor:0);
  });
  return {qatorlar:out, jami:jami};
}

/* ============ Yordamchi ============ */
function _buxSana(v){
  if(v instanceof Date) return Utilities.formatDate(v,'Asia/Tashkent','dd.MM.yyyy');
  return String(v==null?'':v).trim();
}
