import { describe, expect, it } from 'vitest';
import { ostatkaQatorlari } from './ostatka-export';
import { lrvPlusFaylBaytlari } from './lrv-plus-export';
import type { T2Qator, T2QatorHolat } from '../api/supabase';

function q(id: number, ota_id: number | null, tur: string, hajm: number | null, extra: Partial<T2Qator> = {}): T2Qator {
  return {
    id, obyekt_id: 1, obyekt: 'X', kompaniya_id: 1, ota_id, daraja: 0, tartib: id, tur, kod: 'K' + id, nom: 'q' + id,
    birlik: 'm3', hajm, narx: 100, summa: null, kat: tur === 'rs' ? 'МАТ' : null, narx_usul: null, qoshimcha: false, zamena: false,
    d1: null, d2: null, d3: null, xom_qator: id, yangilandi: null, manba_id: null, versiya: 1, raqam: null, norma: null, ...extra,
  };
}
function h(qator_id: number, fakt_hajm: number): T2QatorHolat {
  return {
    id: qator_id, qator_id, obyekt_id: 1, tur: null, kod: null, nom: null, birlik: null, kat: null, smeta_hajm: null,
    smeta_summa: null, fakt_hajm, fakt_summa: 0, f2_hajm: 0, f2_summa: 0, qoldiq_hajm: null, qoldiq_summa: null,
  };
}

// ОЗЕРА(1) → КАНАЛ(2) → bl3 (10, fakt 4) → rs4 (norma 2 → 20, fakt 8)
//                      → mat5 (5, fakt 5 — tugagan)
//          → bl6 (3, fakt 5 — oshib ketgan)
//          → mat7 (hajm NULL)
const ROWS = [
  q(1, null, 'rz', null), q(2, 1, 'rz', null),
  q(3, 2, 'bl', 10), q(4, 3, 'rs', 20, { norma: 2 }), q(5, 2, 'mat', 5),
  q(6, 1, 'bl', 3), q(7, 1, 'mat', null),
];
const HOLAT = [h(3, 4), h(4, 8), h(5, 5), h(6, 5), h(7, 0)];

describe('ostatkaQatorlari', () => {
  const n = ostatkaQatorlari(ROWS, HOLAT);

  it('faqat ostatkasi bor barglar va ularning RZ zanjiri; hajm = smeta − fakt', () => {
    expect(n.qatorlar.map((r) => [r.id, r.tur, r.hajm])).toEqual([
      [1, 'rz', null], [2, 'rz', null], [3, 'bl', 6], [4, 'rs', 12],
    ]);
    expect(n.barglar).toBe(1);
  });

  it('oshib ketgan va noma\'lum jim yashirilmaydi — sanaladi', () => {
    expect(n.oshibKetgan).toBe(1);
    expect(n.nomalum).toBe(1);
  });

  it('LRV_PLUS yozuvchisidan Forma-2 sifatida chiqadi, formulalarda $ yo\'q', async () => {
    const bytes = await lrvPlusFaylBaytlari(n.qatorlar, 'X', undefined, { rejim: 'forma2', sarlavha: 'ОСТАТКА ИШЛАР — X' });
    const XLSX = await import('xlsx');
    const wb = XLSX.read(bytes, { type: 'array', cellFormula: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(String(ws.A1.v)).toContain('ОСТАТКА');
    const formulalar = Object.entries(ws).filter(([k, c]) => !k.startsWith('!') && typeof (c as { f?: string }).f === 'string').map(([, c]) => (c as { f: string }).f);
    expect(formulalar.length).toBeGreaterThan(0);
    expect(formulalar.filter((f) => f.includes('$'))).toEqual([]);
  });
});
