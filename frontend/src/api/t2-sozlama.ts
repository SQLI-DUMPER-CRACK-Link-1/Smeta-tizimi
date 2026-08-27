import { sbOqi, yozAmali } from './supabase';

export function sbSozlamaOl(kompaniya_id: number) {
  return sbOqi<Record<string, unknown>>({
    jadval: 't2_sozlama',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    limit: 10,
  }).then(r => r.qatorlar?.[0] ?? null);
}

export function sbSozlamaSaqla(kompaniya_id: number, sozlamalar: any) {
  return yozAmali({
    amal: 'sozlama_saqla',
    kompaniya_id: kompaniya_id,
    sozlamalar: sozlamalar
  });
}
