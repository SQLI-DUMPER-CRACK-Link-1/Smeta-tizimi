/**
 * Tender oferta V2 — deterministik iqtisodiy yadro.
 *
 * Ikki MUSTAQIL o'lchov:
 *   rol        — qatorning hujjatdagi TUZILMAVIY roli (resurs, bo'lim, jami,
 *                hosila transport/sklad, ma'lumot ...);
 *   kategoriya — resursning IQTISODIY toifasi (ЧЕЛ/МАШ/МАТ/ОБ/М/К/КАБ/
 *                БЕЗСКЛАД), nakrutka kaskadi aynan shu bo'yicha ishlaydi.
 *
 * Manba qiymatlari (hajm, birlik narx, summa) HECH QACHON o'zgartirilmaydi.
 * Taklif hajmi va narxi alohida maydonlar: sourceQuantity → override →
 * effectiveOfferQuantity. Pul faqat RESOURCE barglaridan yig'iladi; JAMI
 * qatorlari faqat nazorat/ko'rinish, shuning uchun hech narsa ikki marta
 * sanalmaydi. Hosila xarajatlar (transport/sklad/prochie/sug'urta/QQS) eski
 * podval summalaridan emas, YANGI pudratchi kategoriya asoslaridan kanonik
 * nakrutka kaskadi (nakrutka-kaskad.ts = SQL t2_nakrutka_hisobla_v1) bilan
 * hisoblanadi.
 */
import type { NakrutkaKoeffitsientlar } from '../api/t2-nakrutka';
import { NAKRUTKA_STANDART, nakrutkaKaskadXom, pulYaxlitla, type NakrutkaAsos, type NakrutkaQadamlar } from './nakrutka-kaskad';

export type OfertaNarxRejimi = 'foiz' | 'qolda';
export type OfertaFoizYon = 'pasaytirish' | 'oshirish';

export type OfertaRol =
  | 'RESOURCE'
  | 'SECTION'
  | 'SUBTOTAL'
  | 'GRAND_TOTAL'
  | 'TRANSPORT'
  | 'STORAGE'
  | 'MARKUP'
  | 'INFO'
  | 'UNKNOWN';

export const OFERTA_KATEGORIYALAR = ['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'М/К', 'КАБ', 'БЕЗСКЛАД'] as const;
export type OfertaMalumKategoriya = typeof OFERTA_KATEGORIYALAR[number];
export type OfertaKategoriya = OfertaMalumKategoriya | 'UNKNOWN';
export type OfertaKategoriyaManbasi = 'birlik' | 'nom' | 'bolim' | 'podval' | 'vedomost' | 'qolda' | 'yoq';

/** 'birlik' — taklif = hajm × pudratchi birlik narxi; 'manba_jami' — manbada
 * faqat summa bor (RESURS_VEDOMOST, TN transport varag'i): taklif summasi
 * shu summaga nisbatan beriladi, soxta birlik narx yaratilmaydi. */
export type OfertaHisobTuri = 'birlik' | 'manba_jami' | 'yoq';

export type OfertaQator = {
  /** Bir fayl ichida o'zgarmaydigan manba kaliti: `${varaq}::r${excelQator}`. */
  sourceId: string;
  sourceSheet: string;
  /** Excel qator raqami (1-based) — OOXML `<row r>` bilan bir xil. */
  sourceRow: number;
  tartibRaqami: string | number | null;
  shifr: string | null;
  nom: string;
  birlik: string | null;
  /** sourceQuantity — manba hajmi (o'zgarmaydi). */
  hajm: number | null;
  /** sourceUnitPrice. */
  smetaBirlikNarx: number | null;
  /** Manba summasi — hech qachon hajm × narx bilan almashtirilmaydi. */
  smetaSumma: number | null;
  rol: OfertaRol;
  hisobTuri: OfertaHisobTuri;
  /** Faqat RESOURCE uchun; boshqalarda null. */
  kategoriya: OfertaKategoriya | null;
  kategoriyaManbasi: OfertaKategoriyaManbasi;
  /** Kategoriya dalil bilan aniqlanmagan, lekin bo‘lim nomi ishora beradi
   * (masalan “ИНЕРТНЫЕ МАТЕРИАЛЫ” → БЕЗСКЛАД). Avtomatik qo‘llanmaydi —
   * operator tasdiqlaydi (egasi: БЕЗСКЛАД qoidasi to‘liq isbotlanmagan). */
  kategoriyaTaklifi?: OfertaMalumKategoriya;
  /** TRANSPORT/STORAGE: true — RES ichidagi foizli podval qatori (kaskad
   * qayta hisoblaydi); false — alohida transport hisob varag'i qatori. */
  hosila?: boolean;
  /** SUBTOTAL/GRAND_TOTAL: bevosita bolalar (barg yoki ichki jami) sourceId. */
  jamiBolalari?: string[];
  /** Jami bolalari qanday aniqlandi: manba summasi aynan mos ('summa'),
   * tuzilma bo'yicha ('tuzilma' — manba summasi 0/bo'sh), yoki topilmadi. */
  jamiMoslik?: 'summa' | 'tuzilma' | 'mos_emas';
  /** Original varaqdagi ustunlar (0-based). */
  manbaHajmUstuni?: number;
  manbaNarxUstuni?: number;
  manbaSummaUstuni?: number;
  /** Manba hujayrasi Excelda SON turida (matn emas) — export formulasi
   * faqat shunda unga havola qiladi, aks holda qiymat konstanta yoziladi. */
  manbaHajmSon?: boolean;
  manbaSummaSon?: boolean;
};

export type OfertaFoiz = { yon: OfertaFoizYon; foiz: number };

export type OfertaNarxSozlamasi = {
  rejim: OfertaNarxRejimi;
  yon?: OfertaFoizYon;
  foiz?: number | null;
  /** Kategoriya bo'yicha alohida foiz (masalan МАТ −15%, МАШ +3%).
   * Qatordagi qo'lda narx undan ustun; u esa global foizdan ustun. */
  kategoriyaFoizlari?: Partial<Record<OfertaMalumKategoriya, OfertaFoiz>>;
};

export type OfertaTransportSiyosati = 'kaskad' | 'varaq';

export type OfertaKirish = {
  sozlama: OfertaNarxSozlamasi;
  manualNarxlar?: Readonly<Record<string, number | null | undefined>>;
  manualHajmlar?: Readonly<Record<string, number | null | undefined>>;
  manualKategoriyalar?: Readonly<Record<string, OfertaMalumKategoriya | undefined>>;
  nakrutka?: Partial<NakrutkaKoeffitsientlar>;
  /** 'kaskad' (standart): material transporti ТРАНСПОРТ_МАТЕРИАЛ % bilan;
   * alohida transport varag'i faqat dalil. 'varaq': transport varag'idagi
   * pudratchi summasi material transporti o'rnida ishlatiladi (ikki marta
   * sanalmasligi uchun foiz qadami almashtiriladi). */
  transportSiyosati?: OfertaTransportSiyosati;
};

export type OfertaMuammo =
  | 'HAJM_YOQ'
  | 'PUDRATCHI_NARXI_YOQ'
  | 'SMETA_NARXI_YOQ'
  | 'SMETA_NARXI_NOL'
  | 'FOIZ_XATO'
  | 'NARX_MANFIY'
  | 'KATEGORIYA_NOMALUM'
  | 'JAMI_MOS_EMAS';

export type OfertaQatorNatija = OfertaQator & {
  /** offerQuantityOverride — foydalanuvchi kiritgan taklif hajmi. */
  taklifHajmiOverride: number | null;
  /** effectiveOfferQuantity — UI, hisob, validatsiya va Excel shu qiymatni ishlatadi. */
  taklifHajmi: number | null;
  hajmManbasi: 'manba' | 'qolda' | 'yoq';
  /** offerUnitPrice. */
  pudratchiBirlikNarx: number | null;
  /** Taklif summasi — ROUND(taklifHajmi × pudratchiBirlikNarx; 2). */
  pudratchiSumma: number | null;
  narxManbasi: 'foiz' | 'kategoriya_foiz' | 'qolda' | 'yoq';
  /** Qo'llangan foiz (Excel formulasi uchun), bo'lsa. */
  qollanganFoiz: OfertaFoiz | null;
  /** Foydalanuvchi o'zgartirgan bo'lsa ham shu qiymat hisobga kiradi. */
  samaraliKategoriya: OfertaKategoriya | null;
  muammolar: OfertaMuammo[];
};

export type OfertaKategoriyaJami = Record<OfertaKategoriya, number>;

export type OfertaHisoblash = {
  qatorlar: OfertaQatorNatija[];
  /** SOURCE TOTAL — manba RESOURCE barglari summasi (o'zgarmagan). */
  manbaTogridanJami: number;
  manbaKategoriyaJami: OfertaKategoriyaJami;
  /** CONTRACTOR DIRECT TOTAL — pudratchi RESOURCE barglari. */
  togridanJami: number;
  kategoriyaJami: OfertaKategoriyaJami;
  /** Alohida transport varag'i pudratchi summasi (siyosatga qarab ishlatiladi). */
  transportVaraqJami: number;
  asos: NakrutkaAsos;
  koeffitsientlar: NakrutkaKoeffitsientlar;
  transportSiyosati: OfertaTransportSiyosati;
  /** Yaxlitlanmagan kaskad (Excel formulalari bilan bir xil tartib). */
  kaskadXom: NakrutkaQadamlar;
  /** 2 xonali ko'rinish. */
  kaskad: NakrutkaQadamlar;
  /** Manba asoslari bo'yicha ayni kaskad — solishtirish uchun. */
  manbaKaskad: NakrutkaQadamlar;
  /** FINAL OFFER — hal qilinmagan barg bo'lsa null (taxminiy pul yo'q). */
  yakuniyOferta: number | null;
  /** Narxi/hajmi yoki kategoriyasi hal qilinmagan RESOURCE barglari. */
  halQilinmagan: number;
  muammolarSoni: number;
  valid: boolean;
};

function finiteNonNegative(value: unknown): number | null {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizePrice(value: unknown): number | null {
  const n = finiteNonNegative(value);
  if (n == null) return null;
  // Suzuvchi nuqta shovqinini kamaytiradi; narx Excelga QIYMAT sifatida
  // yoziladi, shuning uchun UI va Excel ayni double'ni ko'paytiradi.
  return Math.round(n * 1e10) / 1e10;
}

export function foizKoeffitsienti(f: OfertaFoiz): number {
  return f.yon === 'oshirish' ? 1 + f.foiz / 100 : 1 - f.foiz / 100;
}

function adjusted(base: number, f: OfertaFoiz): { value: number | null; muammo?: OfertaMuammo } {
  if (!Number.isFinite(f.foiz) || f.foiz < 0) return { value: null, muammo: 'FOIZ_XATO' };
  const factor = foizKoeffitsienti(f);
  if (!Number.isFinite(factor) || factor < 0) return { value: null, muammo: 'NARX_MANFIY' };
  return { value: base * factor };
}

export const bosKategoriyaJami = (): OfertaKategoriyaJami =>
  ({ ЧЕЛ: 0, МАШ: 0, МАТ: 0, ОБ: 0, 'М/К': 0, КАБ: 0, БЕЗСКЛАД: 0, UNKNOWN: 0 });

/** Kategoriya summalaridan kaskad asosi (SQL t2_obyekt_nakrutka_v1 bilan
 * bir xil xaritalash: mat = МАТ + М/К + КАБ + БЕЗСКЛАД). Qo'shish tartibi
 * Excel OFERTA_JAMI formulalari bilan bir xil. */
export function kategoriyadanAsos(j: OfertaKategoriyaJami): NakrutkaAsos {
  return {
    chel: j['ЧЕЛ'], mash: j['МАШ'], ob: j['ОБ'],
    mat: j['МАТ'] + j['М/К'] + j['КАБ'] + j['БЕЗСКЛАД'],
    mk: j['М/К'], kab: j['КАБ'], bez: j['БЕЗСКЛАД'],
  };
}

function qatorFoizi(kat: OfertaKategoriya | null, sozlama: OfertaNarxSozlamasi): { foiz: OfertaFoiz; manba: 'foiz' | 'kategoriya_foiz' } | null {
  if (kat && kat !== 'UNKNOWN') {
    const kf = sozlama.kategoriyaFoizlari?.[kat];
    if (kf) return { foiz: kf, manba: 'kategoriya_foiz' };
  }
  if (sozlama.rejim !== 'foiz') return null;
  return { foiz: { yon: sozlama.yon ?? 'pasaytirish', foiz: Number(sozlama.foiz ?? 0) }, manba: 'foiz' };
}

/** Pul chiqaradigan (narxlanadigan) qatorlar: resurs va alohida transport
 * varag'i qatorlari. Podval hosilalari kaskad bilan qayta hisoblanadi. */
export function narxlanadiganmi(qator: Pick<OfertaQator, 'rol' | 'hosila'>): boolean {
  return qator.rol === 'RESOURCE' || (qator.rol === 'TRANSPORT' && qator.hosila === false);
}

function bargNatija(qator: OfertaQator, kirish: OfertaKirish): OfertaQatorNatija {
  const muammolar: OfertaMuammo[] = [];
  const manualKat = kirish.manualKategoriyalar?.[qator.sourceId];
  const samaraliKategoriya: OfertaKategoriya | null = qator.rol === 'RESOURCE' ? (manualKat ?? qator.kategoriya ?? 'UNKNOWN') : null;
  const hajmOverrideRaw = kirish.manualHajmlar && Object.prototype.hasOwnProperty.call(kirish.manualHajmlar, qator.sourceId)
    ? finiteNonNegative(kirish.manualHajmlar[qator.sourceId]) : null;
  const taklifHajmi = hajmOverrideRaw ?? (qator.hajm != null && Number.isFinite(qator.hajm) ? qator.hajm : null);
  const hajmManbasi: OfertaQatorNatija['hajmManbasi'] = hajmOverrideRaw != null ? 'qolda' : taklifHajmi != null ? 'manba' : 'yoq';

  const manualBerilgan = !!kirish.manualNarxlar && Object.prototype.hasOwnProperty.call(kirish.manualNarxlar, qator.sourceId);
  const manual = manualBerilgan ? normalizePrice(kirish.manualNarxlar![qator.sourceId]) : null;
  let pudratchiBirlikNarx: number | null = null;
  let pudratchiSumma: number | null = null;
  let narxManbasi: OfertaQatorNatija['narxManbasi'] = 'yoq';
  let qollanganFoiz: OfertaFoiz | null = null;

  if (manualBerilgan && manual != null) {
    narxManbasi = 'qolda';
    if (qator.hisobTuri === 'manba_jami') pudratchiSumma = pulYaxlitla(manual);
    else pudratchiBirlikNarx = manual;
  } else if (manualBerilgan) {
    muammolar.push('PUDRATCHI_NARXI_YOQ');
  } else {
    const f = qatorFoizi(samaraliKategoriya, kirish.sozlama);
    if (!f) muammolar.push('PUDRATCHI_NARXI_YOQ');
    else {
      const base = qator.hisobTuri === 'manba_jami' ? qator.smetaSumma : qator.smetaBirlikNarx;
      if (base == null || !Number.isFinite(base)) muammolar.push('SMETA_NARXI_YOQ');
      else if (base < 0) muammolar.push('SMETA_NARXI_NOL');
      else if (base === 0) {
        // Smeta narxni ANIQ 0 deb yozgan (ВОДА, ОЧЕС ЛЬНЯНОЙ…): bu noma'lum
        // pul emas — ma'lum 0. Taklif ham 0, yakuniy summa to'silmaydi;
        // qator ogohlantirish sifatida ko'rinadi (qo'lda narx kiritish mumkin).
        narxManbasi = f.manba;
        qollanganFoiz = f.foiz;
        if (qator.hisobTuri === 'manba_jami') pudratchiSumma = 0;
        else pudratchiBirlikNarx = 0;
        muammolar.push('SMETA_NARXI_NOL');
      } else {
        const r = adjusted(base, f.foiz);
        if (r.value == null) muammolar.push(r.muammo ?? 'FOIZ_XATO');
        else {
          narxManbasi = f.manba;
          qollanganFoiz = f.foiz;
          // manba_jami: Excel `ROUND(manba*(1±p/100);2)` — normalizePrice'siz.
          if (qator.hisobTuri === 'manba_jami') pudratchiSumma = pulYaxlitla(r.value);
          else pudratchiBirlikNarx = normalizePrice(r.value);
        }
      }
    }
  }

  if (qator.hisobTuri !== 'manba_jami') {
    if (taklifHajmi == null) muammolar.push('HAJM_YOQ');
    else if (pudratchiBirlikNarx != null) pudratchiSumma = pulYaxlitla(taklifHajmi * pudratchiBirlikNarx);
  }
  if (samaraliKategoriya === 'UNKNOWN') muammolar.push('KATEGORIYA_NOMALUM');

  return {
    ...qator, taklifHajmiOverride: hajmOverrideRaw, taklifHajmi, hajmManbasi,
    pudratchiBirlikNarx, pudratchiSumma, narxManbasi, qollanganFoiz, samaraliKategoriya, muammolar,
  };
}

function bosNatija(qator: OfertaQator, muammolar: OfertaMuammo[] = []): OfertaQatorNatija {
  return {
    ...qator, taklifHajmiOverride: null, taklifHajmi: null, hajmManbasi: 'yoq',
    pudratchiBirlikNarx: null, pudratchiSumma: null, narxManbasi: 'yoq', qollanganFoiz: null,
    samaraliKategoriya: null, muammolar,
  };
}

function kaskadYaxlit(q: NakrutkaQadamlar): NakrutkaQadamlar {
  return Object.fromEntries(Object.entries(q).map(([k, v]) => [k, pulYaxlitla(v)])) as NakrutkaQadamlar;
}

/**
 * RES qatorlaridan oferta natijasini quradi. Noma'lum qiymatlar 0 ga
 * aylantirilmaydi; hal qilinmagan barg bo'lsa yakuniy oferta null.
 */
export function ofertaHisobla(qatorlar: readonly OfertaQator[], kirish: OfertaKirish): OfertaHisoblash {
  const nk: NakrutkaKoeffitsientlar = { ...NAKRUTKA_STANDART, ...(kirish.nakrutka ?? {}) } as NakrutkaKoeffitsientlar;
  const transportSiyosati = kirish.transportSiyosati ?? 'kaskad';
  const byId = new Map<string, OfertaQatorNatija>();
  const natijalar: OfertaQatorNatija[] = [];

  for (const qator of qatorlar) {
    const n = narxlanadiganmi(qator) ? bargNatija(qator, kirish) : bosNatija(qator);
    byId.set(qator.sourceId, n);
    natijalar.push(n);
  }
  // Jami qatorlar — bevosita bolalar yig'indisi (Excel SUM bilan bir tartibda).
  // Qatorlar yuqoridan pastga yurgani uchun ichki jami tashqisidan oldin tayyor.
  for (const n of natijalar) {
    if (n.rol !== 'SUBTOTAL' && n.rol !== 'GRAND_TOTAL') continue;
    if (n.jamiMoslik === 'mos_emas') { n.muammolar.push('JAMI_MOS_EMAS'); continue; }
    const bolalar = (n.jamiBolalari ?? []).map((id) => byId.get(id)).filter((x): x is OfertaQatorNatija => !!x);
    const qiymatlar = bolalar.map((b) => b.pudratchiSumma).filter((v): v is number => v != null);
    n.pudratchiSumma = qiymatlar.length ? qiymatlar.reduce((a, b) => a + b, 0) : null;
  }

  // Varaq bo'yicha, keyin varaqlar tartibida yig'amiz (Excel SUMIFS + '+').
  const varaqlar: string[] = [];
  const perSheet = new Map<string, { kat: OfertaKategoriyaJami; manba: OfertaKategoriyaJami; transport: number }>();
  for (const n of natijalar) {
    if (!perSheet.has(n.sourceSheet)) { varaqlar.push(n.sourceSheet); perSheet.set(n.sourceSheet, { kat: bosKategoriyaJami(), manba: bosKategoriyaJami(), transport: 0 }); }
    const s = perSheet.get(n.sourceSheet)!;
    if (n.rol === 'RESOURCE') {
      const kat = n.samaraliKategoriya ?? 'UNKNOWN';
      if (n.pudratchiSumma != null) s.kat[kat] += n.pudratchiSumma;
      if (n.smetaSumma != null && Number.isFinite(n.smetaSumma)) s.manba[kat] += n.smetaSumma;
    } else if (n.rol === 'TRANSPORT' && n.hosila === false && n.pudratchiSumma != null) {
      s.transport += n.pudratchiSumma;
    }
  }
  const kategoriyaJami = bosKategoriyaJami();
  const manbaKategoriyaJami = bosKategoriyaJami();
  let transportVaraqJami = 0;
  for (const v of varaqlar) {
    const s = perSheet.get(v)!;
    for (const key of Object.keys(kategoriyaJami) as OfertaKategoriya[]) {
      kategoriyaJami[key] += s.kat[key];
      manbaKategoriyaJami[key] += s.manba[key];
    }
    transportVaraqJami += s.transport;
  }
  const sumAll = (j: OfertaKategoriyaJami) => (Object.values(j) as number[]).reduce((a, b) => a + b, 0);

  const asos = kategoriyadanAsos(kategoriyaJami);
  const qoshimcha = transportSiyosati === 'varaq' ? { trMatOverride: transportVaraqJami } : {};
  const kaskadXom = nakrutkaKaskadXom(asos, nk, qoshimcha);

  const halQilinmagan = natijalar.filter((n) => n.rol === 'RESOURCE' && (n.pudratchiSumma == null || n.samaraliKategoriya === 'UNKNOWN')).length;
  const muammolarSoni = natijalar.reduce((a, n) => a + n.muammolar.length, 0);
  const yakuniyOferta = halQilinmagan === 0 && natijalar.some((n) => n.rol === 'RESOURCE') ? pulYaxlitla(kaskadXom.vsego) : null;

  return {
    qatorlar: natijalar,
    manbaTogridanJami: sumAll(manbaKategoriyaJami),
    manbaKategoriyaJami,
    togridanJami: sumAll(kategoriyaJami),
    kategoriyaJami,
    transportVaraqJami,
    asos,
    koeffitsientlar: nk,
    transportSiyosati,
    kaskadXom,
    kaskad: kaskadYaxlit(kaskadXom),
    manbaKaskad: kaskadYaxlit(nakrutkaKaskadXom(kategoriyadanAsos(manbaKategoriyaJami), nk)),
    yakuniyOferta,
    halQilinmagan,
    muammolarSoni,
    valid: muammolarSoni === 0 && yakuniyOferta != null,
  };
}
