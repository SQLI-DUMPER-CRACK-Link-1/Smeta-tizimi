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
    expect(bl.summaFormula).toBe(`SUMIF($X$${c1}:$X$${c2},${bl.daraja + 1},$H$${c1}:$H$${c2})`);
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

  it('bo\'sh ro\'yxatda null qaytaradi', () => {
    expect(lrvPlusJamiFormula([], 'H')).toBeNull();
  });

  it('ЖАМИ formulasi berilgan ustun bo\'yicha faqat ildiz (daraja=0) qatorlarni yig\'adi', () => {
    const h = lrvPlusQatorlarniHisobla(DARAXT);
    const c1 = h[0].row, c2 = h[h.length - 1].row;
    expect(lrvPlusJamiFormula(h, 'H')).toBe(`SUMIF($X$${c1}:$X$${c2},0,$H$${c1}:$H$${c2})`);
    expect(lrvPlusJamiFormula(h, 'T')).toBe(`SUMIF($X$${c1}:$X$${c2},0,$T$${c1}:$T$${c2})`);
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
    expect(LRV_PLUS_USTUNLAR.slice(9, 15)).toEqual(['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'КАБ', 'М/К']); // J..O
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
    expect(ws[`P${ishchi.row}`].v).toBe(3.8); // ФАКТ ҳажм
    expect(ws[`T${ishchi.row}`].v).toBe(76000); // ФАКТ сумма
    expect(ws[`Q${ishchi.row}`].f).toBe(`F${ishchi.row}-P${ishchi.row}`); // ОСТАТКА = smeta - fakt
    expect(ws[`Q${ishchi.row}`].v).toBeCloseTo(9.5 - 3.8, 6);
    expect(ws[`R${ishchi.row}`].v).toBe(1.9); // F2 ОЛИНГАН
    expect(ws[`S${ishchi.row}`].f).toBe(`P${ishchi.row}-R${ishchi.row}`); // F2 МУМКИН = fakt - olingan
    expect(ws[`S${ishchi.row}`].v).toBeCloseTo(1.9, 6);
    expect(ws[`W${ishchi.row}`].v).toBe(76000 - 38000);

    // Kategoriya ustunlari faqat bargda va faqat MOS ustunda
    expect(ws[`J${ishchi.row}`].f).toBe(`$H${ishchi.row}`); // ЧЕЛ -- formula bilan
    expect(ws[`K${ishchi.row}`]?.v ?? '').toBe(''); // МАШ -- bo'sh
    const ekskavator = h.find((r) => r.nom === 'Ekskavator')!;
    expect(ws[`K${ekskavator.row}`].f).toBe(`$H${ekskavator.row}`); // МАШ
    expect(ws[`J${bl.row}`]?.v ?? '').toBe(''); // bl'da kategoriya bo'lmaydi

    // Sarlavha va jami
    expect(ws['A1'].v).toBe('Sinov Obyekti');
    expect(ws['H3'].f).toContain('SUMIF');
    expect(ws['H3'].v).toBe(425000);
    expect(ws['T3'].v).toBe(170000);
    expect(ws['V3'].v).toBe(85000);
    expect(ws['U3'].v).toBe(425000 - 170000); // ЖАМИ ОСТАТКА
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

/* Egasi (2026-09-09): «qatorlarda id lar foydalanilsa, f2 zamechaniya va
   o'zgarishlar bilan tasdiqlanganidan keyin import uchun osonlashardi» —
   va uning xavfi: «o'sha id bilan ko'chirilib boshqa obyom berilishi mumkin».
   Quyida EKSPORT → TAHRIR → QAYTA IMPORT halqasi haqiqiy fayl ustida. */
describe('eksport ↔ qayta import halqasi', () => {
  it('yashirin КАЛИТ har qatorga yoziladi va yashirilgan', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Halqa', HOLATLAR);
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    const { lrvKalitOqi } = await import('./lrv-qayta-import');
    const h = lrvPlusQatorlarniHisobla(DARAXT, HOLATLAR);
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const kalit = lrvKalitOqi(ws[`Y${ishchi.row}`]?.v);
    expect(kalit?.id).toBe(3);                       // kanonik t2_qator.id
    // КАЛИТ ustuni yashirin — haqiqiy fayl XML'idan tekshiriladi
    const wb2 = XLSX.read(bytes, { type: 'array', bookFiles: true });
    const e = (wb2 as unknown as { files: Record<string, { content: Uint8Array | string }> }).files['xl/worksheets/sheet1.xml'];
    const xml = typeof e.content === 'string' ? e.content : new TextDecoder().decode(Uint8Array.from(e.content));
    expect(xml).toMatch(/<col[^>]*min="25"[^>]*hidden="true"/);
  });

  it('faylni tahrirlab qaytarish: hajm o\'zgarsa qabul, nusxalansa RAD', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Halqa', HOLATLAR);
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    const { lrvQaytaImportTekshir } = await import('./lrv-qayta-import');

    const h = lrvPlusQatorlarniHisobla(DARAXT, HOLATLAR);
    const kanonik = DARAXT.map((q) => ({ id: q.id, kod: q.kod ?? '', nom: q.nom ?? '', birlik: q.birlik ?? '', hajm: q.hajm }));
    const oqi = (r: number) => ({
      satr: r,
      kalit: String(ws[`Y${r}`]?.v ?? ''),
      kod: String(ws[`B${r}`]?.v ?? ''),
      nom: String(ws[`C${r}`]?.v ?? ''),
      birlik: String(ws[`D${r}`]?.v ?? ''),
      hajm: Number(ws[`F${r}`]?.v ?? 0),
    });

    // 1) Buyurtmachi bitta qator hajmini o'zgartirdi -> QABUL
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const oddiy = h.map((r) => oqi(r.row));
    oddiy[h.indexOf(ishchi)].hajm = 12;
    const n1 = lrvQaytaImportTekshir(oddiy, kanonik);
    expect(n1.ok).toBe(true);
    expect(n1.mos.find((m) => m.id === 3)?.ozgardi).toBe(true);

    // 2) O'sha qator nusxalanib, boshqa hajm berildi -> RAD
    const nusxa = [...oddiy, { ...oqi(ishchi.row), satr: 99, hajm: 999 }];
    const n2 = lrvQaytaImportTekshir(nusxa, kanonik);
    expect(n2.ok).toBe(false);
    expect(n2.xatolar[0].turi).toBe('DUBLIKAT_ID');
  });
});

/* Egasining tuzatishi (2026-09-09): «bu nakrutka qatorlari aslida lrv
   plusda ham bo'lishi hisoblanishi kerak, bo'lmasa butun tizimda summalar
   faqat primoy zatratda hisoblanib qoladi.» Kaskad `t2_nakrutka_hisobla_v1`
   (supabase/migrations/20261014090000) bilan BAYT-BAYTIGA bir xil bo'lishi
   qo'lda hisoblangan misol bilan tekshiriladi. */
describe('Nakrutka kaskadi — t2_nakrutka_hisobla_v1 bilan bir xil formulalar', () => {
  const KAT_DARAXT: T2Qator[] = [
    qator({ id: 1, tartib: 1, tur: 'rz', daraja: 0, nom: 'Bo\'lim' }),
    qator({ id: 2, tartib: 2, tur: 'mat', daraja: 1, ota_id: 1, kod: 'M1', nom: 'Chel', birlik: 'chel-ch', hajm: 1, narx: 100000, summa: 100000, kat: 'ЧЕЛ' }),
    qator({ id: 3, tartib: 3, tur: 'mat', daraja: 1, ota_id: 1, kod: 'M2', nom: 'Mash', birlik: 'mash-ch', hajm: 1, narx: 50000, summa: 50000, kat: 'МАШ' }),
    qator({ id: 4, tartib: 4, tur: 'mat', daraja: 1, ota_id: 1, kod: 'M3', nom: 'Mat', birlik: 'kg', hajm: 1, narx: 200000, summa: 200000, kat: 'МАТ' }),
    qator({ id: 5, tartib: 5, tur: 'ob', daraja: 1, ota_id: 1, kod: 'M4', nom: 'Ob', birlik: 'dona', hajm: 1, narx: 80000, summa: 80000, kat: 'ОБ' }),
    qator({ id: 6, tartib: 6, tur: 'mat', daraja: 1, ota_id: 1, kod: 'M5', nom: 'Kab', birlik: 'm', hajm: 1, narx: 20000, summa: 20000, kat: 'КАБ' }),
    qator({ id: 7, tartib: 7, tur: 'mat', daraja: 1, ota_id: 1, kod: 'M6', nom: 'Mk', birlik: 'kg', hajm: 1, narx: 30000, summa: 30000, kat: 'М/К' }),
  ];
  const KOEF = {
    ЗТР_СОЦСТРАХ: 0, ТРАНСПОРТ_МАТЕРИАЛ: 5, СКЛАДСКИЕ_МАТЕРИАЛ: 3, СКЛАДСКИЕ_МК: 2,
    ТРАНСПОРТ_КАБЕЛЬ: 4, ПРОЧИЕ_ПОДРЯДЧИК: 10, ТРАНСПОРТ_ОБОРУД: 6, ЗАГОТ_СКЛАД_ОБОРУД: 1,
    СТРАХОВАНИЕ: 0.5, РИСК: 0, НДС: 12,
  };
  // Qo'lda hisoblangan (SQL kaskadi bilan bir xil qadamlar):
  // pryamye=480000; tr_mat=11500; skl_mat=7200; tr_kab=800;
  // itogo1=419500; prochie=41950; itogo2=461450;
  // tr_ob=4800; zag_ob=800; itogo3=547050;
  // strax=2735.25; risk=0; itogo4=549785.25; nds=65974.23; vsego=615759.48

  it('ЖАМИ (H3) endi TO\'G\'RI keshlangan qiymatga ega (avval 0 edi)', async () => {
    const bytes = await lrvPlusFaylBaytlari(KAT_DARAXT, 'Nakrutka sinovi');
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    expect(ws['J3'].v).toBe(100000); // ЧЕЛ
    expect(ws['K3'].v).toBe(50000);  // МАШ
    expect(ws['L3'].v).toBe(200000); // МАТ
    expect(ws['M3'].v).toBe(80000);  // ОБ
    expect(ws['N3'].v).toBe(20000);  // КАБ
    expect(ws['O3'].v).toBe(30000);  // М/К
  });

  it('kaskad Excelning o\'zida ROUND bilan qayta hisoblanadigan formulalarga ega va keshlangan qiymatlar qo\'lda hisoblangan bilan mos', async () => {
    const bytes = await lrvPlusFaylBaytlari(KAT_DARAXT, 'Nakrutka sinovi', undefined, { nakrutka: KOEF });
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];

    // oxirgiMalumotQator = 3 + hisob.length (rz + 6 barg = 7 qator);
    // nakrutka sarlavhasi shundan +2, jadval sarlavhasi +3, 1-ma'lumot qatori +4.
    const oxirgiMalumot = 3 + 7;
    const r0 = oxirgiMalumot + 4;
    expect(ws[`F${r0}`].f).toContain('ROUND(');
    expect(ws[`F${r0}`].v).toBe(480000);
    expect(ws[`F${r0 + 5}`].v).toBe(419500);  // ИТОГО-1
    expect(ws[`F${r0 + 7}`].v).toBe(461450);  // ИТОГО-2
    expect(ws[`F${r0 + 10}`].v).toBe(547050); // ИТОГО-3
    expect(ws[`F${r0 + 13}`].v).toBe(549785.25); // ИТОГО-4
    expect(ws[`F${r0 + 15}`].v).toBe(615759.48); // ВСЕГО
    expect(ws[`E${r0 + 14}`].v).toBe(12); // НДС foizi -- tahrirlanadigan literal
  });

  it('nakrutka berilmasa jadval umuman qo\'shilmaydi (o\'ylab topilgan son yo\'q)', async () => {
    const bytes = await lrvPlusFaylBaytlari(KAT_DARAXT, 'Nakrutkasiz');
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['LRV_PLUS'];
    const oxirgiMalumot = 3 + 7;
    expect(ws[`B${oxirgiMalumot + 3}`]).toBeUndefined();
  });
});

describe('Forma-2 rejimi — LRV_PLUS ning O ustunigacha bo\'lgan qismi bilan aynan bir xil', () => {
  it('faqat A..O + ЗАМЕЧАНИЕ + yashirin Даража/КАЛИТ, sarlavha o\'zgaradi', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Amfiteatr', HOLATLAR, {
      rejim: 'forma2', davr: '2026-07', raqam: 'Ф2-07',
    });
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual(['FORMA_2']);
    const ws = wb.Sheets['FORMA_2'];

    expect(ws['A1'].v).toContain('ФОРМА-2');
    expect(ws['A1'].v).toContain('Ф2-07');
    expect(ws['A1'].v).toContain('2026-07');

    // Ustun 15 (0-indeks) = ЗАМЕЧАНИЕ (P), keyin Даража (Q, yashirin), КАЛИТ (R, yashirin).
    expect(ws['P2'].v).toBe('ЗАМЕЧАНИЕ');
    expect(ws['Q2'].v).toBe('Даража');
    expect(ws['R2'].v).toBe('КАЛИТ');

    // FAKT/OSTATKA/F2 ustunlari (P..W to'liq rejimda) forma2 da YO'Q.
    const h = lrvPlusQatorlarniHisobla(DARAXT, HOLATLAR, 'Q');
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    expect(ws[`H${ishchi.row}`].f).toContain('F'); // СУММА hali A..O ichida, bor
    // Lekin to'liq rejimdagi FAKT sumasi ustuni (odatda T) forma2'da mavjud emas.
    expect(ws[`T${ishchi.row}`]).toBeUndefined();
  });

  it('formulalar va ranglar LRV_PLUS bilan bir xil (guruhlash, SUMIF, T1 rang sxemasi)', async () => {
    const bytes = await lrvPlusFaylBaytlari(DARAXT, 'Amfiteatr', HOLATLAR, { rejim: 'forma2' });
    const XLSX = await import('xlsx-js-style');
    const ws = XLSX.read(bytes, { type: 'array' }).Sheets['FORMA_2'];
    const h = lrvPlusQatorlarniHisobla(DARAXT, HOLATLAR, 'Q');
    const ishchi = h.find((r) => r.nom === 'Ishchi')!;
    const bl = h.find((r) => r.tur === 'bl')!;
    expect(ws[`F${ishchi.row}`].f).toBe(`E${ishchi.row}*F${bl.row}`);
    expect(ws[`H${bl.row}`].f).toContain('SUMIF');
    expect(ws[`H${bl.row}`].f).toContain('$Q$'); // forma2 rejimida yashirin Даража ustuni Q
  });
});

