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

const BEZSKLAD_DARAXT: T2Qator[] = [
  ...DARAXT,
  qator({ id: 5, tartib: 5, tur: 'mat', daraja: 2, ota_id: 2, kod: 'BEZ-001', nom: 'Skladga kirmaydigan material', birlik: 'kg', hajm: 2, narx: 750, summa: 1500, kat: 'БЕЗСКЛАД' }),
];

describe('lrvPlusQatorlarniHisobla — smeta kaskadi', () => {
  it('rs (bl ostida, normasi bor) uchun ОБЪЁМ formulasi = norma × ota ОБЪЁМи', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const bl = h.find((r) => r.nom === 'Qazish')!;
    expect(ishchi.obyomFormula).toBe(`E${ishchi.row}*F${bl.row}`);
    expect(ishchi.birlikHajm).toBe(0.095);
    expect(ishchi.summaFormula).toBe(`F${ishchi.row}*G${ishchi.row}`);
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
    expect(bl.summaFormula).toBe(`SUMIF($Y$${c1}:$Y$${c2},${bl.daraja + 1},$H$${c1}:$H$${c2})`);
    expect(bl.summaQiymat).toBe(190000 + 235000);
  });

  it('bo\'sh bo\'lim (bolasi yo\'q) uchun СУММА noma\'lum bo\'lib qoladi', () => {
    const yolgiz = qator({ id: 9, tartib: 1, tur: 'rz', daraja: 0, nom: 'Bo\'sh bo\'lim' });
    const h = lrvPlusQatorlarniHisobla([yolgiz]);
    expect(h[0].summaFormula).toBeNull();
    expect(h[0].summaQiymat).toBeNull();
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

  it('bo\'sh ro\'yxatda null qaytaradi', () => {
    expect(lrvPlusJamiFormula([], 'H')).toBeNull();
  });

  it('ЖАМИ formulasi berilgan ustun bo\'yicha faqat ildiz (daraja=0) qatorlarni yig\'adi', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const c1 = h[0].row, c2 = h[h.length - 1].row;
    expect(lrvPlusJamiFormula(h, 'H')).toBe(`SUMIF($Y$${c1}:$Y$${c2},0,$H$${c1}:$H$${c2})`);
    expect(lrvPlusJamiFormula(h, 'T')).toBe(`SUMIF($Y$${c1}:$Y$${c2},0,$T$${c1}:$T$${c2})`);
  });
});

/* Egasining 2026-09-09 dagi tuzatishlari. */
describe('LRV eksport — egasi so\'ragan tuzatishlar', () => {
  it('ustun tartibi haqiqiy T1 LRV_PLUS bilan bir xil: H gacha asosiy zona, ТИП I da', () => {
    expect(LRV_PLUS_USTUNLAR[4]).toBe('ҲАЖМ (ед)');   // E
    expect(LRV_PLUS_USTUNLAR[5]).toBe('ҲАЖМ (жами)'); // F
    expect(LRV_PLUS_USTUNLAR[6]).toBe('НАРХ');        // G
    expect(LRV_PLUS_USTUNLAR[7]).toBe('СУММА');       // H
    expect(LRV_PLUS_USTUNLAR[8]).toBe('ТИП');         // I — markirovka
    expect(LRV_PLUS_USTUNLAR.slice(9, 16)).toEqual(['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'БЕЗ СКЛАД', 'М/К', 'ПРОВОД/КАБ']); // J..P
  });

  it('БЕЗСКЛАД alohida kategoriya bo\'lib N ga tushadi, МАТ ga emas', async () => {
    const h = lrvPlusQatorlarniHisobla(BEZSKLAD_DARAXT);
    const bez = h.find((r) => r.nom === 'Skladga kirmaydigan material')!;
    expect(bez.kat).toBe('БЕЗСКЛАД');
    expect(bez.summaQiymat).toBe(1500);

    const bytes = await lrvPlusFaylBaytlari(BEZSKLAD_DARAXT, 'Bez sklad sinovi');
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    expect(ws['N2'].v).toBe('БЕЗ СКЛАД');
    expect(ws['O2'].v).toBe('М/К');
    expect(ws['P2'].v).toBe('ПРОВОД/КАБ');
    expect(ws[`N${bez.row}`].f).toBe(`$H${bez.row}`);
    expect(ws[`L${bez.row}`]?.v ?? '').toBe('');
    expect(ws['N3'].f).toBe(`SUM(N4:N${3 + BEZSKLAD_DARAXT.length})`);
    expect(ws['N3'].v).toBe(1500);
  });

  it('NULL narx yoki summa ko\'rinadigan moliyaviy nolga aylantirilmaydi', async () => {
    const rows = [qator({ id: 90, tartib: 1, tur: 'mat', daraja: 0, nom: 'Narxsiz material', birlik: 'kg', hajm: 5, narx: null, summa: null, kat: 'БЕЗСКЛАД' })];
    const h = lrvPlusQatorlarniHisobla(rows);
    expect(h[0].summaFormula).toBeNull();
    expect(h[0].summaQiymat).toBeNull();

    const bytes = await lrvPlusFaylBaytlari(rows, 'Null sinovi');
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    expect(ws['G4']?.v ?? '').toBe('');
    expect(ws['H4']?.v ?? '').toBe('');
    expect(ws['N4']?.v ?? '').toBe('');
    expect(ws['V4']?.v ?? '').toBe('');
  });

  it('РАЗДЕЛ va ВИД РАБОТ ustunlari yo\'q — ierarxiya endi guruhlash orqali', () => {
    expect(LRV_PLUS_USTUNLAR).not.toContain('РАЗДЕЛ');
    expect(LRV_PLUS_USTUNLAR).not.toContain('ВИД РАБОТ');
  });

  it('faylda qatorlar guruhlanadi (rz > bl > resurs) va H gacha chegara chiziladi', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Guruh sinovi', HOLATLAR);
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.read(bytes, { type: 'array', bookFiles: true });
    const oqi = (nom: string) => {
      const e = (wb as unknown as { files: Record<string, { content: Uint8Array | string }> }).files[nom];
      return typeof e.content === 'string' ? e.content : new TextDecoder().decode(Uint8Array.from(e.content));
    };
    const sheet = oqi('xl/worksheets/sheet1.xml');
    // rz (daraja 0) guruh boshi, bl (1) va resurslar (2) ichida yig'iladi.
    expect(sheet).toMatch(/<row r="5"[^>]*outlineLevel="1"/); // bl
    expect(sheet).toMatch(/<row r="6"[^>]*outlineLevel="2"/); // rs
    expect(sheet).toMatch(/<row r="7"[^>]*outlineLevel="2"/); // rs
    // Chegara: A..H uchun `medium`, undan keyingilar uchun `thin`.
    const styles = oqi('xl/styles.xml');
    expect(styles).toContain('medium');
    expect(styles).toContain('thin');
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
    expect(ws[`F${ishchi.row}`].f).toBe(`E${ishchi.row}*F${bl.row}`);
    expect(ws[`H${ishchi.row}`].f).toBe(`F${ishchi.row}*G${ishchi.row}`);
    expect(ws[`H${ishchi.row}`].v).toBe(190000);
    expect(ws[`H${bl.row}`].f).toContain('SUMIF');
    expect(ws[`H${bl.row}`].v).toBe(425000);
    expect(ws[`H${rz.row}`].v).toBe(425000);

    // Egasining talabi: fakt / ostatka / f2 olingan / f2 olinishi mumkin
    expect(ws[`Q${ishchi.row}`].v).toBe(3.8); // ФАКТ ҳажм
    expect(ws[`U${ishchi.row}`].v).toBe(76000); // ФАКТ сумма
    expect(ws[`R${ishchi.row}`].f).toBe(`F${ishchi.row}-Q${ishchi.row}`); // ОСТАТКА = smeta - fakt
    expect(ws[`R${ishchi.row}`].v).toBeCloseTo(9.5 - 3.8, 6);
    expect(ws[`S${ishchi.row}`].v).toBe(1.9); // F2 ОЛИНГАН
    expect(ws[`T${ishchi.row}`].f).toBe(`Q${ishchi.row}-S${ishchi.row}`); // F2 МУМКИН = fakt - olingan
    expect(ws[`T${ishchi.row}`].v).toBeCloseTo(1.9, 6);
    expect(ws[`V${ishchi.row}`].f).toBe(`H${ishchi.row}-U${ishchi.row}`); // ОСТАТКА сумма
    expect(ws[`V${ishchi.row}`].v).toBe(190000 - 76000);
    expect(ws[`W${ishchi.row}`].v).toBe(38000); // F2 ОЛИНГАН сумма
    expect(ws[`X${ishchi.row}`].f).toBe(`U${ishchi.row}-W${ishchi.row}`); // F2 МУМКИН сумма
    expect(ws[`X${ishchi.row}`].v).toBe(76000 - 38000);

    // Kategoriya ustunlari faqat bargda va faqat MOS ustunda
    expect(ws[`J${ishchi.row}`].f).toBe(`$H${ishchi.row}`); // ЧЕЛ -- formula bilan
    expect(ws[`K${ishchi.row}`]?.v ?? '').toBe(''); // МАШ -- bo'sh
    const ekskavator = h.find((r) => r.nom === 'Ekskavator')!;
    expect(ws[`K${ekskavator.row}`].f).toBe(`$H${ekskavator.row}`); // МАШ
    expect(ws[`J${bl.row}`]?.v ?? '').toBe(''); // bl'da kategoriya bo'lmaydi

    // Sarlavha va jami
    expect(ws['A1'].v).toBe('Sinov Obyekti');
    expect(ws['H3'].f).toBe(`SUMIF($Y$${h[0].row}:$Y$${h[h.length - 1].row},0,$H$${h[0].row}:$H$${h[h.length - 1].row})`);
    expect(ws['U3'].f).toBe(`SUMIF($Y$${h[0].row}:$Y$${h[h.length - 1].row},0,$U$${h[0].row}:$U$${h[h.length - 1].row})`);
    expect(ws['V3'].f).toBe(`SUMIF($Y$${h[0].row}:$Y$${h[h.length - 1].row},0,$V$${h[0].row}:$V$${h[h.length - 1].row})`);
    expect(ws['W3'].f).toBe(`SUMIF($Y$${h[0].row}:$Y$${h[h.length - 1].row},0,$W$${h[0].row}:$W$${h[h.length - 1].row})`);
    expect(ws['X3'].f).toBe(`SUMIF($Y$${h[0].row}:$Y$${h[h.length - 1].row},0,$X$${h[0].row}:$X$${h[h.length - 1].row})`);
    expect(ws['H3'].v).toBe(425000);
    expect(ws['U3'].v).toBe(170000);
    expect(ws['W3'].v).toBe(85000);
    expect(ws['V3'].v).toBe(425000 - 170000); // ЖАМИ ОСТАТКА
    expect(ws['X3'].v).toBe(170000 - 85000); // ЖАМИ F2 ОЛИНИШИ МУМКИН

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
    const ws = XLSX.read(bytes, { type: 'array', cellStyles: true }).Sheets['LRV_PLUS'];
    LRV_PLUS_USTUNLAR.forEach((nom, i) => {
      expect(ws[XLSX.utils.encode_cell({ r: 1, c: i })].v).toBe(nom);
    });
    expect(ws['!cols']).toHaveLength(LRV_PLUS_USTUNLAR.length);
    const cols = ws['!cols']!;
    expect(cols[13].wch).toBe(14); // N — БЕЗ СКЛАД
    expect(cols[15].wch).toBe(14); // P — ПРОВОД/КАБ
    expect(cols[24].hidden).toBe(true); // Y — Даража
  });

  it('1000+ resursli synthetic eksport parent jami-ni ikki marta sanamaydi', async () => {
    const resourceCount = 1001;
    const categories = ['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'БЕЗСКЛАД', 'М/К', 'ПРОВОД/КАБ'];
    const resources = Array.from({ length: resourceCount }, (_, i) => qator({
      id: 1000 + i, tartib: 3 + i, tur: 'rs', daraja: 2, ota_id: 2,
      kod: `R-${i + 1}`, nom: `Synthetic resource ${i + 1}`, birlik: 'шт',
      hajm: 1, narx: 10, summa: 10, kat: categories[i % categories.length],
    }));
    const rows = [
      qator({ id: 1, tartib: 1, tur: 'rz', daraja: 0, nom: 'Synthetic root' }),
      qator({ id: 2, tartib: 2, tur: 'bl', daraja: 1, ota_id: 1, nom: 'Synthetic block', hajm: 1 }),
      ...resources,
    ];

    const h = lrvPlusQatorlarniHisobla(rows);
    const expected = resourceCount * 10;
    expect(h).toHaveLength(rows.length);
    expect(h.find((r) => r.tur === 'bl')!.summaQiymat).toBe(expected);
    expect(h.find((r) => r.tur === 'rz')!.summaQiymat).toBe(expected);

    const bytes = await lrvPlusFaylBaytlari(rows, '1000 resurs');
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    const cable = h.find((r) => r.kat === 'ПРОВОД/КАБ')!;
    expect(ws['H3'].v).toBe(expected);
    expect(ws['H3'].f).toContain('$Y$');
    expect(ws[`P${cable.row}`].f).toBe(`$H${cable.row}`);
    expect(XLSX.utils.decode_range(ws['!ref']!).e.r).toBe(rows.length + 2);
  });
});
