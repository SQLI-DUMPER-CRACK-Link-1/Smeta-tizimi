import { describe, expect, it } from 'vitest';
import { f2NativeExportRowsQur } from './f2-native-export';

describe('native F2 Excel adapteri', () => {
  it('hujjatning aniq summasini saqlaydi, qty × price bilan almashtirmaydi', () => {
    const rows = f2NativeExportRowsQur([{ qator_id: 7, obyekt_id: 2, nom: 'Beton B25', birlik: 'm3', smeta_hajm: 20, smeta_narx: 123.45, smeta_summa: 2469, fakt_hajm: 10, fakt_summa: 1234.5, f2_hajm: 0, f2_summa: 0, qoldiq_hajm: 10, qoldiq_summa: 1234.5, f2_mumkin_hajm: 10, f2_mumkin_summa: 1234.5, id: 1, tur: 'bl', kod: 'BL-7', kat: null }], [{ qatorId: 7, certifiedQuantity: 10, certifiedUnitPrice: 123.45, certifiedAmount: 1234.49, priceIntentionallyAbsent: false, rawSnapshot: { source: 'native_f2_preparation', sourceReference: 'F2 №7', enteredQuantity: 10, enteredUnitPrice: 123.45, enteredAmount: 1234.49 } }]);
    expect(rows[0].currentCertifiedValue).toBe(1234.49);
    expect(rows[0].f2ValuationValue).toBe(1234.5);
    expect(rows[0].variance).toBeCloseTo(-0.01, 6);
  });

  it('mavjud bo‘lmagan source narxini smeta narxi bilan to‘ldirmaydi', () => {
    const rows = f2NativeExportRowsQur([{ qator_id: 7, obyekt_id: 2, nom: 'Beton B25', birlik: 'm3', smeta_hajm: 20, smeta_narx: 123.45, smeta_summa: 2469, fakt_hajm: 10, fakt_summa: 1234.5, f2_hajm: 0, f2_summa: 0, qoldiq_hajm: 10, qoldiq_summa: 1234.5, f2_mumkin_hajm: 10, f2_mumkin_summa: 1234.5, id: 1, tur: 'bl', kod: 'BL-7', kat: null }], [{ qatorId: 7, certifiedQuantity: 10, priceIntentionallyAbsent: true, rawSnapshot: { source: 'native_f2_preparation', sourceReference: 'F2 №7', enteredQuantity: 10 } }]);
    expect(rows[0].currentF2ValuationPrice).toBeNull();
    expect(rows[0].currentCertifiedValue).toBeNull();
  });
});
