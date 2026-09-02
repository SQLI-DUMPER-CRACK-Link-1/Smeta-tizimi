/**
 * KompaniyaTanlov.tsx — ESKI YO'L, endi faqat re-export.
 * ═══════════════════════════════════════════════════════════════════
 * Kompaniya konteksti bitta joyga ko'chirildi:
 *   frontend/src/umumiy/kontekst/KompaniyaKontekst.tsx
 *
 * Bu fayl faqat eski
 *   import { useKompaniya } from '.../test02/KompaniyaTanlov'
 * yo'llari sinmasligi uchun turadi. Yangi kod to'g'ridan
 * `umumiy/kontekst` dan import qilsin.
 */
export {
  KompaniyaProvider,
  useKompaniya,
  kompaniyaXatoMatni,
} from '../umumiy/kontekst/KompaniyaKontekst';

export type { KompaniyaQisqa } from '../umumiy/kontekst/KompaniyaKontekst';

export { KompaniyaTanlagich, MavqeBelgisi } from '../umumiy/kontekst/KompaniyaTanlagich';
