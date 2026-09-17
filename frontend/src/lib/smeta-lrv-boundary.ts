import type { SheetGrid } from './f2-import-parse';

/**
 * TN/ABC4 LRVda asosiy lokal vedomost yakunidan keyin RES ilovasi kelishi
 * mumkin. Bu ilova ish/hajm daraxti emas: uni LRVga qo'shish hajm va narxni
 * ikkinchi marta hisoblashga olib keladi. Shuning uchun chegarani hujjatning
 * o'zidagi qat'iy titul/yakun iboralaridan topamiz, satr raqamidan emas.
 */
export type LrvResAjratma = {
  lrvRows: SheetGrid;
  embeddedResRows: SheetGrid;
  /** Excelning odam ko'radigan satr raqami; chegara bo'lmasa `undefined`. */
  boundaryRow?: number;
  boundaryKind?: 'lrv_total' | 'res_title';
};

function upperRow(row: readonly unknown[]): string {
  return row.map((cell) => String(cell ?? '')).join(' ').toUpperCase().replace(/Ё/g, 'Е').replace(/\s+/g, ' ').trim();
}

const LRV_TITLE = /ЛОКАЛЬН.{0,40}(РЕСУРСН.{0,20})?(СМЕТ|ВЕДОМОСТ)/;
const LRV_TOTAL = /ИТОГО\s+(?:ПО\s+)?ЛОКАЛЬН.{0,60}(?:РЕСУРСН.{0,30})?(?:ВЕДОМОСТ|СМЕТ)/;
const RES_TITLE = /ВЕДОМОСТ.{0,30}ПОТРЕБН.{0,30}РЕСУРС/;

export function lrvVaIchkiResniAjrat(rows: SheetGrid | null | undefined): LrvResAjratma {
  const grid: SheetGrid = Array.isArray(rows) ? rows.map((row) => Array.isArray(row) ? row : []) : [];
  const hasLrvTitle = grid.slice(0, 25).some((row) => LRV_TITLE.test(upperRow(row)));
  for (let index = 0; index < grid.length; index++) {
    const line = upperRow(grid[index]);
    if (LRV_TOTAL.test(line)) {
      return {
        lrvRows: grid.slice(0, index + 1),
        embeddedResRows: grid.slice(index + 1),
        boundaryRow: index + 1,
        boundaryKind: 'lrv_total',
      };
    }
    /* Ayrim eksportlarda LRV yakuni alohida yozilmaydi, ammo keyin aniq
       RES titulidan yangi ilova boshlanadi. Bunday usul faqat LRV titulini
       ko'rgan varaqda va asosiy sarlavha zonasidan keyin ishlaydi. */
    if (hasLrvTitle && index >= 10 && RES_TITLE.test(line)) {
      return {
        lrvRows: grid.slice(0, index),
        embeddedResRows: grid.slice(index),
        boundaryRow: index + 1,
        boundaryKind: 'res_title',
      };
    }
  }
  return { lrvRows: grid, embeddedResRows: [] };
}
