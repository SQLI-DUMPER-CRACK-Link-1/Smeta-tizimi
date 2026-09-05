import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { exactWrite, sourceLeaves } from './F2ImportNative';

describe('F2 kanonik manba kontrakti', () => {
  const n = { uid: 'f2_0', hajm: 10, narx: 123.45, summa: 1234.49 };
  const mapping = new Map([['f2_0', 123]]);
  it('mustaqil hujjat summasini saqlaydi', () => {
    expect(exactWrite([n], mapping)[0]).toMatchObject({ certifiedQuantity: 10, certifiedUnitPrice: 123.45, certifiedAmount: 1234.49, priceIntentionallyAbsent: false });
  });
  it('moslashmagan qatorni jim tashlamaydi', () => {
    expect(() => exactWrite([n], new Map())).toThrow();
  });
  it.each([undefined, null, 0])('noaniq/nol narxni ataylab yo‘q demaydi: %s', narx => {
    expect(() => exactWrite([{ ...n, narx }], mapping)).toThrow();
  });
  it('yig‘indi borligi bitta manbadagi yo‘q summani yashirmaydi', () => {
    expect(() => exactWrite([n, { ...n, uid: 'b', summa: undefined }], new Map([...mapping, ['b', 123]]))).toThrow();
  });
  it('bir maqsadga turli narxni birlashtirishni to‘xtatadi', () => {
    expect(() => exactWrite([n, { ...n, uid: 'b', narx: 124 }], new Map([...mapping, ['b', 123]]))).toThrow();
  });
  it('parserdagi nol o‘rniga asl bo‘sh katakni taniydi', () => {
    const rows = sourceLeaves([{ ...n, type: 'mat' }], [[10, '', '']], { kod: -1, nom: -1, bir: -1, norma: -1, obyom: 0, narx: 1, sum: 2 });
    expect(rows[0]).toEqual({ uid: 'f2_0', hajm: 10, narx: undefined, summa: undefined });
  });
  it('noto‘liq raqam matnini narx deb qabul qilmaydi', () => {
    const rows = sourceLeaves([{ ...n, type: 'mat' }], [[10, '123abc', 1234.49]], { kod: -1, nom: -1, bir: -1, norma: -1, obyom: 0, narx: 1, sum: 2 });
    expect(rows[0].narx).toBeUndefined();
  });
  it('legacy komponent tanasi o‘zgarmagan', () => {
    const path = 'frontend/src/admin/sahifalar/F2Import.tsx';
    const old = execFileSync('git', ['show', `0ce99a6:${path}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
    const current = readFileSync('src/admin/sahifalar/F2Import.tsx', 'utf8').replace(/\r\n/g, '\n');
    const body = old.slice(old.indexOf('export function F2Import() {') + 'export function F2Import() {'.length);
    expect(current.slice(current.indexOf('function F2ImportLegacy() {') + 'function F2ImportLegacy() {'.length)).toBe(body);
    expect(current).toContain("localStorage.getItem('t2-f2-native-mode') === 'true'");
  });
});
