import type { ParkCalculationInput } from './types';

/** Deliberately labelled test fixture; it is not production data. */
export const parkScenarioFixture: ParkCalculationInput = {
  currency: 'UZS', throughPeriod: 1,
  lines: [
    { lineId: 'work-concrete', sectionId: 'structure', description: 'Beton ishlari', unit: 'm³', baselineQuantity: 100, estimateUnitPrice: 100_000 },
    { lineId: 'mat-cement', sectionId: 'structure', description: 'Sement', unit: 't', baselineQuantity: 20, estimateUnitPrice: 500_000 },
    { lineId: 'work-removed', sectionId: 'legacy', description: 'Bekor qilingan ish', unit: 'm²', baselineQuantity: 10, estimateUnitPrice: 200_000 },
    { lineId: 'work-finish', sectionId: 'finish', description: 'Pardoz ishlari', unit: 'm²', baselineQuantity: 20, estimateUnitPrice: 150_000 },
  ],
  changes: [
    { changeId: 'approved-increase', revisionId: 'rev-2', kind: 'quantity_increase', status: 'approved', effectiveFromPeriod: 1, lineId: 'work-concrete', quantityDelta: 20, reason: 'Tasdiqlangan hajm oshishi' },
    { changeId: 'pending-substitution', revisionId: 'rev-3', kind: 'replacement', status: 'pending', effectiveFromPeriod: 1, lineId: 'mat-cement', replacementForLineId: 'mat-cement', quantityDelta: -2, estimateUnitPrice: 500_000, reason: 'Ko‘rib chiqilayotgan almashtirish' },
    { changeId: 'approved-additional', revisionId: 'rev-2', kind: 'additional_work', status: 'approved', effectiveFromPeriod: 1, lineId: 'work-drain', sectionId: 'drainage', description: 'Qo‘shimcha drenaj', unit: 'm', quantityDelta: 15, estimateUnitPrice: 80_000, reason: 'Tasdiqlangan qo‘shimcha ish' },
    { changeId: 'approved-remove', revisionId: 'rev-2', kind: 'removed_work', status: 'approved', effectiveFromPeriod: 1, lineId: 'work-removed', quantityDelta: -10, reason: 'Ish chiqarib tashlangan' },
    { changeId: 'approved-decrease', revisionId: 'rev-2', kind: 'quantity_decrease', status: 'approved', effectiveFromPeriod: 1, lineId: 'work-finish', quantityDelta: -5, reason: 'Tasdiqlangan hajm kamayishi' },
    { changeId: 'approved-replace-old', revisionId: 'rev-2', kind: 'replacement', status: 'approved', effectiveFromPeriod: 1, lineId: 'mat-cement', quantityDelta: -1, reason: 'Eski sement almashtirildi' },
    { changeId: 'approved-replace-new', revisionId: 'rev-2', kind: 'replacement', status: 'approved', effectiveFromPeriod: 1, lineId: 'mat-cement-alt', replacementForLineId: 'mat-cement', sectionId: 'structure', description: 'Sement ekvivalent', unit: 't', quantityDelta: 1, estimateUnitPrice: 600_000, reason: 'Tasdiqlangan almashtirish' },
    { changeId: 'approved-new-section', revisionId: 'rev-2', kind: 'new_section', status: 'approved', effectiveFromPeriod: 1, lineId: 'waterproof-line', sectionId: 'waterproofing', description: 'Yangi gidroizolyatsiya bo‘limi', unit: 'm²', quantityDelta: 8, estimateUnitPrice: 120_000, reason: 'Yangi bo‘lim tasdiqlandi' },
  ],
  periods: [
    { periodId: 'f2-jan', periodLabel: '01.2026', revisionId: 'f2-jan-r1', frozen: true, documentTotal: 6_000_000, lines: [
      { lineId: 'work-concrete', quantity: 40, actualUnitPrice: 100_000 }, { lineId: 'mat-cement', quantity: 4, actualUnitPrice: 550_000 },
    ] },
    { periodId: 'f2-feb', periodLabel: '02.2026', revisionId: 'f2-feb-r1', frozen: true, documentTotal: 7_800_000, lines: [
      { lineId: 'work-concrete', quantity: 50, actualUnitPrice: 100_000 }, { lineId: 'mat-cement', quantity: 5, actualUnitPrice: 450_000 }, { lineId: 'work-drain', quantity: 5, actualUnitPrice: 80_000 },
    ] },
  ],
};
