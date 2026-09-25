/**
 * hujjat-yozuvchi/formula.ts — asl formulalarni yangi ustunlarga ko'chirish.
 *
 * Qonun (egasi, 2026-09-24): formulalarda `$` ishlatilmaydi — qator yoki blok
 * ko'chirilsa formula o'z qatoridan o'qiydi. Ko'chirishda asl `$` belgisi
 * (agar egasi o'zi qo'ygan bo'lsa) o'zgartirilmaydi.
 */
import { ustunHarfi, ustunIndeksi, unEsc } from './ooxml';
import type { AslKatak } from './varaq';

/** Asl katak formulasini yangi ustunlarga ko'chiradi: xaritadagi ustunlarga
 * havola — mos yangi ustunga (qator raqami o'zgarmaydi). `boshqasiQoladi`:
 * xaritada yo'q ustun (masalan =F237*E238 dagi koeffitsient katagi E238)
 * asl joyiga havola bo'lib qoladi; aks holda bunday formula ko'chirilmaydi.
 * Boshqa varaq/kitob havolasi yoki birorta ham ko'chgan havola bo'lmasa — null
 * (bunday formula yangi ustunga bog'lanmagan bo'lardi). */
export function formulaKochir(f: string, xarita: ReadonlyMap<number, number>, boshqasiQoladi = false): string | null {
  if (!f || /[![\]]/.test(f)) return null;
  let buzildi = false;
  let kochdi = 0;
  const natija = f.replace(/("[^"]*")|(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g, (all, str, d1, col, d2, row, offset, whole) => {
    if (str) return all;
    const oldin = whole[offset - 1];
    if (oldin && /[A-Za-z0-9_.]/.test(oldin)) return all; // funksiya nomi ichida (LOG10 …)
    const yangi = xarita.get(ustunIndeksi(col));
    if (yangi == null) { if (!boshqasiQoladi) buzildi = true; return all; }
    kochdi++;
    return `${d1}${ustunHarfi(yangi)}${d2}${row}`;
  });
  return buzildi || !kochdi ? null : natija;
}

/** Asl katakning oddiy formulasi. Shared/array/dataTable formulalar
 * ko'chirilmaydi (ularning matni boshqa katakka bog'liq) — null. */
export function aslFormula(katak: AslKatak | undefined): string | null {
  if (!katak) return null;
  const m = katak.xml.match(/<(?:\w+:)?f\b([^>]*)>([^<]*)<\/(?:\w+:)?f>/);
  if (!m || /\bt="(?:shared|array|dataTable)"/.test(m[1])) return null;
  return unEsc(m[2]);
}

/** Excel funksiyasi ko'pi bilan 255 argument oladi — zaxira bilan 250. */
const MAX_ARG = 250;

/** Qatorlar ro'yxatini ketma-ket oraliqlarga siqadi: [5,6,7,9] → ["G5:G7","G9"]. */
export function oraliqlar(harf: string, qatorlar: readonly number[]): string[] {
  const r = [...new Set(qatorlar)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < r.length;) {
    let j = i;
    while (j + 1 < r.length && r[j + 1] === r[j] + 1) j++;
    out.push(r[i] === r[j] ? `${harf}${r[i]}` : `${harf}${r[i]}:${harf}${r[j]}`);
    i = j + 1;
  }
  return out;
}

/**
 * Kataklar yig'indisi formulasi (`=` siz): oraliqlarga siqilgan, 250 dan ortiq
 * bo'lak bo'lsa ichma-ich `SUM(SUM(…),SUM(…))` — Excelning 255 argument
 * cheklovidan (katta bo'limlar: minglab resurs qatori) oshmaydi.
 */
export function sumRefs(harf: string, qatorlar: readonly number[]): string {
  let parts = oraliqlar(harf, qatorlar);
  if (!parts.length) return '0';
  while (parts.length > MAX_ARG) {
    const next: string[] = [];
    for (let i = 0; i < parts.length; i += MAX_ARG) next.push(`SUM(${parts.slice(i, i + MAX_ARG).join(',')})`);
    parts = next;
  }
  return `SUM(${parts.join(',')})`;
}

/** Bo'sh kataklar soni (`COUNTBLANK` faqat bitta oraliq oladi — har oraliq alohida qo'shiladi). */
export function bosRefs(harf: string, qatorlar: readonly number[]): string {
  const parts = oraliqlar(harf, qatorlar).map((p) => `COUNTBLANK(${p.includes(':') ? p : `${p}:${p}`})`);
  if (!parts.length) return '0';
  // Qo'shish operatori argument cheklovi emas, lekin formula uzunligi 8192 belgi —
  // ko'p bo'lakda SUM ichiga guruhlanadi.
  let g = parts;
  while (g.length > MAX_ARG) {
    const next: string[] = [];
    for (let i = 0; i < g.length; i += MAX_ARG) next.push(`SUM(${g.slice(i, i + MAX_ARG).join(',')})`);
    g = next;
  }
  return g.length === 1 ? g[0] : `SUM(${g.join(',')})`;
}
