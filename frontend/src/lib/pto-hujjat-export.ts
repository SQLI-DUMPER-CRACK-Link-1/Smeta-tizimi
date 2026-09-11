/**
 * pto-hujjat-export.ts — PTO hujjatlarini Excel VA PDF ko'rinishida chiqarish.
 *
 * Egasining talabi (2026-09-09): «nakopitelniy slichitelniy forma3
 * reyestrlari hujjatlari har birini ham exell ham pdf shaklida yuklash
 * mumkin bo'lsin ... hammasi uchun resursniy vedomost degan bloki yoki
 * alohida sahifada yig'ilishi kerak, bunda birinchi chel-chas keyin
 * mash-chas keyin material keyin oborudovaniya. hammasi shu hujjatda
 * qancha ishlatilgani summa yig'indilari birlik narxi va summasi
 * yig'ilgan turishi kerak. m29 da ham xuddi shunday.»
 *
 * Bu modul YANGI HISOB-KITOB QILMAYDI. Hujjat qatorlari chaqiruvchidan
 * tayyor keladi, resurs bloki esa `resurs-vedomost.ts` orqali
 * `t2_qator_holat` dan jamlanadi — ya'ni ikkinchi haqiqat manbai emas.
 *
 * Og'ir kutubxonalar (ExcelJS, jsPDF, kirill shrifti) FAQAT eksport
 * chaqirilganda dinamik yuklanadi.
 */
import { resursVedomostQur } from './resurs-vedomost';
import type { T2QatorHolat } from '../api/supabase';

export type PtoHujjatTuri = 'forma2' | 'nakopitelniy' | 'slichitelniy' | 'forma3' | 'm29';

export const PTO_HUJJAT_NOMI: Record<PtoHujjatTuri, string> = {
  forma2: 'ФОРМА-2 · Акт выполненных работ',
  nakopitelniy: 'НАКОПИТЕЛЬНАЯ ВЕДОМОСТЬ',
  slichitelniy: 'СЛИЧИТЕЛЬНАЯ ВЕДОМОСТЬ',
  forma3: 'ФОРМА-3 · Справка о стоимости',
  m29: 'М-29 · Отчёт о расходе материалов',
};

/** Har bir hujjat turi uchun raqamli ustun sarlavhalari. */
export const PTO_HUJJAT_USTUNLARI: Record<PtoHujjatTuri, string[]> = {
  forma2: ['Кол-во', 'Цена', 'Сумма'],
  nakopitelniy: ['Смета', 'Факт', 'Пред. Ф2', 'Тек. Ф2', 'Всего Ф2', 'Остаток'],
  slichitelniy: ['По смете', 'Фактически', 'Отклонение', 'Сумма откл.'],
  forma3: ['С начала строительства', 'За отчётный период'],
  m29: ['Норма', 'По норме', 'Фактически', 'Экономия / перерасход'],
};

export type PtoHujjatQator = {
  no: number;
  kod: string;
  nom: string;
  birlik: string;
  /** `PTO_HUJJAT_USTUNLARI[turi]` bilan bir xil tartibda va uzunlikda. */
  qiymatlar: (number | null)[];
  /** Bo'lim sarlavhasi bo'lsa — qalin, raqamsiz chiziladi. */
  bolim?: boolean;
  /** Ogohlantirish (masalan smetadan oshgan hajm). */
  ogohlantirish?: string;
};

export type PtoResursQator = {
  kat: string;
  kod: string;
  nom: string;
  birlik: string;
  hajm: number;
  narx: number | null;
  summa: number;
};

export type PtoHujjat = {
  turi: PtoHujjatTuri;
  obyekt: string;
  davr: string;
  raqam?: string;
  pudratchi?: string;
  buyurtmachi?: string;
  qatorlar: PtoHujjatQator[];
  /** ЧЕЛ→МАШ→МАТ→ОБ tartibida. `ptoResurslarniQur` bilan tayyorlanadi. */
  resurslar: PtoResursQator[];
  izoh?: string[];
};

const KATEGORIYA_TARTIB = ['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'БЕЗСКЛАД', 'М/К', 'КАБ'];
const KATEGORIYA_NOMI: Record<string, string> = {
  'ЧЕЛ': 'ЧЕЛ-ЧАС · Затраты труда рабочих',
  'МАШ': 'МАШ-ЧАС · Эксплуатация машин',
  'МАТ': 'МАТЕРИАЛЫ',
  'ОБ': 'ОБОРУДОВАНИЕ',
  'БЕЗСКЛАД': 'БЕЗ СКЛАД · Материалы без складского хранения',
  'КАБ': 'КАБЕЛЬНАЯ ПРОДУКЦИЯ',
  'М/К': 'МЕТАЛЛОКОНСТРУКЦИИ',
};

/**
 * `t2_qator_holat` dan resurs vedomostini quradi — kategoriya tartibi
 * `resurs-vedomost.ts` da belgilangan (ЧЕЛ→МАШ→МАТ→ОБ→КАБ→М/К).
 *
 * `manba`: `'f2'` — hujjatga olingan hajm/summa; `'smeta'` — smeta bo'yicha.
 */
export function ptoResurslarniQur(
  holatlar: readonly T2QatorHolat[],
  manba: 'f2' | 'smeta' = 'f2',
): PtoResursQator[] {
  return resursVedomostQur(holatlar)
    .map((r) => {
      const hajm = manba === 'f2' ? r.f2Hajm : r.smetaHajm;
      const summa = manba === 'f2' ? r.f2Summa : r.smetaSumma;
      return {
        kat: r.kat,
        kod: r.kod ?? '',
        nom: r.nom,
        birlik: r.birlik ?? '',
        hajm,
        // Birlik narxi hajmdan kelib chiqadi; hajm nol bo'lsa narx noma'lum
        // (`null`) — NOL EMAS (Konstitutsiya: NULL hech qachon 0 ga aylanmaydi).
        narx: hajm > 0 ? summa / hajm : null,
        summa,
      };
    })
    .filter((r) => r.hajm !== 0 || r.summa !== 0);
}

type ResursGuruh = { kat: string; nom: string; qatorlar: PtoResursQator[]; jami: number };

function resurslarniGuruhla(resurslar: readonly PtoResursQator[]): ResursGuruh[] {
  const guruh = new Map<string, PtoResursQator[]>();
  for (const r of resurslar) {
    const a = guruh.get(r.kat);
    if (a) a.push(r); else guruh.set(r.kat, [r]);
  }
  const tartib = (k: string) => {
    const i = KATEGORIYA_TARTIB.indexOf(k);
    return i < 0 ? KATEGORIYA_TARTIB.length : i;
  };
  return [...guruh.entries()]
    .sort(([a], [b]) => tartib(a) - tartib(b) || a.localeCompare(b))
    .map(([kat, qatorlar]) => ({
      kat,
      nom: KATEGORIYA_NOMI[kat] ?? kat,
      qatorlar,
      jami: qatorlar.reduce((s, r) => s + r.summa, 0),
    }));
}

export function ptoFaylNomi(h: PtoHujjat, kengaytma: 'xlsx' | 'pdf'): string {
  const tur = h.turi.toUpperCase();
  const obyekt = (h.obyekt || 'obyekt').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  const davr = (h.davr || '').replace(/[\\/:*?"<>|]/g, '-');
  return [tur, obyekt, davr].filter(Boolean).join('_') + '.' + kengaytma;
}

/* ═══════════════════ EXCEL ═══════════════════ */

const RANG = {
  sarlavha: 'FF1F4E79',
  sarlavhaMatn: 'FFFFFFFF',
  bolim: 'FFDDEBF7',
  kategoriya: 'FFFCE4D6',
  jami: 'FFFFF2CC',
  ogoh: 'FFFFC7CE',
};

export async function ptoHujjatXlsx(h: PtoHujjat): Promise<Uint8Array> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smeta tizimi (Tizim-2)';
  wb.created = new Date();

  const ustunlar = PTO_HUJJAT_USTUNLARI[h.turi];
  const ws = wb.addWorksheet('Hujjat', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const jamiUstun = 4 + ustunlar.length;

  // ── Sarlavha bloki ──
  const sarlavhaQatorlari: Array<[string, string]> = [
    [PTO_HUJJAT_NOMI[h.turi], ''],
    ['Объект:', h.obyekt],
    ['Период:', h.davr],
  ];
  if (h.raqam) sarlavhaQatorlari.push(['Документ №:', h.raqam]);
  if (h.buyurtmachi) sarlavhaQatorlari.push(['Заказчик:', h.buyurtmachi]);
  if (h.pudratchi) sarlavhaQatorlari.push(['Подрядчик:', h.pudratchi]);

  sarlavhaQatorlari.forEach(([yorliq, qiymat], i) => {
    const r = ws.addRow(i === 0 ? [yorliq] : [yorliq, qiymat]);
    if (i === 0) {
      ws.mergeCells(r.number, 1, r.number, jamiUstun);
      r.getCell(1).font = { bold: true, size: 14 };
      r.getCell(1).alignment = { horizontal: 'center' };
      r.height = 24;
    } else {
      r.getCell(1).font = { bold: true };
      ws.mergeCells(r.number, 2, r.number, jamiUstun);
    }
  });
  ws.addRow([]);

  // ── Jadval sarlavhasi ──
  const bosh = ws.addRow(['№', 'Код', 'Наименование', 'Ед.изм.', ...ustunlar]);
  bosh.eachCell((c) => {
    c.font = { bold: true, color: { argb: RANG.sarlavhaMatn } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.sarlavha } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
  bosh.height = 32;
  ws.views = [{ state: 'frozen', ySplit: bosh.number }];

  // ── Qatorlar ──
  const jami = ustunlar.map(() => 0);
  for (const q of h.qatorlar) {
    const r = ws.addRow([
      q.bolim ? '' : q.no, q.kod, q.nom, q.birlik,
      ...q.qiymatlar.map((v) => (v == null ? '' : v)),
    ]);
    r.eachCell({ includeEmpty: true }, (c, i) => {
      c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      if (i > 4) c.numFmt = '#,##0.00';
      if (i === 3) c.alignment = { wrapText: true, vertical: 'top' };
    });
    if (q.bolim) {
      r.eachCell({ includeEmpty: true }, (c) => {
        c.font = { bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.bolim } };
      });
    } else {
      q.qiymatlar.forEach((v, i) => { if (typeof v === 'number') jami[i] += v; });
    }
    if (q.ogohlantirish) {
      r.getCell(3).note = q.ogohlantirish;
      r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.ogoh } };
    }
  }

  // ── ЖАМИ ──
  const jamiQator = ws.addRow(['', '', 'ИТОГО', '', ...jami]);
  jamiQator.eachCell({ includeEmpty: true }, (c, i) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.jami } };
    c.border = { top: { style: 'double' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    if (i > 4) c.numFmt = '#,##0.00';
  });

  ws.columns = [
    { width: 6 }, { width: 16 }, { width: 52 }, { width: 10 },
    ...ustunlar.map(() => ({ width: 16 })),
  ];

  // ── Resurs vedomosti — ALOHIDA VARAQ ──
  ptoResursVaragi(wb, h);

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

function ptoResursVaragi(wb: import('exceljs').Workbook, h: PtoHujjat) {
  const ws = wb.addWorksheet('Ресурсная ведомость', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const bosh1 = ws.addRow(['РЕСУРСНАЯ ВЕДОМОСТЬ']);
  ws.mergeCells(bosh1.number, 1, bosh1.number, 6);
  bosh1.getCell(1).font = { bold: true, size: 14 };
  bosh1.getCell(1).alignment = { horizontal: 'center' };
  bosh1.height = 24;
  const bosh2 = ws.addRow([`${PTO_HUJJAT_NOMI[h.turi]} · ${h.obyekt} · ${h.davr}`]);
  ws.mergeCells(bosh2.number, 1, bosh2.number, 6);
  bosh2.getCell(1).alignment = { horizontal: 'center' };
  ws.addRow([]);

  const bosh = ws.addRow(['№', 'Код', 'Наименование ресурса', 'Ед.изм.', 'Количество', 'Цена за ед.', 'Сумма']);
  bosh.eachCell((c) => {
    c.font = { bold: true, color: { argb: RANG.sarlavhaMatn } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.sarlavha } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
  bosh.height = 30;
  ws.views = [{ state: 'frozen', ySplit: bosh.number }];

  let no = 0;
  let umumiy = 0;
  for (const g of resurslarniGuruhla(h.resurslar)) {
    const kr = ws.addRow([g.nom]);
    ws.mergeCells(kr.number, 1, kr.number, 6);
    kr.getCell(1).font = { bold: true };
    kr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.kategoriya } };
    kr.getCell(7).value = g.jami;
    kr.getCell(7).numFmt = '#,##0.00';
    kr.getCell(7).font = { bold: true };
    kr.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.kategoriya } };

    for (const r of g.qatorlar) {
      const row = ws.addRow([++no, r.kod, r.nom, r.birlik, r.hajm, r.narx ?? '', r.summa]);
      row.eachCell({ includeEmpty: true }, (c, i) => {
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        if (i >= 5) c.numFmt = i === 5 ? '#,##0.000' : '#,##0.00';
      });
    }
    umumiy += g.jami;
  }

  const jamiQator = ws.addRow(['', '', 'ВСЕГО ПО ВЕДОМОСТИ', '', '', '', umumiy]);
  jamiQator.eachCell({ includeEmpty: true }, (c, i) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RANG.jami } };
    c.border = { top: { style: 'double' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    if (i === 7) c.numFmt = '#,##0.00';
  });

  ws.columns = [{ width: 6 }, { width: 14 }, { width: 56 }, { width: 10 }, { width: 15 }, { width: 16 }, { width: 18 }];
}

/* ═══════════════════ PDF ═══════════════════ */

const son = (v: number | null | undefined, kasr = 2) =>
  v == null ? '' : v.toLocaleString('ru-RU', { minimumFractionDigits: kasr, maximumFractionDigits: kasr });

export async function ptoHujjatPdf(h: PtoHujjat): Promise<Uint8Array> {
  const [{ jsPDF }, autoTableMod, shrift] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('./pdf/pto-pdf-shrift'),
  ]);
  const autoTable = (autoTableMod as unknown as { default: (d: unknown, o: unknown) => void }).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  // Kirillcha uchun Unicode shrift — standart Helvetica buni ko'rsata olmaydi.
  doc.addFileToVFS('LiberationSans.ttf', shrift.PTO_PDF_SHRIFT_REGULAR);
  doc.addFont('LiberationSans.ttf', shrift.PTO_PDF_SHRIFT_NOMI, 'normal');
  doc.addFileToVFS('LiberationSans-Bold.ttf', shrift.PTO_PDF_SHRIFT_BOLD);
  doc.addFont('LiberationSans-Bold.ttf', shrift.PTO_PDF_SHRIFT_NOMI, 'bold');
  doc.setFont(shrift.PTO_PDF_SHRIFT_NOMI, 'normal');

  const chap = 10;
  let y = 14;
  doc.setFont(shrift.PTO_PDF_SHRIFT_NOMI, 'bold').setFontSize(13);
  doc.text(PTO_HUJJAT_NOMI[h.turi], doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
  y += 7;
  doc.setFont(shrift.PTO_PDF_SHRIFT_NOMI, 'normal').setFontSize(9);
  const bosh = [
    `Объект: ${h.obyekt}`,
    `Период: ${h.davr}`,
    h.raqam ? `Документ №: ${h.raqam}` : '',
    h.buyurtmachi ? `Заказчик: ${h.buyurtmachi}` : '',
    h.pudratchi ? `Подрядчик: ${h.pudratchi}` : '',
  ].filter(Boolean);
  for (const s of bosh) { doc.text(s, chap, y); y += 4.5; }
  y += 2;

  const ustunlar = PTO_HUJJAT_USTUNLARI[h.turi];
  const jami = ustunlar.map(() => 0);
  const tana = h.qatorlar.map((q) => {
    if (!q.bolim) q.qiymatlar.forEach((v, i) => { if (typeof v === 'number') jami[i] += v; });
    return [
      q.bolim ? '' : String(q.no), q.kod, q.nom + (q.ogohlantirish ? '  ⚠' : ''), q.birlik,
      ...q.qiymatlar.map((v) => son(v)),
    ];
  });
  tana.push(['', '', 'ИТОГО', '', ...jami.map((v) => son(v))]);

  autoTable(doc, {
    startY: y,
    head: [['№', 'Код', 'Наименование', 'Ед.изм.', ...ustunlar]],
    body: tana,
    styles: { font: shrift.PTO_PDF_SHRIFT_NOMI, fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { font: shrift.PTO_PDF_SHRIFT_NOMI, fontStyle: 'bold', fillColor: [31, 78, 121], textColor: 255, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'right' },
      1: { cellWidth: 24 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 16, halign: 'center' },
      ...Object.fromEntries(ustunlar.map((_, i) => [4 + i, { cellWidth: 24, halign: 'right' }])),
    },
    didParseCell: (d: { row: { index: number }; cell: { styles: Record<string, unknown> }; section: string }) => {
      if (d.section !== 'body') return;
      const q = h.qatorlar[d.row.index];
      if (d.row.index === tana.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [255, 242, 204];
      } else if (q?.bolim) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [221, 235, 247];
      } else if (q?.ogohlantirish) {
        d.cell.styles.fillColor = [255, 199, 206];
      }
    },
  });

  // ── Resurs vedomosti — YANGI SAHIFA ──
  doc.addPage();
  y = 14;
  doc.setFont(shrift.PTO_PDF_SHRIFT_NOMI, 'bold').setFontSize(13);
  doc.text('РЕСУРСНАЯ ВЕДОМОСТЬ', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
  y += 6;
  doc.setFont(shrift.PTO_PDF_SHRIFT_NOMI, 'normal').setFontSize(9);
  doc.text(`${h.obyekt} · ${h.davr}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
  y += 6;

  const rTana: string[][] = [];
  const kategoriyaQatorlari = new Set<number>();
  let no = 0;
  let umumiy = 0;
  for (const g of resurslarniGuruhla(h.resurslar)) {
    kategoriyaQatorlari.add(rTana.length);
    rTana.push(['', '', g.nom, '', '', '', son(g.jami)]);
    for (const r of g.qatorlar) {
      rTana.push([String(++no), r.kod, r.nom, r.birlik, son(r.hajm, 3), son(r.narx), son(r.summa)]);
    }
    umumiy += g.jami;
  }
  rTana.push(['', '', 'ВСЕГО ПО ВЕДОМОСТИ', '', '', '', son(umumiy)]);

  autoTable(doc, {
    startY: y,
    head: [['№', 'Код', 'Наименование ресурса', 'Ед.изм.', 'Количество', 'Цена за ед.', 'Сумма']],
    body: rTana,
    styles: { font: shrift.PTO_PDF_SHRIFT_NOMI, fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { font: shrift.PTO_PDF_SHRIFT_NOMI, fontStyle: 'bold', fillColor: [31, 78, 121], textColor: 255, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'right' }, 1: { cellWidth: 22 }, 2: { cellWidth: 'auto' },
      3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' }, 6: { cellWidth: 30, halign: 'right' },
    },
    didParseCell: (d: { row: { index: number }; cell: { styles: Record<string, unknown> }; section: string }) => {
      if (d.section !== 'body') return;
      if (d.row.index === rTana.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [255, 242, 204];
      } else if (kategoriyaQatorlari.has(d.row.index)) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [252, 228, 214];
      }
    },
  });

  // Sahifa raqamlari
  const jamiSahifa = doc.getNumberOfPages();
  for (let i = 1; i <= jamiSahifa; i++) {
    doc.setPage(i);
    doc.setFont(shrift.PTO_PDF_SHRIFT_NOMI, 'normal').setFontSize(8);
    doc.text(`${i} / ${jamiSahifa}`, doc.internal.pageSize.getWidth() - 12,
      doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

/** Brauzerda yuklab olishga majburlaydi. */
export function ptoHujjatYuklab(bytes: Uint8Array, faylNomi: string): void {
  const tur = faylNomi.endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([bytes as any], { type: tur });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = faylNomi;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
