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
  /** ⚡ 2026-08-28: kartadan belgilangan lokatsiya (bo'lmasa NULL — hali belgilanmagan). */
  lat: number | null; lng: number | null;
  versiya: number; loyiha_id: number | null;
};

export function sbT2ObyektlarOl() {
  return sbOqi<T2Obyekt>({ jadval: 't2_obyekt_jami', tartib: 'nom.asc', limit: 5000 });
}

/** `t2_daraxt` — hisoblangan daraxt qatorlari (view). */
export type T2QatorHolat = {
  id: number;
  qator_id: number;
  obyekt_id: number;
  nom: string | null;
  smeta_hajm: number;
  smeta_summa: number;
  /** ⚠️ FAKT — barcha `tur='fakt'` hujjatlarning yig'indisi. */
  fakt_hajm: number;
  fakt_summa: number;
  /** F2 — barcha `tur='f2'` hujjatlarning yig'indisi (fakt bilan
   *  ARALASHTIRILMAYDI: invariant f2≤fakt≤smeta shu ikkisini alohida
   *  talab qiladi). */
  f2_hajm: number;
  f2_summa: number;
  /** Qoldiq — smeta dan F2 orqali OLINMAGAN qism (hali hisob-fakturaga
   *  chiqmagan). */
  qoldiq_hajm: number;
  qoldiq_summa: number;
};
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
  /** Ko'p fayldan yig'ilgan obyektda qaysi manba (lokalka) faylidan
   *  kelgani. `apiHolatOlLokalka` ning o'rnini bosadi — daraxt
   *  ALLAQACHON birlashgan, filtrlash shu maydon bilan bo'ladi. */
  manba_id: number | null;
};

export function sbT2QatorHolatOl(obyektId: number) {
  return sbOqi<T2QatorHolat>({
    jadval: 't2_qator_holat',
    filtr: 'obyekt_id=eq.' + obyektId,
    limit: 200000,
  });
}

/** `t2_akt_reestr` — «qancha kirdi = qancha tushdi» kafolat reestri
 *  (Tizim_01 dagi `apiF2ReestrOl` ning o'rnini bosadi — bazada VIEW
 *  sifatida jonli hisoblanadi, alohida yozish/tiklash kerak emas). */
export type T2AktReestr = {
  id: number; obyekt_id: number; kompaniya_id: number; obyekt: string | null;
  tur: string; raqam: string | null; oy: string; holat: string;
  fayl_id: string | null; izoh: string | null; yaratildi: string;
  hujjat_jami: number | null; yozilgan_jami: number; qator_soni: number | null;
  narxsiz_qator: number | null; manfiy_qator: number | null;
  farq: number | null; reestr_holat: string; versiya: number;
};

export function sbT2AktReestrOl(obyektId: number) {
  return sbOqi<T2AktReestr>({
    jadval: 't2_akt_reestr',
    filtr: 'obyekt_id=eq.' + obyektId,
    tartib: 'oy.desc',
    limit: 500,
  });
}
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
export function sbT2TreeQur(qatorlar: T2Qator[], holatlar?: T2QatorHolat[]): TreeNode[] {
  const son = (v: unknown) => Number(v) || 0;
  const xarita = new Map<number, TreeNode>();
  const ildiz: TreeNode[] = [];
  
  const hMap = new Map<number, T2QatorHolat>();
  if (holatlar) {
    for (const h of holatlar) {
      hMap.set(h.qator_id, h);
    }
  }

  /* 1-o'tish: har qator uchun tugun */
  for (const r of qatorlar) {
    const h = hMap.get(r.id);
    xarita.set(r.id, {
      id: r.id,
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
      fakt: h ? h.fakt_summa : 0,
      qoldiq: h ? h.qoldiq_summa : son(r.summa),
      f2ol: 0,
      f2mum: 0,
      faktHajm: h ? h.fakt_hajm : 0,
      qoldiqHajm: h ? h.qoldiq_hajm : son(r.hajm),
      qoldiqSumma: h ? h.qoldiq_summa : son(r.summa),
      narx_usul: r.narx_usul || '',
      qoshimcha: Boolean(r.qoshimcha),
      zamena: Boolean(r.zamena),
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

/* ══════════════════════════════════════════════════════════════════
 * TIZIM_02 — KOMPANIYA VA YOZISH
 *
 * `kompaniya_id` 2026-08-19 da qo'shildi. Sabab: keyin qo'shish butun
 * ma'lumotni ko'chirish va har so'rovni qayta yozish demak edi; o'shanda
 * `t2_` jadvallarda atigi 13 qator bor edi — ya'ni deyarli tekin.
 * ══════════════════════════════════════════════════════════════════ */

/* ⚡ 2026-08-27 (Claude, foydalanuvchi ko'rsatmasi — "sayt 3 xil rejimda
 * ishlasin: zakazchik, pudratchi, loyihachi"): bu rol DB da allaqachon
 * bor edi (`mavqe` ustuni), lekin frontend TYPE'ida yo'q edi — ya'ni
 * hech bir sahifa buni bila olmasdi. Qiymatlari: 'zakazchik' |
 * 'pudratchi' | 'loyihachi' (erkin matn — DB da CHECK yo'q, lekin
 * amalda shu uchtasi ishlatiladi). */
export type KompaniyaMavqe = 'zakazchik' | 'pudratchi' | 'loyihachi' | string;

export type T2Kompaniya = {
  id: number; nom: string; kod: string; faol: boolean; izoh: string | null;
  mavqe: KompaniyaMavqe | null; versiya: number;
  toliq_nom: string | null; inn: string | null; manzil: string | null;
  rahbar: string | null; telefon: string | null; bank: string | null;
  hisob_raqam: string | null; mfo: string | null;
};

export function sbT2KompaniyalarOl() {
  return sbOqi<T2Kompaniya>({
    jadval: 't2_kompaniya', filtr: 'faol=is.true', tartib: 'nom.asc', limit: 200,
  });
}

/** Obyektlar — kompaniya berilsa faqat o'shaniki. */
export function sbT2ObyektlarOlKomp(kompaniyaId?: number | null) {
  return sbOqi<T2Obyekt>({
    jadval: 't2_obyekt_jami',
    filtr: kompaniyaId ? 'kompaniya_id=eq.' + kompaniyaId : undefined,
    tartib: 'nom.asc', limit: 5000,
  });
}

/* ── YOZISH ─────────────────────────────────────────────────────── */

export type T2TahrirNatija = {
  ok: boolean;
  qator_id?: number; maydon?: string; versiya?: number;
  /** `ziddiyat` — boshqa klient shu qatorni allaqachon o'zgartirgan */
  sabab?: 'ziddiyat' | 'topilmadi' | 'maydon_ruxsat_yoq' | string;
  xabar?: string;
  sizning_versiya?: number; bazadagi_versiya?: number;
  joriy?: { nom?: string; hajm?: number; narx?: number; birlik?: string; kat?: string };
  error?: string; ms?: number;
};

/**
 * Bitta maydonni tahrirlaydi.
 *
 * ⚠️ `kutilganVersiya` MAJBURIY — bu ziddiyat nazoratining o'zagi.
 * Klient o'zi KO'RGAN versiyani yuboradi; baza versiyasi undan farq
 * qilsa yozuv RAD ETILADI va `sabab:'ziddiyat'` qaytadi.
 * Bu «xato» emas — normal holat, foydalanuvchiga tushuntiriladi.
 */
export async function sbT2QatorTahrir(
  qatorId: number, maydon: 'nom' | 'hajm' | 'narx' | 'birlik' | 'kat',
  qiymat: string, kutilganVersiya: number,
): Promise<T2TahrirNatija> {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/sb-yoz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qator_id: qatorId, maydon, qiymat,
                             kutilgan_versiya: kutilganVersiya }),
    });
    const j = (await r.json()) as T2TahrirNatija;
    return { ...j, ms: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)),
             ms: Math.round(performance.now() - t0) };
  }
}

/* ═══════════════════ FAKT / F2 HUJJATLARI ═══════════════════════════
 *
 * Hammasi `/api/sb-yoz` ning NOMLANGAN amallari orqali. Ixtiyoriy RPC
 * chaqirish yo'q — reja «generic write endpoint ochmaslik» deydi.
 */

export type AktBuzilish = {
  qator_id: number; nom: string;
  bor?: number; qoshilmoqda?: number; jami?: number; chegara: number;
};

export type AktNatija = {
  ok: boolean; error?: string; sabab?: string; xabar?: string; izoh?: string;
  operation_id?: string;
  akt_id?: number; qator_id?: number; takror?: boolean; holat?: string; tur?: string; oy?: string;
  qator_soni?: number; narxsiz?: number; jami?: number | null; toliq?: boolean;
  buzilish?: AktBuzilish[] | null; maslahat?: string;
  sizning_versiya?: number; bazadagi_versiya?: number;
  ms?: number;
};

/* ⚠️ 2026-08-25 (Claude): `export` qo'shildi. Ko'p yangi t2-*.ts fayllari
 * (t2-birja, t2-erp, t2-grafik, t2-hisobot, t2-invite, t2-kirish,
 * t2-kuzatuv, t2-sozlama, t2-tizim) buni import qilardi, lekin u shu
 * yerda PRIVATE edi — butun loyiha build bo'lmasdi (TS2459).
 * Mening domenimga tegishli emas, lekin BUTUN qurilishni bloklardi. */
export async function yozAmali(yuk: Record<string, unknown>): Promise<AktNatija> {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/sb-yoz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(yuk),
    });
    const j = (await r.json()) as AktNatija;
    return { ...j, ms: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)),
             ms: Math.round(performance.now() - t0) };
  }
}

/**
 * Fakt yoki F2 hujjatini yaratadi.
 *
 * ⚠️ `operation_id` HAR CHAQIRUVDA YANGI bo'lishi kerak, lekin QAYTA
 * URINISHDA O'SHA-O'SHA qolishi kerak. Shuning uchun uni chaqiruvchi
 * beradi — bu yerda generatsiya qilsak, qayta urinish yangi UUID bilan
 * ketib IKKINCHI hujjat yaratardi va idempotentlik ma'nosini yo'qotardi.
 */
export function sbT2AktYarat(p: {
  obyektId: number; tur: 'fakt' | 'f2'; oy: string;
  qatorlar: Array<{ qator_id: number; hajm: number | string; narx?: number; izoh?: string }>;
  operationId: string; raqam?: string; majburiy?: boolean;
}): Promise<AktNatija> {
  return yozAmali({
    amal: 'akt_yarat', obyekt_id: p.obyektId, tur: p.tur, oy: p.oy,
    qatorlar: p.qatorlar, operation_id: p.operationId,
    raqam: p.raqam, majburiy: p.majburiy === true,
  });
}

/**
 * Smetaga yangi qator qo'shadi (`t2_qator_qosh`).
 *
 * Tizim_01 dagi `apiRzQosh` / `apiBlQosh` / `apiRsQosh` ning o'rnini
 * bosadi. ⚠️ Hisob-kitob shu yerda EMAS, bazada:
 *
 *  • `norma` ≠ `hajm`. `eObyom` berilmasa `rs` da hajm = ota.hajm × norma.
 *    Frontendda ko'paytirsak ikki xil hisob paydo bo'lardi.
 *  • `norma` MANFIY bo'lishi mumkin — ПЕРЕРАСЧЁТ haqiqiy hujjat.
 *  • `kat` yubormang: ЧЕЛ/МАШ birlikdan aniqlanadi va tanlov uni
 *    bosib o'tolmaydi. `kat` faqat МАТ/ОБ/М-К/КАБ ajratish uchun.
 *  • `narx` yubormasangiz narxlar bazasidan qidiriladi; topilmasa
 *    BO'SH qoladi. 0 yozilmaydi — 0 «bepul» degani.
 */
export function sbT2QatorQosh(p: {
  obyektId: number;
  tur: 'rz' | 'bl' | 'rs' | 'mat' | 'ob';
  nom: string;
  otaId?: number | null;
  kod?: string;
  birlik?: string;
  norma?: number;
  narx?: number;
  /** true → hajm AYNAN norma (E ustuni butun hajm). Aks holda ko'paytiriladi. */
  eObyom?: boolean;
  kat?: string;
  /** Shu qatordan KEYIN joylashadi; berilmasa oxiriga. */
  keyinId?: number;
  /** ⚠️ Qayta urinishda O'ZGARMASIN — aks holda ikkinchi qator yaraladi. */
  operationId: string;
}): Promise<AktNatija> {
  return yozAmali({
    amal: 'qator_qosh', obyekt_id: p.obyektId, tur: p.tur, nom: p.nom,
    ota_id: p.otaId ?? null, kod: p.kod, birlik: p.birlik,
    norma: p.norma, narx: p.narx, e_obyom: p.eObyom, kat: p.kat,
    keyin_id: p.keyinId, operation_id: p.operationId,
  });
}

export function sbT2AktTasdiqlash(aktId: number, kutilganVersiya?: number): Promise<AktNatija> {
  return yozAmali({ amal: 'akt_tasdiqlash', akt_id: aktId,
                    kutilgan_versiya: kutilganVersiya });
}

export function sbT2AktBekor(aktId: number, sabab: string,
                             kutilganVersiya?: number): Promise<AktNatija> {
  return yozAmali({ amal: 'akt_bekor', akt_id: aktId, sabab,
                    kutilgan_versiya: kutilganVersiya });
}

/** Brauzerda ishonchli UUID (eski brauzerlar uchun zaxira bilan). */
export function yangiOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}




// SKLAD DOMENI
export type T2SkladHarakat = {
  id?: number;
  obyekt_id: number;
  operatsiya: 'prixod' | 'rasxod';
  turi: string;
  sana: string;
  nomi: string;
  birligi: string;
  obyomi: number;
  postavshik?: string;
  qabul_qiluvchi?: string;
  qabul_turi?: string;
  izoh?: string;
  operation_id?: string;
};

export type T2SkladQoldiq = {
  id: number;
  kompaniya_id: number;
  obyekt_id: number;
  turi: string;
  nomi: string;
  birligi: string;
  qoldiq: number;
  versiya: number;
  oxirgi_harakat: string;
};

export function sbSkladQoldiqOl(obyektId: number) {
  return sbOqi<T2SkladQoldiq>({
    jadval: 't2_sklad_qoldiq',
    filtr: 'obyekt_id=eq.' + obyektId
  });
}

/** ⚠️ `operation_id` MAJBURIY — sklad qoldig'iga ta'sir qiladi, qayta
 *  urinishda ikkinchi harakat yaratmasligi kerak. */
export function sbSkladgaYozish(kompaniya_id: number, operatsiya: 'prixod' | 'rasxod', item: T2SkladHarakat) {
  return yozAmali({
    amal: 'skladga_yozish',
    kompaniya_id,
    operatsiya,
    obyekt_id: item.obyekt_id,
    turi: item.turi,
    sana: item.sana,
    nomi: item.nomi,
    birligi: item.birligi,
    obyomi: item.obyomi,
    postavshik: item.postavshik || null,
    qabul_qiluvchi: item.qabul_qiluvchi || null,
    qabul_turi: item.qabul_turi || null,
    izoh: item.izoh || null,
    operation_id: item.operation_id || yangiOperationId(),
  });
}

export async function sbSkladNomTaklifOl(nom: string, limit = 5): Promise<{ok: boolean, qatorlar?: any[], error?: string}> {
  if (!nom || nom.length < 2) return { ok: true, qatorlar: [] };
  const filtr = 'nomi.ilike.%' + nom + '%';
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 'v_sklad_nomlar', filtr, limit })
  });
  return await res.json();
}

// --- FAKTURA (EHF / Didox) ---

export interface T2Faktura {
  id?: number;
  kompaniya_id: number;
  raqam: string;
  sana: string;
  kontragent: string;
  inn: string;
  summa: number;
  pdf_url?: string;
  holat: 'yangi' | 'tasdiqlangan' | 'bekor_qilingan';
  items?: any[];
  /** Faqat yaratishda — qayta urinishda o'sha-o'sha bo'lishi kerak. */
  operation_id?: string;
}

export function sbFakturalarOl(kompaniya_id: number) {
  return sbOqi<T2Faktura>({
    jadval: 't2_faktura',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    tartib: 'sana.desc',
    limit: 1000,
  });
}

/** ⚠️ Yangi faktura yaratishda `operation_id` avtomatik biriktiriladi
 *  (idempotentlik). Tahrirlashda (`item.id` bor) kerak emas — bazada
 *  `id` + `kompaniya_id` + versiya bilan himoyalangan. */
export function sbFakturaYoz(item: T2Faktura) {
  return yozAmali({
    amal: 'faktura_yoz',
    ...item,
    operation_id: item.id ? undefined : (item.operation_id || yangiOperationId()),
  });
}

/* ⚠️ 2026-08-27 (Claude): avval haqiqatda YUKLAMASDAN `ok:true` va
 * SOXTA URL qaytarardi (`r2.milliy-os.uz` — mavjud bo'lmagan domen).
 * Hech kim chaqirmasdi hozircha, lekin fake-success stub qoldirish
 * xavfli — chaqirilganda "muvaffaqiyatli" deb yolg'on ko'rsatardi.
 * Endi HAQIQIY `/api/upload` (R2) ga yuklaydi. */
export async function sbFakturaFaylYoz(file: File, faktura_id: number): Promise<{ok: boolean, url?: string, error?: string}> {
  const formData = new FormData();
  formData.append('fayl', file);
  formData.append('rfq_id', 'faktura-' + faktura_id);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)) };
  }
}

// --- SPRAVOCHNIK (Ish turlari va Shaxsiy smetalar) ---

export interface T2IshTuri {
  id?: number;
  kompaniya_id: number;
  kod: string;
  nomi: string;
  birligi: string;
  norma: number;
  narx: number;
  kategoriya: string;
}

export function sbIshTurlariOl(kompaniya_id: number) {
  return sbOqi<T2IshTuri>({
    jadval: 't2_ish_turi',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    tartib: 'kod.asc',
    limit: 5000,
  });
}

export function sbIshTuriYoz(item: T2IshTuri) {
  return yozAmali({
    amal: 'ish_turi_yoz',
    ...item
  });
}

export function sbShaxsiySmetalarOl(kompaniya_id: number) {
  return sbOqi<{id: number; kompaniya_id: number; nom: string; qatorlar: any[]; yaratildi: string}>({
    jadval: 't2_shaxsiy_smeta',
    filtr: 'kompaniya_id=eq.' + kompaniya_id,
    tartib: 'nom.asc',
    limit: 1000,
  });
}

export function sbShaxsiySmetaYarat(kompaniya_id: number, nom: string, qatorlar: any[]) {
  return yozAmali({
    amal: 'shaxsiy_smeta_yarat',
    kompaniya_id,
    nom,
    qatorlar,
  });
}


// ==========================================
// KORZINKA VA TAHRIRLASH (TIZIM_02)
// ==========================================

export async function sbObyektOchirish(id: number, nomi: string): Promise<any> {
  // 1. Supabase da korzinkaga tashlash
  const res = await fetch('/api/sb-yoz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amal: 'korzinkaga_tashlash', jadval: 't2_obyekt', id })
  });
  const data = await res.json();

  // 2. Drive'da trash qutisiga ko'chirish
  fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn: 'apiT2DriveTrash', args: [{ type: 'obyekt', id, nomi }] })
  }).catch(console.error);

  return data;
}

/* ⚡ 2026-08-28 (foydalanuvchi ko'rsatmasi — "har obyektga lokatsiyasini
 * kartadan belgilash"): `t2_obyekt.lat`/`lng` — kartadan (masalan Leaflet/
 * Google Maps klik) tanlangan koordinata. `kutilganVersiya` MAJBURIY —
 * ikki admin bir vaqtda tahrirlasa jimgina ustidan yozilmasin. */
export async function sbObyektLokatsiyaBelgila(id: number, lat: number, lng: number, kutilganVersiya: number): Promise<any> {
  const res = await fetch('/api/sb-yoz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amal: 'obyekt_yangila', id, nomi: '', kutilgan_versiya: kutilganVersiya, lat, lng })
  });
  return await res.json();
}

export async function sbObyektTahrirlash(id: number, nomi: string, tur: string): Promise<any> {
  const res = await fetch('/api/sb-yoz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amal: 'obyekt_yangila', id, nomi, tur })
  });
  
  // Drive'da nomini yangilash
  fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn: 'apiT2DriveRename', args: [{ type: 'obyekt', id, yangiNom: nomi }] })
  }).catch(console.error);

  return await res.json();
}

export async function sbKorzinkadanTiklash(jadval: string, id: number, nomi: string): Promise<any> {
  const res = await fetch('/api/sb-yoz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amal: 'korzinkadan_tiklash', jadval, id })
  });
  
  fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn: 'apiT2DriveRestore', args: [{ type: jadval, id, nomi }] })
  }).catch(console.error);

  return await res.json();
}

export async function sbButunlayOchirish(jadval: string, id: number, nomi: string): Promise<any> {
  const res = await fetch('/api/sb-yoz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amal: 'butunlay_ochirish', jadval, id })
  });
  
  fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn: 'apiT2DriveHardDelete', args: [{ type: jadval, id, nomi }] })
  }).catch(console.error);

  return await res.json();
}

/* ⚠️ 2026-08-27 (Claude): BU FUNKSIYA IKKI MARTA BUZILGAN EDI — avval
   `t2_obyekt.is_deleted` (bunday ustun UMUMAN yo'q, `holat='bekor'`
   ishlatiladi), keyin bu izoh to'g'ri yozilgandan keyin ham kimdir
   qayta xato versiyaga qaytargan. Natija: PostgREST "column does not
   exist" xatosi bilan so'rov muvaffaqiyatsiz bo'lardi va Korzinka
   sahifasi HAR DOIM bo'sh ko'rinardi — biror narsa o'chirilganidan
   keyin ham. Endi `t2_korzinka` VIEW orqali (3 jadval — t2_obyekt/
   t2_shaxsiy_smeta/t2_sklad_harakat — birlashgan, `jadval` ustuni
   bilan) va kompaniya bo'yicha filtrlangan holda o'qiydi. */
export function sbKorzinkaOqish(kompaniyaId?: number | null) {
  return sbOqi<{ id: number; nomi: string; jadval: string; kompaniya_id: number; ochirilgan_vaqt: string }>({
    jadval: 't2_korzinka',
    filtr: kompaniyaId ? 'kompaniya_id=eq.' + kompaniyaId : undefined,
    tartib: 'ochirilgan_vaqt.desc',
    limit: 500,
  });
}

/* ⚡ 2026-08-27 (Claude): `t2_kompaniya` avvalgacha FAQAT o'qilardi —
 * Sozlamalar "Umumiy Akkaunt" formasi (Antigravity) tashkilot
 * rekvizitlarini saqlay olmasdi. Har maydon ixtiyoriy: faqat
 * o'zgartirilgani yuboriladi (`undefined` — teginmaydi), boshqalar
 * o'z holicha qoladi. `kutilganVersiya` MAJBURIY (optimistik qulf —
 * ikki foydalanuvchi bir vaqtda tahrirlasa, ikkinchisi "versiya"
 * sababi bilan rad etiladi, jimgina ustidan yozilmaydi). */
export function sbKompaniyaYangila(id: number, kutilganVersiya: number, maydonlar: {
  toliqNom?: string; inn?: string; manzil?: string; rahbar?: string;
  telefon?: string; bank?: string; hisobRaqam?: string; mfo?: string;
  mavqe?: 'zakazchik' | 'pudratchi' | 'loyihachi';
}) {
  return yozAmali({
    amal: 'kompaniya_yangila', id, kutilgan_versiya: kutilganVersiya,
    toliq_nom: maydonlar.toliqNom, inn: maydonlar.inn, manzil: maydonlar.manzil,
    rahbar: maydonlar.rahbar, telefon: maydonlar.telefon, bank: maydonlar.bank,
    hisob_raqam: maydonlar.hisobRaqam, mfo: maydonlar.mfo, mavqe: maydonlar.mavqe,
  });
}


