import type { F2Exception } from './f2-exact-payload';

export type F2IstisnoGuruhlari = Record<F2Exception['turi'], F2Exception[]>;

/** UI uchun faqat mavjud istisnolarni turi bo'yicha ajratadi; qator yoki summa yaratmaydi. */
export function f2IstisnolarniGuruhla(istisnolar: F2Exception[]): F2IstisnoGuruhlari {
  const guruhlar: F2IstisnoGuruhlari = {
    NEEDS_REVIEW: [],
    ARITHMETIC_MISMATCH: [],
    NEGATIVE_HAJM: [],
    CONFLICTING_PRICES: [],
  };
  for (const istisno of istisnolar) guruhlar[istisno.turi].push(istisno);
  return guruhlar;
}
