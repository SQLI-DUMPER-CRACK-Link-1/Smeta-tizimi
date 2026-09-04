import { describe, expect, it } from 'vitest';
import type { TreeNode } from '../../api/types';
import { matchCatalogObservations, observationsFromTree } from '.';

const leaf = (overrides: Partial<TreeNode>): TreeNode => ({ type: 'bl', nom: 'Beton B25', varaq: 'L1', row: 10, smetaHajm: 10, smeta: 1000, narx: 100, fakt: 0, qoldiq: 10, f2ol: 0, f2mum: 0, birlik: 'm3', kod: 'B25', ...overrides });
const scope = { companyId: 1, objectId: 10, sourceType: 'smeta' as const };

describe('catalog ingestion adapter', () => {
  it('BL va resurslardan object-scoped observation chiqaradi', () => {
    const out = observationsFromTree(scope, [leaf({ children: [leaf({ type: 'mat', nom: 'Armatura', kod: 'A500', birlik: 'kg', row: 11 })] })]);
    expect(out).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'work_type', sourceLineKey: 'L1#10', scope: expect.objectContaining({ companyId: 1, objectId: 10 }) }),
      expect.objectContaining({ kind: 'resource', resourceKind: 'material', sourceLineKey: 'L1#11' }),
    ]));
  });

  it('faqat yagona aniq code+nom+birlik mosligini auto-link qiladi', () => {
    const [result] = matchCatalogObservations(observationsFromTree(scope, [leaf({})]), [{ canonicalId: 'work:25', kind: 'work_type', companyId: 1, code: 'B25', name: 'Beton B25', unit: 'm3' }]);
    expect(result).toMatchObject({ match: 'auto_linked', canonicalId: 'work:25' });
  });

  it('nom yoki birlik farqi avtomatik bog\'lanmaydi', () => {
    const [result] = matchCatalogObservations(observationsFromTree(scope, [leaf({ birlik: 't' })]), [{ canonicalId: 'work:25', kind: 'work_type', companyId: 1, code: 'B25', name: 'Beton B25', unit: 'm3' }]);
    expect(result).toMatchObject({ match: 'unmatched', candidateIds: [] });
  });

  it('boshqa kompaniya katalogi yoki object narxi observationga sizmaydi', () => {
    const [result] = matchCatalogObservations(observationsFromTree({ ...scope, objectId: 11 }, [leaf({ narx: 999 })]), [{ canonicalId: 'other-company', kind: 'work_type', companyId: 2, code: 'B25', name: 'Beton B25', unit: 'm3' }]);
    expect(result).toMatchObject({ match: 'unmatched', candidateIds: [], scope: expect.objectContaining({ objectId: 11 }), sourcePrice: 999 });
  });
});
