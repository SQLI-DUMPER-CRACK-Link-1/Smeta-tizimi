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
  smetaNarx: number | null;
  smetaSumma: number;
  faktHajm: number;
  faktSumma: number;
  f2Hajm: number;
  faktNarx: number | null;
  f2Narx: number | null;
  f2Summa: number;
  qoldiqHajm: number;
  qoldiqSumma: number;
  narxHolati: string;
  /** Nechta smeta qatorida shu resurs ishlatilgan (bir xil nom/birlik/kat kelib qo'shilgan). */
  qatorSoni: number;
};

const RESURS_TUR = new Set(['rs', 'mat', 'ob']);

/**
 * Owner (2026-09-08): "resurs vedemostda birinchi chel chas, keyin mash
 * chas keyin material keyin oborudovaniya shaklida taxlab berilishi
 * kerak" -- kategoriyalar ALIFBO tartibida emas, shu ANIQ ma'noli
 * tartibda ko'rsatilishi kerak (aynan nakrutka kaskadining o'zi ham shu
 * tartibda ishlaydi -- t2_nakrutka_hisobla_v1: ЧЕЛ+МАШ+МАТ+ОБ). Ro'yxatda
 * yo'q har qanday kategoriya (masalan КАБ/М/К/BOSHQA) oxirida, o'zaro
 * alifbo tartibida qoladi.
 */
const KATEGORIYA_TARTIB = ['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'КАБ', 'М/К'];

function katTartibRaqami(kat: string): number {
  const i = KATEGORIYA_TARTIB.indexOf(kat);
  return i < 0 ? KATEGORIYA_TARTIB.length : i;
}

function katTaqqosla(a: string, b: string): number {
  return katTartibRaqami(a) - katTartibRaqami(b) || a.localeCompare(b);
}

function son(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function narxQiymati(v: unknown): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function narxHolati(sonlar: Set<number>): { qiymat: number | null; holat: string } {
  if (sonlar.size === 0) return { qiymat: null, holat: 'manba yo‘q' };
  if (sonlar.size === 1) return { qiymat: [...sonlar][0], holat: 'aniq' };
  return { qiymat: null, holat: 'turli narxlar' };
}

/**
 * `t2_qator_holat` qatorlarini kategoriya+resurs bo'yicha jamlaydi.
 * Kalit — `kat|nom|birlik` (bitta resurs bir nechta BL ostida bir xil
 * nom/birlik bilan takrorlanishi mumkin — ular BITTA vedomost qatoriga
 * qo'shiladi).
 */
export function resursVedomostQur(qatorlar: readonly T2QatorHolat[]): ResursVedomostQator[] {
  const guruh = new Map<string, ResursVedomostQator>();
  const smetaNarxlar = new Map<string, Set<number>>();
  const faktNarxlar = new Map<string, Set<number>>();
  const f2Narxlar = new Map<string, Set<number>>();
  for (const q of qatorlar) {
    if (!q.tur || !RESURS_TUR.has(q.tur)) continue;
    const kat = q.kat || 'BOSHQA';
    const nom = q.nom || '(nomsiz)';
    const birlik = q.birlik || '';
    const kalit = kat + '|' + nom + '|' + birlik;
    let r = guruh.get(kalit);
    if (!r) {
      r = { kat, kod: q.kod, nom, birlik: q.birlik, smetaHajm: 0, smetaNarx: null, smetaSumma: 0, faktHajm: 0, faktSumma: 0, f2Hajm: 0, faktNarx: null, f2Narx: null, f2Summa: 0, qoldiqHajm: 0, qoldiqSumma: 0, narxHolati: '', qatorSoni: 0 };
      guruh.set(kalit, r);
      smetaNarxlar.set(kalit, new Set<number>());
      faktNarxlar.set(kalit, new Set<number>());
      f2Narxlar.set(kalit, new Set<number>());
    }
    r.smetaHajm += son(q.smeta_hajm);
    r.smetaSumma += son(q.smeta_summa);
    r.faktHajm += son(q.fakt_hajm);
    r.faktSumma += son(q.fakt_summa);
    r.f2Hajm += son(q.f2_hajm);
    r.f2Summa += son(q.f2_summa);
    r.qoldiqHajm += son(q.qoldiq_hajm);
    r.qoldiqSumma += son(q.qoldiq_summa);
    r.qatorSoni += 1;
    if (!r.kod && q.kod) r.kod = q.kod;
    const smetaNarx = narxQiymati(q.smeta_narx);
    const faktNarx = narxQiymati(q.fakt_narx);
    const f2Narx = narxQiymati(q.f2_narx);
    if (smetaNarx != null) smetaNarxlar.get(kalit)!.add(smetaNarx);
    if (faktNarx != null) faktNarxlar.get(kalit)!.add(faktNarx);
    if (f2Narx != null) f2Narxlar.get(kalit)!.add(f2Narx);
  }
  for (const [kalit, r] of guruh) {
    const smeta = narxHolati(smetaNarxlar.get(kalit)!);
    const fakt = narxHolati(faktNarxlar.get(kalit)!);
    const f2 = narxHolati(f2Narxlar.get(kalit)!);
    r.smetaNarx = smeta.qiymat;
    r.faktNarx = fakt.qiymat;
    r.f2Narx = f2.qiymat;
    r.narxHolati = `Smeta: ${smeta.holat}; Fakt: ${fakt.holat}; F2: ${f2.holat}`;
  }
  return [...guruh.values()].sort((a, b) => katTaqqosla(a.kat, b.kat) || a.nom.localeCompare(b.nom));
}

export type ResursVedomostKategoriya = {
  kat: string;
  qatorlar: ResursVedomostQator[];
  jamiSmetaSumma: number;
  jamiFaktSumma: number;
  jamiF2Summa: number;
  jamiQoldiqSumma: number;
};

/**
 * Owner (2026-09-10): "excel lrv hujjatlari ichida bo'lishi kerak" — resurs
 * vedomosti ilova ichidagi alohida ko'rinish (`ResursVedomostNative.tsx`)
 * bilan CHEKLANMASIN, LRV_PLUS/Forma-2 eksportining O'ZI ichida alohida
 * varaq bo'lib chiqsin. Bu yerda XLSX'ga bog'liqlik YO'Q (pure, testable) —
 * `lrv-plus-export.ts` shu qatorlar massivini `aoa_to_sheet`ga beradi.
 * Xuddi shu `resursVedomostKategoriyalarga` natijasidan quriladi — ekrandagi
 * va Excel'dagi vedomost IKKI XIL HISOB-KITOB emas, bitta manba.
 */
export function resursVedomostAoa(qatorlar: readonly T2QatorHolat[]): (string | number)[][] {
  const aoa: (string | number)[][] = [
    ['Kategoriya', 'Kod', 'Resurs', 'Birlik', 'Smeta hajm', 'Smeta birlik narxi', 'Smeta summa', 'Fakt hajm', 'Fakt birlik narxi', 'Fakt summa', 'F2 hajm', 'F2 birlik narxi', 'F2 summa', 'Qoldiq hajm', 'Qoldiq summa', 'Narx holati'],
  ];
  for (const k of resursVedomostKategoriyalarga(qatorlar)) {
    aoa.push([`${k.kat} (${k.qatorlar.length} resurs)`, '', '', '', '', '', k.jamiSmetaSumma, '', '', k.jamiFaktSumma, '', '', k.jamiF2Summa, '', k.jamiQoldiqSumma, '']);
    for (const r of k.qatorlar) {
      aoa.push(['', r.kod || '', r.nom, r.birlik || '', r.smetaHajm, r.smetaNarx ?? '', r.smetaSumma, r.faktHajm, r.faktNarx ?? '', r.faktSumma, r.f2Hajm, r.f2Narx ?? '', r.f2Summa, r.qoldiqHajm, r.qoldiqSumma, r.narxHolati]);
    }
  }
  return aoa;
}

/** Kategoriya bo'yicha guruhlangan ko'rinish — sahifada bo'lim-bo'lim chizish uchun. */
export function resursVedomostKategoriyalarga(qatorlar: readonly T2QatorHolat[]): ResursVedomostKategoriya[] {
  const barchasi = resursVedomostQur(qatorlar);
  const guruh = new Map<string, ResursVedomostQator[]>();
  for (const r of barchasi) {
    const a = guruh.get(r.kat);
    if (a) a.push(r); else guruh.set(r.kat, [r]);
  }
  return [...guruh.entries()]
    .sort(([a], [b]) => katTaqqosla(a, b))
    .map(([kat, list]) => ({
      kat, qatorlar: list,
      jamiSmetaSumma: list.reduce((s, r) => s + r.smetaSumma, 0),
      jamiFaktSumma: list.reduce((s, r) => s + r.faktSumma, 0),
      jamiF2Summa: list.reduce((s, r) => s + r.f2Summa, 0),
      jamiQoldiqSumma: list.reduce((s, r) => s + r.qoldiqSumma, 0),
    }));
}
