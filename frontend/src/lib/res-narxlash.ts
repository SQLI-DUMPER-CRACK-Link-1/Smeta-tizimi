import type { SheetGrid, XlsxWorkbook } from './f2-import-parse';

/** `sourceRef` fayldagi satrning vaqtinchalik, faqat shu import uchun IDsi.
 * U Sheet qator raqami emas va kanonik identity ham emas: qo'lda tanlangan
 * RES satrini serverda aynan tekshirish uchun ishlatiladi. */
export type ResNarx = { sourceRef?: string; kod?: string; nom: string; birlik: string; narx: number };
export type ResUstunlar = { kod: number; nom: number; birlik: number; narx: number; sarlavha: number };
export type NarxsizQator = { id: number; tur: string | null; kod: string | null; nom: string | null; birlik: string | null; narx: number | null };
export type ResMoslashmaganSabab = 'QATOR_IDENTIYASI_YOQ' | 'RES_MANBASI_TOPILMADI' | 'RES_MANBA_ZIDDIYATI' | 'BIR_NECHTA_NARX_VARIANTI';
export type ResMoslashmagan = { id: number; tur: string; kod: string | null; nom: string | null; birlik: string | null; sabab: ResMoslashmaganSabab };
export type ResPreview = {
  narxsiz: number; mos: number; narxsizQoldi: number; ziddiyatliManba: number;
  qatorNarxlari: Map<number, number>; moslashmagan: ResMoslashmagan[];
  turBoyicha: Record<'rs' | 'mat' | 'ob', { narxsiz: number; mos: number }>;
};

const plain = (v: unknown) => String(v ?? '').trim();
const up = (v: unknown) => plain(v).toUpperCase();

/** PostgreSQL `t2_resurs_nom_kalit` bilan aynan bir semantika. */
export function resNomKalit(v: unknown): string {
  return up(v).replace(/Ё/g, 'Е').replace(/[^0-9A-ZА-Я]/g, '');
}

/** PostgreSQL `t2_resurs_birlik_kalit` bilan aynan bir semantika. */
export function resBirlikKalit(v: unknown): string {
  return up(v).replace(/³/g, '3').replace(/²/g, '2').replace(/[\s\p{P}]/gu, '');
}

function resKodKalit(v: unknown): string {
  return up(v).replace(/[\s\p{P}]/gu, '');
}

function son(v: unknown): number | undefined {
  const raw = plain(v).replace(/[\s ]/g, '').replace(',', '.');
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** RES sarlavhasi ikki yoki uch qatorga bo'linishini hisobga oladi. */
export function resUstunlariniAniqla(rows: SheetGrid): ResUstunlar | null {
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const row = rows[r] ?? [];
    let nom = -1; let birlik = -1; let kod = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = up(row[c]);
      if (nom < 0 && /НАИМЕНОВАНИЕ/.test(cell)) nom = c;
      if (birlik < 0 && /ЕД\.?\s*ИЗМ|ЕДИНИЦ/.test(cell)) birlik = c;
      if (kod < 0 && /ШИФР|КОД/.test(cell)) kod = c;
    }
    if (nom < 0 || birlik < 0) continue;
    let narx = -1;
    for (let rr = r; rr < Math.min(rows.length, r + 4); rr++) {
      const hdr = rows[rr] ?? [];
      for (let c = 0; c < hdr.length; c++) {
        if (/НА\.?\s*ЕД\.?\s*(ИЗМ|ИЗМЕР)|НА\s*ЕДИНИЦУ/.test(up(hdr[c]))) { narx = c; break; }
      }
      if (narx >= 0) break;
    }
    return narx >= 0 ? { kod, nom, birlik, narx, sarlavha: r } : null;
  }
  return null;
}

export function resQatorlariniOl(rows: SheetGrid, cols: ResUstunlar): ResNarx[] {
  const out: ResNarx[] = [];
  for (const row of rows.slice(cols.sarlavha + 1)) {
    const nom = plain(row[cols.nom]);
    const birlik = plain(row[cols.birlik]);
    const narx = son(row[cols.narx]);
    if (!nom || !birlik || narx == null || narx <= 0) continue;
    out.push({ kod: plain(cols.kod >= 0 ? row[cols.kod] : '') || undefined, nom, birlik, narx });
  }
  return out;
}

export function resVaraqlariniTop(workbook: XlsxWorkbook): Array<{ nom: string; cols: ResUstunlar }> {
  return workbook.sheets.flatMap((s) => {
    const sheet = workbook.sheet(s.name);
    const cols = sheet ? resUstunlariniAniqla(sheet.rows) : null;
    return cols ? [{ nom: s.name, cols }] : [];
  });
}

type Source = { code: string; nom: string; birlik: string; narx: number };

function sourceQur(rows: ResNarx[]): { source: Source[]; ziddiyatli: number; ziddiyatliKalitlar: Set<string> } {
  const grouped = new Map<string, Set<number>>();
  const first = new Map<string, Source>();
  for (const row of rows) {
    const nom = resNomKalit(row.nom);
    const birlik = resBirlikKalit(row.birlik);
    const code = resKodKalit(row.kod);
    if (!nom || !birlik || !Number.isFinite(row.narx) || row.narx <= 0) continue;
    const key = `${code}|${nom}|${birlik}`;
    const prices = grouped.get(key) ?? new Set<number>();
    prices.add(row.narx); grouped.set(key, prices);
    first.set(key, { code, nom, birlik, narx: row.narx });
  }
  const source: Source[] = [];
  let ziddiyatli = 0;
  const ziddiyatliKalitlar = new Set<string>();
  for (const [key, prices] of grouped) {
    if (prices.size !== 1) { ziddiyatli++; ziddiyatliKalitlar.add(key); continue; }
    const one = first.get(key);
    if (one) source.push(one);
  }
  return { source, ziddiyatli, ziddiyatliKalitlar };
}

/**
 * Server bilan bir xil, fail-closed preview. Kod bo'lsa aynan u ham mos
 * bo'lishi shart; kod yo'q manba faqat nom+birlik orqali ishlaydi.
 */
export function resNarxlashPreview(qatorlar: NarxsizQator[], reslar: ResNarx[]): ResPreview {
  const { source, ziddiyatli, ziddiyatliKalitlar } = sourceQur(reslar);
  const qatorNarxlari = new Map<number, number>();
  const moslashmagan: ResMoslashmagan[] = [];
  const turBoyicha: ResPreview['turBoyicha'] = { rs: { narxsiz: 0, mos: 0 }, mat: { narxsiz: 0, mos: 0 }, ob: { narxsiz: 0, mos: 0 } };
  let narxsiz = 0;
  for (const q of qatorlar) {
    if (!['rs', 'mat', 'ob'].includes(q.tur ?? '') || !(q.narx == null || q.narx === 0)) continue;
    narxsiz++;
    const tur = q.tur as 'rs' | 'mat' | 'ob';
    turBoyicha[tur].narxsiz++;
    const nom = resNomKalit(q.nom);
    const birlik = resBirlikKalit(q.birlik);
    const code = resKodKalit(q.kod);
    if (!nom || !birlik) {
      moslashmagan.push({ id: q.id, tur, kod: q.kod, nom: q.nom, birlik: q.birlik, sabab: 'QATOR_IDENTIYASI_YOQ' });
      continue;
    }
    const candidates = new Set<number>();
    for (const s of source) {
      if (s.nom !== nom || s.birlik !== birlik) continue;
      if (s.code && s.code !== code) continue;
      candidates.add(s.narx);
    }
    if (candidates.size === 1) {
      qatorNarxlari.set(q.id, [...candidates][0]);
      turBoyicha[tur].mos++;
      continue;
    }
    const ziddiyatliManba = [...ziddiyatliKalitlar].some((key) => {
      const [sourceCode, sourceNom, sourceBirlik] = key.split('|');
      return sourceNom === nom && sourceBirlik === birlik && (!sourceCode || sourceCode === code);
    });
    moslashmagan.push({ id: q.id,
      tur, kod: q.kod, nom: q.nom, birlik: q.birlik,
      sabab: ziddiyatliManba ? 'RES_MANBA_ZIDDIYATI' : candidates.size > 1 ? 'BIR_NECHTA_NARX_VARIANTI' : 'RES_MANBASI_TOPILMADI',
    });
  }
  return { narxsiz, mos: qatorNarxlari.size, narxsizQoldi: narxsiz - qatorNarxlari.size, ziddiyatliManba: ziddiyatli, qatorNarxlari, moslashmagan, turBoyicha };
}
