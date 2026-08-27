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
  kirish_amal: { rpc: 't2_kirish_amal' },
  taklif_yubor: { rpc: 't2_taklif_yubor' },
  taklif_qabul: { rpc: 't2_taklif_qabul' },
  birja_rfq_yarat: { rpc: 't2_birja_rfq_yarat' },
  birja_taklif_ber: { rpc: 't2_birja_taklif_ber' },
  viborka_smetadan_toldir: { rpc: 't2_viborka_smetadan_toldir' },
  viborka_qabul_yoz: { rpc: 't2_viborka_qabul_yoz' },
  shartnoma_saqla: { rpc: 't2_shartnoma_saqla' },
  shartnoma_ochir: { rpc: 't2_shartnoma_ochir' },
  shartnoma_bog_saqla: { rpc: 't2_shartnoma_bog_saqla' },
  nakrutka_saqla: { rpc: 't2_nakrutka_saqla' },
  tolov_yoz: { rpc: 't2_tolov_yoz' },
  tolov_tahrir: { rpc: 't2_tolov_tahrir' },
  tolov_ochir: { rpc: 't2_tolov_ochir' },
  xarajat_yoz: { rpc: 't2_xarajat_yoz' },
  xarajat_tahrir: { rpc: 't2_xarajat_tahrir' },
  xarajat_ochir: { rpc: 't2_xarajat_ochir' },
  korzinkaga_tashlash: { rpc: 't2_korzinkaga_tashlash' },
  korzinkadan_tiklash: { rpc: 't2_korzinkadan_tiklash' },
  butunlay_ochirish: { rpc: 't2_butunlay_ochirish' },
  obyekt_yangila: { rpc: 't2_obyekt_yangila' }
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

    /* ══════════ VIBORKA — SMETADAN REJA TO'LDIRISH ══════════ */
    } else if (amal === 'viborka_smetadan_toldir') {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      yuk = { p_obyekt_id: obyektId };

    /* ══════════ VIBORKA — MATERIAL QABULI ══════════ */
    } else if (amal === 'viborka_qabul_yoz') {
      const viborkaId = Number(so.viborka_id);
      if (!Number.isFinite(viborkaId) || viborkaId <= 0) {
        return Response.json({ ok: false, error: 'viborka_id noto\'g\'ri' });
      }
      const hajm = Number(so.hajm);
      if (!Number.isFinite(hajm) || hajm === 0) {
        return Response.json({ ok: false, error: 'hajm 0 yoki bo\'sh bo\'lishi mumkin emas' });
      }
      /* ⚠️ IDEMPOTENTLIK MAJBURIY — boshqa moliyaviy yozuvlar bilan bir xil sabab. */
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi qabul yaratadi' });
      }
      yuk = {
        p_viborka_id: viborkaId,
        p_hajm: hajm,
        p_narx: (so.narx == null || so.narx === '') ? null : Number(so.narx),
        p_yetkazib_beruvchi: so.yetkazib_beruvchi ? String(so.yetkazib_beruvchi).slice(0, 200) : null,
        p_sana: so.sana || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_operation_id: so.operation_id,
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ ШАРТНОМА SAQLASH ══════════ */
    } else if (amal === 'shartnoma_saqla') {
      if (!String(so.raqam || '').trim()) {
        return Response.json({ ok: false, error: 'Shartnoma raqami bo\'sh' });
      }
      yuk = {
        p_raqam: String(so.raqam).slice(0, 100),
        p_nom: so.nom ? String(so.nom).slice(0, 500) : null,
        p_taraf: so.taraf ? String(so.taraf).slice(0, 300) : null,
        p_summa_bez_nds: so.summa_bez_nds == null ? null : Number(so.summa_bez_nds),
        p_nds: so.nds == null ? null : Number(so.nds),
        p_jami_nds_bilan: so.jami_nds_bilan == null ? null : Number(so.jami_nds_bilan),
        p_chel_stavka: so.chel_stavka == null ? null : Number(so.chel_stavka),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1000) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ ШАРТНОМА BEKOR QILISH ══════════ */
    } else if (amal === 'shartnoma_ochir') {
      const shartnomaId = Number(so.shartnoma_id);
      if (!Number.isFinite(shartnomaId) || shartnomaId <= 0) {
        return Response.json({ ok: false, error: 'shartnoma_id noto\'g\'ri' });
      }
      yuk = {
        p_shartnoma_id: shartnomaId,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
      };

    /* ══════════ OBYEKTNI ШАРТНОМАGA BOG'LASH ══════════ */
    } else if (amal === 'shartnoma_bog_saqla') {
      const obyektId = Number(so.obyekt_id);
      const shartnomaId = Number(so.shartnoma_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      if (!Number.isFinite(shartnomaId) || shartnomaId <= 0) {
        return Response.json({ ok: false, error: 'shartnoma_id noto\'g\'ri' });
      }
      yuk = { p_obyekt_id: obyektId, p_shartnoma_id: shartnomaId };

    /* ══════════ НАКРУТКА KOEFFITSIENTLARINI SAQLASH ══════════
       ⚠️ shartnoma_id berilmasa UMUMIY DEFAULT yangilanadi — bu BARCHA
       shartnomalarga ta'sir qiladi. Faqat admin/superadmin qila oladi. */
    } else if (amal === 'nakrutka_saqla') {
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: 'Bironta koeffitsient yo\'q' });
      }
      const shartnomaId = so.shartnoma_id == null ? null : Number(so.shartnoma_id);
      if (shartnomaId === null && !(sess.rol === 'admin' || sess.rol === 'superadmin')) {
        return Response.json({ ok: false, status: 403,
          error: 'Umumiy default накрутка faqat admin huquqi bilan o\'zgartiriladi' }, { status: 403 });
      }
      const qatorlar = so.qatorlar.slice(0, 50).map((q: any) => ({
        koef: String(q.koef ?? '').slice(0, 100),
        qiymat: q.qiymat,
        izoh: q.izoh ? String(q.izoh).slice(0, 300) : null,
      }));
      yuk = { p_qatorlar: qatorlar, p_shartnoma_id: shartnomaId };

    /* ══════════ TO'LOV YOZISH ══════════
       ⚠️ IDEMPOTENTLIK MAJBURIY — moliyaviy yozuv, tarmoq uzilib qayta
       yuborilsa ikkinchi to'lov paydo bo'lmasin. */
    } else if (amal === 'tolov_yoz') {
      const shartnomaId = Number(so.shartnoma_id);
      const summa = Number(so.summa);
      if (!Number.isFinite(shartnomaId) || shartnomaId <= 0) {
        return Response.json({ ok: false, error: 'shartnoma_id noto\'g\'ri' });
      }
      if (!Number.isFinite(summa) || summa === 0) {
        return Response.json({ ok: false, error: 'summa 0 yoki bo\'sh bo\'lishi mumkin emas' });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi to\'lov yaratadi' });
      }
      yuk = {
        p_shartnoma_id: shartnomaId,
        p_summa: summa,
        p_tur: so.tur ? String(so.tur).slice(0, 20) : 'tolov',
        p_sana: so.sana || null,
        p_obyekt_id: so.obyekt_id == null ? null : Number(so.obyekt_id),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ TO'LOV TAHRIRLASH ══════════ */
    } else if (amal === 'tolov_tahrir') {
      const tolovId = Number(so.tolov_id);
      if (!Number.isFinite(tolovId) || tolovId <= 0) {
        return Response.json({ ok: false, error: 'tolov_id noto\'g\'ri' });
      }
      yuk = {
        p_tolov_id: tolovId,
        p_summa: so.summa == null ? null : Number(so.summa),
        p_sana: so.sana || null,
        p_tur: so.tur ? String(so.tur).slice(0, 20) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
      };

    /* ══════════ TO'LOV BEKOR QILISH (soft-cancel, o'chirmaydi) ══════════ */
    } else if (amal === 'tolov_ochir') {
      const tolovId = Number(so.tolov_id);
      if (!Number.isFinite(tolovId) || tolovId <= 0) {
        return Response.json({ ok: false, error: 'tolov_id noto\'g\'ri' });
      }
      yuk = { p_tolov_id: tolovId,
              p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya) };

    /* ══════════ XARAJAT YOZISH ══════════ */
    } else if (amal === 'xarajat_yoz') {
      const summa = Number(so.summa);
      if (!Number.isFinite(summa) || summa === 0) {
        return Response.json({ ok: false, error: 'summa 0 yoki bo\'sh bo\'lishi mumkin emas' });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi xarajat yaratadi' });
      }
      yuk = {
        p_summa: summa,
        p_toifa: so.toifa ? String(so.toifa).slice(0, 100) : null,
        p_sana: so.sana || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ XARAJAT TAHRIRLASH ══════════ */
    } else if (amal === 'xarajat_tahrir') {
      const xarajatId = Number(so.xarajat_id);
      if (!Number.isFinite(xarajatId) || xarajatId <= 0) {
        return Response.json({ ok: false, error: 'xarajat_id noto\'g\'ri' });
      }
      yuk = {
        p_xarajat_id: xarajatId,
        p_summa: so.summa == null ? null : Number(so.summa),
        p_toifa: so.toifa ? String(so.toifa).slice(0, 100) : null,
        p_sana: so.sana || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
      };

    /* ══════════ XARAJAT BEKOR QILISH (soft-cancel, o'chirmaydi) ══════════ */
    } else if (amal === 'xarajat_ochir') {
      const xarajatId = Number(so.xarajat_id);
      if (!Number.isFinite(xarajatId) || xarajatId <= 0) {
        return Response.json({ ok: false, error: 'xarajat_id noto\'g\'ri' });
      }
      yuk = { p_xarajat_id: xarajatId,
              p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya) };

    /* ══════════ TASDIQLASH / BEKOR ══════════ */
    } else if (amal === 'akt_tasdiqlash' || amal === 'akt_bekor') {
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

    } else if (amal === 'skladga_yozish') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_operatsiya: so.operatsiya,
        p_obyekt_id: Number(so.obyekt_id),
        p_turi: so.turi,
        p_sana: so.sana,
        p_nomi: so.nomi,
        p_birligi: so.birligi,
        p_obyomi: Number(so.obyomi)
      };

    } else if (amal === 'faktura_yoz') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_raqam: so.raqam,
        p_sana: so.sana,
        p_kontragent: so.kontragent,
        p_inn: so.inn,
        p_summa: Number(so.summa),
        p_holat: so.holat,
        p_items: so.items || [],
        p_id: so.id ? Number(so.id) : null
      };

    } else if (amal === 'ish_turi_yoz') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_kod: so.kod,
        p_nomi: so.nomi,
        p_birligi: so.birligi,
        p_norma: Number(so.norma),
        p_narx: Number(so.narx),
        p_kategoriya: so.kategoriya,
        p_id: so.id ? Number(so.id) : null
      };

    } else if (amal === 'shaxsiy_smeta_yarat') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_nom: String(so.nom || ''),
        p_qatorlar: so.qatorlar ? JSON.stringify(so.qatorlar) : '[]'
      };

    } else if (amal === 'korzinkaga_tashlash' || amal === 'korzinkadan_tiklash' || amal === 'butunlay_ochirish') {
      yuk = {
        p_jadval: String(so.jadval || so.rpcArgs?.p_jadval || ''),
        p_id: Number(so.id || so.rpcArgs?.p_id)
      };

    } else if (amal === 'obyekt_yangila') {
      yuk = {
        p_id: Number(so.id || so.rpcArgs?.p_id),
        p_nomi: String(so.nomi || so.rpcArgs?.p_nomi || ''),
        p_tur: String(so.tur || so.rpcArgs?.p_tur || '')
      };

    } else if (amal === 'grafik_yangilash' || amal === 'grafik_sozlama_saqla') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id || 0),
        p_obyekt_id: Number(so.obyekt_id || 0),
        p_payload: JSON.stringify(so)
      };

    } else if (amal === 'sozlama_saqla') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id || 0),
        p_sozlamalar: so.sozlamalar ? JSON.stringify(so.sozlamalar) : JSON.stringify(so)
      };

    } else if (amal === 'tizim_amal') {
      yuk = {
        p_turi: String(so.tizim_amal_turi || so.turi || so.harakat || ''),
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };

    } else if (amal === 'xato_yoz') {
      yuk = {
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };

    } else if (amal === 'erp_amal') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id || 0),
        p_operatsiya: String(so.operatsiya || ''),
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };

    } else if (amal === 'boss_tahlil_boshla') {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id || 0),
        p_oy: String(so.oy || '')
      };

    } else if (amal === 'kirish_amal' || amal === 'taklif_yubor' || amal === 'taklif_qabul' || amal === 'birja_rfq_yarat' || amal === 'birja_taklif_ber') {
      yuk = {
        p_kompaniya_id: so.kompaniya_id ? Number(so.kompaniya_id) : 0,
        p_foydalanuvchi: String(so.foydalanuvchi || ''),
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };
       🚧 2026-08-25 (Claude): `AMALLAR` da RO'YXATDAN O'TGAN, lekin bu
       yerda o'z shoxobchasi bo'lmagan amallar avval JIM shu yerga —
       aslida `akt_tasdiqlash`/`akt_bekor` uchun yozilgan yuqoridagi
       blokka — tushib, ular kutmagan `p_akt_id` kabi parametrlar bilan
       chaqirilardi. Bu amallarning ko'pi (sklad/faktura/erp/grafik/...)
       RPC darajasida ham hali bazada YO'Q (tekshirildi). Aniq xato
       xabari — soxta muvaffaqiyatdan yaxshiroq. Har amal o'z egasi
       tomonidan tegishli parametrlar bilan to'ldirilishi kerak. */
    } else {
      return Response.json({ ok: false,
        error: 'Amal "' + amal + '" ro\'yxatda bor, lekin hali parametr moslashtirilmagan (TODO)' });
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

