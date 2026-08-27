import { yozAmali, sbOqi } from './supabase';

/* ⚡ 2026-08-27 (Claude, MASTER_REJA_ENTERPRISE_OS.md — FAZA-oldi eng
 * ustuvor bo'shliq): to'liq domen iyerarxiyasi
 *   Kompaniya → Loyiha → Obyekt → Bo'lim → Ish → Resurs → Operatsiya
 * dagi "Loyiha" (Project) bosqichi hozirgacha yo'q edi — Kompaniya
 * to'g'ridan-to'g'ri Obyektga osilgan edi. Bu foydalanuvchining "5
 * shartnoma, 40 obyekt, bitta 32 gektarlik park" gapining bevosita
 * javobi: bir nechta obyekt endi BITTA loyihaga guruhlanadi.
 * Obyekt loyihasiz ham qolishi mumkin (ixtiyoriy, orqaga moslik). */

export type LoyihaObyekt = { obyekt_id: number; obyekt_nom: string };
export type Loyiha = {
  id: number; kompaniya_id: number; nom: string; izoh: string | null;
  hudud: string | null; versiya: number; yaratildi: string;
  obyektlar: LoyihaObyekt[];
};

export function sbLoyihalarOl(kompaniyaId: number) {
  return sbOqi<Loyiha>({ jadval: 't2_loyiha_royxat', filtr: 'kompaniya_id=eq.' + kompaniyaId, limit: 500 });
}

export function sbLoyihaYarat(p: { kompaniyaId: number; nom: string; izoh?: string; hudud?: string }) {
  return yozAmali({ amal: 'loyiha_yarat', kompaniya_id: p.kompaniyaId, nom: p.nom, izoh: p.izoh, hudud: p.hudud });
}

export function sbLoyihaOchir(id: number) {
  return yozAmali({ amal: 'loyiha_ochir', id });
}

/** Obyektni loyihaga biriktirish; `loyihaId: null` — guruhdan chiqarish. */
export function sbObyektLoyihagaBiriktir(obyektId: number, loyihaId: number | null) {
  return yozAmali({ amal: 'obyekt_loyihaga_biriktir', obyekt_id: obyektId, loyiha_id: loyihaId });
}

/* ⚡ 2026-08-28 (Claude, MASTER_REJA band 1 — polimorfik tashkilot modeli):
 * "Bitta kompaniya turli loyihalarda turli rol o'ynaydi: Buyurtmachi,
 * Bosh pudratchi, Subpudratchi, Loyihachi, Ta'minotchi." Taraf ikki xil
 * bo'lishi mumkin — bizning tenant (`t2_kompaniya`) yoki tashqi B2B
 * reestr (`t2_kontragent`) — ANIQ BITTASI, hech qachon ikkalasi birga. */

export type LoyihaRol =
  | 'zakazchik' | 'bosh_pudratchi' | 'subpudratchi' | 'loyihachi' | 'taminotchi';

export type LoyihaQatnashchi = {
  id: number; rol: LoyihaRol; izoh: string | null; versiya: number;
  kompaniya_id: number | null; kompaniya_nom: string | null;
  kontragent_id: number | null; kontragent_nom: string | null;
};

export type LoyihaQatnashchilar = {
  loyiha_id: number; loyiha_nom: string; qatnashchilar: LoyihaQatnashchi[];
};

export function sbLoyihaQatnashchilarOl(loyihaId: number) {
  return sbOqi<LoyihaQatnashchilar>({
    jadval: 't2_loyiha_qatnashchilar_royxat',
    filtr: 'loyiha_id=eq.' + loyihaId,
    limit: 1,
  });
}

/** Taraf sifatida FAQAT bittasini bering: `kompaniyaId` YOKI `kontragentId`. */
export function sbLoyihaQatnashchiBiriktir(p: {
  loyihaId: number; kompaniyaId?: number | null; kontragentId?: number | null;
  rol: LoyihaRol; izoh?: string;
}) {
  return yozAmali({
    amal: 'loyiha_qatnashchi_biriktir',
    loyiha_id: p.loyihaId,
    kompaniya_id: p.kompaniyaId ?? null,
    kontragent_id: p.kontragentId ?? null,
    rol: p.rol,
    izoh: p.izoh,
  });
}

/** Optimistik qulf — `kutilganVersiya` ro'yxatdan olingan `versiya` bo'lishi shart. */
export function sbLoyihaQatnashchiOchir(id: number, kutilganVersiya: number) {
  return yozAmali({ amal: 'loyiha_qatnashchi_ochir', id, kutilgan_versiya: kutilganVersiya });
}
