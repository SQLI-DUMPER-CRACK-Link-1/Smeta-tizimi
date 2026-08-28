import { sbOqi, yozAmali, type AktNatija } from './supabase';

/** `t2_erp_amal` saqlaydigan haqiqiy holatlar. UI ularni o'zicha
 * boshqa nomlarga aylantirmaydi — mindmap ham shu qiymatlarni ko'radi. */
export type ZayavkaHolat = 'kutilmoqda' | 'tasdiqlandi' | 'yopildi' | 'rad';

/** `t2_zayavka_royxat` view kontrakti (`t2_erp_taminot` ustunlari). */
export type T2Zayavka = {
  id: number;
  kompaniya_id: number;
  obyekt_id: number;
  obyekt_nomi?: string | null;
  buyurtma_raqami?: string | null;
  maxsulot: string;
  miqdor: number;
  birlik?: string | null;
  holat: ZayavkaHolat;
  yaratilgan_vaqt: string;
};

export type ZayavkaNatija = AktNatija & {
  id?: number;
  raqam?: string;
  holat?: ZayavkaHolat;
};

/** Kompaniya doirasidagi zayavkalar. Kompaniya filtri tenant xavfsizligi
 * uchun majburiy: `/api/sb` uni sessiya a'zoligi bilan tekshiradi. */
export function sbZayavkalarOl(kompaniyaId: number, obyektId?: number) {
  const filtrlar = [`kompaniya_id=eq.${kompaniyaId}`];
  if (obyektId != null) filtrlar.push(`obyekt_id=eq.${obyektId}`);
  return sbOqi<T2Zayavka>({
    jadval: 't2_zayavka_royxat',
    filtr: filtrlar.join('&'),
    tartib: 'yaratilgan_vaqt.desc',
    limit: 1000,
  });
}

/** Claude bergan kontraktga adapter:
 * POST /api/sb-yoz { amal:'erp_amal', kompaniya_id,
 * operatsiya:'zayavka_yarat', payload:{...} } */
export function sbZayavkaYoz(
  kompaniyaId: number,
  p: { obyektId: number; maxsulot: string; miqdor: number; birlik?: string; buyurtmaRaqami?: string },
): Promise<ZayavkaNatija> {
  return yozAmali({
    amal: 'erp_amal',
    kompaniya_id: kompaniyaId,
    operatsiya: 'zayavka_yarat',
    payload: {
      obyekt_id: p.obyektId,
      maxsulot: p.maxsulot,
      miqdor: p.miqdor,
      birlik: p.birlik || undefined,
      buyurtma_raqami: p.buyurtmaRaqami || undefined,
    },
  }) as Promise<ZayavkaNatija>;
}

/** Zayavkani keyingi bosqichga o'tkazadi. O'chirish yo'q: `rad` holati
 * tarixni saqlaydi va backend shu qoidani majburlaydi. */
export function sbZayavkaHolatYoz(
  kompaniyaId: number,
  id: number,
  holat: ZayavkaHolat,
): Promise<ZayavkaNatija> {
  return yozAmali({
    amal: 'erp_amal',
    kompaniya_id: kompaniyaId,
    operatsiya: 'zayavka_holat',
    payload: { id, holat },
  }) as Promise<ZayavkaNatija>;
}
