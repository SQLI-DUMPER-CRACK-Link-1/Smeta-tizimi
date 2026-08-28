import { yozAmali, sbOqi } from './supabase';

/* ⚡ 2026-08-28 (MASTER_REJA_ENTERPRISE_OS.md "0-A" tahlili, "qabul
 * qilingan" band): AI konteksti (`t2_ai_kontekst`) endi Postgres'da
 * hisoblanadi, lekin u material nomlarini FAQAT aynan yozilgan
 * ko'rinishda topadi — "M200" va "Бетон марки 200" ikki xil narsa deb
 * ko'rinadi. Bu jadval ularni BITTA kanonik `nom_key`ga bog'laydi —
 * xuddi narxlash markazi (`t2_narx_markaz`) allaqachon ishlatadigan
 * normalizatsiya kaliti (parallel tizim EMAS, o'sha kalitning o'zi).
 * `kompaniyaId: null` — global/umumiy alias (masalan "M200" — bu
 * muhandislik standarti, hech kimning tijorat siri emas). */
export type MaterialAlias = {
  id: number; kompaniya_id: number | null; alias_nom: string;
  kanonik_nom_key: string; kanonik_birlik_key: string | null;
  versiya: number; yaratildi: string;
};

export function sbMaterialAliaslarOl(kompaniyaId?: number | null) {
  return sbOqi<MaterialAlias>({
    jadval: 't2_material_alias_royxat',
    filtr: kompaniyaId ? 'kompaniya_id=eq.' + kompaniyaId : undefined,
    tartib: 'alias_nom.asc',
    limit: 2000,
  });
}

export function sbMaterialAliasYoz(p: {
  aliasNom: string; kanonikNomKey: string; kanonikBirlikKey?: string; kompaniyaId?: number;
}) {
  return yozAmali({
    amal: 'material_alias_yoz', alias_nom: p.aliasNom, kanonik_nom_key: p.kanonikNomKey,
    kanonik_birlik_key: p.kanonikBirlikKey, kompaniya_id: p.kompaniyaId,
  });
}

export function sbMaterialAliasOchir(id: number) {
  return yozAmali({ amal: 'material_alias_ochir', id });
}
