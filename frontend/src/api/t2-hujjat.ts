import { yozAmali, sbOqi } from './supabase';

/* ⚠️ 2026-08-27 (Claude): «Arxiv (R2)» sahifasi avval obyektga UMUMAN
 * bog'lanmagan edi — bitta fayl yuklab, xom URL ko'rsatardi, ro'yxat
 * ham, saqlash ham yo'q edi. Endi har fayl aniq obyektga (`obyekt_id`)
 * va turga (loyiha chizmasi | boshqa hujjat) bog'lanib, t2_obyekt_hujjat
 * jadvaliga yoziladi. */
export type ObyektHujjat = {
  id: number; kompaniya_id: number; obyekt_id: number;
  turi: 'loyiha' | 'hujjat'; nom: string; url: string;
  izoh: string | null; versiya: number; kim: string | null;
  yaratildi: string;
};

export function sbHujjatlarOl(obyektId: number) {
  return sbOqi<ObyektHujjat>({
    jadval: 't2_obyekt_hujjat_royxat',
    filtr: 'obyekt_id=eq.' + obyektId,
    tartib: 'yaratildi.desc',
    limit: 500,
  });
}

export function sbHujjatYoz(p: {
  obyektId: number; turi: 'loyiha' | 'hujjat'; nom: string; url: string; izoh?: string;
}) {
  return yozAmali({
    amal: 'hujjat_yoz',
    obyekt_id: p.obyektId, turi: p.turi, nom: p.nom, url: p.url, izoh: p.izoh,
  });
}

export function sbHujjatOchir(id: number) {
  return yozAmali({ amal: 'hujjat_ochir', id });
}

/* ⚡ 2026-08-27 (Claude, foydalanuvchi ko'rsatmasi — "DUAL-STORAGE"):
 * fayl endi R2 ichida `Kompaniya_ID/Obyekt_ID/Hujjat_turi/asl_nom.ext`
 * manzilida saqlanadi (tartibli, obyektga bog'liq — avval tasodifiy
 * nom bilan tartibsiz tushardi). */
export async function uploadFayl(
  file: File,
  ctx?: { kompaniyaId: number; obyektId: number; turi: 'loyiha' | 'hujjat' }
) {
  const formData = new FormData();
  formData.append('fayl', file);
  if (ctx) {
    formData.append('kompaniya_id', String(ctx.kompaniyaId));
    formData.append('obyekt_id', String(ctx.obyektId));
    formData.append('turi', ctx.turi);
  }
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  return await res.json();
}

/** Fayl base64 sifatida o'qiladi — Drive'ga nusxa yuborish uchun. */
function faylBase64Oqi(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const natija = String(reader.result || '');
      resolve(natija.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * DUAL-STORAGE — R2 ga yozilgan fayldan Drive'ga QO'SHIMCHA nusxa.
 * BEST-EFFORT: xato bo'lsa ham asosiy hujjat (R2 + t2_obyekt_hujjat)
 * allaqachon saqlangan bo'ladi, chaqiruvchi bu xatoni bloklamasligi
 * kerak — faqat foydalanuvchiga ogohlantirish ko'rsatiladi.
 * `obyektNomi` — Tizim_01/Drive papka nomi bilan bir xil bo'lishi shart
 * (Tizim_02 dagi obyekt nomi ikkalasida ham bir xil saqlanadi).
 */
export async function driveNusxaYubor(file: File, obyektNomi: string, turi: 'loyiha' | 'hujjat') {
  try {
    const base64 = await faylBase64Oqi(file);
    const res = await fetch('/api/gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn: 'apiObyektHujjatDriveSaqla',
        args: [obyektNomi, turi, file.name, file.type, base64],
      }),
    });
    const j = await res.json();
    if (!j.ok) return { ok: false, error: j.error || 'Noma\'lum xato (GAS ko\'prik)' };
    if (!j.data || j.data.ok === false) return { ok: false, error: (j.data && j.data.error) || 'Drive yozilmadi' };
    return { ok: true, url: j.data.url };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)) };
  }
}
