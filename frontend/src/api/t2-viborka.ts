/**
 * t2-viborka.ts — VIBORKA (material tanlash/xarid nazorati), 2026-08-25
 * ═══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «viborka boshqatdan qurilishi kerak». Eski holat:
 * BUTUN tizim uchun BITTA umumiy Google Sheets hujjati, obyektga
 * bog'lanmagan ([[material-mustaqil-tizimlar]]). Endi HAR OBYEKT
 * o'zining viborka qatorlariga ega, reja SMETADAN avtomat.
 *
 * ⚠️ Alohida faylda — `supabase.ts` umumiy fayl, har yangi domen uni
 * kengaytirsa to'qnashuv muqarrar (`tizim02/navbat.json` → umumiy_fayllar).
 *
 * ⚠️ Hisob-kitob YO'Q: `holat`/`foiz`/`xavf` bazada (`t2_viborka_holat`)
 * hisoblanadi. Frontend takrorlasa ikki xil haqiqat paydo bo'lardi.
 */
import { sbOqi } from './supabase';

/* ── O'qish: reja/qabul/qoldiq holati ────────────────────────────── */
export type ViborkaHolat = {
  id: number; obyekt_id: number; obyekt: string; kompaniya_id: number;
  nom: string; birlik: string | null;
  reja_hajm: number | null; qabul_hajm: number;
  qoldiq_hajm: number | null; foiz: number | null;
  narx: number | null; summa: number | null;
  yetkazib_beruvchi: string | null; zamena: boolean; izoh: string | null;
  versiya: number; yangilandi: string;
  /** reja_yoq | kutilmoqda | qisman | toliq */
  holat: 'reja_yoq' | 'kutilmoqda' | 'qisman' | 'toliq';
  /** Qabul reja'dan >0.1% oshib ketgan — tekshirish kerak */
  xavf: boolean;
};

export function sbT2ViborkaOl(obyektId: number, faqatXavfli = false) {
  const f = ['obyekt_id=eq.' + obyektId];
  if (faqatXavfli) f.push('xavf=is.true');
  return sbOqi<ViborkaHolat>({
    jadval: 't2_viborka_holat', filtr: f.join('&'),
    tartib: 'nom.asc', limit: 20000,
  });
}

/* ── Qabul jurnali (audit tarixi) ─────────────────────────────────── */
export type ViborkaQabul = {
  id: number; viborka_id: number; hajm: number; narx: number | null;
  yetkazib_beruvchi: string | null; sana: string; izoh: string | null;
  manba: string | null; kim: string | null; yaratildi: string;
};

export function sbT2ViborkaQabulTarixOl(viborkaId: number) {
  return sbOqi<ViborkaQabul>({
    jadval: 't2_viborka_qabul', filtr: 'viborka_id=eq.' + viborkaId,
    tartib: 'yaratildi.desc', limit: 500,
  });
}

/* ══════════════════════════════════════════════════════════════════
 * YOZISH — nomli amallar orqali (`/api/sb-yoz`)
 * ══════════════════════════════════════════════════════════════════ */

export type ViborkaNatija = {
  ok: boolean; error?: string; xabar?: string; sabab?: string; izoh?: string;
  takror?: boolean; qabul_id?: number;
  jami_qabul?: number; reja?: number | null; holat?: string; xavf?: boolean;
  yangi_qator?: number; yangilangan_qator?: number;
  bordagi_versiya?: number; siz_yuborgan?: number;
  ms?: number;
};

async function yoz(yuk: Record<string, unknown>): Promise<ViborkaNatija> {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/sb-yoz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(yuk),
    });
    const j = (await r.json()) as ViborkaNatija;
    return { ...j, ms: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)),
             ms: Math.round(performance.now() - t0) };
  }
}

/**
 * Viborka reja ustunini smetadan (mat/ob) to'ldiradi/yangilaydi.
 * Idempotent — qayta chaqirilsa reja yangilanadi, `qabul_hajm`ga
 * TEGILMAYDI (odamning qabul tarixi yo'qolmasin).
 */
export function sbT2ViborkaSmetadanToldir(obyektId: number): Promise<ViborkaNatija> {
  return yoz({ amal: 'viborka_smetadan_toldir', obyekt_id: obyektId });
}

/**
 * Material qabulini qayd qiladi.
 *
 * ⚠️ `operationId` HAR CHAQIRUVDA yangi, lekin qayta urinishda O'ZGARMASIN.
 * ⚠️ `narx` berilmasa eskisi saqlanadi — bo'sh yuborish narxni O'CHIRMAYDI.
 * ⚠️ Manfiy `hajm` — tuzatish/qaytarish uchun ruxsat etilgan.
 */
export function sbT2ViborkaQabulYoz(p: {
  viborkaId: number; hajm: number; narx?: number;
  yetkazibBeruvchi?: string; sana?: string; izoh?: string;
  kutilganVersiya?: number; operationId: string;
}): Promise<ViborkaNatija> {
  return yoz({
    amal: 'viborka_qabul_yoz', viborka_id: p.viborkaId, hajm: p.hajm,
    narx: p.narx, yetkazib_beruvchi: p.yetkazibBeruvchi, sana: p.sana,
    izoh: p.izoh, kutilgan_versiya: p.kutilganVersiya,
    operation_id: p.operationId,
  });
}
