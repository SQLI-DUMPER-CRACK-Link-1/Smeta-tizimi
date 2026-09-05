/**
 * Performance evidence for the ported F2 engine, per T2-GAS-EXIT-001 §9
 * ("Performance"): "Test realistic datasets at 10k and 50k rows... No O(n²)
 * matcher step." This is not a micro-benchmark for its own sake — the whole
 * point of porting the engine off GAS is that GAS synchronous execution
 * hard-caps at 6 minutes; this test is the evidence that the ported engine
 * does not reintroduce a slow path that would recreate the same problem
 * somewhere else (a Cloudflare Worker has its own CPU-time limits).
 *
 * The assertions use generous ceilings (not tight timing assertions, which
 * are flaky across CI hardware) — the printed console numbers are the real
 * evidence a reviewer should read, not just the pass/fail.
 */
import { describe, expect, test } from 'vitest';
import { f2MatchEngine } from './engine';
import type { AktNode, LrvNode } from './types';

/** Deterministic synthetic LRV tree: `sectionCount` sections, each with `perSection` leaf rows spread across `bl` (work) parents with `rs` (resource) children — the shape that exercises both processBl and processStandalone. */
function buildLrvTree(sectionCount: number, perSection: number): { tree: LrvNode[]; leafCount: number } {
  let row = 1;
  let leafCount = 0;
  const tree: LrvNode[] = [];
  for (let s = 0; s < sectionCount; s++) {
    const blCount = Math.max(1, Math.floor(perSection / 4));
    const children: LrvNode[] = [];
    for (let b = 0; b < blCount; b++) {
      const blKod = `К${s}-${b}`;
      const rsChildren: LrvNode[] = [];
      for (let r = 0; r < 3; r++) {
        rsChildren.push({
          type: 'rs', kod: `Р${s}-${b}-${r}`, nom: `РЕСУРС ${s} ${b} ${r}`, birlik: 'Т',
          varaq: 'V1', row: row++,
        });
        leafCount++;
      }
      children.push({
        type: 'bl', kod: blKod, nom: `РАБОТА ${s} ${b}`, birlik: 'М3',
        varaq: 'V1', row: row++, children: rsChildren,
      });
      leafCount++;
    }
    tree.push({ type: 'rz', nom: `РАЗДЕЛ ${s}`, lokalka: 'L1', varaq: 'V1', row: 0, children });
  }
  return { tree, leafCount };
}

/** Synthetic act tree that references a fraction of the LRV codes directly (so the fast byKod path actually fires) plus some genuinely unmatched rows (so the "not found" bookkeeping path is exercised too). */
function buildAktTree(sectionCount: number, perSection: number, matchFraction: number): AktNode[] {
  let uidSeq = 0;
  const blCount = Math.max(1, Math.floor(perSection / 4));
  const out: AktNode[] = [];
  for (let s = 0; s < sectionCount; s++) {
    const children: AktNode[] = [];
    for (let b = 0; b < blCount; b++) {
      const hit = (b / blCount) < matchFraction;
      // A genuine miss must fail EVERY lookup path (kod, kanon, name+unit,
      // fuzzy) — different code, unrelated name text, different unit —
      // otherwise this only proves the byKod path is fast, not that the
      // full not-found bookkeeping (sababYoz + takliflar collection) scales.
      const kod = hit ? `К${s}-${b}` : `ORPHAN-${s}-${b}-ZZ`;
      const nom = hit ? `РАБОТА ${s} ${b}` : `СОВЕРШЕННО НЕСВЯЗАННЫЙ ТЕКСТ ${s} ${b} ZZ`;
      const bir = hit ? 'М3' : 'КОМПЛ';
      const rsChildren: AktNode[] = [];
      for (let r = 0; r < 3; r++) {
        rsChildren.push({
          uid: `u${uidSeq++}`, type: 'rs',
          kod: hit ? `Р${s}-${b}-${r}` : `ORPHAN-Р${s}-${b}-${r}-ZZ`,
          nom: hit ? `РЕСУРС ${s} ${b} ${r}` : `НЕСВЯЗАННЫЙ РЕСУРС ${s} ${b} ${r} ZZ`,
          bir: hit ? 'Т' : 'КОМПЛ', hajm: 1, narx: 10, summa: 10,
        });
      }
      children.push({
        uid: `u${uidSeq++}`, type: 'bl', kod, nom, bir,
        hajm: 1, narx: 100, summa: 100, children: rsChildren,
      });
    }
    out.push({ uid: `rz${s}`, type: 'rz', nom: `РАЗДЕЛ ${s}`, children });
  }
  return out;
}

describe('engine performance (T2-GAS-EXIT-001 §9 evidence)', () => {
  test('10,000-row LRV tree matches well under GAS 6-minute ceiling', () => {
    const { tree: lrvTree, leafCount } = buildLrvTree(220, 50);
    const aktTree = buildAktTree(220, 50, 0.7);
    expect(leafCount).toBeGreaterThanOrEqual(10_000);

    const t0 = Date.now();
    const result = f2MatchEngine(aktTree, lrvTree, { lokalka: 'L1' });
    const ms = Date.now() - t0;

    // eslint-disable-next-line no-console
    console.log(`[f2-match-engine perf] ~${leafCount} LRV leaves, ${result.stat.moslashti} matched, ${result.stat.otkazib} unmatched, ${ms} ms`);
    expect(result.stat.moslashti).toBeGreaterThan(0);
    expect(result.stat.otkazib).toBeGreaterThan(0); // must include a genuine miss rate, not just the fast-path
    expect(ms).toBeLessThan(5_000); // generous ceiling; real number is in the log line above
  });

  test('50,000-row LRV tree — the exact scale T2-GAS-EXIT-001 §5 requires a resumable job model for', () => {
    const { tree: lrvTree, leafCount } = buildLrvTree(1100, 50);
    const aktTree = buildAktTree(1100, 50, 0.7);
    expect(leafCount).toBeGreaterThanOrEqual(50_000);

    const t0 = Date.now();
    const result = f2MatchEngine(aktTree, lrvTree, { lokalka: 'L1' });
    const ms = Date.now() - t0;

    // eslint-disable-next-line no-console
    console.log(`[f2-match-engine perf] ~${leafCount} LRV leaves, ${result.stat.moslashti} matched, ${result.stat.otkazib} unmatched, ${ms} ms`);
    expect(result.stat.moslashti).toBeGreaterThan(0);
    expect(result.stat.otkazib).toBeGreaterThan(0); // must include a genuine miss rate, not just the fast-path
    // The matcher itself must stay well within a single Cloudflare Worker
    // CPU-time budget even at this scale; the 50k-row *job* (upload, parse,
    // persistence) is a separate concern the job model (§5) still owns.
    expect(ms).toBeLessThan(15_000);
  });
});
