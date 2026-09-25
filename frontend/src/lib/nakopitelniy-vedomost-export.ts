/**
 * НАКОПИТЕЛЬНАЯ ВЕДОМОСТЬ ВЫПОЛНЕННЫХ РАБОТ — rasmiy hujjat (P3, H1–H9).
 *
 * Manba: `t2_nakopitelniy_v1` qatorlari (kanonik, tasdiqlangan F2 lar davr
 * kesimida). Bu yerda yangi biznes hisobi yo'q — hujjat qatorlari RPC
 * qiymatlari; hosila ustunlar (с начала строительства, остаток, можно
 * предъявить) Excelning o'zida RPC bilan AYNAN bir xil formula bilan:
 *   с начала = ранее + за период;   остаток = по смете − с начала;
 *   можно предъявить = факт − с начала.
 *
 * Qoidalar:
 *  - pul faqat barglarda (rs/mat/ob) yig'iladi — ish (bl) va bo'lim (rz)
 *    qatorlarining o'z `summa` si bolalarini takrorlaydi, ikki marta sanalmaydi;
 *  - smeta hajmi/summasi noma'lum (NULL) — остаток ham bo'sh (0 emas);
 *  - RPC ro'yxati qirqilgan bo'lsa (`truncated`) hujjat yasalmaydi — chala
 *    hujjat rasmiy hujjat bo'la olmaydi;
 *  - НДС (egasi qarori Q2, 2026-09-25): F2 resurs qatorlari НДС siz; НДС
 *    hujjat OXIRIDA bir marta — ВСЕГО ostida «НДС n %» va «ВСЕГО С НДС»
 *    (принято ранее / за период / с начала). Stavka sukuti 12 %, UI da
 *    o'zgartiriladi; `ndsFoiz` berilmasa НДС qatorlari chiqmaydi;
 *  - smeta nakrutka kaskadi (t2_obyekt_nakrutka) izohda ma'lumot sifatida;
 *  - Forma-3 yuridik jami qoidasi hal qilinmagan (FORMA3_RULE_UNRESOLVED) —
 *    hujjatga KS-3 jami chiqarilmaydi (ops/handoff/PTO_EGASI_QARORLARI_2026-09-25.md).
 */
import type { NakopitelniyQator, SmetaNakrutka } from '../api/t2-nakopitelniy';
import {
  RasmiyVaraq, hujjatFaylNomi, imzoTomonlari, rasmiyKitob, yaxlit2,
  type ImzoNomlar, type Qiymat, type RasmiyUstun,
} from './hujjat-yozuvchi';

export interface NakopitelniyVedomostExportOptions {
  obyektNom: string;
  /** Hisobot davri: "2026-09-01" yoki "2026-09". */
  davr: string;
  imzo?: ImzoNomlar;
  /** RPC ro'yxati qirqilganmi (t2_nakopitelniy_v2.truncated). */
  truncated?: boolean;
  /** НДС stavkasi, % (sukut UI da 12). null/undefined — НДС qatorlari yo'q. */
  ndsFoiz?: number | null;
  /** Smeta nakrutka kaskadi (RPC jami.smeta_nakrutka) — izohda ko'rsatiladi. */
  smetaNakrutka?: SmetaNakrutka | null;
}

/** НДС stavkasi sukuti (egasi qarori Q2): 12 %, o'zgartiriladi. */
export const NDS_SUKUT_FOIZ = 12;

export type NakopitelniyNds = { foiz: number; oldingi: number; joriy: number; jami: number };

/** НДС summalari — Excel `ROUND(x*stavka/100,2)` bilan aynan. */
export function nakopitelniyNds(j: Pick<NakopitelniyJamilar, 'oldingi' | 'joriy' | 'jami'>, foiz: number): NakopitelniyNds {
  const h = (x: number) => yaxlit2((x * foiz) / 100);
  return { foiz, oldingi: h(j.oldingi), joriy: h(j.joriy), jami: h(j.jami) };
}

export class HujjatToliqEmasXato extends Error {
  readonly sabab: string;
  constructor(sabab: string) { super(`HUJJAT_TOLIQ_EMAS: ${sabab}`); this.sabab = sabab; }
}

const OYLAR = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** "2026-09-01" → "сентябрь 2026 г." */
export function davrMatni(davr: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(davr || '');
  if (!m) return davr || '';
  return `${OYLAR[Number(m[2]) - 1] ?? m[2]} ${m[1]} г.`;
}

const BARG = new Set(['rs', 'mat', 'ob']);

const USTUNLAR: RasmiyUstun[] = [
  { sarlavha: '№ п/п', kenglik: 6, tur: 'tartib' },
  { sarlavha: 'Шифр, код', kenglik: 13, tur: 'kod' },
  { sarlavha: 'Наименование работ и затрат', kenglik: 44, tur: 'matn' },
  { sarlavha: 'Ед. изм.', kenglik: 8, tur: 'birlik' },
  { sarlavha: 'кол-во', kenglik: 11, tur: 'hajm', guruh: 'ПО СМЕТЕ' },
  { sarlavha: 'цена, сум', kenglik: 13, tur: 'narx', guruh: 'ПО СМЕТЕ' },
  { sarlavha: 'сумма, сум', kenglik: 15, tur: 'pul', guruh: 'ПО СМЕТЕ' },
  { sarlavha: 'Выполнено (факт), кол-во', kenglik: 11, tur: 'hajm' },
  { sarlavha: 'кол-во', kenglik: 11, tur: 'hajm', guruh: 'ПРИНЯТО РАНЕЕ' },
  { sarlavha: 'сумма, сум', kenglik: 15, tur: 'pul', guruh: 'ПРИНЯТО РАНЕЕ' },
  { sarlavha: 'кол-во', kenglik: 11, tur: 'hajm', guruh: 'ЗА ОТЧЕТНЫЙ ПЕРИОД' },
  { sarlavha: 'сумма, сум', kenglik: 15, tur: 'pul', guruh: 'ЗА ОТЧЕТНЫЙ ПЕРИОД' },
  { sarlavha: 'кол-во', kenglik: 11, tur: 'hajm', guruh: 'С НАЧАЛА СТРОИТЕЛЬСТВА' },
  { sarlavha: 'сумма, сум', kenglik: 15, tur: 'pul', guruh: 'С НАЧАЛА СТРОИТЕЛЬСТВА' },
  { sarlavha: 'кол-во', kenglik: 11, tur: 'hajm', guruh: 'ОСТАТОК ПО СМЕТЕ' },
  { sarlavha: 'сумма, сум', kenglik: 15, tur: 'pul', guruh: 'ОСТАТОК ПО СМЕТЕ' },
  { sarlavha: 'Можно предъявить (факт − принято), кол-во', kenglik: 13, tur: 'hajm' },
];
// Ustun harflari: A№ B kod C nom D birlik E smHajm F smNarx G smSumma H fakt
// I ranHajm J ranSumma K perHajm L perSumma M jamiHajm N jamiSumma O ostHajm P ostSumma Q mozhno.
const PUL = ['G', 'J', 'L', 'N', 'P'] as const;

export type NakopitelniyJamilar = { smeta: number | null; oldingi: number; joriy: number; jami: number; qoldiq: number | null };

/** Hujjat jamilari — barglar bo'yicha (UI shu sonni ko'rsatadi, Excel ВСЕГО bilan teng). */
export function nakopitelniyJamilar(qatorlar: readonly NakopitelniyQator[]): NakopitelniyJamilar {
  let smeta: number | null = 0, oldingi = 0, joriy = 0;
  for (const q of qatorlar) {
    if (!BARG.has(q.tur)) continue;
    smeta = smeta == null || q.smeta_summa == null ? null : smeta + q.smeta_summa;
    oldingi += q.oldingi_summa;
    joriy += q.joriy_summa;
  }
  const r = (x: number) => x;
  const jami = r(oldingi + joriy);
  return { smeta: smeta == null ? null : r(smeta), oldingi: r(oldingi), joriy: r(joriy), jami, qoldiq: smeta == null ? null : r(smeta - jami) };
}

/** Накопительная ведомость (.xlsx). */
export async function nakopitelniyVedomostExportXlsx(
  qatorlar: readonly NakopitelniyQator[],
  options: NakopitelniyVedomostExportOptions,
): Promise<Uint8Array> {
  return nakopitelniyVedomostHujjat(qatorlar, options).bytes;
}

export function nakopitelniyVedomostHujjat(
  qatorlar: readonly NakopitelniyQator[],
  o: NakopitelniyVedomostExportOptions,
): { bytes: Uint8Array; faylNomi: string; jamilar: NakopitelniyJamilar } {
  if (o.truncated) throw new HujjatToliqEmasXato('ro‘yxat server chegarasida qirqilgan');
  const v = new RasmiyVaraq({
    nom: 'Накопительная ведомость',
    sarlavha: 'НАКОПИТЕЛЬНАЯ ВЕДОМОСТЬ ВЫПОЛНЕННЫХ РАБОТ',
    ostSarlavha: [`за отчетный период: ${davrMatni(o.davr)} (учтены только утвержденные акты формы № 2)`],
    titul: [['Объект:', o.obyektNom], ['Заказчик:', o.imzo?.zakazchik], ['Подрядчик:', o.imzo?.pudratchi]],
    ustunlar: USTUNLAR,
    yonalish: 'landscape',
  });
  const bosh = v.malumotBoshi;
  // Qatorlar tartibi RPC tartibida; rz — bo'lim, keyingi rz gacha — uning bolalari.
  // Har rz oxirida ИТОГО; bl pul ustunlari — o'z bolalari (barglar) yig'indisi.
  type Rej = { tur: 'rz' | 'bl' | 'barg' | 'itogo' | 'vsego'; q?: NakopitelniyQator; bolalar: number[]; nom?: string };
  const reja: Rej[] = [];
  let rzItogo: Rej | null = null;
  let bl: Rej | null = null;
  const bargRows: number[] = [];
  let no = 0;
  const diqqat: Array<{ nom: string; sabab: string }> = [];
  const yop = () => { if (rzItogo) { if (rzItogo.bolalar.length) reja.push(rzItogo); else reja.pop(); } rzItogo = null; bl = null; };
  for (const q of qatorlar) {
    if (q.tur === 'rz') {
      yop();
      reja.push({ tur: 'rz', q, bolalar: [] });
      rzItogo = { tur: 'itogo', bolalar: [], nom: `ИТОГО ПО РАЗДЕЛУ: ${q.nom ?? ''}` };
      continue;
    }
    if (q.tur === 'bl') {
      bl = { tur: 'bl', q, bolalar: [] };
      reja.push(bl);
      continue;
    }
    const i = reja.length;
    reja.push({ tur: 'barg', q, bolalar: [] });
    bargRows.push(i);
    if (bl) bl.bolalar.push(i);
    if (rzItogo) rzItogo.bolalar.push(i);
    if (q.smeta_hajm == null || q.smeta_summa == null) diqqat.push({ nom: `${q.nom ?? ''}${q.birlik ? `, ${q.birlik}` : ''}`, sabab: 'нет объема или стоимости по смете — остаток не определен' });
    const mozhno = q.fakt_hajm - (q.oldingi_hajm + q.joriy_hajm);
    if (mozhno < -1e-9) diqqat.push({ nom: `${q.nom ?? ''}${q.birlik ? `, ${q.birlik}` : ''}`, sabab: `принято по актам больше, чем выполнено по факту (на ${fmt(-mozhno)})` });
  }
  yop();
  // bo'sh bl (bargsiz) — hujjatda qoladi (hajmlari bor), puli bo'sh.
  const j = nakopitelniyJamilar(qatorlar);
  const rowOf = (i: number) => bosh + i;
  const n = (x: number | null | undefined): Qiymat => (x == null ? null : x);
  reja.forEach((x, i) => {
    let r = 0;
    const q = x.q;
    if (x.tur === 'rz') r = v.bolim(q!.nom ?? '', { daraja: 0 });
    else if (x.tur === 'barg' || x.tur === 'bl') {
      const barg = x.tur === 'barg';
      const tartib = barg ? '' : String(++no);
      const sum = (c: string) => (x.bolalar.length ? { f: `SUM(${x.bolalar.map((k) => `${c}${rowOf(k)}`).join(',')})`, v: (x.bolalar.reduce((s, k) => s + (pulOf(reja[k].q!, c) ?? 0), 0)) } : null);
      r = v.qator(barg ? 'oddiy' : 'ish', (rr) => [
        barg ? tartib : tartib, q!.kod ?? '', q!.nom ?? '', q!.birlik ?? '',
        n(q!.smeta_hajm), barg ? n(q!.smeta_narx) : null,
        barg ? n(q!.smeta_summa) : (x.bolalar.some((k) => reja[k].q!.smeta_summa == null) ? null : sum('G')),
        q!.fakt_hajm,
        q!.oldingi_hajm, barg ? q!.oldingi_summa : sum('J'),
        q!.joriy_hajm, barg ? q!.joriy_summa : sum('L'),
        { f: `I${rr}+K${rr}`, v: q!.oldingi_hajm + q!.joriy_hajm },
        barg ? { f: `J${rr}+L${rr}`, v: q!.oldingi_summa + q!.joriy_summa } : sum('N'),
        { f: `IF(E${rr}="","",E${rr}-M${rr})`, v: q!.smeta_hajm == null ? '' : q!.smeta_hajm - (q!.oldingi_hajm + q!.joriy_hajm) },
        barg || x.bolalar.length ? { f: `IF(G${rr}="","",G${rr}-N${rr})`, v: pulOstatok(x, reja) } : null,
        { f: `H${rr}-M${rr}`, v: q!.fakt_hajm - (q!.oldingi_hajm + q!.joriy_hajm) },
      ], { daraja: barg ? 2 : 1 });
    } else {
      r = v.qator('jami', (rr) => {
        const cells: Qiymat[] = Array(USTUNLAR.length).fill(null);
        cells[2] = x.nom;
        for (const c of PUL) {
          const col = c.charCodeAt(0) - 65;
          if (c === 'P') { cells[col] = { f: `IF(G${rr}="","",G${rr}-N${rr})`, v: bolimOstatok(x, reja) }; continue; }
          const nomalum = c === 'G' && x.bolalar.some((k) => reja[k].q!.smeta_summa == null);
          cells[col] = nomalum ? { f: `IF(COUNTBLANK(${x.bolalar.map((k) => `G${rowOf(k)}`).join(',')})>0,"",${`SUM(${x.bolalar.map((k) => `G${rowOf(k)}`).join(',')})`})`, v: '' }
            : { f: `SUM(${x.bolalar.map((k) => `${c}${rowOf(k)}`).join(',')})`, v: (x.bolalar.reduce((s, k) => s + (pulOf(reja[k].q!, c) ?? 0), 0)) };
        }
        return cells;
      }, { daraja: 0 });
    }
    if (r !== rowOf(i)) throw new Error('NAKOPITELNIY_QATOR_SILJIDI');
  });
  const stavka = o.ndsFoiz != null && Number.isFinite(o.ndsFoiz) && o.ndsFoiz >= 0 ? o.ndsFoiz : null;
  if (bargRows.length) {
    const vsegoRow = v.qator('vsego', (rr) => {
      const cells: Qiymat[] = Array(USTUNLAR.length).fill(null);
      cells[2] = stavka != null ? 'ВСЕГО ПО ОБЪЕКТУ (без НДС)' : 'ВСЕГО ПО ОБЪЕКТУ';
      const itogolar = reja.map((x, i) => (x.tur === 'itogo' ? i : -1)).filter((i) => i >= 0);
      // Bo'limsiz barglar ham ВСЕГО ga kiradi.
      const bolimsiz = bargRows.filter((i) => !reja.some((x) => x.tur === 'itogo' && x.bolalar.includes(i)));
      const manba = [...itogolar, ...bolimsiz];
      const ref = (c: string) => manba.map((i) => `${c}${rowOf(i)}`).join(',');
      cells[6] = j.smeta == null ? { f: `IF(COUNTBLANK(${ref('G')})>0,"",SUM(${ref('G')}))`, v: '' } : { f: `SUM(${ref('G')})`, v: j.smeta };
      cells[9] = { f: `SUM(${ref('J')})`, v: j.oldingi };
      cells[11] = { f: `SUM(${ref('L')})`, v: j.joriy };
      cells[13] = { f: `SUM(${ref('N')})`, v: j.jami };
      cells[15] = { f: `IF(G${rr}="","",G${rr}-N${rr})`, v: j.qoldiq ?? '' };
      return cells;
    });
    if (stavka != null) {
      // НДС — bir marta, hujjat oxirida; faqat akt (F2) summalari ustunlarida.
      const nds = nakopitelniyNds(j, stavka);
      const st = String(stavka).replace('.', ',');
      const ndsRow = v.qator('jami', () => {
        const cells: Qiymat[] = Array(USTUNLAR.length).fill(null);
        cells[2] = `НДС ${st} %`;
        cells[9] = { f: `ROUND(J${vsegoRow}*${stavka}/100,2)`, v: nds.oldingi };
        cells[11] = { f: `ROUND(L${vsegoRow}*${stavka}/100,2)`, v: nds.joriy };
        cells[13] = { f: `ROUND(N${vsegoRow}*${stavka}/100,2)`, v: nds.jami };
        return cells;
      });
      v.qator('vsego', () => {
        const cells: Qiymat[] = Array(USTUNLAR.length).fill(null);
        cells[2] = 'ВСЕГО С НДС';
        cells[9] = { f: `J${vsegoRow}+J${ndsRow}`, v: j.oldingi + nds.oldingi };
        cells[11] = { f: `L${vsegoRow}+L${ndsRow}`, v: j.joriy + nds.joriy };
        cells[13] = { f: `N${vsegoRow}+N${ndsRow}`, v: j.jami + nds.jami };
        return cells;
      });
    }
  }
  v.bosh();
  v.izoh('Графы «Принято ранее», «За отчетный период» и «С начала строительства» — по утвержденным актам формы № 2. «Можно предъявить» = выполнено по факту − принято с начала строительства. Суммы по разделам подводятся по ресурсам (материалам, труду, машинам, оборудованию).');
  v.izoh(stavka != null
    ? `Стоимость работ по ресурсам указана без НДС; НДС ${String(stavka).replace('.', ',')} % начислен один раз на итог по объекту.`
    : 'Стоимость работ по ресурсам указана без НДС; НДС в ведомости не начислен.');
  const sn = o.smetaNakrutka;
  if (sn) {
    v.izoh(`Сметная стоимость объекта: прямые затраты ${fmt2(sn.pryamye)} сум; с накладными расходами и прочими затратами (без НДС) ${fmt2(sn.itogo4)} сум; НДС${sn.nds_foiz != null ? ` ${String(sn.nds_foiz).replace('.', ',')} %` : ''} ${fmt2(sn.nds)} сум; всего с НДС ${fmt2(sn.vsego)} сум.`);
  }
  v.diqqat(diqqat);
  v.imzo(imzoTomonlari(['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'СОСТАВИЛ'], o.imzo));
  const { bytes } = rasmiyKitob([v]);
  return { bytes, faylNomi: hujjatFaylNomi({ obyekt: o.obyektNom, hujjat: 'НАКОПИТЕЛЬНАЯ_ВЕДОМОСТЬ', davr: o.davr.slice(0, 7) }), jamilar: j };
}

function pulOf(q: NakopitelniyQator, c: string): number | null {
  switch (c) {
    case 'G': return q.smeta_summa;
    case 'J': return q.oldingi_summa;
    case 'L': return q.joriy_summa;
    case 'N': return q.oldingi_summa + q.joriy_summa;
    default: return null;
  }
}

type RejX = { tur: string; q?: NakopitelniyQator; bolalar: number[] };
function pulOstatok(x: RejX, reja: readonly RejX[]): number | string {
  if (x.tur === 'barg') return x.q!.smeta_summa == null ? '' : x.q!.smeta_summa - (x.q!.oldingi_summa + x.q!.joriy_summa);
  return bolimOstatok(x, reja);
}
function bolimOstatok(x: RejX, reja: readonly RejX[]): number | string {
  if (x.bolalar.some((k) => reja[k].q!.smeta_summa == null)) return '';
  const g = (x.bolalar.reduce((s, k) => s + (reja[k].q!.smeta_summa ?? 0), 0));
  const nn = (x.bolalar.reduce((s, k) => s + reja[k].q!.oldingi_summa + reja[k].q!.joriy_summa, 0));
  return g - nn;
}

function fmt2(x: number): string {
  return x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt(x: number): string {
  return x.toLocaleString('ru-RU', { maximumFractionDigits: 3 });
}
