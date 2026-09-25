/**
 * KORPUS MANIFESTI (P8) — real smeta fayllari repoga qo'yilmaydi (repo public);
 * manifest faqat sha256 va kutilgan natijalarni saqlaydi.
 *
 *   # birinchi marta: manifestni yozish (operator natijani ko'rib tasdiqlaydi)
 *   KORPUS_DIR=C:/smetalar KORPUS_MANIFEST=C:/smetalar/manifest.json KORPUS_YOZ=1 npm run korpus
 *   # keyingi har safar: solishtirish (farq — test yiqiladi)
 *   KORPUS_DIR=C:/smetalar KORPUS_MANIFEST=C:/smetalar/manifest.json npm run korpus
 *
 * Manifestdagi fayl mashinada yo'q bo'lsa — REAL_BINARY_UNKNOWN (soxta PASS emas).
 * KORPUS_DIR berilmasa test o'tkazib yuboriladi.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { kitobAnatomiyasi } from '../index';
import { faylniOqi } from './oqish';

const DIR = process.env.KORPUS_DIR;
const MANIFEST = process.env.KORPUS_MANIFEST ?? (DIR ? path.join(DIR, 'manifest.json') : '');

export type ManifestVaraq = { varaq: string; rol: string; format: string; profil: string | null; ishlar: number; barglar: number; vedomost: number; rzChuqurlik: number };
export type ManifestFayl = { fayl: string; sha256: string; asosiyLrv: string | null; varaqlar: ManifestVaraq[] };

function fayllar(dir: string): string[] {
  const out: string[] = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) out.push(...fayllar(p));
    else if (/\.(xlsx?|xlsm)$/i.test(n) && !n.startsWith('~$')) out.push(p);
  }
  return out.sort();
}

function faylManifesti(p: string): ManifestFayl {
  const sha256 = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const a = kitobAnatomiyasi(faylniOqi(p, DIR!));
  return {
    fayl: a.fayl, sha256, asosiyLrv: a.asosiyLrv,
    varaqlar: a.varaqlar.map((v) => ({
      varaq: v.varaq, rol: v.rol, format: v.profil?.format ?? 'nomalum', profil: v.profil?.imzo ?? null,
      ishlar: v.ishlar.length, barglar: v.ishlar.reduce((n, i) => n + i.resurslar.length, 0), vedomost: v.vedomost.length,
      rzChuqurlik: [...v.titul, ...v.sarlavhalar].reduce((m, s) => Math.max(m, s.daraja), 0),
    })),
  };
}

describe.skipIf(!DIR)('korpus manifesti', () => {
  it('manifest bilan solishtirish (yoki KORPUS_YOZ=1 bo‘lsa yozish)', () => {
    const joriy = fayllar(DIR!).map(faylManifesti);
    if (process.env.KORPUS_YOZ === '1' || !fs.existsSync(MANIFEST)) {
      fs.writeFileSync(MANIFEST, JSON.stringify({ yaratildi: new Date().toISOString(), fayllar: joriy }, null, 2));
      console.info(`[korpus] manifest yozildi: ${MANIFEST} (${joriy.length} fayl) — natijani ko'rib tasdiqlang`);
      return;
    }
    const kutilgan = (JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { fayllar: ManifestFayl[] }).fayllar;
    const bySha = new Map(joriy.map((f) => [f.sha256, f]));
    const farqlar: string[] = [];
    const unknown: string[] = [];
    for (const k of kutilgan) {
      const j = bySha.get(k.sha256);
      if (!j) { unknown.push(`REAL_BINARY_UNKNOWN: ${k.fayl}`); continue; }
      if (j.asosiyLrv !== k.asosiyLrv) farqlar.push(`${k.fayl}: asosiyLrv ${k.asosiyLrv} → ${j.asosiyLrv}`);
      for (const kv of k.varaqlar) {
        const jv = j.varaqlar.find((x) => x.varaq === kv.varaq);
        if (!jv) { farqlar.push(`${k.fayl}!${kv.varaq}: varaq yo'q`); continue; }
        for (const m of ['rol', 'format', 'profil', 'ishlar', 'barglar', 'vedomost', 'rzChuqurlik'] as const) {
          if (jv[m] !== kv[m]) farqlar.push(`${k.fayl}!${kv.varaq}: ${m} ${kv[m]} → ${jv[m]}`);
        }
      }
    }
    for (const u of unknown) console.warn(u);
    expect(farqlar).toEqual([]);
  });
});
