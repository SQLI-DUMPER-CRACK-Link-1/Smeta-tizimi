/**
 * Real F2 korpusi (egasining Drive `F2` papkasi, 2025-09 … 2026-04). Fayllar repoda EMAS —
 * `F2_KORPUS_DIR` berilganda yuradi. Kutilgan natijalar 2026-09-25 da qo'lda tekshirilgan:
 * hujjat ИТОГО ПРЯМЫЕ ЗАТРАТЫ = barglar yig'indisi (tiyingacha) yoki farq sababi aniq.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { faylniOqi } from './oqish';
import { f2AktlarniOqi } from '../f2';

const DIR = process.env.F2_KORPUS_DIR;

const KUTILGAN: Record<string, { davr: string; farq0?: boolean; farqIzoh?: RegExp; xatoQiymat?: boolean }> = {
  'Стелла1 kiritilgan.xlsx': { davr: '2025-09', farq0: true },
  'stella_f2_2025-09.xlsx': { davr: '2025-09', farq0: true },
  'Водопровод kiritilgan.xlsx': { davr: '2025-09', farq0: true },
  'ИСк озера kiritilgan.xlsx': { davr: '2025-12', farq0: true },
  'ТРОТУАР kiritilgan1.xlsx': { davr: '2025-09', farq0: true },
  'Озеро и канал 1-2 kiritilgan.xlsx': { davr: '2025-09', farqIzoh: /26-ish.*27-ish.*formulasiga kirmagan/ },
  'Искусственное озера04.xlsx': { davr: '2026-04', xatoQiymat: true },
};

describe.skipIf(!DIR)('F2 korpusi — real hujjatlar', () => {
  for (const [fayl, k] of Object.entries(KUTILGAN)) {
    it(fayl, () => {
      const p = path.join(DIR!, fayl);
      if (!fs.existsSync(p)) return;
      const aktlar = f2AktlarniOqi(faylniOqi(p, DIR!));
      expect(aktlar.length).toBeGreaterThan(0);
      const a = aktlar[0];
      expect(a.davr).toBe(k.davr);
      if (k.farq0) {
        expect(a.jami.pryamye).not.toBeNull();
        expect(Math.abs((a.jami.pryamye ?? 0) - a.qatorlarJami)).toBeLessThanOrEqual(1);
        expect(a.ogohlantirishlar.map((o) => o.kod)).not.toContain('JAMI_FARQ');
      }
      if (k.farqIzoh) expect(a.ogohlantirishlar.find((o) => o.kod === 'JAMI_FARQ')?.izoh).toMatch(k.farqIzoh);
      if (k.xatoQiymat) expect(a.ogohlantirishlar.some((o) => o.kod === 'XATO_QIYMAT')).toBe(true);
      const matn = JSON.stringify(a.daraxt);
      expect(matn).not.toMatch(/"nom":"(ЗАКАЗЧИК|ПОДРЯДЧИК|Представитель)/);
    });
  }
});
