import type { Katak } from './turlar';

/** Katakning asl matni: faqat chetdagi bo'shliq olinadi, ichi aynan qoladi. */
export function xom(v: Katak): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Solishtirish kaliti: katta harf, Ё→Е, bo'shliqlar bitta. Ko'rsatish uchun EMAS. */
export function kalit(v: Katak): string {
  return xom(v).toUpperCase().replace(/Ё/g, 'Е').replace(/\s+/g, ' ');
}

/** Son: `0,01017`, `1 234,5`, `(12)` ni o'qiydi. Bo'sh yoki son emas → null (0 EMAS). */
export function son(v: Katak): number | null {
  if (v == null || typeof v === 'boolean') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = v.replace(/[\s ]/g, '');
  if (!s) return null;
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
  if (/^-?\d+(,\d+)?$/.test(s)) s = s.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function bosh(v: Katak): boolean {
  return xom(v) === '';
}

/** Qatordagi bo'sh bo'lmagan kataklar indekslari. */
export function toliqUstunlar(row: readonly Katak[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < row.length; i++) if (!bosh(row[i])) out.push(i);
  return out;
}
