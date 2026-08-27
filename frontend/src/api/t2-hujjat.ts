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

export async function uploadFayl(file: File) {
  const formData = new FormData();
  formData.append('fayl', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  return await res.json();
}
