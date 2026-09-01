import type { ParkCalculationInput } from '..';

export type LegacyMarker = 'bl' | 'rs' | 'rz' | 'mat' | 'ob' | 'unknown';
export interface LegacySmetaRow {
  stableId?: string;
  migrationKey?: string;
  sourceSheet: string;
  rowNumber: number;
  marker: LegacyMarker;
  parentMigrationKey?: string;
  sectionKey: string;
  description: string;
  unit: string;
  baselineQuantity: number;
  estimateUnitPrice: number;
}
export interface LegacyF2PeriodRow {
  migrationKey?: string;
  sourceSheet: string;
  rowNumber: number;
  quantity?: number;
  /** F2 direct values: absent remains absent, it is never inferred as zero. */
  actualUnitPrice?: number;
}
export interface LegacyF2Period {
  periodId: string;
  periodLabel: string;
  revisionId: string;
  frozen: true;
  documentTotal?: number;
  rows: readonly LegacyF2PeriodRow[];
}
export interface LegacyCompatibilityInput {
  currency: string;
  rows: readonly LegacySmetaRow[];
  periods: readonly LegacyF2Period[];
  throughPeriod: number;
}
export interface LegacyIdentity {
  parkLineId: string;
  identityKind: 'stable_id' | 'migration_identity';
  legacyLocation: string;
}
export interface LegacyNormalizationResult {
  input: ParkCalculationInput;
  identities: LegacyIdentity[];
  warnings: string[];
}
export type RegressionStatus = 'MATCH' | 'INTENTIONAL_CHANGE' | 'BUG_FOUND' | 'UNRESOLVED';
export interface LegacyRegressionReport {
  scenario: string;
  legacyResult: Record<string, unknown>;
  parkResult: Record<string, unknown>;
  status: RegressionStatus;
  difference: Record<string, number | null>;
  reason: string;
}
