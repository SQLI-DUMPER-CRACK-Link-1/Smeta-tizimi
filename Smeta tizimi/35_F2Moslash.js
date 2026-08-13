/********************************************************************
 * 35_F2Moslash.js — Ф2 АВТО-МОСЛАШТИРИШ ДВИГАТЕЛИ (сервер томонда)
 * ==================================================================
 * MAQSAD: `Panel.html` ichidagi ~420 satrlik moslashtirish mantiqini
 *         SERVERGA ko'chirish — shunda PANEL ham, SAYT ham AYNAN BIR XIL
 *         kodni chaqiradi. Ikki nusxa = ikki xil natija (panelda 1466,
 *         saytda 1201 moslik) — bu holat oldini olinadi.
 *
 * ⚠️ BU KOD JUDA NOZIK SOZLANGAN. Har qoida real moliyaviy xatodan keyin
 *    qo'shilgan. Izohlarni O'QIMASDAN o'zgartirmang:
 *      • qoldiq-evristika  → 2.2mlrd→3.3mlrd xatosi (olib tashlangan)
 *      • birlik qalqoni    → Т↔КГ = 1000x xato
 *      • grade-farq        → ПК↔ПБ boshqa mahsulot
 *      • qat'iy rejim      → generic resurs (000001) 153 joyda aralashardi
 *      • kod-kanon         → 105 ta ish topilmagan = 2.57 mlrd ko'rilmagan
 *      • yetim qutqarish   → ish topilmasa bolalari ham yo'qolardi
 *
 * TUZILISH:
 *   f2MoslashEngine(aktTree, lrvTree, opts)  ← SOF funksiya (GAS API'siz)
 *   apiF2AvtoMoslash(aktTree, obyekt, opts)  ← API o'ram (LRV ni o'zi oladi)
 *
 * Sof bo'lgani uchun `GAS/_f2lab` stendida Node'da deploysiz sinaladi.
 ********************************************************************/

/* `_LAT2CYR` — 10_Engine.js:2178 da e'lon qilingan (GAS global doira). */

/* ============ 1. NORMALIZATORLAR ============ */

function _f2mNormNom(s){
  s = String(s == null ? '' : s).toUpperCase();
  var out = '';
  for (var i = 0; i < s.length; i++){ var ch = s.charAt(i); out += (_LAT2CYR[ch] || ch); }
  out = out.replace(/Ё/g, 'Е');
  return out.replace(/[^0-9А-Я]/g, '');
}

function _f2mNormBir(s){
  var raw = String(s == null ? '' : s).toUpperCase()
    .replace(/³/g, '3').replace(/²/g, '2').replace(/¹/g, '1')
    .replace(/Ё/g, 'Е').replace(/[\s.,\-\/]+/g, '');
  var out = '';
  for (var i = 0; i < raw.length; i++){ var ch = raw.charAt(i); out += (_LAT2CYR[ch] || ch); }
  return out;
}

/* Kod: lotin→kirill (akt «E1-1-195» ↔ LRV «Е1-1-195») + sof raqamli kodda
 * bosh nollar olib tashlanadi («000001» ↔ «1»). */
function _f2mNormKod(s){
  s = String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, '');
  var out = '';
  for (var i = 0; i < s.length; i++){ var ch = s.charAt(i); out += (_LAT2CYR[ch] || ch); }
  if (/^\d+$/.test(out)) out = out.replace(/^0+/, '') || '0';
  return out;
}

/* «Aynan bir xil»: nom+birlik mos + kod mos YOKI kamida bir tomonda bo'sh.
 * (Aktlarda shifr ko'pincha umuman yo'q — u holda zamena so'ralmasin.) */
function _f2mAynanMi(kodA, nomA, birA, kodB, nomB, birB){
  if (_f2mNormNom(nomA) !== _f2mNormNom(nomB)) return false;
  if (_f2mNormBir(birA) !== _f2mNormBir(birB)) return false;
  var kA = _f2mNormKod(kodA), kB = _f2mNormKod(kodB);
  return (!kA || !kB || kA === kB);
}

/* Razdel nomi. ⚠️ Tozalash XOM matnda bajariladi — `_f2mNormNom` qavslarni
 * yo'q qilgandan KEYIN «(ЛИСТ КР-5)» ni olib tashlab bo'lmaydi. */
function _f2mNormRz(s){
  var r = String(s == null ? '' : s).toUpperCase().replace(/Ё/g, 'Е');
  r = r.replace(/\([^)]*\)/g, ' ');                       // (ЛИСТ КР-5), (ПЕРЕРАСЧЕТ)
  r = r.replace(/\bЛИСТ[\s.\-№]*[А-ЯA-Z0-9\-.,]*/g, ' '); // qavssiz «ЛИСТ КР-24»
  r = r.replace(/ПЕРЕРАСЧ[ЕЁ]Т/g, ' ');
  r = r.replace(/^\s*РАЗДЕЛ\s*[:№.\-]*\s*/, ' ');
  return _f2mNormNom(r);
}

/* KOD-KANON: akt va LRV bir xil rascenkani ikki xil yozadi.
 *   АКТ «Е1101-002-09 ДОП. 3»  ↔  LRV «E11-1-2-9»
 * Qoida: faqat 1-bo'lak → lotin→kirill → 4 xonali birinchi guruh (guruh≥2 bo'lsa)
 * ikkiga bo'linadi → har guruhdan bosh nol olinadi. */
function _f2mKodKanon(kod){
  var s = String(kod == null ? '' : kod).trim().toUpperCase().replace(/Ё/g, 'Е');
  if (!s) return '';
  s = s.split(/\s+/)[0];
  var o = '';
  for (var i = 0; i < s.length; i++){ var ch = s.charAt(i); o += (_LAT2CYR[ch] || ch); }
  s = o;
  var g = s.match(/\d+/g) || [];
  if (!g.length) return '';
  var pm = s.match(/([А-Я]+)/), pref = pm ? pm[1] : '';
  var parts = [];
  g.forEach(function(x, ix){
    if (ix === 0 && x.length === 4 && g.length >= 2){ parts.push(x.slice(0,2)); parts.push(x.slice(2)); }
    else parts.push(x);
  });
  parts = parts.map(function(x){ var n = parseInt(x, 10); return isNaN(n) ? x : String(n); });
  return pref + parts.join('-');
}

/* CHIZMA-VARAQ kodlari (КР-5, АР-12…) — razdel nomlari mos kelmasa ham
 * muhandis aynan shu bo'yicha bog'laydi. Oraliq («КР-28-35») yoyiladi. */
function _f2mRzKodlar(nom){
  var s = String(nom == null ? '' : nom).toUpperCase().replace(/Ё/g, 'Е');
  // ⚠️ `\b` ISHLATILMAYDI — JS'da `\w` kirillni bilmaydi, chegara topilmaydi.
  var out = {}, m, re = /(^|[^А-ЯA-Z0-9])([А-Я]{1,3})[\s.\-]*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g;
  var OK = {'КР':1,'АР':1,'КЖ':1,'АС':1,'ЭО':1,'ЭМ':1,'ОВ':1,'ВК':1,'СС':1,
            'ТХ':1,'ГП':1,'ПЗ':1,'ФЛ':1,'БФМ':1,'ПМ':1,'КМ':1,'ТИП':1};
  while ((m = re.exec(s))){
    var p = m[2]; if (!OK[p]) continue;
    var a = parseInt(m[3], 10), b = m[4] ? parseInt(m[4], 10) : a;
    if (isNaN(a)) continue;
    if (b < a || (b - a) > 40) b = a;
    for (var v = a; v <= b; v++) out[p + v] = 1;
  }
  return Object.keys(out);
}

/* ============ 2. DVIGATEL — SOF FUNKSIYA ============ */

/**
 * @param {Array}  aktTree  Ф2 akt daraxti (apiF2FaylOqi natijasi).
 *                          Tugun: {uid,type,kod,nom,bir,hajm,narx,summa,children}
 * @param {Array}  lrvTree  LRV_PLUS daraxti (apiHolatOl(...).tree).
 *                          Tugun: {type,kod,nom,birlik,varaq,row,lokalka,children}
 * @param {Object} opts     {lokalka?:string}  — '' yoki 'AVTO' → avto-aniqlash
 * @return {{mosliklar:Array, sabablar:Object, rzDiag:Array, stat:Object}}
 *
 * ⚠️ ASIMMETRIYA: akt tugunida birlik `bir`, LRV tugunida `birlik`. Ataylab.
 */
function f2MoslashEngine(aktTree, lrvTree, opts){
  aktTree = aktTree || [];
  lrvTree = lrvTree || [];
  opts = opts || {};

  var mosliklar = [];
  var sabablar  = {};
  var rzDiag    = [];
  var takliflar = {};

  /* Tezlik: klientda `.some()` bilan O(n) qidirilardi. 10 000 LRV qatori ×
   * 2 000 akt tuguni = 20 mln solishtiruv → GAS'da daqiqalar. Set bilan O(1).
   * Xatti-harakat AYNAN o'sha. */
  var band = {};      // 'varaq#row' → 1
  var moslangan = {}; // uid → 1
  function smetaTaken(varaq, row){ return band[varaq + '#' + row] === 1; }
  function alreadyMapped(uid){ return moslangan[uid] === 1; }
  function qoshMoslik(fNode, sMatch){
    mosliklar.push({
      uid: fNode.uid, varaq: sMatch.varaq, row: sMatch.row,
      kod: fNode.kod, hajm: fNode.hajm,
      narx: fNode.narx || 0, summa: fNode.summa || 0
    });
    band[sMatch.varaq + '#' + sMatch.row] = 1;
    moslangan[fNode.uid] = 1;
  }

  /* --- 2.1 Lokalka aniqlash (ko'p smetali obyekt) --- */
  var lok = (opts.lokalka && opts.lokalka !== 'AVTO') ? opts.lokalka : '';
  var lokAuto = false;
  // REMOVED: Tizim avtomatik lokalka tanlamaydi, global qidiruv uchun barchasi ochiq qoladi.

  /* --- 2.2 Global indekslar (lokalka cheklovi bilan) --- */
  var byKod = {}, byNomBir = {}, byKanon = {};
  (function(){
    (lrvTree || []).forEach(function(rz){
      if (rz.type !== 'rz') return;
      if (lok && (rz.lokalka || '') !== lok) return;
      (function collect(nodes){
        (nodes || []).forEach(function(n){
          if (n.type && n.type !== 'rz'){
            var k = _f2mNormKod(n.kod); if (k) (byKod[k] = byKod[k] || []).push(n);
            var kk = _f2mKodKanon(n.kod); if (kk) (byKanon[kk] = byKanon[kk] || []).push(n);
            var nb = _f2mNormNom(n.nom) + '||' + _f2mNormBir(n.birlik);
            (byNomBir[nb] = byNomBir[nb] || []).push(n);
          }
          if (n.children) collect(n.children);
        });
      })(rz.children);
    });
  })();

  /* --- 2.3 RAZDEL DOIRALARI (scope) ---
   * Real o'lchov: BL kodi GLOBAL 11/54 unikal, lekin O'Z RAZDELI ichida
   * 132/186 (71%) — shuning uchun avval razdel, keyin ish. */
  var rzScope = {};
  function _scopeAdd(key, n){
    if (!key) return;
    var sc = rzScope[key] = rzScope[key] || {byKod:{}, byNomBir:{}, byKanon:{}, all:[]};
    var k = _f2mNormKod(n.kod);   if (k)  (sc.byKod[k] = sc.byKod[k] || []).push(n);
    var kk = _f2mKodKanon(n.kod); if (kk) (sc.byKanon[kk] = sc.byKanon[kk] || []).push(n);
    var nb = _f2mNormNom(n.nom) + '||' + _f2mNormBir(n.birlik);
    (sc.byNomBir[nb] = sc.byNomBir[nb] || []).push(n);
    sc.all.push(n);
  }
  (lrvTree || []).forEach(function(rz){
    if (rz.type !== 'rz') return;
    if (lok && (rz.lokalka || '') !== lok) return;
    var k1 = _f2mNormRz(rz.nom);
    var kodKeys = _f2mRzKodlar(rz.nom).map(function(k){ return '#' + k; });
    (function collect(nodes){
      (nodes || []).forEach(function(n){
        if (n.type && n.type !== 'rz'){
          _scopeAdd(k1, n);
          kodKeys.forEach(function(kk){ _scopeAdd(kk, n); });
        }
        if (n.children) collect(n.children);
      });
    })(rz.children);
  });

  function _scopeQosh(a, b){
    if (!b) return a;
    if (!a) a = {byKod:{}, byNomBir:{}, byKanon:{}, all:[]};
    for (var k in b.byKod){ (a.byKod[k] = a.byKod[k] || []).push.apply(a.byKod[k], b.byKod[k]); }
    for (var kk in (b.byKanon || {})){ (a.byKanon[kk] = a.byKanon[kk] || []).push.apply(a.byKanon[kk], b.byKanon[kk]); }
    for (var n in b.byNomBir){ (a.byNomBir[n] = a.byNomBir[n] || []).push.apply(a.byNomBir[n], b.byNomBir[n]); }
    a.all.push.apply(a.all, b.all);
    return a;
  }
  function scopeOl(fRzNom){
    var k1 = _f2mNormRz(fRzNom);
    if (rzScope[k1]) return rzScope[k1];
    var kodlar = _f2mRzKodlar(fRzNom);
    if (!kodlar.length) return null;
    var birlashgan = null;
    kodlar.forEach(function(k){
      var s = rzScope['#' + k];
      if (s) birlashgan = _scopeQosh(birlashgan, s);
    });
    return birlashgan;
  }

  /* --- 2.4 TANLAGICHLAR --- */

  function _ekvivmi(cands){
    if (cands.length < 2) return true;
    function key(c){ return _f2mNormKod(c.kod) + '||' + _f2mNormNom(c.nom) + '||' + _f2mNormBir(c.birlik) + '||' + (Number(c.narx)||0); }
    var k0 = key(cands[0]);
    for (var i = 1; i < cands.length; i++) if (key(cands[i]) !== k0) return false;
    return true;
  }
  function _birinchiBosh(cands){
    for (var i = 0; i < cands.length; i++) if (!smetaTaken(cands[i].varaq, cands[i].row)) return cands[i];
    return null;
  }

  /* Global unikallik. ?? <band bo'lmaganlar orasida bitta qolsa> QOIDASI XATO EDI.
   * Endi: faqat aniq BITTA nomzod (yoki barcha nomzodlar ekvivalent). */
  function findUnique(cands){
    if (!cands || !cands.length) return null;
    if (cands.length === 1) return !smetaTaken(cands[0].varaq, cands[0].row) ? cands[0] : null;
    return _ekvivmi(cands) ? _birinchiBosh(cands) : null;
  }
  function pickUnique(cands){
    if (!cands || !cands.length) return null;
    var ok = cands.filter(function(c){ return c.type !== 'rz'; });
    if (!ok.length) return null;
    if (ok.length === 1) return smetaTaken(ok[0].varaq, ok[0].row) ? null : ok[0];
    return _birinchiBosh(ok); // Yanada kuchaytirildi: bir xil qatorlar orasidan birinchisini olish
  }
  /* QAT'IY: faqat AYNAN bitta nomzod. Ekvivalent-qisqartma ham, fuzzy ham yo'q.
   * Generic resurs (000001 = ЗАТРАТЫ ТРУДА) 153 joyda bir xil — aralashmasin. */
  function pickQatiy(arr){
    if (!arr || arr.length !== 1) return null;
    var c = arr[0];
    return (c.type !== 'rz' && !smetaTaken(c.varaq, c.row)) ? c : null;
  }

  /* БИРЛИК ҚАЛҚОНИ: «ПРОВОЛОКА [Т]» ↔ «ПРОВОЛОКА [КГ]» — 1000x xato xavfi. */
  function _birMos(aBir, bBir){
    var x = _f2mNormBir(aBir), y = _f2mNormBir(bBir);
    if (!x || !y) return true;   // biri bo'sh — hukm qilmaymiz
    return x === y;
  }

  /* FUZZY: aniq topilmaganda razdel ichida nom o'xshashligi. QAT'IY shartlar:
   * birlik aynan · raqamlar aynan (B25≠B30) · Dice ≥ .86 · g'olib farqi ≥ .12 */
  /* ⚠️⚠️ 2026-07-29 TUZATILDI — PANELDA BU IKKI HIMOYA O'LIK EDI.
   * Panelda: `_tokenlar(s){ return _f2NormNom(s).replace(...).split(/\s+/) }`
   * Lekin `_f2NormNom` probellarni ham olib tashlaydi (`[^0-9А-Я]`), shuning
   * uchun natija DOIM bitta uzun token bo'lardi:
   *     «БЕТОН М300 ТЯЖЕЛЫЙ» → ["БЕТОНМ300ТЯЖЕЛЫЙ"]
   * Oqibati:
   *   • `if(ftok.length<2) return null` → FUZZY hech qachon ishlamagan;
   *   • `_qisqaHarfKodlar` (2-3 harfli marka) hech narsa topmagan →
   *     GRADE-FARQ (ПК↔ПБ) tekshiruvi ham O'LIK edi.
   * To'g'ri yo'l: avval XOM matnni so'zlarga bo'lish, keyin har so'zni
   * alohida normallashtirish. */
  function _tokenlar(s){
    var raw = String(s == null ? '' : s).toUpperCase().replace(/Ё/g, 'Е');
    var parts = raw.split(/[^0-9A-Za-zА-Яа-я]+/);
    var out = [];
    for (var i = 0; i < parts.length; i++){
      var t = _f2mNormNom(parts[i]);
      if (t.length >= 2) out.push(t);
    }
    return out;
  }
  function _raqamlar(s){
    var m = String(s || '').match(/\d+([.,]\d+)?/g) || [];
    return m.map(function(x){ return x.replace(',', '.'); }).sort().join('|');
  }
  function _dice(aTok, bTok){
    if (!aTok.length || !bTok.length) return 0;
    var setB = {}, hit = 0;
    bTok.forEach(function(t){ setB[t] = (setB[t] || 0) + 1; });
    aTok.forEach(function(t){ if (setB[t] > 0){ hit++; setB[t]--; } });
    return (2 * hit) / (aTok.length + bTok.length);
  }
  /* GRADE-FARQ: ПК↔ПБ, АI↔АIII — boshqa mahsulot, avtomat bog'lanmaydi. */
  function _qisqaHarfKodlar(s){
    return _tokenlar(s).filter(function(t){ return /^[А-Я]{2,3}$/.test(t); });
  }
  function _gradeFarq(nomA, nomB){
    var A = _qisqaHarfKodlar(nomA), B = _qisqaHarfKodlar(nomB);
    if (!A.length || !B.length) return false;
    var setB = {}; B.forEach(function(t){ setB[t] = 1; });
    var setA = {}; A.forEach(function(t){ setA[t] = 1; });
    var aFarq = A.some(function(t){ return !setB[t]; });
    var bFarq = B.some(function(t){ return !setA[t]; });
    return aFarq && bFarq;
  }
  function pickFuzzy(cands, fNode){
    if (!cands || cands.length < 1) return null;
    var free = cands.filter(function(c){
      return c.type !== 'rz' && c.type !== 'bl' && !smetaTaken(c.varaq, c.row);
    });
    if (!free.length) return null;
    var fbir = _f2mNormBir(fNode.bir), fnum = _raqamlar(fNode.nom), ftok = _tokenlar(fNode.nom);
    if (ftok.length < 2) return null;   // juda qisqa nom — fuzzy xavfli
    var b1 = null, s1 = 0, s2 = 0;
    free.forEach(function(c){
      if (_f2mNormBir(c.birlik) !== fbir) return;
      if (_raqamlar(c.nom) !== fnum) return;
      var sc = _dice(ftok, _tokenlar(c.nom));
      if (sc > s1){ s2 = s1; s1 = sc; b1 = c; } else if (sc > s2){ s2 = sc; }
    });
    if (b1 && _gradeFarq(fNode.nom, b1.nom)) return null;
    if (b1 && s1 >= 0.86 && (s1 - s2) >= 0.12) return b1;
    return null;
  }

  /* --- 2.5 STATISTIKA --- */
  var st = {moslashti:0, otkazib:0, scopeHit:0, fuzzyHit:0, kanonHit:0,
            birlikBlok:0, zamenaShubha:0, yetimUrindi:0, yetimMos:0};

  function sababYoz(uid, kK, nb){
    var gN = ((byKod[kK]) || []).length, gN2 = ((byNomBir[nb]) || []).length;
    if (!gN && !gN2){ sabablar[uid] = 'сметада мос код/ном йўқ (доп бўлиши мумкин)'; return; }
    var n = Math.max(gN, gN2);
    sabablar[uid] = n > 1 ? (n + ' та номзод — қўлда танланг') : 'номзод банд ёки раздел мос эмас';
  }

  /* --- 2.6 RESURS/MATERIAL (yakka tugun) --- */
  function processStandalone(fNode, scope, qatiy){
    if (alreadyMapped(fNode.uid)) return;
    var fk   = _f2mNormKod(fNode.kod);
    var fkan = _f2mKodKanon(fNode.kod);
    var nb   = _f2mNormNom(fNode.nom) + '||' + _f2mNormBir(fNode.bir);
    function leafFilter(c){ return c.type !== 'rz' && c.type !== 'bl'; }
    var sMatch = null, viaScope = false;

    if (scope){
      sMatch = fk ? pickUnique((scope.byKod[fk] || []).filter(leafFilter)) : null;
      if (!sMatch && fkan) sMatch = pickUnique(((scope.byKanon || {})[fkan] || []).filter(leafFilter));
      if (!sMatch) sMatch = pickUnique((scope.byNomBir[nb] || []).filter(leafFilter));
      // QAT'IY rejimda fuzzy ISHLAMAYDI (aralashtirish xavfi)
      if (!qatiy && !sMatch && scope.all){
        sMatch = pickFuzzy(scope.all.filter(leafFilter), fNode);
        if (sMatch) st.fuzzyHit++;
      }
      if (sMatch) viaScope = true;
    }
    if (!qatiy && !sMatch && fk)   sMatch = pickUnique((byKod[fk] || []).filter(leafFilter));
    if (!qatiy && !sMatch && fkan) sMatch = pickUnique((byKanon[fkan] || []).filter(leafFilter));
    if (!qatiy && !sMatch)         sMatch = pickUnique((byNomBir[nb] || []).filter(leafFilter));

    if (sMatch && !_birMos(fNode.bir, sMatch.birlik)){
      st.otkazib++; st.birlikBlok++;
      sabablar[fNode.uid] = '⚖ БИРЛИК фарқли: акт «' + String(fNode.bir || '?') +
        '» ↔ смета «' + String(sMatch.birlik || '?') + '» — қўлда текширинг (1000x хато хавфи)';
      return;
    }
    if (sMatch && _gradeFarq(fNode.nom, sMatch.nom)){
      st.otkazib++; st.zamenaShubha++;
      sabablar[fNode.uid] = '🔄 эҳтимолий ЗАМЕНА: «' + String(sMatch.nom || '').slice(0,38) +
        '» — маркаси фарқли, қўлда боғланг/замена қилинг';
      return;
    }
    if (sMatch){ qoshMoslik(fNode, sMatch); st.moslashti++; if (viaScope) st.scopeHit++; }
    else { st.otkazib++; sababYoz(fNode.uid, fk, nb);
      var ts = [];
      if (scope && fk) ts.push.apply(ts, (scope.byKod[fk] || []).filter(leafFilter));
      if (scope && fkan) ts.push.apply(ts, ((scope.byKanon || {})[fkan] || []).filter(leafFilter));
      if (scope) ts.push.apply(ts, (scope.byNomBir[nb] || []).filter(leafFilter));
      if (!qatiy && fk) ts.push.apply(ts, (byKod[fk] || []).filter(leafFilter));
      if (!qatiy && fkan) ts.push.apply(ts, (byKanon[fkan] || []).filter(leafFilter));
      if (!qatiy) ts.push.apply(ts, (byNomBir[nb] || []).filter(leafFilter));
      var uniq = [], map = {};
      for(var i=0; i<ts.length; i++) {
        var c = ts[i];
        if(!smetaTaken(c.varaq, c.row)) {
          var k = c.varaq+'#'+c.row;
          if(!map[k]) { map[k]=1; uniq.push(c); }
        }
      }
      if(uniq.length>0) takliflar[fNode.uid] = uniq;
}
  }

  /* --- 2.7 ISH (bl) + bolalari --- */
  function processBl(fBl, scope, qatiy){
    if (alreadyMapped(fBl.uid)) return;
    var kK    = _f2mNormKod(fBl.kod);
    var nbBl  = _f2mNormNom(fBl.nom) + '||' + _f2mNormBir(fBl.bir);
    var kanBl = _f2mKodKanon(fBl.kod);
    var sMatch = null, viaScope = false, viaFuzzy = false, viaKanon = false;

    if (scope){
      sMatch = kK ? pickUnique(scope.byKod[kK]) : null;
      if (!sMatch && kanBl){ sMatch = pickUnique((scope.byKanon || {})[kanBl]); if (sMatch) viaKanon = true; }
      if (!sMatch) sMatch = pickUnique(scope.byNomBir[nbBl]);
      if (sMatch) viaScope = true;
      if (!qatiy && !sMatch && scope.all){ sMatch = pickFuzzy(scope.all, fBl); if (sMatch){ viaScope = true; viaFuzzy = true; } }
    }
    if (!qatiy && !sMatch) sMatch = pickUnique(byKod[kK]);
    if (!qatiy && !sMatch && kanBl){ sMatch = pickUnique(byKanon[kanBl]); if (sMatch) viaKanon = true; }

    if (sMatch && !_birMos(fBl.bir, sMatch.birlik)){
      st.otkazib++; st.birlikBlok++;
      sabablar[fBl.uid] = '⚖ БИРЛИК фарқли: акт «' + String(fBl.bir || '?') +
        '» ↔ смета «' + String(sMatch.birlik || '?') + '» — қўлда текширинг (1000x хато хавфи)';
      return;
    }
    if (!sMatch){
      sMatch = pickUnique((byNomBir[nbBl] || []).filter(function(c){
        // LRVda ish noto'g'ri 'mat' bo'lib saqlangan bo'lishi mumkin — rz dan boshqasi o'tadi
        return !!(c && _f2mAynanMi(fBl.kod, fBl.nom, fBl.bir, c.kod, c.nom, c.birlik)) && c.type !== 'rz';
      }));
    }

    /* Ish topilmadi → bolalari YO'QOLMASIN. (Amfiteatr: 105 ta topilmagan ish
     * ostidagi 824 resurs = 2.57 MLRD moslashtirishga umuman kirmagan edi.) */
    if (!sMatch || sMatch.type === 'rz'){
      st.otkazib++; sababYoz(fBl.uid, kK, nbBl);

      var ts = [];
      function blFilter(c){ return c.type !== 'rz'; }
      if (scope && kK) ts.push.apply(ts, (scope.byKod[kK] || []).filter(blFilter));
      if (scope && kanBl) ts.push.apply(ts, ((scope.byKanon || {})[kanBl] || []).filter(blFilter));
      if (scope) ts.push.apply(ts, (scope.byNomBir[nbBl] || []).filter(blFilter));
      if (!qatiy && kK) ts.push.apply(ts, (byKod[kK] || []).filter(blFilter));
      if (!qatiy && kanBl) ts.push.apply(ts, (byKanon[kanBl] || []).filter(blFilter));
      if (!qatiy) ts.push.apply(ts, (byNomBir[nbBl] || []).filter(blFilter));
      var uniq = [], map = {};
      for(var i=0; i<ts.length; i++) {
        var c = ts[i];
        if(!smetaTaken(c.varaq, c.row)) {
          var k = c.varaq+'#'+c.row;
          if(!map[k]) { map[k]=1; uniq.push(c); }
        }
      }
      if(uniq.length>0) takliflar[fBl.uid] = uniq;

      (fBl.children || []).forEach(function(fRs){
        if (fRs.type !== 'rs' && fRs.type !== 'mat' && fRs.type !== 'ob') return;
        if (alreadyMapped(fRs.uid)) return;
        st.yetimUrindi++;
        var oldin = mosliklar.length;
        processStandalone(fRs, scope, true);   // QAT'IY — aralashtirmaydi
        if (mosliklar.length > oldin) st.yetimMos++;
      });
      return;
    }
    /* GRADE-FARQ darvozasi: ПК↔ПБ — qo'lda zamena qilinsin */
    if (_gradeFarq(fBl.nom, sMatch.nom)){
      st.otkazib++; st.zamenaShubha++;
      sabablar[fBl.uid] = '🔄 эҳтимолий ЗАМЕНА: «' + String(sMatch.nom || '').slice(0,38) +
        '» — маркаси фарқли, қўлда боғланг/замена қилинг';
      return;
    }

    qoshMoslik(fBl, sMatch);
    st.moslashti++;
    if (viaScope) st.scopeHit++;
    if (viaFuzzy) st.fuzzyHit++;
    if (viaKanon) st.kanonHit++;

    /* Bolalar FAQAT shu ish ichida qidiriladi. ⚠️ Global qidiruv generic
     * kodlar uchun tasodifiy qatorni tanlab, pulni boshqa ishga yozardi. */
    if (fBl.children && fBl.children.length && sMatch.children && sMatch.children.length){
      fBl.children.forEach(function(fRs){
        if (fRs.type !== 'rs' && fRs.type !== 'mat' && fRs.type !== 'ob') return;
        if (alreadyMapped(fRs.uid)) return;

        var fk = _f2mNormKod(fRs.kod);
        var candKod = fk ? sMatch.children.filter(function(c){ return _f2mNormKod(c.kod) === fk; }) : [];
        var sRs = (candKod.length === 1 && !smetaTaken(candKod[0].varaq, candKod[0].row)) ? candKod[0] : null;

        if (!sRs){
          var kn2 = _f2mKodKanon(fRs.kod);
          var candKan = kn2 ? sMatch.children.filter(function(c){ return _f2mKodKanon(c.kod) === kn2; }) : [];
          if (candKan.length === 1 && !smetaTaken(candKan[0].varaq, candKan[0].row)) sRs = candKan[0];
        }
        if (!sRs){
          var nb2 = _f2mNormNom(fRs.nom) + '||' + _f2mNormBir(fRs.bir);
          var candRs = sMatch.children.filter(function(c){
            return (_f2mNormNom(c.nom) + '||' + _f2mNormBir(c.birlik)) === nb2;
          });
          if (candRs.length === 1 && !smetaTaken(candRs[0].varaq, candRs[0].row)) sRs = candRs[0];
        }
        /* Ish bog'landi-yu bolasi topilmadi (LRVda 'mat' bo'lib saqlangan bo'lishi
         * mumkin) → razdel doirasida QAT'IY qidiramiz. */
        if (!sRs){
          var oldinS = mosliklar.length;
          processStandalone(fRs, scope, true);
          if (mosliklar.length > oldinS){ st.moslashti++; return; }
        }
        if (sRs){ qoshMoslik(fRs, sRs); st.moslashti++; }
        else st.otkazib++;
      });
    }
  }

  /* --- 2.8 DARAXTNI AYLANISH --- */
  (function walk(nodes, scope){
    (nodes || []).forEach(function(n){
      if (n.type === 'rz'){
        var sc = scopeOl(n.nom);
        rzDiag.push({nom: n.nom, ok: !!sc});
        walk(n.children || [], sc);
        return;
      }
      if (n.type === 'bl') processBl(n, scope);
      else if (n.type === 'mat' || n.type === 'ob' || n.type === 'rs') processStandalone(n, scope);
    });
  })(aktTree, null);

  st.lokalka = lok;
  st.lokAuto = lokAuto;
  st.rzMos   = rzDiag.filter(function(d){ return d.ok; }).length;
  st.rzJami  = rzDiag.length;

  return {mosliklar: mosliklar, sabablar: sabablar, rzDiag: rzDiag, stat: st, takliflar: takliflar};
}

/* Akt qaysi lokalkaga tegishli: razdel nomi +5 ball, ish kodi +1 ball. */
function _f2mLokalkaAniqla(aktTree, lrvTree){
  var aktRz = {}, aktKod = {};
  (aktTree || []).forEach(function(rz){
    var k = _f2mNormRz(rz.nom); if (k) aktRz[k] = 1;
    (function w(nodes){
      (nodes || []).forEach(function(n){
        if (n.type === 'bl'){ var kk = _f2mNormKod(n.kod); if (kk) aktKod[kk] = 1; }
        if (n.children) w(n.children);
      });
    })(rz.children);
  });
  var scores = {};
  (lrvTree || []).forEach(function(rz){
    if (rz.type !== 'rz') return;
    var L = rz.lokalka || ''; if (!L) return;
    scores[L] = scores[L] || 0;
    if (aktRz[_f2mNormRz(rz.nom)]) scores[L] += 5;
    (function w(nodes){
      (nodes || []).forEach(function(n){
        if (n.type === 'bl' && aktKod[_f2mNormKod(n.kod)]) scores[L] += 1;
        if (n.children) w(n.children);
      });
    })(rz.children);
  });
  var best = '', bs = 0;
  for (var L in scores){ if (scores[L] > bs){ bs = scores[L]; best = L; } }
  return {best: best, ball: bs, soni: Object.keys(scores).length};
}

/* ============ 3. API O'RAMI ============ */

/**
 * Sayt va Panel uchun yagona kirish nuqtasi.
 * @param {Array}  aktTree  apiF2FaylOqi natijasi
 * @param {string} obyekt
 * @param {Object} opts     {lokalka?:string, lrvTree?:Array}
 */
function apiF2AvtoMoslash(aktTree, obyekt, opts){
  opts = opts || {};
  var t0 = Date.now();

  var lrvTree = opts.lrvTree;
  if (!lrvTree){
    if (!obyekt) throw 'Обyekt кўрсатилмаган';
    var holat = apiHolatOl(obyekt, false);
    lrvTree = (holat && holat.tree) || [];
  }

  var r = f2MoslashEngine(aktTree, lrvTree, opts);
  r.stat.ms = Date.now() - t0;
  return r;
}

/* ============ 4. O'ZINI SINASH ============ */

/** Normalizatorlar to'g'ri ishlayaptimi — menyudan yoki testdan chaqiriladi. */
function f2MoslashSelfTest(){
  var x = [];
  function t(nom, olingan, kutilgan){
    var ok = String(olingan) === String(kutilgan);
    x.push((ok ? '✅' : '❌') + ' ' + nom + ': ' + olingan + (ok ? '' : ' (кутилган: ' + kutilgan + ')'));
    return ok;
  }
  var jami = 0, ok = 0;
  function T(){ jami++; if (t.apply(null, arguments)) ok++; }

  T('kanon Е1101-002-09', _f2mKodKanon('Е1101-002-09 ДОП. 3'), 'Е11-1-2-9');
  T('kanon E1-2-3-13',    _f2mKodKanon('E1-2-3-13 ШHК.ДОП.6'), 'Е1-2-3-13');
  T('kanon yakka guruh',  _f2mKodKanon('000162'), '162');
  T('normKod bosh nol',   _f2mNormKod('000001'), '1');
  T('normKod lotin E',    _f2mNormKod('E1-1-195'), 'Е1-1-195');
  T('normBir m3',         _f2mNormBir('М³'), 'М3');
  T('normRz qavs',        _f2mNormRz('РАЗДЕЛ: ФУНДАМЕНТЫ (ЛИСТ КР-5)'), 'ФУНДАМЕНТЫ');
  T('rzKodlar oraliq',    _f2mRzKodlar('КОЛОННЫ (ЛИСТ КР-28-30)').sort().join(','), 'КР28,КР29,КР30');
  T('aynan kodsiz',       _f2mAynanMi('', 'БЕТОН', 'М3', 'Е1-1', 'БЕТОН', 'М3'), 'true');
  T('aynan kod farqli',   _f2mAynanMi('А1', 'БЕТОН', 'М3', 'Б2', 'БЕТОН', 'М3'), 'false');

  /* ---- DVIGATEL XATTI-HARAKATI (normalizator emas — haqiqiy moslashtirish) ---- */

  function rz(nom, kids){ return {type:'rz', nom:nom, lokalka:'L1', children:kids}; }
  function lrv(o){
    return {type:o.t||'mat', nom:o.nom, kod:o.kod||'', birlik:o.bir||'',
            narx:o.narx||0, varaq:'V1', row:o.row, children:o.kids||[]};
  }
  function akt(o){
    return {type:o.t||'mat', uid:o.uid, nom:o.nom, kod:o.kod||'', bir:o.bir||'',
            hajm:o.hajm||1, narx:o.narx||0, summa:o.summa||0, children:o.kids||[]};
  }
  function mosMi(aktT, lrvT, uid){
    var r = f2MoslashEngine(aktT, lrvT, {lokalka:'L1'});
    for (var i = 0; i < r.mosliklar.length; i++) if (r.mosliklar[i].uid === uid) return r.mosliklar[i].row;
    return 0;
  }

  // 1) Aynan mos — bog'lanishi SHART
  T('аниқ мослик',
    mosMi([rz('ФУНДАМЕНТЫ', [akt({uid:'a1', nom:'ЦЕМЕНТ М400', kod:'С124', bir:'Т'})])],
          [rz('ФУНДАМЕНТЫ', [lrv({nom:'ЦЕМЕНТ М400', kod:'С124', bir:'Т', row:10})])], 'a1'), 10);

  // 2) БИРЛИК ҚАЛҚОНИ — Т ↔ КГ bog'lanmasin (1000x xato)
  T('бирлик қалқони Т↔КГ',
    mosMi([rz('ФУНДАМЕНТЫ', [akt({uid:'a2', nom:'ПРОВОЛОКА ВЯЗАЛЬНАЯ', kod:'С101', bir:'Т'})])],
          [rz('ФУНДАМЕНТЫ', [lrv({nom:'ПРОВОЛОКА ВЯЗАЛЬНАЯ', kod:'С101', bir:'КГ', row:11})])], 'a2'), 0);

  // 3) GRADE-FARQ — ПК ↔ ПБ boshqa mahsulot (panelda bu himoya O'LIK edi)
  T('grade-фарқ ПК↔ПБ',
    mosMi([rz('ПЕРЕКРЫТИЯ', [akt({uid:'a3', nom:'ПЛИТА ПБ 59-12', bir:'ШТ'})])],
          [rz('ПЕРЕКРЫТИЯ', [lrv({nom:'ПЛИТА ПК 59-12', bir:'ШТ', row:12})])], 'a3'), 0);

  // 4) Ikkilanish — ikki HAR XIL nomzod bo'lsa bog'lanmasin
  T('икки хил номзод — боғланмайди',
    mosMi([rz('ЗЕМРАБОТЫ', [akt({uid:'a4', nom:'ГРУНТ', kod:'К1', bir:'М3'})])],
          [rz('ЗЕМРАБОТЫ', [lrv({nom:'ГРУНТ', kod:'К1', bir:'М3', narx:100, row:13}),
                            lrv({nom:'ГРУНТ', kod:'К1', bir:'М3', narx:250, row:14})])], 'a4'), 0);

  // 5) Ekvivalent nomzodlar (kod+nom+birlik+narx AYNAN teng) — birinchi bo'shi
  T('эквивалент номзодлар',
    mosMi([rz('ЗЕМРАБОТЫ', [akt({uid:'a5', nom:'ГРУНТ', kod:'К1', bir:'М3'})])],
          [rz('ЗЕМРАБОТЫ', [lrv({nom:'ГРУНТ', kod:'К1', bir:'М3', narx:100, row:15}),
                            lrv({nom:'ГРУНТ', kod:'К1', bir:'М3', narx:100, row:16})])], 'a5'), 15);

  // 6) KOD-KANON — ikki xil yozuv bir xil rascenka
  T('код-канон Е1101-002-09↔E11-1-2-9',
    mosMi([rz('КОЛОННЫ', [akt({uid:'a6', t:'bl', nom:'МОНТАЖ КОЛОНН', kod:'Е1101-002-09 ДОП. 3', bir:'ШТ'})])],
          [rz('КОЛОННЫ', [lrv({t:'bl', nom:'УСТАНОВКА КОЛОНН', kod:'E11-1-2-9', bir:'ШТ', row:17})])], 'a6'), 17);

  // 7) ЕТИМ РЕСУРС: ish topilmasa ham bolasi qutqarilsin (2.57 mlrd yo'qolishi)
  T('етим ресурс қутқарилди',
    mosMi([rz('КР-5', [akt({uid:'b1', t:'bl', nom:'НОМАЪЛУМ ИШ', kod:'ZZZ99', bir:'М3',
                            kids:[akt({uid:'r1', t:'rs', nom:'ЦЕМЕНТ М500', kod:'С777', bir:'Т'})]})])],
          [rz('КР-5', [lrv({nom:'ЦЕМЕНТ М500', kod:'С777', bir:'Т', row:18})])], 'r1'), 18);

  // 8) CHIZMA-VARAQ kodi bo'yicha razdel doirasi (nomlar mos kelmasa ham)
  T('чизма-варақ КР-5 доираси',
    mosMi([rz('РАЗДЕЛ: ФУНДАМЕНТЫ (ЛИСТ КР-5)', [akt({uid:'c1', nom:'АРМАТУРА А500', kod:'А5', bir:'Т'})])],
          [rz('ФУНДАМЕНТ ЛЕНТОЧНЫЙ ФЛ-2 (КР-5)', [lrv({nom:'АРМАТУРА А500', kod:'А5', bir:'Т', row:19})])], 'c1'), 19);

  var xul = ok + '/' + jami + ' тест ўтди';
  Logger.log(xul + '\n' + x.join('\n'));
  return {ok: ok, jami: jami, xulosa: xul, satrlar: x};
}

/* ============ 5. YORDAMCHI — SAYT UCHUN ============ */

/**
 * Fayldagi varaqlar ro'yxati. Sayt Ф2 importida foydalanuvchi qaysi varaqni
 * o'qishni tanlashi uchun kerak (panelda bu ro'yxat boshqa yo'l bilan olinardi).
 * @param {string} fileId
 * @return {{ok:boolean, varaqlar?:Array, xabar?:string}}
 */
function apiF2Varaqlar(fileId){
  try{
    /* ⚡⚡⚡ 2026-08-13 ILDIZ TUZATISH (foydalanuvchi: Drive'dan .xlsx tanlasa
     * «GAS HTML qaytardi» chiqaverdi). Avvalgi himoya 3 ta Excel-mime QORA
     * ro'yxati edi — lekin Telegram/API orqali yuklangan fayl mime'i ko'pincha
     * 'application/octet-stream' (yoki boshqa) bo'ladi, tekshiruvdan sirg'alib
     * o'tib SpreadsheetApp.openById V8'ni qulatardi (try/catch HAM ushlamaydi,
     * saytga Google'ning HTML sahifasi ketardi — jonli sinovda tasdiqlandi:
     * xuddi shu fayl bilan guard turib ham HTML qaytdi).
     * ENDI TESKARI: faqat haqiqiy GOOGLE_SHEETS ochiladi, qolgan HAMMASI
     * _excelToNative (Drive.Files.copy REST — V8 xavfsiz) bilan avtomatik
     * Google Sheets'ga KONVERT qilinadi va yangi ID qaytariladi. */
    var meta = Drive.Files.get(fileId, {fields:'id,name,mimeType,parents'});
    var yangiFileId = '';
    if (meta.mimeType !== 'application/vnd.google-apps.spreadsheet') {
      var parent = (meta.parents && meta.parents[0]) || '';
      var yangiNom = String(meta.name||'F2').replace(/\.(xlsx|xlsm|xls|csv)$/i,'') + ' (GS)';
      /* ⚡⚡⚡ 2026-08-13 #REF! MUAMMOSI: avval Drive.Files.copy bilan konvert
       * qilinardi — u FORMULANI ko'chirib QAYTA HISOBLAYDI. Tashqi faylga
       * havola (masalan [Kitob2]List1!A5) Google Sheets'da yo'q → #REF!,
       * va Excel hisoblab qo'ygan HAQIQIY SON butunlay yo'qoladi. Natijada
       * importda ko'p qator chiqmasdi (foydalanuvchi aytgan muammo).
       * ENDI BIRINCHI YO'L: .xlsx ni ochib FAQAT <v> keshlangan qiymatlarni
       * o'qiymiz (36_XlsxQiymat.js) — formula umuman ko'chirilmaydi, ya'ni
       * #REF! paydo bo'lishi MUMKIN EMAS. */
      try {
        if (typeof apiXlsxQiymatBilanOch === 'function') {
          var qres = apiXlsxQiymatBilanOch(fileId, parent);
          if (qres && qres.ok && qres.fileId) {
            yangiFileId = qres.fileId;
            fileId = yangiFileId;
            var ssQ = SpreadsheetApp.openById(fileId);
            var outQ = ssQ.getSheets().map(function(sh){
              return { nom: sh.getName(), qatorlar: sh.getLastRow(),
                       ustunlar: sh.getLastColumn(), yashirin: sh.isSheetHidden() };
            }).filter(function(v){ return !v.yashirin && v.qatorlar > 1; });
            if (outQ.length) {
              return {ok:true, varaqlar:outQ, nom:ssQ.getName(),
                      yangiFileId:yangiFileId, faqatQiymat:true,
                      aslFormulaKatak:qres.aslFormulaKatak, aslXatoKatak:qres.aslXatoKatak};
            }
          }
        }
      } catch(eq){ /* zaxira yo'lga o'tamiz */ }

      try {
        yangiFileId = _excelToNative(fileId, parent, yangiNom);
      } catch(ce) {
        // Konvert bo'lmadi — fayl shikastlangan/parolli/soxta-xlsx. Aniq sabab + yo'l ko'rsatamiz.
        return {ok:false, xabar:'«'+meta.name+'» файлини Google Sheets га конверт қилиб бўлмади (тури: '+meta.mimeType+'). '+
          'Файл шикастланган, парол билан ҳимояланган ёки аслида Excel эмас бўлиши мумкин. '+
          'Уни компьютерда очиб текширинг, сўнг «Компьютердан юклаш» орқали қайта юкланг. Техник хато: '+String((ce&&ce.message)||ce)};
      }
      fileId = yangiFileId;
    }

    var ss = SpreadsheetApp.openById(fileId);
    var out = ss.getSheets().map(function(sh){
      return {
        nom: sh.getName(),
        qatorlar: sh.getLastRow(),
        ustunlar: sh.getLastColumn(),
        yashirin: sh.isSheetHidden()
      };
    }).filter(function(v){ return !v.yashirin && v.qatorlar > 1; });
    if(!out.length) return {ok:false, xabar:'Файлда тўлдирилган варақ топилмади'};
    // yangiFileId bo'lsa — frontend fid'ni SHU yangi (native) faylga almashtirishi shart,
    // aks holda keyingi apiF2FaylOqi yana eski xlsx bilan chaqiriladi.
    return {ok:true, varaqlar:out, nom:ss.getName(), yangiFileId:(yangiFileId||undefined)};
  }catch(e){
    return {ok:false, xabar:'Файлни очиб бўлмади: '+String(e.message||e)};
  }
}

/* ============ 6. Ф2 = 0 MUAMMOSI — DIAGNOSTIKA ============ */

/**
 * «Ф2 киритилган ойлар 0 кўрсатади» муаммосини аниқлаш.
 * Занжир: ой устунлари → ST_F2 формуласи → ЖАМИ қатор → _SERVER_DASHBOARD → Boss.
 * Ҳар бўғинни алоҳида ўлчаб, қайси жойда узилганини кўрсатади.
 *
 * @param {string} obyekt
 */
function apiF2NolDiagnostika(obyekt){
  var out = {obyekt: obyekt, varaqlar: [], dashboard: null, xulosa: ''};
  try{
    var col = CFG.C;
    var subs = _subObyektlar(obyekt) || [obyekt];

    subs.forEach(function(sub){
      var plus = _plusTop(sub);
      if(!plus){ out.varaqlar.push({sub: sub, xato: 'LRV_PLUS топилмади'}); return; }

      plus.getSheets().forEach(function(sh){
        var nom = sh.getName();
        if(nom.charAt(0) === '_') return;
        var last = sh.getLastRow();
        if(last < 2) return;

        // Oy ustunlari (F2_BIRINCHI dan boshlab, har oy 3 ustun: ОБЪЁМ|НАРХ|СУММА)
        var oylar = [];
        try{ oylar = _f2Oylar(sh) || []; }catch(e){}

        // ЖАМИ qatorlari va ulardagi ST_F2
        var stF2Jami = 0, jamiSoni = 0, formula = '', qiymat = 0;
        var mk = sh.getRange(1, col.MARKER, last, 1).getValues();
        for(var i = 0; i < mk.length; i++){
          var m = String(mk[i][0] || '').trim().toLowerCase();
          if(m !== 'rz') continue;
          var r = i + 1;
          jamiSoni++;
          var v = sh.getRange(r, col.ST_F2).getValue();
          if(!formula){ formula = String(sh.getRange(r, col.ST_F2).getFormula() || '(формула йўқ)'); }
          stF2Jami += (Number(v) || 0);
        }

        // Oy ustunlaridagi XOM summa (formuladan mustaqil)
        var xomF2 = 0;
        if(oylar.length){
          oylar.forEach(function(o){
            var sumCol = o.col + 2;   // ОБЪЁМ|НАРХ|СУММА
            if(sumCol > sh.getLastColumn()) return;
            var vals = sh.getRange(2, sumCol, last - 1, 1).getValues();
            for(var k = 0; k < vals.length; k++) xomF2 += (Number(vals[k][0]) || 0);
          });
        }

        out.varaqlar.push({
          sub: sub, varaq: nom,
          oylarSoni: oylar.length,
          oylar: oylar.map(function(o){ return o.nom + '@' + o.col; }),
          jamiQatorlar: jamiSoni,
          stF2_formula: formula.slice(0, 120),
          stF2_yigindi: Math.round(stF2Jami),
          oyUstunlari_xomYigindi: Math.round(xomF2),
          mos: Math.abs(stF2Jami - xomF2) < 1
        });
      });
    });

    // Dashboard qatori
    try{
      var srv = _serverSS(sozAsosiy());
      var dash = _dash(srv);
      var dv = dash.getRange(2, 1, Math.max(1, dash.getLastRow() - 1), 13).getValues();
      for(var d = 0; d < dv.length; d++){
        if(String(dv[d][0] || '').trim() === obyekt){
          out.dashboard = {smeta: dv[d][1], fakt: dv[d][8], f2: dv[d][9], ost: dv[d][10], yangilandi: dv[d][12]};
          break;
        }
      }
    }catch(e){ out.dashboard = {xato: String(e.message || e)}; }

    // Xulosa
    var xomJami = 0, stJami = 0;
    out.varaqlar.forEach(function(v){
      xomJami += (v.oyUstunlari_xomYigindi || 0);
      stJami  += (v.stF2_yigindi || 0);
    });
    if(!xomJami)                      out.xulosa = '❌ Ой устунларида Ф2 СУММАСИ УМУМАН ЙЎҚ — Ф2 ёзилмаган ёки бошқа устунга ёзилган';
    else if(Math.abs(stJami) < 1)     out.xulosa = '❌ Ой устунларида ' + Math.round(xomJami) + ' бор, лекин ST_F2 ФОРМУЛАСИ 0 — формула ой устунларини қамрамайди';
    else if(!out.dashboard)           out.xulosa = '❌ ST_F2 = ' + Math.round(stJami) + ', лекин DASHBOARD да бу объект қатори ЙЎҚ';
    else if(!Number(out.dashboard.f2)) out.xulosa = '❌ ST_F2 = ' + Math.round(stJami) + ', лекин DASHBOARD f2 = 0 — сервер қайта йиғилмаган (serverYigPapka)';
    else                              out.xulosa = '✅ Занжир бутун: ой=' + Math.round(xomJami) + ' → ST_F2=' + Math.round(stJami) + ' → dashboard=' + Math.round(out.dashboard.f2);

    Logger.log(JSON.stringify(out, null, 1));
    return out;
  }catch(e){
    out.xulosa = 'ХАТО: ' + String(e.message || e);
    Logger.log(out.xulosa);
    return out;
  }
}
// trigger sync
