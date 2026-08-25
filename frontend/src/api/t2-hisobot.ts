import { yozAmali } from './supabase';

export async function sbBossInitOl(kompaniya_id: number) {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 'v_boss_init', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  });
  return await res.json();
}

export async function sbBossDataOl(kompaniya_id: number, sana_dan: string, sana_gacha: string) {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 'v_boss_data', filtr: 'kompaniya_id.eq.' + kompaniya_id }) 
  });
  return await res.json();
}

export function sbBossAmalQil(amal: 'tahlil_boshla', payload: any) {
  return yozAmali({
    amal: 'boss_' + amal,
    ...payload
  });
}
