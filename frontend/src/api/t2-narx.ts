/**
 * t2-narx.ts — NARXLAR MARKAZI (Tizim_02)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tizim_01 dagi NARXLAR varag'ining o'rnini bosadi:
 *   `apiNarxlarOl` · `apiNarxlarSaqla` · `apiNarxSanaQosh` ·
 *   `apiNarxBelgilanganSaqla` · `apiTopilmaganlar`
 *
 * ⚠️ NEGA ALOHIDA FAYL, `supabase.ts` GA QO'SHILMADI:
 * `supabase.ts` — ikki agent ham yozadigan umumiy fayl
 * (`tizim02/navbat.json` → `umumiy_fayllar`). Har yangi domen uni
 * kengaytirsa, to'qnashuv muqarrar. Domen o'z faylida yashaydi.
 *
 * ⚠️ BU YERDA HISOB-KITOB YO'Q. `natija = MAX(belgilangan, smeta, sana)`
 * qoidasi `t2_narx_markaz` ko'rinishida, bazada. Frontend takrorlasa
 * ikkita haqiqat paydo bo'lardi — F2 moslashtirishda aynan shu xato
 * 1000 baravarlik zararga olib kelgan.
 */
import { sbOqi, type SbJavob } from './supabase';

/* ── Narxlar markazi qatori (`t2_narx_markaz` ko'rinishi) ────────── */
export type NarxMarkaz = {
  kompaniya_id: number;
  nom_key: string; birlik_key: string;
  nom: string | null; birlik: string | null; kat: string | null;

  /** Nechta obyektda narxlangan */
  obyekt_soni: number;
  /** {obyekt nomi: narx} */
  obyektlar: Record<string, number> | null;
  smeta_max: number | null;
  smeta_min: number | null;

  /** Odam ATAYLAB qo'ygan narx */
  belgilangan_narx: number | null;
  belgilangan_mi: boolean;

  sana_max_narx: number | null;
  oxirgi_sana_narx: number | null;
  oxirgi_sana: string | null;

  /** Smetada nechta qator shu resursni ishlatadi */
  qator_soni: number;

  /**
   * MAX(belgilangan, smeta_max, sana_max).
   * ⚠️ `null` bo'lishi MUMKIN va bu TO'G'RI — hech qayerda narx
   * yo'q degani. 0 EMAS: 0 «bepul» degani bo'lardi.
   */
  natija: number | null;
  /** Qaysi manba g'olib chiqdi: belgilangan | sana | smeta */
  manba: 'belgilangan' | 'sana' | 'smeta' | null;

  /**
   * ⚠️ Bir resurs turli obyektlarda >5% farq bilan narxlangan.
   * O'lchov (2026-08-25): 1615 resursdan 70 tasi xavfli, 28 tasi
   * 2 baravardan ko'p farq qiladi, eng kattasi 102.7 barobar.
   */
  xavf: boolean;
  farq_koef: number | null;
};

export function sbT2NarxMarkazOl(p?: {
  faqatXavfli?: boolean; kat?: string; qidiruv?: string; limit?: number;
}): Promise<SbJavob<NarxMarkaz>> {
  const f: string[] = [];
  if (p?.faqatXavfli) f.push('xavf=is.true');
  if (p?.kat) f.push('kat=eq.' + encodeURIComponent(p.kat));
  if (p?.qidiruv) f.push('nom=ilike.*' + encodeURIComponent(p.qidiruv) + '*');
  return sbOqi<NarxMarkaz>({
    jadval: 't2_narx_markaz',
    filtr: f.join('&') || undefined,
    tartib: 'nom.asc',
    limit: p?.limit ?? 20000,
  });
}

/* ── Narxi topilmaganlar (`t2_topilmaganlar`) ────────────────────── */
export type Topilmagan = {
  obyekt_id: number; obyekt: string;
  nom_key: string; birlik_key: string;
  nom: string | null; birlik: string | null; kat: string | null;
  qator_soni: number; jami_hajm: number | null;
  /** Shu resurs BOSHQA obyektda narxlanganmi */
  boshqa_obyektda_narx: number | null;
  boshqa_obyekt_soni: number | null;
  obyektlar: Record<string, number> | null;
  /**
   * ⚠️ FAQAT KO'RSATISH UCHUN. Bu raqam hech qayerga yozilmaydi va
   * jamiga qo'shilmaydi — narx o'zidan to'qilmaydi. Odam ko'rib,
   * o'zi qaror qiladi.
   */
  taxminiy_summa: number | null;
};

export function sbT2TopilmaganlarOl(obyektId: number) {
  return sbOqi<Topilmagan>({
    jadval: 't2_topilmaganlar',
    filtr: 'obyekt_id=eq.' + obyektId,
    tartib: 'qator_soni.desc',
    limit: 20000,
  });
}

/* ── Himoyasiz qo'lda tahrirlar (`t2_narx_qol_xavf`) ─────────────── */
/**
 * Jurnalda qo'lda narx tahriri bor, lekin qator `QOL` deb
 * belgilanmagan — keyingi narxlashda u JIMGINA o'chadi.
 *
 * ⚠️ Bu ro'yxat BO'SH bo'lishi kerak. Bo'sh emas bo'lsa — odamning
 * ishi yo'qolish arafasida.
 */
export type QolXavf = {
  qator_id: number; obyekt_id: number; obyekt: string;
  nom: string | null; birlik: string | null;
  hozirgi_narx: number | null; narx_usul: string | null;
  qolda_yozilgan: string | null;
  tahrir_vaqti: string; kim: string | null; manba: string | null;
  narx_yoqolgan: boolean;
};

export function sbT2QolXavfOl() {
  return sbOqi<QolXavf>({ jadval: 't2_narx_qol_xavf', limit: 5000 });
}

/* ══════════════════════════════════════════════════════════════════
 * YOZISH — nomli amallar orqali (`/api/sb-yoz`)
 * ══════════════════════════════════════════════════════════════════ */

export type NarxNatija = {
  ok: boolean;
  xabar?: string; error?: string; sabab?: string; izoh?: string;
  narx_id?: number; versiya?: number;
  eski_narx?: number | null; yangi_narx?: number;
  markaz?: NarxMarkaz | null;
  /* sana_qosh */
  kirgan?: number; yozildi?: number; tashlandi?: number;
  kafolat?: boolean; tashlangan_qatorlar?: unknown[];
  /* ziddiyat */
  bordagi_versiya?: number; siz_yuborgan?: number; bordagi_narx?: number;
  ms?: number;
};

async function yoz(yuk: Record<string, unknown>): Promise<NarxNatija> {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/sb-yoz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(yuk),
    });
    const j = (await r.json()) as NarxNatija;
    return { ...j, ms: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)),
             ms: Math.round(performance.now() - t0) };
  }
}

/**
 * Resursga narx BELGILAYDI (Tizim_01 dagi БЕЛГИЛАНГАН ustuni).
 *
 * ⚠️ Belgilash o'zi smetani QAYTA NARXLAMAYDI. Narx qatorlarga faqat
 * `t2_narxla(obyekt_id)` chaqirilganda tushadi — bu ATAYLAB: qaysi
 * obyekt qachon qayta narxlanishini odam hal qiladi, milliardlik jami
 * jimgina o'zgarib ketmasin.
 *
 * ⚠️ `kutilganVersiya` bering — aks holda ikki odam bir narxni bir
 * vaqtda o'zgartirsa, oxirgisi jimgina yutadi.
 */
export function sbT2NarxBelgila(p: {
  nom: string; birlik?: string; narx: number;
  kat?: string; izoh?: string; kutilganVersiya?: number;
}): Promise<NarxNatija> {
  return yoz({
    amal: 'narx_belgila', nom: p.nom, birlik: p.birlik, narx: p.narx,
    kat: p.kat, izoh: p.izoh, kutilgan_versiya: p.kutilganVersiya,
  });
}

/**
 * Sana (bozor) narxlarini qo'shadi.
 *
 * ⚠️ Narxi yo'q yoki nomi bo'sh qator JIM TASHLANMAYDI — javobda
 * `tashlangan_qatorlar` bo'lib qaytadi va `kafolat` tekshiriladi:
 * `kirgan = yozildi + tashlandi`.
 */
export function sbT2NarxSanaQosh(p: {
  sana: string;
  qatorlar: Array<{ nom: string; birlik?: string; narx: number; izoh?: string }>;
  manba?: string;
}): Promise<NarxNatija> {
  return yoz({
    amal: 'narx_sana_qosh', sana: p.sana,
    qatorlar: p.qatorlar, manba: p.manba,
  });
}
