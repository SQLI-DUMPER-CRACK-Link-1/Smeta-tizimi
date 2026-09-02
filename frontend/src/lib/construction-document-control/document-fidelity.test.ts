import { describe, expect, it } from 'vitest';
import { calculateProgressValuation, createExportPreview } from '.';
import { documentFidelityFixture } from './fixtures/document-fidelity';

describe('document fidelity acceptance matrix', () => {
  const result=calculateProgressValuation(documentFidelityFixture.valuation);
  const row=(id:string)=>result.rows.find(x=>x.lineId===id)!;
  it('keeps names, IDs, hierarchy and markers independent of row order',()=>{
    expect(row('rs-cement').description).toBe('Sement'); expect(row('replacement-new').description).toBe('Yangi sement');
    expect(row('rs-cement').parentLineId).toBe('bl-original'); expect(row('replacement-new').parentLineId).toBe('bl-original');
    expect(row('rs-cement').changeKinds).toContain('substitution'); expect(row('additional').changeKinds).toContain('additional_work');
    const reversed=calculateProgressValuation({...documentFidelityFixture.valuation,lines:[...documentFidelityFixture.valuation.lines].reverse()});
    const reversedCement=reversed.rows.find(x=>x.lineId==='rs-cement')!; expect(reversedCement.lineId).toBe('rs-cement'); expect(reversedCement.changeKinds).toContain('substitution');
  });
  it('keeps F2 quantity, certified price and amount exact',()=>{
    const original=row('bl-original'); expect(original.previousQuantity).toBe(40); expect(original.currentQuantity).toBe(30); expect(original.currentF2ValuationPrice).toBe(100000); expect(original.currentCertifiedValue).toBe(3_000_000); expect(original.cumulativeCertifiedValue).toBe(7_000_000);
    const cement=row('rs-cement'); expect(cement.currentCertifiedValue).toBe(2_500_000); expect(cement.f2ValuationValue).toBe(4_500_000);
  });
  it('keeps quantity entitlement and money bases separate',()=>{
    const original=row('bl-original'); expect(original.approvedEntitlementQuantity).toBe(120); expect(original.remainingQuantity).toBe(50); expect(original.cumulativeQuantity).toBe(original.previousQuantity+original.currentQuantity);
    expect(row('finish').approvedEntitlementQuantity).toBe(45); expect(row('remove').approvedEntitlementQuantity).toBe(0); expect(row('additional').approvedEntitlementQuantity).toBe(15);
  });
  it('includes approved changes once and excludes pending/rejected changes',()=>{
    expect(row('additional').approvedChangeQuantity).toBe(15); expect(row('mat-steel').approvedChangeQuantity).toBe(0); expect(row('mat-steel').warnings).toContain('PENDING_CHANGE');
  });
  it('never lets actual procurement overwrite baseline or certified valuation',()=>{
    const original=row('bl-original'); expect(original.baselineReferencePrice).toBe(100000); expect(original.currentF2ValuationPrice).toBe(100000); expect(original.actualValue).toBe(7_100_000); expect(original.variance).toBe(100_000);
  });
  it('is immutable for frozen history and prints only canonical values',()=>{
    const before=structuredClone(documentFidelityFixture); calculateProgressValuation(documentFidelityFixture.valuation); expect(documentFidelityFixture).toEqual(before);
    const preview=createExportPreview(documentFidelityFixture); expect(preview.reconciliation).toEqual([]); expect(preview.officialRows.map(x=>x.description).join('|')).not.toMatch(/ZAMENA|QO'SHIMCHA|REPLACEMENT|CHANGE|REVISION BANNER/i); expect(JSON.stringify(preview.officialRows)).not.toMatch(/lineId|parentLineId|changeKinds|revisionIds/);
  });
  it('fails Forma-3 safely until legal evidence rule exists',()=>{ expect(documentFidelityFixture.requirements).toEqual([]); expect(documentFidelityFixture.revisions.every(x=>x.immutable)).toBe(true); });
});
