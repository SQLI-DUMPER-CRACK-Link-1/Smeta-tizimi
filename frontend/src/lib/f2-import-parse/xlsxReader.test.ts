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
});
