import { describe, expect, it } from 'vitest';
import {
  RasmiyVaraq, bugunSana, hujjatFaylNomi, hujjatTekshir, imzoTomonlari, rasmiyKitob, sahifaEnigaSigdir, sumFormula, yaxlit2,
} from '.';

describe('hujjat-yozuvchi — yordamchilar', () => {
  it('yaxlit2 Excel ROUND(x;2) bilan bir xil (yarmi noldan uzoqqa)', () => {
    expect(yaxlit2(1.005)).toBe(1.01);
    expect(yaxlit2(-2.345)).toBe(-2.35);
    expect(yaxlit2(7407.402)).toBe(7407.4);
    expect(yaxlit2(0)).toBe(0);
  });

  it('fayl nomi: <Obyekt>_<Hujjat>_<davr>, taqiqlangan belgilar tozalanadi', () => {
    expect(hujjatFaylNomi({ obyekt: 'Парк: 1/2', hujjat: 'АКТ_Ф-2', davr: '2026-09' })).toBe('Парк_ 1_2_АКТ_Ф-2_2026-09.xlsx');
    expect(hujjatFaylNomi({ hujjat: 'СВОД', kengaytma: 'zip' })).toBe('СВОД.zip');
    expect(bugunSana(new Date(2026, 8, 5))).toBe('2026-09-05');
  });

  it('sumFormula ketma-ket qatorlarni siqadi', () => {
    expect(sumFormula('H', [5, 6, 7, 9])).toBe('SUM(H5:H7,H9)');
    expect(sumFormula('H', [])).toBeNull();
  });

  it('sahifaEnigaSigdir: egasining scale/fitToPage sozlamasiga tegmaydi, yo‘q bo‘lsa qo‘shadi', () => {
    const egasi = '<worksheet><sheetData/><pageMargins left="1"/><pageSetup paperSize="8" scale="55"/></worksheet>';
    expect(sahifaEnigaSigdir(egasi)).toBe(egasi);
    const bosh = '<worksheet><sheetData/><pageMargins left="1"/></worksheet>';
    const y = sahifaEnigaSigdir(bosh);
    expect(y).toContain('<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    expect(y).toContain('<pageMargins left="1"/><pageSetup paperSize="9" fitToWidth="1" fitToHeight="0"/>');
  });
});

describe('hujjatTekshir — salbiy nazorat (tekshiruvchi haqiqatan ushlaydi)', () => {
  it('$ li formula, keshsiz formula, texnik va o‘zbekcha matn topiladi', () => {
    const v = new RasmiyVaraq({ nom: 'Лист', sarlavha: 'ТЕСТ', ustunlar: [{ sarlavha: 'Наименование', kenglik: 30, tur: 'matn' }, { sarlavha: 'Сумма', kenglik: 12, tur: 'pul' }] });
    v.qator('oddiy', ['TAYYOR', { f: '$B$1*2', v: 2 }]);
    v.qator('oddiy', ['Жами ҳажм', { f: 'B5*2', v: null }]);
    v.qator('oddiy', ['t2_qator_holat', 1]);
    v.imzo(imzoTomonlari(['ЗАКАЗЧИК']));
    const t = hujjatTekshir(rasmiyKitob([v]).bytes);
    expect(t.dollarFormulalar.map((x) => x.f)).toEqual(['$B$1*2']);
    expect(t.keshsizFormulalar.map((x) => x.f)).toEqual(['B5*2']);
    expect(t.taqiqlangan.map((x) => x.qoida).sort()).toEqual(['RPC/jadval nomi', 'TAYYOR', 'o‘zbekcha kirill (ў қ ғ ҳ)']);
  });
});
