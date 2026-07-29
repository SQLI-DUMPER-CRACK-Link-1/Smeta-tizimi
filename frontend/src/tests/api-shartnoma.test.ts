import { describe, it, expect, vi } from 'vitest';
import { gas } from '../api/client';
import type { BossData, TreeNode } from '../api/types';

globalThis.fetch = vi.fn();

describe('API Shartnoma (Contract) Testlari', () => {
  it('apiBossData javobi kutilgan tipga mos kelishi kerak', async () => {
    const mockBossData: BossData = {
      jami: { 
        smeta: 100, smetaToza: 90, fakt: 50, f2: 40, 
        qoldiq: 50, progress: 50, f2pct: 40, leaf: 1,
        chel: 0, mash: 0, mat: 0, ob: 0, mk: 0, kab: 0, sub: 0,
        tolangan: 0, debitor: 0, avans: 0
      },
      objects: [{ 
        nom: 'Test Obyekt', smeta: 100, smetaToza: 90, fakt: 50, f2: 40,
        qoldiq: 50, progress: 50, f2pct: 40, leaf: 1
      }],
      oylar: [],
      sana: '2026-07-29'
    };
    
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: mockBossData })
    });

    const d = await gas<BossData>('apiBossData');
    expect(d).toHaveProperty('jami.smeta');
    expect(d.objects[0]).toHaveProperty('nom');
  });

  it('apiHolatOl tugunlari kutilgan tipga mos kelishi kerak', async () => {
    const mockTreeData = {
      tree: [
        {
          type: 'bl' as const,
          varaq: 'varaq1',
          row: 1,
          nom: 'Ish nomi',
          smetaHajm: 10,
          smeta: 100,
          narx: 10,
          fakt: 0,
          qoldiq: 10,
          f2ol: 0,
          f2mum: 10
        }
      ],
      lokalkalar: []
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: mockTreeData })
    });

    const r = await gas<{tree: TreeNode[]}>('apiHolatOl', 'Test', false);
    const n = r.tree[0];
    
    expect(n).toHaveProperty('type');
    expect(n).toHaveProperty('smetaHajm');
    expect(n).toHaveProperty('varaq');
    expect(n).toHaveProperty('row');
  });
});
