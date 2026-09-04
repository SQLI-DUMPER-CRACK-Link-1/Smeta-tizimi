/**
 * Tests the exported `handleFaylOqi`/`handleMoslash` request handlers
 * directly, bypassing the session/auth wrapper (`onRequestPost`) — that
 * wrapper is the same `tekshir()`-based pattern already used and covered
 * elsewhere (see `_shared/auth.ts` and `hujjat-nazorat.ts`'s own tests);
 * re-testing it here would not add new information (T2-GAS-EXIT-001's own
 * test-economy rule).
 */
import { describe, expect, test } from 'vitest';
import { handleFaylOqi, handleMoslash } from './f2-moslash';
import { buildMinimalXlsxBase64 } from '../../src/lib/f2-import-parse/testFixtures';
import type { AktNode, LrvNode } from '../../src/lib/f2-match-engine';

/** `Response.json()`'s return type is `unknown` under strict Workers typing; every response body here is this endpoint's own JSON shape. */
async function body(res: Response): Promise<any> { return res.json(); }

describe('handleFaylOqi', () => {
  test('no colConfig -> preview mode with auto-detected columns', async () => {
    const res = await handleFaylOqi({ amal: 'fayl_oqi', fileBase64: buildMinimalXlsxBase64() });
    const json = await body(res);
    expect(json.ok).toBe(true);
    expect(json.sheetName).toBe('TestSheet');
    expect(json.mode).toBe('config');
  });

  test('colConfig given -> builds a tree from the real sheet rows', async () => {
    const res = await handleFaylOqi({
      amal: 'fayl_oqi', fileBase64: buildMinimalXlsxBase64(),
      colConfig: { kod: -1, nom: 0, bir: -1, norma: -1, obyom: -1, narx: -1, sum: -1 },
    });
    const json = await body(res);
    expect(json.ok).toBe(true);
    // row 0 ("Hello & World" / "Мир") has a name in column A -> one rz section
    expect(Array.isArray(json.tree)).toBe(true);
  });

  test('bad base64 -> BAD_BASE64, not a crash', async () => {
    const res = await handleFaylOqi({ amal: 'fayl_oqi', fileBase64: '***not base64***' });
    expect(res.status).toBe(400);
    const json = await body(res);
    expect(json.code).toBe('BAD_BASE64');
  });

  test('missing file -> MISSING_FILE', async () => {
    const res = await handleFaylOqi({ amal: 'fayl_oqi', fileBase64: '' });
    expect(res.status).toBe(400);
    expect((await body(res)).code).toBe('MISSING_FILE');
  });
});

describe('handleMoslash', () => {
  function akt(uid: string, nom: string, kod: string, bir: string): AktNode {
    return { uid, type: 'mat', nom, kod, bir, hajm: 1, narx: 0, summa: 0 };
  }
  function lrv(nom: string, kod: string, bir: string, row: number): LrvNode {
    return { type: 'mat', nom, kod, birlik: bir, varaq: 'V1', row };
  }

  test('runs the ported matcher end-to-end and returns a real match', () => {
    const aktTree: AktNode[] = [{ uid: 'rz1', type: 'rz', nom: 'ФУНДАМЕНТЫ', children: [akt('a1', 'ЦЕМЕНТ', 'C1', 'Т')] }];
    const lrvTree: LrvNode[] = [{ type: 'rz', nom: 'ФУНДАМЕНТЫ', varaq: 'V1', row: 0, children: [lrv('ЦЕМЕНТ', 'C1', 'Т', 5)] }];
    const res = handleMoslash({ amal: 'moslash', aktTree, lrvTree });
    // handleMoslash returns a Response synchronously (Response.json is not a Promise)
    expect(res).toBeInstanceOf(Response);
  });

  test('missing trees -> MISSING_TREE', () => {
    const res = handleMoslash({ amal: 'moslash', aktTree: undefined as unknown as AktNode[], lrvTree: [] });
    expect(res.status).toBe(400);
  });
});
