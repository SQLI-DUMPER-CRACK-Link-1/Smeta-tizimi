import { kalit, son, toliqUstunlar, xom } from './matn';
import type { Dalil, ErkinVaraq, KirishKitob, Manzil, VaraqAnatomiyasi } from './turlar';

/**
 * Erkin hisob varaqlari (egasi 2026-09-24: "perevozka proizvoniy shaklda
 * hisoblangan exellar … sub badiiy ishlar, shefmontaj — bizning formatlarga mos
 * bo'lmaydi"). Modul ularni LRV/RES ga majburan solmaydi: faqat isbotlanadigan
 * yakuniy summani va uni o'qiydigan svod qatorini topadi. Qayerga qo'shish —
 * operator qarori.
 */
const JAMI = /^(ИТОГО|ВСЕГО|JAMI|ЖАМИ)/;

function ustunHarf(c: number): string {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Oxirgi ИТОГО/ВСЕГО qatorining eng o'ngdagi soni. */
function yakuniySumma(fayl: string, nom: string, rows: readonly (readonly unknown[])[]): ErkinVaraq['yakuniy'] {
  for (let r = rows.length - 1; r >= 0; r--) {
    const row = (rows[r] ?? []) as Parameters<typeof toliqUstunlar>[0];
    const toliq = toliqUstunlar(row);
    const yorliq = toliq.map((i) => xom(row[i])).find((t) => JAMI.test(kalit(t)));
    if (!yorliq) continue;
    for (let i = toliq.length - 1; i >= 0; i--) {
      const q = son(row[toliq[i]]);
      if (q != null && typeof row[toliq[i]] === 'number') {
        return { xom: yorliq, qiymat: q, manzil: { fayl, varaq: nom, qator: r + 1, ustun: toliq[i] + 1 } };
      }
    }
  }
  return null;
}

/** `трансп.!J15`, `'4230_БР'!$G$123` — formula ichidagi varaq!katak havolalari. */
export function formulaHavolalari(f: string): Array<{ varaq: string; katak: string }> {
  const chiq: Array<{ varaq: string; katak: string }> = [];
  const re = /(?:'((?:[^']|'')+)'|([^\s!'=+\-*/(),;:&<>^"]+))!\$?([A-Z]{1,3})\$?(\d+)/g;
  for (let m = re.exec(f); m; m = re.exec(f)) {
    chiq.push({ varaq: (m[1] ?? m[2]).replace(/''/g, "'"), katak: `${m[3]}${m[4]}` });
  }
  return chiq;
}

function svodQatoriniTop(
  kitob: KirishKitob, anat: readonly VaraqAnatomiyasi[], erkinNom: string, yakuniy: NonNullable<ErkinVaraq['yakuniy']>,
): ErkinVaraq['svodQatori'] {
  const nishon = `${ustunHarf((yakuniy.manzil.ustun ?? 1) - 1)}${yakuniy.manzil.qator}`;
  let tenglik: ErkinVaraq['svodQatori'] = null;
  kitob.varaqlar.forEach((v, j) => {
    if (v.nom === erkinNom || anat[j]?.rol !== 'svod') return;
    v.rows.forEach((row, r) => {
      row.forEach((katak, c) => {
        const f = v.formulalar?.[r]?.[c];
        const yorliq = (): string => {
          const matnlar = (row ?? []).map((x) => (typeof x === 'string' ? xom(x) : '')).filter(Boolean);
          return matnlar.sort((a, b) => b.length - a.length)[0] ?? '';
        };
        const manzil: Manzil = { fayl: kitob.fayl, varaq: v.nom, qator: r + 1, ustun: c + 1 };
        if (f && formulaHavolalari(f).some((h) => h.varaq === erkinNom && h.katak === nishon)) {
          const dalil: Dalil = { qoida: 'formula', ishonch: 'yuqori', izoh: `${v.nom}!${ustunHarf(c)}${r + 1} = ${f.slice(0, 60)}` };
          tenglik = { xom: yorliq(), manzil, dalil };
        } else if (!tenglik && typeof katak === 'number' && Math.abs(katak - yakuniy.qiymat) <= 0.01) {
          tenglik = { xom: yorliq(), manzil, dalil: { qoida: 'qiymat_tengligi', ishonch: 'orta', izoh: `qiymat teng (${katak}), formula havolasi yo'q` } };
        }
      });
    });
  });
  return tenglik;
}

export function erkinVaraqlar(kitob: KirishKitob, anat: readonly VaraqAnatomiyasi[]): ErkinVaraq[] {
  const chiq: ErkinVaraq[] = [];
  kitob.varaqlar.forEach((v, j) => {
    const rol = anat[j]?.rol;
    if (rol !== 'transport' && rol !== 'erkin') return;
    const yakuniy = yakuniySumma(kitob.fayl, v.nom, v.rows);
    const svodQatori = yakuniy ? svodQatoriniTop(kitob, anat, v.nom, yakuniy) : null;
    chiq.push({ fayl: kitob.fayl, varaq: v.nom, rol, yakuniy, svodQatori, holat: 'kutmoqda' });
  });
  return chiq;
}
