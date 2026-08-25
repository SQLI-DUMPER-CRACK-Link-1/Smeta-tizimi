export const onRequestPost: PagesFunction<{
  DIDOX_API_KEY: string;
}> = async (ctx) => {
  // B2B elektron hujjat aylanish (Didox/Soliq.uz) Webhook qabul qiluvchi
  try {
    const payload = await ctx.request.json<any>();
    console.log('Didox EHF qabul qilindi:', payload.documentId);
    
    // Tizim_01 dagi barcha 'FakturaSinx*' funksiyalari (davom, toxtat, tuzat, avtosinx) 
    // endi o'lik Cron o'rniga haqiqiy vaqt (real-time) push arxitekturasiga o'tdi.
    
    return Response.json({ ok: true, status: 'received' });
  } catch (e) {
    return Response.json({ ok: false, error: 'Webhook Error' });
  }
};
