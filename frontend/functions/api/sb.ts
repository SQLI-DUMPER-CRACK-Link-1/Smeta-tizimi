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
  /* ── TIZIM_01 ko’zgusi (eski) ── */
  'obyektlar', 'holat', 'oylik_f2', 'narxlar', 'material_kerak',
  'shartnoma', 'v_sklad_nomlar', 'tolovlar', 'prixod', 'rashod', 'topilmaganlar',
  'akt', 'akt_ish', 'tarix', 'anomaliya',
  /* ── TIZIM_02 (t2_) — BU YERDA BAZA HAQIQAT MANBAI ──
     Tizim_02 sahifalari FAQAT shu jadvallarni o’qiydi. Eski ko’zgu
     jadvallariga (yuqoridagilar) ular MUROJAAT QILMAYDI — aks holda
     ikki tizim ma’lumoti aralashib, qaysi raqam qayerdan kelgani
     bilinmay qoladi. */
  't2_kompaniya', 't2_obyekt', 't2_obyekt_jami', 't2_daraxt', 't2_qator',
  't2_narx', 't2_manba', 't2_xom', 't2_lrv',
  't2_kozgu', 't2_ozgarish', 't2_kopruk_navbat', 't2_sozlama',
  /* F2 / FAKT (E bosqichi) */
  't2_akt', 't2_akt_qator', 't2_akt_reestr', 't2_qator_holat', 't2_faktura', 't2_ish_turi', 't2_shaxsiy_smeta',
  'v_erp_kadrlar_dashboard', 'v_erp_texnika_dashboard', 'v_erp_taminot_dashboard', 'v_erp_sifat_dashboard', 't2_grafik_holat', 'v_boss_init', 'v_boss_data',
  't2_birja_rfq', 't2_birja_taklif', 't2_sklad_qoldiq', 't2_sklad_harakat',
  /* NARXLAR MARKAZI — hammasi FAQAT O'QISH uchun ko'rinishlar.
     `t2_narx_qol_xavf` — odamning qo'lda tuzatgan narxi himoyasiz
     qolgan qatorlar; u BO'SH bo'lishi kerak. */
  't2_narx_markaz', 't2_topilmaganlar', 't2_narx_sana', 't2_narx_qol_xavf',
  /* F2/FAKT TAHLIL - Sheets skanlash o'rniga bazadan aggregatsiya */
  't2_f2_kat_oy', 't2_f2_tafsilot',
  /* VIBORKA — har obyektga xos material tanlash/xarid nazorati
     (2026-08-25: umumiy Sheets hujjatidan Tizim_02 ga ko'chirildi) */
  't2_viborka', 't2_viborka_qabul', 't2_viborka_holat',
  /* ШАРТНОМА + НАКРУТКА */
  't2_shartnoma', 't2_shartnoma_bog', 't2_nakrutka', 't2_qoshimcha_ish',
  't2_obyekt_nakrutka',
  /* БУХГАЛТЕРИЯ — to'lov/xarajat + hisoblangan ko'rishlar (2026-08-25) */
  't2_tolov', 't2_xarajat', 't2_bux_dashboard', 't2_debitor_aging', 't2_bux_umumiy',
  /* АОСР — yashirin ishlar akti (2026-08-27, hujjat domeni) */
  't2_aosr_reestr', 't2_aosr_coverage',
  /* KORZINKA — bekor qilingan obyekt/smeta/sklad harakat (3 jadval
     birlashgan VIEW — `holat='bekor'`, is_deleted EMAS). */
  't2_korzinka',
  /* AUDIT & LOGLAR (2026-08-27, Antigravity SQL + Claude qo'llagan) */
  't2_audit_reestr',
  /* OBYEKT HUJJATLARI — har obyektga bog'langan loyiha/tasdiqlangan fayllar */
  't2_obyekt_hujjat_royxat',
  /* MUSTAQIL RESURSLAR (M:N) — sklad/kadr/texnika bitta obyektga emas,
     junction jadval orqali bir nechta obyektga bog'lanadi (2026-08-27,
     Antigravity SQL + Claude qattiqlashtirgan). */
  't2_sklad_royxat', 't2_kadr_royxat', 't2_texnika_royxat',
  /* LOYIHA (Project) — Kompaniya→Loyiha→Obyekt oraliq bosqichi
     (2026-08-27, MASTER_REJA_ENTERPRISE_OS.md FAZA-oldi ustuvor
     bo'shliq: "32 gektar, 40 obyekt, bitta park" guruhlash). */
  't2_loyiha_royxat',
  /* Polimorfik tashkilot bog'lanishi (MASTER_REJA band 1, 2026-08-28):
     har loyiha uchun qatnashchilar (kompaniya YOKI kontragent + rol)
     bitta jsonb_agg'da — zero re-fetch. */
  't2_loyiha_qatnashchilar_royxat',
  /* KONTRAGENTLAR (B2B Reestr) — biznes hamkorlar adress daftari,
     t2_kompaniya (tizim tenant'lari) EMAS (2026-08-27). */
  't2_kontragent_royxat',
  /* A'ZOLIK (Xodimlar va Rollar) — kompaniya a'zolari ro'yxati
     (foydalanuvchi + rol), 2026-08-28. */
  't2_azolik_royxat',
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
    const secret = ctx.env.SESSIYA_KALIT;
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
      soro?: string; obyekt_id?: number; kompaniya_id?: number;
    }>();

    /* ══════════ O'QISH-RPC (AI konteksti) ══════════════════════════════
     * ⚠️ ATAYLAB O'TA TOR: bu yerda faqat SANAB O'TILGAN, FAQAT O'QIYDIGAN
     * funksiyalar. Ixtiyoriy RPC nomi qabul QILINMAYDI — aks holda bu
     * o'qish eshigi jimgina yozish eshigiga aylanardi.
     *
     * Nega kerak: AI ga bitta obyekt bo'yicha to'liq kontekst kerak
     * (jami, kategoriya, ogohlantirishlar). Buni jadval-jadval o'qib
     * frontendda yig'ish — aynan Tizim_01 dagi sekin yo'l. Postgres
     * hammasini bitta chaqiruvda beradi.
     *
     * Rol: `boss`/`rahbar` ham CHAQIRA OLADI — bu faqat o'qish. */
    if (so.soro) {
      const OQISH_RPC: Record<string, 'obyekt' | 'kompaniya'> = {
        ai_kontekst: 'obyekt',
        ai_umumiy: 'kompaniya',
      };
      const tur = OQISH_RPC[so.soro];
      if (!tur) {
        return Response.json({ ok: false, error: 'So\'rov ochiq emas: ' + so.soro });
      }

      /* ⚠️ GET bilan chaqiriladi, POST bilan EMAS — va bu ATAYLAB.
       * `/api/sb` ning bosh kafolati: u HECH QACHON yoza olmaydi. Buni
       * qo'riqchi test ham tekshiradi («faqat GET so'rov»). POST ga
       * o'tsak kafolat zaiflashardi: keyinchalik kimdir ro'yxatga
       * yozuvchi funksiyani qo'shsa, hech narsa to'smasdi.
       *
       * PostgREST `STABLE`/`IMMUTABLE` funksiyalarni GET bilan chaqirishga
       * ruxsat beradi, `VOLATILE` (yozuvchi) larni esa RAD ETADI. Ya'ni
       * cheklovni endi POSTGRESNING O'ZI majburlaydi — yozuvchi funksiya
       * bu yerga qo'shilsa, u GET da umuman ishlamaydi. */
      const q = new URLSearchParams();
      if (tur === 'obyekt') {
        const id = Number(so.obyekt_id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json({ ok: false, error: 'obyekt_id noto\'g\'ri' });
        }
        q.set('p_obyekt_id', String(id));
      } else {
        const kid = so.kompaniya_id == null ? null : Number(so.kompaniya_id);
        /* Kompaniya berilsa — sessiya a'zoligida bo'lishi shart
           (sb-yoz.ts dagi bilan bir xil qoida). */
        if (kid != null && Array.isArray(sess.kompaniyalar) &&
            !sess.kompaniyalar.some((a) => a.kompaniya_id === kid)) {
          return Response.json(
            { ok: false, error: 'Bu kompaniyaga ruxsat yo\'q' }, { status: 403 });
        }
        if (kid != null) q.set('p_kompaniya_id', String(kid));
      }

      const rr = await fetch(
        ctx.env.SUPABASE_URL.replace(/\/+$/, '') +
          '/rest/v1/rpc/t2_' + so.soro + '?' + q.toString(),
        {
          headers: {
            apikey: ctx.env.SUPABASE_KEY,
            Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
          },
        });
      if (!rr.ok) {
        return Response.json(
          { ok: false, error: 'So\'rov bajarilmadi (' + rr.status + ')' });
      }
      const natija = await rr.json();
      return Response.json({ ok: true, natija, ms: Date.now() - t0 });
    }

    const jadval = String(so.jadval || '');
    if (!RUXSAT_JADVALLAR.has(jadval)) {
      return Response.json({ ok: false, error: 'Jadval ochiq emas: ' + jadval });
    }
    if (!filtrXavfsizmi(so.filtr || '')) {
      return Response.json({ ok: false, error: 'Filtr shakli qabul qilinmadi' });
    }

    /* ⚡ 2026-08-27 (Claude, foydalanuvchi tasdig'i — multi-tenant
     * poydevorining O'QISH TOMONI): `sb-yoz.ts` da yozish uchun
     * kompaniya a'zoligi tekshiruvi qo'shilgan edi — o'qishda ham xuddi
     * shu tekshiruv kerak, aks holda kimdir yozolmasa ham BOSHQA
     * kompaniyaning ma'lumotini "faqat o'qish" bilan ko'rishi mumkin.
     *
     * ⚠️ QISMAN, ATAYLAB: `filtr` — erkin PostgREST satri
     * (`kompaniya_id=eq.5&obyekt_id=eq.10`), har jadval to'g'ridan-
     * to'g'ri `kompaniya_id` bilan filtrlanmaydi (masalan ba'zilari
     * `obyekt_id` orqali bog'lanadi). Shuning uchun: FAQAT `filtr`da
     * ANIQ `kompaniya_id=eq.N` ko'rinishida uchrasa tekshiramiz;
     * boshqacha filtrlangan so'rovlar HOZIRCHA o'tkazib yuboriladi
     * (keyingi qadam — ularni ham jadval-jadval ko'rib chiqish).
     * `sess.kompaniyalar === undefined` bo'lsa (eski sessiya) —
     * tekshiruv o'tkazib yuboriladi (12 soat ko'prik, sb-yoz.ts dagi
     * bilan bir xil qoida). */
    if (Array.isArray(sess.kompaniyalar)) {
      const mos = (so.filtr || '').match(/(?:^|&)kompaniya_id=eq\.(-?\d+)/);
      if (mos) {
        const soraganKompaniya = Number(mos[1]);
        /* ⚡ 2026-08-27: `kompaniyalar` endi {kompaniya_id, rol}
         * juftliklari (avval faqat ID massivi edi) — a'zolikni
         * `.some(...)` bilan qidiramiz. */
        if (!sess.kompaniyalar.some((a) => a.kompaniya_id === soraganKompaniya)) {
          return Response.json({ ok: false,
            error: 'Bu kompaniyaga a\'zo emassiz (kompaniya_id: ' + soraganKompaniya + ')' },
            { status: 403 });
        }
      }
    }

    /* ══════════════════════════════════════════════════════════════
     * ⚠️ 2026-08-17 — SAHIFALAB O'QISH (1000 QATOR CHEGARASI)
     *
     * Avval bitta so'rov yuborilardi va `limit=100000` deb yozilgandi.
     * LEKIN Supabase'ning REST qatlamida SERVER TOMONDA «Max rows»
     * chegarasi bor (standart 1000) — u so'ralgan limitdan qat'i nazar
     * javobni KESIB TASHLAYDI.
     *
     * Natijasi xatarli edi: 2765 qatorlik obyekt uchun 1000 qator
     * qaytardi va summa 50% kam chiqdi. Ya'ni javob TO'LIQ EMAS, lekin
     * xato ham chiqmaydi — jim yarim ma'lumot. Tezlik sinovi buni
     * «ko'zgu eskirgan» deb ko'rsatdi va foydalanuvchi 1000 raqamini
     * o'zi payqadi.
     *
     * ENDI: sahifalab o'qiymiz (offset bilan), to'liq yig'ilguncha.
     * Bu chegara qanday sozlanganidan QAT'I NAZAR ishlaydi — serverdagi
     * sozlamaga tayanmaymiz.
     *
     * `Content-Range` dan HAQIQIY jamini olamiz va agar biror sababga
     * ko'ra hammasini ololmasak — `toliq:false` deb OCHIQ aytamiz.
     * ══════════════════════════════════════════════════════════════ */
    const kerak = Math.min(Math.max(1, so.limit || 50000), 200000);

    /* ⚠️⚠️ 2026-08-17 (3-tuzatish) — SAHIFA HAJMI ENDI MOSLASHUVCHAN.
     *
     * O'lchov shuni ko'rsatdi: vaqt ma'lumot HAJMIGA emas, BORIB-KELISH
     * soniga ketadi. 1673 qator ham, 4937 qator ham bitta so'rovda
     * ~1000 ms. Ya'ni 5 so'rov = ~5 barobar kutish.
     *
     * Avval `SAHIFA = 1000` qattiq yozilgandi — Supabase'ning standart
     * «Max rows» sozlamasi shuncha. Lekin u sozlama O'ZGARTIRILISHI
     * mumkin. Agar u 10 000 ga ko'tarilsa, bizning kod baribir 1000
     * talab so'rayverardi va tezlik yaxshilanmasdi.
     *
     * ENDI: birinchi so'rovda KATTA limit so'raymiz. Server nechta
     * qaytarsa — haqiqiy chegara o'sha. Keyingi sahifalar ham o'sha
     * hajmda so'raladi. Ya'ni foydalanuvchi Supabase'da «Max rows» ni
     * ko'tarsa, KOD O'ZGARTIRMASDAN tezlashadi; ko'tarmasa avvalgidek
     * ishlaydi. Sozlamaga bog'liqlik yo'q — moslashuv bor. */
    const SORALADI = Math.min(kerak, 10000);
    let SAHIFA = SORALADI;        // birinchi javobdan keyin aniqlanadi
    /* ⚠️ Cloudflare Worker BITTA so'rov ichida chekli sonda tashqi so'rov
       qila oladi (bepul rejada 50 ta). Shuning uchun 20 bilan cheklaymiz —
       ya'ni bir marta 20 000 qatorgacha. Undan kattasi kerak bo'lsa
       `toliq:false` qaytadi va chaqiruvchi buni KO'RADI (jim kesilmaydi).
       Eng katta obyekt hozir ~5000 qator, ya'ni zaxira 4 barobar. */
    const MAX_SORO = 20;

    const baza = ctx.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + jadval;
    const boshHeaders = {
      apikey: ctx.env.SUPABASE_KEY,
      Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
      Prefer: 'count=exact',
    };

    /** Bitta sahifani o'qiydi. Xato bo'lsa `xato` maydonida qaytadi. */
    async function sahifaOl(offset: number, limit: number) {
      const p = new URLSearchParams();
      p.set('select', so.ustunlar || '*');
      if (so.tartib) p.set('order', so.tartib);
      p.set('limit', String(limit));
      p.set('offset', String(offset));
      const url = baza + '?' + p.toString() + (so.filtr ? '&' + so.filtr : '');
      const r = await fetch(url, { headers: boshHeaders });
      const matn = await r.text();
      if (!r.ok) return { xato: 'Supabase ' + r.status + ': ' + matn.slice(0, 300) };
      let bolak: unknown[];
      try { bolak = JSON.parse(matn); }
      catch { return { xato: 'Supabase JSON qaytarmadi: ' + matn.slice(0, 200) }; }
      const cr = r.headers.get('content-range') || '';
      const jm = cr.split('/')[1];
      return { bolak: Array.isArray(bolak) ? bolak : [],
               jami: (jm && jm !== '*') ? (Number(jm) || null) : null };
    }

    /* ⚠️ 2026-08-17 (2-tuzatish) — SAHIFALAR PARALLEL O'QILADI.
     *
     * Avval sahifalar BIRIN-KETIN so'ralardi. 4937 qatorlik obyektda bu
     * 5 marta borib-kelish demakdi va Supabase tomoni 7.8 soniya chiqdi.
     * Foydalanuvchi haqli savol berdi: «bu aldamayaptimi?».
     *
     * Aldov emas edi — o'lchov halol (Sheets birinchi, ketma-ket, bir xil
     * shart) — LEKIN raqam Postgres tezligini emas, MENING KODIMNING
     * sekinligini ko'rsatardi. Bu ham yomon: noto'g'ri xulosa chiqarish
     * mumkin («Supabase kutganchalik tez emas ekan»).
     *
     * ENDI: birinchi sahifadan `Content-Range` orqali HAQIQIY jamini
     * bilamiz, keyin qolgan sahifalarni BARAVARIGA so'raymiz. Ya'ni
     * kutish vaqti = eng sekin bitta so'rov, yig'indi emas. */
    let qatorlar: unknown[] = [];
    let jamiServerda: number | null = null;
    let soro = 0;

    /* Bosqichma-bosqich vaqt — sekinlik QAYERDA ekanini bilish uchun.
       Taxmin qilmaymiz: birinchi so'rov (aloqa o'rnatish + tarmoq yo'li)
       va qolgan sahifalar (parallel) alohida o'lchanadi. */
    const tBir = Date.now();
    const birinchi = await sahifaOl(0, SORALADI);
    const msBirinchi = Date.now() - tBir;
    let msQolgan = 0;
    soro++;
    if ('xato' in birinchi && birinchi.xato) {
      return Response.json({ ok: false, error: birinchi.xato });
    }
    qatorlar = birinchi.bolak || [];
    jamiServerda = birinchi.jami ?? null;

    /* HAQIQIY sahifa hajmi — serverning o'zi nechta berganidan bilinadi.
       Kam bergan bo'lsa: yo hammasi shu (tugadi), yo server chegarasi shu. */
    if (qatorlar.length > 0 && qatorlar.length < SORALADI) SAHIFA = qatorlar.length;

    const olinishiKerak = jamiServerda != null ? Math.min(jamiServerda, kerak) : kerak;

    if (qatorlar.length >= SAHIFA && qatorlar.length < olinishiKerak) {
      /* Qolgan sahifalar ro'yxati — hammasi BIR VAQTDA */
      const vazifalar: Promise<{ bolak?: unknown[]; jami?: number | null; xato?: string }>[] = [];
      for (let off = qatorlar.length; off < olinishiKerak && vazifalar.length < MAX_SORO - 1;
           off += SAHIFA) {
        vazifalar.push(sahifaOl(off, Math.min(SAHIFA, olinishiKerak - off)));
      }
      soro += vazifalar.length;

      const tQol = Date.now();
      const natijalar = await Promise.all(vazifalar);
      msQolgan = Date.now() - tQol;
      for (const nat of natijalar) {
        if (nat.xato) return Response.json({ ok: false, error: nat.xato });
        if (nat.bolak?.length) qatorlar = qatorlar.concat(nat.bolak);
      }
    }

    /* HALOL BAYROQ: hammasini oldikmi? Ko'zgu to'liq bo'lmasa
       chaqiruvchi buni bilishi SHART — yarim ma'lumot ustida
       hisob-kitob qilinmasin. */
    const toliq = jamiServerda === null
      ? soro < MAX_SORO
      : qatorlar.length >= jamiServerda;

    return Response.json({
      ok: true,
      qatorlar,
      soni: qatorlar.length,
      jamiServerda,
      toliq,
      soro,
      /* Vaqt taqsimoti — optimallashtirishni taxmin bilan emas, o'lchov
         bilan qilish uchun. msBirinchi katta bo'lsa muammo TARMOQ
         MASOFASIDA (Supabase regioni), msQolgan katta bo'lsa — HAJMDA. */
      msBirinchi,
      msQolgan,
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
