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
