import { sbOqi, type T2QatorHolat } from './supabase';

/**
 * Obyektning faqat berilgan qatorlari holati. `obyekt_id=eq.N` filtri
 * majburiy qoladi — gateway tenant chegarasini shu bilan tekshiradi.
 */
export function sbT2QatorHolatQisman(obyektId: number, qatorIdlar: readonly number[]) {
  const idlar = qatorIdlar.filter((id) => Number.isSafeInteger(id) && id > 0);
  return sbOqi<T2QatorHolat>({
    jadval: 't2_qator_holat',
    filtr: `obyekt_id=eq.${obyektId}&qator_id=in.(${idlar.join(',')})`,
    limit: Math.max(1, idlar.length),
  });
}
