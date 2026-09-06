import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('kanonik LRV sahifasi kundalik native oqimni birlashtiradi', () => {
  const source = readFileSync(resolve(process.cwd(), 'src', 'admin', 'sahifalar', 'HolatNative.tsx'), 'utf8');

  it('faqat raqamli obyekt kontekstida mavjud native panellarni ulaydi', () => {
    expect(source).toContain("import SmetaYuklaNative from './SmetaYuklaNative';");
    expect(source).toContain("import AdditionalReplacementNative from './AdditionalReplacementNative';");
    expect(source).toContain("import ResursVedomostNative from './ResursVedomostNative';");
    expect(source).toContain("import NarxNazoratNative from './NarxNazoratNative';");
    expect(source).toContain('<SmetaYuklaNative obyektId={obyektId} />');
    expect(source).toContain('<AdditionalReplacementNative obyektId={obyektId} />');
    expect(source).toContain('<ResursVedomostNative obyektId={obyektId} />');
    expect(source).toContain('<NarxNazoratNative obyektId={obyektId} />');
  });

  it('eski GAS kompozit sahifani canonical LRV oqimiga qaytarmaydi', () => {
    expect(source).not.toContain("from './Holat'");
    expect(source).not.toContain('apiHolatOl');
  });
});
