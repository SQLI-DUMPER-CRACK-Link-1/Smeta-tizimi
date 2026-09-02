import type { LegacyCompatibilityInput } from './types';

/** Golden legacy rows: BL quantity propagates proportionally to its RS resource unless RS is explicitly stated. */
export const legacyBlRsGolden: LegacyCompatibilityInput = {
  currency: 'UZS', throughPeriod: 1,
  rows: [
    { stableId: 'bl-concrete', sourceSheet: 'LRV_PLUS', rowNumber: 10, marker: 'bl', sectionKey: 'structure', description: 'Beton bloki', unit: 'm³', baselineQuantity: 100, estimateUnitPrice: 100_000 },
    { migrationKey: 'rs-cement', sourceSheet: 'LRV_PLUS', rowNumber: 11, marker: 'rs', parentMigrationKey: 'bl-concrete', sectionKey: 'structure', description: 'Sement resursi', unit: 't', baselineQuantity: 20, estimateUnitPrice: 500_000 },
    { migrationKey: 'rs-steel', sourceSheet: 'LRV_PLUS', rowNumber: 12, marker: 'rs', parentMigrationKey: 'bl-concrete', sectionKey: 'structure', description: 'Armatura resursi', unit: 't', baselineQuantity: 10, estimateUnitPrice: 900_000 },
  ],
  periods: [
    { periodId: 'legacy-f2-01', periodLabel: '01.2026', revisionId: 'legacy-f2-01-r1', frozen: true, documentTotal: 9_000_000, rows: [
      { migrationKey: 'bl-concrete', sourceSheet: 'LRV_PLUS', rowNumber: 10, quantity: 40 },
      { migrationKey: 'rs-steel', sourceSheet: 'LRV_PLUS', rowNumber: 12, quantity: 5, actualUnitPrice: 900_000 },
    ] },
    { periodId: 'legacy-f2-02', periodLabel: '02.2026', revisionId: 'legacy-f2-02-r1', frozen: true, documentTotal: 13_500_000, rows: [
      { migrationKey: 'bl-concrete', sourceSheet: 'LRV_PLUS', rowNumber: 10, quantity: 60 },
      { migrationKey: 'rs-steel', sourceSheet: 'LRV_PLUS', rowNumber: 12, quantity: 5, actualUnitPrice: 900_000 },
    ] },
  ],
};

export const legacyZeroAndOverCertification: LegacyCompatibilityInput = {
  currency: 'UZS', throughPeriod: 1,
  rows: [{ sourceSheet: 'LRV_PLUS', rowNumber: 42, marker: 'rz', sectionKey: 'zero', description: 'Nolsiz ish', unit: 'm²', baselineQuantity: 10, estimateUnitPrice: 10.005 }],
  periods: [
    { periodId: 'f2-zero', periodLabel: '03.2026', revisionId: 'r1', frozen: true, rows: [] },
    { periodId: 'f2-over', periodLabel: '04.2026', revisionId: 'r1', frozen: true, rows: [{ sourceSheet: 'LRV_PLUS', rowNumber: 42, quantity: 12 }] },
  ],
};
