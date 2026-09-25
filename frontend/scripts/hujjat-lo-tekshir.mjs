#!/usr/bin/env node
/**
 * hujjat-lo-tekshir.mjs — PTO hujjatlarini LibreOffice (headless) bilan tekshirish.
 *
 * Excel yo'q muhitda H4/H6 dalili:
 *   1. Har .xlsx LibreOffice da "har doim qayta hisoblash" rejimida ochilib,
 *      qayta saqlanadi; har formula katagining keshlangan qiymati (sayt hisobi)
 *      LibreOffice hisoblagan qiymat bilan solishtiriladi → farq 0 bo'lishi shart.
 *   2. PDF ga chiqariladi: sahifa soni va sahifa o'lchami (A4, landshaft/portret).
 *
 * Ishlatish:
 *   HUJJAT_NAMUNA_DIR=/tmp/namuna npx vitest run hujjat   # namunalarni yozadi
 *   node scripts/hujjat-lo-tekshir.mjs /tmp/namuna
 *
 * soffice topilmasa — UNKNOWN (soxta PASS yozilmaydi), chiqish kodi 2.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { unzipSync, strFromU8 } from 'fflate';

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error('Foydalanish: node scripts/hujjat-lo-tekshir.mjs <namuna_papka>');
  process.exit(1);
}
const soffice = ['soffice', 'libreoffice'].find((b) => { try { execFileSync('which', [b], { stdio: 'ignore' }); return true; } catch { return false; } });
if (!soffice) {
  console.log('UNKNOWN: LibreOffice (soffice) topilmadi — qayta hisoblash va PDF tekshiruvi bajarilmadi.');
  process.exit(2);
}

// LibreOffice profili: OOXML fayl yuklanganda HAR DOIM qayta hisoblash.
const profil = join(tmpdir(), `lo-hujjat-profil-${process.pid}`);
mkdirSync(join(profil, 'user'), { recursive: true });
writeFileSync(join(profil, 'user', 'registrymodifications.xcu'), `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>`);
const env = `-env:UserInstallation=file://${profil}`;
const out = join(tmpdir(), `lo-hujjat-out-${process.pid}`);
mkdirSync(join(out, 'xlsx'), { recursive: true });
mkdirSync(join(out, 'pdf'), { recursive: true });

const unEsc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function varaqlar(bytes) {
  const files = unzipSync(bytes);
  const wb = strFromU8(files['xl/workbook.xml']);
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const rel = new Map([...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [m[1].match(/\bId="([^"]+)"/)?.[1], m[1].match(/\bTarget="([^"]+)"/)?.[1]]));
  const ssX = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : '';
  const ss = [...ssX.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((t) => unEsc(t[1])).join(''));
  const res = new Map();
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)) {
    const nom = unEsc(m[1].match(/\bname="([^"]+)"/)?.[1] ?? '');
    const t = rel.get(m[1].match(/\b\w+:id="([^"]+)"/)?.[1]);
    if (!t) continue;
    const path = t.startsWith('/') ? t.slice(1) : `xl/${t}`;
    const xml = files[path] ? strFromU8(files[path]) : '';
    const kataklar = new Map();
    for (const c of xml.matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const ref = c[1].match(/\br="([A-Z]+\d+)"/)?.[1];
      const tt = c[1].match(/\bt="([^"]+)"/)?.[1];
      const inner = c[2] ?? '';
      const f = inner.match(/<(?:\w+:)?f\b[^>]*>([^<]*)<\/(?:\w+:)?f>/)?.[1] ?? null;
      const v = inner.match(/<(?:\w+:)?v>([^<]*)<\/(?:\w+:)?v>/)?.[1] ?? null;
      let qiymat = v == null ? null : tt === 's' ? ss[Number(v)] : tt === 'str' || tt === 'e' ? unEsc(v) : Number(v);
      if (tt === 'inlineStr') qiymat = [...inner.matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((x) => unEsc(x[1])).join('');
      kataklar.set(ref, { f: f == null ? null : unEsc(f), qiymat, tt });
    }
    res.set(nom, kataklar);
  }
  return res;
}

const fayllar = readdirSync(dir).filter((f) => /\.xlsx$/i.test(f)).sort();
let xato = 0;
const hisobot = [];
for (const f of fayllar) {
  const src = join(dir, f);
  execFileSync(soffice, [env, '--headless', '--calc', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', join(out, 'xlsx'), src], { stdio: 'ignore' });
  execFileSync(soffice, [env, '--headless', '--convert-to', 'pdf', '--outdir', join(out, 'pdf'), src], { stdio: 'ignore' });
  const asl = varaqlar(readFileSync(src));
  const lo = varaqlar(readFileSync(join(out, 'xlsx', f)));
  let formulalar = 0, farqlar = [];
  for (const [nom, kataklar] of asl) {
    const loV = lo.get(nom);
    for (const [ref, k] of kataklar) {
      if (!k.f) continue;
      formulalar++;
      const b = loV?.get(ref)?.qiymat ?? null;
      const a = k.qiymat;
      const bosh = (x) => x == null || x === '';
      if (bosh(a) && bosh(b)) continue;
      if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a))) continue;
      if (String(a) === String(b)) continue;
      farqlar.push(`${nom}!${ref}: kesh=${a} LibreOffice=${b} (=${k.f})`);
    }
  }
  const pdf = readFileSync(join(out, 'pdf', f.replace(/\.xlsx$/i, '.pdf'))).toString('latin1');
  const sahifa = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const mb = pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  const olcham = mb ? `${Math.round(Number(mb[1]) / 72 * 25.4)}×${Math.round(Number(mb[2]) / 72 * 25.4)} mm` : 'noma’lum';
  const a4 = mb ? [[210, 297], [297, 210]].some(([w, h]) => Math.abs(Number(mb[1]) / 72 * 25.4 - w) < 2 && Math.abs(Number(mb[2]) / 72 * 25.4 - h) < 2) : false;
  if (farqlar.length || !a4) xato++;
  hisobot.push({ fayl: basename(f), formulalar, farq: farqlar.length, sahifa, olcham, a4 });
  console.log(`${farqlar.length || !a4 ? 'FAIL' : 'PASS'} ${f}: formulalar=${formulalar}, qayta hisoblash farqi=${farqlar.length}, PDF sahifa=${sahifa}, o'lcham=${olcham}`);
  for (const x of farqlar.slice(0, 20)) console.log(`   ${x}`);
}
writeFileSync(join(dir, 'lo-hisobot.json'), JSON.stringify({ pdfPapka: join(out, 'pdf'), hisobot }, null, 2));
console.log(`\nPDF lar: ${join(out, 'pdf')}`);
process.exit(xato ? 1 : 0);
