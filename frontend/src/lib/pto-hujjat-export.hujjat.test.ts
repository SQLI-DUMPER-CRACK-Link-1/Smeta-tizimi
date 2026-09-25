import { describe, expect, it } from 'vitest';
import { ptoHujjatXlsx, ptoResurslarniQur, PTO_HUJJAT_USTUNLARI, type PtoHujjat, type PtoHujjatTuri } from './pto-hujjat-export';
import { hujjatTekshir, imzoRollariBormi } from './hujjat-yozuvchi';
import { namunaSaqla } from './hujjat-yozuvchi/test-yordam';
import type { T2QatorHolat } from '../api/supabase';

const holat = (qator_id: number, tur: string, kat: string, nom: string, f2_hajm: number, f2_summa: number): T2QatorHolat => ({
  id: qator_id, qator_id, obyekt_id: 1, tur, kod: `К-${qator_id}`, nom, birlik: 'шт', kat, smeta_hajm: f2_hajm, smeta_summa: f2_summa,
  fakt_hajm: 0, fakt_summa: 0, f2_hajm, f2_summa, qoldiq_hajm: null, qoldiq_summa: null,
});

function hujjat(turi: PtoHujjatTuri, nomalum = false): PtoHujjat {
  const n = PTO_HUJJAT_USTUNLARI[turi].length;
  return {
    turi, obyekt: 'Амфитеатр', davr: '2026-07', raqam: '7/2026', buyurtmachi: 'ООО «Заказчик»',
    qatorlar: [
      { no: 0, kod: '', nom: 'РАЗДЕЛ 1. ВОДОПРОВОД', birlik: '', qiymatlar: Array(n).fill(null), bolim: true },
      { no: 1, kod: 'Е16-4-5-1', nom: 'ПРОКЛАДКА ТРУБОПРОВОДОВ Д-20ММ', birlik: '100 м', qiymatlar: Array.from({ length: n }, (_, i) => (i + 1) * 10) },
      { no: 2, kod: 'Е16-4-5-2', nom: 'ПРОКЛАДКА ТРУБОПРОВОДОВ Д-25ММ', birlik: '100 м', qiymatlar: Array.from({ length: n }, (_, i) => (nomalum && i === n - 1 ? null : (i + 1) * 5)), ogohlantirish: 'объем превышает сметный на 2 м' },
    ],
    resurslar: ptoResurslarniQur([holat(1, 'rs', 'ЧЕЛ', 'ЗАТРАТЫ ТРУДА', 10, 245_177), holat(2, 'mat', 'МАТ', 'ТРУБА', 100, 607_100)]),
  };
}

describe('PTO hujjat eksporti — hujjat standarti', () => {
  for (const turi of ['forma2', 'nakopitelniy', 'slichitelniy', 'forma3', 'm29'] as PtoHujjatTuri[]) {
    it(`${turi}: texnik matn yo‘q, $ yo‘q, kesh bor, imzo, chop (H2–H9)`, async () => {
      const bytes = await ptoHujjatXlsx(hujjat(turi));
      namunaSaqla(`pto_${turi}.xlsx`, bytes);
      const t = hujjatTekshir(bytes);
      expect(t.taqiqlangan).toEqual([]);
      expect(t.dollarFormulalar).toEqual([]);
      expect(t.keshsizFormulalar).toEqual([]);
      expect(imzoRollariBormi(t, ['ЗАКАЗЧИК', 'ПОДРЯДЧИК']).yoq).toEqual([]);
      for (const v of t.varaqlar) expect(v.a4 && v.bittaEnli && !!v.printArea && !!v.printTitles).toBe(true);
      expect(t.matnlar.some((m) => m.startsWith('ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ (1)'))).toBe(true);
      if (turi === 'forma3') expect(t.matnlar.some((m) => m.startsWith('Итог формы № 3 не подводится'))).toBe(true);
    });
  }

  it('H7: pul qiymati noma‘lum qator — ИТОГО bo‘sh (0 emas)', async () => {
    const t = hujjatTekshir(await ptoHujjatXlsx(hujjat('forma2', true)));
    const itogo = t.varaqlar[0].kataklar.find((k) => k.f?.startsWith('IF(COUNTBLANK('));
    expect(itogo?.v).toBe('');
  });
});
