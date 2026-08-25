import { yozAmali } from './supabase';

export async function sbSozlamaOl(kompaniya_id: number) {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_sozlama', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  });
  const json = await res.json();
  return json.qatorlar?.[0] || null;
}

export function sbSozlamaSaqla(kompaniya_id: number, sozlamalar: any) {
  return yozAmali({
    amal: 'sozlama_saqla',
    kompaniya_id: kompaniya_id,
    sozlamalar: sozlamalar
  });
}
