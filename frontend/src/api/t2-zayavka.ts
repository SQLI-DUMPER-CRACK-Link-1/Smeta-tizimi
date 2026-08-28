import { sbOqi, yozAmali } from './supabase';

export type ZayavkaHolat = 'yangi' | 'jarayonda' | 'qisman' | 'bajarildi' | 'bekor_qilindi';

export type T2Zayavka = {
  id: number;
  obyekt_id: number;
  obyekt_nomi?: string;
  tashabbuskor: string; // 'PTO', 'Prorab', 'Snabjeniya'
  material: string;
  hajm: number;
  birlik: string;
  muddat: string; 
  holat: ZayavkaHolat;
  izoh: string;
  yaratildi: string;
};

// Zayavkalar ro'yxatini olish (obyekt bo'yicha yoki umumiy)
export function sbZayavkalarOl(obyektId?: number) {
  return sbOqi<T2Zayavka>({
    jadval: 't2_zayavka_royxat', // Claude shunga mos view yoki table qiladi
    filtr: obyektId ? `obyekt_id=eq.${obyektId}` : undefined,
    tartib: 'yaratildi.desc',
    limit: 1000
  });
}

// Zayavka yaratish
export function sbZayavkaYoz(p: { obyektId: number, tashabbuskor: string, material: string, hajm: number, birlik: string, muddat: string, izoh: string }) {
  return yozAmali({
    amal: 'zayavka_yarat',
    obyekt_id: p.obyektId,
    tashabbuskor: p.tashabbuskor,
    material: p.material,
    hajm: p.hajm,
    birlik: p.birlik,
    muddat: p.muddat,
    izoh: p.izoh
  });
}
