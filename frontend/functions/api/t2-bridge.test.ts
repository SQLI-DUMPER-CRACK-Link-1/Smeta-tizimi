import { describe, expect, it } from 'vitest';
import {
  normalizeProjectionRows,
  parseFiniteBridgeNumber,
  projectionHash,
  validateFaktWritePayload,
} from './t2-bridge';

describe('T2 Bridge proyeksiya xeshi', () => {
  const rows = [{
    qator_id: 7, tur: 'bl', kod: 'BL-7', nom: 'Beton B25', birlik: 'm3', kat: 'МАТ',
    smeta_hajm: 10, smeta_narx: 50, smeta_summa: 500,
    fakt_hajm: 3, fakt_summa: 150, f2_hajm: 1, f2_summa: 49.99,
    qoldiq_hajm: 9, qoldiq_summa: 450, f2_mumkin_hajm: 2, f2_mumkin_summa: 100,
    f2_narx: 49.99, fakt_narx: 50, f2_narx_farq_foiz: -0.02, t2_entity_version: 4,
  }];

  it('bir xil kanonik proyeksiya uchun barqaror xesh qaytaradi', async () => {
    await expect(projectionHash(rows)).resolves.toBe(await projectionHash(rows));
  });

  it('shu qator sonida Fakt o‘zgarsa ham xeshni o‘zgartiradi', async () => {
    expect(await projectionHash(rows)).not.toBe(await projectionHash([{ ...rows[0], fakt_hajm: 4, f2_mumkin_hajm: 3 }]));
  });

  it('qatorlar kelish tartibi o‘zgarsa ham xesh bir xil qoladi', async () => {
    const other = { ...rows[0], qator_id: 8, t2_entity_version: 2 };
    await expect(projectionHash([rows[0], other])).resolves.toBe(await projectionHash([other, rows[0]]));
  });

  it('versiya o‘zgarsa proyeksiya ham yangi deb belgilanadi', async () => {
    expect(await projectionHash(rows)).not.toBe(await projectionHash([{ ...rows[0], t2_entity_version: 5 }]));
  });

  it('bo‘sh katakni Fakt=0 deb yubormaydi', () => {
    expect(parseFiniteBridgeNumber('')).toBeNull();
    expect(validateFaktWritePayload({
      operation_id: 'f2ee16f8-0488-4a42-a113-4493ee1d0bf9', qator_id: 7,
      base_fakt_hajm: '', fakt_hajm: 3, base_entity_version: 4,
    })).toEqual({ ok: false, code: 'FAKT_VALUE_INVALID' });
  });

  it('Fakt yozish uchun qator ID, base version va qiymatni majburiy qiladi', () => {
    expect(validateFaktWritePayload({
      operation_id: 'f2ee16f8-0488-4a42-a113-4493ee1d0bf9', qator_id: '7',
      base_fakt_hajm: '3', fakt_hajm: '4.25', base_entity_version: '4',
    })).toMatchObject({ ok: true, qatorId: 7, expected: 3, next: 4.25, baseVersion: 4 });
    expect(validateFaktWritePayload({
      operation_id: 'f2ee16f8-0488-4a42-a113-4493ee1d0bf9', qator_id: 7,
      base_fakt_hajm: 3, fakt_hajm: 4,
    })).toEqual({ ok: false, code: 'ENTITY_VERSION_REQUIRED' });
  });

  it('proyeksiya normalizationi texnik identity/versionni hashga qo‘shadi', () => {
    const normalized = normalizeProjectionRows(rows);
    expect(normalized[0][0]).toBe(7);
    expect(normalized[0].at(-1)).toBe(4);
  });
});
