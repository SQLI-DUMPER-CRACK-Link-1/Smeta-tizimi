/**
 * Tender oferta V2 eksporti — ASL workbookni SAQLAB, unga oferta qo'shadi.
 *
 * XLSX/XLSM uchun "surgical" OOXML patch: ZIP ichidagi barcha qismlar
 * (varaqlar, formulalar, merge, stil, ustun kengligi, qator balandligi,
 * yashirin holatlar, print sozlamalari, defined names, vbaProject.bin …)
 * BAYT-BAYT o'zgarmaydi. Faqat quyidagilar tahrirlanadi:
 *   - tanlangan RES/transport varaqlari XML'iga, ENG O'NG band ustundan
 *     keyin 5 ta yangi ustun hujayralari qo'shiladi (mavjud hujayraga
 *     tegilmaydi);
 *   - styles.xml ga yangi font/fill/xf YOZUVLARI qo'shiladi (mavjud
 *     indekslar o'zgarmaydi);
 *   - yangi `OFERTA_JAMI` varag'i (workbook.xml, rels, [Content_Types]).
 * Formulalar sayt hisobining aynan o'zi: ROUND(taklifHajmi*narx;2),
 * SUMIFS kategoriya asoslari va nakrutka kaskadi ayni tartibda. Keshlangan
 * <v> qiymatlar ham yoziladi, shuning uchun qayta hisoblamaydigan
 * ko'ruvchilar ham sayt bilan bir xil sonni ko'radi.
 *
 * .xls (BIFF8) ni bayt darajasida patch qilib bo'lmaydi: u SheetJS orqali
 * .xlsx ga o'giriladi va keyin xuddi shu patch qo'llanadi — bu holat
 * `saqlanish: 'qisman'` deb halol belgilanadi.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { OFERTA_KATEGORIYALAR, type OfertaHisoblash, type OfertaKategoriya, type OfertaQatorNatija } from './tender-oferta';
import type { OfertaSheetTahlili } from './tender-oferta-parser';
import { NAKRUTKA_KOEF_IZOH, NAKRUTKA_KOEF_KODLAR } from '../api/t2-nakrutka';

export type OfertaEksportInput = {
  obyektNomi?: string;
  manbaFaylNomi: string;
  manbaBytes: ArrayBuffer | Uint8Array;
  tanlanganVaraqlar: readonly string[];
  tahlillar: readonly OfertaSheetTahlili[];
  hisob: OfertaHisoblash;
  /** UI'da ko'rsatiladigan koeffitsient manbasi (kompaniya/standart). */
  koeffitsientManbasi?: string;
};

export type OfertaUstunHarflari = { kategoriya: string; hajm: string; narx: string; summa: string; holat: string };

export type OfertaEksportNatija = {
  bytes: Uint8Array;
  faylNomi: string;
  /** 'toliq' — asl OOXML qismlari bayt-bayt saqlangan; 'qisman' — .xls
   * SheetJS orqali .xlsx ga o'girilgan (stil/format qisman yo'qolishi mumkin). */
  saqlanish: 'toliq' | 'qisman';
  /** Yangi ustunlar qaysi varaqda qaysi harfda (tekshiruv/test uchun). */
  ustunlar: Record<string, OfertaUstunHarflari>;
  jamiVaraq: string;
  /** OFERTA_JAMI dagi yakuniy oferta hujayrasi (masalan "B52"). */
  yakuniyHujayra: string;
};

export const OFERTA_USTUN_SARLAVHALARI = ['Oferta kategoriya', 'Taklif hajmi', 'Pudratchi birlik narxi', 'Pudratchi taklif summasi', 'Oferta holati'] as const;

const MUAMMO_MATNI: Record<string, string> = {
  HAJM_YOQ: 'hajm yo‘q',
  PUDRATCHI_NARXI_YOQ: 'pudratchi narxi kiritilmagan',
  SMETA_NARXI_YOQ: 'smeta narxi yo‘q',
  SMETA_NARXI_NOL: 'smeta narxi 0 — foiz qo‘llanmaydi, narxni kiriting',
  FOIZ_XATO: 'foiz noto‘g‘ri',
  NARX_MANFIY: 'narx manfiy chiqdi',
  KATEGORIYA_NOMALUM: 'kategoriya noma’lum — kaskadga kirmaydi',
  JAMI_MOS_EMAS: 'manba jamisi bolalar yig‘indisiga mos emas',
};

export function ofertaMuammoMatni(m: string): string {
  return MUAMMO_MATNI[m] ?? m;
}

export function ofertaHolatMatni(q: OfertaQatorNatija): string {
  if (q.rol === 'INFO') return 'ma’lumot uchun — narxlanmaydi';
  if (q.hosila) return 'hosila xarajat — OFERTA_JAMI kaskadida qayta hisoblanadi';
  if (q.rol === 'SUBTOTAL' || q.rol === 'GRAND_TOTAL') {
    if (q.jamiMoslik === 'mos_emas') return MUAMMO_MATNI.JAMI_MOS_EMAS;
    return 'to‘g‘ridan-to‘g‘ri xarajat jami';
  }
  if (!q.muammolar.length) return 'TAYYOR';
  return q.muammolar.map(ofertaMuammoMatni).join('; ');
}

// ───────────────────────── yordamchilar ─────────────────────────

export function ustunHarfi(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function ustunIndeksi(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

const xmlEsc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sheetRef = (name: string): string => `'${name.replace(/'/g, "''")}'`;
const num = (n: number): string => (Object.is(n, -0) ? '0' : String(n));

function isZip(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

function safeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'resurs';
}

export function ofertaFaylNomi(manbaFaylNomi?: string, xlsdanOgirilgan = false): string {
  const source = safeFilePart(manbaFaylNomi || 'resurs.xlsx');
  const match = source.match(/\.(xlsx|xlsm|xls)$/i);
  const stem = match ? source.slice(0, -match[0].length) : source;
  let ext = match?.[1].toLowerCase() ?? 'xlsx';
  if (ext === 'xls' || xlsdanOgirilgan) ext = 'xlsx';
  return `${stem}_OFERTA.${ext}`;
}

// ───────────────────────── hujayra modeli ─────────────────────────

type YangiHujayra = { col: number; xml: (ref: string) => string };

function strCell(col: number, s: number, text: string): YangiHujayra {
  return { col, xml: (ref) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(text)}</t></is></c>` };
}
function numCell(col: number, s: number, v: number): YangiHujayra {
  return { col, xml: (ref) => `<c r="${ref}" s="${s}"><v>${num(v)}</v></c>` };
}
function fCell(col: number, s: number, f: string, v: number | string | null): YangiHujayra {
  return {
    col, xml: (ref) => {
      if (v == null) return `<c r="${ref}" s="${s}"><f>${xmlEsc(f)}</f></c>`;
      if (typeof v === 'string') return `<c r="${ref}" s="${s}" t="str"><f>${xmlEsc(f)}</f><v>${xmlEsc(v)}</v></c>`;
      return `<c r="${ref}" s="${s}"><f>${xmlEsc(f)}</f><v>${num(v)}</v></c>`;
    },
  };
}

// ───────────────────────── styles.xml ─────────────────────────

type Stillar = { header: number; text: number; kirish: number; natija: number; jami: number; son: number; sarlavha: number; foiz: number };

function appendToList(xml: string, tag: string, childTag: string, items: string[]): { xml: string; firstIndex: number } {
  const re = new RegExp(`<(\\w+:)?${tag}\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>)`);
  const m = xml.match(re);
  if (!m) throw new Error(`STYLES_${tag.toUpperCase()}_YOQ`);
  const p = m[1] ?? '';
  const inner = m[4] ?? '';
  const existing = (inner.match(new RegExp(`<${p}${childTag}\\b`, 'g')) || []).length;
  const attrs = m[2].replace(/\scount="\d+"/, '');
  const prefixed = items.map((it) => it.replace(/<(\/?)([a-zA-Z]+)/g, (_x, sl, t) => `<${sl}${p}${t}`));
  const replaced = `<${p}${tag}${attrs} count="${existing + items.length}">${inner}${prefixed.join('')}</${p}${tag}>`;
  return { xml: xml.replace(re, () => replaced), firstIndex: existing };
}

/* Egasi (2026-09-24): "ranglashni man o'zim uchun vizual qulaylikda bo'lishi
   uchun qilganman … hamma berayotgan hujjatingda o'zing ijod qilib tashlayapsan".
   Shuning uchun styles.xml ga RANG (fill) qo'shilmaydi. Asl varaqlardagi yangi
   kataklar uslubni o'sha qatordagi qo'shni asl katakdan oladi (varaqniPatchla);
   bu uslublar faqat yangi OFERTA_JAMI varag'i va qo'shni katak topilmagan holat
   uchun: default shrift, faqat qalinlik va son formati. */
function stillarQosh(stylesXml: string): { xml: string; s: Stillar } {
  let xml = stylesXml;
  const fonts = appendToList(xml, 'fonts', 'font', ['<font><b/></font>']);
  xml = fonts.xml;
  const fB = fonts.firstIndex;
  const al = '<alignment wrapText="1" vertical="center"/>';
  const xfs = appendToList(xml, 'cellXfs', 'xf', [
    `<xf numFmtId="0" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">${al}</xf>`,
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">${al}</xf>`,
    `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    `<xf numFmtId="4" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`,
    `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    `<xf numFmtId="0" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyFont="1"/>`,
    `<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
  ]);
  xml = xfs.xml;
  const b = xfs.firstIndex;
  return { xml, s: { header: b, text: b + 1, kirish: b + 2, natija: b + 3, jami: b + 4, son: b + 5, sarlavha: b + 6, foiz: b + 7 } };
}

// ───────────────────────── varaq XML patch ─────────────────────────

type VaraqPatch = { rows: Map<number, YangiHujayra[]>; widths: Array<{ col: number; width: number }> };

function prefiks(xml: string): string {
  const m = xml.match(/<(\w+:)?sheetData\b/);
  if (!m) throw new Error('SHEETDATA_YOQ');
  return m[1] ?? '';
}

/** Varaqdagi eng o'ng band ustun (hujayralar, dimension, merge). */
export function engOngUstun(xml: string): number {
  let max = 0;
  for (const m of xml.matchAll(/<(?:\w+:)?c\b[^>]*?\br="([A-Z]+)\d+"/g)) max = Math.max(max, ustunIndeksi(m[1]));
  for (const m of xml.matchAll(/<(?:\w+:)?mergeCell\b[^>]*?\bref="[A-Z]+\d+:([A-Z]+)\d+"/g)) max = Math.max(max, ustunIndeksi(m[1]));
  const dim = xml.match(/<(?:\w+:)?dimension\b[^>]*?\bref="([A-Z]+)\d+(?::([A-Z]+)\d+)?"/);
  if (dim) max = Math.max(max, ustunIndeksi(dim[2] ?? dim[1]));
  return max;
}

function varaqniPatchla(xml: string, patch: VaraqPatch, maxCol: number): string {
  const p = prefiks(xml);
  const rowRe = new RegExp(`<${p}row\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}row>)`, 'g');
  const sdRe = new RegExp(`<${p}sheetData\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}sheetData>)`);
  const sd = xml.match(sdRe);
  if (!sd) throw new Error('SHEETDATA_YOQ');
  const inner = sd[3] ?? '';
  const qolgan = new Map(patch.rows);
  /* Yangi katak uslubi — shu qatordagi eng o'ng ASL katakniki (egasining shrifti,
     chegarasi, son formati, rangi aynan davom etadi; yangi uslub o'ylab topilmaydi).
     Qatorda asl katak bo'lmasa — o'zimizning rangsiz uslub. */
  const qoshniUslub = (rowInner: string | undefined): string | null => {
    if (!rowInner) return null;
    const cs = [...rowInner.matchAll(new RegExp(`<${p}c\\b([^>]*?)\\/?>`, 'g'))];
    if (!cs.length) return null;
    const s = cs[cs.length - 1][1].match(/\bs="(\d+)"/);
    return s ? s[1] : '0';
  };
  const cellsXml = (r: number, cells: YangiHujayra[], qoshni: string | null = null) => [...cells]
    .sort((a, b) => a.col - b.col)
    .map((c) => c.xml(`${ustunHarfi(c.col)}${r}`))
    .join('')
    .replace(/ s="\d+"/g, (m) => (qoshni == null ? m : ` s="${qoshni}"`))
    .replace(/<(\/?)(c|f|v|is|t)\b/g, (_m, sl, tag) => `<${sl}${p}${tag}`);
  const newRow = (r: number, cells: YangiHujayra[]) => `<${p}row r="${r}">${cellsXml(r, cells)}</${p}row>`;
  const oldingilar = (rNum: number) => [...qolgan.keys()].filter((r) => r < rNum).sort((a, b) => a - b);

  let out = '';
  let lastIndex = 0;
  for (const m of inner.matchAll(rowRe)) {
    const attrs = m[1];
    const rNum = Number((attrs.match(/\br="(\d+)"/) || [])[1]);
    out += inner.slice(lastIndex, m.index);
    for (const r of oldingilar(rNum)) { out += newRow(r, qolgan.get(r)!); qolgan.delete(r); }
    const cells = qolgan.get(rNum);
    if (cells) {
      qolgan.delete(rNum);
      // spans — ixtiyoriy optimallashtirish atributi; yangi ustun uni buzmasin.
      const a = attrs.replace(/\sspans="[^"]*"/, '');
      out += m[2] === '/>' ? `<${p}row${a}>${cellsXml(rNum, cells)}</${p}row>` : `<${p}row${a}>${m[3]}${cellsXml(rNum, cells, qoshniUslub(m[3]))}</${p}row>`;
    } else {
      out += m[0];
    }
    lastIndex = (m.index ?? 0) + m[0].length;
  }
  out += inner.slice(lastIndex);
  for (const r of [...qolgan.keys()].sort((a, b) => a - b)) out += newRow(r, qolgan.get(r)!);

  let res = xml.replace(sdRe, () => `<${p}sheetData${sd[1]}>${out}</${p}sheetData>`);

  const newMax = maxCol + OFERTA_USTUN_SARLAVHALARI.length;
  res = res.replace(new RegExp(`(<${p}dimension\\b[^>]*?\\bref=")([A-Z]+)(\\d+)(?::([A-Z]+)(\\d+))?(")`), (_m, a, c1, r1, c2, r2, z) => {
    const endCol = Math.max(ustunIndeksi(c2 ?? c1), newMax);
    return `${a}${c1}${r1}:${ustunHarfi(endCol)}${r2 ?? r1}${z}`;
  });

  // Ustun kengliklari — mavjud <col> diapazoni bilan kesishmasa qo'shiladi.
  const colsRe = new RegExp(`<${p}cols\\b[^>]*>([\\s\\S]*?)<\\/${p}cols>`);
  const colsM = res.match(colsRe);
  const band: Array<[number, number]> = [];
  if (colsM) for (const m of colsM[1].matchAll(/\bmin="(\d+)"[^>]*?\bmax="(\d+)"/g)) band.push([Number(m[1]), Number(m[2])]);
  const yangi = patch.widths.filter((w) => !band.some(([a, b]) => w.col + 1 >= a && w.col + 1 <= b))
    .map((w) => `<${p}col min="${w.col + 1}" max="${w.col + 1}" width="${w.width}" customWidth="1"/>`).join('');
  if (yangi) {
    if (colsM) res = res.replace(colsRe, (all) => all.replace(new RegExp(`<\\/${p}cols>$`), `${yangi}</${p}cols>`));
    else res = res.replace(new RegExp(`<${p}sheetData\\b`), (m) => `<${p}cols>${yangi}</${p}cols>${m}`);
  }
  return res;
}

// ───────────────────────── formulalar ─────────────────────────

/** Ketma-ket qatorlarni diapazonga siqib SUM argumentlarini yasaydi. */
function sumArgs(col: string, rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${col}${sorted[i]}` : `${col}${sorted[i]}:${col}${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(',');
}

function foizFormula(f: { yon: string; foiz: number }): string {
  return `(1${f.yon === 'oshirish' ? '+' : '-'}${num(f.foiz)}/100)`;
}

function varaqPatchQur(tahlil: OfertaSheetTahlili, qatorlar: readonly OfertaQatorNatija[], maxCol: number, s: Stillar): { patch: VaraqPatch; harflar: OfertaUstunHarflari } {
  const [cK, cQ, cP, cS, cH] = [1, 2, 3, 4, 5].map((i) => maxCol + i);
  const L: OfertaUstunHarflari = { kategoriya: ustunHarfi(cK), hajm: ustunHarfi(cQ), narx: ustunHarfi(cP), summa: ustunHarfi(cS), holat: ustunHarfi(cH) };
  const rows = new Map<number, YangiHujayra[]>();
  const add = (r: number, c: YangiHujayra) => { const a = rows.get(r) ?? []; a.push(c); rows.set(r, a); };
  const headerRow = (tahlil.ustunlar?.sarlavhaBoshlanishi ?? 0) + 1;
  OFERTA_USTUN_SARLAVHALARI.forEach((t, i) => add(headerRow, strCell(maxCol + 1 + i, s.header, t)));

  const byId = new Map(qatorlar.map((q) => [q.sourceId, q]));
  for (const q of qatorlar) {
    const r = q.sourceRow;
    if (q.rol === 'SECTION') continue;
    const narxlanadi = q.rol === 'RESOURCE' || (q.rol === 'TRANSPORT' && q.hosila === false);
    if (narxlanadi) {
      add(r, strCell(cK, s.text, q.rol === 'RESOURCE' ? String(q.samaraliKategoriya ?? 'UNKNOWN') : 'TRANSPORT'));
      if (q.hisobTuri === 'birlik') {
        // effectiveOfferQuantity: override → konstanta (sariq), aks holda
        // manba hajm hujayrasiga havola (manba o'zgarmaydi, qayta yozilmaydi).
        if (q.taklifHajmiOverride != null) add(r, numCell(cQ, s.kirish, q.taklifHajmiOverride));
        else if (q.taklifHajmi != null && q.manbaHajmUstuni != null && q.manbaHajmUstuni >= 0 && q.manbaHajmSon) {
          add(r, fCell(cQ, s.son, `${ustunHarfi(q.manbaHajmUstuni)}${r}`, q.taklifHajmi));
        } else if (q.taklifHajmi != null) add(r, numCell(cQ, s.son, q.taklifHajmi));
        if (q.pudratchiBirlikNarx != null) add(r, numCell(cP, s.kirish, q.pudratchiBirlikNarx));
        if (q.pudratchiSumma != null && q.taklifHajmi != null && q.pudratchiBirlikNarx != null) {
          add(r, fCell(cS, s.natija, `ROUND(${L.hajm}${r}*${L.narx}${r},2)`, q.pudratchiSumma));
        }
      } else if (q.hisobTuri === 'manba_jami' && q.pudratchiSumma != null) {
        const src = q.manbaSummaUstuni != null && q.manbaSummaUstuni >= 0 && q.manbaSummaSon ? `${ustunHarfi(q.manbaSummaUstuni)}${r}` : null;
        if (q.narxManbasi !== 'qolda' && q.qollanganFoiz && src) add(r, fCell(cS, s.natija, `ROUND(${src}*${foizFormula(q.qollanganFoiz)},2)`, q.pudratchiSumma));
        else add(r, numCell(cS, q.narxManbasi === 'qolda' ? s.kirish : s.natija, q.pudratchiSumma));
      }
      add(r, strCell(cH, s.text, ofertaHolatMatni(q)));
      continue;
    }
    if (q.rol === 'SUBTOTAL' || q.rol === 'GRAND_TOTAL') {
      const kids = (q.jamiBolalari ?? []).map((id) => byId.get(id)).filter((k): k is OfertaQatorNatija => !!k)
        .filter((k) => k.rol === 'RESOURCE' || (k.rol === 'TRANSPORT' && k.hosila === false) || k.rol === 'SUBTOTAL' || k.rol === 'GRAND_TOTAL');
      if (q.pudratchiSumma != null && kids.length) add(r, fCell(cS, s.jami, `SUM(${sumArgs(L.summa, kids.map((k) => k.sourceRow))})`, q.pudratchiSumma));
      add(r, strCell(cH, s.text, ofertaHolatMatni(q)));
      continue;
    }
    add(r, strCell(cH, s.text, ofertaHolatMatni(q)));
  }
  return { patch: { rows, widths: [{ col: cK, width: 12 }, { col: cQ, width: 14 }, { col: cP, width: 18 }, { col: cS, width: 20 }, { col: cH, width: 36 }] }, harflar: L };
}

// ───────────────────────── OFERTA_JAMI ─────────────────────────

/** Tartib `ofertaHisobla` dagi kategoriya yig'ish tartibi bilan bir xil. */
const KAT_TARTIB: OfertaKategoriya[] = ['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'М/К', 'КАБ', 'БЕЗСКЛАД', 'UNKNOWN'];

function jamiVaraqXml(
  input: OfertaEksportInput,
  varaqlar: Array<{ nom: string; L: OfertaUstunHarflari }>,
  s: Stillar,
): { xml: string; yakuniyHujayra: string } {
  const h = input.hisob;
  const rows: Array<YangiHujayra[]> = [];
  const put = (cells: YangiHujayra[]) => { rows.push(cells); return rows.length; };
  const sumifs = (kat: string) => varaqlar.length
    ? varaqlar.map((v) => `SUMIFS(${sheetRef(v.nom)}!${v.L.summa}:${v.L.summa},${sheetRef(v.nom)}!${v.L.kategoriya}:${v.L.kategoriya},"${kat}")`).join('+')
    : '0';

  put([strCell(0, s.sarlavha, 'TENDER OFERTA — YAKUNIY HISOB')]);
  put([strCell(0, s.text, 'Obyekt'), strCell(1, s.text, input.obyektNomi || '')]);
  put([strCell(0, s.text, 'Manba fayl'), strCell(1, s.text, input.manbaFaylNomi)]);
  put([strCell(0, s.text, 'Nakrutka koeffitsientlari'), strCell(1, s.text, input.koeffitsientManbasi || 'T2 standart (t2_nakrutka_default_v1)')]);
  put([strCell(0, s.text, 'Material transport siyosati'), strCell(1, s.text, h.transportSiyosati === 'varaq' ? 'transport hisob varag‘idan (foiz qadami almashtirildi)' : 'kaskad foizi (ТРАНСПОРТ_МАТЕРИАЛ)')]);
  put([]);
  put([strCell(0, s.header, 'Ko‘rsatkich'), strCell(1, s.header, 'Pudratchi taklifi'), strCell(2, s.header, 'Manba (smeta)'), strCell(3, s.header, 'Izoh')]);

  const katRow: Partial<Record<OfertaKategoriya, number>> = {};
  for (const kat of KAT_TARTIB) {
    const izoh = kat === 'UNKNOWN' ? 'kategoriyasi aniqlanmagan resurslar — yakuniy summa ochilmaydi' : kat === 'БЕЗСКЛАД' ? 'material, sklad xarajatisiz' : '';
    katRow[kat] = put([
      strCell(0, s.text, kat === 'UNKNOWN' ? 'NOMA’LUM kategoriya' : kat),
      fCell(1, s.son, sumifs(kat), h.kategoriyaJami[kat]),
      numCell(2, s.son, h.manbaKategoriyaJami[kat]),
      strCell(3, s.text, izoh),
    ]);
  }
  put([
    strCell(0, s.sarlavha, 'TO‘G‘RIDAN-TO‘G‘RI XARAJATLAR JAMI'),
    fCell(1, s.jami, `SUM(B${katRow['ЧЕЛ']}:B${katRow.UNKNOWN})`, h.togridanJami),
    numCell(2, s.jami, h.manbaTogridanJami),
    strCell(3, s.text, 'faqat RESOURCE barglari; JAMI qatorlar qayta qo‘shilmaydi'),
  ]);
  const rTransport = put([
    strCell(0, s.text, 'Transport hisob varag‘i (pudratchi)'),
    fCell(1, s.son, sumifs('TRANSPORT'), h.transportVaraqJami),
    strCell(3, s.text, h.transportSiyosati === 'varaq' ? 'material transporti o‘rnida ishlatiladi' : 'dalil — kaskadga qo‘shilmaydi'),
  ]);
  put([]);
  put([strCell(0, s.header, 'Nakrutka koeffitsienti'), strCell(1, s.header, '%'), strCell(2, s.header, ''), strCell(3, s.header, 'Izoh')]);
  const kRow: Record<string, number> = {};
  for (const kod of NAKRUTKA_KOEF_KODLAR) {
    kRow[kod] = put([strCell(0, s.text, kod), numCell(1, s.foiz, h.koeffitsientlar[kod]), strCell(3, s.text, NAKRUTKA_KOEF_IZOH[kod])]);
  }
  put([]);
  put([strCell(0, s.header, 'Kaskad (t2_nakrutka_hisobla_v1)'), strCell(1, s.header, 'Pudratchi taklifi'), strCell(2, s.header, 'Manba (smeta)'), strCell(3, s.header, 'Formula')]);
  const B = (kat: OfertaKategoriya) => `B${katRow[kat]}`;
  const K = (kod: string) => `B${kRow[kod]}`;
  const x = h.kaskadXom, m = h.manbaKaskad;
  const step = (label: string, f: string, v: number, mv: number | null, izoh: string) =>
    put([strCell(0, s.text, label), fCell(1, s.son, f, v), ...(mv == null ? [] : [numCell(2, s.son, mv)]), strCell(3, s.text, izoh)]);
  const rChel = step('ЧЕЛ asos', B('ЧЕЛ'), h.asos.chel, null, '');
  const rMash = step('МАШ asos', B('МАШ'), h.asos.mash, null, '');
  const rMat = step('МАТ savati (МАТ+М/К+КАБ+БЕЗСКЛАД)', `${B('МАТ')}+${B('М/К')}+${B('КАБ')}+${B('БЕЗСКЛАД')}`, h.asos.mat, null, '');
  const rOb = step('ОБ asos', B('ОБ'), h.asos.ob, null, '');
  const rMk = step('shundan М/К', B('М/К'), h.asos.mk, null, '');
  const rKab = step('shundan КАБ', B('КАБ'), h.asos.kab, null, '');
  const rBez = step('shundan БЕЗСКЛАД', B('БЕЗСКЛАД'), h.asos.bez, null, '');
  const c = (r: number) => `B${r}`;
  const rPr = step('ПРЯМЫЕ ЗАТРАТЫ', `${c(rChel)}+${c(rMash)}+${c(rMat)}+${c(rOb)}`, x.pryamye, m.pryamye, 'chel+mash+mat+ob');
  const rTrMat = step('Транспорт — материаллар',
    h.transportSiyosati === 'varaq' ? c(rTransport) : `(${c(rMat)}-${c(rKab)})*${K('ТРАНСПОРТ_МАТЕРИАЛ')}/100`,
    x.tr_mat, m.tr_mat, h.transportSiyosati === 'varaq' ? 'transport varag‘idan' : '(mat−kab)×%');
  const rSkl = step('Склад — материаллар', `(${c(rMat)}-${c(rBez)}-${c(rMk)})*${K('СКЛАДСКИЕ_МАТЕРИАЛ')}/100+${c(rMk)}*${K('СКЛАДСКИЕ_МК')}/100`, x.skl_mat, m.skl_mat, '(mat−bez−mk)×% + mk×%');
  const rTrKab = step('Транспорт — кабель', `${c(rKab)}*${K('ТРАНСПОРТ_КАБЕЛЬ')}/100`, x.tr_kab, m.tr_kab, 'kab×%');
  const rI1 = step('ИТОГО 1', `${c(rPr)}-${c(rOb)}+${c(rTrMat)}+${c(rSkl)}+${c(rTrKab)}`, x.itogo1, m.itogo1, 'pryamye−ob+tr_mat+skl_mat+tr_kab');
  const rPro = step('Пудратчи бошқа харажатлари', `${c(rI1)}*${K('ПРОЧИЕ_ПОДРЯДЧИК')}/100`, x.prochie, m.prochie, 'itogo1×%');
  const rI2 = step('ИТОГО 2', `${c(rI1)}+${c(rPro)}`, x.itogo2, m.itogo2, '');
  const rTrOb = step('Транспорт — ускуна', `${c(rOb)}*${K('ТРАНСПОРТ_ОБОРУД')}/100`, x.tr_ob, m.tr_ob, 'ob×%');
  const rZag = step('Тайёрлов-склад — ускуна', `${c(rOb)}*${K('ЗАГОТ_СКЛАД_ОБОРУД')}/100`, x.zag_ob, m.zag_ob, 'ob×%');
  const rI3 = step('ИТОГО 3', `${c(rI2)}+${c(rOb)}+${c(rTrOb)}+${c(rZag)}`, x.itogo3, m.itogo3, 'itogo2+ob+tr_ob+zag_ob');
  const rSt = step('Суғурта', `${c(rI3)}*${K('СТРАХОВАНИЕ')}/100`, x.strax, m.strax, 'itogo3×%');
  const rRisk = step('Риск', `${c(rI3)}*${K('РИСК')}/100`, x.risk, m.risk, 'itogo3×%');
  const rI4 = step('ИТОГО 4', `${c(rI3)}+${c(rSt)}+${c(rRisk)}`, x.itogo4, m.itogo4, '');
  const rNds = step('ҚҚС (НДС)', `${c(rI4)}*${K('НДС')}/100`, x.nds, m.nds, 'itogo4×%');
  const rVs = step('ВСЕГО (yaxlitlanmagan)', `${c(rI4)}+${c(rNds)}`, x.vsego, m.vsego, '');
  put([]);
  const unresolved = varaqlar.length ? varaqlar.map((v) => {
    const kat = `${sheetRef(v.nom)}!${v.L.kategoriya}:${v.L.kategoriya}`;
    const sum = `${sheetRef(v.nom)}!${v.L.summa}:${v.L.summa}`;
    return [`COUNTIFS(${kat},"UNKNOWN")`, ...OFERTA_KATEGORIYALAR.map((k) => `COUNTIFS(${kat},"${k}",${sum},"")`)].join('+');
  }).join('+') : '0';
  const rUn = put([strCell(0, s.text, 'Hal qilinmagan resurs qatorlari'), fCell(1, s.son, unresolved, h.halQilinmagan), strCell(3, s.text, 'narxi/hajmi yoki kategoriyasi yo‘q — 0 bo‘lmaguncha yakuniy summa bo‘sh')]);
  const rFinal = put([
    strCell(0, s.sarlavha, 'YAKUNIY OFERTA (QQS bilan)'),
    fCell(1, s.jami, `IF(${c(rUn)}>0,"",ROUND(${c(rVs)},2))`, h.yakuniyOferta ?? ''),
    numCell(2, s.jami, h.manbaKaskad.vsego),
    strCell(3, s.text, 'ROUND(ВСЕГО;2) — manba ustunida smeta asoslari bo‘yicha ayni kaskad'),
  ]);
  const rSayt = put([strCell(0, s.text, 'Sayt ko‘rsatgan yakuniy oferta'), h.yakuniyOferta == null ? strCell(1, s.text, 'hal qilinmagan qatorlar bor') : numCell(1, s.son, h.yakuniyOferta)]);
  if (h.yakuniyOferta != null) {
    put([strCell(0, s.text, 'Farq (Excel − sayt)'), fCell(1, s.son, `IF(${c(rFinal)}="","",${c(rFinal)}-B${rSayt})`, 0), strCell(3, s.text, '0 bo‘lishi shart')]);
  }

  const sheetData = rows.map((cells, i) => {
    const r = i + 1;
    if (!cells.length) return `<row r="${r}"/>`;
    return `<row r="${r}">${[...cells].sort((a, b) => a.col - b.col).map((cl) => cl.xml(`${ustunHarfi(cl.col)}${r}`)).join('')}</row>`;
  }).join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `<dimension ref="A1:D${rows.length}"/>`
    + '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + '<cols><col min="1" max="1" width="44" customWidth="1"/><col min="2" max="3" width="22" customWidth="1"/><col min="4" max="4" width="60" customWidth="1"/></cols>'
    + `<sheetData>${sheetData}</sheetData>`
    + '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
    + '</worksheet>';
  return { xml, yakuniyHujayra: `B${rFinal}` };
}

// ───────────────────────── workbook darajasi ─────────────────────────

const unEsc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function ofertaVaraqYollari(files: Record<string, Uint8Array>): Array<{ name: string; path: string }> {
  const wb = strFromU8(files['xl/workbook.xml']);
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels'] ?? new Uint8Array());
  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)) {
    const id = (m[1].match(/\bId="([^"]+)"/) || [])[1];
    const target = (m[1].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) relMap.set(id, target);
  }
  const out: Array<{ name: string; path: string }> = [];
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)) {
    const name = (m[1].match(/\bname="([^"]+)"/) || [])[1];
    const rid = (m[1].match(/\b\w+:id="([^"]+)"/) || [])[1];
    const target = rid ? relMap.get(rid) : undefined;
    if (!name || !target) continue;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    out.push({ name: unEsc(name), path });
  }
  return out;
}

function workbookgaVaraqQosh(files: Record<string, Uint8Array>, nom: string, xml: string): void {
  let n = 1;
  while (files[`xl/worksheets/sheet${n}.xml`]) n++;
  const path = `xl/worksheets/sheet${n}.xml`;
  files[path] = strToU8(xml);

  let rels = strFromU8(files['xl/_rels/workbook.xml.rels']);
  let rid = 1;
  while (new RegExp(`\\bId="rId${rid}"`).test(rels)) rid++;
  const relP = (rels.match(/<(\w+:)?Relationships\b/) || [])[1] ?? '';
  rels = rels.replace(new RegExp(`<\\/${relP}Relationships>`), `<${relP}Relationship Id="rId${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></${relP}Relationships>`);
  files['xl/_rels/workbook.xml.rels'] = strToU8(rels);

  let wb = strFromU8(files['xl/workbook.xml']);
  const wp = (wb.match(/<(\w+:)?sheets\b/) || [])[1] ?? '';
  const idAttr = (wb.match(/<(?:\w+:)?sheet\b[^>]*?\b(\w+):id="/) || [])[1] ?? 'r';
  const maxId = Math.max(0, ...[...wb.matchAll(/\bsheetId="(\d+)"/g)].map((m) => Number(m[1])));
  wb = wb.replace(new RegExp(`<\\/${wp}sheets>`), `<${wp}sheet name="${xmlEsc(nom)}" sheetId="${maxId + 1}" ${idAttr}:id="rId${rid}"/></${wp}sheets>`);
  // Excel ochilganda formulalarni to'liq qayta hisoblasin.
  const calc = new RegExp(`<${wp}calcPr\\b([^>]*?)\\/?>`);
  if (calc.test(wb)) {
    wb = wb.replace(calc, (all: string, attrs: string) => /fullCalcOnLoad=/.test(attrs) ? all : all.replace(/\s*\/?>$/, (e) => ` fullCalcOnLoad="1"${e.trim()}`));
  } else {
    const after = ['oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'];
    const anchor = after.map((t) => wb.search(new RegExp(`<${wp}${t}\\b`))).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    const tag = `<${wp}calcPr calcId="0" fullCalcOnLoad="1"/>`;
    wb = anchor != null ? wb.slice(0, anchor) + tag + wb.slice(anchor) : wb.replace(new RegExp(`<\\/${wp}workbook>`), `${tag}</${wp}workbook>`);
  }
  files['xl/workbook.xml'] = strToU8(wb);

  let ct = strFromU8(files['[Content_Types].xml']);
  ct = ct.replace(/<\/Types>/, `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  files['[Content_Types].xml'] = strToU8(ct);
}

async function xlsdanXlsx(bytes: Uint8Array): Promise<Uint8Array> {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.read(bytes, { type: 'array', cellStyles: true, cellNF: true, cellFormula: true });
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}

/**
 * Asl RES workbookini saqlagan holda oferta ustunlari va OFERTA_JAMI
 * varag'ini qo'shadi. Manba hujayralar o'zgarmaydi.
 */
export async function tenderOfertaXlsx(input: OfertaEksportInput): Promise<OfertaEksportNatija> {
  const src = input.manbaBytes instanceof Uint8Array ? input.manbaBytes : new Uint8Array(input.manbaBytes);
  const qisman = !isZip(src);
  const base = qisman ? await xlsdanXlsx(src) : src;
  const files = unzipSync(base);
  if (!files['xl/workbook.xml'] || !files['xl/styles.xml']) throw new Error('OOXML_TUZILMA_TOLIQ_EMAS: workbook.xml yoki styles.xml topilmadi');

  const st = stillarQosh(strFromU8(files['xl/styles.xml']));
  files['xl/styles.xml'] = strToU8(st.xml);

  const paths = ofertaVaraqYollari(files);
  const selected = new Set(input.tanlanganVaraqlar);
  const ustunlar: OfertaEksportNatija['ustunlar'] = {};
  const jamiUchun: Array<{ nom: string; L: OfertaUstunHarflari }> = [];
  for (const tahlil of input.tahlillar) {
    if (!selected.has(tahlil.nom) || tahlil.role === 'lrv') continue;
    if (tahlil.alternativVaraq && selected.has(tahlil.alternativVaraq)) continue;
    const qatorlar = input.hisob.qatorlar.filter((q) => q.sourceSheet === tahlil.nom);
    if (!qatorlar.length) continue;
    const path = paths.find((pp) => pp.name === tahlil.nom)?.path;
    if (!path || !files[path]) throw new Error(`VARAQ_TOPILMADI: ${tahlil.nom}`);
    const xml = strFromU8(files[path]);
    const maxCol = engOngUstun(xml);
    const { patch, harflar } = varaqPatchQur(tahlil, qatorlar, maxCol, st.s);
    files[path] = strToU8(varaqniPatchla(xml, patch, maxCol));
    ustunlar[tahlil.nom] = harflar;
    jamiUchun.push({ nom: tahlil.nom, L: harflar });
  }

  const mavjud = new Set(paths.map((pp) => pp.name.toUpperCase()));
  let jamiVaraq = 'OFERTA_JAMI';
  for (let i = 2; mavjud.has(jamiVaraq.toUpperCase()); i++) jamiVaraq = `OFERTA_JAMI_${i}`;
  const jami = jamiVaraqXml(input, jamiUchun, st.s);
  workbookgaVaraqQosh(files, jamiVaraq, jami.xml);

  // Asl ZIP'dagi yozuvlar tartibi saqlanadi; yangi qismlar oxirida.
  const zippable: Zippable = {};
  for (const [k, v] of Object.entries(files)) zippable[k] = [v, { level: 6 }];
  const bytes = zipSync(zippable);
  return { bytes, faylNomi: ofertaFaylNomi(input.manbaFaylNomi, qisman), saqlanish: qisman ? 'qisman' : 'toliq', ustunlar, jamiVaraq, yakuniyHujayra: jami.yakuniyHujayra };
}
