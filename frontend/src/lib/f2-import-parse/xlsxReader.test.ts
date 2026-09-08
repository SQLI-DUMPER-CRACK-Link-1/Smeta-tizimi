/**
 * Uses `buildMinimalXlsx` (`testFixtures.ts`) — a complete, valid, minimal
 * `.xlsx` file built byte-for-byte in memory (real ZIP structure, real
 * OOXML parts) — so this test never needs to ship or depend on a real
 * spreadsheet file. This repo is public; real F2 acts carry real
 * contract/pricing data (see `ops/handoff/T2_GAS_EXIT_001.md` §Remaining
 * item 1 for how this module was actually verified, once, against a real
 * production file located via Google Drive, without committing it).
 *
 * The fixture's ZIP entries are STORED (uncompressed) rather than DEFLATEd
 * — that keeps the in-memory ZIP writer trivial and dependency-free. The
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
import { buildMinimalXlsx } from './testFixtures';

describe('readXlsx', () => {
  test('reads a real, self-built .xlsx: sheet name, shared strings, inline string, numbers, XML entity decoding, and merged cells', async () => {
    const wb = await readXlsx(buildMinimalXlsx());
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

  /**
   * Owner (2026-09-07): "eski shakldagi exellni ocholmas ekan tizim ...
   * universal bo'lsin" -- legacy binary .xls (Excel 97-2003, BIFF8/OLE2,
   * NOT a ZIP) must open through this same `readXlsx` everywhere it's
   * called, not per-page. Built via SheetJS's own writer (real OLE2/BIFF8
   * bytes, not a hand-rolled fixture) so this proves the real format
   * round-trips, without shipping a real proprietary .xls in this public
   * repo.
   */
  test('reads a real legacy .xls (BIFF8/OLE2, not a ZIP) via the SheetJS fallback', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Kod', 'Nom', 'Narx'],
      ['B25', 'Beton B25', 500000],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Smeta');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'biff8' }) as ArrayBuffer;

    // Sanity: confirm the fixture really is OLE2, not a ZIP -- otherwise this
    // test would silently exercise the ZIP path instead of the one it names.
    const head = new Uint8Array(bytes).subarray(0, 8);
    expect([...head]).toEqual([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

    const parsed = await readXlsx(bytes);
    expect(parsed.sheets).toHaveLength(1);
    const sheet = parsed.sheet('Smeta');
    expect(sheet).not.toBeNull();
    expect(sheet!.rows[0]).toEqual(['Kod', 'Nom', 'Narx']);
    expect(sheet!.rows[1]).toEqual(['B25', 'Beton B25', 500000]);
  });
});
