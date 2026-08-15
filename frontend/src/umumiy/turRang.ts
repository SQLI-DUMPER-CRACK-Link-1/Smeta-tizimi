/**
 * turRang.ts — SMETA TUGUN TURLARI UCHUN YAGONA RANG TIZIMI
 *
 * Foydalanuvchi: «eski tizimda rz rs mat ob bl kabi har biri uchun vizual
 * qulay ajrata olish uchun ranglar bilan ajratilgan edi, bu tizimimizga
 * ham kerak u».
 *
 * Palitra `F2Tayyorlash.tsx:18` dagi MAVJUD konvensiyadan olingan —
 * yangi rang o'ylab topilmadi, bor narsa markazlashtirildi va `rz` bilan
 * to'ldirildi. Endi hamma sahifa bitta manbadan rang oladi.
 */

export type TugunTur = 'rz' | 'bl' | 'rs' | 'mat' | 'ob' | string;

/** Matn rangi (mavjud konvensiya) */
export const TUR_RANG: Record<string, string> = {
  rz:  'text-indigo-400',
  bl:  'text-purple-400',
  rs:  'text-blue-400',
  mat: 'text-yellow-400',
  ob:  'text-cyan-400',
};

/** Chap chegara chizig'i — jadval/daraxt qatorida turni bir qarashda ajratadi */
export const TUR_CHIZIQ: Record<string, string> = {
  rz:  'border-indigo-400',
  bl:  'border-purple-400',
  rs:  'border-blue-400',
  mat: 'border-yellow-400',
  ob:  'border-cyan-400',
};

/** Yorliq foni (chip) */
export const TUR_FON: Record<string, string> = {
  rz:  'bg-indigo-500/15 text-indigo-300',
  bl:  'bg-purple-500/15 text-purple-300',
  rs:  'bg-blue-500/15 text-blue-300',
  mat: 'bg-yellow-500/15 text-yellow-300',
  ob:  'bg-cyan-500/15 text-cyan-300',
};

/** Ko'rinadigan qisqartma */
export const TUR_NOM: Record<string, string> = {
  rz:  'РЗ',
  bl:  'БЛ',
  rs:  'РС',
  mat: 'МАТ',
  ob:  'ОБ',
};

/** Marker qatoridan asosiy turni ajratadi: 'rz+' → 'rz', 'bl~' → 'bl' */
export function turAsos(marker?: string | null): string {
  return String(marker || '').trim().toLowerCase().replace(/[+~]+$/, '');
}

/** `~` = zamena (almashtirilgan), `+` = qo'shimcha ish */
export function turBelgi(marker?: string | null): 'zamena' | 'qoshimcha' | null {
  const s = String(marker || '').trim();
  if (/~$/.test(s)) return 'zamena';
  if (/\+$/.test(s)) return 'qoshimcha';
  return null;
}

const ZAXIRA_MATN = 'text-text-mute';
const ZAXIRA_CHIZIQ = 'border-white/20';
const ZAXIRA_FON = 'bg-white/10 text-text-mute';

export const rangMatn  = (m?: string | null) => TUR_RANG[turAsos(m)]   || ZAXIRA_MATN;
export const rangChiziq = (m?: string | null) => TUR_CHIZIQ[turAsos(m)] || ZAXIRA_CHIZIQ;
export const rangFon   = (m?: string | null) => TUR_FON[turAsos(m)]    || ZAXIRA_FON;
export const turNomi   = (m?: string | null) => TUR_NOM[turAsos(m)]     || (turAsos(m) || '?').toUpperCase();

/** Zamena/qo'shimcha ramkasi — turdan ustun turadi (ko'zga darhol tashlanadi) */
export function belgiRamka(marker?: string | null): string {
  const b = turBelgi(marker);
  if (b === 'zamena')    return 'ring-1 ring-rose-400/50';
  if (b === 'qoshimcha') return 'ring-1 ring-emerald-400/50';
  return '';
}
