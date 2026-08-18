/**
 * sb.ts — SUPABASE'DAN FAQAT O'QISH DARCHASI
 * ═══════════════════════════════════════════════════════════════════
 *
 * MAQSAD: sayt og'ir ma'lumotni Google Sheets o'rniga Postgres'dan
 * o'qisin. Sheets har so'rovda faylni ochadi va varaqni skanlaydi;
 * Postgres indeksdan o'qiydi.
 *
 * ⚠️ QAT'IY CHEKLOVLAR — bu darcha ATAYLAB tor:
 *   1) FAQAT O'QISH. `insert/update/delete` yo'q. Yagona haqiqat manbai
 *      Google Sheets bo'lib qoladi; Supabase — uning KO'ZGUSI.
 *      Ko'zguga yozish ikki manba yaratadi va ular albatta ajralib
 *      ketadi ([[soxta-malumot-buzilishlari]] naqshi).
 *   2) Jadval OQ RO'YXATI — faqat quyidagilar o'qiladi.
 *   3) Sessiya MAJBURIY — `/api/gas` bilan bir xil tekshiruv.
 *   4) `service_role` kaliti FAQAT serverda qoladi, brauzerga
 *      HECH QACHON yuborilmaydi.
 *
 * SO'ROV:
 *   POST /api/sb
 *   { "jadval": "holat", "filtr": "obyekt=eq.Amfiteatr",
 *     "ustunlar": "*", "tartib": "varaq.asc,qator.asc", "limit": 50000 }
 *
 * JAVOB:
 *   { ok: true, qatorlar: [...], soni: 1234, ms: 87 }
 *   { ok: false, error: "..." }
 */
import { tekshir } from '../_shared/auth';

/* Faqat shu jadvallar o'qiladi. Yangi jadval kerak bo'lsa SHU YERGA
   qo'shiladi — «hamma jadval ochiq» holatiga hech qachon o'tmaymiz. */
const RUXSAT_JADVALLAR = new Set([
  'obyektlar', 'holat', 'oylik_f2', 'narxlar', 'material_kerak',
  'shartnoma', 'tolovlar', 'prixod', 'rashod', 'topilmaganlar',
  'akt', 'akt_ish', 'tarix', 'anomaliya',
]);

/** PostgREST filtri xavfsizmi — faqat oddiy `ustun=op.qiymat` shakllari. */
function filtrXavfsizmi(f: string): boolean {
  if (!f) return true;
  /* bir nechta shart `&` bilan ajratiladi */
  return f.split('&').every((qism) =>
    /^[a-z_][a-z0-9_]*=(eq|neq|gt|gte|lt|lte|like|ilike|in|is)\.[^&]*$/i.test(qism));
}

export const onRequestPost: PagesFunction<{
  SUPABASE_URL: string; SUPABASE_KEY: string; SESSIYA_KALIT: string;
}> = async (ctx) => {
  const t0 = Date.now();
  try {
    const secret = ctx.env.SESSIYA_KALIT || 'Boshlangich_Maxfiy_Kalit_123';
    const sess = await tekshir(ctx.request.headers.get('Cookie'), secret);
    if (!sess) {
      return Response.json({ ok: false, error: 'Кириш талаб қилинади' }, { status: 401 });
    }

    if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
      return Response.json({
        ok: false,
        error: 'Supabase sozlanmagan. Cloudflare Pages → Settings → ' +
               'Environment Variables ga SUPABASE_URL va SUPABASE_KEY qo\'shing.',
        sozlanmagan: true,
      });
    }

    const so = await ctx.request.json<{
      jadval?: string; filtr?: string; ustunlar?: string;
      tartib?: string; limit?: number;
    }>();

    const jadval = String(so.jadval || '');
    if (!RUXSAT_JADVALLAR.has(jadval)) {
      return Response.json({ ok: false, error: 'Jadval ochiq emas: ' + jadval });
    }
    if (!filtrXavfsizmi(so.filtr || '')) {
      return Response.json({ ok: false, error: 'Filtr shakli qabul qilinmadi' });
    }

    const p = new URLSearchParams();
    p.set('select', so.ustunlar || '*');
    if (so.tartib) p.set('order', so.tartib);
    p.set('limit', String(Math.min(Math.max(1, so.limit || 50000), 100000)));

    const url = ctx.env.SUPABASE_URL.replace(/\/+$/, '') +
                '/rest/v1/' + jadval + '?' + p.toString() +
                (so.filtr ? '&' + so.filtr : '');

    const r = await fetch(url, {
      headers: {
        apikey: ctx.env.SUPABASE_KEY,
        Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
        /* aniq sanoq — «nechta qator bor» ni bilish uchun */
        Prefer: 'count=exact',
      },
    });

    const matn = await r.text();
    if (!r.ok) {
      return Response.json({
        ok: false,
        error: 'Supabase ' + r.status + ': ' + matn.slice(0, 300),
      });
    }

    let qatorlar: unknown[] = [];
    try { qatorlar = JSON.parse(matn); } catch {
      return Response.json({ ok: false, error: 'Supabase JSON qaytarmadi: ' + matn.slice(0, 200) });
    }

    return Response.json({
      ok: true,
      qatorlar,
      soni: Array.isArray(qatorlar) ? qatorlar.length : 0,
      ms: Date.now() - t0,
    });
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: 'Cloudflare xatosi: ' + (err?.message || String(err)),
      ms: Date.now() - t0,
    });
  }
};
