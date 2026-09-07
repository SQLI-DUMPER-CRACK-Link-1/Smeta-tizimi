import { describe, expect, it } from 'vitest';
import { f2AktTnQatorlarQur } from './f2-akt-tn-export';
import type { NakopitelniyQator } from '../api/t2-nakopitelniy';

let seq = 0;
function q(partial: Partial<NakopitelniyQator> & { tur: NakopitelniyQator['tur'] }): NakopitelniyQator {
  seq++;
  return {
    qator_id: seq, tartib: seq, kod: null, nom: null, birlik: null,
    kat: null, qoshimcha: false, zamena: false,
    smeta_hajm: null, smeta_narx: null, smeta_summa: null,
    fakt_hajm: 0, fakt_summa: 0,
    oldingi_hajm: 0, oldingi_summa: 0,
    joriy_hajm: 0, joriy_summa: 0, joriy_qoralama_summa: 0,
    jami_hajm: 0, jami_summa: 0,
    f2_mumkin_hajm: 0,
    qoldiq_hajm: 0, qoldiq_summa: 0,
    jami_baseline_summa: 0, jami_actual_summa: null, narx_variance_summa: 0,
    bajarilish_foiz: null,
    ...partial,
  };
}

describe('f2AktTnQatorlarQur — rasmiy Ф2 (TN Akt-2) qator qurish', () => {
  it('bl ostidagi resurs uchun НОРМА = resurs joriy hajmi / (smeta_hajm - oldingi_hajm)', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'Fundament ishlari' }),
      q({ tur: 'bl', kod: 'Ш-1', nom: 'Betonlash', birlik: 'm3', smeta_hajm: 10, oldingi_hajm: 0 }),
      q({ tur: 'rs', kod: 'R-1', nom: 'Beton B25', birlik: 'm3', joriy_hajm: 5, joriy_summa: 500000 }),
    ];
    const { qatorlar, jamiSumma, qatorSoni } = f2AktTnQatorlarQur(rows);
    expect(qatorlar[0]).toEqual({ kind: 'rz', cells: ['Fundament ishlari'] });
    expect(qatorlar[1]).toEqual({ kind: 'bl', cells: [1, 'Ш-1', 'Betonlash', 'm3', 10, '', '', 500000] });
    expect(qatorlar[2]).toEqual({ kind: 'chiziq_bl', cells: ['', 'R-1', 'Beton B25', 'm3', 0.5, 5, 100000, 500000] });
    expect(qatorlar[3]).toEqual({ kind: 'itogo', cells: ['', '', 'ИТОГО ПО РАЗДЕЛУ:', '', '', '', '', 500000] });
    expect(qatorlar[4]).toEqual({ kind: 'vsego', cells: ['', '', 'ВСЕГО ПО АКТУ:', '', '', '', '', 500000] });
    expect(jamiSumma).toBe(500000);
    expect(qatorSoni).toBe(1);
  });

  it('bl ostida bir nechta resurs bo\'lsa, bl summasi ularning yig\'indisi (rollup)', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'RZ' }),
      q({ tur: 'bl', nom: 'ISH', smeta_hajm: 20, oldingi_hajm: 5 }),
      q({ tur: 'rs', nom: 'A', joriy_hajm: 3, joriy_summa: 300 }),
      q({ tur: 'mat', nom: 'B', joriy_hajm: 2, joriy_summa: 700 }),
    ];
    const { qatorlar } = f2AktTnQatorlarQur(rows);
    const bl = qatorlar.find((r) => r.kind === 'bl')!;
    expect(bl.cells[7]).toBe(1000); // blHajm = 20-5=15 as bl.cells[4]
    expect(bl.cells[4]).toBe(15);
  });

  it('bl ota-onasiz mustaqil resurs (rz ostida to\'g\'ridan-to\'g\'ri) E ustuniga hajmini, F ni bo\'sh qoldiradi', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'RZ' }),
      q({ tur: 'mat', kod: 'M-1', nom: 'Mustaqil material', birlik: 'kg', joriy_hajm: 4, joriy_summa: 40000 }),
    ];
    const { qatorlar } = f2AktTnQatorlarQur(rows);
    expect(qatorlar[1]).toEqual({ kind: 'chiziq_mustaqil', cells: [1, 'M-1', 'Mustaqil material', 'kg', 4, '', 10000, 40000] });
  });

  it('joriy_hajm=0 va joriy_summa=0 bo\'lgan qator (harakatsiz) hujjatga chiqmaydi', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'RZ' }),
      q({ tur: 'rs', nom: 'Harakatsiz', joriy_hajm: 0, joriy_summa: 0 }),
    ];
    const { qatorlar } = f2AktTnQatorlarQur(rows);
    expect(qatorlar).toEqual([]); // RZ ham bo'sh qolgani uchun tashlanadi
  });

  it('bl\'ning barcha bolalari harakatsiz bo\'lsa, bl o\'zi ham chiqmaydi', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'RZ' }),
      q({ tur: 'bl', nom: 'Bo\'sh ish', smeta_hajm: 10, oldingi_hajm: 0 }),
      q({ tur: 'rs', nom: 'Harakatsiz', joriy_hajm: 0, joriy_summa: 0 }),
    ];
    const { qatorlar } = f2AktTnQatorlarQur(rows);
    expect(qatorlar).toEqual([]);
  });

  it('manfiy (сторно/tuzatish) summa ham hujjatga kiradi', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'RZ' }),
      q({ tur: 'rs', nom: 'Tuzatish', joriy_hajm: -2, joriy_summa: -20000 }),
    ];
    const { qatorlar, jamiSumma } = f2AktTnQatorlarQur(rows);
    expect(qatorlar[1].cells[7]).toBe(-20000);
    expect(jamiSumma).toBe(-20000);
  });

  it('bir nechta RAZDEL bo\'lsa, ВСЕГО barcha ИТОГО lar yig\'indisi', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'RZ-1' }),
      q({ tur: 'rs', nom: 'A', joriy_hajm: 1, joriy_summa: 100 }),
      q({ tur: 'rz', nom: 'RZ-2' }),
      q({ tur: 'rs', nom: 'B', joriy_hajm: 1, joriy_summa: 250 }),
    ];
    const { qatorlar, jamiSumma } = f2AktTnQatorlarQur(rows);
    const itogoLar = qatorlar.filter((r) => r.kind === 'itogo').map((r) => r.cells[7]);
    expect(itogoLar).toEqual([100, 250]);
    expect(jamiSumma).toBe(350);
  });

  it('smeta_hajm - oldingi_hajm <= 0 bo\'lsa, НОРМА hisoblanmaydi (bo\'sh)', () => {
    const rows: NakopitelniyQator[] = [
      q({ tur: 'rz', nom: 'RZ' }),
      q({ tur: 'bl', nom: 'To\'liq bajarilgan', smeta_hajm: 10, oldingi_hajm: 10 }),
      q({ tur: 'rs', nom: 'Qo\'shimcha', joriy_hajm: 1, joriy_summa: 1000 }),
    ];
    const { qatorlar } = f2AktTnQatorlarQur(rows);
    const bl = qatorlar.find((r) => r.kind === 'bl')!;
    expect(bl.cells[4]).toBe(''); // blHajm=0 -> bo'sh
    const chiziq = qatorlar.find((r) => r.kind === 'chiziq_bl')!;
    expect(chiziq.cells[4]).toBe('');
  });
});
