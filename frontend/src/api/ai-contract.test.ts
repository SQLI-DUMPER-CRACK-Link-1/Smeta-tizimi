import { describe, expect, it } from 'vitest';
import { normalizeFakturaAiPayload } from '../../functions/_shared/faktura-ai';

const validRow = {
  fakturaRaqami: 'EHF-1',
  postavshik: 'Yetkazib beruvchi MCHJ',
  kelganSana: '2026-08-28',
  nomi: 'Sement M400',
  birligi: 'kg',
  miqdori: '1 000',
  narxi: '12 500',
  jamiNdsSiz: '12 500 000',
  ndsSummasi: '1 500 000',
  jamiNdsBilan: '14 000 000',
};

describe('Tizim_02 AI faktura kontrakti', () => {
  it('raqamli satrlarni normalizatsiya qiladi va valid summani qabul qiladi', () => {
    const result = normalizeFakturaAiPayload({ supplier: 'Yetkazib beruvchi MCHJ', items: [validRow] });

    expect(result.ok).toBe(true);
    expect(result.items?.[0].miqdori).toBe(1000);
    expect(result.items?.[0].narxi).toBe(12500);
    expect(result.items?.[0].jamiNdsBilan).toBe(14000000);
  });

  it('narx yoki jami noaniq bo‘lsa fail-closed ishlaydi', () => {
    const result = normalizeFakturaAiPayload({ items: [{ ...validRow, narxi: null }] });

    expect(result.ok).toBe(false);
    expect(result.items).toBeUndefined();
  });

  it('AI noto‘g‘ri summa qaytarsa qator moliyaviy yozuvga o‘tkazilmaydi', () => {
    const result = normalizeFakturaAiPayload({ items: [{ ...validRow, jamiNdsBilan: 1 }] });

    expect(result.ok).toBe(false);
    expect(result.xabar).toContain('ishonchli emas');
  });

  it('bitta faylda aralash fakturalarni rad etadi', () => {
    const result = normalizeFakturaAiPayload({
      items: [validRow, { ...validRow, fakturaRaqami: 'EHF-2' }],
    });

    expect(result.ok).toBe(false);
    expect(result.xabar).toContain('alohida yuklang');
  });
});
