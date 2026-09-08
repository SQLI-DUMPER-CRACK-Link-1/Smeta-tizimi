import { describe, expect, it } from 'vitest';
import { resSatrlariniOl, resNarxIndeksiQur, narxlarniDaraxtgaQoll, katTaxmini, varaqTuriTaxmin, resBolimKategoriya } from './SmetaYuklaNative';
import type { AktNode } from '../../lib/f2-match-engine';
import type { F2ColumnConfig } from '../../lib/f2-import-parse';

const cols: F2ColumnConfig = { kod: 0, nom: 1, bir: 2, norma: -1, obyom: -1, narx: 3, sum: -1 };

describe('RES (resursniy vedomost) narx moslashtirish', () => {
  it('kod, nom va birlik ustunlaridan narx katalogini quradi', () => {
    const rows = [
      ['B25', 'Beton B25', 'm3', '500000'],
      ['', 'Armatura', 'kg', '12000,5'],
      ['1', '2', '3', '4'], // ustun-raqamlash qatori -- rad etiladi
      ['', '', '', ''],
    ];
    const satrlar = resSatrlariniOl(rows, cols);
    expect(satrlar).toEqual([
      { kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 500000 },
      { kod: undefined, nom: 'Armatura', birlik: 'kg', narx: 12000.5 },
    ]);
  });

  it('kod ustuvor, topilmasa nom+birlik bo‘yicha moslashadi', () => {
    const idx = resNarxIndeksiQur([
      { kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 500000 },
      { nom: 'Armatura', birlik: 'kg', narx: 12000 },
    ]);
    expect(idx.byKod.get('B25')).toBe(500000);
    expect(idx.byNomBir.get('ARMATURA|KG')).toBe(12000);
  });

  it('LRV daraxtidagi narxsiz rs bargiga RES narxini qo‘llaydi va summa=hajm*narx hisoblaydi', () => {
    const tree: AktNode[] = [{
      uid: '1', type: 'rz', nom: 'Fundament', children: [{
        uid: '2', type: 'bl', nom: 'Beton ishlari', children: [
          { uid: '3', type: 'rs', kod: 'B25', nom: 'Beton B25', bir: 'm3', hajm: 10 },
        ],
      }],
    }];
    const idx = resNarxIndeksiQur([{ kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 500000 }]);
    const { tree: out, mosSoni, mosEmasSoni } = narxlarniDaraxtgaQoll(tree, idx);
    const rs = out[0].children![0].children![0];
    expect(rs.narx).toBe(500000);
    expect(rs.summa).toBe(5000000);
    expect(mosSoni).toBe(1);
    expect(mosEmasSoni).toBe(0);
  });

  it('LRV faylida allaqachon narx bor bargni ustidan yozmaydi', () => {
    const tree: AktNode[] = [{
      uid: '1', type: 'rs', kod: 'B25', nom: 'Beton B25', bir: 'm3', hajm: 10, narx: 1, summa: 10,
    }];
    const idx = resNarxIndeksiQur([{ kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 999999 }]);
    const { tree: out } = narxlarniDaraxtgaQoll(tree, idx);
    expect(out[0].narx).toBe(1);
    expect(out[0].summa).toBe(10);
  });

  it('mos kelmagan bargni jim narxsiz qoldiradi, taxmin qilmaydi', () => {
    const tree: AktNode[] = [{ uid: '1', type: 'rs', kod: 'YOQ', nom: 'Nomalum', bir: 'dona', hajm: 5 }];
    const { tree: out, mosSoni, mosEmasSoni } = narxlarniDaraxtgaQoll(tree, resNarxIndeksiQur([]));
    expect(out[0].narx).toBeUndefined();
    expect(mosSoni).toBe(0);
    expect(mosEmasSoni).toBe(1);
  });

  /* ⚠️ Haqiqiy nosozlik, obyekt 26 («Fast Food 1etaj») da tasdiqlangan:
     narxsiz LRV faylida narx ustuni bo'sh emas, 0 bo'lib keladi. Avvalgi
     shart (`narx != null`) tufayli bunday barglar «allaqachon narxlangan»
     deb butunlay tashlab ketilardi -- ekranda «0 ta mos, 0 ta narxsiz
     qoldi» (ikkala hisoblagich ham nol), smeta esa narx=0 bilan yozilardi. */
  it('narx=0 bo‘lgan bargni «narxsiz» deb hisoblaydi va RES narxini qo‘llaydi', () => {
    const tree: AktNode[] = [
      { uid: '1', type: 'rs', kod: '1', nom: 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', bir: 'ЧЕЛ.-Ч', hajm: 9.3139, narx: 0, summa: 0 },
    ];
    const idx = resNarxIndeksiQur([{ kod: '1', nom: 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', birlik: 'ЧЕЛ.-Ч', narx: 20000 }]);
    const { tree: out, mosSoni, mosEmasSoni } = narxlarniDaraxtgaQoll(tree, idx);
    expect(out[0].narx).toBe(20000);
    expect(out[0].summa).toBe(186278);
    expect(mosSoni).toBe(1);
    expect(mosEmasSoni).toBe(0);
  });

  it('narx=0 va mos kelmasa -- «narxsiz qoldi» deb SANAYDI (jim o‘tkazib yubormaydi)', () => {
    const tree: AktNode[] = [{ uid: '1', type: 'rs', kod: 'YOQ', nom: 'Nomalum', bir: 'dona', hajm: 5, narx: 0 }];
    const { mosSoni, mosEmasSoni } = narxlarniDaraxtgaQoll(tree, resNarxIndeksiQur([]));
    expect(mosSoni).toBe(0);
    expect(mosEmasSoni).toBe(1);
  });

  /* Ikki mustaqil Excel hujjati bir resursni bir xil yozmaydi -- kalit
     registr/bo'sh joy/tinish belgisi/«ё»/«м³» farqlariga bardosh berishi
     kerak (bazadagi t2_resurs_nom_kalit bilan bir xil g'oya). */
  it('kalit registr, bo‘sh joy, nuqta, «Ё» va «м³» farqlariga qaramay moslaydi', () => {
    const tree: AktNode[] = [
      { uid: '1', type: 'rs', nom: '  бетон   тяжёлый  ', bir: 'м³', hajm: 2 },
      { uid: '2', type: 'rs', nom: 'ЗАТРАТЫ ТРУДА', bir: 'ЧЕЛ.-Ч', hajm: 3 },
    ];
    const idx = resNarxIndeksiQur([
      { nom: 'БЕТОН ТЯЖЕЛЫЙ', birlik: 'М3', narx: 700000 },
      { nom: 'Затраты труда', birlik: 'чел-ч', narx: 25000 },
    ]);
    const { tree: out, mosSoni, mosEmasSoni } = narxlarniDaraxtgaQoll(tree, idx);
    expect(out[0].narx).toBe(700000);
    expect(out[1].narx).toBe(25000);
    expect(mosSoni).toBe(2);
    expect(mosEmasSoni).toBe(0);
  });
});

/* Bu blokdagi ma'lumot egasining Drive'idagi HAQIQIY RES fayllaridan
   olingan (Navoiy KL-10 kV va Karting loyihalari) -- bo'lim sarlavhalari,
   ularning ketma-ketligi va ИТОГО qatorlari aynan o'sha ko'rinishda. */
describe('RES bo‘lim sarlavhalari — МАТ/ОБ/КАБ/М-К ni ajratish', () => {
  it('haqiqiy RES sarlavhalarini kategoriyaga o‘giradi', () => {
    expect(resBolimKategoriya('ТРУДОВЫЕ РЕСУРСЫ')).toBe('ЧЕЛ');
    expect(resBolimKategoriya('СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ')).toBe('МАШ');
    expect(resBolimKategoriya('МАТЕРИАЛЬНЫЕ РЕСУРСЫ')).toBe('МАТ');
    expect(resBolimKategoriya('КОНСТРУКЦИИ ЗАВОДСКОГО ИЗГОТОВЛЕНИЯ')).toBe('М/К');
    expect(resBolimKategoriya('ОБОРУДОВАНИЕ')).toBe('ОБ');
  });

  it('ИТОГО/ЖАМИ/ВСЕГО bo‘limni yopadi', () => {
    expect(resBolimKategoriya('ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ:')).toBe('YAKUN');
    expect(resBolimKategoriya('ИТОГО ОБОРУДОВАНИЕ:')).toBe('YAKUN');
    expect(resBolimKategoriya('ЖАМИ')).toBe('YAKUN');
  });

  it('oddiy resurs nomi sarlavha deb qabul qilinmaydi', () => {
    expect(resBolimKategoriya('КИРПИЧ')).toBeNull();
    expect(resBolimKategoriya('ПЕСОК')).toBeNull();
    expect(resBolimKategoriya('ШЛИФКРУГИ')).toBeNull();
  });

  /* ⭐ Asosiy talab: «materialni va oborudovaniyani ham ajrata oladigan
     bo'lishi kerak». Birlik BUNI AYTMAYDI -- «РЕКЛАМНЫЙ БАННЕР» М2 da,
     «КОНЦЕВАЯ КАБЕЛЬНАЯ МУФТА» КОМПЛ da, ikkalasi ham ОБОРУДОВАНИЕ;
     «КИРПИЧ» esa ШТ da, lekin МАТЕРИАЛЬНЫЕ РЕСУРСЫ. Yagona ishonchli
     manba -- bo'lim sarlavhasi. */
  it('bir xil birlikdagi resurslarni bo‘limiga qarab МАТ va ОБ ga ajratadi', () => {
    const cols = { kod: 0, nom: 1, bir: 2, norma: -1, obyom: -1, narx: 3, sum: -1 };
    const rows = [
      ['', 'МАТЕРИАЛЬНЫЕ РЕСУРСЫ', '', ''],
      ['30-2', 'КИРПИЧ', 'ШТ', '1200'],
      ['30-3', 'ПЕСОК', 'М3', '120000'],
      ['', 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ:', 'СУМ', ''],
      ['', 'КОНСТРУКЦИИ ЗАВОДСКОГО ИЗГОТОВЛЕНИЯ', '', ''],
      ['30-4', 'КАБЕЛЬ АПВПУ-1Х240', 'М', '123956.25'],
      ['', 'ИТОГО КОНСТРУКЦИИ ЗАВОДСКОГО ИЗГОТОВЛЕНИЯ:', 'СУМ', ''],
      ['', 'ОБОРУДОВАНИЕ', '', ''],
      ['10-6', 'КОНЦЕВАЯ КАБЕЛЬНАЯ МУФТА ПКНТ(Н)-0-10-150-240', 'КОМПЛ', '3000000'],
      ['1', 'РЕКЛАМНЫЙ БАННЕР', 'М2', '45000'],
      ['', 'ИТОГО ОБОРУДОВАНИЕ:', 'СУМ', ''],
    ];
    const satrlar = resSatrlariniOl(rows, cols);
    expect(satrlar.map(s => [s.nom, s.kat])).toEqual([
      ['КИРПИЧ', 'МАТ'],
      ['ПЕСОК', 'МАТ'],
      ['КАБЕЛЬ АПВПУ-1Х240', 'М/К'],
      ['КОНЦЕВАЯ КАБЕЛЬНАЯ МУФТА ПКНТ(Н)-0-10-150-240', 'ОБ'],
      ['РЕКЛАМНЫЙ БАННЕР', 'ОБ'],
    ]);
    // Birlik hech narsa demasligining isboti: ikkalasi ham "dona"ga o'xshash,
    // lekin biri МАТ, ikkinchisi ОБ.
    expect(katTaxmini('КИРПИЧ', 'ШТ')).toBe('МАТ');
    expect(katTaxmini('РЕКЛАМНЫЙ БАННЕР', 'М2')).toBe('МАТ'); // birlik yolg'on ko'rsatadi
  });

  /* T1 (10_Engine.js) da bir marta yuz bergan xato: «ЗАТРАТЫ ТРУДА
     РАБОЧИХ-СТРОИТЕЛЕЙ» resursi «ЗАТРАТЫ ТРУДА» sarlavhasi deb o'qilib,
     narxi yo'qolgan. Shuning uchun sarlavha FAQAT narxsiz qatorda. */
  it('narxi bor «ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ» resurs bo‘lib qoladi, sarlavha emas', () => {
    const cols = { kod: 0, nom: 1, bir: 2, norma: -1, obyom: -1, narx: 3, sum: -1 };
    const satrlar = resSatrlariniOl([
      ['', 'ТРУДОВЫЕ РЕСУРСЫ', '', ''],
      ['1', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ.-Ч', '46235.07'],
    ], cols);
    expect(satrlar).toHaveLength(1);
    expect(satrlar[0].narx).toBe(46235.07);
    expect(satrlar[0].kat).toBe('ЧЕЛ');
  });

  it('indeks kategoriyani kod va nom+birlik bo‘yicha eslab qoladi', () => {
    const idx = resNarxIndeksiQur([
      { kod: '10-6', nom: 'МУФТА', birlik: 'КОМПЛ', narx: 3000000, kat: 'ОБ' },
      { kod: '30-2', nom: 'КИРПИЧ', birlik: 'ШТ', narx: 1200, kat: 'МАТ' },
    ]);
    expect(idx.katByKod.get('106')).toBe('ОБ');
    expect(idx.katByNomBir.get('МУФТА|КОМПЛ')).toBe('ОБ');
    expect(idx.katByKod.get('302')).toBe('МАТ');
  });
});

describe('varaqTuriTaxmin (owner: bitta faylda ham LRV, ham RES varaqlari bo‘lishi mumkin)', () => {
  const sarlavha = [
    ['№', 'ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И ЗАТРАТ', 'ЕД. ИЗМ.', 'КОЛИЧЕСТВО', '', 'СТОИМОСТЬ, СУМ', ''],
    ['', '', '', '', 'на единицу', 'по проектным данным', 'на.ед.изм', 'общая'],
  ];

  it('hajm (obyom) ustuni ko‘p to‘ldirilgan bo‘lsa LRV deb taxmin qiladi (narxsiz bo‘lsa ham)', () => {
    const rows = [
      ...sarlavha,
      ['1', 'K1', 'Ish 1', 'м3', '', '10', '', ''],
      ['2', 'K2', 'Ish 2', 'м3', '', '20', '', ''],
      ['3', 'K3', 'Ish 3', 'м3', '', '15', '', ''],
      ['4', 'K4', 'Ish 4', 'м3', '', '30', '', ''],
    ];
    expect(varaqTuriTaxmin(rows)).toBe('lrv');
  });

  it('narx deyarli har qatorda bor, hajm deyarli yo‘q bo‘lsa RES deb taxmin qiladi', () => {
    const rows = [
      ...sarlavha,
      ['1', 'R1', 'Resurs 1', 'кг', '', '', '5000', ''],
      ['2', 'R2', 'Resurs 2', 'кг', '', '', '12000', ''],
      ['3', 'R3', 'Resurs 3', 'шт', '', '', '800000', ''],
      ['4', 'R4', 'Resurs 4', 'м', '', '', '15000', ''],
    ];
    expect(varaqTuriTaxmin(rows)).toBe('res');
  });

  it('ma’lumot juda kam bo‘lsa taxmin qilmaydi -- noma’lum qaytaradi', () => {
    const rows = [...sarlavha, ['1', 'X1', 'Nomalum 1', 'dona', '', '', '', '']];
    expect(varaqTuriTaxmin(rows)).toBe('nomalum');
  });

  it('bo‘sh/mazmunsiz varaqni taxmin qilmaydi', () => {
    expect(varaqTuriTaxmin([['x'], [], []])).toBe('nomalum');
  });
});

describe('katTaxmini (mijoz tomoni ko‘rib chiqish uchun taxmin)', () => {
  it('birlikda ЧЕЛ bo‘lsa ЧЕЛ', () => expect(katTaxmini('Ishchi', 'чел-час')).toBe('ЧЕЛ'));
  it('birlikda МАШ bo‘lsa МАШ', () => expect(katTaxmini('Kran', 'маш-час')).toBe('МАШ'));
  it('nomda ТРУДА МАШИНИСТОВ bo‘lsa МАШ', () => expect(katTaxmini('Затраты труда машинистов', 'чел-час')).toBe('МАШ'));
  it('boshqa hollarda МАТ (standart) -- ОБ/КАБ/М-К hech qachon taxmin qilinmaydi', () => {
    expect(katTaxmini('Кабель ВВГ 3х2,5', 'м')).toBe('МАТ');
    expect(katTaxmini('Экскаватор', 'шт')).toBe('МАТ');
  });
});
