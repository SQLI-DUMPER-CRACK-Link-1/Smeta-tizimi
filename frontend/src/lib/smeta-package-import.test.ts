import { describe, expect, it } from 'vitest';
import type { AktNode } from './f2-match-engine';
import {
  resHujjatiniPaketgaBiriktir,
  smetaPaketDaraxtiniNomlash,
  smetaPaketQatorlariniYoy,
  smetaPaketRejasiniTekshir,
} from './smeta-package-import';

const first: AktNode[] = [{ uid: '1', type: 'rz', nom: '1-uchastka', children: [
  { uid: '2', type: 'bl', nom: 'Asfalt', children: [{ uid: '3', type: 'mat', nom: 'Bitum', bir: 'kg', hajm: 10 }] },
]}];
const second: AktNode[] = [{ uid: '1', type: 'rz', nom: 'EO qismi', children: [
  { uid: '2', type: 'bl', nom: 'Yoritish', children: [{ uid: '3', type: 'ob', nom: 'Chiroq', bir: 'dona', hajm: 4 }] },
]}];

describe('smeta paketi — bir obyektning ko‘p mustaqil LRV manbasi', () => {
  it('bir xil lokal idli ikki LRVni to‘qnashmasdan, manbasi bilan yoyadi', () => {
    const rows = smetaPaketQatorlariniYoy([
      { sourceKey: 'uch-1', tree: first },
      { sourceKey: 'eo', tree: second },
    ]);
    expect(rows.map((r) => [r.local_id, r.parent_local_id, r.source_key])).toEqual([
      ['uch-1::1', null, 'uch-1'], ['uch-1::2', 'uch-1::1', 'uch-1'], ['uch-1::3', 'uch-1::2', 'uch-1'],
      ['eo::1', null, 'eo'], ['eo::2', 'eo::1', 'eo'], ['eo::3', 'eo::2', 'eo'],
    ]);
  });

  it('asl daraxtni mutatsiya qilmaydi', () => {
    const named = smetaPaketDaraxtiniNomlash('uch-1', first);
    expect(named[0].uid).toBe('uch-1::1');
    expect(first[0].uid).toBe('1');
  });

  it('bir RES hujjatini ikki uchastkaga yashirin biriktirishni rad etadi', () => {
    const verdict = smetaPaketRejasiniTekshir('road-2-5km', 'Yo‘l 2.5 km', [
      { key: 'uch-1', nom: '1-uchastka', lrvDocumentId: 11, resDocumentIds: [21] },
      { key: 'uch-2', nom: '2-uchastka', lrvDocumentId: 12, resDocumentIds: [21] },
    ]);
    expect(verdict).toEqual({ ok: false, code: 'PACKAGE_RES_DUPLICATE', sourceKey: 'uch-2' });
  });

  it('RES faqat operator ko‘rsatgan manbaga qo‘shiladi', () => {
    const next = resHujjatiniPaketgaBiriktir([
      { key: 'uch-1', nom: '1-uchastka', lrvDocumentId: 11, resDocumentIds: [] },
      { key: 'eo', nom: 'EO qismi', lrvDocumentId: 12, resDocumentIds: [] },
    ], 'eo', 45);
    expect(next[0].resDocumentIds).toEqual([]);
    expect(next[1].resDocumentIds).toEqual([45]);
  });
});
