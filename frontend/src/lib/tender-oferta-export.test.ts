import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync, zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { readXlsx } from './f2-import-parse';
import { ofertaResursVaraqlariniAniqla, ofertaTanlanganQatorlari } from './tender-oferta-parser';
import { ofertaHisobla } from './tender-oferta';
import { tenderOfertaXlsx } from './tender-oferta-export';
import { NAKRUTKA_STANDART } from './nakrutka-kaskad';

/** Sintetik RES (ABC4 RES_A shakli) + tegilmaydigan LRV varag'i. */
function manbaKitob(): Uint8Array {
  const res = XLSX.utils.aoa_to_sheet([
    ['НАИМЕНОВАНИЕ СТРОЙКИ: SINOV'],
    [],
    ['№№', 'НАИМЕНОВАНИЕ РЕСУРСА', 'ЕД.ИЗМ', 'КОЛ-ВО', 'ЦЕНА', 'СУММА'],
    [1, 2, 3, 4, 5, 6],
    ['ТРУДОВЫЕ РЕСУРСЫ'],
    [1, 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', 100, 50000, 5000000],
    [null, 'ИТОГО', null, null, null, 5000000],
    ['СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ'],
    [1, 'ПОРТЛАНДЦЕМЕНТ', 'Т', null, 800000, null],
    [2, 'ПЕСОК', 'М3', 20, 100000, 2000000],
    [null, 'ИТОГО', null, null, null, 2000000],
  ]);
  const lrv = XLSX.utils.aoa_to_sheet([['LRV — tegilmaydi'], ['№', 'НАИМЕНОВАНИЕ РАБОТ', 'ЕД.ИЗМ'], [1, 'ЗАСЫПКА', 'М3']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, res, 'RES');
  XLSX.utils.book_append_sheet(wb, lrv, 'LRV');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer);
}

/** .xlsm: VBA qismi qo'shiladi (bayt-bayt saqlanishi kerak). */
function xlsmQil(xlsx: Uint8Array, vba: Uint8Array<ArrayBuffer>): Uint8Array {
  const files = unzipSync(xlsx);
  files['xl/vbaProject.bin'] = new Uint8Array(vba);
  files['[Content_Types].xml'] = new TextEncoder().encode(strFromU8(files['[Content_Types].xml'])
    .replace('</Types>', '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>'));
  return zipSync(files);
}

async function eksport(bytes: Uint8Array, faylNomi = 'res.xlsx') {
  const wb = await readXlsx(bytes);
  const tahlillar = ofertaResursVaraqlariniAniqla(wb);
  const tanlangan = ['RES'];
  const qatorlar = ofertaTanlanganQatorlari(tahlillar, tanlangan);
  const sement = qatorlar.find((q) => q.nom === 'ПОРТЛАНДЦЕМЕНТ')!;
  const hisob = ofertaHisobla(qatorlar, {
    sozlama: { rejim: 'qolda' },
    manualNarxlar: Object.fromEntries(qatorlar.filter((q) => q.rol === 'RESOURCE').map((q) => [q.sourceId, q.smetaBirlikNarx])),
    manualHajmlar: { [sement.sourceId]: 10 },
    manualKategoriyalar: {},
    nakrutka: NAKRUTKA_STANDART,
  });
  const natija = await tenderOfertaXlsx({ manbaFaylNomi: faylNomi, manbaBytes: bytes, tanlanganVaraqlar: tanlangan, tahlillar, hisob });
  return { natija, hisob, sement };
}

const cellsOf = (xml: string) => [...xml.matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map((m) => m[0]);

describe('tender oferta eksport — asl fayl saqlanadi', () => {
  it('o‘zgarmagan ZIP qismlari bayt-bayt identik; o‘zgargan varaqda asl kataklar identik', async () => {
    const asl = manbaKitob();
    const { natija } = await eksport(asl);
    expect(natija.saqlanish).toBe('toliq');
    const a = unzipSync(asl), b = unzipSync(natija.bytes);
    const ozgarishiMumkin = new Set(['xl/worksheets/sheet1.xml', 'xl/styles.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', '[Content_Types].xml', 'docProps/app.xml']);
    for (const [nom, bayt] of Object.entries(a)) {
      expect(b[nom], `${nom} yo‘qolmasin`).toBeDefined();
      if (!ozgarishiMumkin.has(nom)) expect(Buffer.from(b[nom]).equals(Buffer.from(bayt)), `${nom} bayt-bayt`).toBe(true);
    }
    const aslCells = cellsOf(strFromU8(a['xl/worksheets/sheet1.xml']));
    const yangiXml = strFromU8(b['xl/worksheets/sheet1.xml']);
    for (const c of aslCells) expect(yangiXml.includes(c), `asl katak saqlansin: ${c.slice(0, 60)}`).toBe(true);
  });

  it('.xlsm — vbaProject.bin bayt-bayt saqlanadi', async () => {
    const vba = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3, 4, 5]);
    const { natija } = await eksport(xlsmQil(manbaKitob(), vba), 'res.xlsm');
    expect(natija.faylNomi).toMatch(/\.xlsm$/);
    expect(Buffer.from(unzipSync(natija.bytes)['xl/vbaProject.bin']).equals(Buffer.from(vba))).toBe(true);
  });

  it('P0: manba hajm bo‘sh + taklif hajmi 10 × 800 000 — formula TAKLIF HAJMI ustuniga qaraydi (sayt = Excel)', async () => {
    const { natija, hisob, sement } = await eksport(manbaKitob());
    const u = natija.ustunlar.RES;
    const xml = strFromU8(unzipSync(natija.bytes)['xl/worksheets/sheet1.xml']);
    const r = sement.sourceRow;
    const summa = xml.match(new RegExp(`<c r="${u.summa}${r}"[^>]*>([\\s\\S]*?)</c>`))![1];
    const f = summa.match(/<f>([^<]*)<\/f>/)![1];
    expect(f).toContain(`${u.hajm}${r}`);
    expect(f).not.toContain(`D${r}`); // manba hajm ustuni emas
    expect(Number(summa.match(/<v>([^<]*)<\/v>/)![1])).toBe(8000000);
    expect(hisob.qatorlar.find((q) => q.sourceId === sement.sourceId)!.pudratchiSumma).toBe(8000000);
    const hajmKatak = xml.match(new RegExp(`<c r="${u.hajm}${r}"[^>]*>([\\s\\S]*?)</c>`))![1];
    expect(Number(hajmKatak.match(/<v>([^<]*)<\/v>/)![1])).toBe(10);
  });

  it('formulalarda $ yo‘q; styles.xml ga yangi rang qo‘shilmaydi; yangi katak qo‘shni asl uslubni oladi', async () => {
    const asl = manbaKitob();
    const { natija, sement } = await eksport(asl);
    const b = unzipSync(natija.bytes);
    const formulalar = Object.entries(b).filter(([n]) => n.startsWith('xl/worksheets/'))
      .flatMap(([, x]) => [...strFromU8(x).matchAll(/<f>([^<]*)<\/f>/g)].map((m) => m[1]));
    expect(formulalar.length).toBeGreaterThan(0);
    expect(formulalar.filter((f) => f.includes('$'))).toEqual([]);
    const fills = (x: string) => (x.match(/<fill>/g) || []).length;
    expect(fills(strFromU8(b['xl/styles.xml']))).toBe(fills(strFromU8(unzipSync(asl)['xl/styles.xml'])));
    const xml = strFromU8(b['xl/worksheets/sheet1.xml']);
    const r = sement.sourceRow;
    const qator = xml.match(new RegExp(`<row r="${r}"[^>]*>([\\s\\S]*?)</row>`))![1];
    const aslQator = strFromU8(unzipSync(asl)['xl/worksheets/sheet1.xml']).match(new RegExp(`<row r="${r}"[^>]*>([\\s\\S]*?)</row>`))![1];
    const aslS = [...aslQator.matchAll(/<c\b[^>]*?\bs="(\d+)"/g)].map((m) => m[1]).at(-1) ?? null;
    const yangiS = [...qator.matchAll(/<c r="([A-Z]+)\d+"[^>]*?\bs="(\d+)"/g)].filter(([, col]) => col >= natija.ustunlar.RES.kategoriya).map((m) => m[2]);
    if (aslS != null) expect(new Set(yangiS)).toEqual(new Set([aslS]));
  });
});
