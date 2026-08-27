import { yozAmali, sbOqi } from './supabase';

// --- TIZIM (Audit, Loglar, Ruxsatlar) ---

export function sbTizimLoglari(kompaniya_id: number) {
  return sbOqi({
    jadval: 't2_kompaniya',
    filtr: 'id=eq.' + kompaniya_id,
    limit: 10,
  });
}

export function sbTizimAmal(amal: string, payload: any) {
  return yozAmali({
    amal: 'tizim_amal',
    harakat: amal,
    ...payload
  });
}
