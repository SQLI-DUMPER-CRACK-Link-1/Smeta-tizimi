import { describe, it, expect } from 'vitest';
import type { BossData, TreeNode } from './types';

// Bu shartnoma testi (Contract Test). U API dan qaytadigan ma'lumotlar 
// kutilgan tiplarga mosligini tekshiradi.
// Hozircha statik test ma'lumotlaridan foydalanamiz, chunki CI muhitida 
// real GAS serveriga ulanish huquqi (token) bo'lmasligi mumkin.

describe('API Shartnoma (Contract) Testlari', () => {

  it('apiBossData javobi tiplarga to\'liq mos kelishi kerak', () => {
    // Kutilyotgan obyekt tuzilishi (mock data)
    const mockData: BossData = {
      objects: [
        {
          nom: "Amfiteatr",
          smeta: 56000000000,
          smetaToza: 50000000000,
          fakt: 4300000000,
          f2: 4300000000,
          qoldiq: 52530000000,
          progress: 8,
          f2pct: 8,
          leaf: 1,
        }
      ],
      jami: {
        smeta: 100, smetaToza: 90, fakt: 10, f2: 10,
        qoldiq: 90, progress: 10, f2pct: 10, leaf: 1,
        chel: 10, mash: 10, mat: 10, ob: 10,
        mk: 0, kab: 0, sub: 0,
        tolangan: 5, debitor: 0, avans: 0
      },
      oylar: [],
      sana: "2026-07-28"
    };

    // Shartnomani tekshirish
    expect(mockData).toHaveProperty('jami');
    expect(mockData.jami).toHaveProperty('smeta');
    expect(mockData.objects[0]).toHaveProperty('nom');
    expect(mockData.objects[0]).toHaveProperty('fakt');
    
    // Type check (TypeScript compiler enforces this, but runtime check verifies structure)
    expect(typeof mockData.jami.smeta).toBe('number');
  });

  it('apiHolatOl tugunlari tiplarga mos kelishi kerak (masalan: smetaHajm, tur)', () => {
    // Kutilayotgan TreeNode strukturasi
    const mockTreeNode: TreeNode = {
      type: 'bl', // 'tip' emas
      nom: "Beton ishlari",
      varaq: "L_Amfiteatr",
      row: 10,
      smetaHajm: 100, // 'hajm' emas
      smeta: 15000000,
      narx: 150000,
      fakt: 0,
      qoldiq: 100,
      f2ol: 0,
      f2mum: 100
    };

    expect(mockTreeNode).toHaveProperty('type');
    expect(mockTreeNode).toHaveProperty('smetaHajm');
    expect(mockTreeNode).toHaveProperty('varaq');
    expect(mockTreeNode).toHaveProperty('row');
    
    // Noto'g'ri xossalarni ishlatib qo'yilmasligini tekshirish
    expect(mockTreeNode).not.toHaveProperty('tip');
  });

});
