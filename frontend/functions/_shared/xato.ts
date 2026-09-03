/**
 * xato.ts — server javoblarida XAVFSIZ xato. Xom PostgREST/Supabase/HTML
 * tafsiloti brauzerga HECH QACHON chiqmaydi (schema/implementation oshkorligi).
 * Xom matn `console.error` ga (Cloudflare telemetriyasi) yoziladi, foydalanuvchi
 * barqaror `code` + o'zbekcha xabar oladi.
 */
const XABAR: Record<string, string> = {
  AUTH_REQUIRED: 'Sessiya muddati tugagan. Chiqib, qaytadan kiring.',
  CONFIG: 'Server sozlanmagan. Administrator bilan bog‘laning.',
  FORBIDDEN: 'Bu amal uchun ruxsatingiz yo‘q.',
  NOT_FOUND: 'So‘ralgan ma’lumot topilmadi.',
  BAD_REQUEST: 'So‘rov noto‘g‘ri.',
  CONFLICT: 'Ma’lumot boshqa joyda o‘zgargan — sahifani yangilang.',
  UPSTREAM: 'Ma’lumotni yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.',
};

/** Xom javobni log qiladi, foydalanuvchiga xavfsiz `Response` qaytaradi. */
export function xavfsizXato(code: string, status: number, xom?: unknown): Response {
  if (xom != null) {
    try { console.error('[api xato]', code, status, typeof xom === 'string' ? xom.slice(0, 500) : xom); }
    catch { /* ignore */ }
  }
  return Response.json({ ok: false, code, xato: XABAR[code] || XABAR.UPSTREAM }, { status });
}
