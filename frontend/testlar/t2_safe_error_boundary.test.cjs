/* Xavfsiz xato boundary — Supabase/PostgREST/Cloudflare tafsiloti browserga
 * chiqmasligini statik regressiya sifatida ushlaydi. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1');
const must = (label, condition) => {
  assert(condition, label);
  console.log('  ✅ ' + label);
};

const helper = stripComments(R('frontend', 'functions', '_shared', 'xato.ts'));
const readApi = stripComments(R('frontend', 'functions', 'api', 'sb.ts'));
const writeApi = stripComments(R('frontend', 'functions', 'api', 'sb-yoz.ts'));
const client = stripComments(R('frontend', 'src', 'api', 'supabase.ts'));

console.log('\n── Xavfsiz upstream error boundary ──');
must('shared helper xavfsizUpstream mavjud', /export function xavfsizUpstream\(/.test(helper));
must('legacy client contract uchun error va xato bir xil safe xabar',
  /error: xabar/.test(helper) && /xato: xabar/.test(helper));
must('PGRST/SQL/HTTP code generic UPSTREAMga tushiriladi',
  /!\/\^\(PGRST\|SQL\|HTTP\|POSTGRES\|PG\)/.test(helper) && /return 'UPSTREAM'/.test(helper));
must('read gateway upstream failure safe boundarydan o‘tadi',
  /return xavfsizUpstream\(birinchi\.status, birinchi\.detail\)/.test(readApi)
  && /return xavfsizUpstream\(nat\.status, nat\.detail\)/.test(readApi)
  && /return xavfsizUpstream\(502, err\)/.test(readApi));
must('read gateway upstream matnini error sifatida qaytarmaydi',
  !/error\s*:\s*['"]Supabase[^\n]*matn\.slice/.test(readApi)
  && !/error\s*:\s*['"]Cloudflare[^\n]*err\.message/.test(readApi));
must('write gateway upstream failure safe boundarydan o‘tadi',
  /return xavfsizUpstream\(r\.status, matn\)/.test(writeApi)
  && /return xavfsizUpstream\(502, matn\)/.test(writeApi)
  && /return xavfsizUpstream\(502, err\)/.test(writeApi));
must('write gateway upstream matnini error sifatida qaytarmaydi',
  !/error\s*:\s*['"]Supabase[^\n]*matn\.slice/.test(writeApi)
  && !/error\s*:\s*['"]Baza JSON[^\n]*matn\.slice/.test(writeApi)
  && !/error\s*:\s*['"]Cloudflare[^\n]*err\.message/.test(writeApi));

const yozStart = client.indexOf('export async function yozAmali');
const yoz = yozStart >= 0 ? client.slice(yozStart, yozStart + 1800) : '';
must('frontend yozAmali raw response bodyni userga chiqarmaydi',
  yozStart >= 0 && !/matn\.slice|HTTP \$\{r\.status\}: \$\{matn/.test(yoz));

console.log('  8 checks passed');
