import { describe, expect, it } from 'vitest';
import {
  lrvBarmoqIzi, lrvKalitYoz, lrvKalitOqi, lrvQaytaImportTekshir, lrvQaytaImportXulosa,
  type LrvFaylQator, type LrvKanonikQator,
} from './lrv-qayta-import';

const KANONIK: LrvKanonikQator[] = [
  { id: 328789, kod: '000001', nom: 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', birlik: 'ЧЕЛ-Ч', hajm: 294.872 },
  { id: 328791, kod: '000762', nom: 'КРАНЫ НА АВТОМОБИЛЬНОМ ХОДУ', birlik: 'МАШ-Ч', hajm: 0.124 },
  { id: 321334, kod: '12-505-1', nom: 'ТРУБЫ ПОЛИПРОПИЛЕНОВЫЕ Д-20', birlik: 'ПМ', hajm: 139.345 },
];

const kalit = (k: LrvKanonikQator) => lrvKalitYoz(k.id, k.kod, k.nom, k.birlik);

function faylQator(k: LrvKanonikQator, p: Partial<LrvFaylQator> & { satr: number }): LrvFaylQator {
  return {
    satr: p.satr, kalit: p.kalit !== undefined ? p.kalit : kalit(k),
    kod: p.kod ?? k.kod, nom: p.nom ?? k.nom, birlik: p.birlik ?? k.birlik,
    hajm: p.hajm !== undefined ? p.hajm : k.hajm, izoh: p.izoh,
  };
}

describe('barmoq izi va kalit', () => {
  it('bir xil o\'zlik -> bir xil izi; registr/bo\'shliq farqi ahamiyatsiz', () => {
    expect(lrvBarmoqIzi('000001', 'ЗАТРАТЫ  ТРУДА', 'чел-ч')).toBe(lrvBarmoqIzi('000001', 'затраты труда', 'ЧЕЛ-Ч'));
  });

  it('o\'zlik o\'zgarsa izi ham o\'zgaradi', () => {
    expect(lrvBarmoqIzi('000001', 'A', 'м3')).not.toBe(lrvBarmoqIzi('000001', 'B', 'м3'));
  });

  it('kalit o\'qiladi va buzuq kalit rad etiladi', () => {
    expect(lrvKalitOqi(lrvKalitYoz(42, 'K', 'N', 'B'))).toMatchObject({ id: 42 });
    expect(lrvKalitOqi('42')).toBeNull();
    expect(lrvKalitOqi('abc:1234567')).toBeNull();
    expect(lrvKalitOqi('')).toBeNull();
  });
});

describe('qaytgan faylni tekshirish — normal holat', () => {
  it('hajm o\'zgargani QONUNIY: moslashadi va o\'zgargan deb belgilanadi', () => {
    const fayl = [
      faylQator(KANONIK[0], { satr: 4, hajm: 300 }),        // o'zgargan
      faylQator(KANONIK[1], { satr: 5 }),                    // o'zgarmagan
      faylQator(KANONIK[2], { satr: 6, hajm: 150, izoh: 'Заказчик: +10 ПМ' }),
    ];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.ok).toBe(true);
    expect(n.mos).toHaveLength(3);
    expect(n.mos.filter((m) => m.ozgardi)).toHaveLength(2);
    expect(n.mos.find((m) => m.id === 321334)?.izoh).toBe('Заказчик: +10 ПМ');
    expect(n.xatolar).toHaveLength(0);
  });
});

/* ═══ EGASINING AYTGAN IKKI XAVFI ═══ */

describe('XAVF 1 — tasdiqlashda yangi ish turlari qo\'shilgan', () => {
  it('КАЛИТ siz qator YANGI deb ajratiladi, jim qabul qilinmaydi', () => {
    const fayl = [
      faylQator(KANONIK[0], { satr: 4 }),
      { satr: 5, kalit: null, kod: 'YANGI-1', nom: 'ДОПОЛНИТЕЛЬНАЯ КЛАДКА', birlik: 'М3', hajm: 12, izoh: 'Заказчик талаби' },
    ];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.yangi).toHaveLength(1);
    expect(n.yangi[0]).toMatchObject({ satr: 5, kod: 'YANGI-1', hajm: 12 });
    // Yangi qator mavjud qatorga QO'SHILIB ketmaydi
    expect(n.mos.map((m) => m.id)).toEqual([328789]);
    // Bloklamaydi, lekin operator ko'rishi shart
    expect(n.ok).toBe(true);
  });

  it('bo\'sh matnli kalit ham yangi deb qaraladi', () => {
    const n = lrvQaytaImportTekshir(
      [{ satr: 4, kalit: '   ', kod: 'X', nom: 'Y', birlik: 'ШТ', hajm: 1 }], KANONIK);
    expect(n.yangi).toHaveLength(1);
    expect(n.xatolar).toHaveLength(0);
  });
});

describe('XAVF 2 — qator nusxalanib, bir xil ID bilan boshqa hajm berilgan', () => {
  it('bir xil ID ikki marta uchrasa import BLOKLANADI', () => {
    const fayl = [
      faylQator(KANONIK[0], { satr: 4, hajm: 294.872 }),
      faylQator(KANONIK[0], { satr: 9, hajm: 999 }),   // Excelda nusxalangan
    ];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.ok).toBe(false);
    const x = n.xatolar.find((e) => e.turi === 'DUBLIKAT_ID')!;
    expect(x.id).toBe(328789);
    expect(x.xabar).toContain('4-');
    expect(x.xabar).toContain('9-');
    // Ikkinchi nusxa moslikka KIRMAYDI
    expect(n.mos).toHaveLength(1);
  });

  it('bitta ID uchun faqat BITTA dublikat xatosi beriladi (uch nusxada ham)', () => {
    const fayl = [4, 9, 14].map((satr) => faylQator(KANONIK[0], { satr, hajm: satr }));
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.xatolar.filter((e) => e.turi === 'DUBLIKAT_ID')).toHaveLength(1);
  });

  it('ID saqlanib, nom/kod almashtirilsa — O\'ZLIK O\'ZGARDI, bloklanadi', () => {
    const fayl = [faylQator(KANONIK[0], { satr: 4, nom: 'СОВСЕМ ДРУГАЯ РАБОТА', hajm: 500 })];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.ok).toBe(false);
    expect(n.xatolar[0].turi).toBe('OZLIK_OZGARDI');
    expect(n.mos).toHaveLength(0);
  });

  it('birlik almashtirilsa ham bloklanadi (м3 -> т bilan pul o\'zgaradi)', () => {
    const fayl = [faylQator(KANONIK[2], { satr: 4, birlik: 'Т' })];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.ok).toBe(false);
    expect(n.xatolar[0].turi).toBe('OZLIK_OZGARDI');
  });
});

describe('boshqa himoyalar', () => {
  it('begona ID (boshqa obyekt fayli) bloklanadi', () => {
    const fayl = [{ satr: 4, kalit: lrvKalitYoz(999999, 'K', 'N', 'B'), kod: 'K', nom: 'N', birlik: 'B', hajm: 1 }];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.ok).toBe(false);
    expect(n.xatolar[0].turi).toBe('BEGONA_ID');
  });


  it('eksportdan keyin smeta o\'zgargan bo\'lsa — fayl eskirgan, bloklanadi', () => {
    // Fayl eski o'zlik bilan eksport qilingan, keyin smetada nom o'zgargan.
    const eski = { ...KANONIK[0], nom: 'ЭСКИ НОМ' };
    const fayl = [faylQator(eski, { satr: 4 })];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.ok).toBe(false);
    expect(n.xatolar[0].turi).toBe('SMETA_OZGARDI');
  });

  it('buzuq kalit bloklanadi', () => {
    const fayl = [{ satr: 4, kalit: '328789-buzuq', kod: 'K', nom: 'N', birlik: 'B', hajm: 1 }];
    const n = lrvQaytaImportTekshir(fayl, KANONIK);
    expect(n.ok).toBe(false);
    expect(n.xatolar[0].turi).toBe('KALIT_BUZUQ');
  });

  it('faylda yo\'q qator O\'CHIRILMAYDI — yo\'qolgan deb belgilanadi', () => {
    const n = lrvQaytaImportTekshir([faylQator(KANONIK[0], { satr: 4 })], KANONIK);
    expect(n.yoqolgan.map((y) => y.id).sort()).toEqual([321334, 328791]);
    expect(n.ok).toBe(true);
  });

  it('xulosa matni operatorga tushunarli', () => {
    const n = lrvQaytaImportTekshir([
      faylQator(KANONIK[0], { satr: 4, hajm: 300 }),
      { satr: 5, kalit: null, kod: 'Y', nom: 'Yangi', birlik: 'М3', hajm: 1 },
    ], KANONIK);
    expect(lrvQaytaImportXulosa(n)).toBe('1 qator moslashdi · 1 tasida hajm o\'zgargan · 1 yangi (qo\'shimcha) qator · 2 qator faylda yo\'q');
  });
});
