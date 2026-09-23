/**
 * Tender oferta uchun deterministik narx yadrosi.
 *
 * Bu modul RES manbasidagi qiymatlarni o'zgartirmaydi: smeta birlik narxi va
 * smeta summasi alohida saqlanadi. Pudratchi narxi esa alohida kirish bo'lib,
 * taklif summasi faqat hajm × pudratchi birlik narxidan olinadi.
 */

export type OfertaNarxRejimi = 'foiz' | 'qolda';
export type OfertaFoizYon = 'pasaytirish' | 'oshirish';

/** RES/ABC/TN satrining hujjatdagi iqtisodiy roli. Jami va bo'lim satrlari
 * resurs sifatida qayta narxlanmaydi: ular faqat ko'rinish va nazorat uchun
 * saqlanadi. */
export type OfertaQatorTuri =
  | 'resurs'
  | 'jami'
  | 'sklad_xarajati'
  | 'transport_xarajati'
  | 'bolim';

export type OfertaHisobTuri = 'birlik' | 'manba_jami' | 'jami' | 'bolim';

export type OfertaQator = {
  /** Bir fayl ichida tartib raqami takrorlansa ham o'zgarmaydigan manba kaliti. */
  sourceId: string;
  sourceSheet: string;
  sourceRow: number;
  tartibRaqami: string | number | null;
  shifr: string | null;
  nom: string;
  birlik: string | null;
  hajm: number | null;
  smetaBirlikNarx: number | null;
  /** Manbada berilgan summa. U hech qachon hajm × narx bilan almashtirilmaydi. */
  smetaSumma: number | null;
  turi: OfertaQatorTuri;
  hisobTuri: OfertaHisobTuri;
  /** Bir blok ichidagi qatorlarni alohida jami bilan bog'lash uchun. */
  blokKaliti: string | null;
  jamiQamrovi?: 'blok' | 'varaq';
  /** Original varaqdagi ustunlar (0-based); export formulani manba hajmiga
   * bog'laydi va original qiymatni ko'chirib yubormaydi. */
  manbaHajmUstuni?: number;
  manbaSummaUstuni?: number;
};

export type OfertaNarxSozlamasi = {
  rejim: OfertaNarxRejimi;
  yon?: OfertaFoizYon;
  foiz?: number | null;
};

export type OfertaMuammo =
  | 'HAJM_YOQ'
  | 'PUDRATCHI_NARXI_YOQ'
  | 'SMETA_NARXI_YOQ'
  | 'FOIZ_XATO'
  | 'NARX_MANFIY'
  | 'JAMI_CHILDREN_YOQ';

export type OfertaQatorNatija = OfertaQator & {
  pudratchiBirlikNarx: number | null;
  pudratchiSumma: number | null;
  narxManbasi: 'foiz' | 'qolda' | 'yoq';
  muammolar: OfertaMuammo[];
};

export type OfertaHisoblash = {
  qatorlar: OfertaQatorNatija[];
  smetaJami: number;
  ofertaJami: number;
  valid: boolean;
  muammolarSoni: number;
  resursJami: number;
  skladJami: number;
  transportJami: number;
};

function finiteNonNegative(value: unknown): number | null {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizePrice(value: unknown): number | null {
  const n = finiteNonNegative(value);
  if (n == null) return null;
  // Hisob ichidagi suzuvchi nuqta shovqinini kamaytiradi, biznes qiymatini
  // pulning ikki xonasiga majburlamaydi. Excel natijasi baribir formula bilan
  // qayta hisoblanadi.
  return Math.round(n * 1e10) / 1e10;
}

function adjustedPrice(base: number, sozlama: OfertaNarxSozlamasi): { price: number | null; muammo?: OfertaMuammo } {
  const foiz = Number(sozlama.foiz ?? 0);
  if (!Number.isFinite(foiz) || foiz < 0) return { price: null, muammo: 'FOIZ_XATO' };
  const factor = sozlama.yon === 'oshirish' ? 1 + foiz / 100 : 1 - foiz / 100;
  if (!Number.isFinite(factor) || factor < 0) return { price: null, muammo: 'NARX_MANFIY' };
  const price = normalizePrice(base * factor);
  return price == null ? { price: null, muammo: 'NARX_MANFIY' } : { price };
}

function isNarxlanadigan(qator: OfertaQator): boolean {
  return qator.turi === 'resurs' || qator.turi === 'sklad_xarajati' || qator.turi === 'transport_xarajati';
}

/**
 * RES satrlaridan oferta natijasini quradi.
 * `manualNarxlar` kaliti sourceId bo'lib, foydalanuvchi override'i global
 * foizdan ustun turadi. Noma'lum qiymatlar 0 ga aylantirilmaydi.
 */
export function ofertaQatorlariniHisobla(
  qatorlar: readonly OfertaQator[],
  sozlama: OfertaNarxSozlamasi,
  manualNarxlar: Readonly<Record<string, number | null | undefined>> = {},
): OfertaHisoblash {
  let smetaJami = 0;
  let ofertaJami = 0;
  let resursJami = 0;
  let skladJami = 0;
  let transportJami = 0;
  let muammolarSoni = 0;

  const natijalar: OfertaQatorNatija[] = [];
  for (const qator of qatorlar) {
    const muammolar: OfertaMuammo[] = [];
    if (qator.turi === 'bolim') {
      natijalar.push({ ...qator, pudratchiBirlikNarx: null, pudratchiSumma: null, narxManbasi: 'yoq', muammolar });
      continue;
    }

    if (qator.turi === 'jami') {
      const children = qator.jamiQamrovi === 'varaq'
        ? qatorlar.filter((candidate) => candidate.sourceSheet === qator.sourceSheet && isNarxlanadigan(candidate))
        : qatorlar.filter((candidate) => candidate.blokKaliti === qator.blokKaliti && isNarxlanadigan(candidate));
      const childResults = children.map((child) => {
        const result = natijalar[qatorlar.indexOf(child)];
        return result?.pudratchiSumma ?? null;
      });
      const sum = childResults.length && childResults.every((value) => value != null)
        ? childResults.reduce((total, value) => total + (value ?? 0), 0)
        : null;
      if (!children.length || sum == null) muammolar.push('JAMI_CHILDREN_YOQ');
      muammolarSoni += muammolar.length;
      natijalar.push({ ...qator, pudratchiBirlikNarx: null, pudratchiSumma: sum, narxManbasi: 'yoq', muammolar });
      continue;
    }

    const manualBerilgan = Object.prototype.hasOwnProperty.call(manualNarxlar, qator.sourceId);
    const manual = manualBerilgan ? normalizePrice(manualNarxlar[qator.sourceId]) : null;
    let pudratchiBirlikNarx: number | null = null;
    let pudratchiSumma: number | null = null;
    let narxManbasi: OfertaQatorNatija['narxManbasi'] = 'yoq';

    if (manualBerilgan) {
      if (manual == null) muammolar.push('PUDRATCHI_NARXI_YOQ');
      else if (qator.hisobTuri === 'manba_jami') {
        pudratchiSumma = manual;
        narxManbasi = 'qolda';
      } else {
        pudratchiBirlikNarx = manual;
        narxManbasi = 'qolda';
      }
    } else if (sozlama.rejim === 'foiz') {
      const base = qator.hisobTuri === 'manba_jami' ? normalizePrice(qator.smetaSumma) : normalizePrice(qator.smetaBirlikNarx);
      if (base == null) muammolar.push('SMETA_NARXI_YOQ');
      else {
        const adjusted = adjustedPrice(base, sozlama);
        if (adjusted.price == null) muammolar.push(adjusted.muammo ?? 'FOIZ_XATO');
        else if (qator.hisobTuri === 'manba_jami') { pudratchiSumma = adjusted.price; narxManbasi = 'foiz'; }
        else { pudratchiBirlikNarx = adjusted.price; narxManbasi = 'foiz'; }
      }
    } else {
      muammolar.push('PUDRATCHI_NARXI_YOQ');
    }

    if (qator.hisobTuri === 'manba_jami') {
      if (pudratchiSumma == null && !muammolar.includes('PUDRATCHI_NARXI_YOQ')) muammolar.push('PUDRATCHI_NARXI_YOQ');
    } else if (qator.hajm == null || !Number.isFinite(qator.hajm)) {
      muammolar.push('HAJM_YOQ');
    } else if (pudratchiBirlikNarx != null) {
      pudratchiSumma = qator.hajm * pudratchiBirlikNarx;
    }

    if (qator.smetaSumma != null && Number.isFinite(qator.smetaSumma)) smetaJami += qator.smetaSumma;
    if (pudratchiSumma != null) {
      ofertaJami += pudratchiSumma;
      if (qator.turi === 'resurs') resursJami += pudratchiSumma;
      if (qator.turi === 'sklad_xarajati') skladJami += pudratchiSumma;
      if (qator.turi === 'transport_xarajati') transportJami += pudratchiSumma;
    }
    muammolarSoni += muammolar.length;
    natijalar.push({ ...qator, pudratchiBirlikNarx, pudratchiSumma, narxManbasi, muammolar });
  }

  return {
    qatorlar: natijalar,
    smetaJami,
    ofertaJami,
    valid: muammolarSoni === 0 && natijalar.length > 0,
    muammolarSoni,
    resursJami,
    skladJami,
    transportJami,
  };
}

export function ofertaNarxniMatngaAylantir(value: number | null): string {
  return value == null ? '' : String(value);
}
