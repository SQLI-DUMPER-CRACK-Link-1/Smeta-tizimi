import { describe, expect, it } from 'vitest';
import { ostatkaHujjatModeli, ostatkaHujjatXlsx } from './ostatka-export';
import { hujjatTekshir, imzoRollariBormi } from './hujjat-yozuvchi';
import { namunaSaqla } from './hujjat-yozuvchi/test-yordam';
import type { T2Qator, T2QatorHolat } from '../api/supabase';

function q(id: number, ota_id: number | null, tur: string, hajm: number | null, extra: Partial<T2Qator> = {}): T2Qator {
  return {
    id, obyekt_id: 1, obyekt: 'X', kompaniya_id: 1, ota_id, daraja: 0, tartib: id, tur, kod: 'К' + id, nom: 'Позиция ' + id,
    birlik: 'м3', hajm, narx: 1000, summa: null, kat: tur === 'rs' ? 'МАТ' : null, narx_usul: null, qoshimcha: false, zamena: false,
    d1: null, d2: null, d3: null, xom_qator: id, yangilandi: null, manba_id: null, versiya: 1, raqam: null, norma: null, ...extra,
  };
}
function h(qator_id: number, fakt_hajm: number): T2QatorHolat {
  return {
    id: qator_id, qator_id, obyekt_id: 1, tur: null, kod: null, nom: null, birlik: null, kat: null, smeta_hajm: null,
    smeta_summa: null, fakt_hajm, fakt_summa: 0, f2_hajm: 0, f2_summa: 0, qoldiq_hajm: null, qoldiq_summa: null,
  };
}

// ОЗЕРА(1) → КАНАЛ 1(2) → bl3 ЗАСЫПКА (10, fakt 4) → rs4 ТРУД (20, fakt 8), mat5 ПЕСОК (5, fakt 5 — tugagan)
//          → bl6 (3, fakt 5 — oshib ketgan)
// ПАРК(8) → bl9 (4, fakt 1) → rs10 (8, fakt 2, narx 1234,567)
const TOZA = [
  q(1, null, 'rz', null, { nom: 'СМЕТА № 01-01 ОЗЕРА' }), q(2, 1, 'rz', null, { nom: 'РАЗДЕЛ 1. КАНАЛ 1' }),
  q(3, 2, 'bl', 10, { nom: 'ЗАСЫПКА ПАЗУХ' }), q(4, 3, 'rs', 20, { nom: 'ЗАТРАТЫ ТРУДА', birlik: 'чел.-ч', kat: 'ЧЕЛ', narx: 25_000 }),
  q(5, 3, 'mat', 5, { nom: 'ПЕСОК' }),
  q(6, 1, 'bl', 3, { nom: 'ПЕРЕВЫПОЛНЕННАЯ РАБОТА' }), q(7, 6, 'mat', 3),
  q(8, null, 'rz', null, { nom: 'СМЕТА № 02-01 ПАРК' }), q(9, 8, 'bl', 4, { nom: 'УКЛАДКА ПЛИТКИ' }),
  q(10, 9, 'mat', 8, { nom: 'ПЛИТКА', birlik: 'м2', narx: 1234.567 }),
];
const TOZA_H = [h(3, 4), h(4, 8), h(5, 5), h(6, 5), h(7, 5), h(9, 1), h(10, 2)];

describe('Ostatka — rasmiy hujjat (H1–H9)', () => {
  it('model: ichma-ich RZ, bl → resurs, ИТОГО, ВСЕГО; tugagan/oshib ketgan kirmaydi', () => {
    const m = ostatkaHujjatModeli(TOZA, TOZA_H);
    expect(m.qatorlar.map((r) => [r.tur, r.nom, r.ostatkaHajm, r.summa])).toEqual([
      ['rz', 'СМЕТА № 01-01 ОЗЕРА', null, 300_000],
      ['rz', 'РАЗДЕЛ 1. КАНАЛ 1', null, 300_000],
      ['bl', 'ЗАСЫПКА ПАЗУХ', 6, 300_000],
      ['barg', 'ЗАТРАТЫ ТРУДА', 12, 300_000],
      ['itogo', 'ИТОГО ПО РАЗДЕЛУ: РАЗДЕЛ 1. КАНАЛ 1', null, 300_000],
      ['itogo', 'ИТОГО ПО РАЗДЕЛУ: СМЕТА № 01-01 ОЗЕРА', null, 300_000],
      ['rz', 'СМЕТА № 02-01 ПАРК', null, 7407.4],
      ['bl', 'УКЛАДКА ПЛИТКИ', 3, 7407.4],
      ['barg', 'ПЛИТКА', 6, 7407.4],
      ['itogo', 'ИТОГО ПО РАЗДЕЛУ: СМЕТА № 02-01 ПАРК', null, 7407.4],
    ]);
    expect(m.jami).toBe(307_407.4);
    expect(m.oshibKetgan.map((x) => x.nom)).toEqual(['Позиция 7']);
    expect(m.barglar).toBe(2);
    expect(m.qatorlar[2].narx).toBe(50_000); // bl birlik narxi = 300 000 / 6
  });

  it('hujjat standarti: sarlavha, raqamlash, chop, imzo, $ yo‘q, kesh = model, texnik matn yo‘q', () => {
    const m = ostatkaHujjatModeli(TOZA, TOZA_H);
    const { bytes, faylNomi } = ostatkaHujjatXlsx(m, { obyektNomi: 'Янги Узбекистан — Озеро', sana: '2026-09-25', imzo: { pudratchi: 'ООО «Пудратчи»' } });
    namunaSaqla('ostatka_toza.xlsx', bytes);
    expect(faylNomi).toBe('Янги Узбекистан — Озеро_ОСТАТОК_РАБОТ_2026-09-25.xlsx');
    const t = hujjatTekshir(bytes);
    const [v] = t.varaqlar;
    expect(v.a4 && v.bittaEnli).toBe(true);
    expect(v.printArea).toMatch(/^'Остаток работ'!\$A\$1:\$I\$\d+$/);
    expect(v.printTitles).toMatch(/^'Остаток работ'!\$\d+:\$\d+$/);
    expect(t.fullCalcOnLoad).toBe(true);
    expect(t.dollarFormulalar).toEqual([]);
    expect(t.keshsizFormulalar).toEqual([]);
    expect(t.taqiqlangan).toEqual([]);
    expect(t.matnlar).toEqual(expect.arrayContaining(['ВЕДОМОСТЬ ОСТАТКА РАБОТ', 'КОЛИЧЕСТВО', 'ВСЕГО ОСТАТОК РАБОТ ПО ОБЪЕКТУ', 'ООО «Пудратчи»', 'Янги Узбекистан — Озеро']));
    expect(imzoRollariBormi(t, ['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'СОСТАВИЛ'])).toEqual({ yoq: [], podpis: true });
    // 1 | 2 | … | 9 raqamlash qatori (yashirin texnik ustun raqamlanmaydi).
    const raqam = v.kataklar.filter((k) => /^[A-J]\d+$/.test(k.ref) && Number(k.ref.slice(1)) === Number(v.printTitles!.split('$').pop()));
    expect(raqam.map((k) => k.v)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', null]);
    // UI == Excel: ВСЕГО katagining keshlangan qiymati = model.jami.
    const vsego = v.kataklar.find((k) => k.f?.startsWith('IF(J') && k.f.includes('SUM(I') && Number(k.v) === m.jami);
    expect(vsego).toBeTruthy();
    expect(t.matnlar.some((s) => s.startsWith('ВЫПОЛНЕНО СВЕРХ СМЕТНОГО ОБЪЕМА (1)'))).toBe(true);
  });

  it('H7: narx yoki fakt noma‘lum — summa bo‘sh, yuqoridagi barcha jamilar bo‘sh, ro‘yxatda', () => {
    const rows = [...TOZA.map((r) => (r.id === 10 ? { ...r, narx: null } : r))];
    const m = ostatkaHujjatModeli(rows, TOZA_H.filter((x) => x.qator_id !== 4));
    expect(m.jami).toBeNull();
    expect(m.qatorlar.find((r) => r.nom === 'ПЛИТКА')!.summa).toBeNull();
    expect(m.qatorlar.find((r) => r.nom === 'ЗАТРАТЫ ТРУДА')!.ostatkaHajm).toBeNull();
    expect(m.diqqat.map((d) => d.sabab)).toEqual(['нет данных о выполнении', 'нет сметной цены']);
    const { bytes } = ostatkaHujjatXlsx(m, { obyektNomi: 'Объект', sana: '2026-09-25' });
    namunaSaqla('ostatka_nomalum.xlsx', bytes);
    const t = hujjatTekshir(bytes);
    expect(t.taqiqlangan).toEqual([]);
    expect(t.matnlar.some((s) => s.startsWith('ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ (2)'))).toBe(true);
    expect(t.matnlar).toContain('Итог не определен: есть позиции без суммы — см. перечень ниже.');
    // Hech bir jami katagida 0 yozilmagan: noma'lum → bo'sh matn natija.
    const jamilar = t.varaqlar[0].kataklar.filter((k) => k.f?.startsWith('IF(J'));
    expect(jamilar.every((k) => k.v === '')).toBe(true);
  });
});
