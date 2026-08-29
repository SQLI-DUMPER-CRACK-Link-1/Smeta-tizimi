import type { NormCandidate, NormMatcher, WorkContext } from './types';

/** Empty by design until a licensed/verified normative catalogue adapter is attached. */
export class NoNormDataMatcher implements NormMatcher {
  findCandidates(_context: WorkContext): NormCandidate[] { return []; }
}
export function collectNormCandidates(matcher: NormMatcher, context: WorkContext): Promise<NormCandidate[]> { return Promise.resolve(matcher.findCandidates(context)); }
