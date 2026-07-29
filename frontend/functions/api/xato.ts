export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const req = await ctx.request.json<{ manba: string, xabar: string, url?: string, line?: number }>();
    
    // Yuborish GAS ga
    await fetch(ctx.env.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        __api: 1,
        token: ctx.env.GAS_TOKEN,
        fn: 'apiXatoYoz',
        args: [
          req.manba || 'FRONTEND', 
          req.xabar || 'Noma\'lum xato', 
          'Sayt foydalanuvchisi', 
          { url: req.url, line: req.line }
        ]
      }),
    });
    
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false }, { status: 500 });
  }
};
