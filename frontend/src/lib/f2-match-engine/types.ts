/**
 * Types for the ported F2 matching engine.
 * Source of truth this mirrors: `Smeta tizimi/35_F2Moslash.js` (`f2MoslashEngine`).
 * Field names are kept in their original Uzbek/Russian form (`kod`, `nom`,
 * `bir`/`birlik`, `hajm`, `varaq`, `row`, `lokalka`) so a reviewer can diff
 * this port against the GAS source line-by-line without a naming layer in
 * between.
 */

export type F2NodeType = 'rz' | 'bl' | 'rs' | 'mat' | 'ob';

/** F2 act tree node (`apiF2FaylOqi` output shape). Unit field is `bir`. */
export interface AktNode {
  uid: string;
  type: F2NodeType;
  kod?: string;
  nom?: string;
  bir?: string;
  hajm?: number;
  narx?: number;
  summa?: number;
  children?: AktNode[];
}

/** LRV_PLUS tree node (`apiHolatOl(...).tree` shape). Unit field is `birlik` — asymmetric on purpose, matches the GAS source. */
export interface LrvNode {
  type: F2NodeType;
  kod?: string;
  nom?: string;
  birlik?: string;
  varaq: string;
  row: number;
  lokalka?: string;
  children?: LrvNode[];
}

export interface F2MatchOptions {
  /** '' or undefined or 'AVTO' => no lokalka restriction (global search across all sub-estimates). */
  lokalka?: string;
}

export interface F2Match {
  uid: string;
  varaq: string;
  row: number;
  kod?: string;
  hajm?: number;
  narx: number;
  summa: number;
}

export interface F2MatchStat {
  moslashti: number;
  otkazib: number;
  scopeHit: number;
  fuzzyHit: number;
  kanonHit: number;
  birlikBlok: number;
  zamenaShubha: number;
  yetimUrindi: number;
  yetimMos: number;
  lokalka: string;
  lokAuto: boolean;
  rzMos: number;
  rzJami: number;
  /** Only set by the caller (e.g. a Cloudflare Function measuring wall-clock time); the pure engine itself does not time itself. */
  ms?: number;
}

export interface RzDiagEntry {
  nom?: string;
  ok: boolean;
}

export interface F2MatchResult {
  mosliklar: F2Match[];
  sabablar: Record<string, string>;
  rzDiag: RzDiagEntry[];
  stat: F2MatchStat;
  /** uid -> candidate LRV rows the engine found but could not bind unambiguously (for manual pick UI). */
  takliflar: Record<string, LrvNode[]>;
}
