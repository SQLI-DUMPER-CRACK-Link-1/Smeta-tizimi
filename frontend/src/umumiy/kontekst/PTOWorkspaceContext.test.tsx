import { describe, expect, it } from 'vitest';
import type { CenterDocument } from '../../components/document-center';
import {
  isPtoRoute,
  parsePtoPositiveId,
  periodKey,
  periodsFromAktRows,
  readPtoScope,
  revisionsFromDocuments,
} from './PTOWorkspaceContext';
import { kompaniyaKerakmi } from './routeScope';

describe('PTO workspace scope helpers', () => {
  it('reads canonical and legacy URL aliases without coercing invalid ids', () => {
    const params = new URLSearchParams('loyiha=12&obyekt_id=34&davr=2026-09&hujjat=doc-7&rev=doc-7%3Ar2');
    expect(readPtoScope(params)).toEqual({
      projectId: 12,
      objectId: 34,
      periodId: '2026-09',
      sourceDocumentId: 'doc-7',
      revisionId: 'doc-7:r2',
    });
    expect(parsePtoPositiveId('0')).toBeNull();
    expect(parsePtoPositiveId('-2')).toBeNull();
    expect(parsePtoPositiveId('not-an-id')).toBeNull();
  });

  it('keeps unknown period values visible and does not turn them into zero', () => {
    expect(periodKey('2026-09-14')).toBe('2026-09');
    expect(periodKey('2026-09')).toBe('2026-09');
    expect(periodKey('NOMA\'LUM')).toBe("NOMA'LUM");
    expect(periodKey(null)).toBeNull();
  });

  it('deduplicates periods only by their stable month/key', () => {
    const rows = [
      { id: 2, obyekt_id: 7, kompaniya_id: 3, obyekt: 'A', tur: 'f2', raqam: '2', oy: '2026-09-22', holat: 'qoralama', fayl_id: null, izoh: null, yaratildi: '2026-09-22T10:00:00Z', hujjat_jami: null, yozilgan_jami: 10, qator_soni: 1, narxsiz_qator: null, manfiy_qator: null, farq: null, reestr_holat: 'ok', versiya: 1 },
      { id: 1, obyekt_id: 7, kompaniya_id: 3, obyekt: 'A', tur: 'f2', raqam: '1', oy: '2026-08-22', holat: 'tasdiqlangan', fayl_id: null, izoh: null, yaratildi: '2026-08-22T10:00:00Z', hujjat_jami: null, yozilgan_jami: 5, qator_soni: 1, narxsiz_qator: null, manfiy_qator: null, farq: null, reestr_holat: 'ok', versiya: 1 },
      { id: 3, obyekt_id: 7, kompaniya_id: 3, obyekt: 'A', tur: 'f2', raqam: '3', oy: '2026-09-30', holat: 'qoralama', fayl_id: null, izoh: null, yaratildi: '2026-09-30T10:00:00Z', hujjat_jami: null, yozilgan_jami: 12, qator_soni: 1, narxsiz_qator: null, manfiy_qator: null, farq: null, reestr_holat: 'ok', versiya: 1 },
    ];
    expect(periodsFromAktRows(rows, 7).map((row) => row.id)).toEqual(['2026-09', '2026-08']);
  });

  it('builds deterministic revision ids from canonical documents', () => {
    const docs = [
      { id: 'b', filename: 'B.xlsx', type: 'smeta', revision: 1, mime: 'application/xlsx', size: 1, sha256: 'b', canonicalStatus: 'READY', updatedAt: '', createdAt: '', author: '', replicas: [] },
      { id: 'a', filename: 'A.xlsx', type: 'smeta', revision: 2, mime: 'application/xlsx', size: 1, sha256: 'a', canonicalStatus: 'READY', updatedAt: '', createdAt: '', author: '', replicas: [] },
    ] as CenterDocument[];
    expect(revisionsFromDocuments(docs).map((row) => row.id)).toEqual(['a:r2', 'b:r1']);
  });

  it('classifies PTO routes only, not similarly named routes', () => {
    expect(isPtoRoute('/admin/f2')).toBe(true);
    expect(isPtoRoute('/admin/f2/123')).toBe(true);
    expect(isPtoRoute('/admin/f2-import')).toBe(false);
    expect(isPtoRoute('/admin/system-control')).toBe(false);
    expect(kompaniyaKerakmi('/admin/holat/19')).toBe(true);
    expect(kompaniyaKerakmi('/admin/f2/19')).toBe(true);
    expect(kompaniyaKerakmi('/admin/f2-import')).toBe(false);
  });
});
