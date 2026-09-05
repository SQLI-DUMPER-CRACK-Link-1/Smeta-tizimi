/**
 * resurs-vedomost.ts — T2-PTO-CLOSURE-007 (Claude lane).
 * ═══════════════════════════════════════════════════════════════════
 *
 * Egasining so'rovi: butun smeta va F2'dan har bir KATEGORIYA
 * (ЧЕЛ/МАШ/МАТ/ОБ/КАБ/М-К) resurslarining yig'ma vedomosti — hozirgi
 * Forma-2/Nakopitelniy hujjatlarida bunday kesim yo'q edi.
 *
 * Manba — `t2_qator_holat` (allaqachon to'g'ri, bu sessiyada tuzatilgan:
 * F2 ustunlari `certified_quantity`/`certified_amount`ni ustun qo'yadi).
 * Bu yerda YANGI HISOB-KITOB YO'Q — faqat mavjud, allaqachon to'g'ri
 * qator-darajasidagi haqiqatni resurs+kategoriya bo'yicha JAMLAYDI.
 * Ikkinchi haqiqat manbai emas: har bir jamlangan raqam to'g'ridan-to'g'ri
 * `t2_qator_holat` qatorlaridan sum() qilingan.
 *
 * Faqat resurs BARGLARI jamlanadi (`tur` in rs/mat/ob) — `rz` (razdel)
 * va `bl` (ish) qatorlari o'tkazib yuboriladi, aks holda ish narxi
 * resurs narxi bilan ikki marta hisoblangan bo'lardi.
 */
import type { T2QatorHolat } from '../api/supabase';

export type ResursVedomostQator = {
  kat: string;
  kod: string | null;
  nom: string;
  birlik: string | null;
  smetaHajm: number;
  smetaSumma: number;
  f2Hajm: number;
  f2Summa: number;
  qoldiqHajm: number;
  qoldiqSumma: number;
  /** Nechta smeta qatorida shu resurs ishlatilgan (bir xil nom/birlik/kat kelib qo'shilgan). */
  qatorSoni: number;
};

const RESURS_TUR = new Set(['rs', 'mat', 'ob']);

function son(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * `t2_qator_holat` qatorlarini kategoriya+resurs bo'yicha jamlaydi.
 * Kalit — `kat|nom|birlik` (bitta resurs bir nechta BL ostida bir xil
 * nom/birlik bilan takrorlanishi mumkin — ular BITTA vedomost qatoriga
 * qo'shiladi).
 */
export function resursVedomostQur(qatorlar: readonly T2QatorHolat[]): ResursVedomostQator[] {
  const guruh = new Map<string, ResursVedomostQator>();
  for (const q of qatorlar) {
    if (!q.tur || !RESURS_TUR.has(q.tur)) continue;
    const kat = q.kat || 'BOSHQA';
    const nom = q.nom || '(nomsiz)';
    const birlik = q.birlik || '';
    const kalit = kat + '|' + nom + '|' + birlik;
    let r = guruh.get(kalit);
    if (!r) {
      r = { kat, kod: q.kod, nom, birlik: q.birlik, smetaHajm: 0, smetaSumma: 0, f2Hajm: 0, f2Summa: 0, qoldiqHajm: 0, qoldiqSumma: 0, qatorSoni: 0 };
      guruh.set(kalit, r);
    }
    r.smetaHajm += son(q.smeta_hajm);
    r.smetaSumma += son(q.smeta_summa);
    r.f2Hajm += son(q.f2_hajm);
    r.f2Summa += son(q.f2_summa);
    r.qoldiqHajm += son(q.qoldiq_hajm);
    r.qoldiqSumma += son(q.qoldiq_summa);
    r.qatorSoni += 1;
    if (!r.kod && q.kod) r.kod = q.kod;
  }
  return [...guruh.values()].sort((a, b) => a.kat.localeCompare(b.kat) || a.nom.localeCompare(b.nom));
}

export type ResursVedomostKategoriya = {
  kat: string;
  qatorlar: ResursVedomostQator[];
  jamiSmetaSumma: number;
  jamiF2Summa: number;
  jamiQoldiqSumma: number;
};

/** Kategoriya bo'yicha guruhlangan ko'rinish — sahifada bo'lim-bo'lim chizish uchun. */
export function resursVedomostKategoriyalarga(qatorlar: readonly T2QatorHolat[]): ResursVedomostKategoriya[] {
  const barchasi = resursVedomostQur(qatorlar);
  const guruh = new Map<string, ResursVedomostQator[]>();
  for (const r of barchasi) {
    const a = guruh.get(r.kat);
    if (a) a.push(r); else guruh.set(r.kat, [r]);
  }
  return [...guruh.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kat, list]) => ({
      kat, qatorlar: list,
      jamiSmetaSumma: list.reduce((s, r) => s + r.smetaSumma, 0),
      jamiF2Summa: list.reduce((s, r) => s + r.f2Summa, 0),
      jamiQoldiqSumma: list.reduce((s, r) => s + r.qoldiqSumma, 0),
    }));
}
