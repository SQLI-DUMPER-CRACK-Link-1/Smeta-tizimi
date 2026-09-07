import { describe, expect, it } from 'vitest';
import { sbT2TreeQur, type T2Qator, type T2QatorHolat } from './supabase';

describe('kanonik LRV daraxti', () => {
  it('tasdiqlangan F2 va Fakt–F2 mumkin qiymatini qator holatidan saqlaydi', () => {
    const qator = {
      id: 101, obyekt_id: 7, kompaniya_id: 3, ota_id: null, daraja: 0, tartib: 1,
      tur: 'bl', kod: '01', nom: 'Beton', birlik: 'm3', hajm: 100, narx: 50,
      summa: 5000, kat: null, narx_usul: null, qoshimcha: false, zamena: false,
      d1: null, d2: null, d3: null, xom_qator: null, yangilandi: null,
      manba_id: null, versiya: 1, raqam: null, norma: null, obyekt: 'Amfiteatr',
    } as T2Qator;
    const holat = {
      id: 1, qator_id: 101, obyekt_id: 7, tur: 'bl', kod: '01', nom: 'Beton',
      birlik: 'm3', kat: null, smeta_hajm: 100, smeta_summa: 5000,
      fakt_hajm: 60, fakt_summa: 3000, f2_hajm: 25, f2_summa: 1249.99,
      qoldiq_hajm: 40, qoldiq_summa: 2000, f2_mumkin_hajm: 35,
      f2_mumkin_summa: 1750, f2_narx: 50, fakt_narx: 50,
      f2_narx_farq_foiz: 0,
    } as T2QatorHolat;

    const [node] = sbT2TreeQur([qator], [holat]);

    expect(node).toMatchObject({
      id: 101,
      fakt: 60,
      qoldiq: 40,
      faktHajm: 60,
      f2ol: 25,
      f2mum: 35,
      stFakt: 3000,
      stF2: 1249.99,
      stOst: 2000,
    });
  });

  it('manba qiymati yo‘q bo‘lsa uni nolga aylantirmaydi', () => {
    const qator = {
      id: 202, obyekt_id: 8, kompaniya_id: 3, ota_id: null, daraja: 0, tartib: 1,
      tur: 'rz', kod: null, nom: 'Noma’lum smeta', birlik: null, hajm: null, narx: null,
      summa: null, kat: null, narx_usul: null, qoshimcha: false, zamena: false,
      d1: null, d2: null, d3: null, xom_qator: null, yangilandi: null,
      manba_id: null, versiya: 1, raqam: null, norma: null, obyekt: 'Sinov',
    } as T2Qator;
    const holat = {
      id: 2, qator_id: 202, obyekt_id: 8, tur: 'rz', kod: null, nom: 'Noma’lum smeta',
      birlik: null, kat: null, smeta_hajm: null, smeta_summa: null,
      fakt_hajm: 0, fakt_summa: 0, f2_hajm: 0, f2_summa: 0,
      qoldiq_hajm: null, qoldiq_summa: null, f2_mumkin_hajm: 0,
      f2_narx: null, fakt_narx: null,
      f2_narx_farq_foiz: null,
    } as T2QatorHolat;

    const [node] = sbT2TreeQur([qator], [holat]);

    expect(node.id).toBe(202);
    expect(node.smetaHajm).toBeNull();
    expect(node.smeta).toBeNull();
    expect(node.narx).toBeNull();
    expect(node.qoldiq).toBeNull();
    expect(node.qoldiqSumma).toBeNull();
  });
});
