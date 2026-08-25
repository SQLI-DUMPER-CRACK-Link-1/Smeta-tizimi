export const onRequestPost: PagesFunction<{
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
}> = async (ctx) => {
  try {
    const update = await ctx.request.json<any>();
    if (!update.message) return new Response('OK');
    
    const msg = update.message;
    const text = msg.text || msg.caption || '';
    
    // Asosiy mantiq (AI bilan matnni Sklad JSON formatiga o'tkazish)
    // Tizim_01 dagi kabi Gemini / LPU ga yuboriladi, keyin sbSkladgaYozish qilinadi.
    // Xavfsizlik va soddalik uchun, bu yerda arxitektura doirasida webhook tasdiqlanadi.
    
    console.log('Telegram update received:', text);
    
    return new Response('OK');
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Error', { status: 500 });
  }
};
