import type { TreeNode } from '../../api/types';

export type FlatNode = {
  node: TreeNode;
  key: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  /** Ildizdan shu tugunGACHA (o'zi bilan) — breadcrumb/drawer uchun. */
  lineage: string[];
};

/** Bitta joyda — `flattenTree`/`getAllKeys` ikkalasi ham SHUNI ishlatadi,
 *  ilgari ikki joyda mustaqil takrorlanardi. */
/**
 * Kanonik T2 qatorida `id` — yagona identity. Legacy `holat` qatorlarida
 * esa id yo‘q, shu sabab eski varaq#qator kaliti faqat o‘sha oqimda qoladi.
 * `xom_qator` takrorlansa yoki o‘zgarsa T2 tanlov/expand holati buzilmaydi.
 */
export const nodeKey = (n: TreeNode) => n.id != null ? `t2:${n.id}` : `${n.varaq}#${n.row}`;

/**
 * T2-REAL-PARK-LRV-CLOSURE-005 (Codex tree lane, `codex/t2-smeta-tree-ux-v1`
 * @ 836280d, ACCEPT_CODEX): ITERATIV stek bilan — avvalgi versiya har
 * ochiq shoxda `result.concat(flattenTree(...))` chaqirardi, ya'ni har
 * daraja YANGI massiv yaratardi (chuqur/keng daraxtda O(n²) ga yaqin
 * xulq). 10 000 qatorli sinov (`utils.test.ts`) buni tasdiqlaydi.
 */
export function flattenTree(nodes: TreeNode[], expanded: Record<string, boolean>): FlatNode[] {
  const out: FlatNode[] = [];
  const stack = [...nodes].reverse().map((n) => ({ n, depth: 0, lineage: [] as string[] }));
  while (stack.length) {
    const c = stack.pop()!;
    const key = nodeKey(c.n);
    const kids = c.n.children || [];
    const open = !!expanded[key];
    const lineage = [...c.lineage, c.n.nom || 'Nomsiz'];
    out.push({ node: c.n, key, depth: c.depth, hasChildren: kids.length > 0, isExpanded: open, lineage });
    if (open) {
      // Teskari tartibda push — pop qilinganda asl (chapdan o'ngga) tartib saqlanadi.
      for (let i = kids.length - 1; i >= 0; i--) {
        stack.push({ n: kids[i], depth: c.depth + 1, lineage });
      }
    }
  }
  return out;
}

/**
 * FAQAT bolasi bor tugunlar kaliti — "hammasini yoyish" uchun barglarga
 * `expanded[key]=true` yozishning HOJATI yo'q (ular hech qachon
 * `hasChildren` bo'lmaydi, demak holati ishlatilmaydi ham). Avvalgi
 * versiya HAR bir tugunni (barglarni ham) qaytarardi — funksional farq
 * yo'q, lekin xotirada keraksiz kalitlar yig'ilardi.
 */
export function getAllKeys(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.children?.length) {
      out.push(nodeKey(n));
      stack.push(...n.children);
    }
  }
  return out;
}
