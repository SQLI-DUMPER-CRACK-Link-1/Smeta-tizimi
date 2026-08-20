import { tekshir, kalitBormi, KALIT_XABAR, kalitTashxis } from '../_shared/auth';

/**
 * Joriy sessiya haqida ma'lumot — sayt kim bo'lib kirganini BILISHI uchun.
 * Bulmasa foydalanuvchi admin panelida turib «Раҳбар режимида ёзиш мумкин эмас»
 * xatosini oladi va sababini tushunmaydi.
 */
export const onRequestGet: PagesFunction<{ SESSIYA_KALIT: string }> = async (ctx) => {
  const secret = ctx.env.SESSIYA_KALIT;
  if (!kalitBormi(secret)) {
    const tx = kalitTashxis(ctx.env as unknown as Record<string, unknown>);
    return Response.json({
      ok: false, sozlanmagan: true,
      xato: KALIT_XABAR + '  [server ko'radi: uzunlik=' + tx.uzunlik +
            (tx.oq_joy ? ', chetida bo'shliq bor' : '') + ']',
      tashxis: tx,
    }, { status: 503 });
  }
  const sess = await tekshir(ctx.request.headers.get('Cookie'), secret);
  if (!sess) return Response.json({ ok: false }, { status: 401 });

  /* gas.ts dagi bilan BIR XIL ro'yxat bo'lishi shart — aks holda UI bir narsa
   * ko'rsatib, server boshqacha qaror qiladi. */
  const yozaOladi = !(sess.rol === 'boss' || sess.rol === 'rahbar');

  return Response.json({
    ok: true,
    rol: sess.rol,
    email: sess.email || '',
    yozaOladi,
    tugaydi: sess.exp,
  });
};
