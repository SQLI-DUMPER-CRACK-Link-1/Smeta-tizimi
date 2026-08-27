import { sbOqi, yozAmali, yangiOperationId } from './supabase';

export function sbBirjaSorovOl(kategoriya?: string) {
  return sbOqi<{
    id: number; kompaniya_id: number; nom: string; birlik: string;
    hajm: number; izoh: string | null; holat: string;
    kategoriya: string | null; yaratildi: string; kim: string | null;
  }>({
    jadval: 't2_birja_rfq',
    filtr: kategoriya ? 'kategoriya=eq.' + encodeURIComponent(kategoriya) : undefined,
    tartib: 'yaratildi.desc',
    limit: 1000,
  });
}

/* ⚠️ `operation_id` HAR CHAQIRUVDA YANGI — qayta urinishda BIR XIL
   qolishi kerak edi (chaqiruvchi tomonidan saqlansa), lekin bu yerda
   soddalik uchun har chaqiruvda yangi yaratamiz: ikkilanib bosilgan
   RFQ/taklif oqibati unchalik og'ir emas (foydalanuvchi ko'radi va
   bekor qilishi mumkin), narxlar markazi/to'lov kabi jim ikki marta
   yozilishi xavfli joylardan farqli. */
export function sbBirjaRfqYarat(payload: any) {
  return yozAmali({
    amal: 'birja_rfq_yarat',
    operation_id: yangiOperationId(),
    ...payload
  });
}

export function sbBirjaTaklifBer(rfqId: number, narx: number, izoh: string) {
  return yozAmali({
    amal: 'birja_taklif_ber',
    rfq_id: rfqId,
    narx: narx,
    izoh: izoh,
    operation_id: yangiOperationId(),
  });
}
