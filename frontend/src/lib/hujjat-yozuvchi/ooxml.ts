/**
 * hujjat-yozuvchi/ooxml.ts — SpreadsheetML (OOXML) past darajadagi yordamchilar.
 *
 * Tender Oferta V3 eksportidan (tender-oferta-export.ts) ajratib olingan:
 * xatti-harakat bayt darajasida o'zgarmagan. Barcha PTO eksportlari (Oferta,
 * Ostatka, F2 akt, Nakopitelniy, Resurs vedomosti, paket svodi) shu yerdan
 * foydalanadi — bitta katak modeli, bitta qochirish qoidasi.
 */

/** 0-asosli ustun indeksi → Excel harfi (0 → A, 26 → AA). */
export function ustunHarfi(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Excel harfi → 0-asosli ustun indeksi (A → 0). */
export function ustunIndeksi(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

export const xmlEsc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const unEsc = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
/** Formula ichidagi varaq nomi: 'Лист 1'!A1. */
export const sheetRef = (name: string): string => `'${name.replace(/'/g, "''")}'`;
/** Son → XML matni (−0 → 0). */
export const num = (n: number): string => (Object.is(n, -0) ? '0' : String(n));

/** ZIP (xlsx/xlsm) mi yoki eski BIFF (.xls)? */
export function isZip(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/** Ketma-ket qatorlarni diapazonga siqib SUM argumentlarini yasaydi: F5:F9,F12. */
export function sumArgs(col: string, rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${col}${sorted[i]}` : `${col}${sorted[i]}:${col}${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(',');
}

// ───────────────────────── hujayra modeli ─────────────────────────

/** Yangi katak. Uslub `klon` (shu qatordagi ASL ustun) katagidan olinadi —
 * egasining shrifti, chegarasi, son formati va rangi aynan davom etadi;
 * u yo‘q bo‘lsa `s` (ustun sukut uslubi yoki rangsiz zaxira). */
export type YangiHujayra = { col: number; klon?: number; s: number; xml: (ref: string, s: number) => string };

export function strCell(col: number, s: number, text: string, klon?: number): YangiHujayra {
  return { col, s, klon, xml: (ref, st) => `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(text)}</t></is></c>` };
}
export function numCell(col: number, s: number, v: number, klon?: number): YangiHujayra {
  return { col, s, klon, xml: (ref, st) => `<c r="${ref}" s="${st}"><v>${num(v)}</v></c>` };
}
/** Formula katagi. `v` — keshlangan natija (sayt hisobi): son, matn yoki
 * null (natija noma'lum — keshsiz, Excel/LibreOffice o'zi hisoblaydi). */
export function fCell(col: number, s: number, f: string, v: number | string | null, klon?: number): YangiHujayra {
  return {
    col, s, klon, xml: (ref, st) => {
      if (v == null) return `<c r="${ref}" s="${st}"><f>${xmlEsc(f)}</f></c>`;
      if (typeof v === 'string') return `<c r="${ref}" s="${st}" t="str"><f>${xmlEsc(f)}</f><v>${xmlEsc(v)}</v></c>`;
      return `<c r="${ref}" s="${st}"><f>${xmlEsc(f)}</f><v>${num(v)}</v></c>`;
    },
  };
}
export function bosCell(col: number, s: number, klon?: number): YangiHujayra {
  return { col, s, klon, xml: (ref, st) => `<c r="${ref}" s="${st}"/>` };
}
