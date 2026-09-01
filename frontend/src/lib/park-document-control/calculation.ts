import type { ParkCalculationInput, ParkCalculationResult, ParkChange, ParkLine, ParkLineResult } from './types';

const EPS = 1e-9;
export const roundQuantity = (value: number) => Math.round((value + EPS) * 1_000_000) / 1_000_000;
export const roundMoney = (value: number) => Math.round((value + EPS) * 100) / 100;
const value = (quantity: number, unitPrice: number) => roundMoney(roundQuantity(quantity) * unitPrice);

function assertFinite(name: string, n: number) {
  if (!Number.isFinite(n)) throw new Error(`PARK_INVALID_${name}`);
}

function changesForPeriod(changes: readonly ParkChange[], period: number, status: ParkChange['status']) {
  return changes.filter(change => change.status === status && change.effectiveFromPeriod <= period);
}

function lineForChange(line: ParkLine | undefined, change: ParkChange): ParkLine {
  if (line) return line;
  if (!change.lineId || !change.sectionId || !change.description || !change.unit || change.estimateUnitPrice === undefined) {
    throw new Error(`PARK_CHANGE_LINE_INCOMPLETE:${change.changeId}`);
  }
  return { lineId: change.lineId, sectionId: change.sectionId, description: change.description, unit: change.unit,
    baselineQuantity: 0, estimateUnitPrice: change.estimateUnitPrice };
}

function expandedLines(input: ParkCalculationInput): ParkLine[] {
  const map = new Map(input.lines.map(line => [line.lineId, line]));
  for (const change of input.changes) {
    if ((change.kind === 'additional_work' || change.kind === 'new_item' || change.kind === 'new_section' || change.kind === 'replacement') && change.lineId) {
      map.set(change.lineId, lineForChange(map.get(change.lineId), change));
    }
  }
  return [...map.values()];
}

function approvedQuantity(line: ParkLine, changes: readonly ParkChange[]) {
  return roundQuantity(line.baselineQuantity + changes.filter(change => change.lineId === line.lineId)
    .reduce((sum, change) => sum + change.quantityDelta, 0));
}

function actualValueFor(lineId: string, periods: ParkCalculationInput['periods'], through: number) {
  let missingPrice = false;
  let total = 0;
  for (const period of periods.slice(0, through + 1)) for (const item of period.lines.filter(item => item.lineId === lineId)) {
    if (item.actualUnitPrice === undefined) missingPrice = true;
    else { assertFinite('ACTUAL_PRICE', item.actualUnitPrice); total += value(item.quantity, item.actualUnitPrice); }
  }
  // No certified quantity has a real cost of zero; a certified quantity with
  // missing evidence remains unknown rather than silently becoming zero.
  return missingPrice ? null : roundMoney(total);
}

/** Pure and idempotent. It never changes supplied historical period snapshots. */
export function calculatePark(input: ParkCalculationInput): ParkCalculationResult {
  if (!Number.isInteger(input.throughPeriod) || input.throughPeriod < 0 || input.throughPeriod >= input.periods.length) throw new Error('PARK_PERIOD_OUT_OF_RANGE');
  const lines = expandedLines(input);
  const approved = changesForPeriod(input.changes, input.throughPeriod, 'approved');
  const pending = changesForPeriod(input.changes, input.throughPeriod, 'pending');
  const warnings: string[] = [];
  const results: ParkLineResult[] = lines.map(line => {
    assertFinite('BASELINE_QUANTITY', line.baselineQuantity); assertFinite('ESTIMATE_PRICE', line.estimateUnitPrice);
    const qty = (period: number) => input.periods[period].lines.filter(item => item.lineId === line.lineId)
      .reduce((sum, item) => { assertFinite('CERTIFIED_QUANTITY', item.quantity); return sum + item.quantity; }, 0);
    const previousQuantity = roundQuantity(input.periods.slice(0, input.throughPeriod).reduce((sum, _, index) => sum + qty(index), 0));
    const currentQuantity = roundQuantity(qty(input.throughPeriod));
    const cumulativeQuantity = roundQuantity(previousQuantity + currentQuantity);
    const approvedQty = approvedQuantity(line, approved);
    const remainingQuantity = roundQuantity(approvedQty - cumulativeQuantity);
    const estimateValue = value(cumulativeQuantity, line.estimateUnitPrice);
    const actualValue = actualValueFor(line.lineId, input.periods, input.throughPeriod);
    if (cumulativeQuantity > approvedQty + EPS) warnings.push(`OVER_CERTIFIED:${line.lineId}`);
    return { lineId: line.lineId, sectionId: line.sectionId, description: line.description, unit: line.unit, approvedQuantity: approvedQty,
      previousQuantity, currentQuantity, cumulativeQuantity, remainingQuantity, estimateValue, actualValue,
      priceVariance: actualValue === null ? null : roundMoney(actualValue - estimateValue), overCertified: cumulativeQuantity > approvedQty + EPS };
  });
  const periods = input.periods.slice(0, input.throughPeriod + 1).map(period => {
    const currentEstimateValue = roundMoney(period.lines.reduce((sum, item) => {
      const line = lines.find(candidate => candidate.lineId === item.lineId); return sum + (line ? value(item.quantity, line.estimateUnitPrice) : 0);
    }, 0));
    const actualItems = period.lines.filter(item => item.actualUnitPrice !== undefined);
    const currentActualValue = actualItems.length === period.lines.length ? roundMoney(actualItems.reduce((sum, item) => sum + value(item.quantity, item.actualUnitPrice!), 0)) : null;
    return { periodId: period.periodId, periodLabel: period.periodLabel, currentEstimateValue, currentActualValue,
      documentDifference: period.documentTotal === undefined ? null : roundMoney(period.documentTotal - currentEstimateValue) };
  });
  const current = periods.at(-1)!;
  const cumulativeEstimateValue = roundMoney(results.reduce((sum, line) => sum + line.estimateValue, 0));
  const previousEstimateValue = roundMoney(cumulativeEstimateValue - current.currentEstimateValue);
  const priceByLine = new Map(lines.map(line => [line.lineId, line.estimateUnitPrice]));
  const remainingEstimateValue = roundMoney(results.reduce((sum, line) => sum + value(Math.max(0, line.remainingQuantity), priceByLine.get(line.lineId) ?? 0), 0));
  const actuals = results.map(line => line.actualValue);
  const knownActuals = actuals.filter((item): item is number => item !== null);
  const actualValue = knownActuals.length !== actuals.length ? null : roundMoney(knownActuals.reduce((sum, item) => sum + item, 0));
  const pendingChangeEstimateValue = roundMoney(pending.reduce((sum, change) => sum + value(change.quantityDelta, change.estimateUnitPrice ?? lines.find(line => line.lineId === change.lineId)?.estimateUnitPrice ?? 0), 0));
  return { currency: input.currency, lines: results, periods, previousEstimateValue, currentEstimateValue: current.currentEstimateValue,
    cumulativeEstimateValue, remainingEstimateValue, actualValue, priceVariance: actualValue === null ? null : roundMoney(actualValue - cumulativeEstimateValue), pendingChangeEstimateValue, warnings };
}
