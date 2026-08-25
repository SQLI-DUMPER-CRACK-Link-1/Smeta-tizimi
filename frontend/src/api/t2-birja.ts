import { yozAmali } from './supabase';

export async function sbBirjaSorovOl(kategoriya?: string) {
  const filtr = kategoriya ? 'kategoriya.eq.' + kategoriya : '';
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_birja_rfq', filtr })
  });
  return await res.json();
}

export function sbBirjaRfqYarat(payload: any) {
  return yozAmali({
    amal: 'birja_rfq_yarat',
    ...payload
  });
}

export function sbBirjaTaklifBer(rfqId: number, narx: number, izoh: string) {
  return yozAmali({
    amal: 'birja_taklif_ber',
    rfq_id: rfqId,
    narx: narx,
    izoh: izoh
  });
}
