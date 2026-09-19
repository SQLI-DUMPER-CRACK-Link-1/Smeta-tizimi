/**
 * Faktni qaysi kanonik qatorda operator kiritishi mumkinligini aniqlaydi.
 *
 * BL — ish hajmi; MAT/OB — mustaqil material yoki uskuna. BL ichidagi RS
 * resurslari norma × BL Fakt orqali hisoblanadi. Bu faqat ko‘rinish qoidasi
 * emas: xuddi shu qonun DB commandida ham majburiy tekshiriladi.
 */
export type FaktInputTur = 'bl' | 'mat' | 'ob' | 'rs' | 'rz' | string;

export function faktQoldaKiritiladimi(tur: FaktInputTur): boolean {
  return tur === 'bl' || tur === 'mat' || tur === 'ob';
}

export function faktKiritishIzohi(tur: FaktInputTur): string {
  if (tur === 'rs') return 'RS resursi BL Fakt × norma sarf orqali avtomatik hisoblanadi.';
  if (tur === 'rz') return 'Razdel jamlanma qator; unga Fakt kiritilmaydi.';
  return 'Fakt ushbu kanonik qatorga kiritiladi.';
}
