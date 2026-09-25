import type { NakopitelniyQator } from '../api/t2-nakopitelniy';
import { RasmiyVaraq, bugunSana, sumRefs, hujjatFaylNomi, imzoTomonlari, rasmiyKitob, yaxlit2, type ImzoNomlar, type RasmiyUstun } from './hujjat-yozuvchi';
import { HujjatToliqEmasXato, davrMatni } from './nakopitelniy-vedomost-export';

/**
 * f2-akt-tn-export.ts — rasmiy "АКТ ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (Ф-2)" hujjati,
 * T1 GAS'ning apiF2TayyorHujjatYarat (Smeta tizimi/30_Panel.js) porti.
 *
 * NIMA UCHUN alohida, `forma2-export.ts`dan farqli: o'sha eksport oddiy
 * yassi jadval (T/r, Ishlar nomi, Birlik, ...) -- bu esa PTO mijoz/bankka
 * topshiradigan HAQIQIY TN qurilish akt shakli: titul blok, 2 qatorli
 * sarlavha (КОЛИЧЕСТВО: на единицу/по проектным данным; СТОИМОСТЬ: на
 * ед.изм/общая), РАЗДЕЛ->ISH->resurs ierarxiyasi, har ISH ostidagi
 * resurslar uchun НОРМА (=resurs joriy hajmi / ish qoldiq hajmi),
 * ИТОГО ПО РАЗДЕЛУ, ВСЕГО ПО АКТУ, imzo bloki. T1'da bu format
 * foydalanuvchi shikoyatidan keyin ("hujjat formati na TN qurilishga na
 * ABC formatiga o'xshamaydi") ANIQ tuzatilgan edi -- ustun joylashuvi
 * shu tarixiy, tasdiqlangan shaklga so'zma-so'z mos: masalan ISH
 * qatorining O'Z hajmi ham "на единицу" (E) ustuniga tushadi (F emas) --
 * bu chalkash ko'rinsa-da, real qog'oz TN Akt-2 shaklining o'ziga xos
 * konvensiyasi, "to'g'irlanmaydi".
 *
 * Manba: faqat t2_nakopitelniy_v1'ning JORIY davr (joriy_hajm/joriy_summa)
 * ustunlari -- bu allaqachon tasdiqlangan F2 qiymatlari, bu yerda HECH
 * NARSA qayta hisoblanmaydi yoki taxmin qilinmaydi. Yangi backend chaqiruv
 * shart emas: NakopitelniyVedomost sahifasi allaqachon shu massivni oladi.
 */

export interface F2AktTnOptions {
  obyektNom: string;
  davr: string;
  sana?: string;
}

/** Bitta hujjat qatori -- ExcelJS'siz sinaladigan, "toza" ma'lumot shakli.
 *  `cells` A..H ustunlariga to'g'ridan-to'g'ri mos (T1'ning `_push` massivi
 *  bilan bir xil indekslash: 0=№,1=ШИФР,2=НАИМЕНОВАНИЕ,3=ЕД.ИЗМ,
 *  4=на единицу,5=по проектным данным,6=на.ед.изм,7=общая). */
export type F2AktTnQator =
  | { kind: 'rz'; cells: [string] }
  | { kind: 'bl'; cells: [number, string, string, string, number | '', '', '', number] }
  | { kind: 'chiziq_bl'; cells: ['', string, string, string, number | '', number, number, number] }
  | { kind: 'chiziq_mustaqil'; cells: [number, string, string, string, number, '', number, number] }
  | { kind: 'itogo'; cells: ['', '', string, '', '', '', '', number] }
  | { kind: 'vsego'; cells: ['', '', string, '', '', '', '', number] };

function son(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Joriy davrda haqiqatan harakat bo'lgan qatorlarni aniqlaydi -- 0/0
 *  qatorlar hujjatga chiqmaydi (bu akt faqat SHU davr uchun). Manfiy
 *  (сторно/tuzatish) qatorlar ham kiradi -- faqat aniq nol chetlanadi. */
function faolmi(q: NakopitelniyQator): boolean {
  return q.joriy_hajm !== 0 || q.joriy_summa !== 0;
}

type MustaqilChiziq = { kod: string; nom: string; bir: string; hajm: number; narx: number; summa: number };
type BlGuruh = { kod: string; nom: string; bir: string; blHajm: number; blSumma: number; bolalar: MustaqilChiziq[] };
type Blok = { turi: 'bl'; bl: BlGuruh } | { turi: 'mustaqil'; chiziq: MustaqilChiziq };
type RzChelak = { nom: string; bloklar: Blok[] };

/**
 * Pure guruhlash + qator qurish -- ExcelJS chaqirilmaydi, shuning uchun
 * to'liq unit-test qilinadi. `t2_nakopitelniy_v1`ning o'zi kabi FLAT,
 * tartib bo'yicha buyurtmalangan ro'yxatni oladi: rz -> uning bl'lari ->
 * har bl'ning rs/mat/ob bolalari (T1'ning o'zi ham xuddi shunday --
 * parent_id emas, KETMA-KETLIK orqali guruhlaydi).
 */
export function f2AktTnQatorlarQur(qatorlar: readonly NakopitelniyQator[]): {
  qatorlar: F2AktTnQator[]; jamiSumma: number; qatorSoni: number;
} {
  const chelaklar: RzChelak[] = [];
  let joriyRz: RzChelak | null = null;
  let joriyBl: BlGuruh | null = null;

  for (const q of qatorlar) {
    if (q.tur === 'rz') {
      joriyRz = { nom: q.nom || '', bloklar: [] };
      chelaklar.push(joriyRz);
      joriyBl = null;
      continue;
    }
    if (!joriyRz) continue; // himoya -- ma'lumot har doim rz bilan boshlanadi
    if (q.tur === 'bl') {
      /* T1'ning "F2MUM" (o'sha paytdagi qoldiq) o'rniga -- doim TAZA,
         backend hisoblagan qiymat: smeta hajmi minus shu davrgacha
         tasdiqlangan (oldingi) hajm. */
      joriyBl = { kod: q.kod || '', nom: q.nom || '', bir: q.birlik || '', blHajm: Math.max(0, son(q.smeta_hajm) - son(q.oldingi_hajm)), blSumma: 0, bolalar: [] };
      joriyRz.bloklar.push({ turi: 'bl', bl: joriyBl });
      continue;
    }
    // rs / mat / ob
    if (!faolmi(q)) continue;
    const hajm = q.joriy_hajm;
    const narx = hajm !== 0 ? Math.round((q.joriy_summa / hajm) * 100) / 100 : 0;
    const chiziq: MustaqilChiziq = { kod: q.kod || '', nom: q.nom || '', bir: q.birlik || '', hajm, narx, summa: q.joriy_summa };
    if (joriyBl) {
      joriyBl.bolalar.push(chiziq);
      joriyBl.blSumma += q.joriy_summa;
    } else {
      joriyRz.bloklar.push({ turi: 'mustaqil', chiziq });
    }
  }

  const out: F2AktTnQator[] = [];
  let no = 0;
  let jamiSumma = 0;
  for (const rz of chelaklar) {
    const faolBloklar = rz.bloklar.filter((b) => b.turi === 'mustaqil' || b.bl.bolalar.length > 0);
    if (!faolBloklar.length) continue;
    out.push({ kind: 'rz', cells: [rz.nom] });
    let rzSumma = 0;
    for (const blok of faolBloklar) {
      if (blok.turi === 'bl') {
        no++;
        out.push({ kind: 'bl', cells: [no, blok.bl.kod, blok.bl.nom, blok.bl.bir, blok.bl.blHajm > 0 ? blok.bl.blHajm : '', '', '', blok.bl.blSumma] });
        rzSumma += blok.bl.blSumma;
        for (const bola of blok.bl.bolalar) {
          const norma = blok.bl.blHajm > 0 && bola.hajm > 0 ? bola.hajm / blok.bl.blHajm : '';
          out.push({ kind: 'chiziq_bl', cells: ['', bola.kod, bola.nom, bola.bir, norma, bola.hajm, bola.narx, bola.summa] });
        }
      } else {
        no++;
        out.push({ kind: 'chiziq_mustaqil', cells: [no, blok.chiziq.kod, blok.chiziq.nom, blok.chiziq.bir, blok.chiziq.hajm, '', blok.chiziq.narx, blok.chiziq.summa] });
        rzSumma += blok.chiziq.summa;
      }
    }
    out.push({ kind: 'itogo', cells: ['', '', 'ИТОГО ПО РАЗДЕЛУ:', '', '', '', '', rzSumma] });
    jamiSumma += rzSumma;
  }
  if (out.length) out.push({ kind: 'vsego', cells: ['', '', 'ВСЕГО ПО АКТУ:', '', '', '', '', jamiSumma] });
  return { qatorlar: out, jamiSumma, qatorSoni: no };
}

/**
 * АКТ ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (ФОРМА № 2) — rasmiy hujjat (H1–H9).
 *
 * Jadval shakli T1 da tasdiqlangan TN Akt-2 shakli bilan aynan (8 ustun,
 * КОЛИЧЕСТВО: на единицу / по проектным данным; СТОИМОСТЬ: на ед. изм. /
 * общая). Summa — tasdiqlangan F2 summasi (manba haqiqati, qayta
 * hisoblanmaydi); ish va bo'lim jamilari, ВСЕГО — tirik SUM formulalari.
 * НДС: stavka berilsa — ROUND(ВСЕГО × stavka / 100; 2) va ВСЕГО С НДС;
 * berilmasa — НДС va ВСЕГО С НДС bo'sh, hujjatda ochiq ogohlantirish (H7).
 */
export type F2AktHujjatOpsiya = F2AktTnOptions & {
  imzo?: ImzoNomlar;
  /** Shartnoma raqami va sanasi (bo'sh — chiziq). */
  shartnoma?: string | null;
  /** НДС stavkasi, % (masalan 12). null/undefined — ko'rsatilmagan. */
  ndsFoiz?: number | null;
  truncated?: boolean;
};

const F2_USTUNLAR: RasmiyUstun[] = [
  { sarlavha: '№ п/п', kenglik: 6, tur: 'tartib' },
  { sarlavha: 'Шифр', kenglik: 14, tur: 'kod' },
  { sarlavha: 'Наименование работ и затрат', kenglik: 55, tur: 'matn' },
  { sarlavha: 'Ед. изм.', kenglik: 9, tur: 'birlik' },
  { sarlavha: 'на единицу', kenglik: 12, tur: 'norma', guruh: 'КОЛИЧЕСТВО' },
  { sarlavha: 'по проектным данным', kenglik: 14, tur: 'hajm', guruh: 'КОЛИЧЕСТВО' },
  { sarlavha: 'на ед. изм.', kenglik: 15, tur: 'narx', guruh: 'СТОИМОСТЬ, сум' },
  { sarlavha: 'общая', kenglik: 17, tur: 'pul', guruh: 'СТОИМОСТЬ, сум' },
];

export function f2AktHujjat(qatorlar: readonly NakopitelniyQator[], o: F2AktHujjatOpsiya): { bytes: Uint8Array; faylNomi: string; jamiSumma: number; ndsSumma: number | null; jamiNds: number | null } {
  if (o.truncated) throw new HujjatToliqEmasXato('ro‘yxat server chegarasida qirqilgan');
  const { qatorlar: rows, jamiSumma } = f2AktTnQatorlarQur(qatorlar);
  if (!rows.length) throw new Error('F2_AKT_BOSH: joriy davrda tasdiqlangan F2 qatori yo‘q');
  const sana = o.sana || bugunSana();
  const v = new RasmiyVaraq({
    nom: 'Акт Ф-2',
    sarlavha: 'АКТ ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (ФОРМА № 2)',
    ostSarlavha: [`за отчетный период: ${davrMatni(o.davr)}`],
    titul: [
      ['Объект:', o.obyektNom], ['Заказчик:', o.imzo?.zakazchik], ['Подрядчик:', o.imzo?.pudratchi],
      ['Договор:', o.shartnoma], ['Дата составления:', sana.split('-').reverse().join('.')],
    ],
    ustunlar: F2_USTUNLAR,
    yonalish: 'portrait',
  });
  const bosh = v.malumotBoshi;
  // Har `F2AktTnQator` — aynan bitta hujjat qatori (qator raqami oldindan ma'lum).
  const rowOf = (i: number) => bosh + i;
  // Guruhlar: bl → uning chiziqlari; rz → bl/mustaqil qatorlari (itogo gacha).
  const blBolalari = new Map<number, number[]>();
  const itogoBolalari = new Map<number, number[]>();
  const itogolar: number[] = [];
  let joriyBl = -1;
  let rzQismi: number[] = [];
  rows.forEach((r, i) => {
    if (r.kind === 'rz') { rzQismi = []; joriyBl = -1; }
    else if (r.kind === 'bl') { joriyBl = i; blBolalari.set(i, []); rzQismi.push(i); }
    else if (r.kind === 'chiziq_bl') blBolalari.get(joriyBl)?.push(i);
    else if (r.kind === 'chiziq_mustaqil') { joriyBl = -1; rzQismi.push(i); }
    else if (r.kind === 'itogo') { itogoBolalari.set(i, rzQismi); itogolar.push(i); }
  });
  const sumH = (ids: number[]) => sumRefs('H', ids.map(rowOf));
  const summaOf = (i: number): number => {
    const r = rows[i];
    return r.kind === 'rz' ? 0 : r.cells[7] as number;
  };
  rows.forEach((r, i) => {
    let n = 0;
    if (r.kind === 'rz') n = v.bolim(r.cells[0], { daraja: 0 });
    else if (r.kind === 'bl') {
      const kids = blBolalari.get(i) ?? [];
      n = v.qator('ish', [r.cells[0], r.cells[1], r.cells[2], r.cells[3], r.cells[4] === '' ? null : r.cells[4], null, null,
        { f: sumH(kids), v: kids.reduce((s, k) => s + summaOf(k), 0) }], { daraja: 1 });
    } else if (r.kind === 'chiziq_bl') {
      const blRow = rowOf([...blBolalari.entries()].find(([, k]) => k.includes(i))![0]);
      n = v.qator('oddiy', (rr) => [null, r.cells[1], r.cells[2], r.cells[3],
        { f: `IF(AND(N(E${blRow})>0,N(F${rr})>0),F${rr}/E${blRow},"")`, v: r.cells[4] === '' ? '' : r.cells[4] },
        r.cells[5], r.cells[6], r.cells[7]], { daraja: 2 });
    } else if (r.kind === 'chiziq_mustaqil') {
      // T1 TN Akt-2 konvensiyasi: mustaqil qatorning o'z hajmi "на единицу" (E) ustunida.
      n = v.qator('oddiy', [r.cells[0], r.cells[1], r.cells[2], r.cells[3], r.cells[4], null, r.cells[6], r.cells[7]], { daraja: 1 });
    } else if (r.kind === 'itogo') {
      const kids = itogoBolalari.get(i) ?? [];
      n = v.qator('jami', [null, null, 'ИТОГО ПО РАЗДЕЛУ', null, null, null, null, { f: sumH(kids), v: kids.reduce((s, k) => s + summaOf(k), 0) }]);
    } else {
      n = v.qator('vsego', [null, null, 'ВСЕГО ПО АКТУ', null, null, null, null, { f: sumH(itogolar), v: jamiSumma }]);
    }
    if (n !== rowOf(i)) throw new Error('F2_AKT_QATOR_SILJIDI');
  });
  const vsegoRow = rowOf(rows.length - 1);
  const stavka = o.ndsFoiz != null && Number.isFinite(o.ndsFoiz) && o.ndsFoiz >= 0 ? o.ndsFoiz : null;
  const ndsSumma = stavka == null ? null : yaxlit2(jamiSumma * stavka / 100);
  const jamiNds = ndsSumma == null ? null : jamiSumma + ndsSumma;
  const ndsRow = v.qator('jami', [null, null, stavka == null ? 'НДС (ставка не указана)' : `НДС ${String(stavka).replace('.', ',')}%`, null, null, null, null,
    stavka == null ? null : { f: `ROUND(H${vsegoRow}*${stavka}/100,2)`, v: ndsSumma }]);
  v.qator('vsego', [null, null, 'ВСЕГО ПО АКТУ С НДС', null, null, null, null,
    stavka == null ? null : { f: `H${vsegoRow}+H${ndsRow}`, v: jamiNds }]);
  v.bosh();
  v.izoh('Стоимость по позициям — по утвержденным документам формы № 2 за отчетный период; в акт включены только позиции с объемом за период.');
  v.diqqat(stavka == null ? [{ nom: 'НДС', sabab: 'ставка НДС не указана — сумма НДС и итог с НДС не определены' }] : []);
  v.imzo(imzoTomonlari(['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'ТЕХНАДЗОР'], o.imzo));
  const { bytes } = rasmiyKitob([v]);
  return { bytes, faylNomi: hujjatFaylNomi({ obyekt: o.obyektNom, hujjat: 'АКТ_Ф-2', davr: o.davr.slice(0, 7) }), jamiSumma, ndsSumma, jamiNds };
}

/** Eski nom (NakopitelniyVedomost sahifasi) — endi rasmiy hujjat standartida. */
export async function generateF2AktTn(qatorlar: readonly NakopitelniyQator[], options: F2AktHujjatOpsiya): Promise<Uint8Array> {
  return f2AktHujjat(qatorlar, options).bytes;
}
