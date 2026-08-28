import { yozAmali } from './supabase';
import { sbSkladYarat, sbKadrYarat, sbTexnikaYarat } from './t2-resurs';
import { sbT2LoyihaYoz } from './t2-loyiha';
import { sbKontragentSaqla } from './t2-kontragent';
import { sbT2ShartnomaSaqla } from './t2-shartnoma';

/* ⚡ 2026-08-28 (foydalanuvchi ko'rsatmasi): "shartnoma, sklad qo'shish,
 * shartnomalar bilan bog'lash, skladlar yaratish, avtopark qo'shish —
 * qurilishdagi hamma narsani bog'lash shu mindmapda bo'lishi kerak...
 * bog'lanishlar chiziqlar bilan tortib birlashtirilishi kerak."
 *
 * Avval mindmap FAQAT KO'RSATARDI: tugunlar boshqa sahifaga havola
 * edi, "Sklad"/"Shartnoma" tugunlari esa umuman DEKORATIV edi (hech
 * qanday haqiqiy yozuvga bog'lanmagan, shunchaki navigatsiya tugmasi).
 * Yagona haqiqiy amal — obyektni loyihaga biriktirish edi.
 *
 * Endi mindmap TAHRIRLASH MAYDONI: tugun yaratiladi, chiziq tortib
 * bog'lanadi, chiziq uziladi — hammasi haqiqiy jadvallarga yoziladi.
 * ⚠️ Yangi "universal edges" jadvali ATAYLAB yaratilmadi — har
 * bog'lanish o'z tabiiy jadvaliga boradi (t2_sklad_bog, t2_shartnoma_bog
 * va h.k.), aks holda mavjud FK/tekshiruvlar chetlab o'tilardi va
 * ikkinchi haqiqat manbai paydo bo'lardi. */

export type TugunTur =
  | 'kompaniya' | 'loyiha' | 'obyekt' | 'shartnoma'
  | 'sklad' | 'texnika' | 'kadr' | 'kontragent';

export type BogTur =
  | 'loyiha_kompaniya'   // tuzilmaviy — uzib bo'lmaydi
  | 'obyekt_loyiha'      // manba=loyiha,     maqsad=obyekt
  | 'shartnoma_loyiha'   // manba=loyiha,     maqsad=shartnoma
  | 'shartnoma_obyekt'   // manba=shartnoma,  maqsad=obyekt
  | 'sklad_obyekt'       // manba=sklad,      maqsad=obyekt
  | 'texnika_obyekt'     // manba=texnika,    maqsad=obyekt
  | 'kadr_obyekt'        // manba=kadr,       maqsad=obyekt
  | 'qatnashchi';        // manba=kontragent, maqsad=loyiha

export type MindmapTugun = {
  /** "tur:id" ko'rinishida, masalan "obyekt:6" */
  id: string;
  tur: TugunTur;
  nom: string;
  meta: Record<string, any> | null;
};

export type MindmapBogich = {
  manba: string; maqsad: string; tur: BogTur; uzsa_boladi: boolean;
};

export type MindmapGraf = { tugunlar: MindmapTugun[]; bogichlar: MindmapBogich[] };

/** Butun kompaniya grafi — BITTA so'rovda (zero re-fetch). */
export async function sbMindmapGrafOl(kompaniyaId: number): Promise<
  { ok: true; graf: MindmapGraf } | { ok: false; error: string }
> {
  try {
    const res = await fetch('/api/sb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soro: 'mindmap_grafi', kompaniya_id: kompaniyaId }),
    });
    const j = await res.json();
    if (!j.ok) return { ok: false, error: j.error || 'Graf o\'qilmadi' };
    const graf = (j.natija || {}) as MindmapGraf;
    return { ok: true, graf: { tugunlar: graf.tugunlar || [], bogichlar: graf.bogichlar || [] } };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)) };
  }
}

/** Chiziq tortilganda — bog'lanish saqlanadi. */
export function sbMindmapBog(tur: BogTur, manbaId: number, maqsadId: number, rol?: string) {
  return yozAmali({ amal: 'mindmap_bog', tur, manba_id: manbaId, maqsad_id: maqsadId, rol });
}

/** Chiziq o'chirilganda — bog'lanish uziladi (yozuvlar YO'QOLMAYDI). */
export function sbMindmapBogOchir(tur: BogTur, manbaId: number, maqsadId: number) {
  return yozAmali({ amal: 'mindmap_bog_ochir', tur, manba_id: manbaId, maqsad_id: maqsadId });
}

/** Qaysi turdagi tugundan qaysi turga chiziq tortish MUMKIN. */
export const RUXSAT_BOGLANISH: { manba: TugunTur; maqsad: TugunTur; tur: BogTur; nom: string }[] = [
  { manba: 'loyiha',     maqsad: 'obyekt',    tur: 'obyekt_loyiha',    nom: 'Obyektni loyihaga biriktirish' },
  { manba: 'loyiha',     maqsad: 'shartnoma', tur: 'shartnoma_loyiha', nom: 'Shartnomani loyihaga biriktirish' },
  { manba: 'shartnoma',  maqsad: 'obyekt',    tur: 'shartnoma_obyekt', nom: 'Shartnomani obyektga biriktirish' },
  { manba: 'sklad',      maqsad: 'obyekt',    tur: 'sklad_obyekt',     nom: 'Skladni obyektga xizmat qildirish' },
  { manba: 'texnika',    maqsad: 'obyekt',    tur: 'texnika_obyekt',   nom: 'Texnikani obyektga biriktirish' },
  { manba: 'kadr',       maqsad: 'obyekt',    tur: 'kadr_obyekt',      nom: 'Xodimni obyektga biriktirish' },
  { manba: 'kontragent', maqsad: 'loyiha',    tur: 'qatnashchi',       nom: 'Kontragentni loyiha qatnashchisi qilish' },
];

export function bogTuriniTop(manba: TugunTur, maqsad: TugunTur) {
  return RUXSAT_BOGLANISH.find((r) => r.manba === manba && r.maqsad === maqsad) || null;
}

/** Mindmapdan yangi tugun yaratish — har tur o'z mavjud RPC'siga boradi. */
export async function sbMindmapTugunYarat(
  tur: TugunTur, kompaniyaId: number, maydonlar: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const nom = (maydonlar.nom || '').trim();
  if (!nom) return { ok: false, error: 'Nom bo\'sh bo\'lishi mumkin emas' };

  if (tur === 'loyiha') {
    return await sbT2LoyihaYoz(kompaniyaId, { nom, hudud: maydonlar.hudud || null });
  }
  if (tur === 'sklad') {
    return await sbSkladYarat({ kompaniyaId, nomi: nom, manzil: maydonlar.manzil, masulShaxs: maydonlar.masul });
  }
  if (tur === 'texnika') {
    return await sbTexnikaYarat({ kompaniyaId, nomi: nom, davlatRaqami: maydonlar.davlat_raqami });
  }
  if (tur === 'kadr') {
    if (!(maydonlar.lavozim || '').trim()) return { ok: false, error: 'Lavozim majburiy' };
    return await sbKadrYarat({ kompaniyaId, ismSharif: nom, lavozim: maydonlar.lavozim });
  }
  if (tur === 'kontragent') {
    return await sbKontragentSaqla({ kompaniyaId, nom, inn: maydonlar.inn || undefined });
  }
  if (tur === 'shartnoma') {
    return await sbT2ShartnomaSaqla({
      raqam: nom, nom: maydonlar.izoh || nom, taraf: maydonlar.taraf || '',
    });
  }
  /* Obyekt ATAYLAB bu yerda yaratilmaydi: unga Drive papka tuzilmasi
     ham kerak (`apiT2ObyektPapkaYarat`) — mindmapdan yarim yaratilgan
     obyekt keyin smeta yuklashda sinardi. Obyektlar sahifasidan. */
  return { ok: false, error: tur + ' turini mindmapdan yaratib bo\'lmaydi' };
}
