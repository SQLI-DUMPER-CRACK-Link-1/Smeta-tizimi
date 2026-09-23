import { describe, expect, it } from 'vitest';
import { faktTaalluqliIdlar, holatlarniAlmashtir } from './fakt-yangilash';
import type { T2QatorHolat } from '../api/supabase';

// rz1 ─ rz2 ─ bl3 ─ rs4, rs5 ;  rz1 ─ bl6 ─ rs7
const ROWS = [
  { id: 1, ota_id: null }, { id: 2, ota_id: 1 }, { id: 3, ota_id: 2 },
  { id: 4, ota_id: 3 }, { id: 5, ota_id: 3 }, { id: 6, ota_id: 1 }, { id: 7, ota_id: 6 },
];

function holat(qator_id: number, fakt_hajm: number): T2QatorHolat {
  return {
    id: qator_id, qator_id, obyekt_id: 1, tur: null, kod: null, nom: null, birlik: null, kat: null,
    smeta_hajm: null, smeta_summa: null, fakt_hajm, fakt_summa: 0, f2_hajm: 0, f2_summa: 0,
    qoldiq_hajm: null, qoldiq_summa: null,
  };
}

describe('faktTaalluqliIdlar', () => {
  it('tugun + barcha ota-bobolar + barcha avlodlar; begona shox kirmaydi', () => {
    expect(faktTaalluqliIdlar(ROWS, 3)!.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(faktTaalluqliIdlar(ROWS, 7)!.sort()).toEqual([1, 6, 7]);
  });

  it('chegaradan oshsa null (chaqiruvchi to\'liq holatni o\'qiydi)', () => {
    expect(faktTaalluqliIdlar(ROWS, 1, 3)).toBeNull();
  });

  it('noma\'lum qator — null; ota sikli osilib qolmaydi', () => {
    expect(faktTaalluqliIdlar(ROWS, 99)).toBeNull();
    expect(faktTaalluqliIdlar([{ id: 1, ota_id: 2 }, { id: 2, ota_id: 1 }], 1)!.sort()).toEqual([1, 2]);
  });
});

describe('holatlarniAlmashtir', () => {
  it('faqat kelganlari almashadi, tartib saqlanadi, yangisi oxiriga qo\'shiladi', () => {
    const eski = [holat(1, 0), holat(2, 0), holat(3, 0)];
    const chiq = holatlarniAlmashtir(eski, [holat(2, 5), holat(9, 1)]);
    expect(chiq.map((h) => [h.qator_id, h.fakt_hajm])).toEqual([[1, 0], [2, 5], [3, 0], [9, 1]]);
    expect(eski[1].fakt_hajm).toBe(0); // asl massiv o'zgarmaydi
  });
});
