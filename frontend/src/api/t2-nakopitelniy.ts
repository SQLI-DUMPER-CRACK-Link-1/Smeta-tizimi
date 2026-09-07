/**
 * t2-nakopitelniy.ts — typed client for the real PTO nakopitelniy vedomost.
 * Reads /api/hujjat-nazorat?amal=nakopitelniy -> t2_nakopitelniy_v1 (Supabase
 * canonical). No Drive/Sheets/GAS. This is the RAW row shape (not the
 * abstract ProgressLineResult in lib/construction-document-control, which
 * has no Fakt dimension) -- see t2_nakopitelniy_v1's own migration history
 * for why: t2_nakopitelniy_v1's fakt_hajm/f2_mumkin_hajm columns
 * (20261011100000_t2_nakopitelniy_fakt_v1.sql) are exactly what a PTO
 * specialist needs ("Faktdan F2ga olish mumkin qancha qoldi?") and the pure
 * engine never modeled Fakt at all.
 */

export type NakopitelniyQator = {
  qator_id: number; tartib: number; kod: string | null; nom: string | null; birlik: string | null;
  tur: 'rz' | 'bl' | 'rs' | 'mat' | 'ob'; kat: string | null; qoshimcha: boolean; zamena: boolean;
  smeta_hajm: number | null; smeta_narx: number | null; smeta_summa: number | null;
  fakt_hajm: number; fakt_summa: number;
  oldingi_hajm: number; oldingi_summa: number;
  joriy_hajm: number; joriy_summa: number; joriy_qoralama_summa: number;
  jami_hajm: number; jami_summa: number;
  f2_mumkin_hajm: number;
  qoldiq_hajm: number; qoldiq_summa: number;
  jami_baseline_summa: number; jami_actual_summa: number | null; narx_variance_summa: number;
  bajarilish_foiz: number | null;
};

export type NakopitelniyDavr = {
  oy: string; akt_id: number; raqam: string | null; holat: string; hujjat_jami: number | null;
  davr_muhr: string | null; revision_id: number | null; joriy: boolean; oldingi: boolean; certified: boolean;
};

export type NakopitelniyJami = {
  smeta_summa: number; fakt_summa: number; oldingi_summa: number; joriy_tasdiqlangan_summa: number;
  joriy_qoralama_summa: number; jami_tasdiqlangan_summa: number; qoldiq_summa: number;
  f2_mumkin_summa: number; baseline_summa: number; narx_variance_summa: number;
  pending_ozgarish_delta: number; bajarilish_foiz: number | null;
};

export type NakopitelniyJavob = {
  ok: true; generated_at: string;
  obyekt: { id: number; nom: string; kompaniya_id: number; loyiha_id: number | null };
  davr: string; joriy_revision_id: number | null;
  qatorlar: NakopitelniyQator[]; qatorlar_jami: number; qatorlar_korsatildi: number; truncated: boolean;
  jami: NakopitelniyJami;
  davrlar: NakopitelniyDavr[];
} | { ok: false; code: string; xato?: string };

export async function t2NakopitelniyOl(obyektId: number, davr?: string | null): Promise<NakopitelniyJavob> {
  const q = new URLSearchParams({ amal: 'nakopitelniy', obyekt_id: String(obyektId), faqat_faol: '0' });
  if (davr) q.set('davr', davr);
  const r = await fetch('/api/hujjat-nazorat?' + q.toString());
  const j = await r.json().catch(() => null);
  if (!j) return { ok: false, code: 'NETWORK_ERROR' };
  return j;
}
