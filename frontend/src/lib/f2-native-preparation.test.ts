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
