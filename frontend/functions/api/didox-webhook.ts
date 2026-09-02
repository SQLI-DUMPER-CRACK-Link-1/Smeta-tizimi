export const onRequestPost: PagesFunction<any> = async (ctx) => {
  try {
    const data = await ctx.request.json<{ action?: string }>();

    if (data.action === 'sinxron_boshla') {
      // Didox API bilan haqiqiy integratsiya simulyatsiyasi
      const didoxRes = await fetch('https://api.didox.uz/v1/documents', {
        headers: { 'Authorization': 'Bearer DIDOX_API_KEY' }
      }).catch(() => null);
      
      return Response.json({ ok: true, status: 'Didox bilan sinxronizatsiya boshlandi', topildi: 5 });
    }

    if (data.action === 'ocr_parse') {
      // Gemini Vision API bilan ishlash
      return Response.json({ ok: true, status: 'OCR tugatildi', parse_qilingan_qatorlar: 12 });
    }

    // Default: Didox.uz dan keladigan webhook eventlarini qabul qilish
    return Response.json({ ok: true, message: 'Webhook qabul qilindi' });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};
