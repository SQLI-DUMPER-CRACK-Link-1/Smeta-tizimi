import { describe, expect, it } from 'vitest';
import { ishResurslariniBogla, ishMi } from './f2-ish-bogla';
import type { AktNode, LrvNode } from './f2-match-engine';

const aktIsh = (children: Partial<AktNode>[]): AktNode => ({
  uid: 'f2_1', type: 'bl', nom: 'Devor terish', bir: 'м3',
  children: children.map((c, i) => ({ uid: 'f2_' + (100 + i), type: 'rs', ...c } as AktNode)),
} as AktNode);

const smetaIsh = (children: Partial<LrvNode>[]): LrvNode => ({
  type: 'bl', nom: 'Devor terish', birlik: 'м3', varaq: 'SB', row: 1,
  children: children.map((c, i) => ({ type: 'rs', varaq: 'SB', row: 200 + i, ...c } as LrvNode)),
} as LrvNode);

describe('ishResurslariniBogla — ishni resurslari bilan birga bog‘lash', () => {
  it('aniq kod bo‘yicha bog‘laydi', () => {
    const r = ishResurslariniBogla(
      aktIsh([{ kod: '1', nom: 'Ishchi' }, { kod: '2264', nom: 'Ekskavator' }]),
      smetaIsh([{ kod: '2264', nom: 'Ekskavator' }, { kod: '1', nom: 'Ishchi' }]),
      new Map(),
    );
    expect(r.bogland).toBe(2);
    expect(r.qoldi).toBe(0);
    expect(r.mapping.get('f2_100')).toBe(201); // kod '1'
    expect(r.mapping.get('f2_101')).toBe(200); // kod '2264'
  });

  it('kod topilmasa nom+birlik bo‘yicha bog‘laydi', () => {
    const r = ishResurslariniBogla(
      aktIsh([{ nom: '  ВОДА  ', bir: 'м³' }]),
      smetaIsh([{ nom: 'Вода', birlik: 'М3' }]),
      new Map(),
    );
    expect(r.bogland).toBe(1);
    expect(r.mapping.get('f2_100')).toBe(200);
  });

  /* ⚠️ Eng muhim qoida: taxmin yo'q. Ikki bir xil nomzod bo'lsa —
     bog'lanmaydi, chunki noto'g'ri tanlov = pul boshqa qatorga yoziladi. */
  it('nomzod bir nechta bo‘lsa BOG‘LAMAYDI (taxmin qilmaydi)', () => {
    const r = ishResurslariniBogla(
      aktIsh([{ nom: 'Sement', bir: 'kg' }]),
      smetaIsh([{ nom: 'Sement', birlik: 'kg' }, { nom: 'Sement', birlik: 'kg' }]),
      new Map(),
    );
    expect(r.bogland).toBe(0);
    expect(r.qoldi).toBe(1);
    expect(r.qoldiUidlar).toEqual(['f2_100']);
  });

  it('boshqa akt qatori band qilgan smeta qatorini qayta ishlatmaydi', () => {
    const r = ishResurslariniBogla(
      aktIsh([{ kod: '1', nom: 'Ishchi' }]),
      smetaIsh([{ kod: '1', nom: 'Ishchi' }]),
      new Map([['boshqa_uid', 200]]), // 200 allaqachon band
    );
    expect(r.bogland).toBe(0);
    expect(r.qoldi).toBe(1);
  });

  it('allaqachon bog‘langan akt qatoriga tegmaydi', () => {
    const oldingi = new Map([['f2_100', 999]]);
    const r = ishResurslariniBogla(
      aktIsh([{ kod: '1', nom: 'Ishchi' }]),
      smetaIsh([{ kod: '1', nom: 'Ishchi' }]),
      oldingi,
    );
    expect(r.mapping.get('f2_100')).toBe(999);
    expect(r.bogland).toBe(0);
  });

  it('resurs bo‘lmagan bolalarni (rz/bl) e’tiborga olmaydi', () => {
    const r = ishResurslariniBogla(
      aktIsh([{ type: 'bl', nom: 'Ichki ish' }, { kod: '1', nom: 'Ishchi' }]),
      smetaIsh([{ type: 'bl', nom: 'Ichki ish' }, { kod: '1', nom: 'Ishchi' }]),
      new Map(),
    );
    expect(r.bogland).toBe(1);
    expect(r.qoldi).toBe(0);
  });

  it('kirish xaritasini o‘zgartirmaydi (yangi Map qaytaradi)', () => {
    const kirish = new Map<string, number>();
    const r = ishResurslariniBogla(
      aktIsh([{ kod: '1', nom: 'Ishchi' }]), smetaIsh([{ kod: '1', nom: 'Ishchi' }]), kirish);
    expect(kirish.size).toBe(0);
    expect(r.mapping.size).toBe(1);
  });
});

describe('ishMi', () => {
  it('resurslari bor bl — ish', () => {
    expect(ishMi({ type: 'bl', children: [{}] })).toBe(true);
  });
  it('bo‘lim (rz) — ish emas', () => {
    expect(ishMi({ type: 'rz', children: [{}] })).toBe(false);
  });
  it('bolasiz barg — ish emas', () => {
    expect(ishMi({ type: 'bl', children: [] })).toBe(false);
    expect(ishMi({ type: 'rs' })).toBe(false);
  });
});
