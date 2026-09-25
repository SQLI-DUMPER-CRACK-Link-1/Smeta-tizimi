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
