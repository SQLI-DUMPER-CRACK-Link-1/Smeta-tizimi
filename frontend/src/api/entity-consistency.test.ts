import { describe, expect, it } from 'vitest';
import { entityIdFromResult } from './entity-consistency';

describe('shared entity command identity', () => {
  it('prefers the typed entity id returned by each backend command', () => {
    expect(entityIdFromResult({ loyiha_id: 44, id: 99 }, 'loyiha')).toBe(44);
    expect(entityIdFromResult({ id: 17 }, 'sklad')).toBe(17);
    expect(entityIdFromResult({ qator_id: 8 }, 'zayavka')).toBe(8);
  });

  it('does not manufacture a temporary id', () => {
    expect(entityIdFromResult({ ok: true }, 'texnika')).toBeUndefined();
    expect(entityIdFromResult(null, 'kadr')).toBeUndefined();
  });
});
