/**
 * Paket (papka) bo'yicha obyekt bog'lanishi hisoboti — real fayllar bilan.
 *   KORPUS_DIR=... KORPUS_OUT=hisobot.txt npx vitest run src/lib/smeta-anatomiya/korpus/paket
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { faylniOqi } from './oqish';
import { paketAnatomiyasi } from '../paket';
import { sarlavhaYoli } from '../ierarxiya';

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

describe.skipIf(!DIR)('paket anatomiyasi — real korpus', () => {
  it('svod bilan obyekt bog\'lanishi', () => {
    const kitoblar = fayllar(DIR!).map((p) => faylniOqi(p, DIR!));
    const pk = paketAnatomiyasi(kitoblar);
    const q: string[] = [`svod qatorlari: ${pk.svod.length}; bog'lanishlar: ${pk.boglanish.length}`];
    const son = { yuqori: 0, orta: 0, past: 0 };
    for (const b of pk.boglanish) {
      son[b.ishonch]++;
      q.push(`[${b.ishonch}] ${b.fayl.split('/').pop()?.slice(0, 30)} | ${b.lokal.slice(0, 60)} → ${b.svod ? `${b.svod.obyekt} / ${b.svod.raqam}` : '—'} | чел-ч LRV ${b.chelSoatLrv} svod ${b.svod?.chelSoat ?? '-'} farq ${b.farq ?? '-'}`);
    }
    q.unshift(`ishonch: ${JSON.stringify(son)}`);
    // Namuna yo'l: STR dagi birinchi ish uchun to'liq yo'l.
    for (const a of pk.kitoblar) {
      const v = a.varaqlar.find((x) => x.varaq === a.asosiyLrv);
      if (!v || !/STR_ALL/.test(a.fayl)) continue;
      const barcha = [...v.titul, ...v.sarlavhalar];
      for (const ish of v.ishlar.filter((_, i) => i % 800 === 0)) {
        q.push(`yo'l: ${sarlavhaYoli(barcha, ish.sarlavha).map((s) => s.xom.slice(0, 40)).join(' → ')} → ${ish.xom.slice(0, 40)}`);
      }
    }
    if (process.env.KORPUS_OUT) fs.writeFileSync(process.env.KORPUS_OUT, q.join('\n'));
    expect(pk.svod.length).toBeGreaterThan(0);
  }, 600_000);
});
