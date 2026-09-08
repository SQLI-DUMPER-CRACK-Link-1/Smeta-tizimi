import { describe, expect, it } from 'vitest';
import { smetaDaraxtniYoy, bolaklarga } from './smeta-flatten';
import type { AktNode } from './f2-match-engine';

const daraxt: AktNode[] = [{
  uid: 'rz1', type: 'rz', nom: 'Yer ishlari', children: [
    {
      uid: 'bl1', type: 'bl', kod: 'K1', nom: 'Qazish', bir: 'm3', hajm: 100, children: [
        { uid: 'rs1', type: 'rs', kod: '1', nom: 'Ishchi', bir: 'chel-ch', hajm: 9.5, narx: 20000, summa: 190000 },
        { uid: 'rs2', type: 'rs', kod: '2264', nom: 'Ekskavator', bir: 'mash-ch', hajm: 4.7 },
      ],
    },
  ],
}];

describe('smetaDaraxtniYoy', () => {
  it('hujjat tartibida (ota bolasidan oldin) yoyadi va parent_local_id ni to‘g‘ri qo‘yadi', () => {
    const rows = smetaDaraxtniYoy(daraxt);
    expect(rows.map(r => r.local_id)).toEqual(['rz1', 'bl1', 'rs1', 'rs2']);
    expect(rows.map(r => r.parent_local_id)).toEqual([null, 'rz1', 'bl1', 'bl1']);
    expect(rows.map(r => r.tur)).toEqual(['rz', 'bl', 'rs', 'rs']);
  });

  it('bo‘sh/berilmagan qiymatlarni null qiladi (0 ni null qilmaydi)', () => {
    const rows = smetaDaraxtniYoy([{ uid: 'a', type: 'rs', nom: 'X', hajm: 0, narx: 0 }]);
    expect(rows[0]).toMatchObject({ kod: null, birlik: null, hajm: 0, narx: 0, summa: null });
  });

  it('AktNode maydonlarini kanonik nomlarga o‘giradi (bir -> birlik)', () => {
    const rows = smetaDaraxtniYoy(daraxt);
    expect(rows[2]).toEqual({
      local_id: 'rs1', parent_local_id: 'bl1', tur: 'rs', kod: '1',
      nom: 'Ishchi', birlik: 'chel-ch', hajm: 9.5, narx: 20000, summa: 190000,
    });
  });
});

describe('bolaklarga', () => {
  it('qatorlarni teng bo‘laklarga bo‘ladi, oxirgisi qisqa bo‘lishi mumkin', () => {
    const rows = Array.from({ length: 10 }, (_, i) => i);
    expect(bolaklarga(rows, 4)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]]);
  });

  it('bo‘sh ro‘yxatdan bo‘lak yasamaydi', () => {
    expect(bolaklarga([], 4)).toEqual([]);
  });

  /* Ota-bola aloqasi bo'lak chegarasidan o'tishi MUMKIN va bu normal:
     bog'lash serverda, yakunlashda, to'liq to'plam ustida bajariladi.
     Bu yerda muhimi -- bo'laklash tartibni buzmasligi. */
  it('bo‘laklab, keyin qayta yig‘ilganda tartib aynan saqlanadi', () => {
    const rows = smetaDaraxtniYoy(daraxt);
    const qayta = bolaklarga(rows, 3).flat();
    expect(qayta).toEqual(rows);
  });
});
