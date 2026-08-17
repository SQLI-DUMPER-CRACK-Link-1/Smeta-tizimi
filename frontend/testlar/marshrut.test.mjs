import { readFileSync } from 'fs';
const src = readFileSync('src/umumiy/marshrutTekshir.ts', 'utf8');
const bosh = src.indexOf('export const ADMIN_MARSHRUTLARI');
const oxir = src.indexOf("/** Dev'da bir marta");
const kod = src.slice(bosh, oxir)
  .replace(/export /g, '')
  .replace(/\s+as\s+(const|readonly string\[\])/g, '')
  .replace(/:\s*(string\[\]|string|Set<string>|readonly string\[\]|void)/g, '')
  .replace(/new Set<[^>]*>/g, 'new Set');
const fn = new Function(kod + '\nreturn menyuTekshir;')();

let ok = 0, xato = 0;
const T = (nom, shart) => { if (shart) { ok++; console.log('  ✅ ' + nom); }
                            else { xato++; console.log('  ❌ ' + nom); } };
T("to'g'ri havolalar o'tadi",        fn(['/admin/obyektlar','/admin/shartnomalar']).length === 0);
T('BUZUQ havola ushlanadi',          JSON.stringify(fn(['/admin/shartnoma'])) === '["/admin/shartnoma"]');
T("parametrli marshrut (holat/:id)", fn(['/admin/holat/Amfiteatr']).length === 0);
T("/admin index o'tadi",             fn(['/admin']).length === 0);
T('bir nechta buzuq qaytadi',        fn(['/admin/yoq1','/admin/obyektlar','/admin/yoq2']).length === 2);
T('19 ta haqiqiy menyu havolasi toza', fn(['/admin/obyektlar','/admin/f2','/admin/buxgalteriya','/admin/shartnomalar','/admin/fakturalar','/admin/f2-tayyorlash','/admin/narxlar','/admin/ierarxiya','/admin/sklad','/admin/monitoring','/admin/kadrlar','/admin/texnika','/admin/taminot','/admin/sifat','/admin/fayl-boglash','/admin/hujjatlar','/admin/shaxsiy-smeta','/admin/supabase','/admin/sozlamalar']).length === 0);
console.log(`\n═══ ${ok} o'tdi, ${xato} yiqildi ═══`);
process.exit(xato ? 1 : 0);
