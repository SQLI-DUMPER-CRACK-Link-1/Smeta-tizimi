export type MoslashQator = {
  uid?: string;
  qator_id: number | null;
  holat: string; // 'moslandi' | 'band' | 'nomos' | ... (f2MoslashEngine's own vocabulary)
};

/**
 * Computes which new F2-row -> smeta-row bindings to apply after the
 * deterministic backend matcher (`f2MoslashEngine`, GAS-side) has run.
 *
 * SAFETY INVARIANT (P0, 2026-09): this is the ONLY path that produces an
 * automatic binding, and it binds a row IF AND ONLY IF the engine marked it
 * `holat === 'moslandi'` with a concrete `qator_id`. There is intentionally
 * NO secondary positional/index-based fallback for rows the engine left
 * unmatched.
 *
 * Before this fix, `forceMapBlChildren` (frontend/src/test02/TestF2Import.tsx)
 * paired the *remaining* children of an already-matched parent block purely
 * by array position — no name/code/unit check at all — and it ran silently
 * on every initial file load via `dvigatelniQolla(true)`. Two unrelated
 * resources that merely occupied the same position under a matched parent
 * could get bound to each other with zero evidence. That step has been
 * removed entirely: a resource the engine did not match (or that the engine
 * itself gated out on a name/code/unit mismatch) stays unmatched here. The
 * only other way to bind it is an explicit manual user action, which writes
 * directly into `qolBog` and never goes through this function.
 */
export function applyEngineBinds(
  qatorlar: MoslashQator[],
  existingBinds: Record<string, number>,
): Record<string, number> {
  const bound = new Set<number>(Object.values(existingBinds));
  const next: Record<string, number> = {};
  for (const q of qatorlar) {
    if (q.holat !== 'moslandi' || q.qator_id == null || !q.uid) continue;
    if (existingBinds[q.uid] !== undefined) continue; // human bound it — never override
    if (bound.has(q.qator_id)) continue; // smeta row already claimed
    next[q.uid] = q.qator_id;
    bound.add(q.qator_id);
  }
  return next;
}
