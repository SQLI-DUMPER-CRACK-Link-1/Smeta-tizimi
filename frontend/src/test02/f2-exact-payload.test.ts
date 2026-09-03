import { describe, expect, it } from 'vitest';
import {
  f2AggregatsiyaQator,
  f2ExactPayloadQur,
  type F2ExactManbaTugun,
} from './f2-exact-payload';

describe('F2 exact-source aggregation — merge by qator_id', () => {
  it('sums hajm and summa across multiple F2 rows bound to the same smeta row', () => {
    const nodes: F2ExactManbaTugun[] = [
      { uid: 'a', hajm: 10, narx: 123.45, summa: 1234.5 },
      { uid: 'b', hajm: 5, narx: 123.45, summa: 617.25 },
    ];
    const rows = f2AggregatsiyaQator(nodes, () => 900);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ qator_id: 900, hajm: 15, summa: 1851.75, summaBor: true, narx: 123.45 });
  });

  it('unbound nodes (getSmetaId returns null/undefined) are dropped, not aggregated into row 0', () => {
    const nodes: F2ExactManbaTugun[] = [
      { uid: 'bound', hajm: 10, narx: 100, summa: 1000 },
      { uid: 'unbound', hajm: 999, narx: 1, summa: 999 },
    ];
    const rows = f2AggregatsiyaQator(nodes, (uid) => (uid === 'bound' ? 5 : null));
    expect(rows).toHaveLength(1);
    expect(rows[0].qator_id).toBe(5);
    expect(rows[0].hajm).toBe(10);
  });

  it('summaBor stays false when every merged fragment has zero/missing summa, even with a real hajm', () => {
    const nodes: F2ExactManbaTugun[] = [
      { uid: 'a', hajm: 3, narx: null, summa: 0 },
      { uid: 'b', hajm: 2, narx: null, summa: undefined },
    ];
    const rows = f2AggregatsiyaQator(nodes, () => 1);
    expect(rows[0]).toMatchObject({ hajm: 5, summa: 0, summaBor: false });
  });

  it('a zero-or-negative source narx is treated as "no price" (undefined), never coerced to 0', () => {
    const nodes: F2ExactManbaTugun[] = [{ uid: 'a', hajm: 1, narx: 0, summa: 0 }];
    const rows = f2AggregatsiyaQator(nodes, () => 1);
    expect(rows[0].narx).toBeUndefined();
  });
});

describe('F2 exact payload — NEEDS_REVIEW ambiguity guard (never fabricates qty*narx)', () => {
  it('a row with a price but no source summa blocks the whole batch (fail-closed, no partial write)', () => {
    const rows = f2AggregatsiyaQator(
      [
        { uid: 'ok', hajm: 10, narx: 100, summa: 1000 },
        { uid: 'ambiguous', hajm: 5, narx: 50, summa: 0 }, // narx bor, summa yo'q
      ],
      (uid) => (uid === 'ok' ? 1 : 2),
    );
    const natija = f2ExactPayloadQur(rows);
    expect(natija.ok).toBe(false);
    if (!natija.ok) {
      expect(natija.sabab).toBe('NEEDS_REVIEW');
      expect(natija.noaniqSoni).toBe(1);
      expect(natija.noaniqQatorIdlar).toEqual([2]);
    }
  });

  it('a row with no price at all is fine (price_intentionally_absent) — not ambiguous', () => {
    const rows = f2AggregatsiyaQator([{ uid: 'a', hajm: 10, narx: null, summa: 0 }], () => 1);
    const natija = f2ExactPayloadQur(rows);
    expect(natija.ok).toBe(true);
    if (natija.ok) {
      expect(natija.qatorlar[0]).toMatchObject({
        qatorId: 1,
        certifiedQuantity: 10,
        certifiedUnitPrice: undefined,
        certifiedAmount: undefined,
        priceIntentionallyAbsent: true,
      });
    }
  });

  it('the worked example (qty=10, price=123.45, source amount=1234.49) is carried through verbatim, not recomputed', () => {
    // 10 * 123.45 = 1234.50 -- ONE cent off the real source amount below.
    // The certified amount must stay 1234.49 (the F2 document's own figure),
    // never silently corrected to the arithmetic product.
    const rows = f2AggregatsiyaQator([{ uid: 'a', hajm: 10, narx: 123.45, summa: 1234.49 }], () => 1);
    const natija = f2ExactPayloadQur(rows);
    expect(natija.ok).toBe(true);
    if (natija.ok) {
      expect(natija.qatorlar[0].certifiedAmount).toBe(1234.49);
      expect(natija.qatorlar[0].certifiedQuantity * (natija.qatorlar[0].certifiedUnitPrice ?? 0)).not.toBe(
        natija.qatorlar[0].certifiedAmount,
      );
    }
  });

  it('an all-clear batch maps every row into the v2 RPC shape', () => {
    const rows = f2AggregatsiyaQator(
      [
        { uid: 'a', hajm: 10, narx: 100, summa: 1000 },
        { uid: 'b', hajm: 20, narx: null, summa: null },
      ],
      (uid) => (uid === 'a' ? 1 : 2),
    );
    const natija = f2ExactPayloadQur(rows);
    expect(natija.ok).toBe(true);
    if (natija.ok) {
      expect(natija.qatorlar).toHaveLength(2);
      expect(natija.qatorlar.find((q) => q.qatorId === 1)).toMatchObject({
        certifiedQuantity: 10, certifiedUnitPrice: 100, certifiedAmount: 1000, priceIntentionallyAbsent: false,
      });
      expect(natija.qatorlar.find((q) => q.qatorId === 2)).toMatchObject({
        certifiedQuantity: 20, priceIntentionallyAbsent: true,
      });
    }
  });
});
