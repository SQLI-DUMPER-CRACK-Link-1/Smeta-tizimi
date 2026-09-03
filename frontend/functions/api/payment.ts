import { supabaseBaseUrl } from '../_shared/supabase-url';
export const onRequestPost: PagesFunction<any> = async (ctx) => {
  try {
    const data = await ctx.request.json<{ transaction_id?: string; amount?: number }>();

    // Asosiy to'lov gateway callback mantig'i
    const tolov_id = data.transaction_id;
    const summa = data.amount;
    
    // Supabase orqali to'lovni tasdiqlash
    const r = await fetch(
      supabaseBaseUrl(ctx.env.SUPABASE_URL) + '/rest/v1/rpc/t2_tolov_tasdiqla',
      {
        method: 'POST',
        headers: {
          apikey: ctx.env.SUPABASE_KEY,
          Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_tolov_id: tolov_id, p_summa: summa }),
      });
      
    if (!r.ok) return Response.json({ ok: false, error: 'Database xatosi' }, { status: 500 });

    return Response.json({ ok: true, status: 'To\'lov muvaffaqiyatli qabul qilindi' });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};
