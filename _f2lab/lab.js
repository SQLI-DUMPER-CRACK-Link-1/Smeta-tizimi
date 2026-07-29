/* ══════════════════════════════════════════════════════════════════
 * F2 LAB — HAQIQIY ishlab chiqarish kodini Node'da ishga tushirish.
 *   • apiF2FaylOqi (30_Panel.js)  → SpreadsheetApp stub bilan
 *   • f2AvtoMoslash (Panel.html)  → DOM stub bilan
 * Deploy KERAK EMAS: har o'zgarishdan keyin soniyalarda natija.
 * ══════════════════════════════════════════════════════════════════ */
const fs=require('fs'), path=require('path'), vm=require('vm');
const xlsx=require('./xlsx.js');

const SRC='C:/Users/PC/Documents/GAS/Smeta tizimi';

/* ── CFG (00_Config.js dan) ── */
function loadCFG(){
  const txt=fs.readFileSync(path.join(SRC,'00_Config.js'),'utf8');
  const m=txt.match(/var\s+CFG\s*=\s*(\{[\s\S]*?\n\};)/);
  if(!m) throw new Error('CFG topilmadi');
  return vm.runInNewContext('('+m[1].replace(/;$/,'')+')');
}
const CFG=loadCFG();
const C=CFG.C;

/* ── Umumiy GAS stublari ── */
function baseSandbox(){
  const noop=()=>{};
  const chain=new Proxy(function(){}, { get:()=>chain, apply:()=>chain });
  return {
    console, Math, JSON, Date, String, Number, Boolean, Array, Object, RegExp, isNaN, parseFloat, parseInt,
    CFG,
    Logger:{log:noop},
    Utilities:{formatDate:(d,tz,f)=>new Date(d).toISOString().slice(0,10), sleep:noop},
    Session:{getScriptTimeZone:()=>'Asia/Tashkent', getActiveUser:()=>({getEmail:()=>'lab@test'})},
    CacheService:{getUserCache:()=>({get:()=>null,put:noop,remove:noop}), getScriptCache:()=>({get:()=>null,put:noop,remove:noop})},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty:noop}), getDocumentProperties:()=>({getProperty:()=>null,setProperty:noop})},
    ScriptApp:{getProjectTriggers:()=>[], newTrigger:()=>chain, getService:()=>({getUrl:()=>'http://lab'})},
    DriveApp:chain, SpreadsheetApp:{flush:noop},
    _toNum:v=>{ if(typeof v==='number') return v; const n=parseFloat(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); return isNaN(n)?0:n; },
  };
}

/* ── 30_Panel.js ni yuklab, kerakli funksiyalarni olish ── */
let _serverCtx=null;
function server(){
  if(_serverCtx) return _serverCtx;
  const sb=baseSandbox();
  sb.global=sb;
  const ctx=vm.createContext(sb);
  const txt=fs.readFileSync(path.join(SRC,'30_Panel.js'),'utf8');
  // Faqat funksiya-deklaratsiyalar bajariladi (top-level chaqiruv yo'q)
  vm.runInContext(txt, ctx, {filename:'30_Panel.js'});
  _serverCtx=sb;
  return sb;
}

/* ── AKT (F2 fayl) ni HAQIQIY apiF2FaylOqi bilan o'qish ── */
function aktOqi(file, varaqNom, colConfig){
  const wb=xlsx.open(file);
  const sh=varaqNom ? wb.sheet(varaqNom) : wb.sheets.reduce((a,b)=>(b.rows.length>a.rows.length?b:a));
  if(!sh) throw new Error('Varaq topilmadi: '+varaqNom);
  const sb=server();
  // SpreadsheetApp stub — real funksiya shu orqali ma'lumot oladi
  sb.SpreadsheetApp.openById=()=>({
    getSheetByName:n=>(n===sh.name?fakeSheet(sh):null),
    getSheets:()=>[fakeSheet(sh)]
  });
  function fakeSheet(s){
    const maxC=s.rows.reduce((m,r)=>Math.max(m,r.length),0);
    const vals=s.rows.map(r=>{ const a=r.slice(); while(a.length<maxC) a.push(''); return a.map(x=>x===undefined?'':x); });
    return { getName:()=>s.name, getLastRow:()=>vals.length, getLastColumn:()=>maxC,
             getDataRange:()=>({getValues:()=>vals}) };
  }
  const r=sb.apiF2FaylOqi('LAB', sh.name, colConfig||null);
  return {sheetName:sh.name, res:r, sheets:wb.sheets.map(s=>s.name+'('+s.rows.length+')')};
}

/* ── LRV_PLUS → TREE_DATA (apiHolatOl node shakli bilan bir xil) ── */
function lrvTree(file, lokalka){
  const wb=xlsx.open(file);
  const lrvSheets=wb.sheets.filter(s=>s.name.indexOf(CFG.LRV_SHEET)===0);
  if(!lrvSheets.length) throw new Error('ЛРВ varaq topilmadi: '+wb.sheets.map(s=>s.name).join(','));
  const N=v=>{ if(typeof v==='number') return v; const n=parseFloat(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); return isNaN(n)?0:n; };
  const S=v=>String(v==null?'':v).trim();
  const tree=[]; const stat={rzYoq:0, rsTashlandi:0, rows:0};
  lrvSheets.forEach(sh=>{
    let curRz=null, curBl=null;
    sh.rows.forEach((row,i)=>{
      const r=i+1;
      const mk=S(row[C.MARKER-1]).toLowerCase();
      const baseMk=mk.replace(/[+~]$/,'');
      if(!baseMk) return;
      stat.rows++;
      const nom=S(row[C.NOM-1]);
      if(baseMk==='rz'){
        let rzNom=nom;
        if(!rzNom){ for(let c=0;c<8;c++){ const v=S(row[c]); if(v&&/[А-ЯЁA-Za-zА-яёa-z]/.test(v)){ rzNom=v; break; } } }
        curRz={type:'rz', nom:rzNom, varaq:sh.name, row:r, children:[], lokalka:lokalka||'',
               d1:S(row[C.QAVAT1-1]), d2:S(row[C.QAVAT2-1]), d3:S(row[C.QAVAT3-1])};
        tree.push(curRz); curBl=null; return;
      }
      if(baseMk!=='bl'&&baseMk!=='mat'&&baseMk!=='ob'&&baseMk!=='rs') return;
      const node={
        type:baseMk, nom:nom, varaq:sh.name, row:r,
        kod:S(row[C.KOD-1]), birlik:S(row[C.BIRLIK-1]),
        smetaHajm:N(row[C.E-1]), f:N(row[C.F-1]),
        fakt:N(row[C.FAKT-1]), qoldiq:N(row[C.QOLDIQ-1]),
        narx:N(row[C.NARX-1]), f2ol:N(row[C.F2OL-1]), f2mum:N(row[C.F2MUM-1]),
        smeta:N(row[C.SMETA-1]), stFakt:N(row[C.ST_FAKT-1]), stF2:N(row[C.ST_F2-1]), stOst:N(row[C.ST_OST-1]),
        isQosh:/[+~]$/.test(mk), isZamena:/~$/.test(mk), children:[]
      };
      if(baseMk==='rs'){
        if(curBl) curBl.children.push(node); else stat.rsTashlandi++;   // ⚠ apiHolatOl xuddi shunday tashlaydi
        return;
      }
      if(!curRz){ stat.rzYoq++; tree.push(node); }
      else curRz.children.push(node);
      curBl = (baseMk==='bl') ? node : null;
    });
  });
  return {tree, stat, varaqlar:lrvSheets.map(s=>s.name)};
}

/* ── Panel.html client kodini yuklash (DOM stub) ── */
let _uiCtx=null;
function ui(){
  if(_uiCtx) return _uiCtx;
  const html=fs.readFileSync(path.join(SRC,'Panel.html'),'utf8');
  const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const noop=()=>{};
  const els={};
  const mkEl=id=>({ id, value:'', textContent:'', innerHTML:'', style:{}, checked:false,
    getAttribute:()=>null, setAttribute:noop, appendChild:noop, remove:noop,
    querySelectorAll:()=>[], addEventListener:noop, getBoundingClientRect:()=>({left:0,top:0,bottom:0,right:0}),
    classList:{add:noop,remove:noop,toggle:noop}, dataset:{}, nextElementSibling:null, focus:noop, add:noop });
  const sb=baseSandbox();
  sb.window={addEventListener:noop, innerWidth:1400, innerHeight:900, open:noop};
  sb.document={ getElementById:id=>(els[id]||(els[id]=mkEl(id))), querySelector:()=>mkEl('q'),
    querySelectorAll:()=>[], createElement:()=>mkEl('new'), body:{appendChild:noop},
    addEventListener:noop };
  sb.google={script:{run:{withSuccessHandler:()=>({withFailureHandler:()=>new Proxy({},{get:()=>noop})})}}};
  sb.alert=noop; sb.confirm=()=>true; sb.prompt=()=>'';
  sb.setTimeout=noop; sb.setInterval=noop; sb.clearInterval=noop; sb.clearTimeout=noop;
  sb.localStorage={getItem:()=>null,setItem:noop};
  sb.LAB_TOASTS=[];
  const ctx=vm.createContext(sb);
  blocks.forEach((b,i)=>{ try{ vm.runInContext(b, ctx, {filename:'Panel.html#script'+i}); }
    catch(e){ /* DOM-ga bog'liq top-level qismlar — muhim emas */ } });
  // toast'ni tutamiz (natijani ko'rish uchun)
  vm.runInContext('toast=function(m,t,d){ LAB_TOASTS.push(String(m)); };', ctx);
  sb._els=els;
  _uiCtx=sb;
  return sb;
}

/* ── TO'LIQ PIPELINE: akt + LRV → HAQIQIY f2AvtoMoslash ── */
function moslash(aktFile, lrvFile, opt){
  opt=opt||{};
  const A=aktOqi(aktFile, opt.aktVaraq, opt.cols);
  if(!A.res || !A.res.ok) throw new Error('Akt o\'qilmadi: '+JSON.stringify(A.res).slice(0,200));
  const L=lrvTree(lrvFile, opt.lokalka);
  const u=ui();
  u.TREE_DATA={tree:L.tree, oylar:opt.oylar||['ЛАБ ОЙ'], jamlangan:!!opt.lokalka};
  u._f2Data=A.res.tree;
  u._f2Mappings=[]; u._f2Dopps=[]; u.LAB_TOASTS.length=0;
  vm.runInContext('_f2BuildIdx(); f2AvtoMoslash(true);', vm.createContext(u));
  return {akt:A, lrv:L, mappings:u._f2Mappings, dopps:u._f2Dopps, toasts:u.LAB_TOASTS.slice(),
          sabab:u._f2Sabab||{}, rzDiag:u._f2RzDiag||[]};
}

/* ── Yordamchi: daraxt statistikasi ── */
function stat(tree){
  const s={rz:0,bl:0,rs:0,mat:0,ob:0, blSummasi:0, leafSummasi:0};
  (function w(nodes,inBl){ (nodes||[]).forEach(n=>{
    if(n.type==='rz'){ s.rz++; w(n.children,false); return; }
    if(s[n.type]!==undefined) s[n.type]++;
    const v=Number(n.summa)||0;
    if(n.type==='bl') s.blSummasi+=v; else s.leafSummasi+=v;
    w(n.children, n.type==='bl');
  }); })(tree,false);
  return s;
}

module.exports={CFG, C, aktOqi, lrvTree, ui, server, moslash, stat, xlsx};
