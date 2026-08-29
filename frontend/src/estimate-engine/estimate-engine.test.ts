import { describe, expect, it } from 'vitest';
import { NoNormDataMatcher, calculateF2Draft, composeAbc4Text, convertQuantity, expandNormResources, parseConstructionText } from './index';

const FIXTURE = 'Fundament qilindi. Podbetonka 9 kub B7.5.\n12 lik armatura 200 kg va 6 lik katanka 50 kg\narmokarkas qilindi.\nB15 dan 13 kub beton qilindi.';

describe('text-to-smeta V1 foundation', () => {
  it('extracts only explicit concrete and reinforcement facts', () => {
    const result = parseConstructionText(FIXTURE);
    const works = result.document.sections[0].items;
    expect(works.map(x => [x.name, x.quantity, x.unit, x.attributes.concreteGrade])).toEqual(expect.arrayContaining([
      ['concrete_preparation', 9, 'm3', 'B7.5'], ['structural_concrete', 13, 'm3', 'B15'],
    ]));
    const reinforcement = works.find(x => x.name === 'reinforcement');
    expect(reinforcement?.resources.map(x => [x.name, x.quantity, x.unit])).toEqual([
      ['Ø12 armatura', 200, 'kg'], ['Ø6 katanka', 50, 'kg'],
    ]);
    expect(result.facts.filter(x => x.state === 'missing').map(x => x.field)).toEqual(expect.arrayContaining([
      'formwork', 'excavation', 'pour_method', 'reinforcement_connection_method',
    ]));
    expect(works.flatMap(x => x.resources).every(x => x.price == null)).toBe(true);
  });

  it('keeps norm matching empty until verified data is connected', () => {
    const parsed = parseConstructionText(FIXTURE); const matcher = new NoNormDataMatcher();
    expect(matcher.findCandidates({ document: parsed.document, item: parsed.document.sections[0].items[0] })).toEqual([]);
  });

  it('uses deterministic unit conversion and resource expansion', () => {
    expect(convertQuantity(1000, 'kg', 't')).toBe(1);
    expect(() => convertQuantity(1, 'm3', 'kg')).toThrow('Incompatible units');
    expect(expandNormResources({ normId: 'verified-norm', workUnit: 'm3', resources: [{ type: 'labor', resourceId: 'l1', name: 'Labor', quantityPerUnit: 2, unit: 'labor-hour' }] }, 3, 'm3', [1.1])[0].quantity).toBeCloseTo(6.6);
  });

  it('calculates F2 without silently admitting unmatched work', () => {
    expect(calculateF2Draft({ estimateQuantity: 100, previousCertified: 41, currentReported: 34.6, unit: 'm3', matchedEstimateItemId: 'q-1' })).toMatchObject({ current: 34.6, cumulative: 75.6, remaining: 24.4, unmatchedWork: false });
    const exceeded = calculateF2Draft({ estimateQuantity: 100, previousCertified: 80, currentReported: 30, unit: 'm3', matchedEstimateItemId: 'q-1' }, 'block');
    expect(exceeded.issues[0].severity).toBe('block');
    expect(calculateF2Draft({ previousCertified: 0, currentReported: 1, unit: 'm3' }).unmatchedWork).toBe(true);
  });

  it('does not fabricate ABC4 grammar', () => {
    const parsed = parseConstructionText(FIXTURE); const output = composeAbc4Text(parsed.document, { name: 'unverified', grammarStatus: 'NEEDS_SAMPLE' });
    expect(output.grammarStatus).toBe('NEEDS_SAMPLE');
    expect(output.issues[0].code).toBe('ABC4_GRAMMAR_NEEDS_SAMPLE');
  });
});
