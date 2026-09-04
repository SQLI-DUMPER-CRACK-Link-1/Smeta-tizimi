/**
 * Dependency-free .xlsx reader using only Web-standard APIs (ArrayBuffer,
 * DecompressionStream, TextDecoder, Blob/Response) — runs in a Cloudflare
 * Worker, a browser, or Node ≥18, with NO Node `fs`/`child_process` and no
 * npm package. This is the missing half of T2-GAS-EXIT-001 §4 ("F2 file
 * parsing must exit GAS"): `_f2lab/xlsx.js` (the GAS-side reference) does
 * the same job by shelling out to `powershell Expand-Archive`, which cannot
 * run in a Worker — this reads the ZIP's central directory and inflates
 * DEFLATE entries directly instead.
 *
 * The XML/sharedStrings parsing below (regex-based cell/row extraction) is
 * a direct, intentional port of `_f2lab/xlsx.js`'s own approach — that part
 * was already platform-agnostic (pure string regex), only the unzip
 * mechanism needed replacing.
 *
 * Verified 2026-09-04 against a real production F2 act (Amfiteatr, Февраль,
 * 526KB / 2998 rows, found via Google Drive) — see
 * `ops/handoff/T2_GAS_EXIT_001.md` §Remaining item 1 for how, and why the
 * real file itself is not committed to this (public) repo. The self-
 * contained test in `xlsxReader.test.ts` builds a minimal valid .xlsx byte-
 * for-byte in memory instead, so this module's own test suite needs no
 * external fixture.
 */
import type { SheetGrid, CellValue } from './types';

export interface XlsxSheet {
  name: string;
  rows: SheetGrid;
  merges: Array<{ r1: number; c1: number; r2: number; c2: number }>;
}
export interface XlsxWorkbook {
  sheets: XlsxSheet[];
  sheet(name: string): XlsxSheet | null;
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const LOCAL_HEADER_SIG = 0x04034b50;

function u16(v: DataView, off: number): number { return v.getUint16(off, true); }
function u32(v: DataView, off: number): number { return v.getUint32(off, true); }

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  // Cast: TS's DOM lib types BlobPart as ArrayBufferView<ArrayBuffer> (excluding
  // SharedArrayBuffer-backed views); Uint8Array is always accepted by Blob at
  // runtime in every target (Workers/browser/Node >=18) this module runs in.
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface ZipEntry { method: number; compSize: number; localHeaderOffset: number }

/** Reads a ZIP's central directory and inflates each requested/available entry. Throws on a non-ZIP or malformed file — never silently returns partial/wrong data. */
async function unzip(buf: Uint8Array): Promise<Record<string, Uint8Array>> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  // EOCD sits at the end, optionally after a variable-length comment (max 65535 bytes) — scan backward.
  const scanFrom = Math.max(0, buf.length - 22 - 65557);
  for (let i = buf.length - 22; i >= scanFrom; i--) {
    if (u32(dv, i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('XLSX_NOT_A_ZIP: End-of-central-directory record not found');

  const cdOffset = u32(dv, eocd + 16);
  const cdCount = u16(dv, eocd + 10);
  const entries: Record<string, ZipEntry> = {};
  let p = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (u32(dv, p) !== CENTRAL_DIR_SIG) throw new Error('XLSX_BAD_CENTRAL_DIRECTORY at offset ' + p);
    const method = u16(dv, p + 10);
    const compSize = u32(dv, p + 20);
    const nameLen = u16(dv, p + 28);
    const extraLen = u16(dv, p + 30);
    const commentLen = u16(dv, p + 32);
    const localHeaderOffset = u32(dv, p + 42);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    entries[name] = { method, compSize, localHeaderOffset };
    p += 46 + nameLen + extraLen + commentLen;
  }

  const files: Record<string, Uint8Array> = {};
  for (const name in entries) {
    const e = entries[name];
    const lp = e.localHeaderOffset;
    if (u32(dv, lp) !== LOCAL_HEADER_SIG) throw new Error('XLSX_BAD_LOCAL_HEADER for ' + name);
    const lNameLen = u16(dv, lp + 26);
    const lExtraLen = u16(dv, lp + 28);
    const dataStart = lp + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + e.compSize);
    if (e.method === 0) files[name] = raw;
    else if (e.method === 8) files[name] = await inflateRaw(raw);
    else throw new Error('XLSX_UNSUPPORTED_COMPRESSION method=' + e.method + ' for ' + name);
  }
  return files;
}

/** Ported verbatim (behavior) from `_f2lab/xlsx.js`'s `dec()`. */
function decodeXmlEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, d) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&amp;/g, '&');
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let t = '';
    for (const tm of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += tm[1];
    out.push(decodeXmlEntities(t));
  }
  return out;
}

function colIdx(ref: string): number {
  let c = 0;
  for (const ch of ref) { if (ch >= 'A' && ch <= 'Z') c = c * 26 + (ch.charCodeAt(0) - 64); else break; }
  return c - 1;
}

function parseSheetXml(xml: string, sharedStrings: string[]): { rows: SheetGrid; merges: XlsxSheet['merges'] } {
  const rows: SheetGrid = [];
  for (const rm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rIdx = +rm[1] - 1;
    const arr: CellValue[] = [];
    for (const cm of rm[2].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] || '';
      const refM = attrs.match(/r="([A-Z]+)\d+"/);
      if (!refM) continue;
      const t = (attrs.match(/t="(\w+)"/) || [])[1] || '';
      let v: CellValue = '';
      const vm = body.match(/<v>([\s\S]*?)<\/v>/);
      if (vm) v = decodeXmlEntities(vm[1]);
      else { const im = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/); if (im) v = decodeXmlEntities(im[1]); }
      if (t === 's') v = sharedStrings[Number(v)] ?? '';
      else if (t !== 'str' && t !== 'inlineStr' && v !== '' && !isNaN(Number(v))) v = Number(v);
      arr[colIdx(refM[1])] = v;
    }
    rows[rIdx] = arr;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];

  const merges: XlsxSheet['merges'] = [];
  for (const m of xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)) {
    merges.push({ r1: +m[2] - 1, c1: colIdx(m[1]), r2: +m[4] - 1, c2: colIdx(m[3]) });
  }
  return { rows, merges };
}

function parseWorkbookSheetList(xml: string, relsXml: string | undefined): Array<{ name: string; target: string }> {
  const relMap: Record<string, string> = {};
  if (relsXml) {
    for (const m of relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) relMap[m[1]] = m[2];
  }
  const out: Array<{ name: string; target: string }> = [];
  for (const m of xml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)) {
    const target = (relMap[m[2]] || '').replace(/^\/?xl\//, '');
    out.push({ name: decodeXmlEntities(m[1]), target });
  }
  return out;
}

/** Reads an .xlsx (or .xlsm) file's every non-hidden-by-name sheet into `{name, rows, merges}`. Hidden-sheet filtering (as GAS's `apiF2Varaqlar` does) is the CALLER's job — this returns everything found in the workbook. */
export async function readXlsx(bytes: ArrayBuffer | Uint8Array): Promise<XlsxWorkbook> {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const files = await unzip(buf);
  const dec = new TextDecoder('utf-8');

  const workbookXml = files['xl/workbook.xml'] ? dec.decode(files['xl/workbook.xml']) : null;
  if (!workbookXml) throw new Error('XLSX_NO_WORKBOOK: xl/workbook.xml missing — not a valid .xlsx');
  const relsXml = files['xl/_rels/workbook.xml.rels'] ? dec.decode(files['xl/_rels/workbook.xml.rels']) : undefined;
  const sharedStrings = parseSharedStrings(files['xl/sharedStrings.xml'] ? dec.decode(files['xl/sharedStrings.xml']) : undefined);

  const sheetList = parseWorkbookSheetList(workbookXml, relsXml);
  const sheets: XlsxSheet[] = sheetList.map(({ name, target }) => {
    const path = 'xl/' + target;
    const xml = files[path] ? dec.decode(files[path]) : null;
    const parsed = xml ? parseSheetXml(xml, sharedStrings) : { rows: [] as SheetGrid, merges: [] };
    return { name, rows: parsed.rows, merges: parsed.merges };
  });

  return { sheets, sheet: (name: string) => sheets.find((s) => s.name === name) ?? null };
}
