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
  qator_qosh:     { rpc: 't2_qator_qosh' },
  akt_yarat:      { rpc: 't2_akt_yarat' },
  akt_tasdiqlash: { rpc: 't2_akt_tasdiqlash' },
  akt_bekor:      { rpc: 't2_akt_bekor' },
  narx_belgila:   { rpc: 't2_narx_belgila' },
  narx_sana_qosh: { rpc: 't2_narx_sana_qosh' },
  skladga_yozish: { rpc: 't2_skladga_yozish' },
  faktura_yoz:    { rpc: 't2_faktura_yoz' },
  ish_turi_yoz:   { rpc: 't2_ish_turi_yoz' },
  shaxsiy_smeta_yarat: { rpc: 't2_shaxsiy_smeta_yarat' },
  erp_amal:       { rpc: 't2_erp_amal' },
  grafik_yangilash: { rpc: 't2_grafik_yangilash' },
  grafik_sozlama_saqla: { rpc: 't2_grafik_sozlama_saqla' },
  boss_tahlil_boshla: { rpc: 't2_boss_tahlil_boshla' },
  sozlama_saqla: { rpc: 't2_sozlama_saqla' },
  tizim_amal: { rpc: 't2_tizim_amal' },
  xato_yoz: { rpc: 't2_xato_yoz' },
  kirish_amal: { rpc: 't2_kirish_amal' }
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

    /* ══════════ SMETAGA QATOR QO'SHISH ══════════ */
    } else if (amal === 'qator_qosh') {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      const TURLAR = ['rz', 'bl', 'rs', 'mat', 'ob'];
      if (!TURLAR.includes(String(so.tur))) {
        return Response.json({ ok: false, error: 'tur: rz|bl|rs|mat|ob' });
      }
      if (!String(so.nom || '').trim()) {
        return Response.json({ ok: false, error: 'Nom bo\'sh' });
      }
      /* ⚠️ IDEMPOTENTLIK MAJBURIY — `akt_yarat` dagi bilan bir xil sabab:
         tarmoq uzilib qayta yuborilsa smetaga IKKITA bir xil qator
         tushardi va jami ogohlantirishsiz oshardi. */
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi qator yaratadi' });
      }
      /* ⚠️ NORMA: berilgan bo'lsa son bo'lishi shart, lekin MANFIY
         bo'lishi MUMKIN. `> 0` deb tekshirish ПЕРЕРАСЧЁТ ni bloklardi —
         bu tizimda bir necha marta shu xato qilingan. */
      let norma: number | null = null;
      if (so.norma != null && so.norma !== '') {
        norma = Number(so.norma);
        if (!Number.isFinite(norma)) {
          return Response.json({ ok: false, error: 'norma son emas' });
        }
      }
      /* ⚠️ Narx BERILMASA yuborilmaydi (null emas, umuman yo'q) —
         shunda baza narxlar bazasidan qidiradi. 0 yuborish «bepul»
         degani bo'lardi. */
      let narx: number | null = null;
      if (so.narx != null && so.narx !== '') {
        narx = Number(so.narx);
        if (!Number.isFinite(narx)) {
          return Response.json({ ok: false, error: 'narx son emas' });
        }
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_tur: so.tur,
        p_nom: String(so.nom).slice(0, 500),
        p_ota_id: so.ota_id == null ? null : Number(so.ota_id),
        p_kod: so.kod ? String(so.kod).slice(0, 100) : null,
        p_birlik: so.birlik ? String(so.birlik).slice(0, 50) : null,
        p_norma: norma,
        p_narx: narx,
        p_e_obyom: so.e_obyom == null ? null : so.e_obyom === true,
        p_kat: so.kat ? String(so.kat).slice(0, 20) : null,
        p_keyin_id: so.keyin_id == null ? null : Number(so.keyin_id),
        p_operation_id: so.operation_id,
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ NARX BELGILASH ══════════ */
    } else if (amal === 'narx_belgila') {
      if (!String(so.nom || '').trim()) {
        return Response.json({ ok: false, error: 'Nom bo\'sh' });
      }
      /* ⚠️ NARX O'ZIDAN TO'QILMAYDI. «Belgilash» — bu ATAYLAB qo'yilgan
         raqam. Noma'lum bo'lsa bu amal umuman chaqirilmaydi; bo'sh
         yuborib «0» bo'lib qolishiga yo'l qo'ymaymiz. */
      const narx = Number(so.narx);
      if (so.narx == null || so.narx === '' || !Number.isFinite(narx) || narx < 0) {
        return Response.json({ ok: false,
          error: 'Belgilanadigan narx musbat son bo\'lishi kerak' });
      }
      yuk = {
        p_nom: String(so.nom).slice(0, 500),
        p_birlik: so.birlik ? String(so.birlik).slice(0, 50) : null,
        p_narx: narx,
        p_kat: so.kat ? String(so.kat).slice(0, 20) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null
          ? null : Number(so.kutilgan_versiya),
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ SANA (BOZOR) NARXLARI ══════════ */
    } else if (amal === 'narx_sana_qosh') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(so.sana || ''))) {
        return Response.json({ ok: false, error: 'sana YYYY-MM-DD bo\'lishi kerak' });
      }
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: 'Bironta qator yo\'q' });
      }
      /* ⚠️ Yaroqsiz qatorlarni BU YERDA tashlamaymiz — baza ularni
         sanab, `tashlangan_qatorlar` bo'lib qaytaradi. Bu yerda jim
         filtrlab yuborsak «qancha kirdi = qancha yozildi» kafolati
         yolg'on bo'lib qolardi. */
      const qatorlar = so.qatorlar.slice(0, 5000).map((q: any) => ({
        nom: String(q.nom ?? '').slice(0, 500),
        birlik: q.birlik ? String(q.birlik).slice(0, 50) : null,
        narx: q.narx,
        izoh: q.izoh ? String(q.izoh).slice(0, 300) : null,
      }));
      yuk = {
        p_sana: so.sana,
        p_qatorlar: qatorlar,
        p_manba: so.manba ? String(so.manba).slice(0, 100) : null,
        p_kim: sess.email || '',
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

