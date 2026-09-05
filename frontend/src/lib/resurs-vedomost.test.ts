import { describe, expect, it } from 'vitest';
import { resursVedomostKategoriyalarga, resursVedomostQur } from './resurs-vedomost';
import type { T2QatorHolat } from '../api/supabase';

function qator(p: Partial<T2QatorHolat>): T2QatorHolat {
  return {
    id: 1, qator_id: 1, obyekt_id: 1, tur: 'rs', kod: null, nom: 'Test', birlik: 'sht', kat: 'МАШ',
    smeta_hajm: 0, smeta_summa: 0, fakt_hajm: 0, fakt_summa: 0, f2_hajm: 0, f2_summa: 0,
    qoldiq_hajm: 0, qoldiq_summa: 0, ...p,
  };
}

describe('resursVedomostQur', () => {
  it('rz va bl qatorlarini o\'tkazib yuboradi, faqat rs/mat/ob jamlanadi', () => {
    const rows = [
      qator({ tur: 'rz', nom: 'Razdel 1', smeta_summa: 1000000 }),
      qator({ tur: 'bl', nom: 'Ish 1', smeta_summa: 500000 }),
      qator({ tur: 'rs', nom: 'Ekskavator', smeta_summa: 200000 }),
    ];
    const v = resursVedomostQur(rows);
    expect(v).toHaveLength(1);
    expect(v[0].nom).toBe('Ekskavator');
  });

  it('bir xil kategoriya+nom+birlikdagi resurslarni bitta qatorga jamlaydi', () => {
    const rows = [
      qator({ tur: 'mat', kat: 'МАТ', nom: 'Beton M200', birlik: 'm3', smeta_hajm: 10, smeta_summa: 1000000, f2_hajm: 4, f2_summa: 400000, qoldiq_hajm: 6, qoldiq_summa: 600000 }),
      qator({ tur: 'mat', kat: 'МАТ', nom: 'Beton M200', birlik: 'm3', smeta_hajm: 5, smeta_summa: 500000, f2_hajm: 5, f2_summa: 500000, qoldiq_hajm: 0, qoldiq_summa: 0 }),
    ];
    const v = resursVedomostQur(rows);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ smetaHajm: 15, smetaSumma: 1500000, f2Hajm: 9, f2Summa: 900000, qoldiqHajm: 6, qoldiqSumma: 600000, qatorSoni: 2 });
  });

  it('turli kategoriyadagi bir xil nomli resurslarni ARALASHTIRMAYDI', () => {
    const rows = [
      qator({ tur: 'rs', kat: 'ЧЕЛ', nom: 'Ishchi', birlik: 'chel-soat', smeta_hajm: 100, smeta_summa: 1000000 }),
      qator({ tur: 'mat', kat: 'МАТ', nom: 'Ishchi', birlik: 'chel-soat', smeta_hajm: 50, smeta_summa: 500000 }),
    ];
    const v = resursVedomostQur(rows);
    expect(v).toHaveLength(2);
  });

  it('kat bo\'sh bo\'lsa "BOSHQA" ga tushadi, jim tashlanmaydi', () => {
    const v = resursVedomostQur([qator({ tur: 'ob', kat: null, nom: 'Noma\'lum resurs', smeta_hajm: 1, smeta_summa: 1000 })]);
    expect(v).toHaveLength(1);
    expect(v[0].kat).toBe('BOSHQA');
  });

  it('kod bo\'sh birinchi qatorda, keyingi qatorda bor bo\'lsa to\'ldiradi', () => {
    const v = resursVedomostQur([
      qator({ tur: 'rs', kod: null, nom: 'X', smeta_summa: 100 }),
      qator({ tur: 'rs', kod: 'K-1', nom: 'X', smeta_summa: 200 }),
    ]);
    expect(v[0].kod).toBe('K-1');
  });
});

describe('resursVedomostKategoriyalarga', () => {
  it('kategoriya bo\'yicha guruhlaydi va jami summalarni to\'g\'ri hisoblaydi', () => {
    const rows = [
      qator({ tur: 'rs', kat: 'ЧЕЛ', nom: 'Ishchi', smeta_summa: 1000000, f2_summa: 300000, qoldiq_summa: 700000 }),
      qator({ tur: 'rs', kat: 'МАШ', nom: 'Kran', smeta_summa: 2000000, f2_summa: 500000, qoldiq_summa: 1500000 }),
      qator({ tur: 'mat', kat: 'МАШ', nom: 'Yog\'', smeta_summa: 100000, f2_summa: 0, qoldiq_summa: 100000 }),
    ];
    const kats = resursVedomostKategoriyalarga(rows);
    expect(kats.map(k => k.kat)).toEqual(['МАШ', 'ЧЕЛ']);
    const mash = kats.find(k => k.kat === 'МАШ')!;
    expect(mash.qatorlar).toHaveLength(2);
    expect(mash.jamiSmetaSumma).toBe(2100000);
    expect(mash.jamiF2Summa).toBe(500000);
    expect(mash.jamiQoldiqSumma).toBe(1600000);
  });

  it('bo\'sh kirish uchun bo\'sh natija qaytaradi (xato tashlamaydi)', () => {
    expect(resursVedomostKategoriyalarga([])).toEqual([]);
  });
});
