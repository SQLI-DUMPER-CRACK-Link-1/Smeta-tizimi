/**
 * hujjat-yozuvchi/varaq.ts — ASL varaq XML ini o'qish va DAVOM ettirish (H1).
 *
 * Tender Oferta V3 eksportidan ajratilgan (xatti-harakat o'zgarmagan):
 *   - asl `<c>` hujayralar bayt-bayt saqlanadi; qiymatli asl katakka hech
 *     qachon tegilmaydi (faqat bo'sh formatlangan katak yangisi bilan almashadi);
 *   - yangi katak uslubi shu qatordagi ASL ustun katagidan klonlanadi (`klon`);
 *   - sarlavha/bo'lim birlashmalari yangi ustunlargacha cho'ziladi;
 *   - ustun kengligi asl ustundan nusxalanadi; `dimension` kengayadi;
 *   - egasining qo'lda qo'ygan `colBreaks` (jadval oxiri) yangi blok oxiriga
 *     ko'chadi; sahifa `scale` eni oshgan ulushda kamaytiriladi.
 */
import { ustunHarfi, ustunIndeksi, type YangiHujayra } from './ooxml';

// ───────────────────────── varaq XML o'qish ─────────────────────────

export type VaraqPatch = {
  rows: Map<number, YangiHujayra[]>;
  /** Yangi ustunlar kengligi: `nusxa` — asl ustun (kengligi/uslubi olinadi). */
  ustunlar: Array<{ col: number; nusxa?: number; width?: number; hidden?: boolean }>;
  /** Yangi ustunlar oralig‘i [bosh, oxirgiKorinadigan, oxirgi] (0-based). */
  oraliq: [number, number, number];
  /** Asl jadvalning oxirgi (СУММА) ustuni — chop etish eni shu bo'yicha. */
  aslOxirgi: number;
  /** Birlashmalarni kengaytirish: shu ustunda tugagan merge yangi ustunga cho‘ziladi. */
  mergeChoz: { dan: number; gacha: number };
  /** Yangi birlashmalar (masalan sarlavha bloki). */
  yangiMerge: string[];
};

export function prefiks(xml: string): string {
  const m = xml.match(/<(\w+:)?sheetData\b/);
  if (!m) throw new Error('SHEETDATA_YOQ');
  return m[1] ?? '';
}

/** Varaqdagi eng o'ng band ustun (hujayralar, dimension, merge). */
export function engOngUstun(xml: string): number {
  let max = 0;
  for (const m of xml.matchAll(/<(?:\w+:)?c\b[^>]*?\br="([A-Z]+)\d+"/g)) max = Math.max(max, ustunIndeksi(m[1]));
  for (const m of xml.matchAll(/<(?:\w+:)?mergeCell\b[^>]*?\bref="[A-Z]+\d+:([A-Z]+)\d+"/g)) max = Math.max(max, ustunIndeksi(m[1]));
  const dim = xml.match(/<(?:\w+:)?dimension\b[^>]*?\bref="([A-Z]+)\d+(?::([A-Z]+)\d+)?"/);
  if (dim) max = Math.max(max, ustunIndeksi(dim[2] ?? dim[1]));
  return max;
}

export type AslKatak = { col: number; xml: string; s: string | null; bosh: boolean; v: string | null };

const cellRe = (p: string) => new RegExp(`<${p}c\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${p}c>)`, 'g');

export function qatorKataklari(rowInner: string, p: string): AslKatak[] {
  return [...rowInner.matchAll(cellRe(p))].map((m) => {
    const x = m[0];
    const open = x.match(new RegExp(`^<${p}c\\b([^>]*?)\\/?>`))?.[1] ?? '';
    const ref = open.match(/\br="([A-Z]+)\d+"/)?.[1] ?? 'A';
    const bosh = !new RegExp(`<${p}(?:v|f|is)\\b`).test(x);
    const t = open.match(/\bt="([^"]+)"/)?.[1];
    const v = t === 's' || t === 'inlineStr' ? null : x.match(new RegExp(`<${p}v>([^<]*)<\\/${p}v>`))?.[1] ?? null;
    return { col: ustunIndeksi(ref), xml: x, s: open.match(/\bs="(\d+)"/)?.[1] ?? null, bosh, v };
  });
}

export type VaraqXarita = { qatorlar: Map<number, AslKatak[]>; oxirgiQator: number; merges: Array<{ r1: number; c1: number; r2: number; c2: number }> };

export function varaqXaritasi(xml: string): VaraqXarita {
  const p = prefiks(xml);
  const qatorlar = new Map<number, AslKatak[]>();
  let oxirgiQator = 0;
  for (const m of xml.matchAll(new RegExp(`<${p}row\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}row>)`, 'g'))) {
    const r = Number(m[1].match(/\br="(\d+)"/)?.[1]);
    if (!r) continue;
    const cells = m[3] ? qatorKataklari(m[3], p) : [];
    qatorlar.set(r, cells);
    if (cells.some((c) => !c.bosh)) oxirgiQator = Math.max(oxirgiQator, r);
  }
  const merges = [...xml.matchAll(/<(?:\w+:)?mergeCell\b[^>]*?\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)]
    .map((m) => ({ c1: ustunIndeksi(m[1]), r1: Number(m[2]), c2: ustunIndeksi(m[3]), r2: Number(m[4]) }));
  return { qatorlar, oxirgiQator, merges };
}

export type ColYozuv = { min: number; max: number; attrs: string };

export function colsOqi(xml: string): ColYozuv[] {
  const m = xml.match(/<(?:\w+:)?cols\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cols>/);
  if (!m) return [];
  return [...m[1].matchAll(/<(?:\w+:)?col\b([^>]*?)\/?>/g)].map((c) => ({
    min: Number(c[1].match(/\bmin="(\d+)"/)?.[1]),
    max: Number(c[1].match(/\bmax="(\d+)"/)?.[1]),
    attrs: c[1].replace(/\s(?:min|max)="\d+"/g, '').trim(),
  })).filter((c) => c.min && c.max);
}

export const colAttr = (cols: ColYozuv[], col: number, nom: string): string | null => {
  const c = cols.find((x) => col + 1 >= x.min && col + 1 <= x.max);
  return c?.attrs.match(new RegExp(`\\b${nom}="([^"]*)"`))?.[1] ?? null;
};

/** Yangi ustunlar asl jadvalning OXIRGI ustunidan (smeta summa) keyin darhol
 * boshlanadi — agar u yerdagi kataklar faqat bo‘sh formatlangan bo‘lsa.
 * Ma’lumot yoki birlashma bo‘lsa, butun band hududdan keyin qo‘yiladi. */
export function boshUstun(x: VaraqXarita, summaUstuni: number, kenglik: number, engOng: number): number {
  const bosh = summaUstuni + 1;
  const oxir = bosh + kenglik - 1;
  for (const cells of x.qatorlar.values()) {
    if (cells.some((c) => c.col >= bosh && c.col <= oxir && !c.bosh)) return engOng + 1;
  }
  if (x.merges.some((m) => m.c2 >= bosh && m.c1 <= oxir)) return engOng + 1;
  return bosh;
}

// ───────────────────────── varaq XML patch ─────────────────────────

export function varaqniPatchla(xml: string, patch: VaraqPatch, x: VaraqXarita): string {
  const p = prefiks(xml);
  const cols = colsOqi(xml);
  const [bosh, , oxirgi] = patch.oraliq;
  const rowRe = new RegExp(`<${p}row\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}row>)`, 'g');
  const sdRe = new RegExp(`<${p}sheetData\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${p}sheetData>)`);
  const sd = xml.match(sdRe);
  if (!sd) throw new Error('SHEETDATA_YOQ');
  const inner = sd[3] ?? '';
  const qolgan = new Map(patch.rows);

  const uslub = (r: number, h: YangiHujayra): number => {
    if (h.klon != null) {
      const asl = x.qatorlar.get(r)?.find((c) => c.col === h.klon);
      if (asl?.s != null) return Number(asl.s);
      const colS = colAttr(cols, h.klon, 'style');
      if (colS != null) return Number(colS);
    }
    return h.s;
  };
  const yangiXml = (r: number, cells: YangiHujayra[]) => cells.map((c) => ({ col: c.col, xml: c.xml(`${ustunHarfi(c.col)}${r}`, uslub(r, c)) }));
  const prefiksla = (s: string) => (p ? s.replace(/<(\/?)(c|f|v|is|t)\b/g, (_m, sl, tag) => `<${sl}${p}${tag}`) : s);
  const birlashtir = (r: number, asl: AslKatak[], cells: YangiHujayra[]) => {
    const yangi = yangiXml(r, cells);
    const band = new Set(yangi.map((c) => c.col));
    // Yangi ustundagi BO‘SH formatlangan asl katak o‘rniga yangisi yoziladi;
    // qiymatli asl katakka hech qachon tegilmaydi (boshUstun buni kafolatlaydi).
    const saqlanadi = asl.filter((c) => !(band.has(c.col) && c.bosh));
    return [...saqlanadi.map((c) => ({ col: c.col, xml: c.xml })), ...yangi.map((c) => ({ col: c.col, xml: prefiksla(c.xml) }))]
      .sort((a, b) => a.col - b.col).map((c) => c.xml).join('');
  };
  const newRow = (r: number, cells: YangiHujayra[]) => `<${p}row r="${r}">${birlashtir(r, [], cells)}</${p}row>`;
  const oldingilar = (rNum: number) => [...qolgan.keys()].filter((r) => r < rNum).sort((a, b) => a - b);

  let out = '';
  let lastIndex = 0;
  for (const m of inner.matchAll(rowRe)) {
    const attrs = m[1];
    const rNum = Number((attrs.match(/\br="(\d+)"/) || [])[1]);
    out += inner.slice(lastIndex, m.index);
    for (const r of oldingilar(rNum)) { out += newRow(r, qolgan.get(r)!); qolgan.delete(r); }
    const cells = qolgan.get(rNum);
    if (cells) {
      qolgan.delete(rNum);
      // spans — ixtiyoriy optimallashtirish atributi; yangi ustun uni buzmasin.
      const a = attrs.replace(/\sspans="[^"]*"/, '');
      out += `<${p}row${a}>${birlashtir(rNum, m[3] ? qatorKataklari(m[3], p) : [], cells)}</${p}row>`;
    } else {
      out += m[0];
    }
    lastIndex = (m.index ?? 0) + m[0].length;
  }
  out += inner.slice(lastIndex);
  for (const r of [...qolgan.keys()].sort((a, b) => a - b)) out += newRow(r, qolgan.get(r)!);

  let res = xml.replace(sdRe, () => `<${p}sheetData${sd[1]}>${out}</${p}sheetData>`);

  const oxirgiQator = Math.max(x.oxirgiQator, ...patch.rows.keys());
  res = res.replace(new RegExp(`(<${p}dimension\\b[^>]*?\\bref=")([A-Z]+)(\\d+)(?::([A-Z]+)(\\d+))?(")`), (_m, a, c1, r1, c2, r2, z) => {
    const endCol = Math.max(ustunIndeksi(c2 ?? c1), oxirgi);
    const endRow = Math.max(Number(r2 ?? r1), oxirgiQator);
    return `${a}${c1}${r1}:${ustunHarfi(endCol)}${endRow}${z}`;
  });

  // Birlashmalar: sarlavha va bo‘lim qatorlari asl jadvalning oxirgi
  // ustunida tugagan bo‘lsa — yangi ustunlargacha cho‘ziladi (matn butun
  // hujjat ustida markazda qoladi). Yangi birlashmalar qo‘shiladi.
  const { dan, gacha } = patch.mergeChoz;
  res = res.replace(new RegExp(`(<${p}mergeCell\\b[^>]*?\\bref=")([A-Z]+)(\\d+:)([A-Z]+)(\\d+")`, 'g'), (all, a, c1, m1, c2, z) => (ustunIndeksi(c2) === dan && ustunIndeksi(c1) < dan ? `${a}${c1}${m1}${ustunHarfi(gacha)}${z}` : all));
  if (patch.yangiMerge.length) {
    const mc = new RegExp(`<${p}mergeCells\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${p}mergeCells>)`);
    const yangi = patch.yangiMerge.map((ref) => `<${p}mergeCell ref="${ref}"/>`).join('');
    if (mc.test(res)) {
      res = res.replace(mc, (_all, attrs: string, ichki: string | undefined) => {
        const n = ((ichki ?? '').match(new RegExp(`<${p}mergeCell\\b`, 'g')) || []).length + patch.yangiMerge.length;
        return `<${p}mergeCells${attrs.replace(/\scount="\d+"/, '')} count="${n}">${ichki ?? ''}${yangi}</${p}mergeCells>`;
      });
    } else {
      res = res.replace(new RegExp(`(<\\/${p}sheetData>)`), `$1<${p}mergeCells count="${patch.yangiMerge.length}">${yangi}</${p}mergeCells>`);
    }
  }

  // Ustunlar: asl D/E/F ustunlarining kengligi va sukut uslubi nusxalanadi.
  res = colsYoz(res, p, cols, patch.ustunlar);

  // Chop etish: asl sahifa masshtabi eni oshgan ulushda kamaytiriladi, hujjat
  // avvalgidek bitta sahifa eniga sig‘adi (fitToPage bo‘lsa Excel o‘zi sig‘diradi).
  const kengligi = (c: number) => Number(colAttr(cols, c, 'width') ?? 9.14);
  // Asl chop eni — A..СУММА; yangisi — A..oferta СУММА (oradagi egasining
  // yozuv ustunlari ham chop hududiga kiradi).
  const korinadi = (c: number) => colAttr(cols, c, 'hidden') !== '1';
  let aslEni = 0;
  for (let c = 0; c <= patch.aslOxirgi; c++) if (korinadi(c)) aslEni += kengligi(c);
  let qoshildi = 0;
  for (let c = patch.aslOxirgi + 1; c <= patch.oraliq[1]; c++) {
    const u = patch.ustunlar.find((x) => x.col === c);
    if (u) { if (!u.hidden) qoshildi += u.width ?? (u.nusxa != null ? kengligi(u.nusxa) : 9.14); } else if (korinadi(c)) qoshildi += kengligi(c);
  }
  void bosh;
  // Egasi jadval oxiriga (СУММА dan keyin) qo'lda sahifa bo'linishi qo'ygan
  // bo'lsa — maqsad "jadval shu yerda tugaydi": bo'linish oferta bloki oxiriga ko'chadi.
  res = res.replace(new RegExp(`<${p}colBreaks\\b[^>]*>[\\s\\S]*?<\\/${p}colBreaks>`), (blok) =>
    blok.replace(/(\bid=")(\d+)(")/g, (all, a: string, id: string, z: string) => (Number(id) === patch.aslOxirgi + 1 ? `${a}${patch.oraliq[1] + 1}${z}` : all)));
  res = res.replace(new RegExp(`<${p}pageSetup\\b([^>]*?)\\/?>`), (all, attrs: string) => {
    const sc = attrs.match(/\bscale="(\d+)"/);
    if (!sc || /\bfitToPage="1"/.test(res) || aslEni <= 0) return all;
    const yangiScale = Math.max(10, Math.floor(Number(sc[1]) * aslEni / (aslEni + qoshildi)));
    return all.replace(/\bscale="\d+"/, `scale="${yangiScale}"`);
  });
  return res;
}

export function colsYoz(xml: string, p: string, cols: ColYozuv[], yangi: VaraqPatch['ustunlar']): string {
  if (!yangi.length) return xml;
  let list = cols.map((c) => ({ ...c }));
  for (const u of yangi) {
    const idx = u.col + 1;
    const nusxa = u.nusxa != null ? cols.find((c) => u.nusxa! + 1 >= c.min && u.nusxa! + 1 <= c.max) : undefined;
    let attrs = nusxa ? nusxa.attrs.replace(/\s*\bhidden="\d"/, '').replace(/\s*\bbestFit="\d"/, '') : `width="${u.width ?? 12}" customWidth="1"`;
    if (u.width != null) attrs = attrs.replace(/\bwidth="[^"]*"/, `width="${u.width}"`);
    if (!/\bwidth=/.test(attrs)) attrs += ` width="${u.width ?? 12}" customWidth="1"`;
    if (u.hidden) attrs += ' hidden="1"';
    const next: ColYozuv[] = [];
    for (const c of list) {
      if (idx < c.min || idx > c.max) { next.push(c); continue; }
      if (c.min < idx) next.push({ min: c.min, max: idx - 1, attrs: c.attrs });
      if (c.max > idx) next.push({ min: idx + 1, max: c.max, attrs: c.attrs });
    }
    next.push({ min: idx, max: idx, attrs: attrs.trim() });
    list = next.sort((a, b) => a.min - b.min);
  }
  const body = list.map((c) => `<${p}col min="${c.min}" max="${c.max}" ${c.attrs}/>`).join('');
  const colsRe = new RegExp(`<${p}cols\\b[^>]*>[\\s\\S]*?<\\/${p}cols>`);
  if (colsRe.test(xml)) return xml.replace(colsRe, () => `<${p}cols>${body}</${p}cols>`);
  return xml.replace(new RegExp(`<${p}sheetData\\b`), (m) => `<${p}cols>${body}</${p}cols>${m}`);
}

/**
 * H4: varaq chop etilganda bitta sahifa eniga sig'sin — FAQAT egasi o'zi
 * masshtab (`scale`) yoki `fitToPage` qo'ymagan bo'lsa. Mavjud sozlamaga
 * tegilmaydi (egasining qarori ustun). Qo'shiladi: `pageSetUpPr fitToPage`,
 * `fitToWidth=1 fitToHeight=0`, qog'oz ko'rsatilmagan bo'lsa — A4.
 */
export function sahifaEnigaSigdir(xml: string): string {
  const p = prefiks(xml);
  if (/<(?:\w+:)?pageSetUpPr\b[^>]*\bfitToPage="(?:1|true)"/.test(xml)) return xml;
  if (new RegExp(`<${p}pageSetup\\b[^>]*\\bscale="`).test(xml)) return xml;
  let res = xml;
  // sheetPr → pageSetUpPr (sheetPr — worksheet ning birinchi bolasi).
  const spFull = new RegExp(`<${p}sheetPr\\b([^>]*)>([\\s\\S]*?)<\\/${p}sheetPr>`);
  const spSelf = new RegExp(`<${p}sheetPr\\b([^>]*?)\\/>`);
  if (spFull.test(res)) {
    res = res.replace(spFull, (_a, attrs: string, ichki: string) => {
      const yangi = /<(?:\w+:)?pageSetUpPr\b/.test(ichki)
        ? ichki.replace(/<((?:\w+:)?pageSetUpPr)\b([^>]*?)\/?>/, (_m, t: string, at: string) => `<${t}${at.replace(/\s*fitToPage="[^"]*"/, '')} fitToPage="1"/>`)
        : `${ichki}<${p}pageSetUpPr fitToPage="1"/>`;
      return `<${p}sheetPr${attrs}>${yangi}</${p}sheetPr>`;
    });
  } else if (spSelf.test(res)) {
    res = res.replace(spSelf, (_a, attrs: string) => `<${p}sheetPr${attrs}><${p}pageSetUpPr fitToPage="1"/></${p}sheetPr>`);
  } else {
    res = res.replace(new RegExp(`(<${p}worksheet\\b[^>]*>)`), `$1<${p}sheetPr><${p}pageSetUpPr fitToPage="1"/></${p}sheetPr>`);
  }
  const ps = new RegExp(`<${p}pageSetup\\b([^>]*?)\\/?>`);
  if (ps.test(res)) {
    res = res.replace(ps, (_a, attrs: string) => {
      let at = attrs.replace(/\s*\bfitTo(?:Width|Height)="[^"]*"/g, '');
      if (!/\bpaperSize=/.test(at)) at += ' paperSize="9"';
      return `<${p}pageSetup${at} fitToWidth="1" fitToHeight="0"/>`;
    });
  } else {
    const tag = `<${p}pageSetup paperSize="9" fitToWidth="1" fitToHeight="0"/>`;
    const pm = new RegExp(`<${p}pageMargins\\b[^>]*\\/>`);
    if (pm.test(res)) res = res.replace(pm, (m) => m + tag);
    else {
      const keyin = ['headerFooter', 'rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];
      const idx = keyin.map((t) => res.search(new RegExp(`<${p}${t}\\b`))).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      res = idx != null ? res.slice(0, idx) + tag + res.slice(idx) : res.replace(new RegExp(`<\\/${p}worksheet>`), `${tag}</${p}worksheet>`);
    }
  }
  return res;
}
