import ExcelJS from 'exceljs';
import type { NakopitelniyQator } from '../api/t2-nakopitelniy';

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

const KOK_FON = 'FFD9E1F2';
const SARIQ_FON = 'FFFFF2CC';
const YASHIL_FON = 'FFE2EFDA';
const TOQ_YASHIL_FON = 'FFC6E0B4';
const KULRANG_FON = 'FFF2F2F2';

export async function generateF2AktTn(qatorlar: readonly NakopitelniyQator[], options: F2AktTnOptions): Promise<Uint8Array> {
  const { qatorlar: rows } = f2AktTnQatorlarQur(qatorlar);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smeta tizimi';
  const ws = wb.addWorksheet('F2');

  ws.addRow([]);
  const titleRow = ws.addRow(['АКТ ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (Ф-2)']);
  const objRow = ws.addRow([`Объект: ${options.obyektNom}`]);
  const sana = options.sana || new Date().toLocaleDateString('ru-RU');
  const perRow = ws.addRow([`За: ${options.davr}   (тузилди: ${sana})`]);
  ws.addRow([]);
  const hdr1 = ws.addRow(['№', 'ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И ЗАТРАТ', 'ЕД. ИЗМ.', 'КОЛИЧЕСТВО', '', 'СТОИМОСТЬ, СУМ', '']);
  const hdr2 = ws.addRow(['', '', '', '', 'на единицу', 'по проектным данным', 'на.ед.изм', 'общая']);
  const numRow = ws.addRow([1, 2, 3, 4, 5, 6, 7, 8]);

  const rzRows: number[] = []; const blRows: number[] = []; const itogoRows: number[] = []; let vsegoRow = 0;
  for (const r of rows) {
    const row = ws.addRow(r.cells as (string | number)[]);
    if (r.kind === 'rz') rzRows.push(row.number);
    else if (r.kind === 'bl') blRows.push(row.number);
    else if (r.kind === 'itogo') itogoRows.push(row.number);
    else if (r.kind === 'vsego') vsegoRow = row.number;
  }
  ws.addRow([]);
  ws.addRow(['', 'Сдал (Подрядчик): ____________________', '', '', '', 'Принял (Заказчик): ____________________', '', '']);

  /* ── Formatlash (haqiqiy akt ko'rinishi, T1 bilan bir xil) ── */
  [titleRow, objRow, perRow].forEach((r) => { ws.mergeCells(r.number, 1, r.number, 8); r.alignment = { horizontal: 'center' }; });
  titleRow.font = { bold: true, size: 14 };

  ws.mergeCells(hdr1.number, 5, hdr1.number, 6);
  ws.mergeCells(hdr1.number, 7, hdr1.number, 8);
  for (let c = 1; c <= 4; c++) ws.mergeCells(hdr1.number, c, hdr2.number, c);
  [hdr1, hdr2].forEach((r) => {
    r.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KOK_FON } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
  });
  numRow.eachCell((c) => {
    c.font = { italic: true, size: 9 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KULRANG_FON } };
    c.alignment = { horizontal: 'center' };
  });
  rzRows.forEach((rn) => {
    ws.mergeCells(rn, 1, rn, 8);
    const r = ws.getRow(rn);
    r.font = { bold: true };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SARIQ_FON } };
  });
  blRows.forEach((rn) => { ws.getRow(rn).font = { bold: true }; });
  itogoRows.forEach((rn) => {
    const r = ws.getRow(rn);
    r.font = { bold: true };
    r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YASHIL_FON } }; });
  });
  if (vsegoRow) {
    const r = ws.getRow(vsegoRow);
    r.font = { bold: true, size: 12 };
    r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOQ_YASHIL_FON } }; });
  }

  const lastDataRow = vsegoRow || numRow.number;
  for (let rn = hdr1.number; rn <= lastDataRow; rn++) {
    for (let cn = 1; cn <= 8; cn++) {
      ws.getCell(rn, cn).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
  }
  for (let rn = numRow.number + 1; rn <= lastDataRow; rn++) {
    for (let cn = 5; cn <= 8; cn++) {
      const cell = ws.getCell(rn, cn);
      if (typeof cell.value === 'number') cell.numFmt = '#,##0.###';
    }
  }

  ws.getColumn(9).width = 4;
  ws.getColumn(1).width = 5; ws.getColumn(2).width = 14; ws.getColumn(3).width = 55; ws.getColumn(4).width = 9;
  ws.getColumn(5).width = 12; ws.getColumn(6).width = 14; ws.getColumn(7).width = 14; ws.getColumn(8).width = 16;
  ws.views = [{ state: 'frozen', ySplit: numRow.number }];

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
