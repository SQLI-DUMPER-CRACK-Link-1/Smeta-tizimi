import { imzola, Rol, kalitBormi, KALIT_XABAR, kalitTashxis } from '../_shared/auth';

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

  const secret = ctx.env.SESSIYA_KALIT;
  if (!kalitBormi(secret)) {
    const tx = kalitTashxis(ctx.env as unknown as Record<string, unknown>);
    return Response.json({
      ok: false, sozlanmagan: true,
      xato: KALIT_XABAR + '  [server ko'radi: uzunlik=' + tx.uzunlik +
            (tx.oq_joy ? ', chetida bo'shliq bor' : '') + ']',
      tashxis: tx,
    }, { status: 503 });
  }
  const token = await imzola({ rol, email: login }, secret);
  return new Response(JSON.stringify({ ok: true, rol }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `sess=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`,
    },
  });
};
