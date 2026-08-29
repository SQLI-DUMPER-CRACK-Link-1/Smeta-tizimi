/** Shared cross-view mutation contract. Components use this event instead of
 * inventing a second cache or trusting temporary graph nodes. */
export type EntityType = 'loyiha' | 'shartnoma' | 'kontragent' | 'sklad' | 'texnika' | 'kadr' | 'zayavka' | 'obyekt';

export type EntityCommandResult = {
  ok: boolean;
  entity_id?: number;
  version?: number;
  error?: string;
  [key: string]: unknown;
};

const EVENT = 't2:entity-changed';

export function entityIdFromResult(result: unknown, type: EntityType): number | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  const keys = [`${type}_id`, 'entity_id', 'qator_id', 'id'];
  for (const key of keys) {
    const n = Number(r[key]);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return undefined;
}

export function emitEntityChanged(type: EntityType, id: number, kompaniyaId: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { type, id, kompaniyaId } }));
}

export function onEntityChanged(listener: (event: CustomEvent<{ type: EntityType; id: number; kompaniyaId: number }>) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = listener as EventListener;
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export async function trackEntityCommand<T>(type: EntityType, kompaniyaId: number, command: Promise<T>): Promise<T> {
  const result = await command;
  const id = entityIdFromResult(result, type);
  if ((result as Record<string, unknown> | null)?.ok && id) emitEntityChanged(type, id, kompaniyaId);
  return result;
}
