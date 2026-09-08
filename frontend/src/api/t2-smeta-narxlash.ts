import { yozAmali } from './supabase';

export type ResNarxYuk = { sourceRef: string; kod?: string; nom: string; birlik: string; narx: number };
export type ResQoldaMoslash = { qatorId: number; sourceRef: string };
export type SmetaNarxlashNatija = {
  ok: boolean; error?: string; code?: string; takror?: boolean;
  kiritilgan?: number; yaroqli_manba?: number; ziddiyatli_manba?: number;
  narxsiz?: number; mos?: number; avto_mos?: number; qolda_mos?: number;
  yozildi?: number; narxsiz_qoldi?: number;
};

/**
 * Narxlash actorini browser bermaydi: `/api/sb-yoz` uni tekshirilgan sessiyadan
 * qo'shadi, RPC esa obyekt tenantini va faol a'zolikni yana tekshiradi.
 */
export function sbT2SmetaNarxlaRes(p: {
  kompaniyaId: number; obyektId: number; operationId: string; narxlar: ResNarxYuk[];
  qoldaMoslash?: ResQoldaMoslash[];
}): Promise<SmetaNarxlashNatija> {
  return yozAmali({
    amal: 'smeta_narxla_res_v2', kompaniya_id: p.kompaniyaId, obyekt_id: p.obyektId,
    operation_id: p.operationId, narxlar: p.narxlar, qolda_moslash: p.qoldaMoslash ?? [],
  }) as Promise<SmetaNarxlashNatija>;
}
