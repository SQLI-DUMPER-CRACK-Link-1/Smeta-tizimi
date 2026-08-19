/**
 * sb-yoz.ts — TIZIM_02 GA YOZISH (ataylab ЖУДА tor eshik)
 * ═══════════════════════════════════════════════════════════════════
 *
 * `/api/sb` FAQAT O'QIYDI va shunday qolishi kerak. Yozish alohida,
 * o'ta cheklangan eshikdan o'tadi.
 *
 * QOIDALAR:
 *   1) Bu yerdan FAQAT `t2_qator_tahrir` RPC chaqiriladi. Ixtiyoriy SQL,
 *      ixtiyoriy jadval, ixtiyoriy funksiya — YO'Q. Yozish mantig'i
 *      bazada, bitta joyda ([[f2-arxitektura-qoidasi]] falsafasi).
 *   2) Versiya MAJBURIY. Klient o'zi ko'rgan versiyani yuboradi; mos
 *      kelmasa baza yozuvni rad etadi va ziddiyat qaytaradi.
 *      Versiyasiz yozish «oxirgi yozgan yutadi» degani — moliyaviy
 *      ma'lumotda buni qabul qilib bo'lmaydi.
 *   3) Rahbar roli YOZA OLMAYDI — `/api/gas` dagi bilan bir xil qoida.
 *   4) Kim yozgani jurnalga tushadi (`kim` = sessiya email).
 *
 * NIMA UCHUN alohida fayl: o'qish eshigining oq ro'yxati kengayib
 * ketishi mumkin, lekin yozish eshigi HECH QACHON kengaymasligi kerak.
 * Ikkisini bir faylda saqlash — kelajakda tasodifan yozishga ruxsat
 * berib qo'yishning eng qisqa yo'li.
 */
import { tekshir } from '../_shared/auth';

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
    /* Rahbar rejimida yozish yo'q — `/api/gas` bilan BIR XIL qoida.
       Ikki joyda ikki xil qoida bo'lsa, biri unutiladi. */
    if (sess.rol === 'boss' || sess.rol === 'rahbar') {
      return Response.json({ ok: false, error: 'Раҳбар режимида ёзиш мумкин эмас' },
                           { status: 403 });
    }
    if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
      return Response.json({ ok: false, sozlanmagan: true,
        error: 'Supabase sozlanmagan (SUPABASE_URL / SUPABASE_KEY)' });
    }

    const so = await ctx.request.json<{
      qator_id?: number; maydon?: string; qiymat?: string;
      kutilgan_versiya?: number;
    }>();

    const qatorId = Number(so.qator_id);
    if (!Number.isFinite(qatorId) || qatorId <= 0) {
      return Response.json({ ok: false, error: 'qator_id noto\'g\'ri' });
    }
    /* Maydon oq ro'yxati bu yerda HAM tekshiriladi (baza ham tekshiradi).
       Ikki qatlamli himoya: biri o'zgarsa ikkinchisi ushlab qoladi. */
    const RUXSAT = ['nom', 'hajm', 'narx', 'birlik', 'kat'];
    if (!so.maydon || !RUXSAT.includes(so.maydon)) {
      return Response.json({ ok: false, error: 'Bu maydonni tahrirlash mumkin emas: ' + so.maydon });
    }
    if (so.kutilgan_versiya == null || !Number.isFinite(Number(so.kutilgan_versiya))) {
      /* Versiyasiz yozishga YO'L QO'YMAYMIZ — bu ziddiyat nazoratini
         chetlab o'tish degani. */
      return Response.json({ ok: false,
        error: 'kutilgan_versiya majburiy — usiz ziddiyatni aniqlab bo\'lmaydi' });
    }

    const r = await fetch(
      ctx.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/t2_qator_tahrir',
      {
        method: 'POST',
        headers: {
          apikey: ctx.env.SUPABASE_KEY,
          Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_qator_id: qatorId,
          p_maydon: so.maydon,
          p_qiymat: so.qiymat == null ? '' : String(so.qiymat),
          p_kutilgan_versiya: Number(so.kutilgan_versiya),
          p_manba: 'frontend',
          p_kim: sess.email || '',
        }),
      });

    const matn = await r.text();
    if (!r.ok) {
      return Response.json({ ok: false, error: 'Supabase ' + r.status + ': ' + matn.slice(0, 300) });
    }
    let natija: any;
    try { natija = JSON.parse(matn); } catch {
      return Response.json({ ok: false, error: 'Baza JSON qaytarmadi: ' + matn.slice(0, 200) });
    }

    /* Baza `{ok:false, sabab:'ziddiyat', …}` qaytarishi MUMKIN va bu
       xato emas — normal holat. Uni o'zgartirmasdan uzatamiz. */
    return Response.json({ ...natija, ms: Date.now() - t0 });

  } catch (err: any) {
    return Response.json({ ok: false,
      error: 'Cloudflare xatosi: ' + (err?.message || String(err)),
      ms: Date.now() - t0 });
  }
};
