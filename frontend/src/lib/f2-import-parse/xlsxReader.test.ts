/**
 * Self-contained test: builds a minimal, real, valid .xlsx file (a real ZIP
 * container with real OOXML parts) entirely in memory, byte-for-byte, and
 * feeds it through `readXlsx`. No external fixture is shipped with the repo
 * — this test constructs its own file rather than committing any real
 * production spreadsheet (this repo is public; real F2 acts carry real
 * contract/pricing data — see `ops/handoff/T2_GAS_EXIT_001.md` §Remaining
 * item 1 for how this module was actually verified, once, against a real
 * production file located via Google Drive, without committing it).
 *
 * ZIP entries here are STORED (uncompressed) rather than DEFLATEd — that
 * keeps this file's own ZIP-writer trivial and dependency-free. The
 * DEFLATE-decompression path (`DecompressionStream('deflate-raw')` in
 * `xlsxReader.ts`) was exercised and confirmed working against the real
 * production file in the same verification session (a real .xlsx from
 * Excel/LibreOffice is always DEFLATE-compressed) — this test's job is to
 * prove the ZIP-container parsing (central directory, local headers, EOCD)
 * and the OOXML/sharedStrings extraction, which is the custom-written,
 * error-prone part.
 */
import { describe, expect, test } from 'vitest';
import { readXlsx } from './xlsxReader';

/* ---- minimal, dependency-free ZIP (STORED) writer, test-only ---- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16le(n: number) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]); }
function u32le(n: number) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]); }
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/** Builds a real, minimal STORED-only ZIP from {path: textContent} entries. */
function buildZip(entries: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const path in entries) {
    const nameBytes = enc.encode(path);
    const dataBytes = enc.encode(entries[path]);
    const crc = crc32(dataBytes);

    const local = concat(
      u32le(0x04034b50), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(crc), u32le(dataBytes.length), u32le(dataBytes.length),
      u16le(nameBytes.length), u16le(0), nameBytes, dataBytes,
    );
    localParts.push(local);

    const central = concat(
      u32le(0x02014b50), u16le(20), u16le(20), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(crc), u32le(dataBytes.length), u32le(dataBytes.length),
      u16le(nameBytes.length), u16le(0), u16le(0), u16le(0), u16le(0), u32le(0),
      u32le(offset), nameBytes,
    );
    centralParts.push(central);
    offset += local.length;
  }

  const localAll = concat(...localParts);
  const centralAll = concat(...centralParts);
  const eocd = concat(
    u32le(0x06054b50), u16le(0), u16le(0),
    u16le(Object.keys(entries).length), u16le(Object.keys(entries).length),
    u32le(centralAll.length), u32le(localAll.length), u16le(0),
  );
  return concat(localAll, centralAll, eocd);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="TestSheet" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

const SHARED_STRINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
<si><t>Hello &amp; World</t></si>
<si><t>Мир</t></si>
</sst>`;

const SHEET1_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2"><v>42</v></c><c r="B2" t="inlineStr"><is><t>inline text</t></is></c></row>
<row r="3"><c r="A3"><v>99.5</v></c></row>
</sheetData>
<mergeCells count="1"><mergeCell ref="A3:B3"/></mergeCells>
</worksheet>`;

function minimalXlsx(): Uint8Array {
  return buildZip({
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': ROOT_RELS,
    'xl/workbook.xml': WORKBOOK_XML,
    'xl/_rels/workbook.xml.rels': WORKBOOK_RELS,
    'xl/sharedStrings.xml': SHARED_STRINGS,
    'xl/worksheets/sheet1.xml': SHEET1_XML,
  });
}

describe('readXlsx', () => {
  test('reads a real, self-built .xlsx: sheet name, shared strings, inline string, numbers, XML entity decoding, and merged cells', async () => {
    const wb = await readXlsx(minimalXlsx());
    expect(wb.sheets).toHaveLength(1);
    const sheet = wb.sheet('TestSheet');
    expect(sheet).not.toBeNull();
    expect(sheet!.rows[0]).toEqual(['Hello & World', 'Мир']); // shared strings + XML entity decode
    expect(sheet!.rows[1]).toEqual([42, 'inline text']); // number cell + inline string cell
    expect(sheet!.rows[2]).toEqual([99.5]);
    expect(sheet!.merges).toEqual([{ r1: 2, c1: 0, r2: 2, c2: 1 }]);
  });

  test('throws a clear error on a non-ZIP input rather than silently returning empty/wrong data', async () => {
    await expect(readXlsx(new TextEncoder().encode('not a zip file at all'))).rejects.toThrow('XLSX_NOT_A_ZIP');
  });
});
