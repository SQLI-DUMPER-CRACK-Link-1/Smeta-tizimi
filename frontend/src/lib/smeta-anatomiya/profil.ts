/**
 * Varaq PROFILI (SMETA_ANATOMIYA_V1 §6) — modul qanday "o'rganadi".
 *
 * Profil = varaq imzosi (sarlavha matnlari + ustun tartibi + varaq nomi naqshi)
 * → rol, format, ustun xaritasi. Keyingi faylda imzo mos kelsa, profil
 * tasdiqlangan tuzilmani beradi. Profil hech qachon QIYMAT o'ylab topmaydi —
 * faqat "qaysi katak nima" ni aytadi. Kompaniya bo'yicha bazada saqlash
 * (versiya, audit) — alohida migratsiya bilan (egasi qarori); hozircha korpus
 * manifestida saqlanadi va solishtiriladi.
 */
import type { UstunXaritasi, VaraqAnatomiyasi } from './turlar';

export type SmetaFormat = 'abc4' | 'tn' | 'lrv_plus' | 'nomalum';

export type VaraqProfili = {
  /** Barqaror imzo (FNV-1a 32 bit, hex): sarlavha matnlari + ustunlar + nom naqshi. */
  imzo: string;
  rol: VaraqAnatomiyasi['rol'];
  format: SmetaFormat;
  ustunlar: UstunXaritasi | null;
  /** Nom naqshi: raqamlar va obyekt nomlari olib tashlangan (NNNN_БВ → #_БВ). */
  nomNaqshi: string;
};

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export function nomNaqshi(varaq: string): string {
  return varaq.toUpperCase().replace(/Ё/g, 'Е').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

/**
 * Format dalili varaq darajasida (Sun'iy ko'l: LRV — TN, RES — ABC4).
 * ABC4: RES/LRV/F5_UZB/RES_A, NNNN_БВ/_БР, "РАЗДЕЛ:" prefiksi; TN: "ТН"/
 * "ТЕРРИТОРИАЛЬН" belgisi; LRV_PLUS: tizimning o'z eksporti (ТИП ustuni).
 */
export function formatAniqla(varaq: string, sarlavhalar: readonly string[], titulMatn = ''): SmetaFormat {
  const n = nomNaqshi(varaq);
  const s = sarlavhalar.join(' | ');
  if (/^(LRV_PLUS|FORMA_2)$/.test(n) || /\bТИП\b/.test(s) && /ҲАЖМ/.test(s)) return 'lrv_plus';
  if (/(^|\W)(ТН|TN)(\W|$)|ТЕРРИТОРИАЛЬН/.test(`${n} ${titulMatn}`)) return 'tn';
  if (/^(RES|RES_A|LRV|F#_UZB|F5_UZB)$|_БВ$|_БР$|_ЛРВ$|_РС$/.test(n) || /ABC ?4|АВС ?4/.test(`${n} ${titulMatn}`)) return 'abc4';
  return 'nomalum';
}

export function varaqProfili(v: VaraqAnatomiyasi, sarlavhalar: readonly string[], titulMatn = ''): VaraqProfili {
  const naqsh = nomNaqshi(v.varaq);
  const u = v.ustunlar;
  const ustunImzo = u ? [u.tartib, u.shifr, u.nom, u.birlik, u.hajmBirlikka, u.hajmLoyiha, u.narx, u.summa].join(',') : '-';
  return {
    imzo: fnv1a([naqsh.replace(/#/g, ''), sarlavhalar.map((x) => x.trim()).join('|'), ustunImzo].join('§')),
    rol: v.rol,
    format: formatAniqla(v.varaq, sarlavhalar, titulMatn),
    ustunlar: u,
    nomNaqshi: naqsh,
  };
}

/** Saqlangan profil yangi varaqqa mosmi (imzo teng — tuzilma tasdiqlangan). */
export function profilMos(saqlangan: Pick<VaraqProfili, 'imzo'>, yangi: Pick<VaraqProfili, 'imzo'>): boolean {
  return saqlangan.imzo === yangi.imzo;
}
