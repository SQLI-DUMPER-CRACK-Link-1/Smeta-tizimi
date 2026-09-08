/**
 * smeta-flatten.ts — AktNode daraxtini kanonik import qatorlariga yoyadi.
 *
 * BITTA nusxa, ikki chaqiruvchi: Cloudflare Function (`/api/smeta-yukla`
 * ning eski bitta-o'tishli yo'li) va brauzer (bo'lakli yuborish uchun
 * qatorlarni O'ZI yoyishi kerak -- daraxtni bo'laklab bo'lmaydi, chunki
 * ota-bola aloqasi bo'lak chegarasidan o'tib ketadi).
 *
 * Tartib -- HUJJAT TARTIBI (pre-order): ota har doim bolasidan oldin
 * keladi va `tartib` ustuni shu ketma-ketlikni saqlaydi.
 */
import type { AktNode } from './f2-match-engine';

export interface SmetaFlatQator {
  local_id: string;
  parent_local_id: string | null;
  tur: string;
  kod: string | null;
  nom: string | null;
  birlik: string | null;
  hajm: number | null;
  narx: number | null;
  summa: number | null;
}

export function smetaDaraxtniYoy(
  nodes: AktNode[], parentLocalId: string | null = null, out: SmetaFlatQator[] = [],
): SmetaFlatQator[] {
  for (const node of nodes) {
    out.push({
      local_id: node.uid, parent_local_id: parentLocalId, tur: node.type,
      kod: node.kod ?? null, nom: node.nom ?? null, birlik: node.bir ?? null,
      hajm: node.hajm ?? null, narx: node.narx ?? null, summa: node.summa ?? null,
    });
    if (node.children && node.children.length) smetaDaraxtniYoy(node.children, node.uid, out);
  }
  return out;
}

/** Qatorlarni teng bo'laklarga bo'ladi (oxirgisi kichikroq bo'lishi mumkin). */
export function bolaklarga<T>(rows: T[], bolakHajmi: number): T[][] {
  if (bolakHajmi <= 0) return rows.length ? [rows] : [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += bolakHajmi) out.push(rows.slice(i, i + bolakHajmi));
  return out;
}
