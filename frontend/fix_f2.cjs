const fs = require('fs');
let c = fs.readFileSync('src/admin/sahifalar/F2Import.tsx', 'utf8');

// Fix 1: gas import
c = c.replace(/import \{ gas \} from '..\/..\/api\/gas';/g, "import { gas } from '../../api/client';");

// Fix 2: takliflar record type
c = c.replace(/const \[takliflar, setTakliflar\] = useState<any\[\]>\(\[\]\);/, "const [takliflar, setTakliflar] = useState<Record<string, any[]>>({});");

// Fix 3: lokalkalar instead of subs
c = c.replace(/variantlar=\{\['', \.\.\.\(lrv\.data\?\.subs \|\| \[\]\)\]\}/, "variantlar={['', ...(lrv.data?.lokalkalar || [])]}");

// Fix 4: obyektOlim -> obyekt
c = c.replace(/obyektOlim/g, "obyekt");

// Fix 5: remove setRazdelModalOchiq call, change to qatorQoshModal
c = c.replace(/setRazdelModalOchiq\(true\)/g, "setQatorQoshModal(true)");

// Fix 6: Tanlov variantlar object to string
c = c.replace(
  `                  variantlar={[
                    {qiymat: 'rz', nom: 'Razdel'},
                    {qiymat: 'bl', nom: 'Ish turi'},
                    {qiymat: 'rs', nom: 'Resurs (Material)'}
                  ]}`,
  `                  variantlar={['rz', 'bl', 'rs']}` // Native Tanlov accepts string array or we can just use native select
);

// Actually, to make it look nice, let's just use a native select
c = c.replace(
  /<Tanlov\s*qiymat=\{yangiTur\}\s*ozgardi=\{setYangiTur\}\s*variantlar=\{\['rz', 'bl', 'rs'\]\}\s*\/>/g,
  `<select value={yangiTur} onChange={(e) => setYangiTur(e.target.value)} className="bg-[var(--surface-3)] border border-border rounded px-3 py-1.5 text-[13px] text-white">
     <option value="rz">Razdel</option>
     <option value="bl">Ish turi</option>
     <option value="rs">Resurs (Material)</option>
   </select>`
);

// Replace any leftover object variantlar
c = c.replace(
  /<Tanlov\s+qiymat=\{yangiTur\}\s+ozgardi=\{setYangiTur\}\s+variantlar=\{\[\s*\{qiymat: 'rz', nom: 'Razdel'\},\s*\{qiymat: 'bl', nom: 'Ish turi'\},\s*\{qiymat: 'rs', nom: 'Resurs \(Material\)'\}\s*\]\}\s*\/>/g,
  `<select value={yangiTur} onChange={(e) => setYangiTur(e.target.value)} className="bg-[var(--surface-3)] border border-border rounded px-3 py-1.5 text-[13px] text-white">
     <option value="rz">Razdel</option>
     <option value="bl">Ish turi</option>
     <option value="rs">Resurs (Material)</option>
   </select>`
);

// Fix 7: Tugma props in modal (disabled -> band, kutyapti -> band)
// Actually Tugma uses \`band?: boolean\` for both loading and disabled.
c = c.replace(/disabled=\{qatorLoading\}/g, "band={qatorLoading}");
c = c.replace(/kutyapti=\{qatorLoading\}/g, "band={qatorLoading}");

// Fix 8: "lrv" used before declaration.
// Move the takliflar useEffect below lrv and bogMi declaration.
// Let's find lrv declaration: const lrv = useHolat(obyekt);
// And bogMi declaration: const bogMi = useCallback((kalit: string) => { ...
// We can just move the Taklif useEffect to just before the return.

const effectRegex = /\/\/ Barcha boglanmagan F2 qatorlari uchun takliflarni hisoblash[\s\S]*?\}, \[aktTree, lrv\.data\?\.tree, qolBog, qolBekor, natija\?\.mosliklar\]\); \/\/ bogMi depends on these/;
const effectMatch = c.match(effectRegex);

if (effectMatch) {
  c = c.replace(effectMatch[0], ""); // remove from top
  // Insert before the return statement of the component
  c = c.replace(/(return \(\s*<Sahifa)/, effectMatch[0] + "\n\n  $1");
}

fs.writeFileSync('src/admin/sahifalar/F2Import.tsx', c);
console.log('Fixed TS errors in F2Import.tsx');
