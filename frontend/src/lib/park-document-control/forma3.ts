import type { Forma3UnresolvedContract } from './types';

/** No legal/payment calculation is allowed until an authoritative Forma-3 source is mapped. */
export const forma3Unresolved: Forma3UnresolvedContract = {
  evidenceStatus: 'UNVERIFIED', code: 'FORMA3_RULE_UNRESOLVED',
  requiredEvidence: ['approved Forma-3 template and country/contract pack', 'input lineage to F2/contract/change order', 'legal payment/tax and retention treatment'],
  blockedOutputs: ['legal_total', 'payment_due', 'tax_treatment'],
};
