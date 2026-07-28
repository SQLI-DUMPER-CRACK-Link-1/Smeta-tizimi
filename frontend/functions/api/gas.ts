export const onRequestPost: PagesFunction<{
  GAS_URL: string; GAS_TOKEN: string;
}> = async (ctx) => {
  try {
    const { fn, args } = await ctx.request.json<{ fn: string; args?: unknown[] }>();

    if (!ctx.env.GAS_URL) {
      return new Response(JSON.stringify({ ok: false, error: 'Cloudflare muhitida GAS_URL kiritilmagan (Environment Variables)' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const r = await fetch(ctx.env.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ __api: 1, token: ctx.env.GAS_TOKEN, fn, args: args ?? [] }),
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
