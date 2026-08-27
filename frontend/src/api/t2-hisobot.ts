import { sbOqi } from './supabase';

export function t2BossTahlilOl(kompaniya_id: number) {
  return sbOqi<Record<string, unknown>>({
    jadval: 'v_boss_data',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    limit: 5000,
  });
}

export function sbBossInitOl(kompaniya_id: number) {
  return sbOqi<Record<string, unknown>>({
    jadval: 'v_boss_init',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    limit: 500,
  });
}

export function sbBossDataOl(kompaniya_id: number) {
  return sbOqi<Record<string, unknown>>({
    jadval: 'v_boss_data',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    limit: 5000,
  });
}
