import type { TreeNode } from '../../api/types';
import type { CanonicalCatalogIdentity, CatalogIngestScope, CatalogMatch, CatalogObservation, ResourceKind } from './types';

const normal = (value: string | undefined) => (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('uz');

function resourceKind(type: TreeNode['type']): ResourceKind | undefined {
  if (type === 'rs') return 'labor';
  if (type === 'mat') return 'material';
  if (type === 'ob') return 'equipment';
  return undefined;
}

/**
 * Daraxtni faqat observation-kandidatlariga aylantiradi. DB yozmaydi va
 * manbadagi narxni boshqa objectga ko'chirmaydi.
 */
export function observationsFromTree(scope: CatalogIngestScope, nodes: TreeNode[]): CatalogObservation[] {
  const out: CatalogObservation[] = [];
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if (node.children?.length) stack.push(...[...node.children].reverse());
    const sourceLineKey = `${node.varaq}#${node.row}`;
    if (node.type === 'bl') {
      out.push({ kind: 'work_type', scope, sourceLineKey, code: node.kod, name: node.nom, unit: node.birlik, sourcePrice: node.narx });
      continue;
    }
    const kind = resourceKind(node.type);
    if (kind) out.push({ kind: 'resource', resourceKind: kind, scope, sourceLineKey, code: node.kod, name: node.nom, unit: node.birlik, sourcePrice: node.narx });
  }
  return out;
}

/**
 * Faqat kompaniya doirasidagi yagona code+name+unit identiteti auto-link
 * bo'lishi mumkin. Boshqa barcha holat odam ko'rib chiqadigan candidate.
 */
export function matchCatalogObservations(observations: CatalogObservation[], catalog: CanonicalCatalogIdentity[]): CatalogMatch[] {
  return observations.map((observation) => {
    const candidates = catalog.filter((candidate) =>
      candidate.companyId === observation.scope.companyId
      && candidate.kind === observation.kind
      && normal(candidate.code) === normal(observation.code)
      && normal(candidate.name) === normal(observation.name)
      && normal(candidate.unit) === normal(observation.unit));
    if (candidates.length === 1) return { ...observation, match: 'auto_linked', canonicalId: candidates[0].canonicalId, candidateIds: [candidates[0].canonicalId] };
    if (candidates.length > 1) return { ...observation, match: 'candidate_review', candidateIds: candidates.map((candidate) => candidate.canonicalId) };
    return { ...observation, match: 'unmatched', candidateIds: [] };
  });
}

export * from './types';
