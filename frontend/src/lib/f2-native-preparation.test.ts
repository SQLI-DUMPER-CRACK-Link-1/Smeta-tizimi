import { describe, expect, it } from 'vitest';
import { f2NativePayloadQur } from './f2-native-preparation';

const candidate = [{ qatorId: 17, f2Mumkin: 10 }];
const input = { qatorId: 17, quantity: '10', unitPrice: '123.45', amount: '1234.49', sourceReference: 'F2 №7, 3-sahifa', priceIntentionallyAbsent: false };

describe('native F2 tayyorlash kontrakti', () => {
  it('hujjatdagi aniq summani saqlaydi va arifmetik farqni faqat belgilaydi', () => {
    const result = f2NativePayloadQur([input], candidate);
    expect(result.ok).toBe(true);
    expect(result.qatorlar[0].certifiedAmount).toBe(1234.49);
    expect(result.issues).toContainEqual({ qatorId: 17, code: 'ARITHMETIC_MISMATCH', blocking: false });
  });
  it("Fakt qoldig'idan ko'p miqdorni rad etadi", () => {
    const result = f2NativePayloadQur([{ ...input, quantity: '10.01' }], candidate);
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('QTY_EXCEEDS_FAKT');
  });
  it('smeta narxini fallback qilmaydi', () => {
    const result = f2NativePayloadQur([{ ...input, unitPrice: '', amount: '' }], candidate);
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('PRICE_REQUIRED');
  });
});

/* Egasining qoidasi (2026-09-09): «Smeta 10 kub, fakt 12 kub bo'lsa
   forma-2 ham 12 bo'lishi mumkin, faqat 2 kub uchun ogohlantirish
   berilishi kerak.» Ya'ni chegara FAKTdan, smeta esa ogohlantirish. */
describe('F2 — smetadan oshgan hajm bloklamaydi, ogohlantiradi', () => {
  const kirit = (miqdor: string) => ([{
    qatorId: 1, quantity: miqdor, unitPrice: '1000', amount: String(Number(miqdor) * 1000),
    sourceReference: 'AKT-1', priceIntentionallyAbsent: false,
  }]);

  it('smeta 10, fakt 12 -> F2 12 YOZILADI va 2 uchun ogohlantirish chiqadi', () => {
    const n = f2NativePayloadQur(kirit('12'), [{ qatorId: 1, f2Mumkin: 12, smetaHajm: 10 }]);
    expect(n.ok).toBe(true);
    expect(n.qatorlar[0].certifiedQuantity).toBe(12);
    const w = n.issues.find((i) => i.code === 'QTY_EXCEEDS_SMETA')!;
    expect(w.blocking).toBe(false);
    expect(w.oshiq).toBeCloseTo(2, 9);
  });

  it('smeta ichida qolsa ogohlantirish yo\'q', () => {
    const n = f2NativePayloadQur(kirit('8'), [{ qatorId: 1, f2Mumkin: 12, smetaHajm: 10 }]);
    expect(n.ok).toBe(true);
    expect(n.issues.filter((i) => i.code === 'QTY_EXCEEDS_SMETA')).toHaveLength(0);
  });

  it('ilgari olingan F2 ham qo\'shib hisoblanadi (6 + 6 > 10)', () => {
    const n = f2NativePayloadQur(kirit('6'), [{ qatorId: 1, f2Mumkin: 6, smetaHajm: 10, f2Olingan: 6 }]);
    expect(n.ok).toBe(true);
    expect(n.issues.find((i) => i.code === 'QTY_EXCEEDS_SMETA')?.oshiq).toBeCloseTo(2, 9);
  });

  it('FAKTdan oshsa esa BLOKLAYDI (bu boshqa qoida)', () => {
    const n = f2NativePayloadQur(kirit('13'), [{ qatorId: 1, f2Mumkin: 12, smetaHajm: 10 }]);
    expect(n.ok).toBe(false);
    expect(n.issues.some((i) => i.code === 'QTY_EXCEEDS_FAKT' && i.blocking)).toBe(true);
  });
});
