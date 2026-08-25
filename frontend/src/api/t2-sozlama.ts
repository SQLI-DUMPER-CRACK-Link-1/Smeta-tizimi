import { yozAmali } from './supabase';

export async function sbSozlamalarOl(kompaniya_id: number) {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_sozlama', filtr: \kompaniya_id.eq.\\ })
  });
  return await res.json();
}

export function sbSozlamaSaqla(payload: any) {
  return yozAmali({
    amal: 'sozlama_saqla',
    ...payload
  });
}
