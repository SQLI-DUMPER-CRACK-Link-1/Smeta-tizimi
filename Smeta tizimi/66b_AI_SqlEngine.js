/******************************************************************
 * 66b_AI_SqlEngine.js — SQL-FIRST AI DALIL DVIGATELI
 * ==================================================================
 * Maqsad: 40 000+ qator, 20+ obyekt — material bo'yicha ANIQ javob.
 *
 * Printsip:
 *   1) Supabase (yoki lokal holat) dan BARCHA mos qatorlarni oladi (sahifalab).
 *   2) GAS da YIG'INDI hisoblaydi (reja/fakt/qoldiq/summa) — 100% aniq.
 *   3) AI ga: JAMI (to'liq) + obyekt/material bo'yicha guruh + top N tafsilot.
 *   4) 60 qator limiti YO'Q — limit faqat tafsilot ko'rinishida (AI_DETAIL_MAX).
 *
 * Bog'liq: 66_AI_Data.js (_aiGen, _aiTerms, _aiSbGet, _aiPul, _aiN, _aiNum)
 ******************************************************************/

var AI_SQL_PAGE      = 1000;  /* Supabase sahifa hajmi */
var AI_SQL_MAX_ROWS  = 80000; /* xavfsizlik limiti */
var AI_DETAIL_MAX    = 45;    /* AI ga tafsilot qatorlari */
var AI_GROUP_MAX     = 60;    /* guruh (obyekt/material) satrlari */

/* ── Savol niyatini aniqlash ─────────────────────────────────── */
function _aiSqlNiyat(text, obyekt){
  var t = String(text||'').toLowerCase();
  var boshqaObyektBor = false;
  try {
    if (typeof _aiObyektlar === 'function') {
      var obList = _aiObyektlar();
      for (var i=0; i<obList.length; i++) {
        var oLow = String(obList[i]).toLowerCase();
        if (oLow && oLow !== String(obyekt).toLowerCase() && t.indexOf(oLow) > -1) {
          boshqaObyektBor = true; break;
        }
      }
    }
  } catch(e) {}
  
  return {
    obyekt: obyekt,
    portfel: !obyekt || boshqaObyektBor || /barcha|hamma|portfel|obyektlar|umumiy|butun|tizim|qaysi obyekt|taqqos|solishtir|eng ko.p|eng kam/.test(t),
    solishtir: /qaysi|eng ko.p|eng kam|taqqos|solishtir|ортик|кам|katta|kichik/.test(t),
    wantFakt:  /ishlatil|sarf|fakt|bajaril|использ|расход/.test(t),
    wantSmeta: /kerak|reja|smeta|план|plan/.test(t) && !/ishlatil|fakt|sarf/.test(t),
    wantQoldiq:/qoldiq|qolgan|остат|qoladi/.test(t),
    wantPrixod:/keldi|kelgan|prixod|приход|kelish/.test(t),
    wantNarx:  /narx|narxdan|qiymat|qimmat|прайс|цена/.test(t),
    wantSum:   /jami|умум|summa|total|pul|mln|mlrd/.test(t)
  };
}

/* ── Supabase: barcha sahifalarni olish ──────────────────────── */
function _aiSbFetchAll(table, qs){
  var c = (typeof _sbCfg==='function') ? _sbCfg() : null;
  if(!c) return [];

  // 1. Avval qatorlar sonini (count) aniqlaymiz, bu juda tez (faqat header qaytadi)
  var base = String(qs||'').replace(/&offset=\d+/g,'').replace(/&limit=\d+/g,'');
  var countUrl = c.url+'/rest/v1/'+table+'?'+base+'&select=obyekt';
  var count = 0;
  try{
    var cr = UrlFetchApp.fetch(countUrl, {
      method:'get', headers:{ 'apikey':c.key, 'Authorization':'Bearer '+c.key, 'Prefer':'count=exact', 'Range':'0-0' },
      muteHttpExceptions:true
    });
    var m = String(cr.getHeaders()['Content-Range'] || cr.getHeaders()['content-range'] || '').match(/\/(\d+)/);
    count = m ? parseInt(m[1],10) : 0;
  }catch(e){ return []; }

  if(count <= 0) return [];

  // 2. Sahifalarni parallel (bir vaqtda) tortish uchun so'rovlar ro'yxatini tuzamiz
  var reqs = [];
  var limit = Math.min(count, AI_SQL_MAX_ROWS);
  for(var offset=0; offset < limit; offset += AI_SQL_PAGE){
    reqs.push({
      url: c.url+'/rest/v1/'+table+'?'+base+'&offset='+offset+'&limit='+AI_SQL_PAGE,
      method: 'get',
      headers: { 'apikey':c.key, 'Authorization':'Bearer '+c.key },
      muteHttpExceptions: true
    });
  }

  // 3. Barcha sahifalarni BIR VAQTDA (concurrent) tortamiz -> 10 baravar tezlashadi!
  var all = [];
  try {
    var resps = UrlFetchApp.fetchAll(reqs);
    resps.forEach(function(r){
      if(r.getResponseCode() < 300){
        var rows = JSON.parse(r.getContentText()||'[]');
        all = all.concat(rows);
      }
    });
  } catch(e) {}
  return all;
}

/* ── Supabase: aniq son (count) ──────────────────────────────── */
function _aiSbCount(table, qs){
  var c = (typeof _sbCfg==='function') ? _sbCfg() : null;
  if(!c) return -1;
  var url = c.url+'/rest/v1/'+table+'?'+qs+'&select=obyekt';
  try{
    var resp = UrlFetchApp.fetch(url, {
      method:'get',
      headers:{
        'apikey':c.key, 'Authorization':'Bearer '+c.key,
        'Prefer':'count=exact',
        'Range':'0-0'
      },
      muteHttpExceptions:true
    });
    var cr = resp.getHeaders()['Content-Range'] || resp.getHeaders()['content-range'] || '';
    var m = String(cr).match(/\/(\d+)/);
    return m ? parseInt(m[1],10) : -1;
  }catch(e){ return -1; }
}

/* ── Yig'indi (aggregation) — ASOSIY ANIQLIK MANBAI ─────────── */
function _aiAggQatorlar(rows, guruh){
  guruh = guruh || ['obyekt','nom','birlik'];
  var map = {}, order = [];
  (rows||[]).forEach(function(r){
    var key = guruh.map(function(k){ return String(r[k]||''); }).join('\x01');
    if(!map[key]){
      map[key] = { obyekt:r.obyekt||'', nom:r.nom||'', birlik:r.birlik||'', kat:r.kategoriya||r.kat||'',
        razdel:r.razdel||'', reja:0, fakt:0, qoldiq:0, f2ol:0, summa:0, narx:0, cnt:0 };
      order.push(key);
    }
    var g = map[key];
    g.reja   += _aiNum(r.smeta_hajm != null ? r.smeta_hajm : r.smetaHajm);
    g.fakt   += _aiNum(r.fakt);
    g.qoldiq += _aiNum(r.qoldiq);
    g.f2ol   += _aiNum(r.f2ol);
    g.summa  += _aiNum(r.smeta_pul != null ? r.smeta_pul : r.smeta);
    if(_aiNum(r.narx) > 0) g.narx = _aiNum(r.narx);
    g.cnt++;
  });
  return order.map(function(k){ return map[k]; });
}

function _aiAggJami(groups){
  var j = { reja:0, fakt:0, qoldiq:0, f2ol:0, summa:0, cnt:0, guruh: groups.length };
  groups.forEach(function(g){
    j.reja += g.reja; j.fakt += g.fakt; j.qoldiq += g.qoldiq;
    j.f2ol += g.f2ol; j.summa += g.summa; j.cnt += g.cnt;
  });
  return j;
}

/* ── Guruhlarni saralash (solishtirish savollari) ────────────── */
function _aiAggSort(groups, niyat){
  var field = 'fakt';
  if(niyat.wantQoldiq) field = 'qoldiq';
  else if(niyat.wantSmeta) field = 'reja';
  else if(niyat.wantSum) field = 'summa';
  return groups.slice().sort(function(a,b){ return (b[field]||0) - (a[field]||0); });
}

/* ── Matn formatlash (AI uchun kompakt) ──────────────────────── */
function _aiFmtGuruh(g, niyat){
  var p = [];
  if(g.obyekt) p.push('['+g.obyekt+']');
  p.push(_aiNom(g.nom)+' ('+(g.birlik||'-')+')');
  if(niyat.wantSmeta || (!niyat.wantFakt && !niyat.wantQoldiq))
    p.push('reja '+_aiN(g.reja));
  if(niyat.wantFakt || (!niyat.wantSmeta && !niyat.wantQoldiq))
    p.push('fakt '+_aiN(g.fakt));
  if(niyat.wantQoldiq || g.qoldiq)
    p.push('qoldiq '+_aiN(g.qoldiq));
  if(g.summa) p.push('summa '+_aiPul(g.summa));
  if(g.narx) p.push('narx '+_aiN(g.narx));
  if(g.kat) p.push('['+g.kat+']');
  if(g.cnt > 1) p.push('('+g.cnt+' qator)');
  return '- '+p.join(' | ');
}

function _aiFmtJamiBlock(j, niyat, totalRows){
  var L = ['### JAMI YIG\'INDI (SQL — '+totalRows+' ta xom qator, '+j.guruh+' guruh, 100% aniq):'];
  if(niyat.wantSmeta || !niyat.wantFakt) L.push('Reja (smeta hajm): **'+_aiN(j.reja)+'**');
  if(niyat.wantFakt || !niyat.wantSmeta) L.push('Fakt (ishlatilgan): **'+_aiN(j.fakt)+'**');
  if(niyat.wantQoldiq || j.qoldiq) L.push('Qoldiq: **'+_aiN(j.qoldiq)+'**');
  if(j.summa) L.push('Summa: **'+_aiPul(j.summa)+'**');
  return L.join('\n');
}

/* ── Obyekt bo'yicha yig'indi (portfel savollari) ────────────── */
function _aiAggObyekt(groups){
  var map = {};
  groups.forEach(function(g){
    var ob = g.obyekt || '(nomalum)';
    if(!map[ob]) map[ob] = { obyekt:ob, reja:0, fakt:0, qoldiq:0, summa:0, cnt:0 };
    var o = map[ob];
    o.reja += g.reja; o.fakt += g.fakt; o.qoldiq += g.qoldiq; o.summa += g.summa; o.cnt += g.cnt;
  });
  return Object.keys(map).map(function(k){ return map[k]; })
    .sort(function(a,b){ return (b.fakt||b.qoldiq||b.summa) - (a.fakt||a.qoldiq||a.summa); });
}

/* ══════════════════════════════════════════════════════════════
 * ASOSIY — _aiDalilV2 (66_AI_Data dan chaqiriladi)
 * ══════════════════════════════════════════════════════════════ */
function _aiDalilV2(obyekt, terms, text){
  text = text || '';
  terms = terms || [];
  var niyat = _aiSqlNiyat(text, obyekt);

  /* Terms va obyekt bo'lmasa — butun bazani yuklamaslik (xavfsizlik) */
  if(!terms.length && !obyekt && !niyat.portfel)
    return { text:'', count:0, totalRows:0, manba:'(qidiruv so\'zi yoki obyekt kerak)' };

  if(typeof _sbBor==='function' && _sbBor()){
    var sb = _aiDalilSupabase(obyekt, terms, niyat);
    if(sb.count > 0 || sb.jami) return sb;
  }
  return _aiDalilLokalV2(obyekt, terms, text, niyat);
}

function _aiDalilSupabase(obyekt, terms, niyat){
  var orf = (typeof _aiOrFilter==='function') ? _aiOrFilter(terms) : '';
  var objF = (obyekt && !niyat.portfel) ? ('&obyekt=eq.'+encodeURIComponent(obyekt)) : '';
  var baseQs = (orf ? orf+'&' : '') + 'tur=in.(rs,mat,ob,bl)' + objF +
    '&select=obyekt,nom,birlik,smeta_hajm,fakt,qoldiq,f2ol,narx,smeta_pul,kategoriya,razdel';

  var totalCount = _aiSbCount('holat', baseQs.replace(/^&/,''));
  var rows = _aiSbFetchAll('holat', baseQs);
  var L = [], cnt = 0;

  if(rows.length){
    var byMat = _aiAggQatorlar(rows, ['obyekt','nom','birlik']);
    var jami = _aiAggJami(byMat);
    L.push(_aiFmtJamiBlock(jami, niyat, rows.length));
    if(totalCount > rows.length)
      L.push('_(Diqqat: '+totalCount+' ta qator bazada, '+rows.length+' tasi yuklandi)_');

    /* Portfel / solishtirish — obyekt bo'yicha */
    if(niyat.portfel || niyat.solishtir){
      var byOb = _aiAggObyekt(byMat);
      L.push('\n### OBYEKT BO\'YICHA (yig\'indi):');
      byOb.slice(0, AI_GROUP_MAX).forEach(function(o){
        cnt++;
        L.push('- **'+o.obyekt+'**: reja '+_aiN(o.reja)+' | fakt '+_aiN(o.fakt)+
          ' | qoldiq '+_aiN(o.qoldiq)+(o.summa?(' | '+_aiPul(o.summa)):''));
      });
    }

    /* Material guruhlari */
    var sorted = niyat.solishtir ? _aiAggSort(byMat, niyat) : byMat;
    L.push('\n### MATERIAL/RESURS GURUHLARI ('+byMat.length+' xil):');
    sorted.slice(0, AI_GROUP_MAX).forEach(function(g){
      cnt++;
      L.push(_aiFmtGuruh(g, niyat));
    });
    if(byMat.length > AI_GROUP_MAX)
      L.push('_... yana '+(byMat.length - AI_GROUP_MAX)+' guruh (jami yuqorida)_');

    /* Tafsilot — eng katta qatorlar */
    var det = rows.slice().sort(function(a,b){
      return _aiNum(b.smeta_pul) - _aiNum(a.smeta_pul);
    });
    if(det.length && det.length <= rows.length){
      L.push('\n### TAFSILOT (top-'+Math.min(AI_DETAIL_MAX, det.length)+' qator):');
      det.slice(0, AI_DETAIL_MAX).forEach(function(r){
        L.push('- ['+(r.obyekt||'')+'] '+_aiNom(r.nom)+' ('+(r.birlik||'')+'): reja '+_aiN(r.smeta_hajm)+
          ' | fakt '+_aiN(r.fakt)+' | qoldiq '+_aiN(r.qoldiq)+
          (r.razdel?(' | '+String(r.razdel).slice(0,40)):''));
      });
    }
  }

  /* PRIXOD */
  if(niyat.wantPrixod || niyat.wantNarx){
    var pqs = (orf ? orf+'&' : '') + 'select=nom,birlik,hajm,narx,summa,sana,postavshik,obyekt';
    var prix = _aiSbFetchAll('prixod', pqs);
    if(prix.length){
      var pagg = _aiAggQatorlar(prix.map(function(r){
        return { obyekt:r.obyekt, nom:r.nom, birlik:r.birlik, smeta_hajm:r.hajm, fakt:r.hajm,
          smeta_pul:r.summa, narx:r.narx, kategoriya:'' };
      }), ['obyekt','nom','birlik']);
      var pj = _aiAggJami(pagg);
      L.push('\n### KELGAN MATERIAL (prixod) — jami '+prix.length+' yozuv:');
      L.push('Hajm: **'+_aiN(pj.fakt)+'** | Summa: **'+_aiPul(pj.summa)+'**');
      pagg.slice(0, 25).forEach(function(g){ cnt++; L.push(_aiFmtGuruh(g, niyat)); });
    }
  }

  /* VIBORKA nazorat */
  if(niyat.wantPrixod || terms.length){
    var vqs = (orf ? orf+'&' : '') + 'select=nom,birlik,plan,qabul,qoldiq,foiz,holat';
    var vib = _aiSbGet('viborka_nazorat', vqs + '&limit=50') || [];
    if(vib.length){
      L.push('\n### VIBORKA NAZORAT:');
      vib.forEach(function(r){
        cnt++;
        L.push('- '+_aiNom(r.nom)+' ('+(r.birlik||'')+'): reja '+_aiN(r.plan)+
          ' | qabul '+_aiN(r.qabul)+' | qoldiq '+_aiN(r.qoldiq)+
          (r.foiz!=null?(' | '+r.foiz+'%'):''));
      });
    }
  }

  return {
    text: L.join('\n'),
    count: Math.max(cnt, rows.length),
    jami: rows.length ? _aiAggJami(_aiAggQatorlar(rows, ['obyekt','nom','birlik'])) : null,
    totalRows: rows.length,
    manba: 'Supabase SQL (to\'liq yig\'indi)'
  };
}

/* ── Lokal fallback — apiHolatOl, xuddi shu agregatsiya ─────── */
function _aiDalilLokalV2(obyekt, terms, text, niyat){
  if(typeof apiHolatOl!=='function') return { text:'', count:0, manba:'lokal' };
  niyat = niyat || _aiSqlNiyat(text, obyekt);
  var targets = (obyekt && !niyat.portfel) ? [obyekt] : _aiObyektlar();
  if(!targets.length) targets = _aiObyektlar().slice(0, 12);
  var termGroups = (terms||[]).map(function(tm){
    return (typeof _aiVariants==='function' ? _aiVariants(tm) : [tm]).map(_aiLower);
  });

  var raw = [];
  targets.forEach(function(ob){
    var h; try{ h = apiHolatOl(ob); }catch(e){ return; }
    (function walk(nodes, razdel){
      (nodes||[]).forEach(function(n){
        if(n.children) walk(n.children, (n.type==='rz' ? n.nom : razdel));
        if(n.type==='rs'||n.type==='bl'||n.type==='mat'||n.type==='ob'){
          if(termGroups.length){
            var nm = _aiLower(n.nom);
            var mos = termGroups.every(function(group){
              return group.some(function(p){ return p && nm.indexOf(p)>=0; });
            });
            if(!mos) return;
          }
          raw.push({
            obyekt: ob, nom: n.nom, birlik: n.birlik||'', smeta_hajm: n.smetaHajm,
            fakt: n.fakt, qoldiq: n.qoldiq, f2ol: n.f2ol, smeta_pul: n.smeta,
            narx: (n.smetaHajm>0) ? Math.round(_aiNum(n.smeta)/n.smetaHajm) : 0,
            kategoriya: n.kat||'', razdel: razdel
          });
        }
      });
    })(h.tree, '');
  });

  if(!raw.length) return { text:'', count:0, manba:'lokal (topilmadi)' };

  var byMat = _aiAggQatorlar(raw, ['obyekt','nom','birlik']);
  var jami = _aiAggJami(byMat);
  var L = [_aiFmtJamiBlock(jami, niyat, raw.length)];

  if(niyat.portfel || niyat.solishtir){
    L.push('\n### OBYEKT BO\'YICHA:');
    _aiAggObyekt(byMat).slice(0, AI_GROUP_MAX).forEach(function(o){
      L.push('- **'+o.obyekt+'**: fakt '+_aiN(o.fakt)+' | qoldiq '+_aiN(o.qoldiq));
    });
  }

  var sorted = niyat.solishtir ? _aiAggSort(byMat, niyat) : byMat;
  L.push('\n### GURUHLAR ('+byMat.length+'):');
  sorted.slice(0, AI_GROUP_MAX).forEach(function(g){ L.push(_aiFmtGuruh(g, niyat)); });

  return {
    text: L.join('\n'),
    count: raw.length,
    jami: jami,
    totalRows: raw.length,
    manba: 'lokal SQL (apiHolatOl — to\'liq yig\'indi)'
  };
}

/* test */
function aiSqlEngineTest(){
  var r = _aiDalilV2('Suniy ko\'l', ['M200','beton'], 'M200 beton qancha fakt?');
  Logger.log(r.text);
  return r;
}
