import { yozAmali } from './supabase';

export async function sbTizimHolatOl() {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_kompaniya', filtr: '' })
  });
  return await res.json();
}

export function sbTizimAmal(amal: string, payload: any) {
  return yozAmali({
    amal: \	izim_\\,
    ...payload
  });
}
