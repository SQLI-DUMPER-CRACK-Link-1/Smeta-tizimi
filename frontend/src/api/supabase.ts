/**
 * supabase.ts — SUPABASE KO'ZGUSIDAN O'QISH
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN. Hozir saytdagi HAR BIR o'qish Google Sheets'ga boradi:
 * GAS faylni ochadi, varaqni skanlaydi, daraxtni quradi va qaytaradi.
 * Katta obyektda bu soniyalar oladi va Cloudflare'ning 100 soniyalik
 * chegarasiga urilishi mumkin.
 *
 * `70_Supabase.js` esa AYNI ma'lumotni Postgres'ga ko'chirib turadi
 * (soatlik + kunlik sinx). Ya'ni ko'zgu ALLAQACHON to'lib turibdi —
 * lekin hech kim undan O'QIMASDI. Bu modul o'sha bo'shliqni yopadi.
 *
 * ⚠️ ARXITEKTURA QOIDASI: yagona HAQIQAT MANBAI — Google Sheets.
 * Supabase faqat TEZ O'QISH uchun ko'zgu. Bu yerdan hech qachon
 * YOZILMAYDI va ko'zgu «haqiqat» sifatida ishlatilmaydi: yozish, F2,
 * hisob-kitob — hammasi avvalgidek GAS orqali.
 *
 * ⚠️ IKKINCHI QOIDA: ko'zgu bo'sh bo'lsa SOXTA JAVOB QAYTARMAYMIZ.
 * `null` qaytadi va chaqiruvchi buni ochiq ko'rsatadi. Eskirgan yoki
 * yarim ma'lumotni «haqiqat» deb ko'rsatish — bu tizimda eng qimmat
 * xato turi.
 */

export type SbJavob<T> = {
  ok: boolean;
  qatorlar?: T[];
  soni?: number;
  ms?: number;
  error?: string;
  sozlanmagan?: boolean;
  /* ⚠️ 2026-08-17: Supabase REST da SERVER TOMONDA 1000 qator chegarasi
     bor («Max rows»). Darcha endi sahifalab o'qiydi, lekin natija baribir
     to'liq bo'lmasligi mumkin (juda katta jadval, xavfsizlik chegarasi).
     `toliq:false` bo'lsa ustiga HISOB-KITOB QILMASLIK kerak — yarim
     ma'lumot ustidagi summa yolg'on bo'ladi va uni haqiqat deb
     ko'rsatish bu tizimdagi eng qimmat xato turi. */
  jamiServerda?: number | null;
  toliq?: boolean;
  soro?: number;
  msBirinchi?: number;
  msQolgan?: number;
};

export type SbSoro = {
  jadval: string;
  filtr?: string;
  ustunlar?: string;
  tartib?: string;
  limit?: number;
};

/** Supabase ko'zgusidan o'qiydi. Xato bo'lsa TASHLAMAYDI — javobda aytadi. */
export async function sbOqi<T = Record<string, unknown>>(s: SbSoro): Promise<SbJavob<T>> {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/sb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    const j = (await r.json()) as SbJavob<T>;
    /* Server o'z ms ini beradi (Supabase gacha), biz TO'LIQ yo'lni
       o'lchaymiz — foydalanuvchi kutadigan vaqt aynan shu. */
    return { ...j, ms: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)),
             ms: Math.round(performance.now() - t0) };
  }
}

/* ── HOLAT (smeta daraxti) qatori — `holat` jadvali ustunlari ───── */
export type SbHolatQator = {
  obyekt: string; varaq: string | null; qator: number | null;
  tur: string | null; kod: string | null; nom: string | null;
  birlik: string | null;
  smeta_hajm: number | null; narx: number | null;
  fakt: number | null; f2ol: number | null; qoldiq: number | null;
  smeta_pul: number | null; st_fakt: number | null; st_f2: number | null;
  kategoriya: string | null; razdel: string | null;
  updated_at: string | null;
};

/** Bitta obyektning butun holati — varaq/qator tartibida. */
export function sbHolatOl(obyekt: string) {
  return sbOqi<SbHolatQator>({
    jadval: 'holat',
    filtr: 'obyekt=eq.' + encodeURIComponent(obyekt),
    tartib: 'varaq.asc,qator.asc',
    limit: 100000,
  });
}

/** Obyektlar ro'yxati + jamlanma raqamlar. */
export function sbObyektlarOl() {
  return sbOqi<{
    nom: string; smeta: number; fakt: number; f2: number; qoldiq: number;
    progress: number; f2pct: number; sana: string; updated_at: string;
  }>({ jadval: 'obyektlar', tartib: 'nom.asc', limit: 1000 });
}

/**
 * Tekis qatorlardan daraxt quradi.
 *
 * ⚠️ MUHIM CHEKLOV — HALOL AYTILADI: `holat` jadvalida ota-bola
 * bog'lanishi SAQLANMAYDI. Har qatorda faqat `razdel` (matn) va
 * `varaq`+`qator` bor. Shuning uchun daraxt VARAQDAGI TARTIB bo'yicha
 * tiklanadi: har `bl` (ish) qatoridan keyingi `rs`/`mat` qatorlar —
 * o'sha ishning resurslari, keyingi `bl` uchraguncha.
 *
 * Bu jadvalning haqiqiy tuzilishiga mos (dvigatel ham shunday yozadi),
 * lekin bu TAXMIN — shuning uchun tekshiruv sahifasi GAS bilan
 * solishtirib, mos kelmasa DARHOL ko'rsatadi.
 */
export type SbTugun = {
  kalit: string; tur: string; nom: string; birlik: string;
  varaq: string; qator: number; razdel: string;
  smetaHajm: number; fakt: number; f2ol: number; qoldiq: number;
  smeta: number; stFakt: number; stF2: number; kat: string;
  bolalar: SbTugun[];
};

export function sbDaraxtQur(qatorlar: SbHolatQator[]): SbTugun[] {
  const son = (v: unknown) => Number(v) || 0;
  const yasa = (r: SbHolatQator): SbTugun => ({
    kalit: `${r.varaq}#${r.qator}`,
    tur: r.tur || '', nom: r.nom || '', birlik: r.birlik || '',
    varaq: r.varaq || '', qator: son(r.qator), razdel: r.razdel || '',
    smetaHajm: son(r.smeta_hajm), fakt: son(r.fakt), f2ol: son(r.f2ol),
    qoldiq: son(r.qoldiq), smeta: son(r.smeta_pul),
    stFakt: son(r.st_fakt), stF2: son(r.st_f2), kat: r.kategoriya || '',
    bolalar: [],
  });

  /* Razdel → ish → resurs. Razdel tugunlari jadvalda YO'Q (dvigatel
     ularni yozmaydi), shuning uchun razdel nomidan yasaymiz. */
  const razdellar = new Map<string, SbTugun>();
  let joriyIsh: SbTugun | null = null;

  for (const r of qatorlar) {
    const rzNom = r.razdel || '(razdelsiz)';
    let rz = razdellar.get(rzNom);
    if (!rz) {
      rz = { kalit: 'rz#' + rzNom, tur: 'rz', nom: rzNom, birlik: '',
             varaq: r.varaq || '', qator: 0, razdel: rzNom,
             smetaHajm: 0, fakt: 0, f2ol: 0, qoldiq: 0, smeta: 0,
             stFakt: 0, stF2: 0, kat: '', bolalar: [] };
      razdellar.set(rzNom, rz);
      joriyIsh = null;
    }

    const t = yasa(r);
    if (r.tur === 'bl') {
      rz.bolalar.push(t);
      joriyIsh = t;
    } else if (joriyIsh) {
      joriyIsh.bolalar.push(t);       // resurs — oxirgi ishning bolasi
    } else {
      rz.bolalar.push(t);             // ishsiz turgan material/ob
    }
  }
  return [...razdellar.values()];
}

/* ══════════════════════════════════════════════════════════════════
 * SUPABASE QATORLARI → MAVJUD `TreeNode` SHAKLI
 *
 * Nima uchun: saytda daraxtni chizadigan tayyor komponent bor
 * (`umumiy/daraxt/SmetaTree`) — virtual ro'yxat, qidiruv, ranglar,
 * yoyish/yig'ish hammasi ishlaydi. Uni qaytadan yozish xato bo'lardi:
 * ikkita daraxt ikki xil ko'rinadi va ikki xil buziladi.
 *
 * Shuning uchun Supabase javobini o'sha komponent kutgan shaklga
 * o'giramiz — chizish mantig'i BITTA joyda qoladi.
 *
 * ⚠️ Ota-bola bog'lanishi jadvalda YO'Q (yuqoridagi izohga qara):
 * daraxt varaq/qator TARTIBI bo'yicha tiklanadi.
 * ══════════════════════════════════════════════════════════════════ */
import type { TreeNode } from './types';

export function sbTreeQur(qatorlar: SbHolatQator[]): TreeNode[] {
  const son = (v: unknown) => Number(v) || 0;

  const yasa = (r: SbHolatQator): TreeNode => ({
    type: (r.tur as TreeNode['type']) || 'rs',
    nom: r.nom || '',
    varaq: r.varaq || '',
    row: son(r.qator),
    kat: r.kategoriya || '',
    kod: r.kod || '',
    birlik: r.birlik || '',
    smetaHajm: son(r.smeta_hajm),
    smeta: son(r.smeta_pul),
    narx: son(r.narx),
    fakt: son(r.fakt),
    qoldiq: son(r.qoldiq),
    f2ol: son(r.f2ol),
    /* ⚠️ `f2mum` (F2 mumkin = fakt − f2ol) jadvalda SAQLANMAYDI.
       O'zimiz to'qib chiqarmaymiz — mavjud ikki ustundan hisoblaymiz,
       bu GAS dagi ta'rif bilan bir xil. */
    f2mum: Math.max(0, son(r.fakt) - son(r.f2ol)),
    stFakt: son(r.st_fakt),
    stF2: son(r.st_f2),
    children: [],
  });

  const razdellar = new Map<string, TreeNode>();
  const tartib: TreeNode[] = [];
  let joriyIsh: TreeNode | null = null;

  for (const r of qatorlar) {
    const rzNom = r.razdel || '(razdelsiz)';
    let rz = razdellar.get(rzNom);
    if (!rz) {
      rz = { type: 'rz', nom: rzNom, varaq: r.varaq || '', row: 0,
             smetaHajm: 0, smeta: 0, narx: 0, fakt: 0, qoldiq: 0,
             f2ol: 0, f2mum: 0, children: [] };
      razdellar.set(rzNom, rz);
      tartib.push(rz);
      joriyIsh = null;
    }
    const t = yasa(r);
    if (r.tur === 'bl') { rz.children!.push(t); joriyIsh = t; }
    else if (joriyIsh)  { joriyIsh.children!.push(t); }
    else                { rz.children!.push(t); }
  }

  /* Razdel jamlanmasi — ishlar yig'indisi. Jadvalda razdel qatori yo'q,
     shuning uchun bu yerda hisoblanadi (soxta emas: bolalardan). */
  for (const rz of tartib) {
    for (const bl of rz.children || []) {
      rz.smeta += bl.smeta; rz.fakt += bl.fakt;
      rz.f2ol += bl.f2ol; rz.qoldiq += bl.qoldiq;
      rz.stFakt = (rz.stFakt || 0) + (bl.stFakt || 0);
      rz.stF2 = (rz.stF2 || 0) + (bl.stF2 || 0);
    }
  }
  return tartib;
}

/* ═══════════════════════════════════════════════════════════════════
 * TIZIM_02 (t2_) — BAZA HAQIQAT MANBAI
 * ═══════════════════════════════════════════════════════════════════
 *
 * Yuqoridagi funksiyalar Tizim_01 ning KO'ZGUSINI o'qiydi (`obyektlar`,
 * `holat`). Bu yerdagilar esa BOSHQA tizim — Tizim_02 — jadvallarini
 * o'qiydi (`t2_*`), u yerda baza ko'zgu emas, HAQIQAT MANBAI.
 *
 * ⚠️ IKKISI ARALASHTIRILMAYDI. Tizim_02 sahifalari faqat `t2_` ni
 * o'qiydi. Aks holda qaysi raqam qaysi tizimdan kelgani bilinmay
 * qoladi va bu tizimda eng qimmat xato turi aynan shu.
 *
 * MUHIM FARQ: `t2_daraxt` da HAQIQIY ota-bola bog'lanishi bor
 * (`ota_id`, `daraja`, `tartib`). Eski `holat` da u yo'q edi va daraxt
 * varaq tartibi bo'yicha TAXMIN bilan tiklanardi. Bu yerda taxmin
 * kerak emas.
 * ═══════════════════════════════════════════════════════════════════ */

/** `t2_obyekt_jami` — obyekt + jamlanma raqamlar (view). */
export type T2Obyekt = {
  id: number; nom: string; tur: string | null;
  qator_soni: number | null; razdel: number | null;
  ish: number | null; resurs: number | null;
  jami: number | null;
  /** ⚠️ Narx TOPILMAGAN qatorlar soni. >0 bo'lsa `jami` TO'LIQ EMAS. */
  narxsiz: number | null;
  chel: number | null; mash: number | null; mat: number | null; ob: number | null;
  yangilandi: string | null;
};

export function sbT2ObyektlarOl() {
  return sbOqi<T2Obyekt>({ jadval: 't2_obyekt_jami', tartib: 'nom.asc', limit: 5000 });
}

/** `t2_daraxt` — hisoblangan daraxt qatorlari (view). */
export type T2Qator = {
  id: number; obyekt_id: number; obyekt: string | null;
  ota_id: number | null; daraja: number | null; tartib: number | null;
  tur: string | null; kod: string | null; nom: string | null;
  birlik: string | null;
  hajm: number | null; narx: number | null; summa: number | null;
  kat: string | null; narx_usul: string | null;
  qoshimcha: boolean | null; zamena: boolean | null;
  d1: string | null; d2: string | null; d3: string | null;
  xom_qator: number | null; yangilandi: string | null;
};

export function sbT2DaraxtOl(obyektId: number) {
  return sbOqi<T2Qator>({
    jadval: 't2_daraxt',
    filtr: 'obyekt_id=eq.' + obyektId,
    tartib: 'tartib.asc',
    limit: 200000,
  });
}

/**
 * `ota_id` bo'yicha HAQIQIY daraxt quradi va mavjud `TreeNode` shakliga
 * o'giradi (chizish komponenti bir xil qolsin).
 *
 * Bu yerda TAXMIN YO'Q: bog'lanish bazadan keladi.
 */
export function sbT2TreeQur(qatorlar: T2Qator[]): TreeNode[] {
  const son = (v: unknown) => Number(v) || 0;
  const xarita = new Map<number, TreeNode>();
  const ildiz: TreeNode[] = [];

  /* 1-o'tish: har qator uchun tugun */
  for (const r of qatorlar) {
    xarita.set(r.id, {
      type: (r.tur as TreeNode['type']) || 'rs',
      nom: r.nom || '',
      varaq: r.obyekt || '',
      row: son(r.xom_qator),
      kat: r.kat || '',
      kod: r.kod || '',
      birlik: r.birlik || '',
      smetaHajm: son(r.hajm),
      smeta: son(r.summa),
      narx: son(r.narx),
      /* Tizim_02 da fakt/F2 hali yo'q — SOXTA raqam qo'ymaymiz, 0 qoladi
         va bu ochiq holat: «hali kiritilmagan» degani. */
      fakt: 0, qoldiq: 0, f2ol: 0, f2mum: 0,
      stFakt: 0, stF2: 0,
      isQosh: !!r.qoshimcha,
      isZamena: !!r.zamena,
      d1: r.d1 || undefined, d2: r.d2 || undefined, d3: r.d3 || undefined,
      children: [],
    });
  }

  /* 2-o'tish: ota-bola bog'lash */
  for (const r of qatorlar) {
    const tugun = xarita.get(r.id)!;
    const ota = r.ota_id != null ? xarita.get(r.ota_id) : null;
    if (ota) ota.children!.push(tugun);
    else ildiz.push(tugun);
  }
  return ildiz;
}
