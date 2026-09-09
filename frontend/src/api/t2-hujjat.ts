import { yozAmali, sbOqi, yangiOperationId } from './supabase';

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

/**
 * T2-PTO-P0A-UNAUTH-ENDPOINTS-001 — avval bu funksiya `/api/upload` ga
 * yozardi. O'sha endpoint:
 *   - sessiyani UMUMAN tekshirmasdi (anonim yuklash mumkin edi);
 *   - `kompaniya_id`/`obyekt_id` ni KLIENTdan olib, R2 kalitiga
 *     tozalamasdan qo'yardi (boshqa kompaniya papkasiga chiqish mumkin edi);
 *   - o'lcham/MIME chegarasi, overwrite himoyasi, hash va auditsiz edi;
 *   - ustiga `R2_ARCHIVE` bindingiga murojaat qilardi, u esa
 *     `wrangler.toml` da yo'q — ya'ni amalda allaqachon BUZUQ edi.
 * Endpoint o'chirildi; endi kanonik `/api/hujjat-yukla` ishlatiladi:
 * server actorni sessiyadan oladi, a'zolikni tekshiradi, R2 kalitini
 * O'ZI yasaydi, sha256 ni tasdiqlaydi, ikki fazali reserve→put→finalize.
 *
 * Kanonik bucket PRIVATE — public URL yo'q; shuning uchun `url` sifatida
 * ruxsat tekshiradigan yuklab olish yo'li qaytariladi.
 */
export async function uploadFayl(
  file: File,
  ctx: { kompaniyaId: number; obyektId: number; turi: 'loyiha' | 'hujjat' }
): Promise<{ ok: boolean; url?: string; document_id?: number; error?: string }> {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  formData.append('fayl', file);
  formData.append('kompaniya_id', String(ctx.kompaniyaId));
  formData.append('obyekt_id', String(ctx.obyektId));
  formData.append('turi', ctx.turi);
  formData.append('operation_id', yangiOperationId());
  formData.append('sha256', sha256);
  formData.append('size', String(file.size));

  const res = await fetch('/api/hujjat-yukla', { method: 'POST', body: formData });
  const j = await res.json().catch(() => null);
  if (!j || j.ok !== true) return { ok: false, error: (j && (j.xato || j.code)) || 'Fayl yuklanmadi' };
  return { ok: true, document_id: j.document_id, url: '/api/hujjat-ol?id=' + j.document_id };
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
