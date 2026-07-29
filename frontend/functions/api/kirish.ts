import { imzola } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const req = await ctx.request.json<{ parol?: string }>();
  const parol = req?.parol || '';

  let rol: 'admin' | 'boss' | null = null;
  if (parol === ctx.env.ADMIN_PAROL) rol = 'admin';
  else if (parol === ctx.env.BOSS_PAROL) rol = 'boss';

  if (!rol) {
    // Brute-force sekinlashtirish
    await new Promise(r => setTimeout(r, 800));
    return Response.json({ ok: false, xato: 'Нотўғри парол' }, { status: 401 });
  }

  const token = await imzola(rol, ctx.env.SESSIYA_KALIT);
  return new Response(JSON.stringify({ ok: true, rol }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `sess=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`,
    },
  });
};
