import { describe, expect, it } from 'vitest';
import { lrvPlusQatorlarniHisobla, lrvPlusJamiFormula, lrvPlusFaylBaytlari, LRV_PLUS_USTUNLAR } from './lrv-plus-export';
import type { T2Qator, T2QatorHolat } from '../api/supabase';

/** Production'da T2-SMETA-NORMA-CASCADE-001 tekshiruvida ishlatilgan
 *  AYNAN o'sha sonlar bilan -- bl hajmi 100, ikkita norma bilan bog'langan
 *  resurs (0.095 va 0.047), narxlar 20000 va 50000. */
function qator(p: Partial<T2Qator> & { id: number; tartib: number; tur: string }): T2Qator {
  return {
    id: p.id, obyekt_id: 1, obyekt: null, kompaniya_id: 1,
    ota_id: p.ota_id ?? null, daraja: p.daraja ?? 0, tartib: p.tartib,
    tur: p.tur, kod: p.kod ?? null, nom: p.nom ?? null, birlik: p.birlik ?? null,
    hajm: p.hajm ?? null, narx: p.narx ?? null, summa: p.summa ?? null,
    kat: p.kat ?? null, narx_usul: null, qoshimcha: null, zamena: null,
    d1: null, d2: null, d3: null, xom_qator: null, yangilandi: null,
    manba_id: null, versiya: 1, raqam: null, norma: p.norma ?? null,
  };
}

function holat(p: Partial<T2QatorHolat> & { qator_id: number }): T2QatorHolat {
  return {
    id: p.qator_id, qator_id: p.qator_id, obyekt_id: 1,
    tur: null, kod: null, nom: null, birlik: null, kat: null,
    smeta_hajm: null, smeta_summa: null,
    fakt_hajm: p.fakt_hajm ?? 0, fakt_summa: p.fakt_summa ?? 0,
    f2_hajm: p.f2_hajm ?? 0, f2_summa: p.f2_summa ?? 0,
    qoldiq_hajm: p.qoldiq_hajm ?? null, qoldiq_summa: p.qoldiq_summa ?? null,
  };
}

const DARAXT: T2Qator[] = [
  qator({ id: 1, tartib: 1, tur: 'rz', daraja: 0, nom: 'Yer ishlari' }),
  qator({ id: 2, tartib: 2, tur: 'bl', daraja: 1, ota_id: 1, kod: 'K1', nom: 'Qazish', birlik: 'm3', hajm: 100 }),
  qator({ id: 3, tartib: 3, tur: 'rs', daraja: 2, ota_id: 2, kod: '000001', nom: 'Ishchi', birlik: 'ЧЕЛ-Ч', hajm: 9.5, narx: 20000, summa: 190000, norma: 0.095, kat: 'ЧЕЛ' }),
  qator({ id: 4, tartib: 4, tur: 'rs', daraja: 2, ota_id: 2, kod: '2264', nom: 'Ekskavator', birlik: 'МАШ-Ч', hajm: 4.7, narx: 50000, summa: 235000, norma: 0.047, kat: 'МАШ' }),
];

/** Real hayotdagi holat: ishning 40 % bajarilgan, uning yarmi F2 ga olingan. */
const HOLATLAR: T2QatorHolat[] = [
  holat({ qator_id: 1, fakt_hajm: 0, fakt_summa: 170000, f2_hajm: 0, f2_summa: 85000 }),
  holat({ qator_id: 2, fakt_hajm: 40, fakt_summa: 170000, f2_hajm: 20, f2_summa: 85000 }),
  holat({ qator_id: 3, fakt_hajm: 3.8, fakt_summa: 76000, f2_hajm: 1.9, f2_summa: 38000 }),
  holat({ qator_id: 4, fakt_hajm: 1.88, fakt_summa: 94000, f2_hajm: 0.94, f2_summa: 47000 }),
];

describe('lrvPlusQatorlarniHisobla — smeta kaskadi', () => {
  it('rs (bl ostida, normasi bor) uchun ОБЪЁМ formulasi = norma × ota ОБЪЁМи', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const bl = h.find((r) => r.nom === 'Qazish')!;
    expect(ishchi.obyomFormula).toBe(`F${ishchi.row}*G${bl.row}`);
    expect(ishchi.norma).toBe(0.095);
    expect(ishchi.summaFormula).toBe(`G${ishchi.row}*H${ishchi.row}`);
  });

  it('bl ustunidagi ОБЪЁМ -- literal qiymat (formula emas), tahrirlanadigan katak', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const bl = h.find((r) => r.nom === 'Qazish')!;
    expect(bl.obyomFormula).toBeNull();
    expect(bl.obyomQiymat).toBe(100);
  });

  it('bl СУММА -- bevosita bolalarini yashirin Даража ustuni bo\'yicha SUMIF qiladi', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const bl = h.find((r) => r.nom === 'Qazish')!;
    const rs = h.filter((r) => r.tur === 'rs');
    const c1 = Math.min(...rs.map((r) => r.row)), c2 = Math.max(...rs.map((r) => r.row));
    expect(bl.summaFormula).toBe(`SUMIF($Z$${c1}:$Z$${c2},${bl.daraja + 1},$I$${c1}:$I$${c2})`);
    expect(bl.summaQiymat).toBe(190000 + 235000);
  });

  it('bo\'sh bo\'lim (bolasi yo\'q) uchun СУММА 0 (formula emas)', () => {
    const yolgiz = qator({ id: 9, tartib: 1, tur: 'rz', daraja: 0, nom: 'Bo\'sh bo\'lim' });
    const h = lrvPlusQatorlarniHisobla([yolgiz]);
    expect(h[0].summaFormula).toBeNull();
    expect(h[0].summaQiymat).toBe(0);
  });
});

describe('lrvPlusQatorlarniHisobla — FAKT / F2 (egasining talabi: har bir qatorda aniq qiymat)', () => {
  it('har bir qator -- rz/bl/rs -- FAKT va F2 qiymatini oladi, faqat barglar emas', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT, HOLATLAR);
    expect(h.map((r) => r.faktHajm)).toEqual([0, 40, 3.8, 1.88]);
    expect(h.map((r) => r.f2Hajm)).toEqual([0, 20, 1.9, 0.94]);
    expect(h.map((r) => r.faktSumma)).toEqual([170000, 170000, 76000, 94000]);
    expect(h.map((r) => r.f2Summa)).toEqual([85000, 85000, 38000, 47000]);
  });

  it('holat berilmasa FAKT/F2 nolga tushadi (eksport baribir ishlaydi)', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    expect(h.every((r) => r.faktHajm === 0 && r.f2Hajm === 0 && r.faktSumma === 0)).toBe(true);
  });

  it('kontekst ustunlari -- eng yaqin rz/bl ota nomi', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    expect(ishchi.razdel).toBe('Yer ishlari');
    expect(ishchi.vidRabot).toBe('Qazish');
    const bl = h.find((r) => r.tur === 'bl')!;
    expect(bl.razdel).toBe('Yer ishlari');
    expect(bl.vidRabot).toBe(''); // o'zi bl -- ustida bl yo'q
  });
});

describe('lrvPlusJamiFormula', () => {
  it('berilgan ustun bo\'yicha daraja=0 (ildiz) qatorlarni SUMIF bilan yig\'adi', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const c1 = h[0].row, c2 = h[h.length - 1].row;
    expect(lrvPlusJamiFormula(h, 'I')).toBe(`SUMIF($Z$${c1}:$Z$${c2},0,$I$${c1}:$I$${c2})`);
    expect(lrvPlusJamiFormula(h, 'Q')).toBe(`SUMIF($Z$${c1}:$Z$${c2},0,$Q$${c1}:$Q$${c2})`);
  });

  it('bo\'sh ro\'yxatda null qaytaradi', () => {
    expect(lrvPlusJamiFormula([], 'I')).toBeNull();
  });
});

describe('lrvPlusFaylBaytlari — haqiqiy .xlsx yoziladi va qayta o\'qiladi', () => {
  it('smeta formulalari, FAKT/OSTATKA/F2 ustunlari va ranglar faylga tushadi', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Sinov Obyekti', HOLATLAR);
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.read(bytes, { type: 'array', cellStyles: true });
    const ws = wb.Sheets['LRV_PLUS'];
    expect(ws).toBeDefined();

    const h = lrvPlusQatorlarniHisobla(DARAXT, HOLATLAR);
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const bl = h.find((r) => r.tur === 'bl')!;
    const rz = h.find((r) => r.tur === 'rz')!;

    // Smeta kaskadi -- Excelning O'ZIDA jonli
    expect(ws[`G${ishchi.row}`].f).toBe(`F${ishchi.row}*G${bl.row}`);
    expect(ws[`I${ishchi.row}`].f).toBe(`G${ishchi.row}*H${ishchi.row}`);
    expect(ws[`I${ishchi.row}`].v).toBe(190000);
    expect(ws[`I${bl.row}`].f).toContain('SUMIF');
    expect(ws[`I${bl.row}`].v).toBe(425000);
    expect(ws[`I${rz.row}`].v).toBe(425000);

    // Egasining talabi: fakt / ostatka / f2 olingan / f2 olinishi mumkin
    expect(ws[`P${ishchi.row}`].v).toBe(3.8); // ФАКТ ОБЪЁМ
    expect(ws[`Q${ishchi.row}`].v).toBe(76000); // ФАКТ СУММА
    expect(ws[`R${ishchi.row}`].f).toBe(`G${ishchi.row}-P${ishchi.row}`); // ОСТАТКА = smeta - fakt
    expect(ws[`R${ishchi.row}`].v).toBeCloseTo(9.5 - 3.8, 6);
    expect(ws[`T${ishchi.row}`].v).toBe(1.9); // F2 ОЛИНГАН
    expect(ws[`V${ishchi.row}`].f).toBe(`P${ishchi.row}-T${ishchi.row}`); // F2 МУМКИН = fakt - olingan
    expect(ws[`V${ishchi.row}`].v).toBeCloseTo(1.9, 6);
    expect(ws[`W${ishchi.row}`].v).toBe(76000 - 38000);

    // Kategoriya ustunlari faqat bargda va faqat MOS ustunda
    expect(ws[`J${ishchi.row}`].v).toBe(190000); // ЧЕЛ
    expect(ws[`K${ishchi.row}`]?.v ?? '').toBe(''); // МАШ -- bo'sh
    const ekskavator = h.find((r) => r.nom === 'Ekskavator')!;
    expect(ws[`K${ekskavator.row}`].v).toBe(235000); // МАШ
    expect(ws[`J${bl.row}`]?.v ?? '').toBe(''); // bl'da kategoriya bo'lmaydi

    // Kontekst
    expect(ws[`X${ishchi.row}`].v).toBe('Yer ishlari');
    expect(ws[`Y${ishchi.row}`].v).toBe('Qazish');

    // Sarlavha va jami
    expect(ws['A1'].v).toBe('Sinov Obyekti');
    expect(ws['I3'].f).toContain('SUMIF');
    expect(ws['I3'].v).toBe(425000);
    expect(ws['Q3'].v).toBe(170000);
    expect(ws['U3'].v).toBe(85000);
    expect(ws['S3'].v).toBe(425000 - 170000); // ЖАМИ ОСТАТКА
    expect(ws['W3'].v).toBe(170000 - 85000); // ЖАМИ F2 ОЛИНИШИ МУМКИН

  });

  /* Rangni O'QIB tekshirib bo'lmaydi: SheetJS `.s` ni qayta qurmaydi
     (yozishda qo'llab-quvvatlanadi, o'qishda emas). Shuning uchun
     tekshiruv HAQIQIY fayl ichidagi `xl/styles.xml` ustidan boradi. */
  it('T1 rang sxemasi haqiqiy fayl ichiga tushadi (rz sariq, bl ko\'k+oq, mat yashil)', async () => {
    const bilanMat: T2Qator[] = [
      ...DARAXT,
      qator({ id: 5, tartib: 5, tur: 'mat', daraja: 1, ota_id: 1, nom: 'Sement', birlik: 'kg', hajm: 500, narx: 1200, kat: 'МАТ' }),
    ];
    const bytes = await lrvPlusFaylBaytlari(bilanMat, 'Rang sinovi', HOLATLAR);
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.read(bytes, { type: 'array', bookFiles: true });
    const oqi = (nom: string) => {
      const entry = (wb as unknown as { files: Record<string, { content: Uint8Array | string }> }).files[nom];
      return typeof entry.content === 'string' ? entry.content : new TextDecoder().decode(Uint8Array.from(entry.content));
    };
    const styles = oqi('xl/styles.xml');
    expect(styles).toContain('FFFF00'); // rz — sariq
    expect(styles).toContain('4A86E8'); // bl — ko'k
    expect(styles).toContain('D9EAD3'); // mat — yashil
    expect(styles).toContain('FFFFFF'); // bl shrifti — oq

    // Ranglangan qatorlarning kataklari haqiqatan style indeksini oladi
    // (s="0" — standart; rangli qatorda albatta noldan katta).
    const sheet = oqi('xl/worksheets/sheet1.xml');
    expect(sheet).toMatch(/<c r="A4" s="[1-9]/); // rz qatori
    expect(sheet).toMatch(/<c r="A5" s="[1-9]/); // bl qatori
  });

  it('ustun sarlavhalari haqiqiy LRV tartibida yoziladi', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Sinov', HOLATLAR);
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    LRV_PLUS_USTUNLAR.forEach((nom, i) => {
      expect(ws[XLSX.utils.encode_cell({ r: 1, c: i })].v).toBe(nom);
    });
  });
});
