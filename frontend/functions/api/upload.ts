export const onRequestPost: PagesFunction<any> = async (ctx) => {
  try {
    const formData = await ctx.request.formData();
    const file = formData.get('fayl') as unknown as File | null;
    const rfqId = (formData.get('rfq_id') ?? '') as string;
    /* ⚡ 2026-08-27 (Claude, foydalanuvchi ko'rsatmasi — "DUAL-STORAGE"):
     * obyekt hujjatlari uchun R2 ichida ANIQ manzil:
     *   Kompaniya_ID / Obyekt_ID / Hujjat_turi / Haqiqiy_fayl_nomi.ext
     * Bu 3 maydon berilmasa (masalan eski faktura yuklovi) — eski
     * tasodifiy nom sxemasi ishlatiladi, hech narsa buzilmaydi. */
    const kompaniyaId = formData.get('kompaniya_id') as string;
    const obyektId = formData.get('obyekt_id') as string;
    const turi = formData.get('turi') as string;

    if (!file) return Response.json({ ok: false, error: 'Fayl topilmadi' }, { status: 400 });

    let fileName: string;
    if (kompaniyaId && obyektId) {
      /* Asl fayl nomi saqlanadi (foydalanuvchi talabi) — lekin R2 kalitida
       * xavfli belgilar (`/`, `..`) tozalanadi, aks holda papka tuzilmasi
       * buzilishi yoki boshqa obyektga chiqib ketish xavfi bor. */
      const xavfsizNom = file.name.replace(/[\/\\]/g, '_').replace(/\.\./g, '_');
      const turXavfsiz = (turi === 'loyiha' ? 'loyiha' : 'hujjat');
      fileName = kompaniyaId + '/' + obyektId + '/' + turXavfsiz + '/' + xavfsizNom;
    } else {
      const ext = file.name.split('.').pop();
      /* ⚠️ Ataylab shablon-satr (template literal) ISHLATILMADI.
       * Bu fayl avval buzilgan holatda edi: backtick va ${...}
       * interpolyatsiyasi noma'lum jarayon tomonidan olib tashlangan
       * ekan (\`\${rfqId}...\` o'rniga yalang'och qiyshiq chiziqlar
       * qolgan), Cloudflare Pages build'ini yiqitgan. Oddiy satr
       * qo'shish (concatenation) shu turdagi korruptsiyadan xoli. */
      fileName = (rfqId || 'fayl') + '-' + Date.now() + '-' +
        Math.random().toString(36).slice(2, 8) + '.' + ext;
    }

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
