import { sbOqi, yozAmali } from './supabase';

/* ⚡ 2026-08-28 (Claude): "Kalendar Grafik" (Gantt) sahifasi bir marta
 * `Supabase 404: Could not find the table 'public.t2_grafik_holat'`
 * xatosi bilan yiqilgan edi — na jadval, na RPC hech qachon
 * yaratilmagan bo'lib chiqdi (frontend allaqachon shu shaklni kutib
 * turgan ekan). Bu poydevor qurildi: `t2_grafik_qator` jadval,
 * `t2_grafik_holat` view, versiya bilan himoyalangan yozish RPC'lari.
 * ⚠️ Bu HALI TO'LIQ Gantt EMAS (WBS/bog'liqliklar/CPM — MASTER_REJA
 * FAZA 9, band 82-83) — faqat "ish nomi + muddat + foiz" darajasi. */
export type GrafikHolat = 'reja' | 'jarayonda' | 'bajarildi';

export type GrafikQator = {
  id: number; kompaniya_id: number; obyekt_id: number; nom: string;
  holat: GrafikHolat; boshlanish_sana: string | null; tugash_sana: string | null;
  kun: number | null; foiz: number; versiya: number;
};

export function sbGrafikHolatOl(kompaniya_id: number, obyekt_id: number) {
  return sbOqi<GrafikQator>({
    jadval: 't2_grafik_holat',
    filtr: 'kompaniya_id=eq.' + kompaniya_id + '&obyekt_id=eq.' + obyekt_id,
    limit: 500,
  });
}

/** Yangi ish qatori yaratadi (`id` berilmasa) yoki tahrirlaydi (`id` + `kutilganVersiya` bilan). */
export function sbGrafikSaqla(p: {
  kompaniyaId: number; obyektId: number; nom: string;
  boshlanishSana?: string; tugashSana?: string;
  id?: number; kutilganVersiya?: number;
}) {
  return yozAmali({
    amal: 'grafik_sozlama_saqla',
    kompaniya_id: p.kompaniyaId, obyekt_id: p.obyektId, nom: p.nom,
    boshlanish_sana: p.boshlanishSana, tugash_sana: p.tugashSana,
    id: p.id, kutilgan_versiya: p.kutilganVersiya,
  });
}

/** Ish jarayonini yangilaydi (holat/foiz) — optimistik qulf bilan. */
export function sbGrafikYangila(id: number, kutilganVersiya: number, p: { holat?: GrafikHolat; foiz?: number }) {
  return yozAmali({
    amal: 'grafik_yangilash', id, kutilgan_versiya: kutilganVersiya,
    holat: p.holat, foiz: p.foiz,
  });
}
