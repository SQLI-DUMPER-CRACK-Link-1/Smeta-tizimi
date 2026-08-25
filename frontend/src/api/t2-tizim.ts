import { yozAmali } from './supabase';

// --- TIZIM (Audit, Loglar, Ruxsatlar) ---

export async function sbTizimLoglari(kompaniya_id: number) {
  // Aslida bu yerda audit log jadvali bo'ladi
  return fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_kompaniya', filtr: 'id.eq.' + kompaniya_id })
  }).then(r => r.json());
}

export function sbTizimAmal(amal: string, payload: any) {
  return yozAmali({
    amal: 'tizim_amal',
    harakat: amal,
    ...payload
  });
}
