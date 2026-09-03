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
});
