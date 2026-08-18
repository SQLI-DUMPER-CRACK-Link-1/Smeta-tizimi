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
