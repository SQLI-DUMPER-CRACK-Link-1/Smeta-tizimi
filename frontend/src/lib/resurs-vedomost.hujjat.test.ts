import { describe, expect, it } from 'vitest';
import { resursVedomostHujjat } from './resurs-vedomost';
import { hujjatTekshir, imzoRollariBormi } from './hujjat-yozuvchi';
import { namunaSaqla } from './hujjat-yozuvchi/test-yordam';
import type { T2QatorHolat } from '../api/supabase';

const h = (qator_id: number, tur: string, kat: string | null, nom: string, birlik: string, sh: number, ss: number, fh: number, fs: number): T2QatorHolat => ({
  id: qator_id, qator_id, obyekt_id: 1, tur, kod: `К-${qator_id}`, nom, birlik, kat, smeta_hajm: sh, smeta_summa: ss,
  fakt_hajm: 0, fakt_summa: 0, f2_hajm: fh, f2_summa: fs, qoldiq_hajm: sh - fh, qoldiq_summa: ss - fs,
});

describe('Ресурсная ведомость — hujjat standarti', () => {
  it('ЧЕЛ→МАШ→МАТ, kategoriya va ВСЕГО SUM formulalari keshi = sahifa jamilari; imzo; chop; texnik matn yo‘q', () => {
    const rows = [
      h(1, 'mat', 'МАТ', 'ПЕСОК', 'м3', 10, 120_000, 4, 48_000),
      h(2, 'rs', 'ЧЕЛ', 'ЗАТРАТЫ ТРУДА', 'чел.-ч', 100, 2_451_770, 40, 980_708),
      h(3, 'rs', 'МАШ', 'КРАН', 'маш.-ч', 5, 977_000, 5, 977_000),
      h(4, 'mat', null, 'ПРОЧИЙ МАТЕРИАЛ', 'шт', 1, 1000, 0, 0),
      h(5, 'bl', null, 'РАБОТА — в ведомость не входит', 'м3', 1, 1, 1, 1),
    ];
    const { bytes, faylNomi } = resursVedomostHujjat(rows, { obyektNomi: 'Амфитеатр', sana: '2026-09-25' });
    namunaSaqla('resurs_vedomost.xlsx', bytes);
    expect(faylNomi).toBe('Амфитеатр_РЕСУРСНАЯ_ВЕДОМОСТЬ_2026-09-25.xlsx');
    const t = hujjatTekshir(bytes);
    expect(t.taqiqlangan).toEqual([]);
    expect(t.dollarFormulalar).toEqual([]);
    expect(t.keshsizFormulalar).toEqual([]);
    expect(imzoRollariBormi(t, ['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'СОСТАВИЛ']).yoq).toEqual([]);
    const i = (s: string) => t.matnlar.findIndex((m) => m.startsWith(s));
    expect(i('ЧЕЛ —')).toBeLessThan(i('МАШ —'));
    expect(i('МАШ —')).toBeLessThan(i('МАТ —'));
    expect(i('ПРОЧИЕ —')).toBeGreaterThan(i('МАТ —'));
    expect(t.matnlar.some((m) => m.includes('в ведомость не входит'))).toBe(false);
    const vsego = t.varaqlar[0].kataklar.filter((k) => k.f?.startsWith('SUM(F') && k.f.includes(','));
    expect(Number(vsego[0].v)).toBe(120_000 + 2_451_770 + 977_000 + 1000);
    expect(t.varaqlar[0].a4 && t.varaqlar[0].bittaEnli).toBe(true);
  });
});
