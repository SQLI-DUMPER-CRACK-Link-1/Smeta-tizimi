const fs = require('fs');
let c = fs.readFileSync('src/admin/sahifalar/F2Import.tsx', 'utf8');

// 1. Remove unused vars
c = c.replace(/const \[yangiRazdelSmeta, setYangiRazdelSmeta\] = useState\(''\);\n/g, '');
c = c.replace(/const \[yangiRazdelQator, setYangiRazdelQator\] = useState\(''\);\n/g, '');
c = c.replace(/const \[yangiRazdelNom, setYangiRazdelNom\] = useState\(''\);\n/g, '');
c = c.replace(/const \[razdelLoading, setRazdelLoading\] = useState\(false\);\n/g, '');

c = c.replace(/const \[taklifOchiqUid, setTaklifOchiqUid\] = useState<string\|null>\(null\);\n/g, '');
c = c.replace(/const \[f2SkrollTarget, setF2SkrollTarget\] = useState<string\|null>\(null\);\n/g, '');

// 2. Fix the Takliflar effect (bogMi -> aktBogMi) and ensure it's moved below aktBogMi (line 381)
// So I will remove it from its current position and inject it right before `return (`
const effectRegex = /\/\/ Barcha boglanmagan F2 qatorlari uchun takliflarni hisoblash[\s\S]*?\}, \[aktTree, lrv\.data\?\.tree, qolBog, qolBekor, natija\?\.mosliklar\]\); \/\/ bogMi depends on these/;
const effectMatch = c.match(effectRegex);
if (effectMatch) {
  c = c.replace(effectMatch[0], '');
  let updatedEffect = effectMatch[0].replace(/bogMi/g, 'aktBogMi');
  c = c.replace(/(\s*return \(\s*<Sahifa)/, "\n" + updatedEffect + "\n$1");
}

// 3. Fix the Auto-Match function's use of bogMi -> aktBogMi, and place it near the bottom too
const autoMatchRegex = /const onAvtoMoslash = \(\) => \{[\s\S]*?toast\("Smetada sizning aktga 100%[\s\S]*?\}\n  \};/;
const autoMatchMatch = c.match(autoMatchRegex);
if (autoMatchMatch) {
  c = c.replace(autoMatchMatch[0], '');
  let updatedAutoMatch = autoMatchMatch[0].replace(/!bogMi/g, '!aktBogMi');
  c = c.replace(/(\s*return \(\s*<Sahifa)/, "\n" + updatedAutoMatch + "\n$1");
}

// 4. Fix TS errors in onQatorSaqlash
c = c.replace(/const res = await gas\('apiSmetaQatorQosh', obyekt, /g, "const res = await gas<any>('apiSmetaQatorQosh', obyekt, ");
c = c.replace(/catch\(e\)/g, "catch(e: any)");

// 5. Inject f2Qidiruv and smetaQidiruv into the Headers and pass takliflar to F2Daraxt
// We need to inject <Kiritma> into chapSarlavha and ongSarlavha
// Currently, chapSarlavha looks like: chapSarlavha={\`AKT (fayldan) — \${aktBarglar.length} qator\`}
// And ongSarlavha looks like: ongSarlavha={<div className="flex items-center justify-between w-full"><span>SMETA (LRV) — {boglanganJoylar.size} qator band</span><button onClick={() => setQatorQoshModal(true)} ...>+ Yangi Razdel</button></div>}

c = c.replace(
  /chapSarlavha=\{`AKT \(fayldan\) — \$\{aktBarglar\.length\} qator`\}/,
  `chapSarlavha={<div className="flex flex-col gap-2 w-full"><div className="flex items-center justify-between w-full"><span>AKT LOKALKASI (Ф2) - {oyNom}</span> <button onClick={onAvtoMoslash} className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-2 py-1 rounded text-[11px] transition-colors font-bold whitespace-nowrap"><Wand2 size={13}/> + Barchasini Avto-Moslash</button></div><Kiritma qiymat={f2Qidiruv} ozgardi={setF2Qidiruv} placeholder="F2 ichidan izlash (nomi yoki kodi)" w="full" /></div>}`
);

// We need to replace the entire ongSarlavha block
const ongSarlavhaRegex = /ongSarlavha=\{\s*<div className="flex items-center justify-between w-full">\s*<span>SMETA \(LRV\) — \{boglanganJoylar\.size\} qator band<\/span>[\s\S]*?<\/div>\s*\}/;
c = c.replace(
  ongSarlavhaRegex,
  `ongSarlavha={<div className="flex flex-col gap-2 w-full"><div className="flex items-center justify-between w-full"><span>SMETA (LRV) — {boglanganJoylar.size} qator band</span><button onClick={() => setQatorQoshModal(true)} className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[11px] transition-colors whitespace-nowrap"><FolderOpen size={13}/> + Qator Qo'shish</button></div><Kiritma qiymat={smetaQidiruv} ozgardi={setSmetaQidiruv} placeholder="Smeta ichidan izlash (nomi yoki kodi)" w="full" /></div>}`
);

// Pass the search variables to filter the trees.
// The tree data is currently: tugunlar={aktDaraxt} and tugunlar={smetaDaraxt}
// We will replace {aktDaraxt} with {filterDaraxt(aktDaraxt, f2Qidiruv)}
// But wait, filterDaraxt needs to be defined.
const filterDaraxtFn = `
  const filterDaraxt = (tree: any[], qidiruv: string) => {
    if(!qidiruv) return tree;
    const q = qidiruv.toLowerCase();
    const dfs = (nodes: any[]): any[] => {
      let result: any[] = [];
      nodes.forEach(n => {
        let isMatch = (n.nom && n.nom.toLowerCase().includes(q)) || (n.kod && n.kod.toLowerCase().includes(q));
        let children = n.children ? dfs(n.children) : [];
        if (isMatch || children.length > 0) result.push({...n, children});
      });
      return result;
    };
    return dfs(tree);
  };
`;
if (!c.includes('const filterDaraxt =')) {
  c = c.replace(/(\s*return \(\s*<Sahifa)/, filterDaraxtFn + "\n$1");
}

c = c.replace(/tugunlar=\{aktDaraxt\}/, 'tugunlar={filterDaraxt(aktDaraxt, f2Qidiruv)}');
c = c.replace(/tugunlar=\{smetaDaraxt\}/, 'tugunlar={filterDaraxt(smetaDaraxt, smetaQidiruv)}');

// Also inject takliflar and onTaklifTanlandi to the first F2Daraxt
c = c.replace(
  /bogMi=\{aktBogMi\}\n\s*onDopClick/,
  "bogMi={aktBogMi}\n                takliflar={takliflar}\n                onTaklifTanlandi={(uid, cand) => { setSmetaScrollTo(cand); toast('Topildi!', 'ok'); }}\n                onDopClick"
);

// Remove the old avtoButton header replacement that caused unused vars if it still exists
c = c.replace(/<div className="flex items-center justify-between w-full"><span>AKT LOKALKASI \(Ф2\) - \{oyNom\}<\/span>[\s\S]*?<span className="hidden">AKT LOKALKASI \(Ф2\)/, '<span>AKT LOKALKASI (Ф2)');

fs.writeFileSync('src/admin/sahifalar/F2Import.tsx', c);
console.log('Final TS fix complete.');
