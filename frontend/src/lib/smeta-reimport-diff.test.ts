import { describe, expect, it } from 'vitest';
import { smetaQaytaImportDiff, type SmetaReimportLine } from './smeta-reimport-diff';

const oldLine = (overrides: Partial<SmetaReimportLine> = {}): SmetaReimportLine => ({
  canonicalId: null,
  sourceKey: null,
  kod: '100',
  nom: 'Beton',
  birlik: 'м3',
  hajm: 10,
  norma: null,
  narx: null,
  ...overrides,
});

describe('Smeta targeted re-import diff', () => {
  it('keeps exact unchanged lines separate from numeric corrections', () => {
    const before = [oldLine({ canonicalId: 1, sourceKey: 'a' }), oldLine({ canonicalId: 2, sourceKey: 'b', kod: '200', nom: 'Armatura' })];
    const after = [oldLine({ canonicalId: 1, sourceKey: 'a' }), oldLine({ canonicalId: 2, sourceKey: 'b', kod: '200', nom: 'Armatura', hajm: 12 })];

    const diff = smetaQaytaImportDiff(before, after);

    expect(diff.same).toHaveLength(1);
    expect(diff.correction).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('does not confuse same-name/different-code with same-code/different-unit', () => {
    const before = [
      oldLine({ canonicalId: 1, sourceKey: 'name-collision', kod: '100', nom: 'Kabel' }),
      oldLine({ canonicalId: 2, sourceKey: 'unit-collision', kod: '200', nom: 'Quvur', birlik: 'м' }),
    ];
    const after = [
      oldLine({ canonicalId: 3, sourceKey: 'new-name-code', kod: '101', nom: 'Kabel' }),
      oldLine({ canonicalId: 4, sourceKey: 'new-code-unit', kod: '200', nom: 'Quvur', birlik: 'шт' }),
    ];

    const diff = smetaQaytaImportDiff(before, after);

    expect(diff.sameNameDifferentCode).toHaveLength(1);
    expect(diff.sameCodeDifferentUnit).toHaveLength(1);
    expect(diff.ambiguous).toHaveLength(0);
  });

  it('reports additions and removals as history candidates, never deletion commands', () => {
    const before = [oldLine({ canonicalId: 1, sourceKey: 'removed', kod: '300', nom: 'Eski qator' })];
    const after = [oldLine({ canonicalId: null, sourceKey: 'added', kod: '400', nom: 'Yangi qator' })];

    const diff = smetaQaytaImportDiff(before, after);

    expect(diff.added[0]?.after?.kod).toBe('400');
    expect(diff.removed[0]?.before?.kod).toBe('300');
    expect(diff.history.map((entry) => entry.kind)).toEqual(['added', 'removed']);
    expect(diff).not.toHaveProperty('deleteCommands');
  });

  it('classifies an identity-preserving label/code/unit change as replacement', () => {
    const before = [oldLine({ canonicalId: 7, sourceKey: 'stable-source', kod: '500', nom: 'Eski nom', birlik: 'т' })];
    const after = [oldLine({ canonicalId: 7, sourceKey: 'stable-source', kod: '501', nom: 'Yangi nom', birlik: 'т' })];

    const diff = smetaQaytaImportDiff(before, after);

    expect(diff.replacement).toHaveLength(1);
    expect(diff.correction).toHaveLength(0);
    expect(diff.history[0]?.kind).toBe('replacement');
  });
});
