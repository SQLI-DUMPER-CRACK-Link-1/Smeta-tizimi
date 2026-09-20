import type { SheetGrid } from './f2-import-parse';

/**
 * Paket importi uchun varaq roli faqat mazmunidan aniqlanadi. Fayl/papka
 * nomi hech qachon business bog'lanish yoki canonical identity bo'lmaydi.
 */
export type SmetaSheetRole = 'lrv' | 'res' | 'ignore' | 'unknown';
export type SmetaSheetConfidence = 'high' | 'medium' | 'low';

export type SmetaSheetAnalysis = {
  detectedRole: Exclude<SmetaSheetRole, 'ignore'>;
  /** Mazmuni import manbasi emasligi aniq bo'lsa, UI ignore ni oldindan tanlaydi. */
  suggestedIgnore: boolean;
  ignoreReason?: string;
  confidence: SmetaSheetConfidence;
  evidence: string[];
  lrvScore: number;
  resScore: number;
  dataRows: number;
  codelessResRows: number;
  analysisKey: string;
};

export type SmetaPackageSheetChoice = {
  id: string;
  workbookId: string;
  sourceKey: string;
  analysisKey: string;
  selectedRole?: Exclude<SmetaSheetRole, 'unknown'>;
  targetLrvSourceKey?: string;
};

export type SmetaPackageSelectionCode =
  | 'PACKAGE_SHEET_ROLE_REQUIRED'
  | 'PACKAGE_LRV_REQUIRED'
  | 'PACKAGE_RES_TARGET_REQUIRED'
  | 'PACKAGE_RES_TARGET_INVALID'
  | 'PACKAGE_INTERNAL_RES_TARGET_MISMATCH'
  | 'PACKAGE_SOURCE_KEY_DUPLICATE'
  | 'PACKAGE_CONFIRMATION_REQUIRED';

export type SmetaPackageSelectionCheck =
  | { ok: true }
  | { ok: false; code: SmetaPackageSelectionCode; sheetId?: string };

function text(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/Ё/g, 'Е').replace(/\s+/g, ' ').trim();
}

function isNumber(value: unknown): boolean {
  if (value == null || String(value).trim() === '') return false;
  const normal = String(value).replace(/[\s ]/g, '').replace(',', '.');
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normal);
}

function hasUnit(value: unknown): boolean {
  /* JS `\b` Cyrillic harflarni "word" deb bilmaydi; shuning uchun М3,
     ШТ kabi haqiqiy unitlarni bexato topish uchun Unicodega bog'liq chegara
     ishlatmaymiz. */
  return /(М2|М3|КМ|КГ|ШТ|КОМПЛ|КОМПЛЕКТ|ЧЕЛ[.-]?Ч|МАШ[.-]?Ч|СУМ|^М$|^Т$)/.test(text(value));
}

function stableKey(parts: readonly string[]): string {
  let hash = 2166136261;
  for (const char of parts.join('\u001f')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `analysis-${(hash >>> 0).toString(16)}`;
}

/**
 * TN qurilish va ABC4 ko'rinishlarining sarlavhalari, shuningdek kodsiz RES
 * satrlari semantik signal sifatida ishlatiladi. Noma'lum holat auto-import
 * bo'lmaydi: foydalanuvchi LRV/RES/e'tiborsiz qarorini beradi.
 */
/**
 * XLSX parsers tashqi fayl formatidan keladi: bo'sh/nostandart worksheet
 * satri hech qachon paket oynasini yiqitmasligi kerak. Uni LRV/RES deb
 * taxmin qilmaymiz; operator faqat `unknown` natijasini ko'radi va aniq
 * tanlov qiladi. Bu normalizator import kontrakti uchun emas, faqat tahlil
 * qatlamining xato-bardosh chegarasidir.
 */
function xavfsizGrid(rows: unknown): SheetGrid {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => Array.isArray(row) ? row : []);
}

export function smetaVaraqniTahlilQil(rows: SheetGrid | null | undefined): SmetaSheetAnalysis {
  const grid = xavfsizGrid(rows);
  const nonEmpty = grid.filter((row) => row.some((cell) => text(cell) !== ''));
  const header = nonEmpty.slice(0, 35).flatMap((row) => row.map(text)).join(' ');
  let lrvScore = 0;
  let resScore = 0;
  const evidence: string[] = [];

  const add = (role: 'lrv' | 'res', score: number, note: string) => {
    if (role === 'lrv') lrvScore += score;
    else resScore += score;
    evidence.push(note);
  };

  if (/ЛОКАЛЬН.{0,20}(РЕСУРСН.{0,20})?(СМЕТ|ВЕДОМОСТ)/.test(header)) add('lrv', 3, 'lokal smeta/LRV sarlavhasi');
  if (/\bABC\s*4\b|АВС\s*4/.test(header)) add('lrv', 2, 'ABC4 belgisi');
  if (/\bТН\b|ТЕРРИТОРИАЛЬН.{0,30}НОРМ/.test(header)) add('lrv', 2, 'TN qurilish normasi belgisi');
  if (/НАИМЕНОВАНИЕ\s+(РАБОТ|РАБОТ И ЗАТРАТ)|ВИД\s+РАБОТ/.test(header)) add('lrv', 3, 'ish nomi sarlavhasi');
  if (/КОЛИЧЕСТВ|ОБЪ[ЕЁ]М|ОБЬЕМ|ОБЪЁМ/.test(header)) add('lrv', 1, 'hajm/miqdor sarlavhasi');
  if (/ШИФР|НОРМ.{0,20}РАСХОД/.test(header)) add('lrv', 1, 'shifr/norma sarlavhasi');

  if (/РЕСУРСН.{0,30}(ВЕДОМОСТ|ЧАСТ)|МАТЕРИАЛЬНЫЕ\s+РЕСУРСЫ|ТРУДОВЫЕ\s+РЕСУРСЫ|ОБОРУДОВАНИ/.test(header)) {
    add('res', 3, 'RES bo\'limi yoki resurs sarlavhasi');
  }
  if (/ЦЕНА|СТОИМОСТ.{0,20}(ЕД|ЕДИНИЦ)|ТЕКУЩ.{0,20}ЦЕН/.test(header)) add('res', 2, 'narx sarlavhasi');

  let resourceLikeRows = 0;
  let codelessResRows = 0;
  for (const row of nonEmpty.slice(0, 600)) {
    const values = row.map(text);
    const name = values.find((value) => value.length >= 3 && /[A-ZА-ЯЎҚҒҲ]/.test(value));
    const hasPrice = row.some((value) => isNumber(value) && Number(String(value).replace(/[\s ]/g, '').replace(',', '.')) > 0);
    const unit = row.some(hasUnit);
    /* Narx katagi ko'pincha yalang'och raqam; uni shifr deb o'qish
       shifrsiz RESni noto'g'ri tasniflaydi. Sof raqam kodlar keyin parser
       evidence'i bilan ishlanadi, bu dastlabki xavfsiz rol tahlilida esa
       kod mavjudligining isboti emas. */
    const code = values.some((value) => !hasUnit(value) && /^(?:[A-ZА-Я]{1,4}[-./]?\d+|\d+[-./]\d+)(?:[-./]\d+)*$/.test(value));
    if (name && unit && hasPrice) {
      resourceLikeRows++;
      if (!code) codelessResRows++;
    }
  }
  if (resourceLikeRows >= 3) add('res', 2, `${resourceLikeRows} ta nom+birlik+narx resurs satri`);
  if (codelessResRows >= 2) add('res', 2, `${codelessResRows} ta shifrsiz RES satri`);

  let detectedRole: Exclude<SmetaSheetRole, 'ignore'> = 'unknown';
  if (lrvScore >= 5 && lrvScore >= resScore + 1) detectedRole = 'lrv';
  if (resScore >= 5 && resScore > lrvScore) detectedRole = 'res';
  /* Obyekt qiymati xulosasi yoki transport xarajatlari alohida varaqlari
     kanonik LRV/RES manbasi emas. Faqat kuchli mazmun signali bor va LRV
     sarlavhasi yo'q holatda avtomatik e'tiborsiz tavsiya qilinadi. */
  const ignoreMatch = header.match(
    /РЕКОМЕНДУЕМАЯ\s+СТОИМОСТЬ\s+ОБЪЕКТА|РАСЧ[ЕЁ]Т\s+ЗАТРАТ\s+ТРАНСПОРТА|СВОДН(?:ЫЙ|АЯ|ОЕ)\s+(?:РАСЧ[ЕЁ]Т|ВЕДОМОСТ|ИТОГ)/,
  );
  const suggestedIgnore = Boolean(ignoreMatch && lrvScore < 5);
  const ignoreReason = suggestedIgnore ? 'xulosa/transport varag‘i — kanonik LRV yoki RES manbasi emas' : undefined;
  if (suggestedIgnore) {
    detectedRole = 'unknown';
    evidence.push(`avtomatik e'tiborsiz: ${ignoreReason}`);
  }
  const strongest = Math.max(lrvScore, resScore);
  const difference = Math.abs(lrvScore - resScore);
  const confidence: SmetaSheetConfidence = detectedRole === 'unknown'
    ? 'low'
    : strongest >= 8 && difference >= 2 ? 'high' : 'medium';
  if (detectedRole === 'unknown') evidence.push('yetarli ishonchli LRV yoki RES signali yo\'q');

  return {
    detectedRole, suggestedIgnore, ignoreReason, confidence, evidence, lrvScore, resScore, dataRows: nonEmpty.length, codelessResRows,
    analysisKey: stableKey([header, String(nonEmpty.length), String(resourceLikeRows), String(codelessResRows)]),
  };
}

/** Tanlov yoki manba tahlili o'zgarsa oldingi tasdiq avtomatik yaroqsiz bo'ladi. */
export function smetaPaketTasdiqImzosi(sheets: readonly SmetaPackageSheetChoice[]): string {
  return sheets.slice().sort((a, b) => a.id.localeCompare(b.id)).map((sheet) =>
    [sheet.id, sheet.sourceKey, sheet.analysisKey, sheet.selectedRole || '', sheet.targetLrvSourceKey || ''].join(':')
  ).join('|');
}

/**
 * RES manbasini xavfsiz tarzda LRVga taklif qiladi. Bir xil faylda faqat bitta
 * LRV bo'lsa, yoki butun paketda faqat bitta LRV bo'lsa, bog'lanish
 * deterministik hisoblanadi. Bir nechta nomzod bo'lsa hech qachon indeks yoki
 * nom bo'yicha taxmin qilmaydi — operator tanlovi talab qilinadi.
 */
export function smetaPaketResTargetlariniTaklifQil<T extends SmetaPackageSheetChoice>(
  sheets: readonly T[],
): T[] {
  const lrvs = sheets.filter((sheet) => sheet.selectedRole === 'lrv');
  const byWorkbook = new Map<string, SmetaPackageSheetChoice[]>();
  for (const lrv of lrvs) {
    const list = byWorkbook.get(lrv.workbookId) || [];
    list.push(lrv);
    byWorkbook.set(lrv.workbookId, list);
  }
  return sheets.map((sheet) => {
    if (sheet.selectedRole !== 'res' || sheet.targetLrvSourceKey) return sheet;
    const sameWorkbook = byWorkbook.get(sheet.workbookId) || [];
    const candidate = sameWorkbook.length === 1 ? sameWorkbook[0] : lrvs.length === 1 ? lrvs[0] : undefined;
    return candidate ? { ...sheet, targetLrvSourceKey: candidate.sourceKey } : sheet;
  });
}

export function smetaPaketTanloviniTekshir(
  sheets: readonly SmetaPackageSheetChoice[],
  confirmedSignature?: string | null,
): SmetaPackageSelectionCheck {
  if (confirmedSignature !== smetaPaketTasdiqImzosi(sheets)) return { ok: false, code: 'PACKAGE_CONFIRMATION_REQUIRED' };
  const active = sheets.filter((sheet) => sheet.selectedRole !== 'ignore');
  const roleMissing = active.find((sheet) => !sheet.selectedRole);
  if (roleMissing) return { ok: false, code: 'PACKAGE_SHEET_ROLE_REQUIRED', sheetId: roleMissing.id };
  const lrvs = active.filter((sheet) => sheet.selectedRole === 'lrv');
  if (!lrvs.length) return { ok: false, code: 'PACKAGE_LRV_REQUIRED' };
  const sourceKeys = new Set<string>();
  for (const sheet of active) {
    if (sourceKeys.has(sheet.sourceKey)) return { ok: false, code: 'PACKAGE_SOURCE_KEY_DUPLICATE', sheetId: sheet.id };
    sourceKeys.add(sheet.sourceKey);
  }
  const lrvKeys = new Set(lrvs.map((sheet) => sheet.sourceKey));
  for (const sheet of active.filter((item) => item.selectedRole === 'res')) {
    if (!sheet.targetLrvSourceKey) return { ok: false, code: 'PACKAGE_RES_TARGET_REQUIRED', sheetId: sheet.id };
    if (!lrvKeys.has(sheet.targetLrvSourceKey)) return { ok: false, code: 'PACKAGE_RES_TARGET_INVALID', sheetId: sheet.id };
    const ownWorkbookLrvs = lrvs.filter((lrv) => lrv.workbookId === sheet.workbookId);
    if (ownWorkbookLrvs.length && !ownWorkbookLrvs.some((lrv) => lrv.sourceKey === sheet.targetLrvSourceKey)) {
      return { ok: false, code: 'PACKAGE_INTERNAL_RES_TARGET_MISMATCH', sheetId: sheet.id };
    }
  }
  return { ok: true };
}
