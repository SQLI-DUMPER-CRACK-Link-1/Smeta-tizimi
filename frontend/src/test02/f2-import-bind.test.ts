import { describe, expect, it } from 'vitest';
import { applyEngineBinds, type MoslashQator } from './f2-import-bind';

describe('F2 import binding — P0: no positional auto-mapping', () => {
  it('an unmatched resource cannot bind only because array indexes align', () => {
    // Two F2 children (idx 0,1) sit under a matched parent alongside two
    // unbound smeta children at the same positions — the old
    // `forceMapBlChildren` would have paired them index-for-index with zero
    // evidence. The engine marked neither as `moslandi`.
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-child-0', qator_id: null, holat: 'nomos' },
      { uid: 'f2-child-1', qator_id: null, holat: 'nomos' },
    ];
    const result = applyEngineBinds(qatorlar, {});
    expect(result).toEqual({});
  });

  it('a name/code/unit mismatch the engine gated out stays unmatched', () => {
    // The engine itself resolved a candidate but rejected it on a unit
    // mismatch (e.g. "АРМАТУРА / Т" vs "АРМАТУРА / КГ") — it reports this as
    // anything other than 'moslandi'. That row must never be bound.
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-armatura', qator_id: 501, holat: 'birlik_mos_emas' },
      { uid: 'f2-boshqa', qator_id: 502, holat: 'moslandi' },
    ];
    const result = applyEngineBinds(qatorlar, {});
    expect(result).toEqual({ 'f2-boshqa': 502 });
    expect(result).not.toHaveProperty('f2-armatura');
  });

  it('a silent initial-load call produces exactly the engine matches — nothing extra', () => {
    // `dvigatelniQolla(true)` (jim=true) runs this on every file load without
    // user interaction. Regardless of "jim", the function only ever has one
    // code path — there is no hidden positional supplement step anymore.
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-matched', qator_id: 10, holat: 'moslandi' },
      { uid: 'f2-unmatched-a', qator_id: null, holat: 'nomos' },
      { uid: 'f2-unmatched-b', qator_id: null, holat: 'nomos' },
    ];
    const result = applyEngineBinds(qatorlar, {});
    expect(result).toEqual({ 'f2-matched': 10 });
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('never overrides an existing human-made binding', () => {
    const qatorlar: MoslashQator[] = [{ uid: 'f2-a', qator_id: 20, holat: 'moslandi' }];
    const result = applyEngineBinds(qatorlar, { 'f2-a': 999 });
    expect(result).toEqual({});
  });

  it('never double-claims a smeta row two engine rows both point to', () => {
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-a', qator_id: 30, holat: 'moslandi' },
      { uid: 'f2-b', qator_id: 30, holat: 'moslandi' },
    ];
    const result = applyEngineBinds(qatorlar, {});
    // first one wins; the second stays unmatched rather than double-binding
    expect(result).toEqual({ 'f2-a': 30 });
  });
});
