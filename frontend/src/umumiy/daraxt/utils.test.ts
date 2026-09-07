import { describe, it, expect } from 'vitest';
import { flattenTree, getAllKeys } from './utils';

const n: any = {
  varaq: 'S', row: 1, nom: 'RZ',
  children: [{ varaq: 'S', row: 2, nom: 'BL', type: 'bl', children: [{ varaq: 'S', row: 3, nom: 'MAT', type: 'mat' }] }],
};

describe('SmetaTree scalable flattening', () => {
  it('keeps closed branches out of visible DOM list', () => {
    expect(flattenTree([n], {})).toHaveLength(1);
  });

  it('uses iterative flattening for 10k source rows (O(n), not O(n^2) recursive concat)', () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({ varaq: 'x', row: i, nom: `q${i}` }));
    expect(flattenTree(rows as any, {})).toHaveLength(10000);
    // getAllKeys faqat BOLASI BOR tugunlarni qaytaradi (MAT bargi -- yo'q).
    expect(getAllKeys([n] as any)).toEqual(['S#1', 'S#2']);
  });

  it('T2 qator IDsi bor bo‘lsa, varaq/qator o‘zgarishidan qat’i nazar kalitni saqlaydi', () => {
    const withId = { id: 77, varaq: 'Amfiteatr', row: 184, nom: 'Beton' } as any;
    expect(flattenTree([withId], {} as Record<string, boolean>)[0].key).toBe('t2:77');
    expect(flattenTree([{ ...withId, row: 226 }], { 't2:77': true } as Record<string, boolean>)[0].key).toBe('t2:77');
  });
});
