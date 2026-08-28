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
  obyekt_yangila: { rpc: 't2_obyekt_yangila' },
  aosr_yoz: { rpc: 't2_aosr_yoz' },
  aosr_bekor: { rpc: 't2_aosr_bekor' },
  aosr_bog_saqla: { rpc: 't2_aosr_bog_saqla' },
  aosr_bog_ochir: { rpc: 't2_aosr_bog_ochir' },
  audit_yoz: { rpc: 't2_audit_yoz' },
  hujjat_yoz: { rpc: 't2_obyekt_hujjat_yoz' },
  hujjat_ochir: { rpc: 't2_obyekt_hujjat_ochir' },
  sklad_mustaqil_yarat: { rpc: 't2_sklad_yarat' },
  kadr_mustaqil_yarat: { rpc: 't2_kadr_yarat' },
  texnika_mustaqil_yarat: { rpc: 't2_texnika_yarat' },
  resurs_bog_saqla: { rpc: 't2_resurs_bog_saqla' },
  resurs_bog_ochir: { rpc: 't2_resurs_bog_ochir' },
  loyiha_yarat: { rpc: 't2_loyiha_yarat' },
  loyiha_yangila: { rpc: 't2_loyiha_yangila' },
  loyiha_ochir: { rpc: 't2_loyiha_ochir' },
  obyekt_loyihaga_biriktir: { rpc: 't2_obyekt_loyihaga_biriktir' },
  loyiha_qatnashchi_biriktir: { rpc: 't2_loyiha_qatnashchi_biriktir' },
  loyiha_qatnashchi_ochir: { rpc: 't2_loyiha_qatnashchi_ochir' },
  kontragent_saqla: { rpc: 't2_kontragent_saqla' },
  kontragent_ochir: { rpc: 't2_kontragent_ochir' },
  fakt_yoz: { rpc: 't2_fakt_yoz' },
  fakt_belgila: { rpc: 't2_fakt_belgila' },
  azolik_qosh: { rpc: 't2_azolik_qosh' },
  azolik_rol_ozgartir: { rpc: 't2_azolik_rol_ozgartir' },
  azolik_ochir: { rpc: 't2_azolik_ochir' },
  /* ⚠️ 2026-08-28: `kompaniya_yangila` bir marta (2026-08-27) qo'shilgan
   * edi, lekin keyingi merge'da (`f9a9d04`) YO'QOLIB QOLGAN — DB
   * funksiyasi (`t2_kompaniya_yangila`) va frontend chaqiruvi
   * (`sbKompaniyaYangila`, `supabase.ts`) omon qolgan, faqat shu
   * ko'prik yo'qolgan edi. Tiklandi. Bu — parallel ish paytida
   * merge silliq o'chirib yuborishi mumkinligiga JONLI misol; shuning
   * uchun har muhim o'zgarishdan keyin push'dan OLDIN diffni ko'rish
   * kerak. */
  kompaniya_yangila: { rpc: 't2_kompaniya_yangila' },
  /* MATERIAL ALIASLARI — AI semantik qidiruv (2026-08-28). */
  material_alias_yoz: { rpc: 't2_material_alias_yoz' },
  material_alias_ochir: { rpc: 't2_material_alias_ochir' },
  /* MINDMAP — chiziq tortib bog'lash/uzish (2026-08-28) */
  mindmap_bog: { rpc: 't2_mindmap_bog' },
  mindmap_bog_ochir: { rpc: 't2_mindmap_bog_ochir' },
  mindmap_joylashuv_saqla: { rpc: 't2_mindmap_joylashuv_saqla' }
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

    /* ⚡ 2026-08-27 (Claude, foydalanuvchi tasdig'i — "haqiqiy multi-
     * tenant" poydevorining birinchi haqiqiy TEKSHIRUVI): avvalgacha
     * `kompaniya_id` mijoz yuborgan har qanday qiymat bo'lardi va
     * SERVER buni sessiya bilan solishtirmasdi — ya'ni har qanday
     * tizimga kirgan odam so'rov tanasida boshqa kompaniyaning
     * `kompaniya_id`sini yuborib, o'sha kompaniyaga yozishi (nazariy
     * jihatdan) mumkin edi. Endi: sessiya `kompaniyalar` ro'yxatini
     * bilsa (YANGI kirishlardan keyin — `t2_kirish_royxatga_ol` orqali)
     * va so'rov `kompaniya_id` yuborsa, u shu ro'yxatda BO'LISHI SHART.
     *
     * ⚠️ ATAYLAB QISMAN: `sess.kompaniyalar === undefined` (ESKI
     * sessiya, bu o'zgarishdan oldin chiqarilgan) bo'lsa — tekshiruv
     * O'TKAZIB YUBORILADI (eski foydalanuvchilar 12 soat ichida
     * bloklanib qolmasin). Bu vaqtinchalik ko'prik, sessiyalar tabiiy
     * yangilangach hamma yangi tekshiruv ostida bo'ladi. */
    if (Array.isArray(sess.kompaniyalar) && so.kompaniya_id != null) {
      const soraganKompaniya = Number(so.kompaniya_id);
      if (Number.isFinite(soraganKompaniya)) {
        /* ⚡ 2026-08-27: `kompaniyalar` endi {kompaniya_id, rol}
         * juftliklari — a'zolikning O'ZINI (borligini) VA o'sha
         * kompaniyadagi ROLINI birga topamiz. */
        const azolik = sess.kompaniyalar.find((a) => a.kompaniya_id === soraganKompaniya);
        if (!azolik) {
          return Response.json({ ok: false,
            error: 'Bu kompaniyaga a\'zo emassiz (kompaniya_id: ' + soraganKompaniya + ')' },
            { status: 403 });
        }
        /* "POLIMORFIK ROL" — yuqoridagi global `sess.rol` tekshiruvi
         * GAS'dan kelgan BITTA rolga asoslanadi (barcha kompaniya uchun
         * bir xil). Lekin bitta odam bir kompaniyada admin, boshqasida
         * faqat rahbar (ko'ruvchi) bo'lishi mumkin — bu haqiqiy
         * maqsad. Shu kompaniyaga xos rol boss/rahbar bo'lsa, global
         * rol boshqacha bo'lsa ham bu YOZUV rad etiladi. */
        if (azolik.rol === 'boss' || azolik.rol === 'rahbar') {
          return Response.json({ ok: false,
            error: 'Bu kompaniyada rahbar rolida yozish mumkin emas' },
            { status: 403 });
        }
      }
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

    /* ══════════ SKLADGA YOZISH ══════════
       ⚠️ IDEMPOTENTLIK MAJBURIY — sklad qoldig'iga ta'sir qiladi. */
    } else if (amal === 'skladga_yozish') {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      if (so.operatsiya !== 'prixod' && so.operatsiya !== 'rasxod') {
        return Response.json({ ok: false, error: 'operatsiya faqat «prixod» yoki «rasxod»' });
      }
      const obyomi = Number(so.obyomi);
      if (!Number.isFinite(obyomi) || obyomi <= 0) {
        return Response.json({ ok: false, error: 'obyomi musbat son bo\'lishi kerak' });
      }
      if (!String(so.nomi || '').trim() || !String(so.birligi || '').trim()) {
        return Response.json({ ok: false, error: 'nomi va birligi bo\'sh bo\'lishi mumkin emas' });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi harakat yaratadi' });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_operatsiya: so.operatsiya,
        p_obyekt_id: obyektId,
        p_turi: so.turi ? String(so.turi).slice(0, 20) : 'mat',
        p_sana: so.sana || null,
        p_nomi: String(so.nomi).slice(0, 300),
        p_birligi: String(so.birligi).slice(0, 50),
        p_obyomi: obyomi,
        p_postavshik: so.postavshik ? String(so.postavshik).slice(0, 200) : null,
        p_qabul_qiluvchi: so.qabul_qiluvchi ? String(so.qabul_qiluvchi).slice(0, 200) : null,
        p_qabul_turi: so.qabul_turi ? String(so.qabul_turi).slice(0, 50) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    /* ══════════ FAKTURA (Didox EHF) ══════════
       ⚠️ Yaratishda operation_id majburiy; tahrirlashda (p_id berilsa)
       kompaniya_id ham bazada tekshiriladi (boshqa kompaniyaga tegishli
       fakturani o'zgartirib bo'lmaydi) va versiya tekshiriladi. */
    } else if (amal === 'faktura_yoz') {
      if (!String(so.raqam || '').trim() || !String(so.inn || '').trim()) {
        return Response.json({ ok: false, error: 'raqam va inn bo\'sh bo\'lishi mumkin emas' });
      }
      const id = so.id ? Number(so.id) : null;
      if (!id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi faktura yaratadi' });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_raqam: String(so.raqam).slice(0, 100),
        p_sana: so.sana,
        p_kontragent: String(so.kontragent || '').slice(0, 300),
        p_inn: String(so.inn).slice(0, 20),
        p_summa: Number(so.summa),
        p_holat: so.holat || 'yangi',
        p_items: so.items || [],
        p_id: id,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_operation_id: id ? null : so.operation_id,
        p_kim: sess.email || '',
      };

    /* ══════════ ISH TURI (spravochnik) ══════════ */
    } else if (amal === 'ish_turi_yoz') {
      if (!String(so.kod || '').trim() || !String(so.nomi || '').trim()) {
        return Response.json({ ok: false, error: 'kod va nomi bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_kod: String(so.kod).slice(0, 100),
        p_nomi: String(so.nomi).slice(0, 300),
        p_birligi: String(so.birligi || '').slice(0, 50),
        p_norma: so.norma == null ? 0 : Number(so.norma),
        p_narx: so.narx == null ? 0 : Number(so.narx),
        p_kategoriya: so.kategoriya ? String(so.kategoriya).slice(0, 100) : null,
        p_id: so.id ? Number(so.id) : null
      };

    /* ══════════ SHAXSIY SMETA ══════════ */
    } else if (amal === 'shaxsiy_smeta_yarat') {
      if (!String(so.nom || '').trim()) {
        return Response.json({ ok: false, error: 'nom bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_nom: String(so.nom).slice(0, 500),
        p_qatorlar: so.qatorlar || [],
        p_kim: sess.email || '',
      };

    /* ══════════ АОСР (yashirin ishlar akti) ══════════ */
    } else if (amal === 'aosr_yoz') {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      const id = so.id ? Number(so.id) : null;
      if (!id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi akt yaratadi' });
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_raqam: so.raqam ? String(so.raqam).slice(0, 100) : null,
        p_ish_nomi: so.ish_nomi ? String(so.ish_nomi).slice(0, 500) : null,
        p_boshlanish_sana: so.boshlanish_sana || null,
        p_tugash_sana: so.tugash_sana || null,
        p_bajarilgan: so.bajarilgan ? String(so.bajarilgan).slice(0, 300) : null,
        p_pdf_url: so.pdf_url ? String(so.pdf_url).slice(0, 1000) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1000) : null,
        p_holat: so.holat || 'yangi',
        p_id: id,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_operation_id: id ? null : so.operation_id,
        p_manba: 'frontend',
        p_kim: sess.email || '',
      };

    } else if (amal === 'aosr_bekor') {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      yuk = { p_id: id, p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya) };

    } else if (amal === 'aosr_bog_saqla') {
      if (!Array.isArray(so.aosr_ids) || !so.aosr_ids.length ||
          !Array.isArray(so.qator_ids) || !so.qator_ids.length) {
        return Response.json({ ok: false, error: 'akt yoki qator tanlanmagan' });
      }
      yuk = {
        p_aosr_ids: so.aosr_ids.slice(0, 200).map(Number),
        p_qator_ids: so.qator_ids.slice(0, 500).map(Number),
      };

    } else if (amal === 'aosr_bog_ochir') {
      const aosrId = Number(so.aosr_id);
      const qatorId = Number(so.qator_id);
      if (!Number.isFinite(aosrId) || aosrId <= 0 || !Number.isFinite(qatorId) || qatorId <= 0) {
        return Response.json({ ok: false, error: 'aosr_id yoki qator_id noto\'g\'ri' });
      }
      yuk = { p_aosr_id: aosrId, p_qator_id: qatorId };

    /* ══════════ AUDIT LOG ══════════
       ⚠️ Log yozuvi — idempotentlik shart emas (ikkilanib yozilishi
       jiddiy xavf emas, log yo'qolib qolishi yomonroq). */
    } else if (amal === 'audit_yoz') {
      if (!String(so.amal_turi || '').trim() || !String(so.modul || '').trim()) {
        return Response.json({ ok: false, error: 'amal_turi va modul bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_amal_turi: String(so.amal_turi).slice(0, 100),
        p_modul: String(so.modul).slice(0, 100),
        p_obyekt_id: so.obyekt_id == null ? null : Number(so.obyekt_id),
        p_tafsilot: so.tafsilot ? String(so.tafsilot).slice(0, 2000) : null,
        p_kim: sess.email || '',
        p_ip: ctx.request.headers.get('CF-Connecting-IP') || null,
      };

    /* ══════════ OBYEKT HUJJATLARI (loyiha/tasdiqlangan fayllar) ══════════
       ⚠️ 2026-08-27 (Claude): «Arxiv (R2)» avval obyektga UMUMAN
       bog'lanmagan, ro'yxatsiz bitta-fayl-yuklovchi edi. Endi har fayl
       aniq obyektga (`obyekt_id`) va turga (loyiha|hujjat) bog'lanadi. */
    } else if (amal === 'hujjat_yoz') {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      if (!String(so.nom || '').trim() || !String(so.url || '').trim()) {
        return Response.json({ ok: false, error: 'nom va url bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_turi: so.turi === 'loyiha' ? 'loyiha' : 'hujjat',
        p_nom: String(so.nom).slice(0, 300),
        p_url: String(so.url).slice(0, 1000),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1000) : null,
        p_kim: sess.email || '',
      };

    } else if (amal === 'hujjat_ochir') {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      yuk = { p_id: id };

    /* ══════════ MUSTAQIL RESURSLAR (M:N sklad/kadr/texnika) ══════════
       ⚠️ 2026-08-27: "32 gektar ichida 40 obyekt, 1 umumiy sklad"
       arxitekturasi — resurs bitta obyektga qattiq bog'lanmaydi,
       junction jadval orqali bir yoki bir nechta obyektga ulanadi. */
    } else if (amal === 'sklad_mustaqil_yarat') {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: 'kompaniya_id noto\'g\'ri' });
      }
      if (!String(so.nomi || '').trim()) {
        return Response.json({ ok: false, error: 'nomi bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_nomi: String(so.nomi).slice(0, 300),
        p_manzil: so.manzil ? String(so.manzil).slice(0, 500) : null,
        p_masul_shaxs: so.masul_shaxs ? String(so.masul_shaxs).slice(0, 200) : null,
      };

    } else if (amal === 'kadr_mustaqil_yarat') {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: 'kompaniya_id noto\'g\'ri' });
      }
      if (!String(so.ism_sharif || '').trim() || !String(so.lavozim || '').trim()) {
        return Response.json({ ok: false, error: 'ism_sharif va lavozim bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_ism_sharif: String(so.ism_sharif).slice(0, 200),
        p_lavozim: String(so.lavozim).slice(0, 200),
        p_oylik_maosh: so.oylik_maosh == null ? null : Number(so.oylik_maosh),
        p_valyuta: so.valyuta ? String(so.valyuta).slice(0, 10) : 'UZS',
      };

    } else if (amal === 'texnika_mustaqil_yarat') {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: 'kompaniya_id noto\'g\'ri' });
      }
      if (!String(so.nomi || '').trim()) {
        return Response.json({ ok: false, error: 'nomi bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_nomi: String(so.nomi).slice(0, 300),
        p_davlat_raqami: so.davlat_raqami ? String(so.davlat_raqami).slice(0, 50) : null,
        p_yoqilgi_mejori: so.yoqilgi_mejori == null ? null : Number(so.yoqilgi_mejori),
      };

    } else if (amal === 'resurs_bog_saqla' || amal === 'resurs_bog_ochir') {
      const TUR_RUXSAT = ['sklad', 'kadr', 'texnika'];
      const tur = String(so.tur || '');
      const resursId = Number(so.resurs_id);
      const obyektId = Number(so.obyekt_id);
      if (!TUR_RUXSAT.includes(tur)) {
        return Response.json({ ok: false, error: 'noma\'lum tur: ' + tur });
      }
      if (!Number.isFinite(resursId) || resursId <= 0 || !Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'resurs_id yoki obyekt_id noto\'g\'ri' });
      }
      yuk = { p_tur: tur, p_resurs_id: resursId, p_obyekt_id: obyektId };

    /* ══════════ LOYIHA (Kompaniya→Loyiha→Obyekt) ══════════ */
    } else if (amal === 'loyiha_yarat') {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: 'kompaniya_id noto\'g\'ri' });
      }
      if (!String(so.nom || '').trim()) {
        return Response.json({ ok: false, error: 'nom bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_nom: String(so.nom).slice(0, 300),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1000) : null,
        p_hudud: so.hudud ? String(so.hudud).slice(0, 200) : null,
        /* ⚠️ byudjet: 0 va "belgilanmagan" FARQLI. `undefined`/`null` →
           NULL bo'lib qoladi, 0 esa haqiqiy nol byudjet sifatida saqlanadi. */
        p_byudjet: so.byudjet == null || so.byudjet === '' ? null : Number(so.byudjet),
      };

    } else if (amal === 'loyiha_yangila') {
      const id = Number(so.id);
      const kutilganVersiya = Number(so.kutilgan_versiya);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      if (!Number.isFinite(kutilganVersiya)) {
        return Response.json({ ok: false, error: 'kutilgan_versiya kerak (optimistik qulf)' });
      }
      const HOLAT_RUXSAT = ['faol', 'tuxtatilgan', 'yakunlangan', 'bekor'];
      if (so.holat != null && !HOLAT_RUXSAT.includes(String(so.holat))) {
        return Response.json({ ok: false, error: 'holat noto\'g\'ri: ' + HOLAT_RUXSAT.join('|') });
      }
      yuk = {
        p_id: id,
        p_kutilgan_versiya: kutilganVersiya,
        p_nom: so.nom ? String(so.nom).slice(0, 300) : null,
        p_izoh: so.izoh != null ? String(so.izoh).slice(0, 1000) : null,
        p_hudud: so.hudud != null ? String(so.hudud).slice(0, 200) : null,
        p_byudjet: so.byudjet == null || so.byudjet === '' ? null : Number(so.byudjet),
        p_holat: so.holat ? String(so.holat) : null,
      };

    } else if (amal === 'loyiha_ochir') {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      yuk = { p_id: id };

    } else if (amal === 'obyekt_loyihaga_biriktir') {
      const obyektId = Number(so.obyekt_id);
      const loyihaId = so.loyiha_id == null ? null : Number(so.loyiha_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      yuk = { p_obyekt_id: obyektId, p_loyiha_id: loyihaId };

    /* ⚠️ Polimorfik tashkilot bog'lanishi (MASTER_REJA band 1): taraf
       kompaniya_id YOKI kontragent_id — ANIQ BITTASI, ikkalasi ham yoki
       hech biri emas. RPC ham CHECK bilan tekshiradi, bu ikkinchi
       qatlam (frontend soxta ikkalasini ham yuborsa ham ushlanadi). */
    } else if (amal === 'loyiha_qatnashchi_biriktir') {
      const loyihaId = Number(so.loyiha_id);
      if (!Number.isFinite(loyihaId) || loyihaId <= 0) {
        return Response.json({ ok: false, error: 'loyiha_id noto\'g\'ri' });
      }
      const kompaniyaId = so.kompaniya_id == null ? null : Number(so.kompaniya_id);
      const kontragentId = so.kontragent_id == null ? null : Number(so.kontragent_id);
      const bittaTaraf = (kompaniyaId != null) !== (kontragentId != null);
      if (!bittaTaraf) {
        return Response.json({ ok: false, error: 'Aynan bittasi kerak: kompaniya_id YOKI kontragent_id' });
      }
      const ROL_RUXSAT = ['zakazchik', 'bosh_pudratchi', 'subpudratchi', 'loyihachi', 'taminotchi'];
      if (!ROL_RUXSAT.includes(String(so.rol))) {
        return Response.json({ ok: false, error: 'rol noto\'g\'ri: ' + ROL_RUXSAT.join('|') });
      }
      yuk = {
        p_loyiha_id: loyihaId,
        p_kompaniya_id: kompaniyaId,
        p_kontragent_id: kontragentId,
        p_rol: String(so.rol),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
      };

    } else if (amal === 'loyiha_qatnashchi_ochir') {
      const id = Number(so.id);
      const kutilganVersiya = Number(so.kutilgan_versiya);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      if (!Number.isFinite(kutilganVersiya)) {
        return Response.json({ ok: false, error: 'kutilgan_versiya kerak (optimistik qulf)' });
      }
      yuk = { p_id: id, p_kutilgan_versiya: kutilganVersiya };

    /* ══════════ KONTRAGENTLAR (B2B Reestr) ══════════
       ⚠️ STIR/INN validatsiyasi shu yerda ham (RPC ichida ham bor,
       ikki qatlamli himoya — frontend soxta 9 xonali son yuborishi
       mumkin bo'lsa ham, format xato bo'lsa RAD etiladi). */
    } else if (amal === 'kontragent_saqla') {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: 'kompaniya_id noto\'g\'ri' });
      }
      if (!String(so.nom || '').trim()) {
        return Response.json({ ok: false, error: 'nom bo\'sh bo\'lishi mumkin emas' });
      }
      const inn = so.inn ? String(so.inn).trim() : null;
      if (inn && !/^[0-9]{9}$/.test(inn)) {
        return Response.json({ ok: false, error: 'STIR (INN) 9 ta raqamdan iborat bo\'lishi shart' });
      }
      const MAVQE_RUXSAT = ['buyurtmachi', 'pudratchi', 'subpudratchi', 'loyihachi', 'taminotchi'];
      const mavqe = so.mavqe && MAVQE_RUXSAT.includes(String(so.mavqe)) ? String(so.mavqe) : null;
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_inn: inn,
        p_nom: String(so.nom).slice(0, 300),
        p_rahbar: so.rahbar ? String(so.rahbar).slice(0, 200) : null,
        p_manzil: so.manzil ? String(so.manzil).slice(0, 500) : null,
        p_mfo: so.mfo ? String(so.mfo).slice(0, 20) : null,
        p_hisob_raqam: so.hisob_raqam ? String(so.hisob_raqam).slice(0, 40) : null,
        p_qqs_tolovchi: so.qqs_tolovchi == null ? null : Boolean(so.qqs_tolovchi),
        p_mavqe: mavqe,
      };

    } else if (amal === 'kontragent_ochir') {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      yuk = { p_id: id };

    /* ══════════ KOMPANIYA (o'z tashkilot profili) ══════════
       ⚠️ 2026-08-28: bu blok bir marta yozilgan, keyingi merge'da
       yo'qolib qolgan edi — tiklandi (yuqoridagi izohga qarang). */
    } else if (amal === 'kompaniya_yangila') {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      if (so.kutilgan_versiya == null) {
        return Response.json({ ok: false, error: 'kutilgan_versiya majburiy' });
      }
      const MAVQE_RUXSAT3 = ['zakazchik', 'pudratchi', 'loyihachi'];
      const mavqe3 = so.mavqe && MAVQE_RUXSAT3.includes(String(so.mavqe)) ? String(so.mavqe) : null;
      yuk = {
        p_id: id, p_kutilgan_versiya: Number(so.kutilgan_versiya),
        p_toliq_nom: so.toliq_nom != null ? String(so.toliq_nom).slice(0, 300) : null,
        p_inn: so.inn != null ? String(so.inn).slice(0, 20) : null,
        p_manzil: so.manzil != null ? String(so.manzil).slice(0, 500) : null,
        p_rahbar: so.rahbar != null ? String(so.rahbar).slice(0, 200) : null,
        p_telefon: so.telefon != null ? String(so.telefon).slice(0, 40) : null,
        p_bank: so.bank != null ? String(so.bank).slice(0, 200) : null,
        p_hisob_raqam: so.hisob_raqam != null ? String(so.hisob_raqam).slice(0, 40) : null,
        p_mfo: so.mfo != null ? String(so.mfo).slice(0, 20) : null,
        p_mavqe: mavqe3,
      };

    /* ══════════ MATERIAL ALIASLARI (AI semantik qidiruv) ══════════ */
    } else if (amal === 'material_alias_yoz') {
      if (!String(so.alias_nom || '').trim() || !String(so.kanonik_nom_key || '').trim()) {
        return Response.json({ ok: false, error: 'alias_nom va kanonik_nom_key bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_alias_nom: String(so.alias_nom).slice(0, 300),
        p_kanonik_nom_key: String(so.kanonik_nom_key).slice(0, 300),
        p_kanonik_birlik_key: so.kanonik_birlik_key ? String(so.kanonik_birlik_key).slice(0, 50) : null,
        p_kompaniya_id: so.kompaniya_id == null ? null : Number(so.kompaniya_id),
      };

    } else if (amal === 'material_alias_ochir') {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      yuk = { p_id: id };

    /* ══════════ MINDMAP — CHIZIQ TORTIB BOG'LASH ══════════
       Foydalanuvchi: "bog'lanishlar chiziqlar bilan tortib
       birlashtirilishi kerak". Bog'lanish turi QAT'IY oq ro'yxatdan —
       RPC ichida ham qayta tekshiriladi (ikki qatlamli himoya). */
    } else if (amal === 'mindmap_bog' || amal === 'mindmap_bog_ochir') {
      const BOG_TURLARI = ['obyekt_loyiha', 'shartnoma_loyiha', 'shartnoma_obyekt',
                           'sklad_obyekt', 'texnika_obyekt', 'kadr_obyekt', 'qatnashchi'];
      const tur = String(so.tur || '');
      const manbaId = Number(so.manba_id);
      const maqsadId = Number(so.maqsad_id);
      if (!BOG_TURLARI.includes(tur)) {
        return Response.json({ ok: false, error: 'noma\'lum bog\'lanish turi: ' + tur });
      }
      if (!Number.isFinite(manbaId) || manbaId <= 0 || !Number.isFinite(maqsadId) || maqsadId <= 0) {
        return Response.json({ ok: false, error: 'manba_id yoki maqsad_id noto\'g\'ri' });
      }
      const ROLLAR = ['zakazchik', 'bosh_pudratchi', 'subpudratchi', 'loyihachi', 'taminotchi'];
      if (amal === 'mindmap_bog') {
        const rol = so.rol && ROLLAR.includes(String(so.rol)) ? String(so.rol) : null;
        if (tur === 'qatnashchi' && !rol) {
          return Response.json({ ok: false, error: 'qatnashchi bog\'lanishida rol majburiy' });
        }
        yuk = { p_tur: tur, p_manba_id: manbaId, p_maqsad_id: maqsadId, p_rol: rol };
      } else {
        yuk = { p_tur: tur, p_manba_id: manbaId, p_maqsad_id: maqsadId };
      }

    /* Tugun sudrab ko'chirilganda joylashuv saqlanadi — aks holda har
       ochilganda avtomatik qayta terilib, odam terib qo'ygan tartib
       YO'QOLARDI (foydalanuvchi: «yana yangidan qurayapdi»). */
    } else if (amal === 'mindmap_joylashuv_saqla') {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!Array.isArray(so.joylar) || !so.joylar.length) {
        return Response.json({ ok: false, error: "joylar bo'sh" });
      }
      const joylar = so.joylar.slice(0, 500).map((j: any) => ({
        tugun_id: String(j.tugun_id || '').slice(0, 60),
        x: Number(j.x), y: Number(j.y),
      })).filter((j: any) => j.tugun_id && Number.isFinite(j.x) && Number.isFinite(j.y));
      if (!joylar.length) {
        return Response.json({ ok: false, error: "yaroqli joylashuv yo'q" });
      }
      yuk = { p_kompaniya_id: kompaniyaId, p_joylar: joylar };

    /* ══════════ ФАКТ KIRITISH (bajarilgan ish) ══════════
       Foydalanuvchi: «ikkalasi ham bo'lishi kerak» — prorab kunlik ham,
       PTO jamlab ham. Ikkalasi AYNI RPC ga yozadi, farq faqat paket
       kattaligida; jamlash mantig'i o'zgarmaydi. */
    } else if (amal === 'fakt_yoz') {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
      }
      const sana = String(so.sana || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) {
        return Response.json({ ok: false, error: 'sana YYYY-MM-DD shaklida bo\'lishi kerak' });
      }
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: 'qatorlar bo\'sh' });
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_sana: sana,
        p_qatorlar: so.qatorlar,
        p_kim: sess.email || null,
        p_operation_id: so.operation_id || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_raqam: so.raqam ? String(so.raqam).slice(0, 50) : null,
      };

    /* Ko'zgu varaqdan: JAMI qiymat beriladi, FARQ hujjat qilib yoziladi.
       ⚠️ Manfiy farq (перерасчёт) ATAYLAB bloklanmaydi — loyiha qoidasi. */
    } else if (amal === 'fakt_belgila') {
      const qatorId = Number(so.qator_id);
      if (!Number.isFinite(qatorId) || qatorId <= 0) {
        return Response.json({ ok: false, error: 'qator_id noto\'g\'ri' });
      }
      if (so.yangi_jami == null || !Number.isFinite(Number(so.yangi_jami))) {
        return Response.json({ ok: false, error: 'yangi_jami son bo\'lishi kerak' });
      }
      yuk = {
        p_qator_id: qatorId,
        p_yangi_jami: Number(so.yangi_jami),
        p_sana: so.sana ? String(so.sana) : null,
        p_kim: sess.email || null,
      };

    /* ══════════ A'ZOLIK (Xodimlar va Rollar) ══════════
       ⚠️ Multi-tenant poydevorining ochiq bo'shlig'i edi: t2_azolik
       jadvali bor edi, lekin uni boshqaradigan RPC yo'q — faqat GAS
       login orqali BIRINCHI marta avtomatik yaratilardi. */
    } else if (amal === 'azolik_qosh') {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: 'kompaniya_id noto\'g\'ri' });
      }
      if (!String(so.login || '').trim()) {
        return Response.json({ ok: false, error: 'login bo\'sh bo\'lishi mumkin emas' });
      }
      const ROL_RUXSAT = ['superadmin', 'admin', 'boss', 'rahbar', 'bugalter', 'pto', 'prorab'];
      if (!ROL_RUXSAT.includes(String(so.rol))) {
        return Response.json({ ok: false, error: 'rol noto\'g\'ri: ' + ROL_RUXSAT.join('|') });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_login: String(so.login).trim().slice(0, 100),
        p_rol: String(so.rol),
        p_email: so.email ? String(so.email).slice(0, 200) : null,
        p_ism: so.ism ? String(so.ism).slice(0, 200) : null,
      };

    } else if (amal === 'azolik_rol_ozgartir') {
      const azolikId = Number(so.azolik_id);
      if (!Number.isFinite(azolikId) || azolikId <= 0) {
        return Response.json({ ok: false, error: 'azolik_id noto\'g\'ri' });
      }
      const ROL_RUXSAT = ['superadmin', 'admin', 'boss', 'rahbar', 'bugalter', 'pto', 'prorab'];
      if (!ROL_RUXSAT.includes(String(so.yangi_rol))) {
        return Response.json({ ok: false, error: 'yangi_rol noto\'g\'ri: ' + ROL_RUXSAT.join('|') });
      }
      yuk = { p_azolik_id: azolikId, p_yangi_rol: String(so.yangi_rol) };

    } else if (amal === 'azolik_ochir') {
      const azolikId = Number(so.azolik_id);
      if (!Number.isFinite(azolikId) || azolikId <= 0) {
        return Response.json({ ok: false, error: 'azolik_id noto\'g\'ri' });
      }
      yuk = { p_azolik_id: azolikId };

    /* ══════════ KORZINKA ══════════
       ⚠️ `p_jadval` FAQAT bazadagi RPC'ning o'zi ichida tekshiriladigan
       oq ro'yxatdan (t2_obyekt/t2_shaxsiy_smeta/t2_sklad_harakat) —
       shu yerda ham qo'shimcha tekshiramiz, ixtiyoriy jadval nomi
       yozishga yo'l qo'ymaslik uchun ikki qatlamli himoya. */
    } else if (amal === 'korzinkaga_tashlash' || amal === 'korzinkadan_tiklash' || amal === 'butunlay_ochirish') {
      const jadval = String(so.jadval || so.rpcArgs?.p_jadval || '');
      const JADVAL_RUXSAT = ['t2_obyekt', 't2_shaxsiy_smeta', 't2_sklad_harakat'];
      if (!JADVAL_RUXSAT.includes(jadval)) {
        return Response.json({ ok: false, error: 'Bu jadval korzinka orqali boshqarilmaydi: ' + jadval });
      }
      const id = Number(so.id || so.rpcArgs?.p_id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      yuk = { p_jadval: jadval, p_id: id, p_kim: sess.email || '' };

    /* ══════════ OBYEKT TAHRIRLASH ══════════
       ⚠️ 2026-08-28: `p_lat`/`p_lng` qo'shildi (foydalanuvchi
       ko'rsatmasi — "har obyektga lokatsiyasini kartadan belgilash").
       RPC ularni COALESCE bilan qo'llaydi — yuborilmasa (undefined)
       eskisi saqlanadi, xato bo'lmaydi. */
    } else if (amal === 'obyekt_yangila') {
      const id = Number(so.id || so.rpcArgs?.p_id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      const lat = so.lat == null ? null : Number(so.lat);
      const lng = so.lng == null ? null : Number(so.lng);
      if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        return Response.json({ ok: false, error: 'lat -90..90 oralig\'ida bo\'lishi kerak' });
      }
      if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        return Response.json({ ok: false, error: 'lng -180..180 oralig\'ida bo\'lishi kerak' });
      }
      yuk = {
        p_id: id,
        p_nomi: String(so.nomi || so.rpcArgs?.p_nomi || ''),
        p_tur: so.tur || so.rpcArgs?.p_tur || null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_lat: lat, p_lng: lng,
      };

    /* ══════════ B2B BIRJA ══════════
       ⚠️ IDEMPOTENTLIK MAJBURIY — RFQ va taklif narxga bog'liq. */
    } else if (amal === 'birja_rfq_yarat') {
      const hajm = Number(so.hajm);
      if (!String(so.nom || '').trim() || !String(so.birlik || '').trim()) {
        return Response.json({ ok: false, error: 'nom va birlik bo\'sh bo\'lishi mumkin emas' });
      }
      if (!Number.isFinite(hajm) || hajm <= 0) {
        return Response.json({ ok: false, error: 'hajm musbat son bo\'lishi kerak' });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi RFQ yaratadi' });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_nom: String(so.nom).slice(0, 300),
        p_birlik: String(so.birlik).slice(0, 50),
        p_hajm: hajm,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_holat: 'ochiq',
        p_operation_id: so.operation_id,
        p_kim: sess.email || '',
      };

    } else if (amal === 'birja_taklif_ber') {
      const rfqId = Number(so.rfq_id);
      const narx = Number(so.narx);
      if (!Number.isFinite(rfqId) || rfqId <= 0) {
        return Response.json({ ok: false, error: 'rfq_id noto\'g\'ri' });
      }
      if (!Number.isFinite(narx) || narx <= 0) {
        return Response.json({ ok: false, error: 'narx musbat son bo\'lishi kerak' });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(String(so.operation_id || ''))) {
        return Response.json({ ok: false,
          error: 'operation_id (UUID) majburiy — usiz takroriy so\'rov ikkinchi taklif yaratadi' });
      }
      yuk = {
        p_rfq_id: rfqId,
        p_kompaniya_id: Number(so.kompaniya_id),
        p_narx: narx,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_kim: sess.email || '',
      };

    /* ══════════ KALENDAR GRAFIK (Gantt) ══════════
       ⚠️ 2026-08-28: avval `p_payload: JSON.stringify(so)` — mijoz
       yuborgan HAR QANDAY JSON'ni RPC'ga xom uzatardi (bu loyihaning
       "maydon oq ro'yxati" konvensiyasiga zid, boshqa hech bir amalda
       bunday umumiy blob yo'q). RPC'ning o'zi ham hali mavjud emas edi
       (404 xatosi ildizi). Ikkalasi ham tuzatildi: RPC qurildi, maydon
       oq ro'yxati bilan validatsiya qilinadi. */
    } else if (amal === 'grafik_sozlama_saqla') {
      const kompaniyaId = Number(so.kompaniya_id);
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0 || !Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: 'kompaniya_id yoki obyekt_id noto\'g\'ri' });
      }
      if (!String(so.nom || '').trim()) {
        return Response.json({ ok: false, error: 'nom bo\'sh bo\'lishi mumkin emas' });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId, p_obyekt_id: obyektId,
        p_nom: String(so.nom).slice(0, 300),
        p_boshlanish_sana: so.boshlanish_sana || null,
        p_tugash_sana: so.tugash_sana || null,
        p_id: so.id == null ? null : Number(so.id),
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
      };

    } else if (amal === 'grafik_yangilash') {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: 'id noto\'g\'ri' });
      }
      if (so.kutilgan_versiya == null) {
        return Response.json({ ok: false, error: 'kutilgan_versiya majburiy' });
      }
      const HOLAT_RUXSAT = ['reja', 'jarayonda', 'bajarildi'];
      const holat = so.holat && HOLAT_RUXSAT.includes(String(so.holat)) ? String(so.holat) : null;
      yuk = {
        p_id: id, p_kutilgan_versiya: Number(so.kutilgan_versiya),
        p_holat: holat,
        p_foiz: so.foiz == null ? null : Number(so.foiz),
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

    } else if (amal === 'kirish_amal' || amal === 'taklif_yubor' || amal === 'taklif_qabul') {
      yuk = {
        p_kompaniya_id: so.kompaniya_id ? Number(so.kompaniya_id) : 0,
        p_foydalanuvchi: String(so.foydalanuvchi || ''),
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };

    /* ══════════ HALI KOD YOZILMAGAN AMALLAR ══════════
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

