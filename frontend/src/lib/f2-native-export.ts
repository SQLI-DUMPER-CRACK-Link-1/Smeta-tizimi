import type { ProgressLineResult } from './construction-document-control';
import type { F2NativePayloadRow } from './f2-native-preparation';
import type { QatorHolat } from '../api/t2-fakt';
import { RasmiyVaraq, hujjatFaylNomi, imzoTomonlari, rasmiyKitob, yaxlit2, type ImzoNomlar, type RasmiyUstun } from './hujjat-yozuvchi';
import { davrMatni } from './nakopitelniy-vedomost-export';

/**
 * Native F2 qoralamasini mavjud rasmiy Excel proyeksiyasiga o‘giradi.
 * Bu adapter hisob-kitob manbai emas: u certifiedAmount ni qayta
 * hisoblamaydi va smeta narxini source F2 narxi o‘rniga qo‘ymaydi.
 */
export function f2NativeExportRowsQur(qatorlar: readonly QatorHolat[], certified: readonly F2NativePayloadRow[]): ProgressLineResult[] {
  const holat = new Map(qatorlar.map((row) => [row.qator_id, row]));
  const nullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return certified.flatMap((current) => {
    const row = holat.get(current.qatorId);
    if (!row) return [];
    const baselineQuantity = nullableNumber(row.smeta_hajm);
    const baselineReferencePrice = nullableNumber(row.smeta_narx);
    const previousQuantity = Number(row.f2_hajm) || 0;
    const previousCertifiedValue = Number.isFinite(Number(row.f2_summa)) ? Number(row.f2_summa) : null;
    const currentCertifiedValue = current.certifiedAmount ?? null;
    const calculated = current.certifiedUnitPrice == null ? null : current.certifiedQuantity * current.certifiedUnitPrice;
    const approvedEntitlementQuantity = baselineQuantity === null ? null : baselineQuantity;
    const cumulativeQuantity = previousQuantity + current.certifiedQuantity;
    const remainingQuantity = nullableNumber(row.qoldiq_hajm);
    const cumulativeValue = previousCertifiedValue == null || currentCertifiedValue == null ? null : previousCertifiedValue + currentCertifiedValue;
    const remainingValue = nullableNumber(row.qoldiq_summa);
    const warnings = [
      ...(calculated != null && currentCertifiedValue != null && Math.abs(calculated - currentCertifiedValue) > 0.005 ? ['PRICE_VARIANCE' as const] : []),
      ...(baselineQuantity === null ? ['MISSING_BASELINE_QUANTITY' as const] : []),
      ...(baselineReferencePrice === null ? ['MISSING_BASELINE_PRICE' as const] : []),
    ];
    return [{
      lineId: String(current.qatorId), sectionId: String(row.obyekt_id), description: row.nom, unit: row.birlik || '',
      baselineQuantity, baselineReferencePrice,
      approvedChangeQuantity: 0, approvedEntitlementQuantity,
      previousQuantity, currentQuantity: current.certifiedQuantity, cumulativeQuantity,
      remainingQuantity,
      previousValue: previousCertifiedValue, currentValue: currentCertifiedValue,
      cumulativeValue,
      remainingValue,
      previousCertifiedValue, currentCertifiedValue,
      cumulativeCertifiedValue: previousCertifiedValue == null || currentCertifiedValue == null ? null : previousCertifiedValue + currentCertifiedValue,
      currentF2ValuationPrice: current.certifiedUnitPrice ?? null, f2ValuationValue: calculated,
      actualValue: null, variance: calculated == null || currentCertifiedValue == null ? null : currentCertifiedValue - calculated,
      changeKinds: [], revisionIds: [], warnings,
    }];
  });
}

// ═══════════ Проект акта формы № 2 — rasmiy hujjat (P3, H1–H9) ═══════════

export type F2QoralamaOpsiya = {
  obyektNom: string;
  /** Hisobot davri "2026-09-01" yoki "2026-09". */
  davr: string;
  imzo?: ImzoNomlar;
  shartnoma?: string | null;
  ndsFoiz?: number | null;
};

const QORALAMA_USTUNLAR: RasmiyUstun[] = [
  { sarlavha: '№ п/п', kenglik: 6, tur: 'tartib' },
  { sarlavha: 'Шифр, код', kenglik: 13, tur: 'kod' },
  { sarlavha: 'Наименование работ и затрат', kenglik: 46, tur: 'matn' },
  { sarlavha: 'Ед. изм.', kenglik: 8, tur: 'birlik' },
  { sarlavha: 'кол-во', kenglik: 12, tur: 'hajm', guruh: 'ЗА ОТЧЕТНЫЙ ПЕРИОД (по документу)' },
  { sarlavha: 'цена за ед., сум', kenglik: 14, tur: 'narx', guruh: 'ЗА ОТЧЕТНЫЙ ПЕРИОД (по документу)' },
  { sarlavha: 'сумма, сум', kenglik: 16, tur: 'pul', guruh: 'ЗА ОТЧЕТНЫЙ ПЕРИОД (по документу)' },
  { sarlavha: 'Расчет: кол-во × цена, сум', kenglik: 16, tur: 'pul' },
  { sarlavha: 'Отклонение документа от расчета, сум', kenglik: 14, tur: 'pul' },
  { sarlavha: 'принято ранее', kenglik: 12, tur: 'hajm', guruh: 'КОЛИЧЕСТВО НАРАСТАЮЩИМ ИТОГОМ' },
  { sarlavha: 'с начала строительства', kenglik: 13, tur: 'hajm', guruh: 'КОЛИЧЕСТВО НАРАСТАЮЩИМ ИТОГОМ' },
  { sarlavha: 'Основание (документ, стр.)', kenglik: 18, tur: 'matn' },
];

/**
 * Проект акта приемки выполненных работ (Ф-2) — F2 tayyorlash sahifasidan.
 * Hujjat summasi — F2 manbasidagi aniq summa (qayta hisoblanmaydi, smeta narxi
 * bilan to'ldirilmaydi); "Расчет" va "Отклонение" — faqat nazorat ustunlari.
 * Narx/summa manbada ataylab yo'q bo'lsa — katak bo'sh, jami bo'sh (H7).
 */
export function f2QoralamaHujjat(qatorlar: readonly QatorHolat[], certified: readonly F2NativePayloadRow[], o: F2QoralamaOpsiya): { bytes: Uint8Array; faylNomi: string; jami: number | null } {
  const rows = f2NativeExportRowsQur(qatorlar, certified);
  if (!rows.length) throw new Error('F2_QORALAMA_BOSH');
  const holat = new Map(qatorlar.map((q) => [q.qator_id, q]));
  const manba = new Map(certified.map((c) => [c.qatorId, c.rawSnapshot.sourceReference]));
  const v = new RasmiyVaraq({
    nom: 'Проект акта Ф-2',
    sarlavha: 'ПРОЕКТ АКТА ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (ФОРМА № 2)',
    ostSarlavha: [`за отчетный период: ${davrMatni(o.davr)}`],
    titul: [['Объект:', o.obyektNom], ['Заказчик:', o.imzo?.zakazchik], ['Подрядчик:', o.imzo?.pudratchi], ['Договор:', o.shartnoma]],
    ustunlar: QORALAMA_USTUNLAR,
    yonalish: 'landscape',
  });
  const diqqat: Array<{ nom: string; sabab: string }> = [];
  const dataRows: number[] = [];
  let jami: number | null = 0;
  rows.forEach((row, i) => {
    const kod = holat.get(Number(row.lineId))?.kod ?? '';
    const summa = row.currentCertifiedValue;
    const narx = row.currentF2ValuationPrice;
    const hisob = narx == null ? null : yaxlit2(row.currentQuantity * narx);
    jami = jami == null || summa == null ? null : jami + summa;
    const nom = `${row.description}${row.unit ? `, ${row.unit}` : ''}`;
    if (summa == null) diqqat.push({ nom, sabab: 'в документе нет цены/суммы — итог не определен' });
    else if (hisob != null && Math.abs(hisob - summa) > 0.005) diqqat.push({ nom, sabab: `сумма документа отличается от расчета кол-во × цена на ${(summa - hisob).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} сум — принята сумма документа` });
    dataRows.push(v.qator('oddiy', (r) => [
      i + 1, kod, row.description, row.unit, row.currentQuantity, narx, summa,
      { f: `IF(F${r}="","",ROUND(E${r}*F${r},2))`, v: hisob ?? '' },
      { f: `IF(OR(G${r}="",H${r}=""),"",G${r}-H${r})`, v: summa == null || hisob == null ? '' : summa - hisob },
      row.previousQuantity,
      { f: `J${r}+E${r}`, v: row.previousQuantity + row.currentQuantity },
      manba.get(Number(row.lineId)) ?? '',
    ]));
  });
  const a = dataRows[0], b = dataRows[dataRows.length - 1];
  const itogoRow = v.qator('vsego', (r) => [null, null, 'ИТОГО ПО АКТУ', null, null, null,
    { f: `IF(COUNTBLANK(G${a}:G${b})>0,"",SUM(G${a}:G${b}))`, v: jami ?? '' }, null, null, null, null, null]);
  void itogoRow;
  const stavka = o.ndsFoiz != null && Number.isFinite(o.ndsFoiz) && o.ndsFoiz >= 0 ? o.ndsFoiz : null;
  const jamiQ = jami as number | null;
  const nds = stavka == null || jamiQ == null ? null : yaxlit2(jamiQ * stavka / 100);
  const ndsRow = v.qator('jami', (r) => [null, null, stavka == null ? 'НДС (ставка не указана)' : `НДС ${String(stavka).replace('.', ',')}%`, null, null, null,
    stavka == null ? null : { f: `IF(G${r - 1}="","",ROUND(G${r - 1}*${stavka}/100,2))`, v: nds ?? '' }, null, null, null, null, null]);
  v.qator('vsego', (r) => [null, null, 'ВСЕГО ПО АКТУ С НДС', null, null, null,
    stavka == null ? null : { f: `IF(OR(G${r - 2}="",G${ndsRow}=""),"",G${r - 2}+G${ndsRow})`, v: nds == null || jamiQ == null ? '' : jamiQ + nds }, null, null, null, null, null]);
  if (stavka == null) diqqat.push({ nom: 'НДС', sabab: 'ставка НДС не указана — сумма НДС и итог с НДС не определены' });
  v.bosh();
  v.izoh('Проект акта сформирован по данным документов формы № 2 за период. Сумма по позиции — сумма документа; графа «Расчет» приведена для контроля и не заменяет сумму документа.');
  v.diqqat(diqqat);
  v.imzo(imzoTomonlari(['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'ТЕХНАДЗОР'], o.imzo));
  const { bytes } = rasmiyKitob([v]);
  return { bytes, faylNomi: hujjatFaylNomi({ obyekt: o.obyektNom, hujjat: 'ПРОЕКТ_АКТА_Ф-2', davr: o.davr.slice(0, 7) }), jami: jamiQ };
}
