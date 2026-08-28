/**
 * t2-buxgalteriya.ts — БУХГАЛТЕРИЯ (to'lov/xarajat/dashboard), 2026-08-25
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ko'chirildi: `Smeta tizimi/85_Buxgalteriya.js`.
 *
 * ⚠️ `t2_bux_dashboard.bajarilgan` TOZA (накрутка-tuzatilmagan) F2 jami
 * (`t2_akt.hujjat_jami`) dan hisoblanadi — Tizim_01'dagi накрутка bilan
 * tuzatilgan `jamiF2Nakr` EMAS. Sabab: har kategoriya bo'yicha aniq
 * накрутка-tuzatish qo'shimcha ish talab qiladi; noto'g'ri taxminiy
 * tuzatishdan ko'ra halol-sodda baza yaxshi (VIEW ta'rifida ham yozilgan).
 */
import { sbOqi } from './supabase';

/* ── To'lov ───────────────────────────────────────────────────────── */
export type Tolov = {
  id: number; kompaniya_id: number; shartnoma_id: number;
  obyekt_id: number | null; sana: string; summa: number;
  tur: 'avans' | 'tolov' | 'qaytarim';
  izoh: string | null; holat: 'faol' | 'bekor';
  versiya: number; yaratildi: string; yangilandi: string; kim: string | null;
};

export function sbT2TolovlarOl(shartnomaId?: number, faqatFaol = true) {
  const shartlar: string[] = [];
  if (shartnomaId != null) shartlar.push('shartnoma_id=eq.' + shartnomaId);
  if (faqatFaol) shartlar.push('holat=eq.faol');
  return sbOqi<Tolov>({
    jadval: 't2_tolov',
    filtr: shartlar.length ? shartlar.join('&') : undefined,
    tartib: 'sana.desc', limit: 5000,
  });
}

/* ── Xarajat ──────────────────────────────────────────────────────── */
export type Xarajat = {
  id: number; kompaniya_id: number; sana: string; toifa: string | null;
  summa: number; izoh: string | null; holat: 'faol' | 'bekor';
  versiya: number; yaratildi: string; yangilandi: string; kim: string | null;
};

export function sbT2XarajatlarOl(faqatFaol = true) {
  return sbOqi<Xarajat>({
    jadval: 't2_xarajat',
    filtr: faqatFaol ? 'holat=eq.faol' : undefined,
    tartib: 'sana.desc', limit: 5000,
  });
}

/* ── Hisoblangan ko'rinishlar ────────────────────────────────────── */
export type BuxDashboard = {
  shartnoma_id: number; raqam: string; nom: string | null; taraf: string | null;
  holat: string; dog_summa: number; bajarilgan: number; tolangan: number;
  debitor: number; avans: number;
  bajarilgan_pct: number | null; tolangan_pct: number | null;
};

/* ⚠️ 2026-08-28 (Claude, tenant auditi): kompaniyaId MAJBURIY.
 * Avval bu ko'rinishlarda kompaniya_id ustuni UMUMAN yo'q edi, shuning
 * uchun filtrlash ham MUMKIN emasdi - bir mijoz boshqasining debitor va
 * to'lov holatini ko'rardi. Ustun bazaga qo'shildi (oxiriga, mavjud
 * kod sinmasin), endi filtr shu yerda. */
export function sbT2BuxDashboardOl(kompaniyaId: number) {
  return sbOqi<BuxDashboard>({ jadval: 't2_bux_dashboard', filtr: 'kompaniya_id=eq.' + kompaniyaId, tartib: 'raqam.asc', limit: 5000 });
}

export type DebitorAging = {
  shartnoma_id: number; raqam: string; nom: string | null; taraf: string | null;
  debitor: number; oxirgi_tolov_sana: string | null; kun_otdi: number | null;
};

export function sbT2DebitorAgingOl(kompaniyaId: number) {
  return sbOqi<DebitorAging>({ jadval: 't2_debitor_aging', filtr: 'kompaniya_id=eq.' + kompaniyaId, tartib: 'kun_otdi.desc', limit: 5000 });
}

export type BuxUmumiy = {
  jami_tolangan: number; jami_debitor: number; jami_xarajat: number; kassa_qoldiq: number;
};

export function sbT2BuxUmumiyOl(kompaniyaId: number) {
  return sbOqi<BuxUmumiy>({ jadval: 't2_bux_umumiy', filtr: 'kompaniya_id=eq.' + kompaniyaId });
}

/* ══════════════════════════════════════════════════════════════════
 * YOZISH — nomli amallar orqali (`/api/sb-yoz`)
 * ══════════════════════════════════════════════════════════════════ */

export type BuxNatija = {
  ok: boolean; error?: string; sabab?: string;
  tolov_id?: number; xarajat_id?: number; versiya?: number; takror?: boolean;
  bordagi_versiya?: number; siz_yuborgan?: number;
  ms?: number;
};

async function yoz(yuk: Record<string, unknown>): Promise<BuxNatija> {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/sb-yoz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(yuk),
    });
    const j = (await r.json()) as BuxNatija;
    return { ...j, ms: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)),
             ms: Math.round(performance.now() - t0) };
  }
}

/** To'lov yozadi. `operationId` (UUID) MAJBURIY — idempotentlik uchun. */
export function sbT2TolovYoz(p: {
  shartnomaId: number; summa: number; tur?: 'avans' | 'tolov' | 'qaytarim';
  sana?: string; obyektId?: number; izoh?: string; operationId: string;
}): Promise<BuxNatija> {
  return yoz({
    amal: 'tolov_yoz', shartnoma_id: p.shartnomaId, summa: p.summa,
    tur: p.tur, sana: p.sana, obyekt_id: p.obyektId, izoh: p.izoh,
    operation_id: p.operationId,
  });
}

export function sbT2TolovTahrir(p: {
  tolovId: number; summa?: number; sana?: string;
  tur?: 'avans' | 'tolov' | 'qaytarim'; izoh?: string; kutilganVersiya?: number;
}): Promise<BuxNatija> {
  return yoz({
    amal: 'tolov_tahrir', tolov_id: p.tolovId, summa: p.summa, sana: p.sana,
    tur: p.tur, izoh: p.izoh, kutilgan_versiya: p.kutilganVersiya,
  });
}

/** To'lovni bekor qiladi (o'chirmaydi — tarix saqlanadi). */
export function sbT2TolovOchir(tolovId: number, kutilganVersiya?: number): Promise<BuxNatija> {
  return yoz({ amal: 'tolov_ochir', tolov_id: tolovId, kutilgan_versiya: kutilganVersiya });
}

/** Xarajat yozadi. `operationId` (UUID) MAJBURIY — idempotentlik uchun. */
export function sbT2XarajatYoz(p: {
  summa: number; toifa?: string; sana?: string; izoh?: string; operationId: string;
}): Promise<BuxNatija> {
  return yoz({
    amal: 'xarajat_yoz', summa: p.summa, toifa: p.toifa, sana: p.sana,
    izoh: p.izoh, operation_id: p.operationId,
  });
}

export function sbT2XarajatTahrir(p: {
  xarajatId: number; summa?: number; toifa?: string; sana?: string;
  izoh?: string; kutilganVersiya?: number;
}): Promise<BuxNatija> {
  return yoz({
    amal: 'xarajat_tahrir', xarajat_id: p.xarajatId, summa: p.summa, toifa: p.toifa,
    sana: p.sana, izoh: p.izoh, kutilgan_versiya: p.kutilganVersiya,
  });
}

/** Xarajatni bekor qiladi (o'chirmaydi — tarix saqlanadi). */
export function sbT2XarajatOchir(xarajatId: number, kutilganVersiya?: number): Promise<BuxNatija> {
  return yoz({ amal: 'xarajat_ochir', xarajat_id: xarajatId, kutilgan_versiya: kutilganVersiya });
}
