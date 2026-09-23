import { describe, expect, it } from 'vitest';
import { ofertaQatorlariniHisobla, type OfertaQator } from './tender-oferta';

const qator = (patch: Partial<OfertaQator> = {}): OfertaQator => ({
  sourceId: 'RES::r3', sourceSheet: 'RES', sourceRow: 3, tartibRaqami: 1, shifr: null,
  nom: 'Бетон B25', birlik: 'м3', hajm: 10, smetaBirlikNarx: 123.45, smetaSumma: 1234.49,
  ...patch,
  turi: patch.turi ?? 'resurs', hisobTuri: patch.hisobTuri ?? 'birlik', blokKaliti: patch.blokKaliti ?? null,
});

describe('tender oferta narx yadrosi', () => {
  it('foiz bilan pasaytirganda taklif summasini hajm x pudratchi narxidan oladi', () => {
    const result = ofertaQatorlariniHisobla([qator()], { rejim: 'foiz', yon: 'pasaytirish', foiz: 10 });
    expect(result.valid).toBe(true);
    expect(result.qatorlar[0].pudratchiBirlikNarx).toBe(111.105);
    expect(result.qatorlar[0].pudratchiSumma).toBe(1111.05);
    // Manba summasi hech qachon qty*price bilan qayta yozilmaydi.
    expect(result.qatorlar[0].smetaSumma).toBe(1234.49);
  });

  it('foiz bilan oshirishni ham deterministic hisoblaydi', () => {
    const result = ofertaQatorlariniHisobla([qator({ smetaBirlikNarx: 80, hajm: 100 })], { rejim: 'foiz', yon: 'oshirish', foiz: 50 });
    expect(result.qatorlar[0].pudratchiBirlikNarx).toBe(120);
    expect(result.qatorlar[0].pudratchiSumma).toBe(12000);
  });

  it('qolda kiritilgan narx global qoidaga bog‘liq bo‘lmaydi', () => {
    const row = qator({ sourceId: 'a' });
    const result = ofertaQatorlariniHisobla([row], { rejim: 'foiz', yon: 'pasaytirish', foiz: 90 }, { a: 77.25 });
    expect(result.valid).toBe(true);
    expect(result.qatorlar[0].pudratchiBirlikNarx).toBe(77.25);
    expect(result.qatorlar[0].pudratchiSumma).toBe(772.5);
    expect(result.qatorlar[0].narxManbasi).toBe('qolda');
  });

  it('qo‘lda rejimda kiritilmagan narxni nolga aylantirmaydi', () => {
    const result = ofertaQatorlariniHisobla([qator()], { rejim: 'qolda' });
    expect(result.valid).toBe(false);
    expect(result.qatorlar[0].pudratchiBirlikNarx).toBeNull();
    expect(result.qatorlar[0].pudratchiSumma).toBeNull();
    expect(result.qatorlar[0].muammolar).toContain('PUDRATCHI_NARXI_YOQ');
  });

  it('smeta narxi yo‘q bo‘lsa foizli rejim fail-closed ishlaydi, qo‘lda esa ruxsat beradi', () => {
    const row = qator({ sourceId: 'b', smetaBirlikNarx: null });
    const percent = ofertaQatorlariniHisobla([row], { rejim: 'foiz', foiz: 10, yon: 'pasaytirish' });
    expect(percent.valid).toBe(false);
    expect(percent.qatorlar[0].muammolar).toContain('SMETA_NARXI_YOQ');
    const manual = ofertaQatorlariniHisobla([row], { rejim: 'qolda' }, { b: 200 });
    expect(manual.valid).toBe(true);
    expect(manual.qatorlar[0].pudratchiSumma).toBe(2000);
  });

  it('hajm yo‘q bo‘lsa taklif summasi taxminan nol qilinmaydi', () => {
    const result = ofertaQatorlariniHisobla([qator({ hajm: null })], { rejim: 'foiz', foiz: 0, yon: 'pasaytirish' });
    expect(result.valid).toBe(false);
    expect(result.qatorlar[0].pudratchiBirlikNarx).toBe(123.45);
    expect(result.qatorlar[0].pudratchiSumma).toBeNull();
    expect(result.qatorlar[0].muammolar).toContain('HAJM_YOQ');
  });

  it('pasaytirish foizi narxni manfiyga olib ketsa rad etadi', () => {
    const result = ofertaQatorlariniHisobla([qator()], { rejim: 'foiz', yon: 'pasaytirish', foiz: 101 });
    expect(result.valid).toBe(false);
    expect(result.qatorlar[0].muammolar).toContain('NARX_MANFIY');
  });

  it('material jami, sklad va transport satrlarini ikki marta sanamaydi', () => {
    const rows = [
      qator({ sourceId: 'm1', smetaBirlikNarx: 100, smetaSumma: 1000, blokKaliti: 'mat' }),
      qator({ sourceId: 's1', nom: 'Sklad xarajati 2%', turi: 'sklad_xarajati', hisobTuri: 'manba_jami', hajm: null, smetaBirlikNarx: null, smetaSumma: 100, blokKaliti: 'mat' }),
      qator({ sourceId: 't1', nom: 'Transport xarajati', turi: 'transport_xarajati', hisobTuri: 'manba_jami', hajm: null, smetaBirlikNarx: null, smetaSumma: 50, blokKaliti: 'mat' }),
      qator({ sourceId: 'j1', nom: 'ИТОГО МАТЕРИАЛОВ', turi: 'jami', hisobTuri: 'jami', hajm: null, smetaBirlikNarx: null, smetaSumma: 1150, blokKaliti: 'mat' }),
    ];
    const result = ofertaQatorlariniHisobla(rows, { rejim: 'foiz', yon: 'pasaytirish', foiz: 0 });
    expect(result.valid).toBe(true);
    expect(result.smetaJami).toBe(1150);
    expect(result.resursJami).toBe(1000);
    expect(result.skladJami).toBe(100);
    expect(result.transportJami).toBe(50);
    expect(result.ofertaJami).toBe(1150);
    expect(result.qatorlar[3].pudratchiSumma).toBe(1150);
  });

  it('jami satri alohida foiz bilan qayta narxlanmaydi, faqat bolalar yig‘indisini ko‘rsatadi', () => {
    const rows = [
      qator({ sourceId: 'm1', smetaBirlikNarx: 100, smetaSumma: 1000, blokKaliti: 'mat' }),
      qator({ sourceId: 'j1', nom: 'ИТОГО', turi: 'jami', hisobTuri: 'jami', hajm: null, smetaBirlikNarx: null, smetaSumma: 1000, blokKaliti: 'mat' }),
    ];
    const result = ofertaQatorlariniHisobla(rows, { rejim: 'foiz', yon: 'pasaytirish', foiz: 10 });
    expect(result.qatorlar[0].pudratchiSumma).toBe(900);
    expect(result.qatorlar[1].pudratchiSumma).toBe(900);
    expect(result.ofertaJami).toBe(900);
  });

  it('TN transport varag‘ining ko‘p bosqichli hisobini hajm x narxga buzib yubormaydi', () => {
    const row = qator({
      sourceId: 'transport::r7', turi: 'transport_xarajati', hisobTuri: 'manba_jami',
      nom: 'АСФАЛЬТОБЕТОННАЯ СМЕСЬ — перевозка', hajm: 1417.2186,
      smetaBirlikNarx: 1390.96, smetaSumma: 74909186.586528,
    });
    const result = ofertaQatorlariniHisobla([row], { rejim: 'foiz', yon: 'pasaytirish', foiz: 10 });
    expect(result.valid).toBe(true);
    expect(result.qatorlar[0].pudratchiBirlikNarx).toBeNull();
    expect(result.qatorlar[0].pudratchiSumma).toBeCloseTo(67418267.9278752, 6);
  });
});
