/**
 * PARK document-control calculation contract.
 *
 * This is deliberately transport-free: Claude can map these IDs to the
 * existing F2/estimate/read-model contracts without creating another truth.
 */
export type Id = string;
export type ChangeStatus = 'approved' | 'pending' | 'rejected';
export type ChangeKind =
  | 'quantity_increase' | 'quantity_decrease' | 'additional_work'
  | 'removed_work' | 'replacement' | 'new_section' | 'new_item';

export interface ParkLine {
  lineId: Id;
  sectionId: Id;
  description: string;
  unit: string;
  baselineQuantity: number;
  /** Contract/estimate reference price. Never overwritten by actual price. */
  estimateUnitPrice: number;
}

export interface ParkChange {
  changeId: Id;
  kind: ChangeKind;
  status: ChangeStatus;
  /** First period where this approved entitlement is valid (zero based). */
  effectiveFromPeriod: number;
  lineId?: Id;
  replacementForLineId?: Id;
  sectionId?: Id;
  description?: string;
  unit?: string;
  quantityDelta: number;
  /** Approved reference price for new/additional scope, if applicable. */
  estimateUnitPrice?: number;
  reason: string;
  revisionId: Id;
}

export interface ParkCertifiedLine {
  lineId: Id;
  quantity: number;
  /** The real execution/material price for THIS period. Optional by evidence. */
  actualUnitPrice?: number;
}

/** Immutable certified-period input: corrections create a new revision, never mutate this snapshot. */
export interface ParkPeriodSnapshot {
  periodId: Id;
  periodLabel: string;
  revisionId: Id;
  lines: readonly ParkCertifiedLine[];
  documentTotal?: number;
  frozen: true;
}

export interface ParkCalculationInput {
  currency: string;
  lines: readonly ParkLine[];
  changes: readonly ParkChange[];
  periods: readonly ParkPeriodSnapshot[];
  /** Index of the period being prepared/read. */
  throughPeriod: number;
}

export interface ParkLineResult {
  lineId: Id;
  sectionId: Id;
  description: string;
  unit: string;
  approvedQuantity: number;
  previousQuantity: number;
  currentQuantity: number;
  cumulativeQuantity: number;
  remainingQuantity: number;
  estimateValue: number;
  actualValue: number | null;
  priceVariance: number | null;
  overCertified: boolean;
}

export interface ParkPeriodResult {
  periodId: Id;
  periodLabel: string;
  currentEstimateValue: number;
  currentActualValue: number | null;
  documentDifference: number | null;
}

export interface ParkCalculationResult {
  currency: string;
  lines: ParkLineResult[];
  periods: ParkPeriodResult[];
  previousEstimateValue: number;
  currentEstimateValue: number;
  cumulativeEstimateValue: number;
  remainingEstimateValue: number;
  actualValue: number | null;
  priceVariance: number | null;
  pendingChangeEstimateValue: number;
  warnings: string[];
}

/** Forma-3 legal semantics have not been verified in the repository evidence. */
export interface Forma3UnresolvedContract {
  evidenceStatus: 'UNVERIFIED';
  code: 'FORMA3_RULE_UNRESOLVED';
  requiredEvidence: readonly string[];
  blockedOutputs: readonly ('legal_total' | 'payment_due' | 'tax_treatment')[];
}
