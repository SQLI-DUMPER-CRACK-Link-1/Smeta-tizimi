const fs = require('fs');

// 1. Fix TestFakt.tsx
let fakt = fs.readFileSync('frontend/src/test02/TestFakt.tsx', 'utf8');
fakt = fakt.replace(/import \{ sbQatorHolatOl, sbFaktYoz, sbFaktBelgila, QatorHolat, FaktQator \} from '\.\.\/api\/t2-fakt';/, 
  "import { sbQatorHolatOl, sbFaktYoz, sbFaktBelgila, type QatorHolat, type FaktQator } from '../api/t2-fakt';");
fakt = fakt.replace(/import \{ sbT2ObyektlarOlKomp, T2Obyekt \} from '\.\.\/api\/supabase';/, 
  "import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';");
fakt = fakt.replace(/setObyektlar\(res\.data \|\| \[\]\);/g, "setObyektlar(res.qatorlar || []);");
fakt = fakt.replace(/setQatorlar\(res\.data \|\| \[\]\);/g, "setQatorlar(res.qatorlar || []);");
fakt = fakt.replace(/toast\(([^,]+),\s*'info'\)/g, "toast($1, 'success')");
fakt = fakt.replace(/FmtN\(q\.qoldiq_hajm\)/g, "<FmtN val={q.qoldiq_hajm} />");
fakt = fakt.replace(/FmtN\(q\.qabul_hajm\)/g, "<FmtN val={q.qabul_hajm} />");
fakt = fakt.replace(/FmtN\(row\.qabul_hajm\)/g, "<FmtN val={row.qabul_hajm} />");
fakt = fakt.replace(/FmtN\(row\.qoldiq_hajm\)/g, "<FmtN val={row.qoldiq_hajm} />");
fakt = fakt.replace(/FmtN\(q\.smetada_hajm\)/g, "<FmtN val={q.smetada_hajm} />");
// Wait, is FmtN used as a function anywhere?
fakt = fakt.replace(/\{FmtN\(([^)]+)\)\}/g, "<FmtN val={$1} />");
fs.writeFileSync('frontend/src/test02/TestFakt.tsx', fakt);

// 2. Fix TestKontragent.tsx
let kontr = fs.readFileSync('frontend/src/test02/TestKontragent.tsx', 'utf8');
// error TS2339: Property 'inn' does not exist on type '{ nom: string; rahbar: ...
kontr = kontr.replace(/nom: '',\n    rahbar: '',/g, "inn: '',\n    nom: '',\n    rahbar: '',");
// error TS2345: Argument of type '"success"' is not assignable to parameter of type 'ToastType | undefined'.
// In this project toast is maybe 'success' | 'warn' | 'danger'
kontr = kontr.replace(/'success'/g, "'success'"); // wait, maybe the error is that ToastType doesn't include 'success'? No, toast in this project uses 'success'/'warn'/'danger'. Wait, error TS2345 says "Argument of type '"success"' is not assignable to parameter of type 'ToastType'".
// Let's check ToastType. In some files they use "success", "danger", "warn", "info".
// Let me look at Toast.tsx if I can, but for now I'll change "success" to "success". Wait, if "success" is wrong, what is right? I'll check toast in a minute.
fs.writeFileSync('frontend/src/test02/TestKontragent.tsx', kontr);

// 3. Fix TestXodimlarRollar.tsx
let xodim = fs.readFileSync('frontend/src/test02/TestXodimlarRollar.tsx', 'utf8');
// error TS2345: Argument of type '"success"' is not assignable to parameter of type 'ToastType | undefined'.
// I will check the correct type later.
fs.writeFileSync('frontend/src/test02/TestXodimlarRollar.tsx', xodim);

console.log('done');
