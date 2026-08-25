import { yozAmali } from './supabase';

// --- ERP (Kadrlar, Texnika, Ta'minot, Sifat) ---

export async function sbErpDashboardOl(modul: 'kadrlar'|'texnika'|'taminot'|'sifat', kompaniya_id: number) {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: \_erp_\_dashboard\, filtr: \kompaniya_id.eq.\\ })
  });
  return await res.json();
}

export function sbErpAmalQil(amal: string, payload: any) {
  return yozAmali({
    amal: \erp_\\,
    ...payload
  });
}
