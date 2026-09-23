import type { SheetGrid, XlsxWorkbook } from './f2-import-parse';
import type { OfertaHisobTuri, OfertaQator, OfertaQatorTuri } from './tender-oferta';

export type OfertaSheetRole = 'res' | 'lrv' | 'transport' | 'unknown';
export type OfertaSheetConfidence = 'yuqori' | 'o‘rta' | 'past';
export type OfertaManbaFormati = 'abc' | 'tn' | 'noma’lum';

export type OfertaResursUstunlar = {
  tartib: number;
  shifr: number;
  nom: number;
  birlik: number;
  hajm: number;
  smetaNarx: number;
  smetaSumma: number;
  sarlavhaBoshlanishi: number;
  malumotBoshlanishi: number;
};

export type OfertaSheetTahlili = {
  nom: string;
  role: OfertaSheetRole;
  format: OfertaManbaFormati;
  confidence: OfertaSheetConfidence;
  evidence: string[];
  resScore: number;
  lrvScore: number;
  ustunlar: OfertaResursUstunlar | null;
  qatorlar: OfertaQator[];
  skippedRows: number;
  /** Bir fayldagi ayni RES jadvalining alternativ ko‘rinishi (masalan RES_A).
   * Ikkalasi birga tanlansa, bitta resurs ikki marta hisoblanib ketadi. */
  alternativVaraq?: string;
};

const text = (value: unknown): string => String(value ?? '').replace(/Ё/g, 'Е').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const upper = (value: unknown): string => text(value).toUpperCase();

function normal(v: unknown): string {
  return upper(v).replace(/№/g, ' NO ').replace(/[«»“”"'`.,:;()[\]{}\\/|_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function numberValue(value: unknown): number | null {
  if (value == null || String(value).trim() === '') return null;
  let raw = String(value).replace(/[\s\u00a0]/g, '').replace(',', '.').replace(/%$/, '');
  if (/^\(.*\)$/.test(raw)) raw = '-' + raw.slice(1, -1);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function safeRows(rows: SheetGrid | null | undefined): SheetGrid {
  return Array.isArray(rows) ? rows.map((row) => Array.isArray(row) ? row : []) : [];
}

function maxCols(rows: SheetGrid): number {
  return rows.slice(0, 100).reduce((max, row) => Math.max(max, row.length), 0);
}

function columnHeader(rows: SheetGrid, start: number, end: number, col: number): string {
  return rows.slice(start, end + 1).filter((row) => {
    const rowText = row.map(normal).join(' ');
    const standaloneTotal = /^(ИТОГО|ВСЕГО|JAMI|ЖАМИ|TOTAL)\b/.test(rowText);
    return !standaloneTotal && /(НАИМЕНОВАНИЕ|РЕСУРС|ЕДИНИЦ|ЕД ИЗМ|НА ЕД|ЗА ОДИН|ЦЕНА|НАРХ|СТОИМОСТ|КОЛИЧЕСТВ|ОБЪЕМ|ҲАЖМ|ХАЖМ|ШИФР|КОД|СУММА|ОБЩАЯ|НА ВЕСЬ ОБЪЕМ|TOTAL|Т\/КМ)/.test(rowText);
  }).map((row) => normal(row[col])).filter(Boolean).join(' ');
}

function firstColumn(headers: readonly string[], patterns: readonly RegExp[], avoid: readonly RegExp[] = []): number {
  for (let i = 0; i < headers.length; i++) {
    if (patterns.some((p) => p.test(headers[i])) && !avoid.some((p) => p.test(headers[i]))) return i;
  }
  return -1;
}

const NAME_PRIMARY_PATTERNS = [/НАИМЕНОВАНИЕ/, /НАМЕНОВАН/, /НАЗВАНИЕ/];
const NAME_FALLBACK_PATTERNS = [/РЕСУРС/, /RESOURCE/];
const NAME_PATTERNS = [...NAME_PRIMARY_PATTERNS, ...NAME_FALLBACK_PATTERNS];
const UNIT_PATTERNS = [/ЕДИНИЦ/, /ЕД ИЗМ/, /БИРЛИК/, /UNIT/];
const QTY_PATTERNS = [/КОЛИЧЕСТВ/, /КОЛИ/, /КОЛ /, /ПОТРЕБ/, /ОБЪЕМ/, /ОБЬЕМ/, /ҲАЖМ/, /ХАЖМ/, /QTY/, /QUANTITY/];
const CODE_PATTERNS = [/ШИФР/, /КОД/, /ОБОСНОВАН/, /НОМЕР НОРМАТИВ/, /CODE/];
const ORDER_PATTERNS = [/^NO$/, /^NO NO$/, /N P P/, /П П/, /П П$/, /TARTIB/, /№/];
const PRICE_PATTERNS = [
  /НА ЕД/, /ЗА ЕД/, /UNIT PRICE/, /ЦЕНА/, /НАРХ/, /СТОИМОСТЬ ЕД/,
  /СТОИМОСТ.*ЕДИНИЦ/, /ЗА ОДИН/, /БИРЛИК НАРХ/, /Т КМ/,
];
const TOTAL_PATTERNS = [/ОБЩ/, /ИТОГ/, /ВСЕГО/, /СУММА/, /ЖАМИ/, /УМУМИЙ/, /TOTAL/, /НА ВЕСЬ ОБЪЕМ/, /ГРУЗОПЕРЕВОЗ/];
const SUM_PATTERNS = [
  /ОБЩ/, /ИТОГ/, /ВСЕГО/, /СУММА/, /ЖАМИ/, /УМУМИЙ/, /TOTAL/, /НА ВЕСЬ ОБЪЕМ/,
  /СТОИМОСТЬ ГРУЗОПЕРЕВОЗ/, /ОБЩАЯ ТОННА/,
];

function totalHeaderScore(header: string): number {
  if (/СТОИМОСТЬ ГРУЗОПЕРЕВОЗ/.test(header)) return 100;
  if (/НА ВЕСЬ ОБЪЕМ/.test(header)) return 90;
  if (/СУММА|TOTAL/.test(header)) return 80;
  if (/ОБЩАЯ ТОННА/.test(header)) return 10;
  if (/ОБЩ|ИТОГ|ВСЕГО|ЖАМИ|УМУМИЙ/.test(header)) return 50;
  return 0;
}

function headerScore(header: string): number {
  let score = 0;
  if (NAME_PATTERNS.some((p) => p.test(header))) score += 3;
  if (UNIT_PATTERNS.some((p) => p.test(header))) score += 2;
  if (PRICE_PATTERNS.some((p) => p.test(header))) score += 3;
  if (QTY_PATTERNS.some((p) => p.test(header))) score += 1;
  return score;
}

function findHeaders(rows: SheetGrid): OfertaResursUstunlar | null {
  const cols = maxCols(rows);
  let best: { score: number; result: OfertaResursUstunlar } | null = null;
  for (let start = 0; start < Math.min(rows.length, 100); start++) {
    const end = Math.min(rows.length - 1, start + 5);
    const headers = Array.from({ length: cols }, (_, col) => columnHeader(rows, start, end, col));
    const nom = firstColumn(headers, NAME_PRIMARY_PATTERNS) >= 0
      ? firstColumn(headers, NAME_PRIMARY_PATTERNS)
      : firstColumn(headers, NAME_FALLBACK_PATTERNS);
    const birlik = firstColumn(headers, UNIT_PATTERNS);
    const hajm = firstColumn(headers, QTY_PATTERNS, [/НА ВЕСЬ/]);
    const shifr = firstColumn(headers, CODE_PATTERNS);
    const tartib = firstColumn(headers, ORDER_PATTERNS);
    const priceCandidates = headers.map((h, i) => ({ h, i }))
      .filter(({ h }) => PRICE_PATTERNS.some((p) => p.test(h)) && !TOTAL_PATTERNS.some((p) => p.test(h)));
    const smetaNarx = priceCandidates[0]?.i ?? -1;
    const totalCandidates = headers.map((h, i) => ({ h, i }))
      .filter(({ h, i }) => i !== smetaNarx && SUM_PATTERNS.some((p) => p.test(h)) && !PRICE_PATTERNS.some((p) => p.test(h)));
    const smetaSumma = [...totalCandidates].sort((a, b) => totalHeaderScore(b.h) - totalHeaderScore(a.h))[0]?.i ?? -1;
    if (nom < 0 || birlik < 0 || (smetaNarx < 0 && smetaSumma < 0)) continue;
    let score = headerScore(headers[nom]) + headerScore(headers[birlik]) + 3;
    if (hajm >= 0) score += 2;
    if (shifr >= 0) score += 1;
    if (smetaSumma >= 0) score += 1;
    if (!best || score > best.score) {
      let lastHeader = start;
      for (let rowIndex = start; rowIndex <= end; rowIndex++) {
        const rowText = (rows[rowIndex] || []).map(normal).join(' ');
        const isStandaloneTotal = /^(ИТОГО|ВСЕГО|JAMI|TOTAL)\b/.test(rowText);
        if (!isStandaloneTotal && /(НАИМЕНОВАНИЕ|РЕСУРС|ЕДИНИЦ|НА ЕД|ЗА ОДИН|ЦЕНА|СТОИМОСТ|КОЛИЧЕСТВ|ОБЪЕМ|ҲАЖМ|ХАЖМ|ШИФР|КОД|СУММА|НА ВЕСЬ ОБЪЕМ|ГРУЗОПЕРЕВОЗ)/.test(rowText)) lastHeader = rowIndex;
      }
      let firstHeader = lastHeader;
      for (let rowIndex = start; rowIndex <= lastHeader; rowIndex++) {
        const rowText = (rows[rowIndex] || []).map(normal).join(' ');
        if (/(НАИМЕНОВАН|РЕСУРС|ЕДИНИЦ|КОЛ|СТОИМОСТ|СУММА|ОБЩАЯ|№№|NO NO)/.test(rowText)) { firstHeader = rowIndex; break; }
      }
      let dataStart = lastHeader + 1;
      while (dataStart < rows.length && isOrdinalHeaderRow(rows[dataStart])) dataStart++;
      best = {
        score,
        result: {
          tartib, shifr, nom, birlik, hajm, smetaNarx, smetaSumma,
          sarlavhaBoshlanishi: firstHeader,
          malumotBoshlanishi: dataStart,
        },
      };
    }
  }
  return best?.result ?? null;
}

function isOrdinalHeaderRow(row: readonly unknown[]): boolean {
  const cells = row.map(text).filter(Boolean);
  if (cells.length < 2) return false;
  return cells.every((cell) => numberValue(cell) != null || /^(NO|NO NO|П П|[0-9]+)$/.test(normal(cell)));
}

function formatFor(sheetName: string, head: string): { format: OfertaManbaFormati; evidence: string[] } {
  const evidence: string[] = [];
  const value = `${normal(sheetName)} ${head}`;
  if (/ABC4|\bABC\b|АВС/.test(value)) { evidence.push('ABC/ABC4 belgisi'); return { format: 'abc', evidence }; }
  if (/\bТН\b|\bTN\b|ТЕРР|ТЕРРИТОР/.test(value)) { evidence.push('TN/TН belgisi'); return { format: 'tn', evidence }; }
  return { format: 'noma’lum', evidence };
}

function evidenceFor(rows: SheetGrid, sheetName: string): { resScore: number; lrvScore: number; roleHint: 'transport' | null; evidence: string[]; format: OfertaManbaFormati } {
  const head = rows.slice(0, 45).flatMap((row) => row.map(normal)).join(' ');
  const evidence: string[] = [];
  let resScore = 0;
  let lrvScore = 0;
  if (/РЕСУРС|МАТЕРИАЛЬНЫЕ|ТРУДОВЫЕ|ОБОРУДОВАНИ|МАТЕРИАЛЛАР|РЕСУРСЛАР/.test(head)) { resScore += 4; evidence.push('RES/resurs sarlavhasi'); }
  if (/НА ЕД|ЕДИНИЧН|ЕД ИЗМ|UNIT PRICE|НАРХ|ЗА ОДИН|Т КМ/.test(head)) { resScore += 3; evidence.push('birlik narx sarlavhasi'); }
  if (/КОЛИЧЕСТВ|ОБЪЕМ|ОБЬЕМ|ҲАЖМ|ХАЖМ/.test(head)) { resScore += 1; evidence.push('hajm/miqdor sarlavhasi'); }
  if (/ЛОКАЛЬН.{0,30}СМЕТ|ЛОКАЛЬНО СМЕТ|ВИД РАБОТ|РАБОТ И ЗАТРАТ/.test(head)) { lrvScore += 5; evidence.push('LRV/ish sarlavhasi'); }
  if (/ШИФР.*НОРМ|НОРМ.*РАСХОД/.test(head)) { lrvScore += 2; evidence.push('ish normasi belgisi'); }
  if (/ЦЕНА|СТОИМОСТ/.test(head)) { resScore += 1; evidence.push('narx qiymati sarlavhasi'); }
  const namedLrv = /LRV|СМЕТА|СМЕТНЫЙ/.test(normal(sheetName));
  const namedRes = /RES|РЕСУРС/.test(normal(sheetName));
  const transport = /ТРАНСП|ПЕРЕВОЗ|ГРУЗОПЕРЕВОЗ|ВОЗКА/.test(normal(sheetName))
    || (/ТРАНСП|ПЕРЕВОЗ|ГРУЗОПЕРЕВОЗ|ВОЗКА/.test(rows.slice(0, 8).flatMap((row) => row.map(normal)).join(' ')) && !/РЕСУРС/.test(head));
  if (namedLrv && !namedRes) { lrvScore += 7; evidence.push('varaq nomi LRV/smeta'); }
  else if (namedLrv) { lrvScore += 3; evidence.push('varaq nomida LRV va RES aralash belgisi'); }
  if (namedRes) { resScore += 2; evidence.push('varaq nomi RES/resurs'); }
  if (transport) { resScore += 2; evidence.push('transport hisob varaqlari'); }
  const format = formatFor(sheetName, head);
  evidence.push(...format.evidence);
  return { resScore, lrvScore, roleHint: transport ? 'transport' : null, evidence, format: format.format };
}

function valueAt(row: readonly unknown[], index: number): unknown {
  return index >= 0 ? row[index] : null;
}

function isTotalLabel(name: string): boolean {
  return /^(ИТОГО|ВСЕГО|JAMI|ЖАМИ|TOTAL|ОБЩАЯ СТОИМОСТЬ|УМУМИЙ|ИТОГО ПО|ВСЕГО МАТЕРИАЛОВ|ИТОГО РЕСУРСЫ)/.test(normal(name));
}

function isGlobalTotal(name: string): boolean {
  // Oddiy ВСЕГО/JAMI ko‘p ABC/TN fayllarida bo‘limning yakuniy satri bo‘ladi.
  // Uni butun varaq jami deb olish keyingi bo‘limlarni vaqtincha “hali o‘qilmagan”
  // qilib, oferta validatsiyasini noto‘g‘ri yiqitadi. Faqat aniq umumiy yorliqlar
  // varaq darajasidagi qamrovni bildiradi.
  return /^(ОБЩАЯ СТОИМОСТЬ|ВСЕГО МАТЕРИАЛОВ|ИТОГО РЕСУРСЫ ПО ПРОЕКТУ|ИТОГО ПО ПРОЕКТУ|УМУМИЙ ҚИЙМАТ)/.test(normal(name));
}

function isSectionLabel(name: string): boolean {
  const normalized = normal(name);
  if (/^(РАЗДЕЛ|РЕСУРСЫ ПО|ЗАТРАТЫ ТРУДА|ТРУДОВЫЕ РЕСУРСЫ|СТРОИТЕЛЬНЫЕ МАШИН|СТРОИТЕЛЬНЫЕ МАТЕРИАЛ|МАТЕРИАЛЬНЫЕ РЕСУРСЫ|МЕСТНЫЕ МАТЕРИАЛ|ИНЕРТНЫЕ МАТЕРИАЛ|ОБОРУДОВАНИЕ|РАБОТЫ ВЕДУТСЯ|РЕСУРСЫ$|МАТЕРИАЛЫ$)/.test(normalized)) return true;
  // ABC/TN fayllarida bo‘lim nomlari doim bir xil lug‘atdan kelmaydi:
  // masalan, “МЕТАЛЛОКОНСТРУКЦИИ” alohida sarlavha bo‘lishi mumkin. Qatorning
  // o‘zida birlik/hajm/narx bo‘lmasa, faqat katta harflardan iborat uzun nomni
  // yangi blok deb olamiz. Resurs qatorlari esa odatda kamida birlik yoki summa
  // bilan keladi va bu qoida ularga ta’sir qilmaydi.
  return normalized.length >= 5 && !/\d/.test(normalized) && /^[A-ZА-ЯЁЎҚҒҲІЇЄ\s-]+$/.test(normalized);
}

function lineType(name: string, row: readonly unknown[], columns: OfertaResursUstunlar): { turi: OfertaQatorTuri; jamiQamrovi?: 'blok' | 'varaq' } {
  if (isTotalLabel(name)) return { turi: 'jami', jamiQamrovi: isGlobalTotal(name) ? 'varaq' : 'blok' };
  const hasUnitOrAmount = Boolean(text(valueAt(row, columns.birlik)) || numberValue(valueAt(row, columns.hajm)) != null || numberValue(valueAt(row, columns.smetaNarx)) != null || numberValue(valueAt(row, columns.smetaSumma)) != null);
  if (!hasUnitOrAmount && isSectionLabel(name)) return { turi: 'bolim' };
  const normalized = normal(name);
  if (/СКЛАДСК|СКЛАД|ХРАНЕН|ЗАГОТОВИТЕЛЬНО СКЛАД/.test(normalized)) return { turi: 'sklad_xarajati' };
  if (/ТРАНСП|ПЕРЕВОЗ|ДОСТАВ|ГРУЗОПЕРЕВОЗ|ВОЗКА/.test(normalized)) return { turi: 'transport_xarajati' };
  return { turi: 'resurs' };
}

function fallbackNumber(row: readonly unknown[], type: OfertaQatorTuri, columns: OfertaResursUstunlar): number | null {
  if (columns.smetaSumma >= 0) return numberValue(valueAt(row, columns.smetaSumma));
  if (type === 'resurs' || type === 'bolim') return null;
  const values = row.map(numberValue).filter((value): value is number => value != null);
  if (!values.length) return null;
  return type === 'jami' ? values[0] : values[values.length - 1];
}

function rowLabel(row: readonly unknown[], columns: OfertaResursUstunlar): string {
  const preferred = text(valueAt(row, columns.nom));
  if (preferred) return preferred;
  return row.map(text).find((value) => value && numberValue(value) == null && !/^(СУМ|SUM|№№|[0-9.]+)$/.test(normal(value))) ?? '';
}

function hisobTuri(turi: OfertaQatorTuri, hajm: number | null, smetaNarx: number | null, smetaSumma: number | null): OfertaHisobTuri {
  if (turi === 'bolim') return 'bolim';
  if (turi === 'jami') return 'jami';
  if (turi !== 'resurs' && smetaNarx == null && smetaSumma != null) return 'manba_jami';
  if (smetaNarx != null && hajm != null) return 'birlik';
  return turi === 'resurs' ? 'birlik' : 'manba_jami';
}

function parseRows(sheetName: string, rows: SheetGrid, columns: OfertaResursUstunlar, transportSheet = false): { qatorlar: OfertaQator[]; skippedRows: number } {
  const qatorlar: OfertaQator[] = [];
  let skippedRows = 0;
  let activeBlock: string | null = null;
  for (let i = columns.malumotBoshlanishi; i < rows.length; i++) {
    const row = rows[i] || [];
    const nom = rowLabel(row, columns);
    const birlik = text(valueAt(row, columns.birlik)) || null;
    const hajm = numberValue(valueAt(row, columns.hajm));
    const smetaNarx = numberValue(valueAt(row, columns.smetaNarx));
    const preliminary = lineType(nom, row, columns);
    const smetaSumma = fallbackNumber(row, preliminary.turi, columns);
    const hasAnyValue = Boolean(nom || row.some((cell) => text(cell)));
    const hasNumericOrUnit = birlik != null || hajm != null || smetaNarx != null || smetaSumma != null;
    if (!nom || (!hasNumericOrUnit && preliminary.turi !== 'bolim') || (preliminary.turi === 'jami' && smetaSumma == null)) {
      if (hasAnyValue) skippedRows++;
      continue;
    }

    const sourceId = `${sheetName}::r${i + 1}`;
    const turi = transportSheet && preliminary.turi === 'resurs' ? 'transport_xarajati' : preliminary.turi;
    const jamiQamrovi = preliminary.jamiQamrovi;
    if (turi === 'bolim') activeBlock = sourceId;
    const tartibRaw = valueAt(row, columns.tartib);
    const tartibText = text(tartibRaw);
    const tartibNumber = numberValue(tartibRaw);
    const shifr = text(valueAt(row, columns.shifr)) || null;
    const isAggregateCalculation = turi === 'transport_xarajati' && transportSheet;
    qatorlar.push({
      sourceId,
      sourceSheet: sheetName,
      sourceRow: i + 1,
      tartibRaqami: tartibText ? (tartibNumber == null ? tartibText : tartibNumber) : null,
      shifr,
      nom,
      birlik,
      hajm,
      smetaBirlikNarx: smetaNarx,
      smetaSumma,
      turi,
      hisobTuri: isAggregateCalculation ? 'manba_jami' : hisobTuri(turi, hajm, smetaNarx, smetaSumma),
      blokKaliti: activeBlock,
      jamiQamrovi,
      manbaHajmUstuni: columns.hajm,
      manbaSummaUstuni: columns.smetaSumma,
    });
  }
  return { qatorlar, skippedRows };
}

function resursSignature(sheet: OfertaSheetTahlili): Set<string> {
  return new Set(sheet.qatorlar.filter((qator) => qator.turi === 'resurs').map((qator) => [
    normal(qator.nom),
    normal(qator.birlik),
    qator.hajm == null ? '' : String(qator.hajm),
    qator.smetaSumma == null ? '' : String(qator.smetaSumma),
  ].join('|')));
}

function duplicateScore(left: OfertaSheetTahlili, right: OfertaSheetTahlili): number {
  const a = resursSignature(left);
  const b = resursSignature(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const key of a) if (b.has(key)) common++;
  return common / Math.min(a.size, b.size);
}

function primaryDuplicateSheet(left: OfertaSheetTahlili, right: OfertaSheetTahlili): OfertaSheetTahlili {
  const score = (sheet: OfertaSheetTahlili): number => {
    let value = 0;
    if (sheet.ustunlar?.shifr != null && sheet.ustunlar.shifr >= 0) value += 4;
    if (/^(RES|РЕСУРС)(_|$)/i.test(sheet.nom.trim())) value += 3;
    if (/_A$/i.test(sheet.nom.trim())) value -= 2;
    return value;
  };
  return score(left) >= score(right) ? left : right;
}

export function ofertaResursVaraqlariniAniqla(workbook: XlsxWorkbook): OfertaSheetTahlili[] {
  const analyses: OfertaSheetTahlili[] = workbook.sheets.map((sheet) => {
    const rows = safeRows(workbook.sheet(sheet.name)?.rows ?? sheet.rows);
    const evidenceData = evidenceFor(rows, sheet.name);
    const ustunlar = findHeaders(rows);
    const parsed = ustunlar ? parseRows(sheet.name, rows, ustunlar, evidenceData.roleHint === 'transport') : { qatorlar: [], skippedRows: 0 };
    const hasResourceShape = Boolean(ustunlar && parsed.qatorlar.some((qator) => qator.turi !== 'bolim'));
    const namedLrv = /LRV|СМЕТА|СМЕТНЫЙ/.test(normal(sheet.name));
    const namedRes = /RES|РЕСУРС/.test(normal(sheet.name));
    let role: OfertaSheetRole = 'unknown';
    if (hasResourceShape && namedLrv && !namedRes) role = 'lrv';
    else if (hasResourceShape && evidenceData.roleHint === 'transport') role = 'transport';
    else if (hasResourceShape && (evidenceData.resScore >= evidenceData.lrvScore || evidenceData.lrvScore < 5)) role = 'res';
    if (evidenceData.lrvScore >= evidenceData.resScore + 3) role = 'lrv';
    const confidence: OfertaSheetConfidence = role === 'lrv' ? 'yuqori'
      : (role === 'res' || role === 'transport') && evidenceData.resScore >= 7 && evidenceData.resScore >= evidenceData.lrvScore + 2
        ? 'yuqori'
        : role === 'res' || role === 'transport' ? 'o‘rta' : 'past';
    const evidence = [...evidenceData.evidence];
    if (!ustunlar) evidence.push('RES ustunlari to‘liq aniqlanmadi');
    else if (!parsed.qatorlar.length) evidence.push('sarlavha topildi, lekin resurs satrlari topilmadi');
    else evidence.push(`${parsed.qatorlar.filter((qator) => qator.turi === 'resurs').length} ta resurs, ${parsed.qatorlar.filter((qator) => qator.turi !== 'resurs').length} ta hisob/bo‘lim satri`);
    return { nom: sheet.name, role, format: evidenceData.format, confidence, evidence, resScore: evidenceData.resScore, lrvScore: evidenceData.lrvScore, ustunlar, ...parsed };
  });

  // ABC eksportlarida RES va RES_A ko‘pincha ayni ma’lumotning ikki ko‘rinishi:
  // biri kodli, ikkinchisi kodsiz. Ularni avtomatik birga tanlash 20 mlrdni
  // 38 mlrd qilib yuborishi mumkin. Faqat qator nomi+birlik+hajm+manba summasi
  // kamida 90% mos tushganida alternativ deb belgilaymiz; alohida paketlar
  // o‘xshash nomlarga ega bo‘lsa ham bir-biriga yutilmaydi.
  for (let i = 0; i < analyses.length; i++) {
    const left = analyses[i];
    if (left.role !== 'res') continue;
    for (let j = i + 1; j < analyses.length; j++) {
      const right = analyses[j];
      if (right.role !== 'res' || left.alternativVaraq || right.alternativVaraq) continue;
      if (duplicateScore(left, right) < 0.9) continue;
      const primary = primaryDuplicateSheet(left, right);
      const alternate = primary.nom === left.nom ? right : left;
      alternate.alternativVaraq = primary.nom;
      alternate.evidence = [...alternate.evidence, `alternativ ko‘rinish: ${primary.nom}; ikkalasi birga tanlanmaydi`];
    }
  }
  return analyses;
}

export function ofertaTanlanganQatorlari(
  tahlillar: readonly OfertaSheetTahlili[],
  tanlanganVaraqlar: readonly string[],
): OfertaQator[] {
  const wanted = new Set(tanlanganVaraqlar);
  return tahlillar.filter((sheet) => wanted.has(sheet.nom) && !(sheet.alternativVaraq && wanted.has(sheet.alternativVaraq))).flatMap((sheet) => sheet.qatorlar);
}
