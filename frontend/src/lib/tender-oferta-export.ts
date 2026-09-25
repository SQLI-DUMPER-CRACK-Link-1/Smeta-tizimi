/**
 * Tender oferta V2 eksporti — ASL workbookni SAQLAB, unga oferta qo'shadi.
 *
 * XLSX/XLSM uchun "surgical" OOXML patch: ZIP ichidagi tanlanmagan qismlar
 * (varaqlar, formulalar, stil, vbaProject.bin …) BAYT-BAYT o'zgarmaydi.
 * Tanlangan RES varaqlarida esa hujjat asl shaklda DAVOM etadi:
 *   - asl jadvalning oxirgi ustunidan (СУММА) keyin darhol 3 ta ustun:
 *     КОЛ-ВО / ЦЕНА ЗА ЕД. / СУММА (оферта) — uslub asl D/E/F kataklaridan,
 *     ustun raqamlari (7, 8, 9), kengliklar, bo‘lim/sarlavha birlashmalari
 *     davom etadi; qiymatli asl katakka tegilmaydi;
 *   - yashirin texnik КАТЕГОРИЯ ustuni (yakuniy SUMIFS uchun);
 *   - varaq oxirida ЗАКАЗЧИК / ПОДРЯДЧИК imzo bloki; print area kengayadi;
 *   - styles.xml ga faqat rangsiz zaxira xf'lar qo'shiladi (fill yo'q);
 *   - yangi `OFERTA_JAMI` varag'i — egasining uslublarida svod hujjat.
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
import { OFERTA_KATEGORIYALAR, narxlanadiganmi, type OfertaHisoblash, type OfertaKategoriya, type OfertaQatorNatija } from './tender-oferta';
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
  /** Imzo blokidagi tomonlar nomi (tashkilot, F.I.O.) — bo'sh bo'lsa chiziq. */
  imzo?: { zakazchik?: string; pudratchi?: string };
};

/** Yangi ustunlar: hajm/narx/summa — asl D/E/F davomi; kategoriya — yashirin texnik ustun (SUMIFS uchun). */
export type OfertaUstunHarflari = { hajm: string; narx: string; summa: string; kategoriya: string };

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


const MUAMMO_MATNI: Record<string, string> = {
  HAJM_YOQ: 'hajm yo‘q',
  PUDRATCHI_NARXI_YOQ: 'pudratchi narxi kiritilmagan',
  SMETA_NARXI_YOQ: 'smeta narxi yo‘q',
  SMETA_NARXI_NOL: 'smeta narxi 0 — taklif 0 (kerak bo‘lsa narx kiriting)',
  FOIZ_XATO: 'foiz noto‘g‘ri',
  NARX_MANFIY: 'narx manfiy chiqdi',
  KATEGORIYA_NOMALUM: 'kategoriya noma’lum — kaskadga kirmaydi',
  JAMI_MOS_EMAS: 'manba jamisi bolalar yig‘indisiga mos emas',
  NARX_HAR_XIL: 'varaqlarda smeta narxi har xil — asosiy narx olindi',
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

/** Yangi katak. Uslub `klon` (shu qatordagi ASL ustun) katagidan olinadi —
 * egasining shrifti, chegarasi, son formati va rangi aynan davom etadi;
 * u yo‘q bo‘lsa `s` (ustun sukut uslubi yoki rangsiz zaxira). */
type YangiHujayra = { col: number; klon?: number; s: number; xml: (ref: string, s: number) => string };

function strCell(col: number, s: number, text: string, klon?: number): YangiHujayra {
  return { col, s, klon, xml: (ref, st) => `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(text)}</t></is></c>` };
}
function numCell(col: number, s: number, v: number, klon?: number): YangiHujayra {
  return { col, s, klon, xml: (ref, st) => `<c r="${ref}" s="${st}"><v>${num(v)}</v></c>` };
}
function fCell(col: number, s: number, f: string, v: number | string | null, klon?: number): YangiHujayra {
  return {
    col, s, klon, xml: (ref, st) => {
      if (v == null) return `<c r="${ref}" s="${st}"><f>${xmlEsc(f)}</f></c>`;
      if (typeof v === 'string') return `<c r="${ref}" s="${st}" t="str"><f>${xmlEsc(f)}</f><v>${xmlEsc(v)}</v></c>`;
      return `<c r="${ref}" s="${st}"><f>${xmlEsc(f)}</f><v>${num(v)}</v></c>`;
    },
  };
}
function bosCell(col: number, s: number, klon?: number): YangiHujayra {
  return { col, s, klon, xml: (ref, st) => `<c r="${ref}" s="${st}"/>` };
}

// ───────────────────────── styles.xml ─────────────────────────

type Stillar = { header: number; text: number; son: number; jami: number; jamiMatn: number; foiz: number };

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

function cellXfRoyxati(stylesXml: string): string[] {
  const m = stylesXml.match(/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/);
  if (!m) return [];
  return [...m[1].matchAll(/<(?:\w+:)?xf\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?xf>)/g)].map((x) => x[0]);
}

/* Egasi (2026-09-24): "ranglashni man o'zim uchun vizual qulaylikda bo'lishi
   uchun qilganman … hamma berayotgan hujjatingda o'zing ijod qilib tashlayapsan".
   Shuning uchun styles.xml ga RANG (fill) qo'shilmaydi. Asl varaqlardagi yangi
   kataklar uslubni o'sha qatordagi ASL ustun katagidan oladi. Bu zaxira
   uslublar faqat asl katak topilmaganda: default shrift, qalinlik, son formati. */
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
    `<xf numFmtId="4" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`,
    `<xf numFmtId="0" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyFont="1"/>`,
    `<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
  ]);
  xml = xfs.xml;
  const b = xfs.firstIndex;
  return { xml, s: { header: b, text: b + 1, son: b + 2, jami: b + 3, jamiMatn: b + 4, foiz: b + 5 } };
}

/** Egasining mavjud uslubini (chegara, shrift, rang) aynan nusxalab, faqat son
 * formatini almashtiradi — masalan foiz uchun "0.00". Yangi rang yo‘q. */
function xfNusxa(stylesXml: string, idx: number, numFmtId: number): { xml: string; s: number | null } {
  const xf = cellXfRoyxati(stylesXml)[idx];
  if (!xf) return { xml: stylesXml, s: null };
  const yangi = xf.replace(/\snumFmtId="\d+"/, '').replace(/<((?:\w+:)?xf)\b/, `<$1 numFmtId="${numFmtId}"`)
    .replace(/\sapplyNumberFormat="\d"/, '').replace(/<((?:\w+:)?xf)\b/, '<$1 applyNumberFormat="1"')
    .replace(/<(\/?)\w+:/g, '<$1');
  const r = appendToList(stylesXml, 'cellXfs', 'xf', [yangi]);
  return { xml: r.xml, s: r.firstIndex };
}

// ───────────────────────── varaq XML o'qish ─────────────────────────

type VaraqPatch = {
  rows: Map<number, YangiHujayra[]>;
  /** Yangi ustunlar kengligi: `nusxa` — asl ustun (kengligi/uslubi olinadi). */
  ustunlar: Array<{ col: number; nusxa?: number; width?: number; hidden?: boolean }>;
  /** Yangi ustunlar oralig‘i [bosh, oxirgiKorinadigan, oxirgi] (0-based). */
  oraliq: [number, number, number];
  /** Asl jadvalning oxirgi (СУММА) ustuni — chop etish eni shu bo'yicha. */
  aslOxirgi: number;
  /** Birlashmalarni kengaytirish: shu ustunda tugagan merge yangi ustunga cho‘ziladi. */
  mergeChoz: { dan: number; gacha: number };
  /** Yangi birlashmalar (masalan sarlavha bloki). */
  yangiMerge: string[];
};

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

type AslKatak = { col: number; xml: string; s: string | null; bosh: boolean; v: string | null };

const cellRe = (p: string) => new RegExp(`<${p}c\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${p}c>)`, 'g');

function qatorKataklari(rowInner: string, p: string): AslKatak[] {
  return [...rowInner.matchAll(cellRe(p))].map((m) => {
    const x = m[0];
    const open = x.match(new RegExp(`^<${p}c\\b([^>]*?)\\/?>`))?.[1] ?? '';
    const ref = open.match(/\br="([A-Z]+)\d+"/)?.[1] ?? 'A';
    const bosh = !new RegExp(`<${p}(?:v|f|is)\\b`).test(x);
    const t = open.match(/\bt="([^"]+)"/)?.[1];
    const v = t === 's' || t === 'inlineStr' ? null : x.match(new RegExp(`<${p}v>([^<]*)<\\/${p}v>`))?.[1] ?? null;
    return { col: ustunIndeksi(ref), xml: x, s: open.match(/\bs="(\d+)"/)?.[1] ?? null, bosh, v };
  });
}

type VaraqXarita = { qatorlar: Map<number, AslKatak[]>; oxirgiQator: number; merges: Array<{ r1: number; c1: number; r2: number; c2: number }> };

function varaqXaritasi(xml: string): VaraqXarita {
  const p = prefiks(xml);
  const qatorlar = new Map<number, AslKatak[]>();
  let oxirgiQator = 0;
  for (const m of xml.matchAll(new RegExp(`<${p}row\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}row>)`, 'g'))) {
    const r = Number(m[1].match(/\br="(\d+)"/)?.[1]);
    if (!r) continue;
    const cells = m[3] ? qatorKataklari(m[3], p) : [];
    qatorlar.set(r, cells);
    if (cells.some((c) => !c.bosh)) oxirgiQator = Math.max(oxirgiQator, r);
  }
  const merges = [...xml.matchAll(/<(?:\w+:)?mergeCell\b[^>]*?\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)]
    .map((m) => ({ c1: ustunIndeksi(m[1]), r1: Number(m[2]), c2: ustunIndeksi(m[3]), r2: Number(m[4]) }));
  return { qatorlar, oxirgiQator, merges };
}

type ColYozuv = { min: number; max: number; attrs: string };

function colsOqi(xml: string): ColYozuv[] {
  const m = xml.match(/<(?:\w+:)?cols\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cols>/);
  if (!m) return [];
  return [...m[1].matchAll(/<(?:\w+:)?col\b([^>]*?)\/?>/g)].map((c) => ({
    min: Number(c[1].match(/\bmin="(\d+)"/)?.[1]),
    max: Number(c[1].match(/\bmax="(\d+)"/)?.[1]),
    attrs: c[1].replace(/\s(?:min|max)="\d+"/g, '').trim(),
  })).filter((c) => c.min && c.max);
}

const colAttr = (cols: ColYozuv[], col: number, nom: string): string | null => {
  const c = cols.find((x) => col + 1 >= x.min && col + 1 <= x.max);
  return c?.attrs.match(new RegExp(`\\b${nom}="([^"]*)"`))?.[1] ?? null;
};

/** Yangi ustunlar asl jadvalning OXIRGI ustunidan (smeta summa) keyin darhol
 * boshlanadi — agar u yerdagi kataklar faqat bo‘sh formatlangan bo‘lsa.
 * Ma’lumot yoki birlashma bo‘lsa, butun band hududdan keyin qo‘yiladi. */
function boshUstun(x: VaraqXarita, summaUstuni: number, kenglik: number, engOng: number): number {
  const bosh = summaUstuni + 1;
  const oxir = bosh + kenglik - 1;
  for (const cells of x.qatorlar.values()) {
    if (cells.some((c) => c.col >= bosh && c.col <= oxir && !c.bosh)) return engOng + 1;
  }
  if (x.merges.some((m) => m.c2 >= bosh && m.c1 <= oxir)) return engOng + 1;
  return bosh;
}

// ───────────────────────── varaq XML patch ─────────────────────────

function varaqniPatchla(xml: string, patch: VaraqPatch, x: VaraqXarita): string {
  const p = prefiks(xml);
  const cols = colsOqi(xml);
  const [bosh, , oxirgi] = patch.oraliq;
  const rowRe = new RegExp(`<${p}row\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}row>)`, 'g');
  const sdRe = new RegExp(`<${p}sheetData\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}sheetData>)`);
  const sd = xml.match(sdRe);
  if (!sd) throw new Error('SHEETDATA_YOQ');
  const inner = sd[3] ?? '';
  const qolgan = new Map(patch.rows);

  const uslub = (r: number, h: YangiHujayra): number => {
    if (h.klon != null) {
      const asl = x.qatorlar.get(r)?.find((c) => c.col === h.klon);
      if (asl?.s != null) return Number(asl.s);
      const colS = colAttr(cols, h.klon, 'style');
      if (colS != null) return Number(colS);
    }
    return h.s;
  };
  const yangiXml = (r: number, cells: YangiHujayra[]) => cells.map((c) => ({ col: c.col, xml: c.xml(`${ustunHarfi(c.col)}${r}`, uslub(r, c)) }));
  const prefiksla = (s: string) => (p ? s.replace(/<(\/?)(c|f|v|is|t)\b/g, (_m, sl, tag) => `<${sl}${p}${tag}`) : s);
  const birlashtir = (r: number, asl: AslKatak[], cells: YangiHujayra[]) => {
    const yangi = yangiXml(r, cells);
    const band = new Set(yangi.map((c) => c.col));
    // Yangi ustundagi BO‘SH formatlangan asl katak o‘rniga yangisi yoziladi;
    // qiymatli asl katakka hech qachon tegilmaydi (boshUstun buni kafolatlaydi).
    const saqlanadi = asl.filter((c) => !(band.has(c.col) && c.bosh));
    return [...saqlanadi.map((c) => ({ col: c.col, xml: c.xml })), ...yangi.map((c) => ({ col: c.col, xml: prefiksla(c.xml) }))]
      .sort((a, b) => a.col - b.col).map((c) => c.xml).join('');
  };
  const newRow = (r: number, cells: YangiHujayra[]) => `<${p}row r="${r}">${birlashtir(r, [], cells)}</${p}row>`;
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
      out += `<${p}row${a}>${birlashtir(rNum, m[3] ? qatorKataklari(m[3], p) : [], cells)}</${p}row>`;
    } else {
      out += m[0];
    }
    lastIndex = (m.index ?? 0) + m[0].length;
  }
  out += inner.slice(lastIndex);
  for (const r of [...qolgan.keys()].sort((a, b) => a - b)) out += newRow(r, qolgan.get(r)!);

  let res = xml.replace(sdRe, () => `<${p}sheetData${sd[1]}>${out}</${p}sheetData>`);

  const oxirgiQator = Math.max(x.oxirgiQator, ...patch.rows.keys());
  res = res.replace(new RegExp(`(<${p}dimension\\b[^>]*?\\bref=")([A-Z]+)(\\d+)(?::([A-Z]+)(\\d+))?(")`), (_m, a, c1, r1, c2, r2, z) => {
    const endCol = Math.max(ustunIndeksi(c2 ?? c1), oxirgi);
    const endRow = Math.max(Number(r2 ?? r1), oxirgiQator);
    return `${a}${c1}${r1}:${ustunHarfi(endCol)}${endRow}${z}`;
  });

  // Birlashmalar: sarlavha va bo‘lim qatorlari asl jadvalning oxirgi
  // ustunida tugagan bo‘lsa — yangi ustunlargacha cho‘ziladi (matn butun
  // hujjat ustida markazda qoladi). Yangi birlashmalar qo‘shiladi.
  const { dan, gacha } = patch.mergeChoz;
  res = res.replace(new RegExp(`(<${p}mergeCell\\b[^>]*?\\bref=")([A-Z]+)(\\d+:)([A-Z]+)(\\d+")`, 'g'), (all, a, c1, m1, c2, z) => (ustunIndeksi(c2) === dan && ustunIndeksi(c1) < dan ? `${a}${c1}${m1}${ustunHarfi(gacha)}${z}` : all));
  if (patch.yangiMerge.length) {
    const mc = new RegExp(`<${p}mergeCells\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${p}mergeCells>)`);
    const yangi = patch.yangiMerge.map((ref) => `<${p}mergeCell ref="${ref}"/>`).join('');
    if (mc.test(res)) {
      res = res.replace(mc, (_all, attrs: string, ichki: string | undefined) => {
        const n = ((ichki ?? '').match(new RegExp(`<${p}mergeCell\\b`, 'g')) || []).length + patch.yangiMerge.length;
        return `<${p}mergeCells${attrs.replace(/\scount="\d+"/, '')} count="${n}">${ichki ?? ''}${yangi}</${p}mergeCells>`;
      });
    } else {
      res = res.replace(new RegExp(`(<\\/${p}sheetData>)`), `$1<${p}mergeCells count="${patch.yangiMerge.length}">${yangi}</${p}mergeCells>`);
    }
  }

  // Ustunlar: asl D/E/F ustunlarining kengligi va sukut uslubi nusxalanadi.
  res = colsYoz(res, p, cols, patch.ustunlar);

  // Chop etish: asl sahifa masshtabi eni oshgan ulushda kamaytiriladi, hujjat
  // avvalgidek bitta sahifa eniga sig‘adi (fitToPage bo‘lsa Excel o‘zi sig‘diradi).
  const kengligi = (c: number) => Number(colAttr(cols, c, 'width') ?? 9.14);
  // Asl chop eni — A..СУММА; yangisi — A..oferta СУММА (oradagi egasining
  // yozuv ustunlari ham chop hududiga kiradi).
  const korinadi = (c: number) => colAttr(cols, c, 'hidden') !== '1';
  let aslEni = 0;
  for (let c = 0; c <= patch.aslOxirgi; c++) if (korinadi(c)) aslEni += kengligi(c);
  let qoshildi = 0;
  for (let c = patch.aslOxirgi + 1; c <= patch.oraliq[1]; c++) {
    const u = patch.ustunlar.find((x) => x.col === c);
    if (u) { if (!u.hidden) qoshildi += u.width ?? (u.nusxa != null ? kengligi(u.nusxa) : 9.14); } else if (korinadi(c)) qoshildi += kengligi(c);
  }
  void bosh;
  // Egasi jadval oxiriga (СУММА dan keyin) qo'lda sahifa bo'linishi qo'ygan
  // bo'lsa — maqsad "jadval shu yerda tugaydi": bo'linish oferta bloki oxiriga ko'chadi.
  res = res.replace(new RegExp(`<${p}colBreaks\\b[^>]*>[\\s\\S]*?<\\/${p}colBreaks>`), (blok) =>
    blok.replace(/(\bid=")(\d+)(")/g, (all, a: string, id: string, z: string) => (Number(id) === patch.aslOxirgi + 1 ? `${a}${patch.oraliq[1] + 1}${z}` : all)));
  res = res.replace(new RegExp(`<${p}pageSetup\\b([^>]*?)\\/?>`), (all, attrs: string) => {
    const sc = attrs.match(/\bscale="(\d+)"/);
    if (!sc || /\bfitToPage="1"/.test(res) || aslEni <= 0) return all;
    const yangiScale = Math.max(10, Math.floor(Number(sc[1]) * aslEni / (aslEni + qoshildi)));
    return all.replace(/\bscale="\d+"/, `scale="${yangiScale}"`);
  });
  return res;
}

function colsYoz(xml: string, p: string, cols: ColYozuv[], yangi: VaraqPatch['ustunlar']): string {
  if (!yangi.length) return xml;
  let list = cols.map((c) => ({ ...c }));
  for (const u of yangi) {
    const idx = u.col + 1;
    const nusxa = u.nusxa != null ? cols.find((c) => u.nusxa! + 1 >= c.min && u.nusxa! + 1 <= c.max) : undefined;
    let attrs = nusxa ? nusxa.attrs.replace(/\s*\bhidden="\d"/, '').replace(/\s*\bbestFit="\d"/, '') : `width="${u.width ?? 12}" customWidth="1"`;
    if (u.width != null) attrs = attrs.replace(/\bwidth="[^"]*"/, `width="${u.width}"`);
    if (!/\bwidth=/.test(attrs)) attrs += ` width="${u.width ?? 12}" customWidth="1"`;
    if (u.hidden) attrs += ' hidden="1"';
    const next: ColYozuv[] = [];
    for (const c of list) {
      if (idx < c.min || idx > c.max) { next.push(c); continue; }
      if (c.min < idx) next.push({ min: c.min, max: idx - 1, attrs: c.attrs });
      if (c.max > idx) next.push({ min: idx + 1, max: c.max, attrs: c.attrs });
    }
    next.push({ min: idx, max: idx, attrs: attrs.trim() });
    list = next.sort((a, b) => a.min - b.min);
  }
  const body = list.map((c) => `<${p}col min="${c.min}" max="${c.max}" ${c.attrs}/>`).join('');
  const colsRe = new RegExp(`<${p}cols\\b[^>]*>[\\s\\S]*?<\\/${p}cols>`);
  if (colsRe.test(xml)) return xml.replace(colsRe, () => `<${p}cols>${body}</${p}cols>`);
  return xml.replace(new RegExp(`<${p}sheetData\\b`), (m) => `<${p}cols>${body}</${p}cols>${m}`);
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

/** Asl katak formulasini oferta ustunlariga ko'chiradi: xaritadagi ustunlarga
 * havola — mos yangi ustunga (qator raqami o'zgarmaydi). \`boshqasiQoladi\`:
 * xaritada yo'q ustun (masalan =F237*E238 dagi koeffitsient katagi E238)
 * asl joyiga havola bo'lib qoladi; aks holda bunday formula ko'chirilmaydi.
 * Boshqa varaq/kitob havolasi yoki birorta ham ko'chgan havola bo'lmasa — null
 * (bunday formula taklif narxiga bog'lanmagan bo'lardi). */
export function formulaKochir(f: string, xarita: ReadonlyMap<number, number>, boshqasiQoladi = false): string | null {
  if (!f || /[![\]]/.test(f)) return null;
  let buzildi = false;
  let kochdi = 0;
  const natija = f.replace(/("[^"]*")|(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g, (all, str, d1, col, d2, row, offset, whole) => {
    if (str) return all;
    const oldin = whole[offset - 1];
    if (oldin && /[A-Za-z0-9_.]/.test(oldin)) return all; // funksiya nomi ichida (LOG10 …)
    const yangi = xarita.get(ustunIndeksi(col));
    if (yangi == null) { if (!boshqasiQoladi) buzildi = true; return all; }
    kochdi++;
    return `${d1}${ustunHarfi(yangi)}${d2}${row}`;
  });
  return buzildi || !kochdi ? null : natija;
}

function aslFormula(katak: AslKatak | undefined): string | null {
  if (!katak) return null;
  const m = katak.xml.match(/<(?:\w+:)?f\b([^>]*)>([^<]*)<\/(?:\w+:)?f>/);
  if (!m || /\bt="(?:shared|array|dataTable)"/.test(m[1])) return null;
  return unEsc(m[2]);
}

function foizFormula(f: { yon: string; foiz: number }): string {
  return `(1${f.yon === 'oshirish' ? '+' : '-'}${num(f.foiz)}/100)`;
}

export const OFERTA_USTUN_SARLAVHALARI = ['КОЛ-ВО\n(оферта)', 'ЦЕНА ЗА ЕД.\n(оферта)', 'СУММА\n(оферта), сум', 'КАТЕГОРИЯ'] as const;

/** Ikki tomon imzosi — har bir oferta varag‘i va yakuniy varaq oxirida. */
const IMZO_TOMONLARI = ['ЗАКАЗЧИК:', 'ПОДРЯДЧИК:'] as const;

function imzoMatni(tomon: typeof IMZO_TOMONLARI[number], imzo?: OfertaEksportInput['imzo']): string {
  const nom = (tomon === 'ЗАКАЗЧИК:' ? imzo?.zakazchik : imzo?.pudratchi)?.trim();
  return `${tomon}  ${nom || '________________________________________'}`;
}

/** Asl jadvaldan uslub namunalari — yakuniy varaq ham egasining shrifti,
 * chegarasi va son formatida chiqadi (yangi rang yo‘q). */
type UslubNamuna = { sarlavha?: number; raqam?: number; matn?: number; son?: number; jamiMatn?: number; jamiSon?: number; bolim?: number; oddiy?: number };

function varaqPatchQur(tahlil: OfertaSheetTahlili, qatorlar: readonly OfertaQatorNatija[], x: VaraqXarita, xml: string, s: Stillar, imzo?: OfertaEksportInput['imzo']): { patch: VaraqPatch; harflar: OfertaUstunHarflari; namuna: UslubNamuna } {
  const u = tahlil.ustunlar!;
  const cols = colsOqi(xml);
  const cF = u.smetaSumma, cD = u.hajm >= 0 ? u.hajm : cF, cE = u.smetaNarx >= 0 ? u.smetaNarx : cF;
  const cQ = boshUstun(x, cF, 4, engOngUstun(xml));
  const [cP, cS, cK] = [cQ + 1, cQ + 2, cQ + 3];
  const L: OfertaUstunHarflari = { hajm: ustunHarfi(cQ), narx: ustunHarfi(cP), summa: ustunHarfi(cS), kategoriya: ustunHarfi(cK) };
  const rows = new Map<number, YangiHujayra[]>();
  const add = (r: number, c: YangiHujayra) => { const a = rows.get(r) ?? []; if (!a.some((o) => o.col === c.col)) a.push(c); rows.set(r, a); };
  const aslS = (r: number, c: number) => { const v = x.qatorlar.get(r)?.find((k) => k.col === c)?.s; return v == null ? undefined : Number(v); };
  const namuna: UslubNamuna = {};

  // Sarlavha: asl sarlavha katagi uslubida; asl sarlavha bir necha qatorga
  // birlashtirilgan bo‘lsa (F4:F5) — yangi ustunlar ham ayni shaklda.
  const headerRow = u.sarlavhaBoshlanishi + 1;
  const hMerge = x.merges.find((m) => m.c1 === cF && m.c2 === cF && m.r1 === headerRow && m.r2 > m.r1);
  OFERTA_USTUN_SARLAVHALARI.forEach((t, i) => {
    add(headerRow, strCell(cQ + i, s.header, t, cF));
    if (hMerge) for (let r = headerRow + 1; r <= hMerge.r2; r++) add(r, bosCell(cQ + i, s.header, cF));
  });
  const yangiMerge = hMerge ? [cQ, cP, cS, cK].map((c) => `${ustunHarfi(c)}${hMerge.r1}:${ustunHarfi(c)}${hMerge.r2}`) : [];
  namuna.sarlavha = aslS(headerRow, cF);

  // Ustun raqamlari qatori (1 | 2 | … | 6) — 7, 8, 9 bo‘lib davom etadi.
  for (let r = headerRow; r <= u.malumotBoshlanishi + 1; r++) {
    const f = x.qatorlar.get(r)?.find((c) => c.col === cF);
    const d = x.qatorlar.get(r)?.find((c) => c.col === cD);
    const n = f?.v != null ? Number(f.v) : NaN;
    if (Number.isInteger(n) && n > 0 && n < 100 && d?.v != null && Number(d.v) === n - (cF - cD)) {
      add(r, numCell(cQ, s.header, n + 1, cD)); add(r, numCell(cP, s.header, n + 2, cE)); add(r, numCell(cS, s.header, n + 3, cF));
      namuna.raqam = aslS(r, cF);
      break;
    }
  }

  const byId = new Map(qatorlar.map((q) => [q.sourceId, q]));
  for (const q of qatorlar) {
    const r = q.sourceRow;
    const narxlanadi = q.rol === 'RESOURCE' || (q.rol === 'TRANSPORT' && q.hosila === false);
    if (narxlanadi) {
      if (namuna.matn == null && q.rol === 'RESOURCE') { namuna.matn = aslS(r, u.nom); namuna.son = aslS(r, cF); }
      add(r, strCell(cK, s.text, q.rol === 'RESOURCE' ? String(q.samaraliKategoriya ?? 'UNKNOWN') : 'TRANSPORT'));
      if (q.hisobTuri === 'birlik') {
        // effectiveOfferQuantity: override → konstanta, aks holda manba hajm
        // katagiga havola (manba o'zgarmaydi, qayta yozilmaydi).
        if (q.taklifHajmiOverride != null) add(r, numCell(cQ, s.son, q.taklifHajmiOverride, cD));
        else if (q.taklifHajmi != null && q.manbaHajmUstuni != null && q.manbaHajmUstuni >= 0 && q.manbaHajmSon) {
          add(r, fCell(cQ, s.son, `${ustunHarfi(q.manbaHajmUstuni)}${r}`, q.taklifHajmi, cD));
        } else if (q.taklifHajmi != null) add(r, numCell(cQ, s.son, q.taklifHajmi, cD));
        if (q.pudratchiBirlikNarx != null) add(r, numCell(cP, s.son, q.pudratchiBirlikNarx, cE));
        if (q.pudratchiSumma != null && q.taklifHajmi != null && q.pudratchiBirlikNarx != null) {
          add(r, fCell(cS, s.son, `ROUND(${L.hajm}${r}*${L.narx}${r},2)`, q.pudratchiSumma, cF));
        }
      } else if (q.hisobTuri === 'manba_jami' && q.pudratchiSumma != null) {
        const src = q.manbaSummaUstuni != null && q.manbaSummaUstuni >= 0 && q.manbaSummaSon ? `${ustunHarfi(q.manbaSummaUstuni)}${r}` : null;
        if (q.narxManbasi !== 'qolda' && q.qollanganFoiz && src) add(r, fCell(cS, s.son, `ROUND(${src}*${foizFormula(q.qollanganFoiz)},2)`, q.pudratchiSumma, cF));
        else add(r, numCell(cS, s.son, q.pudratchiSumma, cF));
      }
    } else if ((q.rol === 'SUBTOTAL' || q.rol === 'GRAND_TOTAL') && q.pudratchiSumma != null) {
      const kids = (q.jamiBolalari ?? []).map((id) => byId.get(id)).filter((k): k is OfertaQatorNatija => !!k)
        .filter((k) => k.pudratchiSumma != null && (k.rol === 'RESOURCE' || k.rol === 'TRANSPORT' || k.rol === 'STORAGE' || k.rol === 'SUBTOTAL' || k.rol === 'GRAND_TOTAL'));
      if (kids.length) add(r, fCell(cS, s.jami, `SUM(${sumArgs(L.summa, kids.map((k) => k.sourceRow))})`, q.pudratchiSumma, cF));
      if (namuna.jamiSon == null) { namuna.jamiSon = aslS(r, cF); namuna.jamiMatn = aslS(r, u.nom) ?? aslS(r, 0); }
    } else if (q.podval && q.pudratchiSumma != null) {
      // Podval (транспорт 5%, склад, ВСЕГО С УЧЕТОМ …): asl formula bo'lsa —
      // ustunlari ko'chiriladi; bo'lmasa tizim tushungan qoida yoziladi.
      const asl = aslFormula(x.qatorlar.get(r)?.find((c) => c.col === cF));
      // Faqat SUMMA ustuniga havola ko'chadi; koeffitsient kataklari (=F237*E238,
      // E238 = 0,05) asl joyida qoladi — ular manba varaqda o'zgarmay turadi.
      const kochirilgan = asl ? formulaKochir(asl, new Map([[cF, cS]]), true) : null;
      const pv = q.podval;
      const bazaQator = (id: string) => byId.get(id)?.sourceRow;
      let f: string | null = null;
      if (pv.tur === 'kategoriya') {
        // Asl'da 0 — bo'lim resurslaridan kategoriya bo'yicha (yashirin КАТЕГОРИЯ ustuni).
        const qr = pv.bazaQatorlar.map(bazaQator).filter((n): n is number => n != null);
        if (qr.length) {
          const [a, b] = [Math.min(...qr), Math.max(...qr)];
          const sumif = (k: string) => `SUMIFS(${L.summa}${a}:${L.summa}${b},${L.kategoriya}${a}:${L.kategoriya}${b},"${k}")`;
          f = `ROUND(${pv.qismlar.map((qq) => `(${qq.kat.map(sumif).join('+')})*${num(qq.foiz)}/100`).join('+')},2)`;
        }
      } else if (kochirilgan) f = /^\s*SUM\(/i.test(kochirilgan) ? kochirilgan : `ROUND(${kochirilgan},2)`;
      else if (pv.tur === 'yigindi') f = `SUM(${sumArgs(L.summa, pv.bazalar.map(bazaQator).filter((n): n is number => n != null))})`;
      else if (pv.tur === 'foiz' && bazaQator(pv.baza) != null) {
        f = pv.foiz != null ? `ROUND(${L.summa}${bazaQator(pv.baza)}*${num(pv.foiz)}/100,2)` : `ROUND(${L.summa}${bazaQator(pv.baza)}*${num(pv.koef)},2)`;
      }
      add(r, f ? fCell(cS, s.son, f, q.pudratchiSumma, cF) : numCell(cS, s.son, q.pudratchiSumma, cF));
    } else if (q.rol === 'SECTION' && namuna.bolim == null) {
      namuna.bolim = aslS(r, 0) ?? aslS(r, u.nom);
    }
    // Jadval chegarasi va bo‘lim rangi yangi ustunlarda ham davom etadi.
    add(r, bosCell(cQ, s.text, cD)); add(r, bosCell(cP, s.text, cE)); add(r, bosCell(cS, s.text, cF));
  }

  // Ikki tomon imzosi — varaq oxirida, egasining ustun shriftida (chegarasiz).
  const oddiy = Number(colAttr(cols, u.nom, 'style') ?? 0);
  namuna.oddiy = oddiy;
  let r0 = Math.max(x.oxirgiQator, ...rows.keys()) + 3;
  for (const tomon of IMZO_TOMONLARI) {
    add(r0, strCell(u.nom, oddiy, imzoMatni(tomon, imzo)));
    add(r0, strCell(cP, oddiy, '____________________'));
    add(r0 + 1, strCell(u.nom, oddiy, '(наименование организации, должность, Ф.И.О.)'));
    add(r0 + 1, strCell(cP, oddiy, '(подпись)'));
    add(r0 + 1, strCell(cS, oddiy, 'М.П.'));
    r0 += 3;
  }

  const patch: VaraqPatch = {
    rows,
    ustunlar: [{ col: cQ, nusxa: cD }, { col: cP, nusxa: cE }, { col: cS, nusxa: cF }, { col: cK, width: 12, hidden: true }],
    oraliq: [cQ, cS, cK],
    mergeChoz: { dan: cQ === cF + 1 ? cF : -1, gacha: cS },
    aslOxirgi: cF,
    yangiMerge,
  };
  return { patch, harflar: L, namuna };
}

// ───────────────────────── print area ─────────────────────────

/** Varaqning _xlnm.Print_Area nomi: ustunlar yangi oxirgi ustungacha, qatorlar
 * (agar u jadval oxirini qamragan bo‘lsa) imzo blokigacha kengayadi. */
function printAreaKengaytir(wbXml: string, sheetIndex: number, oxirgiUstun: number, jadvalOxiri: number, imzoOxiri: number): string {
  const re = new RegExp(`(<(?:\\w+:)?definedName\\b[^>]*?\\bname="_xlnm\\.Print_Area"[^>]*?\\blocalSheetId="${sheetIndex}"[^>]*>)([^<]*)(<\\/(?:\\w+:)?definedName>)`);
  return wbXml.replace(re, (all, a: string, ref: string, z: string) => {
    const m = ref.match(/^(.*!)\$([A-Z]+)\$(\d+):\$([A-Z]+)\$(\d+)$/);
    if (!m) return all; // bir nechta hudud yoki boshqa shakl — tegilmaydi
    const endCol = Math.max(ustunIndeksi(m[4]), oxirgiUstun);
    const endRow = Number(m[5]) >= jadvalOxiri ? Math.max(Number(m[5]), imzoOxiri) : Number(m[5]);
    return `${a}${m[1]}$${m[2]}$${m[3]}:$${ustunHarfi(endCol)}$${endRow}${z}`;
  });
}

// ───────────────────────── OFERTA_JAMI ─────────────────────────

/** Tartib `ofertaHisobla` dagi kategoriya yig'ish tartibi bilan bir xil. */
const KAT_TARTIB: OfertaKategoriya[] = ['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'М/К', 'КАБ', 'БЕЗСКЛАД', 'UNKNOWN'];

const KAT_NOMI: Record<OfertaKategoriya, string> = {
  ЧЕЛ: 'Затраты труда рабочих-строителей',
  МАШ: 'Строительные машины и механизмы',
  МАТ: 'Строительные материалы',
  ОБ: 'Оборудование',
  'М/К': 'Металлоконструкции',
  КАБ: 'Кабельно-проводниковая продукция',
  БЕЗСКЛАД: 'Материалы без складских расходов',
  UNKNOWN: 'Категория не определена',
};

const SABAB_RU: Partial<Record<string, string>> = {
  HAJM_YOQ: 'нет количества',
  PUDRATCHI_NARXI_YOQ: 'не указана цена подрядчика',
  SMETA_NARXI_YOQ: 'нет цены в смете',
  SMETA_NARXI_NOL: 'цена в смете 0 — принята 0',
  FOIZ_XATO: 'неверный процент',
  NARX_MANFIY: 'отрицательная цена',
  KATEGORIYA_NOMALUM: 'категория не определена',
  NARX_HAR_XIL: 'разные сметные цены на листах — принята основная',
};

type JamiStil = { sarlavha: number; raqam: number; matn: number; son: number; jamiMatn: number; jamiSon: number; bolim: number; foiz: number; oddiy: number };

function jamiVaraqXml(
  input: OfertaEksportInput,
  varaqlar: Array<{ nom: string; L: OfertaUstunHarflari }>,
  st: JamiStil,
): { xml: string; yakuniyHujayra: string } {
  const h = input.hisob;
  const rows: Array<YangiHujayra[]> = [];
  const put = (cells: YangiHujayra[]) => { rows.push(cells); return rows.length; };
  const sumifs = (kat: string) => varaqlar.length
    ? varaqlar.map((v) => `SUMIFS(${sheetRef(v.nom)}!${v.L.summa}:${v.L.summa},${sheetRef(v.nom)}!${v.L.kategoriya}:${v.L.kategoriya},"${kat}")`).join('+')
    : '0';
  const qator = (n: number | string, nom: string, oferta: YangiHujayra | null, manba: number | null, izoh = '', jami = false) => put([
    typeof n === 'number' ? numCell(0, jami ? st.jamiMatn : st.matn, n) : strCell(0, jami ? st.jamiMatn : st.matn, n),
    strCell(1, jami ? st.jamiMatn : st.matn, nom),
    oferta ?? bosCell(2, jami ? st.jamiSon : st.son),
    manba == null ? bosCell(3, jami ? st.jamiSon : st.son) : numCell(3, jami ? st.jamiSon : st.son, manba),
    strCell(4, jami ? st.jamiMatn : st.matn, izoh),
  ]);
  const bolim = (nom: string) => put([bosCell(0, st.bolim), strCell(1, st.bolim, nom), bosCell(2, st.bolim), bosCell(3, st.bolim), bosCell(4, st.bolim)]);

  put([strCell(1, st.jamiMatn, 'СВОДНЫЙ РАСЧЕТ ОФЕРТЫ ПОДРЯДЧИКА')]);
  put([strCell(1, st.oddiy, input.obyektNomi || '')]);
  put([strCell(1, st.oddiy, `Основание: ${input.manbaFaylNomi}`)]);
  put([]);
  put(['№ п/п', 'НАИМЕНОВАНИЕ', 'ОФЕРТА ПОДРЯДЧИКА, сум', 'ПО СМЕТЕ, сум', 'ПРИМЕЧАНИЕ'].map((t, i) => strCell(i, st.sarlavha, t)));
  put([1, 2, 3, 4, 5].map((n, i) => numCell(i, st.raqam, n)));

  bolim('ПРЯМЫЕ ЗАТРАТЫ ПО ВИДАМ РЕСУРСОВ');
  const katRow: Partial<Record<OfertaKategoriya, number>> = {};
  let n = 0;
  for (const kat of KAT_TARTIB) {
    if (kat === 'UNKNOWN' && !h.kategoriyaJami.UNKNOWN && !h.manbaKategoriyaJami.UNKNOWN && !h.qatorlar.some((q) => q.rol === 'RESOURCE' && q.samaraliKategoriya === 'UNKNOWN')) continue;
    katRow[kat] = qator(++n, KAT_NOMI[kat], fCell(2, st.son, sumifs(kat), h.kategoriyaJami[kat]), h.manbaKategoriyaJami[kat],
      kat === 'UNKNOWN' ? 'не входит в расчет — укажите категорию' : '');
  }
  const katQatorlari = Object.values(katRow) as number[];
  const rPr = qator('', 'ИТОГО ПРЯМЫЕ ЗАТРАТЫ', fCell(2, st.jamiSon, `SUM(C${Math.min(...katQatorlari)}:C${Math.max(...katQatorlari)})`, h.togridanJami), h.manbaTogridanJami, '', true);
  let rTransport: number | null = null;
  if (h.transportVaraqJami > 0 || h.transportSiyosati === 'varaq') {
    rTransport = qator('', 'Транспортные расходы по расчету (лист перевозки)', fCell(2, st.son, sumifs('TRANSPORT'), h.transportVaraqJami), null,
      h.transportSiyosati === 'varaq' ? 'принято вместо % транспорта материалов' : 'справочно — в расчет не входит');
  }

  put([]);
  bolim('НАЧИСЛЕНИЯ, %');
  const kRow: Record<string, number> = {};
  for (const kod of NAKRUTKA_KOEF_KODLAR) {
    kRow[kod] = put([bosCell(0, st.matn), strCell(1, st.matn, NAKRUTKA_KOEF_IZOH[kod]), numCell(2, st.foiz, h.koeffitsientlar[kod]), bosCell(3, st.son), strCell(4, st.matn, kod)]);
  }
  const K = (kod: string) => `C${kRow[kod]}`;
  const B = (kat: OfertaKategoriya) => (katRow[kat] ? `C${katRow[kat]}` : '0');
  const pct = (kod: string) => `${num(h.koeffitsientlar[kod as keyof typeof h.koeffitsientlar] as number)}%`;

  put([]);
  bolim('РАСЧЕТ СТОИМОСТИ');
  const x = h.kaskadXom, m = h.manbaKaskad;
  const c = (r: number) => `C${r}`;
  const step = (nom: string, f: string, v: number, mv: number | null, izoh: string, jami = false) =>
    qator('', nom, fCell(2, jami ? st.jamiSon : st.son, f, v), mv, izoh, jami);
  const rMat = step('Материалы всего (МАТ + М/К + КАБ + без склада)', `${B('МАТ')}+${B('М/К')}+${B('КАБ')}+${B('БЕЗСКЛАД')}`, h.asos.mat, null, '');
  const rPryam = step('Прямые затраты', c(rPr), x.pryamye, m.pryamye, 'труд + машины + материалы + оборудование');
  const rTrMat = step('Транспортные расходы — материалы',
    h.transportSiyosati === 'varaq' && rTransport ? c(rTransport) : `(${c(rMat)}-${B('КАБ')})*${K('ТРАНСПОРТ_МАТЕРИАЛ')}/100`,
    x.tr_mat, m.tr_mat, h.transportSiyosati === 'varaq' ? 'по листу перевозки' : `(материалы − кабель) × ${pct('ТРАНСПОРТ_МАТЕРИАЛ')}`);
  const rSkl = step('Заготовительно-складские расходы — материалы', `(${c(rMat)}-${B('БЕЗСКЛАД')}-${B('М/К')})*${K('СКЛАДСКИЕ_МАТЕРИАЛ')}/100+${B('М/К')}*${K('СКЛАДСКИЕ_МК')}/100`,
    x.skl_mat, m.skl_mat, `× ${pct('СКЛАДСКИЕ_МАТЕРИАЛ')}; М/К × ${pct('СКЛАДСКИЕ_МК')}`);
  const rTrKab = step('Транспортные расходы — кабель', `${B('КАБ')}*${K('ТРАНСПОРТ_КАБЕЛЬ')}/100`, x.tr_kab, m.tr_kab, `кабель × ${pct('ТРАНСПОРТ_КАБЕЛЬ')}`);
  const rI1 = step('ИТОГО 1 (без оборудования)', `${c(rPryam)}-${B('ОБ')}+${c(rTrMat)}+${c(rSkl)}+${c(rTrKab)}`, x.itogo1, m.itogo1, '', true);
  const rPro = step('Прочие расходы подрядчика', `${c(rI1)}*${K('ПРОЧИЕ_ПОДРЯДЧИК')}/100`, x.prochie, m.prochie, `ИТОГО 1 × ${pct('ПРОЧИЕ_ПОДРЯДЧИК')}`);
  const rI2 = step('ИТОГО 2', `${c(rI1)}+${c(rPro)}`, x.itogo2, m.itogo2, '', true);
  const rTrOb = step('Транспортные расходы — оборудование', `${B('ОБ')}*${K('ТРАНСПОРТ_ОБОРУД')}/100`, x.tr_ob, m.tr_ob, `оборудование × ${pct('ТРАНСПОРТ_ОБОРУД')}`);
  const rZag = step('Заготовительно-складские — оборудование', `${B('ОБ')}*${K('ЗАГОТ_СКЛАД_ОБОРУД')}/100`, x.zag_ob, m.zag_ob, `оборудование × ${pct('ЗАГОТ_СКЛАД_ОБОРУД')}`);
  const rI3 = step('ИТОГО 3', `${c(rI2)}+${B('ОБ')}+${c(rTrOb)}+${c(rZag)}`, x.itogo3, m.itogo3, 'ИТОГО 2 + оборудование', true);
  const rSt = step('Страхование', `${c(rI3)}*${K('СТРАХОВАНИЕ')}/100`, x.strax, m.strax, `ИТОГО 3 × ${pct('СТРАХОВАНИЕ')}`);
  const rRisk = step('Риск', `${c(rI3)}*${K('РИСК')}/100`, x.risk, m.risk, `ИТОГО 3 × ${pct('РИСК')}`);
  const rI4 = step('ИТОГО 4', `${c(rI3)}+${c(rSt)}+${c(rRisk)}`, x.itogo4, m.itogo4, '', true);
  const rNds = step('НДС', `${c(rI4)}*${K('НДС')}/100`, x.nds, m.nds, `ИТОГО 4 × ${pct('НДС')}`);
  const rVs = step('ВСЕГО', `${c(rI4)}+${c(rNds)}`, x.vsego, m.vsego, '', true);

  const unresolved = varaqlar.length ? varaqlar.map((v) => {
    const kat = `${sheetRef(v.nom)}!${v.L.kategoriya}:${v.L.kategoriya}`;
    const sum = `${sheetRef(v.nom)}!${v.L.summa}:${v.L.summa}`;
    return [`COUNTIFS(${kat},"UNKNOWN")`, ...OFERTA_KATEGORIYALAR.map((k) => `COUNTIFS(${kat},"${k}",${sum},"")`)].join('+');
  }).join('+') : '0';
  put([]);
  const rUn = put([bosCell(0, st.matn), strCell(1, st.matn, 'Позиции без цены или категории, шт.'), fCell(2, st.son, unresolved, h.halQilinmagan), bosCell(3, st.son),
    strCell(4, st.matn, h.halQilinmagan ? 'итог не определен до их заполнения — см. перечень ниже' : '')]);
  const rFinal = put([bosCell(0, st.jamiMatn), strCell(1, st.jamiMatn, 'ИТОГО ОФЕРТА С НДС'),
    fCell(2, st.jamiSon, `IF(${c(rUn)}>0,"",ROUND(${c(rVs)},2))`, h.yakuniyOferta ?? ''), numCell(3, st.jamiSon, h.manbaKaskad.vsego), bosCell(4, st.jamiMatn)]);

  // Diqqat talab qiladigan pozitsiyalar — hujjatda ochiq ko‘rinadi.
  const diqqat = h.qatorlar.filter((q) => narxlanadiganmi(q) && q.muammolar.length);
  if (diqqat.length) {
    put([]);
    bolim(`ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ (${diqqat.length})`);
    let i = 0;
    for (const q of diqqat) {
      qator(++i, `${q.nom}${q.birlik ? `, ${q.birlik}` : ''}`, null, q.smetaSumma, `${q.sourceSheet}, стр. ${q.sourceRow}: ${q.muammolar.map((mm) => SABAB_RU[mm] ?? mm).join('; ')}`);
    }
  }

  put([]); put([]);
  for (const tomon of IMZO_TOMONLARI) {
    put([strCell(1, st.oddiy, imzoMatni(tomon, input.imzo)), strCell(2, st.oddiy, '____________________')]);
    put([strCell(1, st.oddiy, '(наименование организации, должность, Ф.И.О.)'), strCell(2, st.oddiy, '(подпись)          М.П.')]);
    put([]);
  }

  const sheetData = rows.map((cells, i) => {
    const r = i + 1;
    if (!cells.length) return `<row r="${r}"/>`;
    return `<row r="${r}">${[...cells].sort((a, b) => a.col - b.col).map((cl) => cl.xml(`${ustunHarfi(cl.col)}${r}`, cl.s)).join('')}</row>`;
  }).join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    + `<dimension ref="A1:E${rows.length}"/>`
    + '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="58" customWidth="1"/><col min="3" max="4" width="22" customWidth="1"/><col min="5" max="5" width="46" customWidth="1"/></cols>'
    + `<sheetData>${sheetData}</sheetData>`
    + '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>'
    + '<pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/>'
    + '</worksheet>';
  return { xml, yakuniyHujayra: `C${rFinal}` };
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
  let stylesXml = st.xml;

  const paths = ofertaVaraqYollari(files);
  let wbXml = strFromU8(files['xl/workbook.xml']);
  const selected = new Set(input.tanlanganVaraqlar);
  const ustunlar: OfertaEksportNatija['ustunlar'] = {};
  const jamiUchun: Array<{ nom: string; L: OfertaUstunHarflari }> = [];
  let namuna: UslubNamuna | null = null;
  for (const tahlil of input.tahlillar) {
    if (!selected.has(tahlil.nom) || tahlil.role === 'lrv' || !tahlil.ustunlar) continue;
    if (tahlil.alternativVaraq && selected.has(tahlil.alternativVaraq)) continue;
    const qatorlar = input.hisob.qatorlar.filter((q) => q.sourceSheet === tahlil.nom);
    if (!qatorlar.length) continue;
    const idx = paths.findIndex((pp) => pp.name === tahlil.nom);
    const path = paths[idx]?.path;
    if (!path || !files[path]) throw new Error(`VARAQ_TOPILMADI: ${tahlil.nom}`);
    const xml = strFromU8(files[path]);
    const xarita = varaqXaritasi(xml);
    const q = varaqPatchQur(tahlil, qatorlar, xarita, xml, st.s, input.imzo);
    files[path] = strToU8(varaqniPatchla(xml, q.patch, xarita));
    const jadvalOxiri = Math.max(...qatorlar.map((r) => r.sourceRow));
    wbXml = printAreaKengaytir(wbXml, idx, q.patch.oraliq[1], jadvalOxiri, Math.max(...q.patch.rows.keys()));
    namuna ??= q.namuna;
    ustunlar[tahlil.nom] = q.harflar;
    jamiUchun.push({ nom: tahlil.nom, L: q.harflar });
  }
  files['xl/workbook.xml'] = strToU8(wbXml);

  const n = namuna ?? {};
  const foiz = xfNusxa(stylesXml, n.son ?? st.s.son, 2);
  stylesXml = foiz.xml;
  files['xl/styles.xml'] = strToU8(stylesXml);
  const jamiStil: JamiStil = {
    sarlavha: n.sarlavha ?? st.s.header, raqam: n.raqam ?? n.sarlavha ?? st.s.header, matn: n.matn ?? st.s.text, son: n.son ?? st.s.son,
    jamiMatn: n.jamiMatn ?? st.s.jamiMatn, jamiSon: n.jamiSon ?? st.s.jami, bolim: n.bolim ?? n.jamiMatn ?? st.s.jamiMatn,
    foiz: foiz.s ?? st.s.foiz, oddiy: n.oddiy ?? 0,
  };

  const mavjud = new Set(paths.map((pp) => pp.name.toUpperCase()));
  let jamiVaraq = 'OFERTA_JAMI';
  for (let i = 2; mavjud.has(jamiVaraq.toUpperCase()); i++) jamiVaraq = `OFERTA_JAMI_${i}`;
  const jami = jamiVaraqXml(input, jamiUchun, jamiStil);
  workbookgaVaraqQosh(files, jamiVaraq, jami.xml);

  // Asl ZIP'dagi yozuvlar tartibi saqlanadi; yangi qismlar oxirida.
  const zippable: Zippable = {};
  for (const [k, v] of Object.entries(files)) zippable[k] = [v, { level: 6 }];
  const bytes = zipSync(zippable);
  return { bytes, faylNomi: ofertaFaylNomi(input.manbaFaylNomi, qisman), saqlanish: qisman ? 'qisman' : 'toliq', ustunlar, jamiVaraq, yakuniyHujayra: jami.yakuniyHujayra };
}
