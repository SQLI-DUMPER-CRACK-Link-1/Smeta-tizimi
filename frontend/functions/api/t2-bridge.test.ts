import { describe, expect, it } from 'vitest';
import { projectionHash } from './t2-bridge';

describe('T2 Bridge proyeksiya xeshi', () => {
  const rows = [{ qator_id: 7, kod: 'BL-7', nom: 'Beton B25', birlik: 'm3', fakt_hajm: 3, f2_mumkin_hajm: 2 }];

  it('bir xil kanonik proyeksiya uchun barqaror xesh qaytaradi', async () => {
    await expect(projectionHash(rows)).resolves.toBe(await projectionHash(rows));
  });

  it('shu qator sonida Fakt o‘zgarsa ham xeshni o‘zgartiradi', async () => {
    expect(await projectionHash(rows)).not.toBe(await projectionHash([{ ...rows[0], fakt_hajm: 4, f2_mumkin_hajm: 3 }]));
  });
});
