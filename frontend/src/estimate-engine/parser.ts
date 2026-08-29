import { normalizeUnit } from './unit-normalizer';
import type { EstimateDocument, EstimateWorkItem, Evidence, ParsedFact, ParseResult, QuantityUnit, ValidationIssue } from './types';

const evidence = (value: string): Evidence => ({ kind: 'user_text', value });
const cleanNumber = (raw: string) => Number(raw.replace(',', '.'));
const qtyUnit = (rawQty: string, rawUnit: string): { quantity: number; unit: QuantityUnit } | null => {
  const unit = normalizeUnit(rawUnit); const quantity = cleanNumber(rawQty);
  return unit && Number.isFinite(quantity) ? { quantity, unit } : null;
};
const item = (id: string, name: string, sourceText: string, quantity?: number, unit?: QuantityUnit): EstimateWorkItem => ({
  id, name, quantity, unit, source: [evidence(sourceText)], sourceConfidence: 0.95, normCandidateIds: [], assumptions: [], questions: [], attributes: {}, resources: [],
});

/** Rule-based V1 extraction. It deliberately produces no quantities beyond explicit text. */
export function parseConstructionText(text: string): ParseResult {
  const facts: ParsedFact[] = []; const items: EstimateWorkItem[] = []; const issues: ValidationIssue[] = [];
  const source = text.trim(); let number = 0;
  const concretePatterns = [
    { kind: 'concrete_preparation', re: /\b(podbetonka|подбетонка)\b[^.\n;]*?(\d+(?:[.,]\d+)?)\s*(kub|куб|m3|m³|м3|м³)[^.\n;]*?\b(B\s*\d+(?:[.,]\d+)?)\b/gi },
    { kind: 'concrete_preparation', re: /\b(podbetonka|подбетонка)\b[^.\n;]*?\b(B\s*\d+(?:[.,]\d+)?)\b[^.\n;]*?(\d+(?:[.,]\d+)?)\s*(kub|куб|m3|m³|м3|м³)/gi },
    { kind: 'structural_concrete', re: /\b(B\s*\d+(?:[.,]\d+)?)\b\s*(?:dan|из)?\s*(\d+(?:[.,]\d+)?)\s*(kub|куб|m3|m³|м3|м³)\s*(?:beton|бетон)?/gi },
    { kind: 'structural_concrete', re: /\b(B\s*\d+(?:[.,]\d+)?)\b\s*(?:beton|бетон)\s*(\d+(?:[.,]\d+)?)\s*(kub|куб|m3|m³|м3|м³)/gi },
  ] as const;
  const seen = new Set<string>();
  for (const rule of concretePatterns) for (const m of source.matchAll(rule.re)) {
    const isPrep = rule.kind === 'concrete_preparation';
    const prepGradeFirst = isPrep && /^B\s*\d/i.test(m[2]);
    const grade = (isPrep ? (prepGradeFirst ? m[2] : m[4]) : m[1]).replace(/\s/g, '').toUpperCase();
    const q = isPrep
      ? (prepGradeFirst ? qtyUnit(m[3], m[4]) : qtyUnit(m[2], m[3]))
      : qtyUnit(m[2], m[3]);
    if (!q) continue; const key = `${rule.kind}:${grade}:${q.quantity}:${q.unit}`; if (seen.has(key)) continue; seen.add(key);
    const work = item(`work-${++number}`, rule.kind, m[0], q.quantity, q.unit); work.attributes.concreteGrade = grade; items.push(work);
    facts.push({ state: 'known', field: `${rule.kind}.quantity`, value: q.quantity, unit: q.unit, evidence: [evidence(m[0])] });
    facts.push({ state: 'known', field: `${rule.kind}.concreteGrade`, value: grade, evidence: [evidence(m[0])] });
  }
  const reinforcement = /\b(\d+(?:[.,]\d+)?)\s*(?:lik|лиги|mm)?\s*(armatura|арматура|katanka|катанка)\s*(\d+(?:[.,]\d+)?)\s*(kg|кг|t|ton|тонна)/gi;
  const reinforcementItem = item(`work-${++number}`, 'reinforcement', source); let hasReinforcement = false;
  for (const m of source.matchAll(reinforcement)) {
    const q = qtyUnit(m[3], m[4]); if (!q) continue; hasReinforcement = true;
    const diameter = `Ø${cleanNumber(m[1])}`; reinforcementItem.resources.push({ type: 'material', name: `${diameter} ${m[2].toLowerCase()}`, quantity: q.quantity, unit: q.unit, evidence: [evidence(m[0])] });
    facts.push({ state: 'known', field: `reinforcement.${diameter}`, value: q.quantity, unit: q.unit, evidence: [evidence(m[0])] });
  }
  if (hasReinforcement) { reinforcementItem.sourceConfidence = 0.95; items.push(reinforcementItem); }
  if (items.some(x => x.name.includes('concrete') || x.name === 'reinforcement')) {
    for (const field of ['formwork', 'excavation', 'pour_method', 'reinforcement_connection_method']) {
      facts.push({ state: 'missing', field, evidence: [] });
      issues.push({ severity: 'warning', code: `MISSING_${field.toUpperCase()}`, message: `${field} was not stated; it was not added to the estimate.`, requiredAction: 'Confirm or provide source evidence.' });
    }
  }
  if (!items.length) issues.push({ severity: 'warning', code: 'NO_EXTRACTED_FACTS', message: 'No supported explicit quantity was extracted.', requiredAction: 'Provide structured quantities or extend parser rules.' });
  const document: EstimateDocument = { id: 'draft-text', title: 'Text-to-smeta draft', sections: [{ id: 'section-1', name: 'Extracted scope', items }], evidence: source ? [evidence(source)] : [] };
  return { document, facts, issues };
}
