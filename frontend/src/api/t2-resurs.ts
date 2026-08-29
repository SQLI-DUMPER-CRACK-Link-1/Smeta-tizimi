import { yozAmali, sbOqi } from './supabase';
import { trackEntityCommand } from './entity-consistency';

/* ⚡ 2026-08-27 (Claude + Antigravity): "32 gektar ichida 40 obyekt, 1
 * umumiy sklad" arxitekturasi. Sklad/Kadr/Texnika endi bitta obyektga
 * qattiq bog'lanmaydi — mustaqil yaratiladi, so'ng M:N junction jadval
 * orqali bir yoki bir nechta obyektga "chiziq tortib" ulanadi. Har
 * ro'yxat elementi o'ziga bog'langan obyektlarni BITTA so'rovda
 * (jsonb_agg) oladi — obyekt-obyekt alohida so'rov YO'Q. */

export type ResursObyekt = { obyekt_id: number; obyekt_nom: string };

export type SkladMustaqil = {
  id: number; kompaniya_id: number; nomi: string; manzil: string | null;
  masul_shaxs: string | null; versiya: number; yaratilgan_vaqt: string;
  obyektlar: ResursObyekt[];
};
export type KadrMustaqil = {
  id: number; kompaniya_id: number; ism_sharif: string; lavozim: string;
  oylik_maosh: number | null; valyuta: string; versiya: number; yaratilgan_vaqt: string;
  obyektlar: ResursObyekt[];
};
export type TexnikaMustaqil = {
  id: number; kompaniya_id: number; nomi: string; davlat_raqami: string | null;
  yoqilgi_mejori: number | null; versiya: number; yaratilgan_vaqt: string;
  obyektlar: ResursObyekt[];
};

export function sbSkladlarOl(kompaniyaId: number) {
  return sbOqi<SkladMustaqil>({ jadval: 't2_sklad_royxat', filtr: 'kompaniya_id=eq.' + kompaniyaId, limit: 500 });
}
export function sbKadrlarOl(kompaniyaId: number) {
  return sbOqi<KadrMustaqil>({ jadval: 't2_kadr_royxat', filtr: 'kompaniya_id=eq.' + kompaniyaId, limit: 500 });
}
export function sbTexnikalarOl(kompaniyaId: number) {
  return sbOqi<TexnikaMustaqil>({ jadval: 't2_texnika_royxat', filtr: 'kompaniya_id=eq.' + kompaniyaId, limit: 500 });
}

export function sbSkladYarat(p: { kompaniyaId: number; nomi: string; manzil?: string; masulShaxs?: string }) {
  return trackEntityCommand('sklad', p.kompaniyaId, yozAmali({ amal: 'sklad_mustaqil_yarat', kompaniya_id: p.kompaniyaId, nomi: p.nomi, manzil: p.manzil, masul_shaxs: p.masulShaxs }));
}
export function sbKadrYarat(p: { kompaniyaId: number; ismSharif: string; lavozim: string; oylikMaosh?: number; valyuta?: string }) {
  return trackEntityCommand('kadr', p.kompaniyaId, yozAmali({ amal: 'kadr_mustaqil_yarat', kompaniya_id: p.kompaniyaId, ism_sharif: p.ismSharif, lavozim: p.lavozim, oylik_maosh: p.oylikMaosh, valyuta: p.valyuta }));
}
export function sbTexnikaYarat(p: { kompaniyaId: number; nomi: string; davlatRaqami?: string; yoqilgiMejori?: number }) {
  return trackEntityCommand('texnika', p.kompaniyaId, yozAmali({ amal: 'texnika_mustaqil_yarat', kompaniya_id: p.kompaniyaId, nomi: p.nomi, davlat_raqami: p.davlatRaqami, yoqilgi_mejori: p.yoqilgiMejori }));
}

export type ResursTur = 'sklad' | 'kadr' | 'texnika';

/** Node-based linking — mindmapda resurs tugunidan obyekt tuguniga chiziq tortish. */
export function sbResursBogSaqla(tur: ResursTur, resursId: number, obyektId: number) {
  return yozAmali({ amal: 'resurs_bog_saqla', tur, resurs_id: resursId, obyekt_id: obyektId });
}
export function sbResursBogOchir(tur: ResursTur, resursId: number, obyektId: number) {
  return yozAmali({ amal: 'resurs_bog_ochir', tur, resurs_id: resursId, obyekt_id: obyektId });
}
