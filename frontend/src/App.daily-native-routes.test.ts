import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('kundalik PTO routelari native qoladi', () => {
  const app = readFileSync(resolve(process.cwd(), 'src', 'App.tsx'), 'utf8');
  it('LRV, Fakt, F2 import va F2 tayyorlash eski GAS komponentlariga qaytmaydi', () => {
    expect(app).toContain('<Route path="holat" element={<HolatNative />} />');
    expect(app).toContain('<Route path="fakt" element={<FaktNative />} />');
    expect(app).toContain('<Route path="f2" element={<F2ImportNative />} />');
    expect(app).toContain('<Route path="f2-tayyorlash" element={<F2TayyorlashNative />} />');
    expect(app).not.toContain("import { F2Import } from './admin/sahifalar/F2Import'");
  });
});
