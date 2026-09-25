/**
 * hujjat-yozuvchi/tekshir.ts — hujjat standartini (H1–H9) MASHINA bilan
 * tekshirish. Har bir `*.hujjat.test.ts` shu funksiyadan foydalanadi:
 *
 *   - H4: har ko'rinadigan varaqda A4, bir sahifa eniga sig'ish, Print_Area,
 *         Print_Titles;
 *   - H5: ko'rinadigan kataklarda texnik/dasturchi matni (TAYYOR, RESOURCE,
 *         t2_*, null, o'zbekcha lotin yorliqlar …) yo'q;
 *   - H6: hujayra formulalarida `$` yo'q, har formula keshlangan `<v>` bilan
 *         (natija noma'lum bo'lsa bo'sh qoldirilgani alohida sanaladi),
 *         workbook `fullCalcOnLoad=1`;
 *   - H1: asl fayl berilsa — asl kataklar bayt-bayt tekshiruvdan chiqariladi
 *         (egasining o'z matni H5/H9 ga tushmaydi).
 *
 * Faqat o'qiydi; hech narsa yozmaydi. Brauzer va Node (vitest) da ishlaydi.
 */
import { strFromU8, unzipSync } from 'fflate';
import { ustunIndeksi, unEsc } from './ooxml';
import { varaqYollari } from './kitob';

export type TekshirKatak = { ref: string; matn: string | null; f: string | null; v: string | null; xml: string };

export type TekshirVaraq = {
  nom: string;
  yol: string;
  yashirin: boolean;
  yashirinUstunlar: Set<number>;
  kataklar: TekshirKatak[];
  printArea: string | null;
  printTitles: string | null;
  a4: boolean;
  /** fitToPage + fitToWidth=1, yoki qo'lda `scale` (egasining asl sozlamasi). */
  bittaEnli: boolean;
  yonalish: string | null;
};

export type TaqiqlanganTopilma = { varaq: string; ref: string; matn: string; qoida: string };

export type HujjatHisobot = {
  varaqlar: TekshirVaraq[];
  fullCalcOnLoad: boolean;
  /** Ko'rinadigan YANGI kataklardagi taqiqlangan matnlar (H5/H9). */
  taqiqlangan: TaqiqlanganTopilma[];
  /** `$` li hujayra formulalari (H6). */
  dollarFormulalar: Array<{ varaq: string; ref: string; f: string }>;
  /** Keshlangan qiymatsiz formulalar (H6: UI == Excel ni ko'ruvchi ham ko'radi). */
  keshsizFormulalar: Array<{ varaq: string; ref: string; f: string }>;
  /** Barcha ko'rinadigan matnlar (imzo, sarlavha tekshiruvlari uchun). */
  matnlar: string[];
};

/** H5: hujjatga chiqmasligi kerak bo'lgan texnik/dasturchi matni. */
export const TAQIQLANGAN_QOIDALAR: ReadonlyArray<{ nom: string; re: RegExp }> = [
  { nom: 'TAYYOR', re: /\bTAYYOR\b/i },
  { nom: 'rol kodi', re: /\b(RESOURCE|SUBTOTAL|GRAND_TOTAL|SECTION|STORAGE|INFO|UNKNOWN|NOANIQ|BOSHQA)\b/ },
  { nom: 'RPC/jadval nomi', re: /\bt2_[a-z_]+|\bsb[A-Z]\w+|\bRPC\b|\bapi\//i },
  { nom: 'JS qiymat', re: /\b(null|undefined|NaN)\b|\[object /i },
  { nom: 'sayt ko‘rsatgan', re: /\bsayt\b/i },
  { nom: 'o‘zbekcha lotin yorliq', re: /\b(Hajm|Narx|Summa|Birlik|Nomi|Jami|Qoldiq|Obyekt|Davr|Kategoriya|Resurs|Smeta|Oldingi|Joriy|Hujjat|Shartnoma|Bajarilgan|Ishlar|Tayyor|Holat)\b/ },
  { nom: 'o‘zbek apostrofi', re: /[a-zA-Z][ʻ‘’'][a-z]/ },
  { nom: 'o‘zbekcha kirill (ў қ ғ ҳ)', re: /[ўқғҳЎҚҒҲ]/ },
  { nom: 'inglizcha yorliq', re: /\b(Total|Amount|Quantity|Price|Unit|Description|Warning|Error|Status|Pending|Draft)\b/ },
];

function atr(tag: string, nom: string): string | null {
  return tag.match(new RegExp(`\\b${nom}="([^"]*)"`))?.[1] ?? null;
}

function sharedStrings(files: Record<string, Uint8Array>): string[] {
  const x = files['xl/sharedStrings.xml'];
  if (!x) return [];
  const s = strFromU8(x);
  return [...s.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) =>
    [...m[1].matchAll(/<(?:\w+:)?t\b[^>]*>([^<]*)<\/(?:\w+:)?t>/g)].map((t) => unEsc(t[1])).join(''));
}

function kataklarOqi(xml: string, ss: string[]): TekshirKatak[] {
  const out: TekshirKatak[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
    const attrs = m[1];
    const inner = m[2] ?? '';
    const ref = atr(attrs, 'r') ?? '';
    const t = atr(attrs, 't');
    const fM = inner.match(/<(?:\w+:)?f\b[^>]*>([^<]*)<\/(?:\w+:)?f>/);
    const fShared = /<(?:\w+:)?f\b[^>]*t="shared"[^>]*\/>/.test(inner);
    const vM = inner.match(/<(?:\w+:)?v>([^<]*)<\/(?:\w+:)?v>/);
    let matn: string | null = null;
    if (t === 'inlineStr') matn = [...inner.matchAll(/<(?:\w+:)?t\b[^>]*>([^<]*)<\/(?:\w+:)?t>/g)].map((x) => unEsc(x[1])).join('');
    else if (t === 's' && vM) matn = ss[Number(vM[1])] ?? null;
    else if (t === 'str' && vM) matn = unEsc(vM[1]);
    out.push({ ref, matn, f: fM ? unEsc(fM[1]) : fShared ? '(shared)' : null, v: vM ? unEsc(vM[1]) : null, xml: m[0] });
  }
  return out;
}

/** Hujjatni o'qib standart bo'yicha hisobot beradi. `asl` — asl fayl (H1):
 * undagi bayt-bayt bir xil kataklar H5/H6 tekshiruvidan chiqariladi. */
export function hujjatTekshir(bytes: Uint8Array, o?: { asl?: Uint8Array; ruxsat?: readonly RegExp[] }): HujjatHisobot {
  const files = unzipSync(bytes);
  const wb = strFromU8(files['xl/workbook.xml']);
  const ss = sharedStrings(files);
  const yollar = varaqYollari(files);
  const aslKatak = new Map<string, Set<string>>();
  if (o?.asl) {
    const af = unzipSync(o.asl);
    const ass = sharedStrings(af);
    for (const y of varaqYollari(af)) {
      const x = af[y.path];
      if (!x) continue;
      aslKatak.set(y.name, new Set(kataklarOqi(strFromU8(x), ass).map((k) => `${k.ref}|${k.matn ?? ''}|${k.f ?? ''}`)));
    }
  }
  const sheetTags = [...wb.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)].map((m) => m[1]);
  const dn = (nom: string, i: number) => {
    for (const m of wb.matchAll(/<(?:\w+:)?definedName\b([^>]*)>([^<]*)<\/(?:\w+:)?definedName>/g)) {
      if (atr(m[1], 'name') === nom && atr(m[1], 'localSheetId') === String(i)) return unEsc(m[2]);
    }
    return null;
  };

  const hisobot: HujjatHisobot = {
    varaqlar: [], fullCalcOnLoad: /<(?:\w+:)?calcPr\b[^>]*\bfullCalcOnLoad="(?:1|true)"/.test(wb),
    taqiqlangan: [], dollarFormulalar: [], keshsizFormulalar: [], matnlar: [],
  };
  yollar.forEach((y, i) => {
    const xml = files[y.path] ? strFromU8(files[y.path]) : '';
    const tag = sheetTags[i] ?? '';
    const yashirin = /\bstate="(hidden|veryHidden)"/.test(tag);
    const yashirinUstunlar = new Set<number>();
    for (const c of xml.matchAll(/<(?:\w+:)?col\b([^>]*?)\/?>/g)) {
      if (!/\bhidden="(?:1|true)"/.test(c[1])) continue;
      const a = Number(atr(c[1], 'min')), b = Number(atr(c[1], 'max'));
      for (let k = a; k <= b; k++) yashirinUstunlar.add(k - 1);
    }
    const ps = xml.match(/<(?:\w+:)?pageSetup\b([^>]*?)\/?>/)?.[1] ?? '';
    const fitToPage = /<(?:\w+:)?pageSetUpPr\b[^>]*\bfitToPage="(?:1|true)"/.test(xml);
    const kataklar = kataklarOqi(xml, ss);
    const v: TekshirVaraq = {
      nom: y.name, yol: y.path, yashirin, yashirinUstunlar, kataklar,
      printArea: dn('_xlnm.Print_Area', i), printTitles: dn('_xlnm.Print_Titles', i),
      a4: atr(ps, 'paperSize') === '9',
      bittaEnli: (fitToPage && (atr(ps, 'fitToWidth') ?? '1') === '1') || atr(ps, 'scale') != null,
      yonalish: atr(ps, 'orientation'),
    };
    hisobot.varaqlar.push(v);
    if (yashirin) return;
    const aslSet = aslKatak.get(y.name);
    for (const k of kataklar) {
      const col = ustunIndeksi(k.ref.replace(/\d+$/, ''));
      if (yashirinUstunlar.has(col)) continue;
      if (aslSet?.has(`${k.ref}|${k.matn ?? ''}|${k.f ?? ''}`)) continue; // egasining asl katagi (H1)
      if (k.matn) {
        hisobot.matnlar.push(k.matn);
        for (const q of TAQIQLANGAN_QOIDALAR) {
          if (q.re.test(k.matn) && !(o?.ruxsat ?? []).some((r) => r.test(k.matn!))) hisobot.taqiqlangan.push({ varaq: y.name, ref: k.ref, matn: k.matn, qoida: q.nom });
        }
      }
      if (k.f && k.f !== '(shared)') {
        const fTozalangan = k.f.replace(/"[^"]*"/g, '""');
        if (fTozalangan.includes('$')) hisobot.dollarFormulalar.push({ varaq: y.name, ref: k.ref, f: k.f });
        if (k.v == null) hisobot.keshsizFormulalar.push({ varaq: y.name, ref: k.ref, f: k.f });
      }
    }
  });
  return hisobot;
}

/** Imzo bloki bormi (H3): har rol uchun "РОЛЬ:" matni + "(подпись)". */
export function imzoRollariBormi(h: HujjatHisobot, rollar: readonly string[]): { yoq: string[]; podpis: boolean } {
  const yoq = rollar.filter((r) => !h.matnlar.some((m) => m.startsWith(`${r}:`)));
  return { yoq, podpis: h.matnlar.includes('(подпись)') };
}
