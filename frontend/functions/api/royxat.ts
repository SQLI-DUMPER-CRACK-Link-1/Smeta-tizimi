/**
 * royxat.ts — RO'YXATDAN O'TISH SO'ROVI (login'dan OLDIN chaqiriladi)
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN ALOHIDA ESHIK: `/api/sb-yoz` sessiyani TALAB qiladi, lekin
 * ro'yxatdan o'tayotgan odamda hali sessiya yo'q. Shuning uchun bu
 * yagona ochiq yozish nuqtasi — va aynan shu sababdan U JUDA TOR:
 *   • bitta RPC (`t2_royxat_sorov_yoz`), boshqasi yo'q
 *   • maydonlar qat'iy, uzunlik cheklangan
 *   • soatiga 5 tadan ko'p so'rov qabul qilinmaydi (RPC ichida)
 *   • javob QISQA — tizim haqida ma'lumot sizdirmaydi
 *
 * ⚠️ 2026-08-28 gacha bu umuman yo'q edi: `KirishSahifa.tsx` dagi
 * `handleRegister` `setTimeout` bilan «So'rovingiz qabul qilindi»
 * deb YOLG'ON aytardi va hech narsa saqlamasdi. Odam kutardi, operator
 * esa hech qachon xabar olmasdi.
 */

type Env = {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let so: {
    kompaniya?: string; ism?: string; telefon?: string;
    inn?: string; email?: string; izoh?: string;
  } = {};

  try {
    so = await ctx.request.json();
  } catch {
    return Response.json({ ok: false, xabar: 'Noto\'g\'ri so\'rov formati' }, { status: 400 });
  }

  const kompaniya = String(so.kompaniya || '').trim().slice(0, 300);
  const ism = String(so.ism || '').trim().slice(0, 200);
  const telefon = String(so.telefon || '').trim().slice(0, 40);
  const inn = so.inn ? String(so.inn).trim().slice(0, 20) : null;
  const email = so.email ? String(so.email).trim().slice(0, 200) : null;
  const izoh = so.izoh ? String(so.izoh).trim().slice(0, 1000) : null;

  if (!kompaniya || !ism || !telefon) {
    return Response.json(
      { ok: false, xabar: 'Kompaniya nomi, ism va telefon majburiy' }, { status: 400 });
  }
  if (inn && !/^\d{9}$/.test(inn)) {
    return Response.json(
      { ok: false, xabar: 'STIR 9 ta raqamdan iborat bo\'lishi kerak' }, { status: 400 });
  }

  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
    /* Sozlanmagan bo'lsa HALOL aytamiz — «qabul qilindi» deb yolg'on
       aytish aynan bugun olib tashlangan xatti-harakat. */
    return Response.json(
      { ok: false, xabar: 'Ro\'yxatdan o\'tish xizmati hozircha ulanmagan' }, { status: 503 });
  }

  /* IP ni TO'LIQ saqlamaymiz — faqat suiiste'molni sanash uchun belgi.
     To'liq IP shaxsiy ma'lumot va bu jadvalda kerak emas. */
  const ip = ctx.request.headers.get('CF-Connecting-IP') || '';
  let ipBelgi: string | null = null;
  if (ip) {
    const bayt = new TextEncoder().encode(ip + '|t2royxat');
    const xesh = await crypto.subtle.digest('SHA-256', bayt);
    ipBelgi = [...new Uint8Array(xesh)].slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  try {
    const r = await fetch(
      ctx.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/t2_royxat_sorov_yoz',
      {
        method: 'POST',
        headers: {
          apikey: ctx.env.SUPABASE_KEY,
          Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_kompaniya: kompaniya, p_ism: ism, p_telefon: telefon,
          p_inn: inn, p_email: email, p_izoh: izoh, p_ip_belgi: ipBelgi,
        }),
      });

    if (!r.ok) {
      console.error('t2_royxat_sorov_yoz HTTP', r.status);
      return Response.json(
        { ok: false, xabar: 'So\'rovni saqlab bo\'lmadi, keyinroq urinib ko\'ring' },
        { status: 502 });
    }

    const natija = await r.json<{ ok: boolean; xabar?: string; id?: number }>();
    /* RPC o'zi rad etgan bo'lsa (masalan chastota chegarasi) — sababini
       ko'rsatamiz, lekin ichki tafsilotsiz. */
    return Response.json(natija, { status: natija.ok ? 200 : 429 });

  } catch (err) {
    console.error('royxat.ts:', err);
    return Response.json(
      { ok: false, xabar: 'Tarmoq xatosi, keyinroq urinib ko\'ring' }, { status: 502 });
  }
};
