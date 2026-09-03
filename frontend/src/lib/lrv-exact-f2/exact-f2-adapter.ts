/**
 * F2 sertifikat manbasi uchun sof kontrakt.
 * Bu modul hisob-kitob qilmaydi va smeta narxiga fallback qilmaydi.
 * Yakuniy majburiy tekshiruv DB dagi t2_akt_yarat_v2 funksiyasidadir.
 */
export type CertifiedAmountProvenance = 'source_verified' | 'legacy_unproven' | 'price_intentionally_absent';

export type ExactF2Source = Readonly<{
  sourceLineId: string;
  certifiedQuantity: number;
  certifiedUnitPrice: number | null;
  certifiedAmount: number | null;
  provenance: CertifiedAmountProvenance;
}>;

export type ExactF2ReadModel = Readonly<{
  certifiedQuantity: number;
  certifiedUnitPrice: number | null;
  certifiedAmount: number | null;
  calculatedAmount: number | null;
  amountMismatch: boolean;
  provenance: CertifiedAmountProvenance;
}>;

export const MISSING_CERTIFIED_PRICE = 'MISSING_CERTIFIED_PRICE' as const;

export function assertExactF2Source(source: ExactF2Source): void {
  // Legacy qatorlarda manba dalili yo'q: ularni qayta yozish yoki soxta
  // summa bilan to'ldirish mumkin emas. Qattiq talab faqat yangi, verified
  // import kontraktiga tegishli.
  if (source.provenance === 'source_verified'
    && (source.certifiedUnitPrice === null || source.certifiedAmount === null)) {
    throw new Error(MISSING_CERTIFIED_PRICE);
  }
}

export function toExactF2ReadModel(source: ExactF2Source): ExactF2ReadModel {
  assertExactF2Source(source);
  const calculatedAmount = source.certifiedUnitPrice === null
    ? null
    : source.certifiedQuantity * source.certifiedUnitPrice;
  return Object.freeze({
    certifiedQuantity: source.certifiedQuantity,
    certifiedUnitPrice: source.certifiedUnitPrice,
    // Muhim: source amount hech qachon calculatedAmount bilan almashtirilmaydi.
    certifiedAmount: source.certifiedAmount,
    calculatedAmount,
    amountMismatch: source.certifiedAmount !== null
      && calculatedAmount !== null
      && source.certifiedAmount !== calculatedAmount,
    provenance: source.provenance,
  });
}
