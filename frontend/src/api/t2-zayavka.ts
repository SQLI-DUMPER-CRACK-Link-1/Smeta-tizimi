import { sbOqi, yozAmali, type AktNatija, type SbJavob } from './supabase';
import { yangiOperationId } from './t2-mindmap';
import { trackEntityCommand } from './entity-consistency';

export type ProcurementStatus = 'draft' | 'submitted' | 'approved' | 'procurement' | 'ordered' | 'partially_delivered' | 'delivered' | 'closed' | 'cancelled';
export type ZayavkaHolat = ProcurementStatus;
export type ProcurementRequest = {
  id: number; kompaniyaId: number; obyektId: number; materialId: number | null; itemText: string;
  requestedQty: number; unit: string | null; requiredDate: string | null; priority: string | null; note: string | null;
  status: ProcurementStatus; deliveredQty: number; remainingQty: number | null; version: number;
  requestedBy?: number | null; approvedBy?: number | null; createdAt?: string | null; updatedAt?: string | null;
};
export type T2Zayavka = ProcurementRequest;
export type ZayavkaNatija = AktNatija & { id?: number; status?: ProcurementStatus; holat?: ProcurementStatus };
type DbRow = Record<string, any>;
function statusOf(v: any): ProcurementStatus {
  const s = String(v || 'draft');
  if (s === 'kutilmoqda') return 'submitted'; if (s === 'tasdiqlandi') return 'approved'; if (s === 'yopildi') return 'delivered'; if (s === 'rad') return 'cancelled';
  return (['draft','submitted','approved','procurement','ordered','partially_delivered','delivered','closed','cancelled'] as string[]).includes(s) ? s as ProcurementStatus : 'draft';
}
function mapRow(r: DbRow): ProcurementRequest {
  return { id: Number(r.id), kompaniyaId: Number(r.kompaniya_id), obyektId: Number(r.obyekt_id), materialId: r.material_id == null ? null : Number(r.material_id),
    itemText: String(r.item_text ?? r.maxsulot ?? ''), requestedQty: Number(r.requested_qty ?? r.miqdor ?? 0), unit: r.unit ?? r.birlik ?? null,
    requiredDate: r.required_date ?? r.sana_kerak ?? null, priority: r.priority ?? r.prioritet ?? null, note: r.note ?? r.izoh ?? null,
    status: statusOf(r.status ?? r.holat), deliveredQty: Number(r.delivered_qty ?? r.etkazilgan ?? 0), remainingQty: r.remaining_qty == null ? null : Number(r.remaining_qty),
    version: Number(r.version ?? r.versiya ?? 0), requestedBy: r.requested_by == null ? null : Number(r.requested_by), approvedBy: r.approved_by == null ? null : Number(r.approved_by),
    createdAt: r.created_at ?? r.yaratilgan_vaqt ?? null, updatedAt: r.updated_at ?? null };
}
export async function sbZayavkalarOl(kompaniyaId: number, obyektId?: number): Promise<SbJavob<ProcurementRequest>> {
  const filtrlar = [`kompaniya_id=eq.${kompaniyaId}`]; if (obyektId != null) filtrlar.push(`obyekt_id=eq.${obyektId}`);
  const r = await sbOqi<DbRow>({ jadval: 't2_zayavka_royxat', filtr: filtrlar.join('&'), tartib: 'created_at.desc', limit: 1000 });
  return { ...r, qatorlar: (r.qatorlar || []).map(mapRow) };
}
export function sbZayavkaYoz(kompaniyaId: number, p: { obyektId: number; itemText: string; requestedQty: number; unit?: string; requiredDate?: string; priority?: string; note?: string; materialId?: number | null }): Promise<ZayavkaNatija> {
  return trackEntityCommand('zayavka', kompaniyaId, yozAmali({ amal: 'erp_amal', kompaniya_id: kompaniyaId, operatsiya: 'zayavka_yarat', payload: { obyekt_id: p.obyektId, material_id: p.materialId ?? null, item_text: p.itemText, requested_qty: p.requestedQty, unit: p.unit ?? null, required_date: p.requiredDate ?? null, priority: p.priority ?? null, note: p.note ?? null, operation_id: yangiOperationId() } }) as Promise<ZayavkaNatija>);
}
export function sbZayavkaHolatYoz(kompaniyaId: number, request: ProcurementRequest, status: ProcurementStatus, deliveredQty?: number): Promise<ZayavkaNatija> {
  return yozAmali({ amal: 'erp_amal', kompaniya_id: kompaniyaId, operatsiya: 'zayavka_holat', payload: { id: request.id, status, delivered_qty: deliveredQty, expected_version: request.version, kutilgan_versiya: request.version, operation_id: yangiOperationId() } }) as Promise<ZayavkaNatija>;
}
