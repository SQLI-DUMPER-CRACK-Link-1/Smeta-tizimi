import { sbOqi, yozAmali } from './supabase';

export function sbErpDashboardOl(modul: 'kadrlar'|'texnika'|'taminot'|'sifat', kompaniya_id: number) {
  return sbOqi<Record<string, unknown>>({
    jadval: ('v_erp_' + modul + '_dashboard') as any,
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    limit: 5000,
  });
}

export function sbErpAmalQil(amal: string, payload: any) {
  return yozAmali({
    amal: 'erp_' + amal,
    ...payload
  });
}
