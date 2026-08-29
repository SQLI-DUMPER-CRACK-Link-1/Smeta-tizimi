import { convertQuantity } from './unit-normalizer';
import type { EstimateResource, SelectedNorm } from './types';

/** Deterministic only: selected normative rate × explicit work quantity × approved coefficients. */
export function expandNormResources(norm: SelectedNorm, workQuantity: number, workUnit: typeof norm.workUnit, coefficients: number[] = []): EstimateResource[] {
  if (!Number.isFinite(workQuantity) || workQuantity < 0) throw new Error('Work quantity must be a non-negative finite number');
  const normalizedQuantity = convertQuantity(workQuantity, workUnit, norm.workUnit);
  const multiplier = coefficients.reduce((value, coefficient) => {
    if (!Number.isFinite(coefficient) || coefficient < 0) throw new Error('Coefficient must be a non-negative finite number');
    return value * coefficient;
  }, 1);
  return norm.resources.map(rate => ({ type: rate.type, resourceId: rate.resourceId, name: rate.name, quantity: rate.quantityPerUnit * normalizedQuantity * multiplier, unit: rate.unit, price: null, evidence: [{ kind: 'norm', value: norm.normId }] }));
}
