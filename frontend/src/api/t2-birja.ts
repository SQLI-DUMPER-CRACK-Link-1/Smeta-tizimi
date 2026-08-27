import { sbOqi, yozAmali, yangiOperationId } from './supabase';

/** ⚠️ 2026-08-27 (Claude): `kategoriya` ustuni HECH QACHON qo'shilmagan
 *  (`t2_birja_rfq` da yo'q) va tartiblash `yaratildi` emas
 *  `yaratilgan_vaqt` — bu ikkisi xato bo'lgani uchun PostgREST HAR
 *  DOIM "column does not exist" bilan rad etardi. Birja sahifasi shu
 *  sabab hech qachon ro'yxat ko'rsatmasdi ("hech narsa ishlamaydi"). */
export type BirjaRfq = {
  id: number; kompaniya_id: number; nom: string; birlik: string;
  hajm: number; izoh: string | null; holat: string;
  versiya: number; kim: string | null; yaratilgan_vaqt: string;
};

export function sbBirjaSorovOl() {
  return sbOqi<BirjaRfq>({
    jadval: 't2_birja_rfq',
    tartib: 'yaratilgan_vaqt.desc',
    limit: 1000,
  });
}

export type BirjaTaklif = {
  id: number; rfq_id: number; kompaniya_id: number;
  narx: number; izoh: string | null; holat: string;
  kim: string | null; yaratilgan_vaqt: string;
};

export function sbBirjaTakliflarOl(rfqId: number) {
  return sbOqi<BirjaTaklif>({
    jadval: 't2_birja_taklif',
    filtr: 'rfq_id=eq.' + rfqId,
    tartib: 'narx.asc',
    limit: 500,
  });
}

/* ⚠️ `operation_id` HAR CHAQIRUVDA YANGI — qayta urinishda BIR XIL
   qolishi kerak edi (chaqiruvchi tomonidan saqlansa), lekin bu yerda
   soddalik uchun har chaqiruvda yangi yaratamiz: ikkilanib bosilgan
   RFQ/taklif oqibati unchalik og'ir emas (foydalanuvchi ko'radi va
   bekor qilishi mumkin), narxlar markazi/to'lov kabi jim ikki marta
   yozilishi xavfli joylardan farqli. */
export function sbBirjaRfqYarat(payload: {
  nom: string; birlik: string; hajm: number; izoh?: string; kompaniya_id: number;
}) {
  return yozAmali({
    amal: 'birja_rfq_yarat',
    operation_id: yangiOperationId(),
    ...payload,
  });
}

export function sbBirjaTaklifBer(rfqId: number, kompaniyaId: number, narx: number, izoh: string) {
  return yozAmali({
    amal: 'birja_taklif_ber',
    rfq_id: rfqId,
    kompaniya_id: kompaniyaId,
    narx: narx,
    izoh: izoh,
    operation_id: yangiOperationId(),
  });
}
