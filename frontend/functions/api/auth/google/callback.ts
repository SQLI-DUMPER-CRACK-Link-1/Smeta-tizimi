import { imzola, Rol } from '../../../_shared/auth';

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RUXSAT: string;
  SESSIYA_KALIT: string;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // CSRF: qaytgan state cookie'dagi bilan bir xilmi?
  const kutilgan = ctx.request.headers.get('Cookie')?.match(/oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== kutilgan) {
    return Response.redirect(`${url.origin}/?xato=state`, 302);
  }

  // code → token (server↔server, sir brauzerga chiqmaydi)
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: ctx.env.GOOGLE_CLIENT_ID,
      client_secret: ctx.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const tok = await tr.json<{ id_token?: string }>();
  if (!tok.id_token) return Response.redirect(`${url.origin}/?xato=token`, 302);

  // id_token ni Google'ning o'zida tekshiramiz (imzoni qo'lda tekshirmaymiz)
  const vr = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + tok.id_token);
  const info = await vr.json<{ email?: string; email_verified?: string; aud?: string }>();

  if (!info.email || info.email_verified !== 'true' || info.aud !== ctx.env.GOOGLE_CLIENT_ID) {
    return Response.redirect(`${url.origin}/?xato=tekshiruv`, 302);
  }

  // Ruxsat ro'yxati (Endi Google Sheets'dan tekshiriladi)
  const email = info.email.toLowerCase();
  
  // GAS ga so'rov yuborish
  let rol: Rol | null = null;
  try {
    const superadminFallback = ctx.env.RUXSAT ? ctx.env.RUXSAT.split(':')[0].trim() : '';
    
    const r = await fetch(ctx.env.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ 
        __api: 1, 
        token: ctx.env.GAS_TOKEN, 
        fn: 'apiXodimRolOl', 
        args: [email, superadminFallback] 
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
    return Response.redirect(`${url.origin}/?xato=ruxsat`, 302);
  }

  const sess = await imzola({ rol, email }, ctx.env.SESSIYA_KALIT);
  
  // Yo'naltirish mantig'i. Barcha rollar o'ziga xos yo'nalishga ega bo'lishi mumkin.
  // Hozirgi App.tsx da /admin/obyektlar, /boss mavjud. Qolgan rollarni moslashtiramiz.
  let redirectPath = '/';
  if (rol === 'admin' || rol === 'superadmin' || rol === 'bugalter' || rol === 'pto' || rol === 'prorab') {
    redirectPath = '/admin/obyektlar';
  } else if (rol === 'boss' || rol === 'rahbar') {
    redirectPath = '/boss';
  } else {
    redirectPath = `/${rol}`;
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}${redirectPath}`,
      'Set-Cookie': `sess=${sess}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`,
    },
  });
};
