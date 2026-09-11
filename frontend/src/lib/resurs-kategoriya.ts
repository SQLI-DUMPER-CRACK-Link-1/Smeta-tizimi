/**
 * Pure, name-only classification for the additional БЕЗСКЛАД category.
 *
 * The existing `T2ResursKategoriya` union is intentionally not imported or
 * changed here. Integrators can combine this result with that legacy type at
 * their boundary without making this module depend on API transport types.
 *
 * Matching is deliberately conservative: only the exact normalized tokens in
 * `BEZSKLAD_TAYANCH_TOKENS` are positive evidence. There is no stem matching,
 * fuzzy matching, price lookup, unit lookup, or storage-side effect.
 */

/** The category value returned for a confidently classified resource name. */
export const BEZSKLAD_KATEGORIYA = 'БЕЗСКЛАД' as const;
export type BezskladKategoriya = typeof BEZSKLAD_KATEGORIYA;
export type ResursNomiKategoriya = BezskladKategoriya | null;

/**
 * Exact normalized name tokens that can establish БЕЗСКЛАД.
 *
 * The Russian and Latin spellings are separate explicit aliases on purpose;
 * they are not inferred from a transliteration heuristic.
 */
export const BEZSKLAD_TAYANCH_TOKENS = Object.freeze([
  'ВОДА',
  'SUV',
  'БЕТОН',
  'BETON',
  'РАСТВОР',
  'RASTVOR',
] as const);

/**
 * Exact normalized token phrases that override a positive token.
 *
 * These are limited to obvious storable concrete products and dry mortar
 * mixes. Phrase matching is token-based, so punctuation may separate words
 * but a longer word never counts as a phrase member.
 */
export const BEZSKLAD_ISTISNO_IBORALARI = Object.freeze([
  // Obvious concrete products (Russian).
  'БЕТОН БЛОК',
  'БЕТОН КОЛЬЦО',
  'БЕТОН КОЛЬЦА',
  'БЕТОН ПЛИТА',
  'БЕТОН ТРУБА',
  'БЕТОН ЛОТОК',
  'БЕТОН БОРДЮР',
  'БЕТОН СТОЛБ',
  'БЕТОННЫЙ БЛОК',
  'БЕТОННОЕ КОЛЬЦО',
  'БЕТОННЫЕ БЛОКИ',
  'БЕТОННЫЕ КОЛЬЦА',
  'БЕТОННЫЕ ПЛИТЫ',
  'БЕТОННЫЕ ТРУБЫ',
  'БЕТОННЫЕ ИЗДЕЛИЯ',
  // Obvious concrete products (Latin/Uzbek forms).
  'BETON BLOK',
  'BETON HALQA',
  'BETON PLITA',
  'BETON TRUBA',
  'BETON LOTOK',
  'BETON BORDYUR',
  'TEMIR BETON',
  // Dry mortar mixes (Russian, English, and Uzbek/Latin forms).
  'РАСТВОР СУХАЯ СМЕСЬ',
  'СУХАЯ СМЕСЬ',
  'СУХИЕ СМЕСИ',
  'РАСТВОР СУХОЙ',
  'СУХОЙ РАСТВОР',
  'СУХАЯ СТРОИТЕЛЬНАЯ СМЕСЬ',
  'DRY MORTAR MIX',
  'DRY MORTAR',
  'DRY MIX',
  'QURUQ QORISHMA',
  'QURUQ ARALASHMA',
  'QURUQ QURILISH ARALASHMASI',
] as const);

const BEZSKLAD_TAYANCH_SET = new Set<string>(BEZSKLAD_TAYANCH_TOKENS);

/**
 * Canonicalizes a resource name for deterministic token/phrase matching.
 * NFKD handles compatibility forms; combining marks and case are removed;
 * Ё/Е are treated alike; whitespace is made stable for callers that display
 * or log the normalized value.
 */
export function normalizeResursNomi(name: unknown): string {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Splits normalized text into Unicode letter/number tokens. */
function tokenlar(name: unknown): string[] {
  return normalizeResursNomi(name).match(/[\p{L}\p{N}]+/gu) ?? [];
}

const BEZSKLAD_ISTISNO_TOKENLARI = BEZSKLAD_ISTISNO_IBORALARI.map(tokenlar);

function iboraBor(tokens: readonly string[], phraseTokens: readonly string[]): boolean {
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) return false;
  for (let start = 0; start <= tokens.length - phraseTokens.length; start++) {
    let matches = true;
    for (let offset = 0; offset < phraseTokens.length; offset++) {
      if (tokens[start + offset] !== phraseTokens[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/**
 * Returns БЕЗСКЛАД only when the resource name matches the conservative
 * allowlist and none of the explicit storable-product exclusions.
 */
export function classifyResursKategoriya(name: unknown): ResursNomiKategoriya {
  const tokens = tokenlar(name);
  if (BEZSKLAD_ISTISNO_TOKENLARI.some((phrase) => iboraBor(tokens, phrase))) return null;
  return tokens.some((token) => BEZSKLAD_TAYANCH_SET.has(token)) ? BEZSKLAD_KATEGORIYA : null;
}

/** Boolean form for integrations that only need an inclusion check. */
export function isBezskladResurs(name: unknown): boolean {
  return classifyResursKategoriya(name) === BEZSKLAD_KATEGORIYA;
}
