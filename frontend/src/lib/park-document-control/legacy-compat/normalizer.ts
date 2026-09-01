import type { ParkCalculationInput, ParkCertifiedLine, ParkLine } from '..';
import type { LegacyCompatibilityInput, LegacyF2PeriodRow, LegacyNormalizationResult, LegacySmetaRow } from './types';

const number = (value: number | undefined) => value === undefined || value === null ? undefined : Number(value);
const key = (row: Pick<LegacySmetaRow, 'stableId' | 'migrationKey' | 'sourceSheet' | 'rowNumber'>) => row.stableId || row.migrationKey || `legacy-migration:${row.sourceSheet}:${row.rowNumber}`;

/** Stable IDs are preserved; a row location becomes an explicitly legacy migration identity only. */
export function legacyIdentity(row: LegacySmetaRow) {
  const id = key(row);
  return { parkLineId: id, identityKind: row.stableId || row.migrationKey ? 'stable_id' as const : 'migration_identity' as const,
    legacyLocation: `${row.sourceSheet}!${row.rowNumber}` };
}

function legacyRowKey(row: LegacyF2PeriodRow) { return row.migrationKey || `legacy-migration:${row.sourceSheet}:${row.rowNumber}`; }

/**
 * Legacy Q propagation: resource rows inherit a BL period proportion only when
 * the resource has no direct F2 quantity. A direct F2 resource value wins.
 */
function normalizedPeriod(rows: readonly LegacySmetaRow[], periodRows: readonly LegacyF2PeriodRow[]): ParkCertifiedLine[] {
  const byKey = new Map(periodRows.map(row => [legacyRowKey(row), row]));
  const byMigration = new Map(rows.map(row => [key(row), row]));
  const output: ParkCertifiedLine[] = [];
  for (const row of rows) {
    const direct = byKey.get(key(row));
    let quantity = number(direct?.quantity);
    if (quantity === undefined && row.marker === 'rs' && row.parentMigrationKey) {
      const parent = byMigration.get(row.parentMigrationKey);
      const parentF2 = parent ? byKey.get(key(parent)) : undefined;
      if (parent && parentF2?.quantity !== undefined && parent.baselineQuantity !== 0) {
        quantity = row.baselineQuantity * (parentF2.quantity / parent.baselineQuantity);
      }
    }
    if (quantity === undefined) continue;
    output.push({ lineId: key(row), quantity, actualUnitPrice: number(direct?.actualUnitPrice) });
  }
  return output;
}

export function normalizeLegacyF2(input: LegacyCompatibilityInput): LegacyNormalizationResult {
  const warnings: string[] = [];
  const lines: ParkLine[] = input.rows.map(row => {
    if (!row.stableId && !row.migrationKey) warnings.push(`LEGACY_MIGRATION_IDENTITY:${row.sourceSheet}:${row.rowNumber}`);
    return { lineId: key(row), sectionId: row.sectionKey, description: row.description, unit: row.unit,
      baselineQuantity: row.baselineQuantity, estimateUnitPrice: row.estimateUnitPrice };
  });
  const canonical: ParkCalculationInput = { currency: input.currency, lines, changes: [], throughPeriod: input.throughPeriod,
    periods: input.periods.map(period => ({ periodId: period.periodId, periodLabel: period.periodLabel, revisionId: period.revisionId,
      frozen: period.frozen, documentTotal: period.documentTotal, lines: normalizedPeriod(input.rows, period.rows) })) };
  return { input: canonical, identities: input.rows.map(legacyIdentity), warnings };
}
