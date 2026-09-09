import { describe, expect, it } from 'vitest';
import { lrvPlusQatorlarniHisobla, lrvPlusJamiFormula, lrvPlusFaylBaytlari } from './lrv-plus-export';
import type { T2Qator } from '../api/supabase';

/** Production'da T2-SMETA-NORMA-CASCADE-001 tekshiruvida ishlatilgan
 *  AYNAN o'sha sonlar bilan -- bl hajmi 100, ikkita norma bilan bog'langan
 *  resurs (0.095 va 0.047), narxlar 20000 va 50000. */
function qator(p: Partial<T2Qator> & { id: number; tartib: number; tur: string }): T2Qator {
  return {
    id: p.id, obyekt_id: 1, obyekt: null, kompaniya_id: 1,
    ota_id: p.ota_id ?? null, daraja: p.daraja ?? 0, tartib: p.tartib,
    tur: p.tur, kod: p.kod ?? null, nom: p.nom ?? null, birlik: p.birlik ?? null,
    hajm: p.hajm ?? null, narx: p.narx ?? null, summa: p.summa ?? null,
    kat: null, narx_usul: null, qoshimcha: null, zamena: null,
    d1: null, d2: null, d3: null, xom_qator: null, yangilandi: null,
    manba_id: null, versiya: 1, raqam: null, norma: p.norma ?? null,
  };
}

const DARAXT: T2Qator[] = [
  qator({ id: 1, tartib: 1, tur: 'rz', daraja: 0, nom: 'Yer ishlari' }),
  qator({ id: 2, tartib: 2, tur: 'bl', daraja: 1, ota_id: 1, kod: 'K1', nom: 'Qazish', birlik: 'm3', hajm: 100 }),
  qator({ id: 3, tartib: 3, tur: 'rs', daraja: 2, ota_id: 2, kod: '1', nom: 'Ishchi', birlik: 'chel-ch', hajm: 9.5, narx: 20000, summa: 190000, norma: 0.095 }),
  qator({ id: 4, tartib: 4, tur: 'rs', daraja: 2, ota_id: 2, kod: '2264', nom: 'Ekskavator', birlik: 'mash-ch', hajm: 4.7, narx: 50000, summa: 235000, norma: 0.047 }),
];

describe('lrvPlusQatorlarniHisobla', () => {
  it('rs (bl ostida, normasi bor) uchun ОБЪЁМ formulasi = norma × ota ОБЪЁМи', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const bl = h.find((r) => r.nom === 'Qazish')!;
    expect(ishchi.obyomFormula).toBe(`E${ishchi.row}*F${bl.row}`);
    expect(ishchi.norma).toBe(0.095);
    expect(ishchi.summaFormula).toBe(`F${ishchi.row}*G${ishchi.row}`);
  });

  it('bl ustunidagi ОБЪЁМ -- literal qiymat (formula emas), tahrirlanadigan katak', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const bl = h.find((r) => r.nom === 'Qazish')!;
    expect(bl.obyomFormula).toBeNull();
    expect(bl.obyomQiymat).toBe(100);
  });

  it('bl СУММА -- bevosita bolalari (rs) oralig\'ini SUMIF bilan yig\'adi, daraja+1 filtri bilan', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const bl = h.find((r) => r.nom === 'Qazish')!;
    const rs = h.filter((r) => r.tur === 'rs');
    const c1 = Math.min(...rs.map((r) => r.row)), c2 = Math.max(...rs.map((r) => r.row));
    expect(bl.summaFormula).toBe(`SUMIF($I$${c1}:$I$${c2},${bl.daraja + 1},$H$${c1}:$H$${c2})`);
  });

  it('rz СУММА -- to\'liq nasl oralig\'ini SUMIF bilan yig\'adi (rs ikki marta qo\'shilmaydi)', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const rz = h.find((r) => r.tur === 'rz')!;
    const rest = h.filter((r) => r.tur !== 'rz');
    const c1 = Math.min(...rest.map((r) => r.row)), c2 = Math.max(...rest.map((r) => r.row));
    expect(rz.summaFormula).toBe(`SUMIF($I$${c1}:$I$${c2},${rz.daraja + 1},$H$${c1}:$H$${c2})`);
  });

  it('norma yo\'q yoki bl ota bo\'lmasa -- ОБЪЁМ formula emas, literal hajm ishlatiladi', () => {
    const mat = qator({ id: 5, tartib: 5, tur: 'mat', daraja: 1, ota_id: 1, nom: 'Sement', birlik: 'kg', hajm: 500, narx: 1200, summa: 600000 });
    const h = lrvPlusQatorlarniHisobla([DARAXT[0], mat]);
    const row = h.find((r) => r.nom === 'Sement')!;
    expect(row.obyomFormula).toBeNull();
    expect(row.obyomQiymat).toBe(500);
    expect(row.summaFormula).toBe(`F${row.row}*G${row.row}`);
  });

  it('bo\'sh bo\'lim (bolasi yo\'q) uchun СУММА 0 (formula emas)', () => {
    const yolgiz = qator({ id: 9, tartib: 1, tur: 'rz', daraja: 0, nom: 'Bo\'sh bo\'lim' });
    const h = lrvPlusQatorlarniHisobla([yolgiz]);
    expect(h[0].summaFormula).toBeNull();
    expect(h[0].summaQiymat).toBe(0);
  });
});

describe('lrvPlusJamiFormula', () => {
  it('butun jadval bo\'ylab daraja=0 (ildiz/rz) qatorlarni SUMIF bilan yig\'adi', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const f = lrvPlusJamiFormula(h);
    expect(f).toBe(`SUMIF($I$${h[0].row}:$I$${h[h.length - 1].row},0,$H$${h[0].row}:$H$${h[h.length - 1].row})`);
  });

  it('bo\'sh ro\'yxatda null qaytaradi', () => {
    expect(lrvPlusJamiFormula([])).toBeNull();
  });
});

describe('lrvPlusFaylBaytlari (to\'liq round-trip -- SheetJS bilan haqiqiy .xlsx yoziladi va o\'qiladi)', () => {
  it('formulalar va keshlangan qiymatlar faylga to\'g\'ri yoziladi', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Sinov Obyekti');
    const XLSX = await import('xlsx');
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets['LRV_PLUS'];
    expect(ws).toBeDefined();

    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const bl = h.find((r) => r.nom === 'Qazish')!;
    const rz = h.find((r) => r.tur === 'rz')!;

    expect(ws[`F${ishchi.row}`].f).toBe(`E${ishchi.row}*F${bl.row}`);
    expect(ws[`H${ishchi.row}`].f).toBe(`F${ishchi.row}*G${ishchi.row}`);
    expect(ws[`H${ishchi.row}`].v).toBe(190000);
    expect(ws[`H${bl.row}`].f).toContain('SUMIF');
    expect(ws[`H${bl.row}`].v).toBe(190000 + 235000);
    expect(ws[`H${rz.row}`].v).toBe(190000 + 235000);
    // Obyekt nomi sarlavhada
    expect(ws['A1'].v).toBe('Sinov Obyekti');
  });
});
