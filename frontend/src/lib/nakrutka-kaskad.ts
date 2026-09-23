/**
 * NAKRUTKA kaskadi — `supabase/migrations/20261014090000_t2_nakrutka_v1.sql`
 * dagi `t2_nakrutka_hisobla_v1` ning AYNAN o'zi (T1 GAS 80_Shartnoma.js
 * `nakrutkaHisob`). Bu ikkinchi matematik haqiqat EMAS: formula, tartib va
 * koeffitsient kodlari SQL bilan bir xil; `nakrutka-kaskad.test.ts` SQL
 * natijalaridan olingan oltin qiymatlar bilan paritetni tekshiradi.
 *
 * Nega frontendda ham kerak: Tender Oferta pudratchi narxlari hali bazaga
 * yozilmagan sessiya ma'lumoti — ularni kaskaddan o'tkazish uchun har bir
 * klavish bosilishida serverga borish shart emas. Excel eksporti ham shu
 * tartibdagi formulalarni yozadi, shuning uchun UI == Excel.
 */
import type { NakrutkaKoeffitsientlar } from '../api/t2-nakrutka';

/** T1 `_NAKR_DEFAULT` = SQL `t2_nakrutka_default_v1()`. */
export const NAKRUTKA_STANDART: NakrutkaKoeffitsientlar = {
  ЗТР_СОЦСТРАХ: 12, ТРАНСПОРТ_МАТЕРИАЛ: 5, СКЛАДСКИЕ_МАТЕРИАЛ: 2,
  СКЛАДСКИЕ_МК: 0.75, ТРАНСПОРТ_КАБЕЛЬ: 1.5, ПРОЧИЕ_ПОДРЯДЧИК: 18,
  ТРАНСПОРТ_ОБОРУД: 2, ЗАГОТ_СКЛАД_ОБОРУД: 1.2, СТРАХОВАНИЕ: 0.32,
  РИСК: 0, НДС: 12,
};

/** Kaskad kirishi. `mat` — TO'LIQ material savati (МАТ + М/К + КАБ +
 * БЕЗСКЛАД); `mk`, `kab`, `bez` uning ichidagi qismlar (SQL izohiga qarang). */
export type NakrutkaAsos = { chel: number; mash: number; mat: number; ob: number; mk: number; kab: number; bez: number };

export type NakrutkaQadamlar = {
  pryamye: number; tr_mat: number; skl_mat: number; tr_kab: number;
  itogo1: number; prochie: number; itogo2: number;
  tr_ob: number; zag_ob: number; itogo3: number;
  strax: number; risk: number; itogo4: number; nds: number; vsego: number;
};

export type NakrutkaQoshimcha = {
  /** Material transporti foiz o'rniga alohida transport hisob varag'idan
   * olinsa (Oferta `transportSiyosati = 'varaq'`). Berilmasa SQL bilan 1:1. */
  trMatOverride?: number | null;
};

const k = (nk: Partial<NakrutkaKoeffitsientlar>, kod: keyof NakrutkaKoeffitsientlar): number => {
  const v = Number(nk[kod] ?? 0);
  return Number.isFinite(v) ? v : 0;
};

/** Yaxlitlanmagan qadamlar — SQL ichidagi o'zgaruvchilar bilan bir xil. */
export function nakrutkaKaskadXom(a: NakrutkaAsos, nk: Partial<NakrutkaKoeffitsientlar>, q: NakrutkaQoshimcha = {}): NakrutkaQadamlar {
  const pryamye = a.chel + a.mash + a.mat + a.ob;
  const tr_mat = q.trMatOverride != null ? q.trMatOverride : (a.mat - a.kab) * k(nk, 'ТРАНСПОРТ_МАТЕРИАЛ') / 100;
  const skl_mat = (a.mat - a.bez - a.mk) * k(nk, 'СКЛАДСКИЕ_МАТЕРИАЛ') / 100 + a.mk * k(nk, 'СКЛАДСКИЕ_МК') / 100;
  const tr_kab = a.kab * k(nk, 'ТРАНСПОРТ_КАБЕЛЬ') / 100;
  const itogo1 = pryamye - a.ob + tr_mat + skl_mat + tr_kab;
  const prochie = itogo1 * k(nk, 'ПРОЧИЕ_ПОДРЯДЧИК') / 100;
  const itogo2 = itogo1 + prochie;
  const tr_ob = a.ob * k(nk, 'ТРАНСПОРТ_ОБОРУД') / 100;
  const zag_ob = a.ob * k(nk, 'ЗАГОТ_СКЛАД_ОБОРУД') / 100;
  const itogo3 = itogo2 + a.ob + tr_ob + zag_ob;
  const strax = itogo3 * k(nk, 'СТРАХОВАНИЕ') / 100;
  const risk = itogo3 * k(nk, 'РИСК') / 100;
  const itogo4 = itogo3 + strax + risk;
  const nds = itogo4 * k(nk, 'НДС') / 100;
  const vsego = itogo4 + nds;
  return { pryamye, tr_mat, skl_mat, tr_kab, itogo1, prochie, itogo2, tr_ob, zag_ob, itogo3, strax, risk, itogo4, nds, vsego };
}

/** Excel `ROUND(x;2)` bilan bir xil yaxlitlash (yarmi noldan uzoqqa, 15
 * xonali o'nlik ko'rinish bo'yicha — 1.005 → 1.01, Excel kabi). */
export function pulYaxlitla(x: number): number {
  if (!Number.isFinite(x)) return x;
  const scaled = Number((Math.abs(x) * 100).toPrecision(15));
  const r = Math.round(scaled) / 100;
  return x < 0 ? -r : r;
}

/** SQL `t2_nakrutka_hisobla_v1` qaytaradigan ko'rinish: har qadam 2 xonagacha. */
export function nakrutkaKaskad(a: NakrutkaAsos, nk: Partial<NakrutkaKoeffitsientlar>, q: NakrutkaQoshimcha = {}): NakrutkaQadamlar {
  const raw = nakrutkaKaskadXom(a, nk, q);
  return Object.fromEntries(Object.entries(raw).map(([key, v]) => [key, pulYaxlitla(v)])) as NakrutkaQadamlar;
}
