import type { T2Qator, T2QatorHolat } from '../api/supabase';

/**
 * OSTATKA — bajarilmay qolgan ishlar smeta shaklida (egasi 2026-09-23: "tizim
 * ostatka ishlarni ham bittada smeta shaklida bera oladigan bo'lishi kerak").
 *
 * Ta'rif LRV_PLUS dagi Q ustuni bilan bir xil: ostatka = smeta hajm − fakt hajm
 * (`t2_qator_holat.fakt_hajm`; rs uchun bl faktidan norma bo'yicha hosila ham).
 * Hujjat LRV_PLUS yozuvchisi (Forma-2 ko'rinishi) orqali chiqadi — formulalar,
 * guruhlash, `$` siz qoidasi va bl birlik narxi o'sha yerda.
 *
 *  - faqat ostatkasi > 0 barglar va ularning RZ/BL otalari (ichma-ich RZ saqlanadi);
 *  - hajm o'rniga ostatka hajm; summa Excel formulasidan (F × G, SUMIF);
 *  - smeta hajmi noma'lum (NULL) qator — ostatka ham noma'lum: kirmaydi, sanaladi;
 *  - fakt smetadan oshgan qator — kirmaydi, sanaladi (jim yashirilmaydi).
 */
export interface OstatkaNatija {
  qatorlar: T2Qator[];
  /** Fakt smetadan oshgan barglar soni. */
  oshibKetgan: number;
  /** Smeta hajmi noma'lum barglar soni. */
  nomalum: number;
  /** Ostatkasi bor barglar soni. */
  barglar: number;
}

const EPS = 1e-9;
const BARG = new Set(['rs', 'mat', 'ob']);

export function ostatkaQatorlari(qatorlar: readonly T2Qator[], holatlar: readonly T2QatorHolat[]): OstatkaNatija {
  const faktOf = new Map(holatlar.map((h) => [h.qator_id, h.fakt_hajm ?? 0]));
  const bolalar = new Map<number, T2Qator[]>();
  for (const q of qatorlar) {
    if (q.ota_id == null) continue;
    const b = bolalar.get(q.ota_id);
    if (b) b.push(q); else bolalar.set(q.ota_id, [q]);
  }
  const ost = new Map<number, number>();
  let oshibKetgan = 0, nomalum = 0, barglar = 0;
  const ostHisobla = (q: T2Qator): number | null => {
    if (q.hajm == null) return null;
    const o = q.hajm - (faktOf.get(q.id) ?? 0);
    return Math.abs(o) < EPS ? 0 : o;
  };
  const qolsin = new Set<number>();
  // Bargdan yuqoriga: barg qolsa — butun ota zanjiri qoladi.
  const byId = new Map(qatorlar.map((q) => [q.id, q]));
  const otalarniQoldir = (q: T2Qator) => {
    for (let o = q.ota_id == null ? undefined : byId.get(q.ota_id); o && !qolsin.has(o.id); o = o.ota_id == null ? undefined : byId.get(o.ota_id)) {
      qolsin.add(o.id);
    }
  };
  for (const q of qatorlar) {
    const tur = q.tur ?? '';
    const bolasiBor = (bolalar.get(q.id)?.length ?? 0) > 0;
    const bargmi = BARG.has(tur) || (tur === 'bl' && !bolasiBor);
    if (!bargmi && tur !== 'bl') continue;
    const o = ostHisobla(q);
    if (o == null) { if (bargmi) nomalum++; continue; }
    if (o < 0) { if (bargmi) oshibKetgan++; continue; }
    if (o === 0) continue;
    ost.set(q.id, o);
    if (bargmi) { barglar++; qolsin.add(q.id); otalarniQoldir(q); }
  }
  // bl ning o'zi ostatkasi bo'lsa-yu, resurslari (norma hosilasi) qolmagan bo'lsa ham bl qoladi.
  for (const q of qatorlar) if (q.tur === 'bl' && ost.has(q.id) && !qolsin.has(q.id)) { qolsin.add(q.id); otalarniQoldir(q); }

  const chiq = qatorlar
    .filter((q) => qolsin.has(q.id))
    .map((q) => (ost.has(q.id) ? { ...q, hajm: ost.get(q.id)!, summa: null } : { ...q, summa: null }));
  return { qatorlar: chiq, oshibKetgan, nomalum, barglar };
}
