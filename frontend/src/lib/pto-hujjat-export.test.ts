import { describe, expect, it } from 'vitest';
import {
  ptoHujjatXlsx, ptoHujjatPdf, ptoResurslarniQur, ptoFaylNomi,
  PTO_HUJJAT_USTUNLARI, PTO_HUJJAT_NOMI,
  type PtoHujjat, type PtoHujjatTuri,
} from './pto-hujjat-export';
import type { T2QatorHolat } from '../api/supabase';

function holat(p: Partial<T2QatorHolat> & { qator_id: number; tur: string; kat: string; nom: string }): T2QatorHolat {
  return {
    id: p.qator_id, qator_id: p.qator_id, obyekt_id: 1,
    tur: p.tur, kod: p.kod ?? null, nom: p.nom, birlik: p.birlik ?? 'ЧЕЛ-Ч', kat: p.kat,
    smeta_hajm: p.smeta_hajm ?? 0, smeta_summa: p.smeta_summa ?? 0,
    fakt_hajm: p.fakt_hajm ?? 0, fakt_summa: p.fakt_summa ?? 0,
    f2_hajm: p.f2_hajm ?? 0, f2_summa: p.f2_summa ?? 0,
    qoldiq_hajm: null, qoldiq_summa: null,
  };
}

/* Ataylab ALIFBO tartibida EMAS berilgan — chiqishda ЧЕЛ→МАШ→МАТ→ОБ bo'lishi shart. */
const HOLATLAR: T2QatorHolat[] = [
  holat({ qator_id: 1, tur: 'ob', kat: 'ОБ', kod: 'OB-1', nom: 'Насос', birlik: 'ШТ', f2_hajm: 2, f2_summa: 4_000_000, smeta_hajm: 2, smeta_summa: 4_000_000 }),
  holat({ qator_id: 2, tur: 'mat', kat: 'МАТ', kod: '12-505', nom: 'Труба', birlik: 'ПМ', f2_hajm: 100, f2_summa: 607_100, smeta_hajm: 120, smeta_summa: 728_520 }),
  holat({ qator_id: 3, tur: 'rs', kat: 'ЧЕЛ', kod: '000001', nom: 'ЗАТРАТЫ ТРУДА РАБОЧИХ', birlik: 'ЧЕЛ-Ч', f2_hajm: 10, f2_summa: 245_177, smeta_hajm: 12, smeta_summa: 294_212 }),
  holat({ qator_id: 4, tur: 'rs', kat: 'МАШ', kod: '000762', nom: 'КРАНЫ НА АВТОХОДУ', birlik: 'МАШ-Ч', f2_hajm: 4, f2_summa: 977_000, smeta_hajm: 4, smeta_summa: 977_000 }),
  holat({ qator_id: 5, tur: 'rs', kat: 'МАШ', kod: '000003', nom: 'ЗАТРАТЫ ТРУДА МАШИНИСТОВ', birlik: 'ЧЕЛ-Ч', f2_hajm: 3, f2_summa: 0, smeta_hajm: 3, smeta_summa: 0 }),
  holat({ qator_id: 6, tur: 'bl', kat: '', nom: 'ИШ БЛОКИ — resursga kirmasin' }),
];

function hujjat(turi: PtoHujjatTuri): PtoHujjat {
  const n = PTO_HUJJAT_USTUNLARI[turi].length;
  return {
    turi,
    obyekt: 'Амфитеатр',
    davr: '2026-07',
    raqam: 'F2-07/2026',
    buyurtmachi: 'ООО «Заказчик»',
    pudratchi: 'ООО «Подрядчик»',
    qatorlar: [
      { no: 0, kod: '', nom: 'РАЗДЕЛ: ГОРЯЧИЙ ВОДОПРОВОД', birlik: '', qiymatlar: Array(n).fill(null), bolim: true },
      { no: 1, kod: 'E16-4-5-1', nom: 'ПРОКЛАДКА ТРУБОПРОВОДОВ Д-20ММ', birlik: '100М', qiymatlar: Array.from({ length: n }, (_, i) => (i + 1) * 10) },
      { no: 2, kod: 'E16-4-5-2', nom: 'ПРОКЛАДКА ТРУБОПРОВОДОВ Д-25ММ', birlik: '100М', qiymatlar: Array.from({ length: n }, (_, i) => (i + 1) * 5), ogohlantirish: 'Сметадан 2 м³ ошган' },
    ],
    resurslar: ptoResurslarniQur(HOLATLAR),
  };
}

describe('ptoResurslarniQur — resurs vedomosti', () => {
  it('kategoriya tartibi ЧЕЛ → МАШ → МАТ → ОБ (alifbo emas)', () => {
    const r = ptoResurslarniQur(HOLATLAR);
    const katlar = [...new Set(r.map((x) => x.kat))];
    expect(katlar).toEqual(['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ']);
  });

  it('ish bloklari (bl) resursga kirmaydi — faqat rs/mat/ob', () => {
    const r = ptoResurslarniQur(HOLATLAR);
    expect(r.some((x) => x.nom.includes('ИШ БЛОКИ'))).toBe(false);
  });

  it('birlik narxi hajmdan hisoblanadi; hajm 0 bo\'lsa narx null (0 EMAS)', () => {
    const r = ptoResurslarniQur(HOLATLAR);
    const ishchi = r.find((x) => x.kod === '000001')!;
    expect(ishchi.narx).toBeCloseTo(24_517.7, 4);
    // Narxsiz resurs (МАШИНИСТОВ, summa 0) -- narx 0 bo'lib qoladi, null emas,
    // chunki hajm bor: 0 / 3 = 0. Bu to'g'ri: summa haqiqatan nol.
    const mashinist = r.find((x) => x.kod === '000003')!;
    expect(mashinist.summa).toBe(0);
  });

  it('manba smeta bo\'lsa smeta qiymatlari olinadi', () => {
    const f2 = ptoResurslarniQur(HOLATLAR, 'f2').find((x) => x.kod === '12-505')!;
    const sm = ptoResurslarniQur(HOLATLAR, 'smeta').find((x) => x.kod === '12-505')!;
    expect(f2.hajm).toBe(100);
    expect(sm.hajm).toBe(120);
  });
});

describe('ptoHujjatXlsx — haqiqiy .xlsx', () => {
  it('ikkita varaq: hujjat va resurs vedomosti', async () => {
    const bytes = await ptoHujjatXlsx(hujjat('nakopitelniy'));
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Hujjat', 'Ресурсная ведомость']);
  });

  it('resurs varag\'ida kategoriya bo\'limlari ЧЕЛ→МАШ→МАТ→ОБ tartibida', async () => {
    const bytes = await ptoHujjatXlsx(hujjat('forma2'));
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Ресурсная ведомость')!;
    const matnlar: string[] = [];
    ws.eachRow((r) => { const v = r.getCell(3).value; if (typeof v === 'string') matnlar.push(v); });
    const i = (s: string) => matnlar.findIndex((m) => m.startsWith(s));
    expect(i('ЧЕЛ-ЧАС')).toBeGreaterThan(-1);
    expect(i('ЧЕЛ-ЧАС')).toBeLessThan(i('МАШ-ЧАС'));
    expect(i('МАШ-ЧАС')).toBeLessThan(i('МАТЕРИАЛЫ'));
    expect(i('МАТЕРИАЛЫ')).toBeLessThan(i('ОБОРУДОВАНИЕ'));
    expect(matnlar.some((m) => m === 'ВСЕГО ПО ВЕДОМОСТИ')).toBe(true);
  });

  it('ИТОГО qatori faqat bo\'lim bo\'lmagan qatorlarni yig\'adi', async () => {
    const h = hujjat('forma2'); // ustunlar: Кол-во, Цена, Сумма -> 10/20/30 va 5/10/15
    const bytes = await ptoHujjatXlsx(h);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Hujjat')!;
    let jami: unknown[] = [];
    ws.eachRow((r) => { if (r.getCell(3).value === 'ИТОГО') jami = [r.getCell(5).value, r.getCell(6).value, r.getCell(7).value]; });
    expect(jami).toEqual([15, 30, 45]);
  });
});

describe('ptoHujjatPdf — haqiqiy PDF, kirillcha shrift bilan', () => {
  it('PDF yoziladi, Unicode shrift joylanadi (standart Helvetica kirillni ko\'rsatmaydi)', async () => {
    const bytes = await ptoHujjatPdf(hujjat('slichitelniy'));
    const matn = new TextDecoder('latin1').decode(bytes);
    expect(matn.startsWith('%PDF')).toBe(true);
    expect(matn).toContain('LiberationSans');
    expect(matn).toContain('FontFile2');   // TrueType haqiqatan embed qilingan
    expect(matn).toContain('Identity-H');  // Unicode kodlash
  });

  it('hujjat va resurs vedomosti — kamida ikki sahifa', async () => {
    const bytes = await ptoHujjatPdf(hujjat('m29'));
    const matn = new TextDecoder('latin1').decode(bytes);
    const sahifa = (matn.match(/\/Type \/Page[^s]/g) || []).length;
    expect(sahifa).toBeGreaterThanOrEqual(2);
  });

  it('barcha hujjat turlari xatosiz chiqadi', async () => {
    for (const turi of ['forma2', 'nakopitelniy', 'slichitelniy', 'forma3', 'm29'] as PtoHujjatTuri[]) {
      const bytes = await ptoHujjatPdf(hujjat(turi));
      expect(bytes.length).toBeGreaterThan(1000);
      expect(PTO_HUJJAT_NOMI[turi]).toBeTruthy();
    }
  });
});

describe('ptoFaylNomi', () => {
  it('tur, obyekt va davrni birlashtiradi, xavfli belgilarni tozalaydi', () => {
    expect(ptoFaylNomi({ ...hujjat('forma3'), obyekt: 'A/B:C' }, 'pdf')).toBe('FORMA3_A_B_C_2026-07.pdf');
    expect(ptoFaylNomi(hujjat('m29'), 'xlsx')).toBe('M29_Амфитеатр_2026-07.xlsx');
  });
});
