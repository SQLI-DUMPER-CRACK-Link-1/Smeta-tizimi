export const onRequestPost: PagesFunction<{
  GAS_URL: string; GAS_TOKEN: string;
}> = async (ctx) => {
  const { fn, args } = await ctx.request.json<{ fn: string; args?: unknown[] }>();

  const r = await fetch(ctx.env.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ __api: 1, token: ctx.env.GAS_TOKEN, fn, args: args ?? [] }),
  });

  return new Response(await r.text(), {
    headers: {
      'Content-Type': 'application/json'
    },
  });
};
