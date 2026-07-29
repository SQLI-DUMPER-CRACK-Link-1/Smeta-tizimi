import { tekshir } from '../_shared/auth';

export const onRequestPost: PagesFunction<{
  GAS_URL: string; GAS_TOKEN: string; SESSIYA_KALIT: string;
}> = async (ctx) => {
  try {
    const { fn, args } = await ctx.request.json<{ fn: string; args?: unknown[] }>();

    const sess = await tekshir(ctx.request.headers.get('Cookie'), ctx.env.SESSIYA_KALIT);
    if (!sess) {
      return Response.json({ ok: false, error: 'Кириш талаб қилинади' }, { status: 401 });
    }

    const YOZUVCHI = /^api(HolatSaqla|BlQosh|RsQosh|OyQosh|F2Qolla|F2QollaNavbatga|ShartnomaSaqla|ShartnomaOchir|Lock)/;
    if ((sess.rol === 'boss' || sess.rol === 'rahbar') && YOZUVCHI.test(fn)) {
      return Response.json({ ok: false, error: 'Раҳбар режимида ёзиш мумкин эмас' }, { status: 403 });
    }

    if (!ctx.env.GAS_URL) {
      return new Response(JSON.stringify({ ok: false, error: 'Cloudflare muhitida GAS_URL kiritilmagan (Environment Variables)' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const r = await fetch(ctx.env.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ __api: 1, token: ctx.env.GAS_TOKEN, fn, args: args ?? [], kim: sess.email || '' }),
    });

    const text = await r.text();
    
    // Agar Google 302/HTML qaytarsa, u JSON emas. Shuni ushlaymiz.
    if (text.trim().startsWith('<')) {
      return new Response(JSON.stringify({ ok: false, error: 'Google Apps Script HTML qaytardi (302 redirect yoki xato URL: ' + ctx.env.GAS_URL + ').' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(text, {
      headers: {
        'Content-Type': 'application/json'
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: 'Cloudflare xatosi: ' + err.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
