import { yozAmali } from './supabase';

export async function sbErpDashboardOl(modul: 'kadrlar'|'texnika'|'taminot'|'sifat', kompaniya_id: number) {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 'v_erp_' + modul + '_dashboard', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  });
  return await res.json();
}

export function sbErpAmalQil(amal: string, payload: any) {
  return yozAmali({
    amal: 'erp_' + amal,
    ...payload
  });
}
