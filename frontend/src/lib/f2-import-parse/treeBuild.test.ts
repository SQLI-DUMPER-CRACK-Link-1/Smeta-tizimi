/**
 * Parity tests for the ported F2 file-parsing core, ported alongside
 * `treeBuild.ts` / `columnDetect.ts` from `apiF2FaylOqi` / `_f2UstunAniqla`
 * in `Smeta tizimi/30_Panel.js`. Fixtures are built directly from the header
 * layouts and business rules documented in the GAS source's own comments
 * (three known real-world templates, F-or-E volume rule, marker override,
 * totals/numbering-row skip, negative-volume retention, mat/ob-as-sibling) —
 * not invented data, but real, dated rules confirmed against the source.
 *
 * What this does NOT prove: parsing an actual uploaded .xlsx workbook byte
 * stream — that needs the owner's real F2 files (`_f2lab/README.md`), not
 * available in this repo. These tests only prove the tree-building/column-
 * detection LOGIC matches the GAS source once a 2D cell grid already exists.
 */
import { describe, expect, test } from 'vitest';
import { f2UstunAniqla } from './columnDetect';
import { f2FaylOqiCore } from './treeBuild';
import type { SheetGrid, F2ColumnConfig } from './types';

describe('f2UstunAniqla (column auto-detect parity)', () => {
  test('template 1 — standard LRV_PLUS-style header (kod=1,nom=2,bir=3,norma=4,obyom=5,narx=6,sum=7)', () => {
    const data: SheetGrid = [
      ['№', 'Шифр (обоснование)', 'Наименование', 'Ед.изм', 'Норма на единицу', 'Объем по проекту', 'Цена на.ед', 'Общая сумма'],
    ];
    const d = f2UstunAniqla(data);
    expect(d).toMatchObject({ kod: 1, nom: 2, bir: 3, norma: 4, obyom: 5, narx: 6, sum: 7, hdrRow: 0 });
  });

  test('template 3 — "ФОРМА" header, shifted one column right of the default (the historical off-by-one bug)', () => {
    const data: SheetGrid = [
      ['№', 'Шифр', 'Наименование', 'Единица измерения', 'Объем по смете', 'Норма на единицу', 'Объем по проекту', 'Цена на.ед', 'Общая сумма'],
    ];
    const d = f2UstunAniqla(data);
    expect(d).toMatchObject({ kod: 1, nom: 2, bir: 3, norma: 5, obyom: 6, narx: 7, sum: 8, hdrRow: 0 });
  });

  test('no header found within the first 60 rows — falls back to the hardcoded default mapping', () => {
    const data: SheetGrid = [['just', 'some', 'data'], ['no', 'header', 'here']];
    const d = f2UstunAniqla(data);
    expect(d).toMatchObject({ kod: 1, nom: 2, bir: 3, norma: 4, obyom: 5, narx: 6, sum: 7, hdrRow: -1 });
  });
});

const TEMPLATE1_COLS: F2ColumnConfig = { kod: 1, nom: 2, bir: 3, norma: 4, obyom: 5, narx: 6, sum: 7 };

describe('f2FaylOqiCore — preview mode (no colConfig)', () => {
  test('returns mode:"config" with the auto-detected columns and a row preview', () => {
    const data: SheetGrid = [
      ['№', 'Шифр (обоснование)', 'Наименование', 'Ед.изм', 'Норма на единицу', 'Объем по проекту', 'Цена на.ед', 'Общая сумма'],
      ['', 'К1', 'Кладка стен', 'М3', 10, '', '', ''],
    ];
    const r = f2FaylOqiCore(data);
    expect(r.ok).toBe(true);
    if (r.ok && 'mode' in r) {
      expect(r.mode).toBe('config');
      expect(r.cols).toMatchObject(TEMPLATE1_COLS);
      expect(r.hdrQator).toBe(1);
      expect(r.preview.length).toBeGreaterThan(0);
    } else {
      throw new Error('expected preview-mode result');
    }
  });
});

describe('f2FaylOqiCore — real production data (Amfiteatr F2 act, Февраль, read from Drive)', () => {
  // Rows transcribed verbatim (only re-typed from CSV, values unchanged) from
  // a real production F2 act — "Амфитеатр.xlsx", НАВОИЙ ШАХАР "ЯНГИ УЗБЕКИСТОН
  // БОГИ" object, СВОДНАЯ ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ, section
  // "СЕРДЕЧНИКИ,ПЕРЕМЫЧКИ,ПОЯСА (ЛИСТ КР-51)" — read via Google Drive. This
  // is the first real-world confirmation available to this port (the
  // _f2lab fixtures themselves are Windows-local and out of reach here):
  // it independently confirms the column layout (kod=1,nom=2,bir=3,
  // norma=4,obyom=5,narx=6,sum=7) AND the marker column (index 8, literal
  // "rz"/"bl"/"rs" strings) against a file this port never saw while being
  // written.
  test('real "rz" row: section title lives in column A (№№), not the name column — the aTxt/bTxt/cTxt fallback this was ported for', () => {
    const data: SheetGrid = [
      ['РАЗДЕЛ: СЕРДЕЧНИКИ,ПЕРЕМЫЧКИ,ПОЯСА (ЛИСТ КР-51)', '', '', '', '', '', '', '', 'rz'],
      // a bare rz with zero children is filtered from the final tree (matches
      // the GAS source's own "drop empty razdel" rule) — one real leaf row
      // keeps this test about the rz-naming fallback, not that filter.
      ['378', 'E6-1-26-4', 'УСТРОЙСТВО ЖЕЛЕЗОБЕТОННЫХ КОЛОНН', '100М3', 0.01, '', '', 719814.02, 'bl'],
    ];
    const r = f2FaylOqiCore(data, TEMPLATE1_COLS);
    if (!('tree' in r)) throw new Error('expected a tree result');
    expect(r.tree).toHaveLength(1);
    expect(r.tree[0].nom).toContain('СЕРДЕЧНИКИ');
  });

  test('real "bl" + "rs" pair (rows №378/№378.1): bl hajm from E (own quantity), rs child hajm from F (actual consumed quantity)', () => {
    const data: SheetGrid = [
      ['СЕРДЕЧНИКИ', '', '', '', '', '', '', '', 'rz'],
      ['378', 'E6-1-26-4', 'УСТРОЙСТВО ЖЕЛЕЗОБЕТОННЫХ КОЛОНН В ДЕРЕВЯННОЙ ОПАЛУБКЕ ВЫСОТОЙ ДО 4 М, ПЕРИМЕТРОМ ДО 2 М', '100М3', 0.01, '', '', 719814.02, 'bl'],
      ['378.1', '000001', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', 1569.40, 8.24, 24517.70, 202009.91, 'rs'],
      // real totals row from the same file — must still be skipped
      ['', '', 'ИТОГО ПРЯМЫЕ ЗАТРАТЫ', 'СУМ', '', '', 1740485218.98, '', ''],
    ];
    const r = f2FaylOqiCore(data, TEMPLATE1_COLS);
    if (!('tree' in r)) throw new Error('expected a tree result');
    const bl = r.tree[0].children?.[0];
    expect(bl?.kod).toBe('E6-1-26-4');
    expect(bl?.hajm).toBe(0.01); // marker='bl', F empty -> volume from E
    const rs = bl?.children?.[0];
    expect(rs?.kod).toBe('000001');
    expect(rs?.hajm).toBe(8.24); // marker='rs', F filled -> volume from F
    expect(rs?.summa).toBe(202009.91);
    // the real totals row never entered the tree
    const allNoms = [r.tree[0].nom, bl?.nom, rs?.nom];
    expect(allNoms).not.toContain('ИТОГО ПРЯМЫЕ ЗАТРАТЫ');
  });
});

describe('f2FaylOqiCore — tree build (colConfig given)', () => {
  test('rz auto-detected from an otherwise-empty row with text in the name column; bl/rs classified by the F-or-E rule; totals and numbering rows skipped; a standalone mat (nothing meaningful follows it) is a razdel sibling, not a bl child', () => {
    // NOTE ON FIXTURE DESIGN: the GAS source's own lookahead ("does the next
    // meaningful row have F filled?") means an F-empty row IMMEDIATELY
    // followed by an F-filled row is always classified 'bl', by design —
    // this is real, ported behavior, not a fixture mistake. So a genuine
    // 'mat' row in this heuristic (non-marker) path must be the last
    // meaningful row in its section, or followed only by other F-empty rows.
    const data: SheetGrid = [
      // 0: header (irrelevant once colConfig is given, but present as real files have one)
      ['№', 'Шифр (обоснование)', 'Наименование', 'Ед.изм', 'Норма на единицу', 'Объем по проекту', 'Цена на.ед', 'Общая сумма'],
      // 1: section — bir/E/F all empty, name column carries the section title
      ['', '', 'ФУНДАМЕНТЫ', '', '', '', '', ''],
      // 2: bl — E filled (=own hajm), F empty; next row has F filled -> classified 'bl'
      ['', 'Е8-1-1', 'Устройство ленточных фундаментов', 'М3', 5, '', 100, 500],
      // 3: rs child — F filled -> 'rs', hajm = F, norma = E
      ['', 'C124', 'ЦЕМЕНТ М400', 'Т', 0.5, 2.5, 40, 100],
      // 4: numbering row under a sub-header — both nom and bir are pure digits -> skipped
      ['', '', '2', '3', '', '', '', ''],
      // 5: totals row -> skipped
      ['', '', 'ИТОГО ПО РАЗДЕЛУ', '', '', '', '', 600],
      // 6: mat — F empty, LAST row (nothing follows) -> lookahead finds nothing -> 'mat', sibling of bl (not its child)
      ['', '', 'Материал резерва', 'ШТ', 3, '', 20, 60],
    ];

    const r = f2FaylOqiCore(data, TEMPLATE1_COLS);
    expect(r.ok).toBe(true);
    if (!('tree' in r)) throw new Error('expected a tree result');
    const tree = r.tree;

    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('rz');
    expect(tree[0].nom).toBe('ФУНДАМЕНТЫ');

    const children = tree[0].children ?? [];
    expect(children.map((c) => c.type)).toEqual(['bl', 'mat']); // mat is a RAZDEL sibling, not nested under bl

    const bl = children[0];
    expect(bl.nom).toBe('Устройство ленточных фундаментов');
    expect(bl.hajm).toBe(5); // fEmpty -> volume came from E, not F

    const blChildren = bl.children ?? [];
    expect(blChildren.map((c) => c.nom)).toEqual(['ЦЕМЕНТ М400']);
    expect(blChildren[0].hajm).toBe(2.5); // F filled -> volume = F

    const mat = children[1];
    expect(mat.nom).toBe('Материал резерва');
    expect(mat.hajm).toBe(3); // fEmpty -> volume from E

    // totals/numbering rows never made it into the tree at all
    const allNoms = [tree[0].nom, ...children.flatMap((c) => [c.nom, ...((c.children ?? []).map((g) => g.nom))])];
    expect(allNoms).not.toContain('ИТОГО ПО РАЗДЕЛУ');
    expect(allNoms).not.toContain('2');
  });

  test('negative volume (storno/recalculation row) is KEPT, not dropped as "empty"', () => {
    const data: SheetGrid = [
      ['', '', 'ФУНДАМЕНТЫ', '', '', '', '', ''],
      ['', 'C900', 'Демонтаж (сторно)', 'М3', 0, -5, 30, -150],
    ];
    const r = f2FaylOqiCore(data, TEMPLATE1_COLS);
    if (!('tree' in r)) throw new Error('expected a tree result');
    const leaf = r.tree[0].children?.[0];
    expect(leaf?.nom).toBe('Демонтаж (сторно)');
    expect(leaf?.hajm).toBe(-5);
  });

  test('marker column forces type directly, sidestepping the F/E lookahead — proves a mat row does NOT reset currentBl (a later marked rs still attaches to the earlier bl, not to mat)', () => {
    // All rows carry an explicit marker (column index 8), so every
    // classification here comes directly from the marker, not the
    // lookahead heuristic — this isolates the exact claim being tested.
    const data: SheetGrid = [
      ['', '', 'СТЕНЫ', '', '', '', '', '', 'rz'],
      ['', 'К1', 'Кладка стен', 'М3', 10, '', 50, 500, 'bl'],
      ['', '', 'Раствор (резерв)', 'М3', 1, '', 10, 10, 'mat'],
      ['', 'К2', 'Кирпич', 'ШТ', 1, 500, 2, 1000, 'rs'],
    ];
    const r = f2FaylOqiCore(data, TEMPLATE1_COLS);
    if (!('tree' in r)) throw new Error('expected a tree result');
    const children = r.tree[0].children ?? [];
    expect(children.map((c) => c.type)).toEqual(['bl', 'mat']); // mat is a sibling, not the bl's child
    const bl = children[0];
    // the 'rs' landed inside the ORIGINAL bl's children, proving the
    // intervening 'mat' row never touched currentBl
    expect(bl.children?.map((c) => c.nom)).toEqual(['Кирпич']);
  });

  test('marker column (I / index 8) overrides the F/E heuristic entirely once >=3 marker rows are present', () => {
    const cols: F2ColumnConfig = { kod: 1, nom: 2, bir: 3, norma: 4, obyom: 5, narx: 6, sum: 7 };
    const data: SheetGrid = [
      ['', '', 'СТЕНЫ', '', '', '', '', '', 'rz'],
      ['', 'К1', 'Кладка стен', 'М3', 10, '', 50, 500, 'bl'],
      ['', 'К2', 'Кирпич', 'ШТ', 1, 500, 2, 1000, 'rs'],
      // F (obyom) is FILLED here — the heuristic alone would say 'rs' — but
      // the marker says 'ob' and must win.
      ['', 'К3', 'Насос', 'ШТ', 1, 2, 300, 600, 'ob'],
    ];
    const r = f2FaylOqiCore(data, cols);
    if (!('tree' in r)) throw new Error('expected a tree result');
    const children = r.tree[0].children ?? [];
    expect(children.map((c) => c.type)).toEqual(['bl', 'ob']); // 'ob' is a razdel sibling, not the bl's child
    expect(children[0].children?.map((c) => c.type)).toEqual(['rs']);
    expect(children[1].nom).toBe('Насос');
    expect(children[1].hajm).toBe(2); // marker='ob' still uses the F-or-E volume rule, only the TYPE was overridden
  });
});
