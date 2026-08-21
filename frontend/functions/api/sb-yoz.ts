/**
 * sb-yoz.ts — TIZIM_02 GA YOZISH (ataylab ЖУДА tor eshik)
 * ═══════════════════════════════════════════════════════════════════
 *
 * `/api/sb` FAQAT O'QIYDI va shunday qolishi kerak. Yozish alohida,
 * o'ta cheklangan eshikdan o'tadi.
 *
 * QOIDALAR:
 *   1) FAQAT quyidagi NOMLANGAN amallar. Ixtiyoriy SQL, ixtiyoriy
 *      jadval, ixtiyoriy RPC — YO'Q. Yangi amal qo'shish = shu faylga
 *      ataylab kod yozish, ya'ni ko'rib chiqiladigan qaror.
 *   2) Har amalning O'Z validatsiyasi bor. «Universal» tekshiruv yo'q.
 *   3) Versiya/idempotentlik majburiy — «oxirgi yozgan yutadi» va
 *      takroriy hujjat moliyaviy ma'lumotda qabul qilinmaydi.
 *   4) Rahbar roli YOZA OLMAYDI — `/api/gas` dagi bilan bir xil qoida.
 *   5) Kim yozgani jurnalga tushadi (`kim` = sessiya email).
 *
 * NIMA UCHUN alohida fayl: o'qish eshigining oq ro'yxati kengayib
 * ketishi mumkin, lekin yozish eshigi HECH QACHON kengaymasligi kerak.
 * Ikkisini bir faylda saqlash — kelajakda tasodifan yozishga ruxsat
 * berib qo'yishning eng qisqa yo'li.
 */
import { tekshir } from '../_shared/auth';

/** Har amal → qaysi RPC va uni kim chaqira oladi. */
const AMALLAR = {
  qator_tahrir:   { rpc: 't2_qator_tahrir' },
  akt_yarat:      { rpc: 't2_akt_yarat' },
  akt_tasdiqlash: { rpc: 't2_akt_tasdiqlash' },
  akt_bekor:      { rpc: 't2_akt_bekor' },
} as const;

type Amal = keyof typeof AMALLAR;

export const onRequestPost: PagesFunction<{
  SUPABASE_URL: string; SUPABASE_KEY: string; SESSIYA_KALIT: string;
}> = async (ctx) => {
  const t0 = Date.now();
  try {
    const secret = ctx.env.SESSIYA_KALIT;
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

    const so = await ctx.request.json<any>();
    /* Eski klientlar `amal` yubormaydi — ular qator tahriri qiladi. */
    const amal: Amal = (so.amal || 'qator_tahrir') as Amal;
    if (!Object.prototype.hasOwnProperty.call(AMALLAR, amal)) {
      return Response.json({ ok: false, error: 'Noma\'lum amal: ' + String(so.amal) });
    }

    let yuk: Record<string, unknown>;

    /* ══════════ QATOR TAHRIRI ══════════ */
    if (amal === 'qator_tahrir') {
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
      yuk = {
        p_qator_id: qatorId,
        p_maydon: so.maydon,
        p_qiymat: so.qiymat == null ? '' : String(so.qiymat),
        p_kutilgan_versiya: Number(so.kutilgan_versiya),
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ HUJJAT YARATISH (fakt / F2) ══════════ */
    } else if (amal === 'akt_yarat') {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      if (so.tur !== 'fakt' && so.tur !== 'f2') {
        return Response.json({ ok: false, error: 'tur faqat «fakt» yoki «f2»' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(so.oy || ''))) {
        return Response.json({ ok: false, error: 'oy YYYY-MM-DD ko\'rinishida bo\'lishi kerak' });
      }
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: 'Hujjatda bironta qator yo\'q' });
      }
      /* ⚠️ IDEMPOTENTLIK MAJBURIY.
         Usiz tarmoq uzilib qayta yuborilsa IKKITA bir xil hujjat
         yaraladi va nakopitelniy ikkalasini qo'shadi — jami ikki
         baravar chiqadi, ogohlantirishsiz. */
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi hujjat yaratadi' });
      }
      /* Faqat kerakli maydonlar o'tkaziladi — klient qo'shimcha
         kalit yuborsa ham u bazaga bormaydi. */
      const qatorlar = so.qatorlar.map((q: any) => {
        const chiqish: Record<string, unknown> = {
          qator_id: Number(q.qator_id),
          hajm: q.hajm,
        };
        if (q.narx != null && q.narx !== '') chiqish.narx = q.narx;
        if (q.izoh) chiqish.izoh = String(q.izoh).slice(0, 500);
        return chiqish;
      });
      if (qatorlar.some((q: any) => !Number.isFinite(q.qator_id) || q.qator_id <= 0)) {
        return Response.json({ ok: false, error: 'Ba\'zi qatorlarda qator_id noto\'g\'ri' });
      }

      /* ⚠️ `majburiy` — invariantni ATAYLAB chetlab o'tish.
         Faqat admin. Oddiy foydalanuvchi smetadan oshiq fakt yozib
         qo'ymasin; agar haqiqatan kerak bo'lsa mas'ul odam qiladi. */
      const majburiy = so.majburiy === true;
      if (majburiy && !(sess.rol === 'admin' || sess.rol === 'superadmin')) {
        return Response.json({ ok: false, status: 403,
          error: 'Invariantni chetlab o\'tish faqat admin huquqi bilan' }, { status: 403 });
      }

      yuk = {
        p_obyekt_id: obyektId,
        p_tur: so.tur,
        p_oy: so.oy,
        p_qatorlar: qatorlar,
        p_raqam: so.raqam ? String(so.raqam).slice(0, 100) : null,
        p_operation_id: so.operation_id,
        p_manba: 'frontend',
        p_kim: sess.email || '',
        p_majburiy: majburiy,
      };

    /* ══════════ TASDIQLASH / BEKOR ══════════ */
    } else {
      const aktId = Number(so.akt_id);
      if (!Number.isFinite(aktId) || aktId <= 0) {
        return Response.json({ ok: false, error: 'akt_id noto\'g\'ri' });
      }
      /* Versiya bu yerda MAJBURIY EMAS, lekin berilsa uzatiladi:
         hujjat holati ikki foydalanuvchi tomonidan bir vaqtda
         o'zgartirilishi kamdan-kam, va RPC `for update` bilan
         qulflaydi. Berilgan bo'lsa qo'shimcha himoya. */
      const versiya = Number(so.kutilgan_versiya);
      const v = Number.isFinite(versiya) ? versiya : null;

      if (amal === 'akt_tasdiqlash') {
        yuk = { p_akt_id: aktId, p_kutilgan_versiya: v, p_kim: sess.email || '' };
      } else {
        yuk = { p_akt_id: aktId, p_kutilgan_versiya: v, p_kim: sess.email || '',
                p_sabab: so.sabab ? String(so.sabab).slice(0, 500) : null };
      }
    }

    const r = await fetch(
      ctx.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + AMALLAR[amal].rpc,
      {
        method: 'POST',
        headers: {
          apikey: ctx.env.SUPABASE_KEY,
          Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(yuk),
      });

    const matn = await r.text();
    if (!r.ok) {
      return Response.json({ ok: false, error: 'Supabase ' + r.status + ': ' + matn.slice(0, 300) });
    }
    let natija: any;
    try { natija = JSON.parse(matn); } catch {
      return Response.json({ ok: false, error: 'Baza JSON qaytarmadi: ' + matn.slice(0, 200) });
    }

    /* Baza `{ok:false, sabab:'ziddiyat'|'invariant', …}` qaytarishi
       MUMKIN va bu xato emas — normal holat. O'zgartirmasdan uzatamiz. */
    return Response.json({ ...natija, amal, ms: Date.now() - t0 });

  } catch (err: any) {
    return Response.json({ ok: false,
      error: 'Cloudflare xatosi: ' + (err?.message || String(err)),
      ms: Date.now() - t0 });
  }
};
