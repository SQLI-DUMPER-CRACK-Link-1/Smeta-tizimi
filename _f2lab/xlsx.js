/* Minimal .xlsx o'quvchi (tashqi paketsiz) — PowerShell Expand-Archive + XML parse.
 * Faqat kerakli narsa: varaq nomlari + kataklar (matn/son) + merge diapazonlari. */
const fs=require('fs'), path=require('path'), cp=require('child_process');

function unzip(x){
  const base=path.join(__dirname,'_unz', path.basename(x).replace(/[^\w.-]/g,'_'));
  if(fs.existsSync(base)) return base;
  fs.mkdirSync(path.dirname(base),{recursive:true});
  const zip=base+'.zip';
  fs.copyFileSync(x,zip);
  cp.execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip.replace(/'/g,"''")}' -DestinationPath '${base.replace(/'/g,"''")}' -Force"`,{stdio:'pipe'});
  fs.rmSync(zip);
  return base;
}
function dec(s){
  return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d))
    .replace(/&#x([0-9a-fA-F]+);/g,(m,d)=>String.fromCharCode(parseInt(d,16)))
    .replace(/&amp;/g,'&');
}
function sharedStrings(dir){
  const f=path.join(dir,'xl','sharedStrings.xml');
  if(!fs.existsSync(f)) return [];
  const xml=fs.readFileSync(f,'utf8'), out=[];
  for(const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)){
    let t='';
    for(const tm of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t+=tm[1];
    out.push(dec(t));
  }
  return out;
}
function colIdx(ref){ let c=0; for(const ch of ref){ if(ch>='A'&&ch<='Z') c=c*26+(ch.charCodeAt(0)-64); else break; } return c-1; }
function sheetNames(dir){
  const wb=fs.readFileSync(path.join(dir,'xl','workbook.xml'),'utf8');
  const relsPath=path.join(dir,'xl','_rels','workbook.xml.rels');
  const rels=fs.existsSync(relsPath)?fs.readFileSync(relsPath,'utf8'):'';
  const relMap={};
  for(const m of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) relMap[m[1]]=m[2];
  const out=[];
  for(const m of wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)){
    let t=(relMap[m[2]]||'').replace(/^\/?xl\//,'');
    out.push({name:dec(m[1]), target:t});
  }
  return out;
}
/* rows: [[cell,...],...] 0-based; merges: [{r1,c1,r2,c2}] 0-based */
function readSheet(dir, target){
  const ss=sharedStrings(dir);
  const f=path.join(dir,'xl',target);
  if(!fs.existsSync(f)) return null;
  const xml=fs.readFileSync(f,'utf8');
  const rows=[];
  for(const rm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
    const rIdx=+rm[1]-1, arr=[];
    for(const cm of rm[2].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const attrs=cm[1], body=cm[2]||'';
      const ref=(attrs.match(/r="([A-Z]+)\d+"/)||[])[1]; if(!ref) continue;
      const t=(attrs.match(/t="(\w+)"/)||[])[1]||'';
      let v='';
      const vm=body.match(/<v>([\s\S]*?)<\/v>/);
      if(vm) v=dec(vm[1]);
      else { const im=body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/); if(im) v=dec(im[1]); }
      if(t==='s') v=(ss[+v]!==undefined?ss[+v]:'');
      else if(t!=='str'&&t!=='inlineStr'&&v!==''&&!isNaN(v)) v=Number(v);
      arr[colIdx(ref)]=v;
    }
    rows[rIdx]=arr;
  }
  for(let i=0;i<rows.length;i++) if(!rows[i]) rows[i]=[];
  const merges=[];
  for(const m of xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)){
    merges.push({r1:+m[2]-1, c1:colIdx(m[1]), r2:+m[4]-1, c2:colIdx(m[3])});
  }
  return {rows, merges};
}
/* Qulaylik: faylni ochib barcha varaqlarni qaytaradi */
function open(file){
  const dir=unzip(file);
  const sheets=sheetNames(dir).map(s=>{
    const d=readSheet(dir,s.target);
    return {name:s.name, rows:(d?d.rows:[]), merges:(d?d.merges:[])};
  });
  return {file, sheets, sheet(n){ return sheets.find(s=>s.name===n)||null; }};
}
module.exports={open, unzip, sheetNames, readSheet, sharedStrings};
