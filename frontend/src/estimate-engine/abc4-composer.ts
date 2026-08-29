import type { Abc4ComposeResult, Abc4Profile, EstimateDocument } from './types';

/** Does not invent ABC4 grammar. Until a verified sample/profile is supplied it emits reviewable text only. */
export function composeAbc4Text(estimate: EstimateDocument, profile: Abc4Profile): Abc4ComposeResult {
  const lines = [`ESTIMATE: ${estimate.title}`, `ABC4 profile: ${profile.name}`, ''];
  for (const section of estimate.sections) { lines.push(`[${section.name}]`); for (const work of section.items) lines.push(`- ${work.name}${work.quantity != null ? ` | ${work.quantity} ${work.unit}` : ''}${work.attributes.concreteGrade ? ` | grade ${work.attributes.concreteGrade}` : ''}`); }
  const grammarStatus = profile.grammarStatus;
  return { grammarStatus, text: lines.join('\n'), issues: grammarStatus === 'NEEDS_SAMPLE' ? [{ severity: 'warning', code: 'ABC4_GRAMMAR_NEEDS_SAMPLE', message: 'No verified ABC4 grammar/profile is available; this is not an ABC4 import file.', requiredAction: 'Provide a real ABC4 export/sample and grammar mapping.' }] : [] };
}
