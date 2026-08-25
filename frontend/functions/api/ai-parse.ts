export const onRequestPost: PagesFunction<{
  GEMINI_API_KEY: string;
}> = async (ctx) => {
  try {
    const data = await ctx.request.json<{ text?: string; imageUrl?: string }>();
    // Mock AI response
    const parsed = {
      raqam: 'INV-10293',
      sana: '2026-08-25',
      kontragent: 'Stroy Material MCHJ',
      inn: '201010101',
      summa: 50000000
    };
    return Response.json({ ok: true, data: parsed });
  } catch (e) {
    return Response.json({ ok: false, error: 'AI Parse Error' });
  }
};
