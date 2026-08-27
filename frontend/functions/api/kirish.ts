import { imzola, Rol } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let req: { login?: string; parol?: string; isBoss?: boolean } = {};
  try {
    req = await ctx.request.json();
  } catch (err) {
    return Response.json({ ok: false, xato: 'Noto\'g\'ri so\'rov formati' }, { status: 400 });
  }
  
  let rol: Rol | null = null;
  let login = '';

  if (req.isBoss) {
    rol = 'boss';
    login = 'boss';
  } else {
    login = req.login || '';
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
  }

  if (!rol) {
    // Brute-force sekinlashtirish
    await new Promise(r => setTimeout(r, 800));
    return Response.json({ ok: false, xato: 'Логин ёки парол нотўғри' }, { status: 401 });
  }

  /* ⚡ 2026-08-27 (Claude, foydalanuvchi tasdig'i — "Auth Session ->
   * User -> Tenant -> Role" poydevori): GAS login/parolni tasdiqlagach
   * (yuqorida, o'zgarmagan), endi Postgres'da real foydalanuvchi/
   * a'zolik yozuvi yaratiladi/topiladi va sessiya shu bilan boyitiladi.
   * BEST-EFFORT: Supabase o'chib qolsa ham kirish BLOKLANMAYDI (eski
   * xatti-harakat saqlanadi) — faqat `foydalanuvchi_id`/`kompaniyalar`
   * sessiyada bo'lmay qoladi, sb.ts/sb-yoz.ts buni "eski sessiya" deb
   * ko'radi va yangi tekshiruvni o'tkazib yuboradi. */
  let foydalanuvchiId: number | undefined;
  /* ⚡ 2026-08-27: avval faqat ID'larga tekislangan edi (`.map(a =>
   * a.kompaniya_id)`) — RPC allaqachon har a'zolikning ROLINI ham
   * qaytaradi, uni tashlab yuborish "polimorfik rol" ma'lumotini yo'q
   * qilardi. Endi to'liq {kompaniya_id, rol} juftligi saqlanadi. */
  let kompaniyalar: { kompaniya_id: number; rol: string }[] | undefined;
  try {
    if (ctx.env.SUPABASE_URL && ctx.env.SUPABASE_KEY) {
      const r = await fetch(
        ctx.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/t2_kirish_royxatga_ol',
        {
          method: 'POST',
          headers: {
            apikey: ctx.env.SUPABASE_KEY,
            Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_login: login, p_rol: rol }),
        });
      if (r.ok) {
        const natija = await r.json<{ ok: boolean; foydalanuvchi_id?: number; azoliklar?: { kompaniya_id: number; rol: string }[] }>();
        if (natija.ok) {
          foydalanuvchiId = natija.foydalanuvchi_id;
          kompaniyalar = natija.azoliklar || [];
        }
      }
    }
  } catch (err) {
    console.error('t2_kirish_royxatga_ol xatosi (kirish baribir davom etadi):', err);
  }

  const secret = ctx.env.SESSIYA_KALIT;
  const token = await imzola({ rol, email: login, foydalanuvchi_id: foydalanuvchiId, kompaniyalar }, secret);
  return new Response(JSON.stringify({ ok: true, rol }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `sess=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`,
    },
  });
};
