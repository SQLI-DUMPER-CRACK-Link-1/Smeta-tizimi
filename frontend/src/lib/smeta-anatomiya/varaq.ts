import { IerarxiyaQuruvchi } from './ierarxiya';
import { bosh, kalit, son, toliqUstunlar, xom } from './matn';
import { sarlavhaBlokiniTop, ustunXaritasi, type SarlavhaBloki } from './ustun';
import { qoshimchaUstunlar, uchlikniMoslashtir } from './ustun-dalil';
import type {
  Dalil, Ish, Katak, KirishVaraq, Manzil, Resurs, UstunXaritasi, VaraqAnatomiyasi, VaraqRoli,
} from './turlar';

const IMZO = /^(СОСТАВИЛ|ПРОВЕРИЛ|TUZDI|TEKSHIRDI|ИСПОЛНИТЕЛЬ)/;
const JAMI = /^(ИТОГО|ВСЕГО|JAMI|ЖАМИ)/;
/** Jamiga tegishli hisob qatorlari: resurs emas, lekin o'z summasi bilan saqlanadi. */
const HISOB_QATORI = /^(В Т\.? ?Ч\.?|В ТОМ ЧИСЛЕ|ТРАНСПОРТНЫЕ РАСХОДЫ|ЗАГОТОВИТЕЛЬНО|СКЛАДСКИЕ РАСХОДЫ)/;
/** Ish daraxtini yopadi: bundan keyin resurs vedomosti, sarlavha emas. */
const VEDOMOST_BOSHI = /^(ВЕДОМОСТЬ РЕСУРСОВ|ТРУДОВЫЕ РЕСУРСЫ|ЗАТРАТЫ ТРУДА$|(СТРОИТЕЛЬНЫЕ )?МАШИНЫ И МЕХАНИЗМЫ|МАТЕРИАЛЬНЫЕ РЕСУРСЫ|СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ И КОНСТРУКЦИИ)/;

function butunTartib(v: Katak): boolean {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0;
  return /^\d+$/.test(xom(v));
}
function ichkiTartib(v: Katak): boolean {
  if (typeof v === 'number') return Number.isFinite(v) && !Number.isInteger(v) && v > 0;
  return /^\d+\.\d+$/.test(xom(v));
}
function ol(row: readonly Katak[], i: number): Katak {
  return i >= 0 ? row[i] : null;
}
function matnYoki(row: readonly Katak[], i: number): string | null {
  const t = xom(ol(row, i));
  return t || null;
}

// ─── Rol ─────────────────────────────────────────────────────────────────────

function rolAniqla(nom: string, blok: SarlavhaBloki | null, rows: readonly Katak[][]): { rol: VaraqRoli; dalil: Dalil[] } {
  const n = kalit(nom);
  const sarlavha = blok ? blok.sarlavhalar.join(' | ') : '';
  const dalil: Dalil[] = [];
  const nomLrv = /(^|_)(LRV|БВ|ЛРВ|F5)/.test(n);
  const nomRes = /(^|_)(RES|БР|РС)(_A)?$/.test(n);
  if (nomLrv) dalil.push({ qoida: 'varaq_nomi', ishonch: 'orta', izoh: `nomi "${nom}" — LRV belgisi` });
  if (nomRes) dalil.push({ qoida: 'varaq_nomi', ishonch: 'orta', izoh: `nomi "${nom}" — RES belgisi` });

  if (/ДАЛЬНОСТ|ГРУЗООБОРОТ|Т ?\/? ?КМ/.test(sarlavha)) {
    return { rol: 'transport', dalil: [...dalil, { qoida: 'sarlavha', ishonch: 'yuqori', izoh: 'tn·km / dalnost ustunlari' }] };
  }
  if (/РАБОТ|ISH VA RESURS/.test(sarlavha)) {
    return { rol: 'lrv', dalil: [...dalil, { qoida: 'sarlavha', ishonch: 'yuqori', izoh: 'nom ustuni: ishlar va resurslar' }] };
  }
  if (/ЗАТРАТ|ОБЪЕКТОВ И СМЕТ/.test(sarlavha) || /СВОД|^ФОРМА$/.test(n)) {
    return { rol: 'svod', dalil: [...dalil, { qoida: 'sarlavha', ishonch: 'yuqori', izoh: 'svod: xarajat moddalari' }] };
  }
  if (blok && /КОЛ|MIQDOR/.test(sarlavha) && /ЦЕНА|СТОИМ|СУММА|NARX/.test(sarlavha)) {
    return { rol: 'res', dalil: [...dalil, { qoida: 'sarlavha', ishonch: nomRes || /РЕСУРС/.test(sarlavha) ? 'yuqori' : 'orta', izoh: 'nom + miqdor + narx ustunlari' }] };
  }
  const sonli = rows.reduce((acc, row) => acc + row.filter((v) => typeof v === 'number').length, 0);
  if (sonli >= 3) return { rol: 'erkin', dalil: [...dalil, { qoida: 'shakl', ishonch: 'orta', izoh: "sonlar bor, lekin ma'lum smeta shakli topilmadi" }] };
  return { rol: 'bosh', dalil };
}

// ─── Titul ───────────────────────────────────────────────────────────────────

interface Titul { qurilish?: TitulQism; obyekt?: TitulQism; lokal?: TitulQism; yigma: boolean }
interface TitulQism { xom: string; qator: number; belgi: string | null }

/** Katak matnining "PREFIKS:" dan keyingi qismi — asl satrdan kesib olinadi, o'zgartirilmaydi. */
function prefiksdanKeyin(t: string, prefiks: RegExp): string | null {
  const m = t.match(prefiks);
  if (!m || m.index == null) return null;
  const qolgan = t.slice(m.index + m[0].length).trim();
  return qolgan || null;
}

function engUzunMatn(row: readonly Katak[]): string {
  let eng = '';
  for (const v of row) {
    const t = xom(v);
    if (typeof v !== 'number' && t.length > eng.length) eng = t;
  }
  return eng;
}

function titulOqi(rows: readonly Katak[][], oxir: number): Titul {
  const t: Titul = { yigma: false };
  for (let r = 0; r < oxir; r++) {
    const row = rows[r] ?? [];
    for (const v of row) {
      const s = xom(v);
      if (!s) continue;
      const k = kalit(s);
      const q = prefiksdanKeyin(s, /НАИМЕНОВАНИЕ СТРОЙКИ\s*:/i) ?? prefiksdanKeyin(s, /QURILISH NOMI\s*:/i);
      if (q) t.qurilish = { xom: q, qator: r, belgi: null };
      const o = prefiksdanKeyin(s, /НАИМЕНОВАНИЕ ОБЪЕКТА\s*:/i) ?? prefiksdanKeyin(s, /OBYEKT NOMI\s*:/i);
      if (o) t.obyekt = { xom: o, qator: r, belgi: null };
      // "(наименование стройки)" / "(наименование работ …, наименование объекта)" —
      // nom yuqoridagi qatorda turadi (Faravon/TN shakli).
      if (/^\(НАИМЕНОВАНИЕ СТРОЙКИ\)$/.test(k) && r > 0) {
        const yuqori = engUzunMatn(rows[r - 1] ?? []);
        if (yuqori) t.qurilish = { xom: yuqori, qator: r - 1, belgi: null };
      }
      if (/^\(НАИМЕНОВАНИЕ РАБОТ/.test(k) && r > 0) {
        const yuqori = engUzunMatn(rows[r - 1] ?? []);
        if (yuqori) t.lokal = { xom: yuqori, qator: r - 1, belgi: t.lokal?.belgi ?? null };
      }
      if (/^(СВОДНАЯ|ОБЪЕКТНАЯ) ЛОКАЛЬНАЯ/.test(k)) {
        t.yigma = true;
        const keyingi = engUzunMatn(rows[r + 1] ?? []);
        const ob = keyingi ? prefiksdanKeyin(keyingi, /ПО ДАННЫМ ЛОКАЛЬНЫХ СМЕТ НА/i) : null;
        if (ob && /^ОБЪЕКТНАЯ/.test(k)) t.obyekt = { xom: ob, qator: r + 1, belgi: null };
      } else if (/^(ЛОКАЛЬНАЯ .*(СМЕТА|ВЕДОМОСТЬ)|LOKAL .*BAYONOTI)/.test(k)) {
        const raqam = k.match(/№\s*(\S+)/);
        const belgi = raqam ? `№ ${raqam[1]}` : null;
        const keyingi = engUzunMatn(rows[r + 1] ?? []);
        if (keyingi && !/^\(/.test(keyingi) && !t.lokal) {
          t.lokal = { xom: prefiksdanKeyin(keyingi, /^НА\s+/i) ?? keyingi, qator: r + 1, belgi };
        } else if (t.lokal) {
          t.lokal.belgi = belgi;
        } else if (belgi) {
          t.lokal = { xom: s, qator: r, belgi };
        }
      }
    }
  }
  return t;
}

// ─── Qatorlar ────────────────────────────────────────────────────────────────

export function varaqniTahlilQil(fayl: string, varaq: KirishVaraq, sarlavhaBoshId = 1): VaraqAnatomiyasi {
  const rows = varaq.rows;
  const blok = sarlavhaBlokiniTop(rows);
  const aniqlangan = rolAniqla(varaq.nom, blok, rows);
  let rol = aniqlangan.rol;
  const rolDalil = aniqlangan.dalil;
  const u: UstunXaritasi | null = blok ? ustunXaritasi(blok) : null;
  // ABC4 "БР" (resurs smeta) sarlavhasi "БВ" (vedomost) bilan bir xil — rolni
  // ma'lumot shakli hal qiladi: ichki "1.1" qatorlar yo'q va ma'lumot resurs
  // guruhi bilan boshlansa — bu resurs ro'yxati.
  if (rol === 'lrv' && u) {
    const malumot = rows.slice(u.malumotBoshi, u.malumotBoshi + 2000);
    const ichkiBor = malumot.some((row) => ichkiTartib(ol(row, u.tartib)));
    // Birinchi 5 ta to'liq qatordan biri resurs guruhi bo'lsa (oldida titul izohi bo'lishi mumkin).
    const boshlari = malumot.filter((row) => toliqUstunlar(row).length).slice(0, 5);
    const guruhBilan = boshlari.some((row) => VEDOMOST_BOSHI.test(kalit(row[toliqUstunlar(row)[0]])));
    // TN titul: "ВЕДОМОСТЬ ПОТРЕБНЫХ РЕСУРСОВ" — RES hujjatining o'z nomi
    // (Hermes/codex 7ed860f tahlilidan). Faqat ichki qatorlar yo'q bo'lsa.
    const titulMatn = rows.slice(0, u.sarlavhaQatori).flatMap((row) => row.map(kalit)).join(' ');
    const potrebnyh = /ВЕДОМОСТ.{0,30}ПОТРЕБН.{0,30}РЕСУРС/.test(titulMatn);
    if (!ichkiBor && (guruhBilan || potrebnyh)) {
      rol = 'res';
      rolDalil.push(potrebnyh
        ? { qoida: 'titul', ishonch: 'yuqori', izoh: 'titul: ведомость потребных ресурсов, ichki (1.1) qatorlar yo‘q' }
        : { qoida: 'malumot_shakli', ishonch: 'yuqori', izoh: "ichki (1.1) qatorlar yo'q, resurs guruhi bilan boshlanadi — resurs ro'yxati" });
    }
  }
  const manzil = (r: number, c?: number): Manzil => ({ fayl, varaq: varaq.nom, qator: r + 1, ...(c != null && c >= 0 ? { ustun: c + 1 } : {}) });
  // PTO qo'shgan/o'zgartirgan ustunlarga moslashish: hajm/narx/summa uchligi
  // ma'lumot bilan isbotlanadi (hajm × narx ≈ summa); tanilmagan ustunlar ro'yxati.
  let qoshimcha: VaraqAnatomiyasi['qoshimchaUstunlar'];
  if (u && blok && (rol === 'lrv' || rol === 'res')) {
    const band = new Set([u.tartib, u.shifr, u.nom, u.birlik, u.hajmBirlikka].filter((i) => i >= 0));
    const m = uchlikniMoslashtir(blok.sarlavhalar, rows.slice(u.malumotBoshi, u.malumotBoshi + 2000), { hajm: u.hajmLoyiha, narx: u.narx, summa: u.summa }, band);
    if (m.qoida === 'arifmetika') {
      u.hajmLoyiha = m.uchlik.hajm; u.narx = m.uchlik.narx; u.summa = m.uchlik.summa;
    }
    rolDalil.push({ qoida: `ustunlar:${m.qoida}`, ishonch: m.ishonch, izoh: m.izoh });
    qoshimcha = qoshimchaUstunlar(blok.sarlavhalar, new Set([...band, u.hajmLoyiha, u.narx, u.summa]));
  }
  const natija: VaraqAnatomiyasi = {
    fayl, varaq: varaq.nom, rol, rolDalil, ustunlar: u,
    titul: [], sarlavhalar: [], ishlar: [], vedomost: [], jamilar: [], review: [],
    ...(qoshimcha?.length ? { qoshimchaUstunlar: qoshimcha } : {}),
  };
  if (!u || !blok || (rol !== 'lrv' && rol !== 'res')) return natija;

  const titul = titulOqi(rows, blok.bosh);
  const iq = new IerarxiyaQuruvchi(sarlavhaBoshId);
  if (rol === 'lrv') {
    if (titul.obyekt) natija.titul.push(iq.ildizQosh(titul.obyekt.xom, 'obyekt', manzil(titul.obyekt.qator), 'titul: obyekt nomi'));
    if (titul.lokal && !titul.yigma) {
      const s = iq.ildizQosh(titul.lokal.xom, 'lokal', manzil(titul.lokal.qator), 'titul: lokal smeta nomi');
      s.belgi = titul.lokal.belgi;
      natija.titul.push(s);
    }
  }

  const review = (kod: string, izoh: string, r?: number) => natija.review.push({ kod, izoh, ...(r != null ? { manzil: manzil(r) } : {}) });
  let joriyIsh: Ish | null = null;
  let vedomostRejimi = rol === 'res';
  let guruh: string | null = null;

  const resursOl = (row: readonly Katak[], r: number, vedomost: boolean): Resurs => ({
    tartib: xom(ol(row, u.tartib)),
    kod: matnYoki(row, u.shifr),
    xom: xom(ol(row, u.nom)),
    birlik: matnYoki(row, u.birlik),
    normaBirlikka: vedomost ? null : son(ol(row, u.hajmBirlikka)),
    hajm: vedomost ? (son(ol(row, u.hajmLoyiha)) ?? son(ol(row, u.hajmBirlikka))) : son(ol(row, u.hajmLoyiha)),
    narx: son(ol(row, u.narx)),
    summa: son(ol(row, u.summa)),
    guruh,
    manzil: manzil(r, u.nom),
  });

  /** Sarlavha shakli: tartib raqami yo'q, sonli miqdor/narx/summa yo'q, matn bilan boshlanadi. */
  const sarlavhaShakli = (row: readonly Katak[]): boolean => {
    const toliq = toliqUstunlar(row);
    if (!toliq.length || typeof row[toliq[0]] === 'number') return false;
    const bk = kalit(row[toliq[0]]);
    if (IMZO.test(bk) || JAMI.test(bk) || HISOB_QATORI.test(bk) || JAMI.test(kalit(ol(row, u.nom)))) return false;
    if (VEDOMOST_BOSHI.test(bk)) return false;
    const t = ol(row, u.tartib);
    if (butunTartib(t) || ichkiTartib(t)) return false;
    return ![u.hajmBirlikka, u.hajmLoyiha, u.narx, u.summa].some((c) => c >= 0 && son(row[c]) != null);
  };

  for (let r = u.malumotBoshi; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const toliq = toliqUstunlar(row);
    if (!toliq.length) continue;
    const birinchiMatn = xom(row[toliq[0]]);
    const bk = kalit(birinchiMatn);
    if (toliq.some((i) => IMZO.test(kalit(row[i])))) break;

    const nomK = kalit(ol(row, u.nom));
    if (JAMI.test(bk) || JAMI.test(nomK) || HISOB_QATORI.test(bk)) {
      const jamiMatn = JAMI.test(bk) ? birinchiMatn : xom(ol(row, u.nom));
      natija.jamilar.push({ xom: jamiMatn, qiymat: son(ol(row, u.summa)), manzil: manzil(r, u.summa) });
      if (!vedomostRejimi) iq.jamiKeldi(jamiMatn);
      continue;
    }

    const tartibKatak = ol(row, u.tartib);
    const nomBor = !bosh(ol(row, u.nom));

    if (vedomostRejimi) {
      if (butunTartib(tartibKatak) && nomBor) natija.vedomost.push(resursOl(row, r, true));
      else if (toliq.length <= 2 && !toliq.some((i) => son(row[i]) != null && typeof row[i] === 'number')) guruh = birinchiMatn;
      else review('noaniq_qator', `vedomost ichida tanilmagan qator: "${birinchiMatn.slice(0, 60)}"`, r);
      continue;
    }

    if (VEDOMOST_BOSHI.test(bk) && toliq.length <= 2 && natija.ishlar.length) {
      vedomostRejimi = true;
      guruh = /^ВЕДОМОСТЬ РЕСУРСОВ/.test(bk) ? null : birinchiMatn;
      joriyIsh = null;
      continue;
    }

    if (butunTartib(tartibKatak) && (nomBor || !bosh(ol(row, u.shifr)))) {
      iq.ishKeldi();
      const hajmL = son(ol(row, u.hajmLoyiha));
      joriyIsh = {
        tartib: xom(tartibKatak),
        shifr: matnYoki(row, u.shifr),
        xom: xom(ol(row, u.nom)),
        birlik: matnYoki(row, u.birlik),
        hajm: hajmL ?? son(ol(row, u.hajmBirlikka)),
        narx: son(ol(row, u.narx)),
        summa: son(ol(row, u.summa)),
        sarlavha: iq.joriy,
        manzil: manzil(r, u.nom),
        resurslar: [],
      };
      natija.ishlar.push(joriyIsh);
      continue;
    }

    if (ichkiTartib(tartibKatak) && nomBor) {
      iq.ishKeldi();
      if (!joriyIsh) { review('resurs_ishsiz', `resurs "${xom(tartibKatak)}" hech bir ishga tegishli emas`, r); continue; }
      joriyIsh.resurslar.push(resursOl(row, r, false));
      continue;
    }

    if (sarlavhaShakli(row)) {
      let k = r + 1;
      while (k < rows.length && !toliqUstunlar(rows[k] ?? []).length) k++;
      iq.sarlavha(birinchiMatn, manzil(r, toliq[0]), k < rows.length && sarlavhaShakli(rows[k] ?? []));
      if (toliq.length > 1) review('sarlavha_kop_katak', `sarlavha qatorida ${toliq.length} ta katak — faqat birinchisi olindi`, r);
      continue;
    }
    review('noaniq_qator', `tanilmagan qator: "${birinchiMatn.slice(0, 60)}"`, r);
  }

  natija.sarlavhalar = iq.sarlavhalar.filter((s) => !natija.titul.includes(s));
  if (rol === 'lrv' && !natija.ishlar.length) review('ish_yoq', 'LRV sarlavhasi bor, lekin birorta ish qatori topilmadi');
  return natija;
}
