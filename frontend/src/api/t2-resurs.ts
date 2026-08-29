import { yozAmali, sbOqi, yangiOperationId } from './supabase';
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

export type ResursTur = 'sklad' | 'kadr' | 'texnika';

type ResursMaydonlar = Record<string, string | number | null | undefined>;

/** Mindmap va module tablar uchun bitta canonical mutation adapter. */
function resursYarat(tur: ResursTur, kompaniyaId: number, maydonlar: ResursMaydonlar) {
  /* Production bazada V2 resource migration o'rnatilmagan holatda ham
     create canonical jadvalga yozilishi kerak. Update/delete V2 yo'lida
     qoladi va migration o'rnatilgach module shu contractga o'tadi. */
  const amal = tur === 'sklad' ? 'sklad_mustaqil_yarat'
    : tur === 'kadr' ? 'kadr_mustaqil_yarat' : 'texnika_mustaqil_yarat';
  return trackEntityCommand(tur, kompaniyaId, yozAmali({
    amal, kompaniya_id: kompaniyaId, ...maydonlar,
    operation_id: yangiOperationId(),
  }));
}
export function sbResursYangila(tur: ResursTur, kompaniyaId: number, id: number, expectedVersion: number, maydonlar: ResursMaydonlar) {
  return trackEntityCommand(tur, kompaniyaId, yozAmali({
    amal: 'resurs_yangila_v2', kompaniya_id: kompaniyaId, tur, id, maydonlar,
    expected_version: expectedVersion, operation_id: yangiOperationId(),
  }));
}
export function sbResursBekor(tur: ResursTur, kompaniyaId: number, id: number, expectedVersion: number) {
  return trackEntityCommand(tur, kompaniyaId, yozAmali({
    amal: 'resurs_bekor_v2', kompaniya_id: kompaniyaId, tur, id,
    expected_version: expectedVersion, operation_id: yangiOperationId(),
  }));
}
export function sbSkladYarat(p: { kompaniyaId: number; nomi: string; manzil?: string; masulShaxs?: string }) {
  return resursYarat('sklad', p.kompaniyaId, { nomi: p.nomi, manzil: p.manzil, masul_shaxs: p.masulShaxs });
}
export function sbKadrYarat(p: { kompaniyaId: number; ismSharif: string; lavozim: string; oylikMaosh?: number; valyuta?: string }) {
  return resursYarat('kadr', p.kompaniyaId, { ism_sharif: p.ismSharif, lavozim: p.lavozim, oylik_maosh: p.oylikMaosh, valyuta: p.valyuta });
}
export function sbTexnikaYarat(p: { kompaniyaId: number; nomi: string; davlatRaqami?: string; yoqilgiMejori?: number }) {
  return resursYarat('texnika', p.kompaniyaId, { nomi: p.nomi, davlat_raqami: p.davlatRaqami, yoqilgi_mejori: p.yoqilgiMejori });
}

/** Node-based linking — mindmapda resurs tugunidan obyekt tuguniga chiziq tortish. */
export function sbResursBogSaqla(tur: ResursTur, resursId: number, obyektId: number) {
  return yozAmali({ amal: 'resurs_bog_saqla', tur, resurs_id: resursId, obyekt_id: obyektId });
}
export function sbResursBogOchir(tur: ResursTur, resursId: number, obyektId: number) {
  return yozAmali({ amal: 'resurs_bog_ochir', tur, resurs_id: resursId, obyekt_id: obyektId });
}
