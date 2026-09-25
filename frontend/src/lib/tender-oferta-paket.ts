/**
 * Tender oferta PAKETI — bir tenderda bir nechta obyekt/hujjat (RES fayllari).
 *
 * Qoidalar:
 *   - paketdagi barcha fayllar BIRGA narxlanadi: ayni material (nom + birlik)
 *     hamma obyektda bir xil taklif narxini oladi (panelda bir marta);
 *   - har bir obyekt (fayl) o'z asl faylida, o'z OFERTA_JAMI svodi bilan
 *     eksport qilinadi — yig'indilar faqat o'sha faylning qatorlaridan;
 *   - paket svodi: obyektlar bo'yicha yakuniy oferta va smeta, jami SUM
 *     formulasi bilan (sayt ko'rsatgan son = Excel).
 */
import { strToU8, zipSync, type Zippable } from 'fflate';
import type { NakrutkaKoeffitsientlar } from '../api/t2-nakrutka';
import { ofertaYigish, type OfertaHisoblash, type OfertaPodval, type OfertaQator, type OfertaQatorNatija, type OfertaTransportSiyosati } from './tender-oferta';
import { ofertaTanlanganQatorlari, type OfertaSheetTahlili } from './tender-oferta-parser';

export type OfertaPaketFayl = {
  /** Paket ichida yagona qisqa kalit (sourceId prefiksi). */
  id: string;
  /** Obyekt nomi (sukut: fayl nomi kengaytmasiz) — svod va varaq yorlig'ida. */
  nom: string;
  faylNomi: string;
  tahlillar: OfertaSheetTahlili[];
  tanlanganVaraqlar: string[];
};

const AJRAT = '|';
const VARAQ_AJRAT = ' › ';

const prefiksla = (id: string, sid: string) => `${id}${AJRAT}${sid}`;

/** Paketning barcha tanlangan qatorlari — sourceId fayl bilan prefikslangan,
 * bir nechta fayl bo'lsa varaq nomi oldiga obyekt nomi qo'shiladi. */
export function paketQatorlari(fayllar: readonly OfertaPaketFayl[]): OfertaQator[] {
  const kop = fayllar.length > 1;
  return fayllar.flatMap((f) => ofertaTanlanganQatorlari(f.tahlillar, f.tanlanganVaraqlar).map((q) => ({
    ...q,
    sourceId: prefiksla(f.id, q.sourceId),
    sourceSheet: kop ? `${f.nom}${VARAQ_AJRAT}${q.sourceSheet}` : q.sourceSheet,
    ...(q.jamiBolalari ? { jamiBolalari: q.jamiBolalari.map((b) => prefiksla(f.id, b)) } : {}),
  })));
}

const ajrat = (id: string, sid: string): string | null => (sid.startsWith(`${id}${AJRAT}`) ? sid.slice(id.length + 1) : null);

function podvalAsl(id: string, p: OfertaPodval | undefined): OfertaPodval | undefined {
  if (!p) return p;
  if (p.tur === 'foiz') return { ...p, baza: ajrat(id, p.baza) ?? p.baza };
  if (p.tur === 'yigindi') return { ...p, bazalar: p.bazalar.map((b) => ajrat(id, b) ?? b) };
  return p;
}

/** Paket hisobidan bitta faylning hisobi: qatorlar asl sourceId/varaq nomiga
 * qaytariladi (eksport asl faylni patch qiladi), yig'indilar faqat shu fayldan. */
export function paketFaylHisobi(hisob: OfertaHisoblash, fayl: OfertaPaketFayl, kopFayl: boolean, nk: NakrutkaKoeffitsientlar, transport: OfertaTransportSiyosati): OfertaHisoblash {
  const bosh = `${fayl.nom}${VARAQ_AJRAT}`;
  const qatorlar: OfertaQatorNatija[] = [];
  for (const q of hisob.qatorlar) {
    const sid = ajrat(fayl.id, q.sourceId);
    if (sid == null) continue;
    qatorlar.push({
      ...q,
      sourceId: sid,
      sourceSheet: kopFayl && q.sourceSheet.startsWith(bosh) ? q.sourceSheet.slice(bosh.length) : q.sourceSheet,
      ...(q.jamiBolalari ? { jamiBolalari: q.jamiBolalari.map((b) => ajrat(fayl.id, b) ?? b) } : {}),
      ...(q.podval ? { podval: podvalAsl(fayl.id, q.podval) } : {}),
    });
  }
  return ofertaYigish(qatorlar, nk, transport);
}

// ───────────────────────── paket svodi (XLSX) ─────────────────────────

export type PaketSvodObyekt = { nom: string; faylNomi: string; hisob: OfertaHisoblash };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const harf = (c: number) => String.fromCharCode(65 + c);

/** Paket svodi — oddiy, chegarali hujjat jadvali (yangi rang yo'q). */
export function paketSvodXlsx(obyektlar: readonly PaketSvodObyekt[], imzo?: { zakazchik?: string; pudratchi?: string }, sarlavha = 'СВОДНЫЙ РАСЧЕТ ОФЕРТЫ ПО ПАКЕТУ'): Uint8Array {
  type Katak = { c: number; s: number; t?: string; n?: number | null; f?: string };
  const rows: Katak[][] = [];
  const put = (k: Katak[]) => { rows.push(k); return rows.length; };
  // Uslublar: 0 oddiy, 1 sarlavha (qalin, chegara, markaz, wrap), 2 matn chegarali,
  // 3 son chegarali, 4 jami matn (qalin), 5 jami son (qalin), 6 qalin (chegarasiz)
  put([{ c: 1, s: 6, t: sarlavha }]);
  put([]);
  const hdr = ['№ п/п', 'ОБЪЕКТ', 'ПРЯМЫЕ ЗАТРАТЫ (оферта), сум', 'ВСЕГО С НДС (оферта), сум', 'ВСЕГО С НДС (по смете), сум', 'РАЗНИЦА, сум', 'ПРИМЕЧАНИЕ'];
  put(hdr.map((t, c) => ({ c, s: 1, t })));
  put(hdr.map((_t, c) => ({ c, s: 1, n: c + 1 })));
  const bosh = rows.length + 1;
  obyektlar.forEach((o, i) => {
    const r = rows.length + 1;
    const h = o.hisob;
    put([
      { c: 0, s: 2, n: i + 1 },
      { c: 1, s: 2, t: `${o.nom}` },
      { c: 2, s: 3, n: h.togridanJami },
      { c: 3, s: 3, n: h.yakuniyOferta },
      { c: 4, s: 3, n: h.manbaKaskad.vsego },
      { c: 5, s: 3, f: `IF(D${r}="","",D${r}-E${r})`, n: h.yakuniyOferta == null ? null : h.yakuniyOferta - h.manbaKaskad.vsego },
      { c: 6, s: 2, t: h.yakuniyOferta == null ? `не определено: ${h.halQilinmagan} поз. без цены/категории` : o.faylNomi },
    ]);
  });
  const oxir = rows.length;
  const hammasi = obyektlar.every((o) => o.hisob.yakuniyOferta != null);
  const jam = (k: (h: OfertaHisoblash) => number | null) => obyektlar.reduce((a, o) => a + (k(o.hisob) ?? 0), 0);
  const rJ = rows.length + 1;
  put([
    { c: 0, s: 4, t: '' },
    { c: 1, s: 4, t: 'ИТОГО ПО ПАКЕТУ' },
    { c: 2, s: 5, f: `SUM(C${bosh}:C${oxir})`, n: jam((h) => h.togridanJami) },
    { c: 3, s: 5, f: `IF(COUNTBLANK(D${bosh}:D${oxir})>0,"",SUM(D${bosh}:D${oxir}))`, n: hammasi ? jam((h) => h.yakuniyOferta) : null },
    { c: 4, s: 5, f: `SUM(E${bosh}:E${oxir})`, n: jam((h) => h.manbaKaskad.vsego) },
    { c: 5, s: 5, f: `IF(D${rJ}="","",D${rJ}-E${rJ})`, n: hammasi ? jam((h) => h.yakuniyOferta) - jam((h) => h.manbaKaskad.vsego) : null },
    { c: 6, s: 4, t: hammasi ? '' : 'итог не определен — есть позиции без цены' },
  ]);
  put([]); put([]);
  for (const [tomon, nom] of [['ЗАКАЗЧИК:', imzo?.zakazchik], ['ПОДРЯДЧИК:', imzo?.pudratchi]] as const) {
    put([{ c: 1, s: 0, t: `${tomon}  ${nom?.trim() || '________________________________________'}` }, { c: 3, s: 0, t: '____________________' }]);
    put([{ c: 1, s: 0, t: '(наименование организации, должность, Ф.И.О.)' }, { c: 3, s: 0, t: '(подпись)          М.П.' }]);
    put([]);
  }

  const cellXml = (k: Katak, r: number) => {
    const ref = `${harf(k.c)}${r}`;
    if (k.f) return k.n == null ? `<c r="${ref}" s="${k.s}" t="str"><f>${esc(k.f)}</f><v></v></c>` : `<c r="${ref}" s="${k.s}"><f>${esc(k.f)}</f><v>${k.n}</v></c>`;
    if (k.t != null) return `<c r="${ref}" s="${k.s}" t="inlineStr"><is><t xml:space="preserve">${esc(k.t)}</t></is></c>`;
    if (k.n != null) return `<c r="${ref}" s="${k.s}"><v>${k.n}</v></c>`;
    return `<c r="${ref}" s="${k.s}"/>`;
  };
  const sheetData = rows.map((k, i) => (k.length ? `<row r="${i + 1}">${k.map((x) => cellXml(x, i + 1)).join('')}</row>` : `<row r="${i + 1}"/>`)).join('');
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    + `<dimension ref="A1:G${rows.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>`
    + '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="46" customWidth="1"/><col min="3" max="6" width="22" customWidth="1"/><col min="7" max="7" width="40" customWidth="1"/></cols>'
    + `<sheetData>${sheetData}</sheetData>`
    + '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>';
  const b = '<left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Times New Roman"/></font><font><b/><sz val="11"/><name val="Times New Roman"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${b}</border></borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>'
    + '<xf numFmtId="4" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files: Zippable = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="СВОД ПАКЕТА" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
    'xl/styles.xml': strToU8(styles),
  };
  return zipSync(files, { level: 6 });
}

/** Paket arxivi: har bir obyektning OFERTA fayli + paket svodi. Nomlar
 * takrorlansa raqam qo'shiladi (bir fayl boshqasini yopib qo'ymasin). */
export function paketZip(fayllar: ReadonlyArray<{ nom: string; bytes: Uint8Array }>): Uint8Array {
  const z: Zippable = {};
  for (const f of fayllar) {
    let nom = f.nom;
    for (let i = 2; z[nom]; i++) nom = f.nom.replace(/(\.[^.]+)?$/, (e) => ` (${i})${e}`);
    z[nom] = [f.bytes, { level: 0 }];
  }
  return zipSync(z);
}
