import { yozAmali, sbOqi } from './supabase';

// --- TIZIM (Audit, Loglar, Ruxsatlar) ---

/** ⚠️ 2026-08-27 (Claude): avval `t2_kompaniya`ni o'qib, KOMPANIYA
 *  YOZUVLARINI "log" deb ko'rsatardi — mutlaqo noto'g'ri jadval.
 *  Endi haqiqiy `t2_audit_reestr` (Antigravity qurgan t2_audit_log
 *  ustida) o'qiladi. */
export type AuditLog = {
  id: number; kompaniya_id: number; obyekt_id: number | null;
  kim: string | null; amal_turi: string; modul: string;
  tafsilot: string | null; ip_manzil: string | null; yaratilgan_vaqt: string;
};

export function sbTizimLoglari(kompaniya_id: number) {
  return sbOqi<AuditLog>({
    jadval: 't2_audit_reestr',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    limit: 1000,
  });
}

export function sbTizimAmal(amal: string, payload: any) {
  return yozAmali({
    amal: 'tizim_amal',
    harakat: amal,
    ...payload
  });
}

/** Har qanday sahifa/amal audit logga yozishi uchun umumiy yordamchi. */
export function sbAuditYoz(p: {
  kompaniyaId: number; amalTuri: string; modul: string;
  obyektId?: number; tafsilot?: string;
}) {
  return yozAmali({
    amal: 'audit_yoz',
    kompaniya_id: p.kompaniyaId, amal_turi: p.amalTuri, modul: p.modul,
    obyekt_id: p.obyektId, tafsilot: p.tafsilot,
  });
}
