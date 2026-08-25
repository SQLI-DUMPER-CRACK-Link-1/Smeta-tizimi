import { yozAmali } from './supabase';

// --- GRAFIK (Kalendar / Gantt) ---

export async function sbGrafikHolatOl(kompaniya_id: number, obyekt_id: number) {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_grafik_holat', filtr: \kompaniya_id.eq.\,obyekt_id.eq.\\ })
  });
  return await res.json();
}

export function sbGrafikAmalQil(amal: 'yangilash' | 'sozlama_saqla', payload: any) {
  return yozAmali({
    amal: \grafik_\\,
    ...payload
  });
}
