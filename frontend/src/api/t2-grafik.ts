import { sbOqi, yozAmali } from './supabase';

export function sbGrafikHolatOl(kompaniya_id: number, obyekt_id: number) {
  return sbOqi<Record<string, unknown>>({
    jadval: 't2_grafik_holat',
    filtr: 'kompaniya_id=eq.' + kompaniya_id + '&obyekt_id=eq.' + obyekt_id,
    limit: 200,
  });
}

export function sbGrafikAmalQil(amal: 'yangilash' | 'sozlama_saqla', payload: any) {
  return yozAmali({
    amal: 'grafik_' + amal,
    ...payload
  });
}
