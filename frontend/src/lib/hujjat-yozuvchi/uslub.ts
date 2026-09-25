/**
 * hujjat-yozuvchi/uslub.ts — styles.xml bilan ishlash (asl hujjatni davom ettirish).
 *
 * Qonun (egasi, 2026-09-24): "ranglashni man o'zim uchun vizual qulaylikda
 * bo'lishi uchun qilganman … hamma berayotgan hujjatingda o'zing ijod qilib
 * tashlayapsan". Shuning uchun styles.xml ga RANG (fill) HECH QACHON
 * qo'shilmaydi. Yangi katak uslubi asl qo'shni/mos ustun katagidan klonlanadi;
 * bu yerdagi zaxira uslublar faqat asl katak topilmaganda ishlatiladi.
 */

/** styles.xml dagi ro'yxatga (fonts, cellXfs …) elementlar qo'shadi va
 * `count` ni yangilaydi. Qaytaradi: yangi XML va birinchi qo'shilgan indeks. */
export function appendToList(xml: string, tag: string, childTag: string, items: string[]): { xml: string; firstIndex: number } {
  const re = new RegExp(`<(\\w+:)?${tag}\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>)`);
  const m = xml.match(re);
  if (!m) throw new Error(`STYLES_${tag.toUpperCase()}_YOQ`);
  const p = m[1] ?? '';
  const inner = m[4] ?? '';
  const existing = (inner.match(new RegExp(`<${p}${childTag}\\b`, 'g')) || []).length;
  const attrs = m[2].replace(/\scount="\d+"/, '');
  const prefixed = items.map((it) => it.replace(/<(\/?)([a-zA-Z]+)/g, (_x, sl, t) => `<${sl}${p}${t}`));
  const replaced = `<${p}${tag}${attrs} count="${existing + items.length}">${inner}${prefixed.join('')}</${p}${tag}>`;
  return { xml: xml.replace(re, () => replaced), firstIndex: existing };
}

/** cellXfs ichidagi har bir `<xf>` elementi (indeks = uslub raqami `s`). */
export function cellXfRoyxati(stylesXml: string): string[] {
  const m = stylesXml.match(/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/);
  if (!m) return [];
  return [...m[1].matchAll(/<(?:\w+:)?xf\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?xf>)/g)].map((x) => x[0]);
}

/** Rangsiz zaxira uslublar indekslari. */
export type ZaxiraStillar = { header: number; text: number; son: number; jami: number; jamiMatn: number; foiz: number };

/** Faqat asl katak topilmaganda ishlatiladigan zaxira xf'lar: default shrift,
 * qalinlik, son formati. `fillId="0"` — rang qo'shilmaydi. */
export function zaxiraStillarQosh(stylesXml: string): { xml: string; s: ZaxiraStillar } {
  let xml = stylesXml;
  const fonts = appendToList(xml, 'fonts', 'font', ['<font><b/></font>']);
  xml = fonts.xml;
  const fB = fonts.firstIndex;
  const al = '<alignment wrapText="1" vertical="center"/>';
  const xfs = appendToList(xml, 'cellXfs', 'xf', [
    `<xf numFmtId="0" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">${al}</xf>`,
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">${al}</xf>`,
    `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    `<xf numFmtId="4" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`,
    `<xf numFmtId="0" fontId="${fB}" fillId="0" borderId="0" xfId="0" applyFont="1"/>`,
    `<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
  ]);
  xml = xfs.xml;
  const b = xfs.firstIndex;
  return { xml, s: { header: b, text: b + 1, son: b + 2, jami: b + 3, jamiMatn: b + 4, foiz: b + 5 } };
}

/** Egasining mavjud uslubini (chegara, shrift, rang) aynan nusxalab, faqat son
 * formatini almashtiradi — masalan foiz uchun "0.00". Yangi rang yo‘q. */
export function xfNusxa(stylesXml: string, idx: number, numFmtId: number): { xml: string; s: number | null } {
  const xf = cellXfRoyxati(stylesXml)[idx];
  if (!xf) return { xml: stylesXml, s: null };
  const yangi = xf.replace(/\snumFmtId="\d+"/, '').replace(/<((?:\w+:)?xf)\b/, `<$1 numFmtId="${numFmtId}"`)
    .replace(/\sapplyNumberFormat="\d"/, '').replace(/<((?:\w+:)?xf)\b/, '<$1 applyNumberFormat="1"')
    .replace(/<(\/?)\w+:/g, '<$1');
  const r = appendToList(stylesXml, 'cellXfs', 'xf', [yangi]);
  return { xml: r.xml, s: r.firstIndex };
}

/** styles.xml dagi `<fill>` soni — testlar "yangi rang qo'shilmadi" ni shu bilan isbotlaydi. */
export function fillSoni(stylesXml: string): number {
  const m = stylesXml.match(/<(?:\w+:)?fills\b[^>]*>([\s\S]*?)<\/(?:\w+:)?fills>/);
  return m ? (m[1].match(/<(?:\w+:)?fill\b/g) || []).length : 0;
}
