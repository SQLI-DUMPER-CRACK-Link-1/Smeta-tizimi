/** Native F2 tayyorlash: faqat kanonik Fakt qoldig'i + hujjatning aniq qiymatlari. */
export type F2NativeCandidate = {
  qatorId: number;
  f2Mumkin: number;
};

export type F2NativeInput = {
  qatorId: number;
  quantity: string;
  unitPrice: string;
  amount: string;
  sourceReference: string;
  priceIntentionallyAbsent: boolean;
};

export type F2NativeIssue = {
  qatorId: number;
  code: 'QTY_INVALID' | 'QTY_EXCEEDS_FAKT' | 'SOURCE_REQUIRED' | 'PRICE_REQUIRED' | 'AMOUNT_REQUIRED' | 'ARITHMETIC_MISMATCH';
  blocking: boolean;
};

export type F2NativePayloadRow = {
  qatorId: number;
  certifiedQuantity: number;
  certifiedUnitPrice?: number;
  certifiedAmount?: number;
  priceIntentionallyAbsent: boolean;
  rawSnapshot: { source: 'native_f2_preparation'; sourceReference: string; enteredQuantity: number; enteredUnitPrice?: number; enteredAmount?: number };
};

const numberOrUndefined = (value: string) => {
  const text = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
};

/**
 * Smeta narxi bilan hech qachon to'ldirmaydi. Faqat shu F2 hujjatidan
 * qo'lda kiritilgan exact triplet DBga o'tadi.
 */
export function f2NativePayloadQur(inputs: F2NativeInput[], candidates: F2NativeCandidate[]) {
  const limits = new Map(candidates.map((candidate) => [candidate.qatorId, candidate.f2Mumkin]));
  const qatorlar: F2NativePayloadRow[] = [];
  const issues: F2NativeIssue[] = [];
  for (const input of inputs) {
    const quantity = numberOrUndefined(input.quantity);
    const unitPrice = numberOrUndefined(input.unitPrice);
    const amount = numberOrUndefined(input.amount);
    const limit = limits.get(input.qatorId);
    if (quantity == null || quantity <= 0) { issues.push({ qatorId: input.qatorId, code: 'QTY_INVALID', blocking: true }); continue; }
    if (limit == null || quantity > limit + 1e-9) { issues.push({ qatorId: input.qatorId, code: 'QTY_EXCEEDS_FAKT', blocking: true }); continue; }
    if (!input.sourceReference.trim()) { issues.push({ qatorId: input.qatorId, code: 'SOURCE_REQUIRED', blocking: true }); continue; }
    if (!input.priceIntentionallyAbsent && (unitPrice == null || unitPrice < 0)) { issues.push({ qatorId: input.qatorId, code: 'PRICE_REQUIRED', blocking: true }); continue; }
    if (!input.priceIntentionallyAbsent && amount == null) { issues.push({ qatorId: input.qatorId, code: 'AMOUNT_REQUIRED', blocking: true }); continue; }
    if (!input.priceIntentionallyAbsent && Math.abs(quantity * unitPrice! - amount!) > 0.005) {
      // Bu analitik istisno: hujjat summasi aynan o'z holicha saqlanadi.
      issues.push({ qatorId: input.qatorId, code: 'ARITHMETIC_MISMATCH', blocking: false });
    }
    qatorlar.push({
      qatorId: input.qatorId,
      certifiedQuantity: quantity,
      certifiedUnitPrice: input.priceIntentionallyAbsent ? undefined : unitPrice,
      certifiedAmount: input.priceIntentionallyAbsent ? undefined : amount,
      priceIntentionallyAbsent: input.priceIntentionallyAbsent,
      rawSnapshot: {
        source: 'native_f2_preparation', sourceReference: input.sourceReference.trim(),
        enteredQuantity: quantity,
        enteredUnitPrice: input.priceIntentionallyAbsent ? undefined : unitPrice,
        enteredAmount: input.priceIntentionallyAbsent ? undefined : amount,
      },
    });
  }
  return { qatorlar, issues, ok: qatorlar.length > 0 && !issues.some((issue) => issue.blocking) };
}
