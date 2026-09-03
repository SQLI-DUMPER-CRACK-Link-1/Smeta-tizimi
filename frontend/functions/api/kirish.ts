import { imzola, type Rol } from '../_shared/auth';
import { supabaseBaseUrl } from '../_shared/supabase-url';

type Env = {
  GAS_URL: string; GAS_TOKEN: string;
  SUPABASE_URL?: string; SUPABASE_KEY?: string;
  SESSIYA_KALIT: string;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let req: { login?: string; parol?: string; isBoss?: boolean; isSuperadmin?: boolean } = {};
  try {
    req = await ctx.request.json();
  } catch (err) {
    return Response.json({ ok: false, xato: 'Noto\'g\'ri so\'rov formati' }, { status: 400 });
  }
  
  let rol: Rol | null = null;

  /* ⚠️ 2026-08-28 XAVFSIZLIK TUZATISHI (Claude, login auditi).
   *
   * AVVAL BU YERDA TO'LIQ AUTENTIFIKATSIYA CHETLAB O'TILARDI:
   *     if (req.isBoss)        { rol = 'boss'; }
   *     else if (req.isSuperadmin) { rol = 'superadmin'; }
   * Ya'ni brauzerdan `{"isSuperadmin": true}` yuborgan HAR QANDAY odam —
   * internetdagi istalgan kishi — PAROLSIZ superadmin sessiyasini olardi.
   * Sayt jonli (smeta-tizimi.pages.dev), demak bu nazariy emas, HAQIQIY
   * ochiq eshik edi.
   *
   * ENDI: `isBoss`/`isSuperadmin` faqat LOGIN NOMINI oldindan to'ldiradi
   * (qulaylik uchun), lekin PAROL baribir talab qilinadi va u avvalgidek
   * GAS orqali tekshiriladi. Ya'ni tugmalar yo'qolmaydi — ular endi
   * parol so'raydi.
   *
   * ⚠️ Rol MIJOZDAN olinmaydi. GAS nima qaytarsa — o'sha. Mijoz
   * `isSuperadmin` yuborib, GAS 'prorab' desa — prorab bo'ladi. */
  let login = req.login || '';
  if (!login && req.isBoss) login = 'boss';
  if (!login && req.isSuperadmin) login = 'Anvar';

  const parol = req.parol || '';
  if (!login || !parol) {
    return Response.json({ ok: false, xato: 'Логин ва паролни киритинг' }, { status: 400 });
  }

  try {
    const r = await fetch(ctx.env.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        __api: 1,
        token: ctx.env.GAS_TOKEN,
        fn: 'apiKirishTekshir',
        args: [login, parol]
      }),
    });

    const data = await r.json<{ ok: boolean; data: string | null }>();
    if (data.ok && data.data) {
      rol = data.data as Rol;
    }
  } catch (err) {
    console.error('GAS ga bog\'lanishda xato:', err);
  }

  if (!rol) {
    // Brute-force sekinlashtirish
    await new Promise(r => setTimeout(r, 800));
    return Response.json({ ok: false, xato: 'Логин ёки парол нотўғри' }, { status: 401 });
  }

  /* ⚡ 2026-09-02 (T2-COMPANY-CONTEXT-P0-FIX-001) — KANONIK LOGIN.
   *
   * AVVAL "BEST-EFFORT" edi: Supabase o'chib qolsa ham kirish davom
   * etardi, faqat `foydalanuvchi_id` sessiyada bo'lmay qolardi. Bu
   * SPLIT-BRAIN auth yaratardi: login "muvaffaqiyatli", lekin butun
   * kanonik ilova (`/api/company?me=1` -> `t2_men_v1`, KompaniyaProvider,
   * barcha /admin/* sahifalar) `foydalanuvchi_id` majburiy talab qiladi
   * -> hech narsa ishlamaydi.
   *
   * ENDI: kanonik login = GAS parol tasdig'i VA kanonik actor
   * resolution — IKKALASI muvaffaqiyatli bo'lmaguncha sessiya
   * BERILMAYDI. `t2_kirish_royxatga_ol` faqat upsert qiladi (login
   * bo'yicha), tabiatan barqaror; nosozlik = tarmoq/config, retry
   * bilan yopiladi. */
  let foydalanuvchiId: number | undefined;
  let kompaniyalar: { kompaniya_id: number; rol: string }[] | undefined;

  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
    return Response.json({ ok: false, code: 'CONFIG',
      xato: 'Server sozlanmagan: Supabase (SUPABASE_URL / SUPABASE_KEY). Administrator bilan bog‘laning.' },
      { status: 503 });
  }

  async function actorResolve(): Promise<{ id?: number; az?: { kompaniya_id: number; rol: string }[]; xato?: string }> {
    try {
      const r = await fetch(
        supabaseBaseUrl(ctx.env.SUPABASE_URL!) + '/rest/v1/rpc/t2_kirish_royxatga_ol',
        {
          method: 'POST',
          headers: {
            apikey: ctx.env.SUPABASE_KEY!,
            Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_login: login, p_rol: rol }),
        });
      const text = await r.text();
      if (!r.ok) {
        console.error('[kirish] t2_kirish_royxatga_ol HTTP', r.status, text.slice(0, 300));
        return { xato: 'HTTP_' + r.status };
      }
      let natija: any = null;
      try { natija = JSON.parse(text); } catch { return { xato: 'INVALID_JSON' }; }
      if (!natija || natija.ok !== true || natija.foydalanuvchi_id == null) {
        console.error('[kirish] t2_kirish_royxatga_ol javob:', text.slice(0, 300));
        return { xato: 'NO_ACTOR' };
      }
      return { id: natija.foydalanuvchi_id, az: natija.azoliklar || [] };
    } catch (err) {
      console.error('[kirish] t2_kirish_royxatga_ol transport:', err);
      return { xato: 'TRANSPORT' };
    }
  }

  let res = await actorResolve();
  if (res.xato) { await new Promise((r) => setTimeout(r, 400)); res = await actorResolve(); }
  if (res.xato || res.id == null) {
    return Response.json({ ok: false, code: 'ACTOR_RESOLVE_FAILED',
      xato: 'Kirish tasdiqlandi, lekin kanonik foydalanuvchi yozuvini olishning iloji bo‘lmadi. '
        + 'Birozdan so‘ng qayta urinib ko‘ring; takrorlansa administratorga ayting.' },
      { status: 502 });
  }
  foydalanuvchiId = res.id;
  kompaniyalar = res.az;

  const secret = ctx.env.SESSIYA_KALIT;
  let token: string;
  try {
    // SECURITY P0: imzola() fails closed if SESSIYA_KALIT is unset/short.
    // Never mint a cookie signed with a guessable key on a public repo.
    token = await imzola({ rol, email: login, foydalanuvchi_id: foydalanuvchiId, kompaniyalar }, secret);
  } catch (err: any) {
    if (err?.code === 'SESSIYA_KALIT_YOQ') {
      return Response.json({ ok: false, code: 'CONFIG',
        xato: 'Server sozlanmagan: SESSIYA_KALIT yo‘q. Cloudflare Pages → Environment variables → SESSIYA_KALIT (Production + Preview), keyin qayta deploy.' },
        { status: 503 });
    }
    throw err;
  }
  return new Response(JSON.stringify({ ok: true, rol }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `sess=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`,
    },
  });
};
