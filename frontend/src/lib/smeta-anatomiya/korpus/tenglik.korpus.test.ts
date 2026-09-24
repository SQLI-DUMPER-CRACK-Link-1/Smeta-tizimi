/**
 * Eski treeBuild vs anatomiya daraxti — real korpusda barglar tengligi.
 *   KORPUS_DIR=... KORPUS_OUT=tenglik.txt npx vitest run src/lib/smeta-anatomiya/korpus/tenglik
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { faylniOqi } from './oqish';
import { kitobAnatomiyasi } from '../index';
import { anatomiyadanAktDaraxt, daraxtBarglari, daraxtlarTengmi } from '../akt-daraxt';
import { f2FaylOqiCore } from '../../f2-import-parse';
import { lrvVaIchkiResniAjrat } from '../../smeta-lrv-boundary';
import type { AktNode } from '../../f2-match-engine';

const DIR = process.env.KORPUS_DIR;

function fayllar(dir: string): string[] {
  const out: string[] = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) out.push(...fayllar(p));
    else if (/\.(xlsx?|xlsm)$/i.test(n) && !n.startsWith('~$')) out.push(p);
  }
  return out.sort();
}

function rzChuqurligi(tree: readonly AktNode[], d = 0): number {
  return tree.reduce((m, n) => (n.type === 'rz' ? Math.max(m, rzChuqurligi(n.children ?? [], d + 1)) : m), d);
}

describe.skipIf(!DIR)('eski va yangi daraxt tengligi', () => {
  it('har LRV varaq', () => {
    const q: string[] = [];
    let teng = 0, farq = 0;
    for (const p of fayllar(DIR!)) {
      const kitob = faylniOqi(p, DIR!);
      const a = kitobAnatomiyasi(kitob);
      a.varaqlar.forEach((v, j) => {
        if (v.rol !== 'lrv' || !v.ishlar.length) return;
        const rows = kitob.varaqlar[j].rows as Parameters<typeof f2FaylOqiCore>[0];
        const det = f2FaylOqiCore(rows);
        const cols = 'cols' in det ? det.cols : null;
        const eskiNat = f2FaylOqiCore(lrvVaIchkiResniAjrat(rows).lrvRows, cols);
        const eski = 'tree' in eskiNat ? eskiNat.tree : [];
        const yangi = anatomiyadanAktDaraxt(v);
        const t = daraxtlarTengmi(eski, yangi.tree, v.vedomost.map((r) => r.xom));
        if (t.teng) teng++; else farq++;
        const qator = `${t.teng ? 'TENG ' : 'FARQ '} ${a.fayl.split('/').pop()?.slice(0, 34)} [${v.varaq}] barg eski=${t.eski} yangi=${t.yangi} vedomost_chiqarildi=${t.vedomostChiqarildi} rz_chuqurlik eski=${rzChuqurligi(eski)} yangi=${rzChuqurligi(yangi.tree)} otkazildi=${yangi.otkazildi}`;
        q.push(qator);
        if (!t.teng) {
          const ea = daraxtBarglari(eski), ya = daraxtBarglari(yangi.tree);
          q.push(`   #${t.birinchiFarq}: eski=${ea[t.birinchiFarq] ?? '—'}`);
          q.push(`   #${t.birinchiFarq}: yang=${ya[t.birinchiFarq] ?? '—'}`);
        }
      });
    }
    q.unshift(`TENG=${teng} FARQ=${farq}`);
    if (process.env.KORPUS_OUT) fs.writeFileSync(process.env.KORPUS_OUT, q.join('\n'));
    expect(teng + farq).toBeGreaterThan(0);
  }, 900_000);
});
