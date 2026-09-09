import { describe, expect, it } from 'vitest';
import { filtrlaKompaniyaObyektlari } from './hooks';
import type { PapkaObyekt } from './types';

function obyekt(nom: string): PapkaObyekt {
  return {
    obyekt: nom, folderId: 'f_' + nom, lokId: '', lokName: '', svodId: '', svodName: '',
    format: 'TN', lokSheets: [], svodSheets: [],
  };
}

/**
 * T2-LEGACY-DRIVE-SCAN-COMPANY-LEAK-001: haqiqiy hodisa -- eski GAS
 * sahifalari (Obyektlar/Holat/Narxlar va h.k, `useObyektlar` orqali)
 * `apiPapkaSkan`ning UMUMIY (bitta, kompaniyasiz) Drive skanini
 * to'g'ridan-to'g'ri ko'rsatardi -- boshqa kompaniyalarning obyektlari
 * ham ko'rinardi. Bu sof funksiya endi shu natijani kanonik (Supabase)
 * kompaniya-scoped nomlar bilan filtrlaydi.
 */
describe('filtrlaKompaniyaObyektlari', () => {
  it('faqat kanonik ro\'yxatdagi (shu kompaniyaning) obyektlarni qoldiradi', () => {
    const skan = [obyekt('Amfiteatr'), obyekt('Boshqa Kompaniya Obyekti'), obyekt('Maktab-5')];
    const kanonik = [{ nom: 'Amfiteatr' }, { nom: 'Maktab-5' }];
    const natija = filtrlaKompaniyaObyektlari(skan, kanonik);
    expect(natija.map((o) => o.obyekt)).toEqual(['Amfiteatr', 'Maktab-5']);
  });

  it('kanonik ro\'yxat bo\'sh bo\'lsa (kompaniya konteksti yo\'q) -- HECH narsa qaytarmaydi (fail-closed)', () => {
    const skan = [obyekt('Amfiteatr'), obyekt('Maktab-5')];
    expect(filtrlaKompaniyaObyektlari(skan, [])).toEqual([]);
  });

  it('nom solishtirish registr va bo\'sh joyga chidamli', () => {
    const skan = [obyekt('  AMFITEATR  ')];
    const kanonik = [{ nom: 'amfiteatr' }];
    expect(filtrlaKompaniyaObyektlari(skan, kanonik)).toHaveLength(1);
  });

  it('kanonikda bo\'sh/null nomlarni e\'tiborsiz qoldiradi (bo\'sh nomga mos kelib ketmasin)', () => {
    const skan = [obyekt('')];
    const kanonik = [{ nom: null }, { nom: '' }];
    expect(filtrlaKompaniyaObyektlari(skan, kanonik)).toEqual([]);
  });
});
