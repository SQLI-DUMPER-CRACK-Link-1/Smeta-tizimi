import { kitobAnatomiyasi, type KitobAnatomiyasi } from './index';
import { kalit } from './matn';
import { svodniOqi, type SvodSmeta } from './svod';
import type { Ishonch, KirishKitob, ReviewBand, Sarlavha, VaraqAnatomiyasi } from './turlar';

/**
 * Bir nechta fayl (paket) anatomiyasi. Hozirgi vazifa — D8: STR/OB LRV dagi
 * lokal smeta sarlavhalarini svod (CB_DET2) obyektlariga bog'lash va
 * bog'lanishni mehnat sarfi (чел-ч) bilan ISBOTLASH.
 */
export interface LokalBoglanish {
  fayl: string;
  varaq: string;
  lokal: string;           // sarlavha asl matni
  svod: SvodSmeta | null;
  chelSoatLrv: number | null;
  farq: number | null;
  ishonch: Ishonch;
}

export interface PaketAnatomiyasi {
  kitoblar: KitobAnatomiyasi[];
  svod: SvodSmeta[];
  boglanish: LokalBoglanish[];
  review: ReviewBand[];
}

const TOZA = (s: string) => kalit(s).replace(/[^0-9A-ZА-ЯЁЎҚҒҲ]/g, '');

function nomMos(a: string, b: string): boolean {
  const x = TOZA(a), y = TOZA(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const qisqa = x.length < y.length ? x : y;
  return qisqa.length >= 10 && (x.startsWith(y) || y.startsWith(x));
}

/** "РАЗДЕЛ: СМЕТА № 01-01 НА КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА" → { raqam, nom } */
export function lokalSarlavhasi(xomMatn: string): { raqam: string; nom: string } | null {
  const m = kalit(xomMatn).match(/СМЕТА\s*№\s*(\S+)\s+НА\s+(.+)$/);
  return m ? { raqam: m[1], nom: m[2] } : null;
}

const ISHCHI_MEHNATI = /^ЗАТРАТЫ ТРУДА РАБОЧИХ/;

function darajalarniQayta(sarlavhalar: Sarlavha[]): void {
  const byId = new Map(sarlavhalar.map((s) => [s.id, s]));
  const hisob = (s: Sarlavha, izda: Set<number>): number => {
    if (s.ota == null || izda.has(s.id)) return 1;
    izda.add(s.id);
    const ota = byId.get(s.ota);
    return ota ? hisob(ota, izda) + 1 : 1;
  };
  for (const s of sarlavhalar) s.daraja = hisob(s, new Set());
}

/** Bitta LRV varaqdagi lokal sarlavhalarni svodga bog'laydi (varaq joyida o'zgaradi). */
export function obyektlarniBogla(v: VaraqAnatomiyasi, svod: readonly SvodSmeta[], keyingiId: () => number): LokalBoglanish[] {
  const barcha = [...v.titul, ...v.sarlavhalar];
  const byId = new Map(barcha.map((s) => [s.id, s]));
  const obyektOtasiBor = (s: Sarlavha): boolean => {
    for (let o = s.ota == null ? undefined : byId.get(s.ota); o; o = o.ota == null ? undefined : byId.get(o.ota)) {
      if (o.tur === 'obyekt') return true;
    }
    return false;
  };
  const lokallar = v.sarlavhalar.filter((s) => s.tur === 'lokal' && !obyektOtasiBor(s));
  if (!lokallar.length || !svod.length) return [];

  // Har ish qaysi lokalga tegishli — ishchilar mehnati yig'indisi.
  const lokalOf = (id: number | null): number | null => {
    for (let s = id == null ? undefined : byId.get(id); s; s = s.ota == null ? undefined : byId.get(s.ota)) {
      if (s.tur === 'lokal') return s.id;
    }
    return null;
  };
  const mehnat = new Map<number, number>();
  for (const ish of v.ishlar) {
    const l = lokalOf(ish.sarlavha);
    if (l == null) continue;
    for (const r of ish.resurslar) {
      if (ISHCHI_MEHNATI.test(kalit(r.xom)) && r.hajm != null) mehnat.set(l, (mehnat.get(l) ?? 0) + r.hajm);
    }
  }

  const obyektlar = new Map<string, Sarlavha>();
  const natija: LokalBoglanish[] = [];
  let p = 0;
  for (const l of lokallar) {
    const shakl = lokalSarlavhasi(l.xom);
    let topildi = -1;
    if (shakl) {
      for (let i = p; i < svod.length; i++) {
        if (kalit(svod[i].raqam) === shakl.raqam && nomMos(svod[i].nom, shakl.nom)) { topildi = i; break; }
      }
    }
    const lrvMehnat = mehnat.has(l.id) ? Math.round(mehnat.get(l.id)! * 100) / 100 : null;
    if (topildi < 0) {
      natija.push({ fayl: v.fayl, varaq: v.varaq, lokal: l.xom, svod: null, chelSoatLrv: lrvMehnat, farq: null, ishonch: 'past' });
      v.review.push({ kod: 'svodda_topilmadi', izoh: `lokal "${l.xom.slice(0, 70)}" svod ro'yxatida topilmadi — obyekt aniqlanmadi`, manzil: l.manzil });
      continue;
    }
    p = topildi + 1;
    const sv = svod[topildi];
    // LRV da ishchi mehnati resursi yo'q = 0 чел-ч (svod ham 0 bo'lsa — mos).
    const lrvSon = lrvMehnat ?? (sv.chelSoat === 0 ? 0 : null);
    const farq = sv.chelSoat != null && lrvSon != null ? Math.round((lrvSon - sv.chelSoat) * 100) / 100 : null;
    const ishonch: Ishonch = farq == null ? 'orta'
      : Math.abs(farq) <= 0.01 ? 'yuqori'
        : sv.chelSoat && Math.abs(farq) / sv.chelSoat <= 0.01 ? 'orta' : 'past';
    natija.push({ fayl: v.fayl, varaq: v.varaq, lokal: l.xom, svod: sv, chelSoatLrv: lrvMehnat, farq, ishonch });
    if (ishonch === 'past') {
      v.review.push({ kod: 'svod_mehnat_farqi', izoh: `lokal "${l.xom.slice(0, 50)}": LRV ${lrvMehnat} чел-ч, svod ${sv.chelSoat} — farq ${farq}`, manzil: l.manzil });
    }
    const obKalit = `${sv.obyektManzil.fayl}#${sv.obyektManzil.qator}`;
    let ob = obyektlar.get(obKalit);
    if (!ob) {
      ob = {
        id: keyingiId(), ota: null, daraja: 1, tur: 'obyekt', xom: sv.obyekt, belgi: null, manzil: sv.obyektManzil,
        dalil: [{ qoida: 'D8', ishonch: 'yuqori', izoh: 'svod (CB_DET2) obyekt sarlavhasi' }],
      };
      obyektlar.set(obKalit, ob);
      v.sarlavhalar.splice(v.sarlavhalar.indexOf(l), 0, ob);
    }
    l.ota = ob.id;
    l.dalil.push({ qoida: 'D8', ishonch, izoh: `svod ${sv.raqam} "${sv.nom.slice(0, 40)}": чел-ч LRV ${lrvMehnat} / svod ${sv.chelSoat}` });
  }
  darajalarniQayta(v.sarlavhalar.concat(v.titul));
  return natija;
}

export function paketAnatomiyasi(kitoblar: readonly KirishKitob[]): PaketAnatomiyasi {
  const anat = kitoblar.map((k) => kitobAnatomiyasi(k));
  const svod: SvodSmeta[] = [];
  anat.forEach((a, i) => a.varaqlar.forEach((v, j) => {
    if (v.rol === 'svod') svod.push(...svodniOqi(a.fayl, kitoblar[i].varaqlar[j]));
  }));
  let maxId = 0;
  for (const a of anat) for (const v of a.varaqlar) for (const s of [...v.titul, ...v.sarlavhalar]) maxId = Math.max(maxId, s.id);
  const keyingiId = () => ++maxId;
  const boglanish: LokalBoglanish[] = [];
  for (const a of anat) {
    const v = a.varaqlar.find((x) => x.varaq === a.asosiyLrv);
    if (v) boglanish.push(...obyektlarniBogla(v, svod, keyingiId));
  }
  const review: ReviewBand[] = [];
  const svodlar = new Set(svod.map((s) => s.manzil.fayl));
  if (svodlar.size > 1) review.push({ kod: 'kop_svod', izoh: `paketda ${svodlar.size} ta svod fayli — bog'lanish ularning birlashmasi bo'yicha` });
  return { kitoblar: anat, svod, boglanish, review };
}
