import type { AktNode } from './f2-match-engine';
import { smetaDaraxtniYoy, type SmetaFlatQator } from './smeta-flatten';

/**
 * Bitta obyektning boshlang'ich smetasi ko'pincha bitta XLSX emas: masalan
 * 1--4 uchastka va EO qismi. Bu modul ularni "bitta umumiy fayl" deb
 * aralashtirmaydi. Har bir bo'lak o'z LRV manbasiga, uning RES manbalariga
 * va barcha qatorlari bo'yicha saqlanadigan `source_key` ga ega.
 *
 * Bu browserdagi vaqtinchalik papka/yol emas. `key` faqat paket ichidagi
 * turg'un identifikator; server uni keyin kanonik R2 hujjati va paket
 * a'zosi bilan bog'laydi.
 */
export type SmetaPaketManbaReja = {
  key: string;
  nom: string;
  lrvDocumentId: number;
  resDocumentIds: number[];
};

export type SmetaPaketRejaXatosi =
  | 'PACKAGE_KEY_REQUIRED'
  | 'PACKAGE_NAME_REQUIRED'
  | 'PACKAGE_SOURCE_REQUIRED'
  | 'PACKAGE_SOURCE_KEY_INVALID'
  | 'PACKAGE_SOURCE_KEY_DUPLICATE'
  | 'PACKAGE_SOURCE_NAME_REQUIRED'
  | 'PACKAGE_LRV_REQUIRED'
  | 'PACKAGE_RES_DUPLICATE';

export type SmetaPaketRejaTekshiruv = { ok: true } | { ok: false; code: SmetaPaketRejaXatosi; sourceKey?: string };

const KEY = /^[a-z0-9][a-z0-9._-]{0,79}$/;

/** Paket tarkibini R2 ga yoki import RPC ga chiqishidan AVVAL tekshiradi. */
export function smetaPaketRejasiniTekshir(
  paketKey: string,
  paketNom: string,
  manbalar: readonly SmetaPaketManbaReja[],
): SmetaPaketRejaTekshiruv {
  if (!paketKey.trim()) return { ok: false, code: 'PACKAGE_KEY_REQUIRED' };
  if (!paketNom.trim()) return { ok: false, code: 'PACKAGE_NAME_REQUIRED' };
  if (!manbalar.length) return { ok: false, code: 'PACKAGE_SOURCE_REQUIRED' };
  const keys = new Set<string>();
  const resDocuments = new Set<number>();
  for (const manba of manbalar) {
    if (!KEY.test(manba.key)) return { ok: false, code: 'PACKAGE_SOURCE_KEY_INVALID', sourceKey: manba.key };
    if (keys.has(manba.key)) return { ok: false, code: 'PACKAGE_SOURCE_KEY_DUPLICATE', sourceKey: manba.key };
    keys.add(manba.key);
    if (!manba.nom.trim()) return { ok: false, code: 'PACKAGE_SOURCE_NAME_REQUIRED', sourceKey: manba.key };
    if (!Number.isSafeInteger(manba.lrvDocumentId) || manba.lrvDocumentId <= 0) {
      return { ok: false, code: 'PACKAGE_LRV_REQUIRED', sourceKey: manba.key };
    }
    for (const documentId of manba.resDocumentIds) {
      if (!Number.isSafeInteger(documentId) || documentId <= 0 || resDocuments.has(documentId)) {
        return { ok: false, code: 'PACKAGE_RES_DUPLICATE', sourceKey: manba.key };
      }
      resDocuments.add(documentId);
    }
  }
  return { ok: true };
}

/**
 * Bir manbaning daraxtidagi lokal idlar faqat o'sha XLSX ichida noyob bo'lishi
 * mumkin. Paket importida ular bo'lak kaliti bilan nomlanadi, shunda barcha
 * 5 ta LRV bir sessiyada bo'lsa ham ota-bola aloqasi to'qnashmaydi.
 */
export function smetaPaketDaraxtiniNomlash(sourceKey: string, tree: readonly AktNode[]): AktNode[] {
  const prefix = sourceKey + '::';
  const clone = (node: AktNode): AktNode => ({
    ...node,
    uid: prefix + node.uid,
    children: node.children?.map(clone),
  });
  return tree.map(clone);
}

export type SmetaPaketFlatQator = SmetaFlatQator & { source_key: string };

/** Har qator o'zining LRV bo'lagi bilan chiqadi; RES hech qachon global emas. */
export function smetaPaketQatorlariniYoy(
  manbalar: ReadonlyArray<{ sourceKey: string; tree: readonly AktNode[] }>,
): SmetaPaketFlatQator[] {
  const out: SmetaPaketFlatQator[] = [];
  for (const manba of manbalar) {
    const namespaced = smetaPaketDaraxtiniNomlash(manba.sourceKey, manba.tree);
    out.push(...smetaDaraxtniYoy(namespaced).map((qator) => ({ ...qator, source_key: manba.sourceKey })));
  }
  return out;
}

/** RES hujjati bir bo'lakka faqat bir marta biriktirilishi mumkin. */
export function resHujjatiniPaketgaBiriktir(
  manbalar: readonly SmetaPaketManbaReja[],
  sourceKey: string,
  documentId: number,
): SmetaPaketManbaReja[] {
  return manbalar.map((manba) => {
    if (manba.key !== sourceKey || manba.resDocumentIds.includes(documentId)) return manba;
    return { ...manba, resDocumentIds: [...manba.resDocumentIds, documentId] };
  });
}
