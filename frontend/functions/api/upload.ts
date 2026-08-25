export const onRequestPost: PagesFunction<any> = async (ctx) => {
  try {
    const formData = await ctx.request.formData();
    const file = formData.get('fayl') as File;
    const rfqId = formData.get('rfq_id') as string;
    
    if (!file) return Response.json({ ok: false, error: 'Fayl topilmadi' }, { status: 400 });

    const ext = file.name.split('.').pop();
    /* ⚠️ Ataylab shablon-satr (template literal) ISHLATILMADI.
     * Bu fayl avval buzilgan holatda edi: backtick va ${...}
     * interpolyatsiyasi noma'lum jarayon tomonidan olib tashlangan
     * ekan (\`\${rfqId}...\` o'rniga yalang'och qiyshiq chiziqlar
     * qolgan), Cloudflare Pages build'ini yiqitgan. Oddiy satr
     * qo'shish (concatenation) shu turdagi korruptsiyadan xoli. */
    const fileName = (rfqId || 'fayl') + '-' + Date.now() + '-' +
      Math.random().toString(36).slice(2, 8) + '.' + ext;

    // R2 ga yuklash
    await ctx.env.R2_ARCHIVE.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const fileUrl = 'https://r2.qurilish-os.uz/' + fileName;
    
    return Response.json({ ok: true, url: fileUrl, filename: fileName });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};
