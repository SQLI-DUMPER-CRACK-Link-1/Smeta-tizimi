import type { ProgressLineResult } from './construction-document-control';
import type { F2NativePayloadRow } from './f2-native-preparation';
import type { QatorHolat } from '../api/t2-fakt';

/**
 * Native F2 qoralamasini mavjud rasmiy Excel proyeksiyasiga o‘giradi.
 * Bu adapter hisob-kitob manbai emas: u certifiedAmount ni qayta
 * hisoblamaydi va smeta narxini source F2 narxi o‘rniga qo‘ymaydi.
 */
export function f2NativeExportRowsQur(qatorlar: readonly QatorHolat[], certified: readonly F2NativePayloadRow[]): ProgressLineResult[] {
  const holat = new Map(qatorlar.map((row) => [row.qator_id, row]));
  const nullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return certified.flatMap((current) => {
    const row = holat.get(current.qatorId);
    if (!row) return [];
    const baselineQuantity = nullableNumber(row.smeta_hajm);
    const baselineReferencePrice = nullableNumber(row.smeta_narx);
    const previousQuantity = Number(row.f2_hajm) || 0;
    const previousCertifiedValue = Number.isFinite(Number(row.f2_summa)) ? Number(row.f2_summa) : null;
    const currentCertifiedValue = current.certifiedAmount ?? null;
    const calculated = current.certifiedUnitPrice == null ? null : current.certifiedQuantity * current.certifiedUnitPrice;
    const approvedEntitlementQuantity = baselineQuantity === null ? null : baselineQuantity;
    const cumulativeQuantity = previousQuantity + current.certifiedQuantity;
    const remainingQuantity = nullableNumber(row.qoldiq_hajm);
    const cumulativeValue = previousCertifiedValue == null || currentCertifiedValue == null ? null : previousCertifiedValue + currentCertifiedValue;
    const remainingValue = nullableNumber(row.qoldiq_summa);
    const warnings = [
      ...(calculated != null && currentCertifiedValue != null && Math.abs(calculated - currentCertifiedValue) > 0.005 ? ['PRICE_VARIANCE' as const] : []),
      ...(baselineQuantity === null ? ['MISSING_BASELINE_QUANTITY' as const] : []),
      ...(baselineReferencePrice === null ? ['MISSING_BASELINE_PRICE' as const] : []),
    ];
    return [{
      lineId: String(current.qatorId), sectionId: String(row.obyekt_id), description: row.nom, unit: row.birlik || '',
      baselineQuantity, baselineReferencePrice,
      approvedChangeQuantity: 0, approvedEntitlementQuantity,
      previousQuantity, currentQuantity: current.certifiedQuantity, cumulativeQuantity,
      remainingQuantity,
      previousValue: previousCertifiedValue, currentValue: currentCertifiedValue,
      cumulativeValue,
      remainingValue,
      previousCertifiedValue, currentCertifiedValue,
      cumulativeCertifiedValue: previousCertifiedValue == null || currentCertifiedValue == null ? null : previousCertifiedValue + currentCertifiedValue,
      currentF2ValuationPrice: current.certifiedUnitPrice ?? null, f2ValuationValue: calculated,
      actualValue: null, variance: calculated == null || currentCertifiedValue == null ? null : currentCertifiedValue - calculated,
      changeKinds: [], revisionIds: [], warnings,
    }];
  });
}
