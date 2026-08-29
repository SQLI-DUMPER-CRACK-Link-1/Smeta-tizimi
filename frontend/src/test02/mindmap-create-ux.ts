import type { TugunTur } from '../api/t2-mindmap';

export type CreateField = { kalit: string; nom: string; majburiy?: boolean };

/** UI validation only: server contract remains the final authority. */
export function mindmapCreateValidation(
  tur: TugunTur,
  fields: CreateField[],
  values: Record<string, string>,
): string | null {
  const missing = fields.find((field) => field.majburiy && !String(values[field.kalit] || '').trim());
  if (missing) return `${missing.nom} majburiy`;
  if (tur === 'kadr' && !String(values.lavozim || '').trim()) return 'Lavozim majburiy';
  return null;
}

export function mindmapEntityNodeId(tur: TugunTur, entityId: unknown): string | null {
  const id = Number(entityId);
  return Number.isInteger(id) && id > 0 ? `${tur}:${id}` : null;
}

export const MINDMAP_ROLE_KEYS = ['zakazchik', 'bosh_pudratchi', 'subpudratchi', 'loyihachi', 'taminotchi'] as const;

export function mindmapRoleValidation(role: string): string | null {
  return MINDMAP_ROLE_KEYS.includes(role as typeof MINDMAP_ROLE_KEYS[number])
    ? null
    : 'Loyiha qatnashchisi roli tanlanishi kerak';
}
