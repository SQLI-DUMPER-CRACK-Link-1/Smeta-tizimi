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
  return certified.flatMap((current) => {
    const row = holat.get(current.qatorId);
    if (!row) return [];
    const previousQuantity = Number(row.f2_hajm) || 0;
    const previousCertifiedValue = Number.isFinite(Number(row.f2_summa)) ? Number(row.f2_summa) : null;
    const currentCertifiedValue = current.certifiedAmount ?? null;
    const calculated = current.certifiedUnitPrice == null ? null : current.certifiedQuantity * current.certifiedUnitPrice;
    return [{
      lineId: String(current.qatorId), sectionId: String(row.obyekt_id), description: row.nom, unit: row.birlik || '',
      baselineQuantity: Number(row.smeta_hajm) || 0, baselineReferencePrice: Number(row.smeta_narx) || 0,
      approvedChangeQuantity: 0, approvedEntitlementQuantity: Number(row.smeta_hajm) || 0,
      previousQuantity, currentQuantity: current.certifiedQuantity, cumulativeQuantity: previousQuantity + current.certifiedQuantity,
      remainingQuantity: Math.max(0, (Number(row.smeta_hajm) || 0) - (Number(row.fakt_hajm) || 0)),
      previousValue: previousCertifiedValue ?? 0, currentValue: currentCertifiedValue ?? 0,
      cumulativeValue: previousCertifiedValue == null || currentCertifiedValue == null ? 0 : previousCertifiedValue + currentCertifiedValue,
      remainingValue: Number(row.qoldiq_summa) || 0,
      previousCertifiedValue, currentCertifiedValue,
      cumulativeCertifiedValue: previousCertifiedValue == null || currentCertifiedValue == null ? null : previousCertifiedValue + currentCertifiedValue,
      currentF2ValuationPrice: current.certifiedUnitPrice ?? null, f2ValuationValue: calculated,
      actualValue: null, variance: calculated == null || currentCertifiedValue == null ? null : currentCertifiedValue - calculated,
      changeKinds: [], revisionIds: [], warnings: calculated != null && currentCertifiedValue != null && Math.abs(calculated - currentCertifiedValue) > 0.005 ? ['PRICE_VARIANCE'] : [],
    }];
  });
}
