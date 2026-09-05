/**
 * Ported from `_f2UstunAniqla` in `Smeta tizimi/30_Panel.js` (line ~3529) —
 * part of T2-GAS-EXIT-001 §4 ("F2 file parsing must exit GAS"). This is the
 * "which column is which" auto-detector for uploaded F2 act files, learned
 * from studying real files in the `Ой/<oy>/*.xlsx` folder (see
 * `_f2lab/README.md`) — three known header layouts, one of them shifted by
 * one column versus the other two. Ported line-by-line; do not "clean up" a
 * branch without checking whether it exists to handle a specific template.
 */
import type { F2ColumnConfig, SheetGrid } from './types';

function up(v: unknown): string {
  return String(v == null ? '' : v).toUpperCase();
}

/**
 * Scans the first 60 rows for a header row containing "НАИМЕНОВАНИЕ" (name)
 * and a unit-column header ("ЕД.ИЗМ" / "ЕД. ИЗМ" / "ЕДИНИЦА ИЗМЕР" / "БИРЛИК").
 * Once found, looks for the code column ("ОБОСНОВ"/"ШИФР", else name-1), then
 * scans the header row plus the next 2 rows for norma/obyom/narx/sum keywords
 * — this is what makes the "ФОРМА" template (shifted by one column) resolve
 * correctly instead of silently reading the wrong column.
 */
export function f2UstunAniqla(data: SheetGrid): F2ColumnConfig & { hdrRow: number } {
  const d: F2ColumnConfig & { hdrRow: number } = { kod: 1, nom: 2, bir: 3, norma: 4, obyom: 5, narx: 6, sum: 7, hdrRow: -1 };

  for (let r = 0; r < Math.min(60, data.length); r++) {
    const row = data[r] || [];
    let iNom = -1;
    let iBir = -1;
    for (let c = 0; c < row.length; c++) {
      const u = up(row[c]);
      if (!u) continue;
      if (iNom < 0 && u.indexOf('НАИМЕНОВАНИЕ') >= 0) iNom = c;
      if (iBir < 0 && (u.indexOf('ЕД.ИЗМ') >= 0 || u.indexOf('ЕД. ИЗМ') >= 0 || u.indexOf('ЕДИНИЦА ИЗМЕР') >= 0 || u.indexOf('БИРЛИК') >= 0)) iBir = c;
    }
    if (iNom < 0 || iBir < 0) continue;
    d.hdrRow = r;
    d.nom = iNom;
    d.bir = iBir;
    d.kod = -1;
    for (let c2 = 0; c2 < row.length; c2++) {
      const u2 = up(row[c2]);
      if (u2 && c2 !== iNom && (u2.indexOf('ОБОСНОВ') >= 0 || u2.indexOf('ШИФР') >= 0)) { d.kod = c2; break; }
    }
    if (d.kod < 0 && iNom >= 1) d.kod = iNom - 1; // both known templates: ШИФР sits one column left of the name

    let no = -1;
    let ob = -1;
    let nx = -1;
    let sm = -1;
    for (let rr = r; rr < Math.min(r + 3, data.length); rr++) {
      const rw = data[rr] || [];
      for (let c3 = 0; c3 < rw.length; c3++) {
        const u3 = up(rw[c3]).replace(/\s+/g, ' ');
        if (!u3) continue;
        if (no < 0 && u3.indexOf('НА ЕДИНИЦУ') >= 0) no = c3;
        if (ob < 0 && u3.indexOf('ПО ПРОЕКТ') >= 0) ob = c3;
        if (nx < 0 && u3.indexOf('НА.ЕД') >= 0) nx = c3;
        if (sm < 0 && u3.indexOf('ОБЩАЯ') >= 0) sm = c3;
      }
    }
    if (no >= 0) { d.norma = no; d.obyom = ob >= 0 ? ob : no + 1; }
    else if (ob >= 0) { d.obyom = ob; d.norma = Math.max(0, ob - 1); }
    if (nx >= 0) { d.narx = nx; d.sum = sm >= 0 ? sm : nx + 1; }
    else if (sm >= 0) { d.sum = sm; d.narx = Math.max(0, sm - 1); }
    break;
  }
  return d;
}
