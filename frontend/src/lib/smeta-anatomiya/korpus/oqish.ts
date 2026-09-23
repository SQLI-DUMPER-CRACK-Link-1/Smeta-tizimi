/** Korpus testlari uchun: real faylni SheetJS bilan KirishKitob ga o'qiydi (faqat Node). */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import type { KirishKitob, KirishVaraq } from '../turlar';

/** SheetJS → KirishKitob. Qator indeksi Excel qatoriga aynan mos (A1 dan, bo'sh qatorlar bilan). */
export function faylniOqi(p: string, ildiz: string): KirishKitob {
  const wb = XLSX.read(fs.readFileSync(p), { type: 'buffer', cellStyles: true, cellFormula: true });
  const varaqlar: KirishVaraq[] = wb.SheetNames.map((nom) => {
    const ws = wb.Sheets[nom];
    if (!ws['!ref']) return { nom, rows: [] };
    const e = XLSX.utils.decode_range(ws['!ref']).e;
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
      header: 1, defval: null, raw: true, blankrows: true, range: { s: { r: 0, c: 0 }, e },
    });
    const outline = (ws['!rows'] ?? []).map((r) => r?.level);
    const merges = (ws['!merges'] ?? []).map((m) => ({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c }));
    const formulalar: Array<Array<string | null>> = [];
    for (const [ref, cell] of Object.entries(ws)) {
      if (ref.startsWith('!') || !(cell as XLSX.CellObject).f) continue;
      const { r, c } = XLSX.utils.decode_cell(ref);
      (formulalar[r] ??= [])[c] = (cell as XLSX.CellObject).f!;
    }
    return { nom, rows, merges, outline, formulalar };
  });
  return { fayl: path.relative(ildiz, p).replace(/\\/g, '/'), varaqlar };
}
