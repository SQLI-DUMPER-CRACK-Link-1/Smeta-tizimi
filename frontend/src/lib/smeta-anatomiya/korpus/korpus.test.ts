/**
 * Real smeta korpusi bo'yicha anatomiya hisoboti. Real fayllar repoga
 * qo'yilmaydi (repo public) — faqat lokal papka orqali:
 *
 *   KORPUS_DIR="C:/.../smetalar" KORPUS_OUT="C:/.../hisobot" npx vitest run src/lib/smeta-anatomiya/korpus
 *
 * KORPUS_DIR berilmasa test o'tkazib yuboriladi (REAL_BINARY_UNKNOWN), soxta PASS emas.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { kitobAnatomiyasi, sarlavhaYoli } from '../index';
import { faylniOqi } from './oqish';

const DIR = process.env.KORPUS_DIR;
const OUT = process.env.KORPUS_OUT;

function fayllar(dir: string): string[] {
  const out: string[] = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) out.push(...fayllar(p));
    else if (/\.(xlsx?|xlsm)$/i.test(n) && !n.startsWith('~$')) out.push(p);
  }
  return out.sort();
}

describe.skipIf(!DIR)('smeta anatomiya — real korpus', () => {
  it('har fayl anatomiyasi hisoboti', () => {
    const royxat = fayllar(DIR!);
    expect(royxat.length).toBeGreaterThan(0);
    const qisqa: string[] = [];
    for (const p of royxat) {
      const kitob = faylniOqi(p, DIR!);
      const a = kitobAnatomiyasi(kitob);
      qisqa.push(`\n# ${a.fayl}  asosiyLrv=${a.asosiyLrv ?? '-'}${a.dublikat.length ? '  dublikat=' + a.dublikat.map((d) => d.varaq).join(',') : ''}`);
      for (const v of a.varaqlar) {
        const barcha = [...v.titul, ...v.sarlavhalar];
        const chuqur = barcha.reduce((m, s) => Math.max(m, s.daraja), 0);
        const past = barcha.filter((s) => s.dalil.some((d) => d.ishonch === 'past')).length;
        qisqa.push(`  [${v.varaq}] rol=${v.rol} ish=${v.ishlar.length} res=${v.ishlar.reduce((n, i) => n + i.resurslar.length, 0)} vedomost=${v.vedomost.length} sarlavha=${v.sarlavhalar.length} chuqurlik=${chuqur} past=${past} review=${v.review.length}`);
      }
      if (OUT) {
        const daraxt: string[] = [];
        for (const v of a.varaqlar) {
          if (v.rol !== 'lrv') continue;
          daraxt.push(`\n=== ${v.varaq}`);
          const barcha = [...v.titul, ...v.sarlavhalar];
          const ishSoni = new Map<number | null, number>();
          for (const i of v.ishlar) ishSoni.set(i.sarlavha, (ishSoni.get(i.sarlavha) ?? 0) + 1);
          for (const s of barcha) {
            const d = s.dalil.map((x) => `${x.qoida}:${x.ishonch}`).join(',');
            daraxt.push(`${'  '.repeat(s.daraja - 1)}[${s.tur}] ${s.xom}  (q${s.manzil.qator}, ish=${ishSoni.get(s.id) ?? 0}, ${d})`);
          }
          const namuna = v.ishlar.find((i) => sarlavhaYoli(barcha, i.sarlavha).length >= 3);
          if (namuna) daraxt.push(`  namuna yo'l: ${sarlavhaYoli(barcha, namuna.sarlavha).map((s) => s.xom).join(' → ')} → ${namuna.tartib}. ${namuna.xom.slice(0, 50)}`);
          for (const r of v.review.slice(0, 15)) daraxt.push(`  ! ${r.kod} q${r.manzil?.qator ?? '-'}: ${r.izoh}`);
          if (v.review.length > 15) daraxt.push(`  ! … yana ${v.review.length - 15} ta review`);
        }
        fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, a.fayl.replace(/[\\/:*?"<>|]/g, '_') + '.daraxt.txt'), daraxt.join('\n'));
      }
    }
    if (OUT) fs.writeFileSync(path.join(OUT, '_umumiy.txt'), qisqa.join('\n'));
    // eslint-disable-next-line no-console
    console.log(qisqa.join('\n'));
  }, 600_000);
});
