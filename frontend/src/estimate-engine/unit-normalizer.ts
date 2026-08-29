import type { QuantityUnit } from './types';

const ALIASES: Record<string, QuantityUnit> = {
  kg: 'kg', 'кг': 'kg', kilogram: 'kg', kilogramm: 'kg', t: 't', ton: 't', тонна: 't',
  m3: 'm3', 'm³': 'm3', 'м3': 'm3', 'м³': 'm3', kub: 'm3', куб: 'm3',
  m2: 'm2', 'm²': 'm2', 'м2': 'm2', 'м²': 'm2', m: 'm', 'м': 'm',
  pcs: 'pcs', dona: 'pcs', sht: 'pcs', 'шт': 'pcs', 'machine-hour': 'machine-hour',
  'mash-soat': 'machine-hour', 'маш-ч': 'machine-hour', 'labor-hour': 'labor-hour',
  'ishchi-soat': 'labor-hour', 'чел-ч': 'labor-hour',
};
const DIMENSION: Record<QuantityUnit, string> = { kg: 'mass', t: 'mass', m3: 'volume', m2: 'area', m: 'length', pcs: 'count', 'machine-hour': 'machine-time', 'labor-hour': 'labor-time' };
const BASE: Record<QuantityUnit, number> = { kg: 1, t: 1000, m3: 1, m2: 1, m: 1, pcs: 1, 'machine-hour': 1, 'labor-hour': 1 };

export function normalizeUnit(raw: string): QuantityUnit | null { return ALIASES[raw.trim().toLowerCase()] ?? null; }
export function convertQuantity(value: number, from: QuantityUnit, to: QuantityUnit): number {
  if (!Number.isFinite(value)) throw new Error('Quantity must be finite');
  if (DIMENSION[from] !== DIMENSION[to]) throw new Error(`Incompatible units: ${from} -> ${to}`);
  return value * BASE[from] / BASE[to];
}
