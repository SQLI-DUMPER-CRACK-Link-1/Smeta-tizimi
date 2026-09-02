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

// Named cases from the Codex final-release audit (checked against a
// pre-fix SHA, 9c943e4 — the fix above already lands at 2450ece; these
// cases are added for direct 1:1 traceability against that audit report).
describe('F2 import binding — audit cases (Cement/Armatura swap etc.)', () => {
  it('CASE 1: two unmatched children with SWAPPED counterpart order never bind positionally', () => {
    // F2 unmatched children: [Cement, Armatura]; Smeta unmatched children in
    // the opposite order: [Armatura, Cement]. The old forceMapBlChildren
    // would have paired index 0<->0 (Cement<->Armatura) and 1<->1
    // (Armatura<->Cement) — both wrong. The engine did not match either.
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-cement', qator_id: null, holat: 'nomos' },
      { uid: 'f2-armatura', qator_id: null, holat: 'nomos' },
    ];
    const result = applyEngineBinds(qatorlar, {});
    expect(result).toEqual({});
  });

  it('CASE 2: same child count, completely different names/codes/units — no binding', () => {
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-cement-500kg', qator_id: null, holat: 'nomos' },
      { uid: 'f2-armatura-a500-12mm', qator_id: null, holat: 'nomos' },
    ];
    const result = applyEngineBinds(qatorlar, {});
    expect(result).toEqual({});
  });

  it('CASE 3: reordering the input between calls does not change canonical mappings (keyed by uid, not position)', () => {
    const forward: MoslashQator[] = [
      { uid: 'f2-cement', qator_id: 71, holat: 'moslandi' },
      { uid: 'f2-armatura', qator_id: 72, holat: 'moslandi' },
    ];
    const reversed: MoslashQator[] = [...forward].reverse();
    expect(applyEngineBinds(forward, {})).toEqual(applyEngineBinds(reversed, {}));
    expect(applyEngineBinds(reversed, {})).toEqual({ 'f2-cement': 71, 'f2-armatura': 72 });
  });

  it('CASE 4: silent initial load creates zero positional bindings (only engine matches)', () => {
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-matched', qator_id: 90, holat: 'moslandi' },
      { uid: 'f2-cement', qator_id: null, holat: 'nomos' },
      { uid: 'f2-armatura', qator_id: null, holat: 'nomos' },
    ];
    // jim=true (silent load) and jim=false use the identical code path —
    // there is no separate "silent" branch that supplements with positional
    // guesses, so a single call is sufficient to prove this.
    const result = applyEngineBinds(qatorlar, {});
    expect(result).toEqual({ 'f2-matched': 90 });
  });

  it('CASE 5: an explicit manual user mapping (stable uid -> qator_id) remains valid and is never touched', () => {
    const manual = { 'f2-cement': 55 };
    const qatorlar: MoslashQator[] = [
      { uid: 'f2-cement', qator_id: 999, holat: 'moslandi' }, // engine now also thinks it knows better
      { uid: 'f2-armatura', qator_id: 56, holat: 'moslandi' },
    ];
    const result = applyEngineBinds(qatorlar, manual);
    expect(result).toEqual({ 'f2-armatura': 56 }); // cement's manual bind is left alone, not overridden
  });
});
