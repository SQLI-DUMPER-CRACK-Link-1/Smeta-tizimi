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
  STALE_VERSION: 'Ma’lumot boshqa joyda o‘zgargan — sahifani yangilang.',
  FAKT_CONFLICT: 'Fakt boshqa joyda o‘zgargan — holatni yangilang.',
  REPLICA_CONFLICT: 'Nusxa va kanonik ma’lumot o‘rtasida ziddiyat bor — tekshirish kerak.',
  SHEETS_CONFLICT: 'Sheets nusxasi va kanonik ma’lumot o‘rtasida ziddiyat bor — tekshirish kerak.',
  UPSTREAM: 'Ma’lumotni yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.',
};

/** Upstream payloaddan foydalanuvchiga chiqishi mumkin bo‘lgan barqaror kodlar.
 * PostgREST/SQL/HTTP ichki kodlari hech qachon tashqariga ko‘chirilmaydi. */
function xavfsizKod(raw: unknown, status: number): string {
  let candidate = '';
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'code' in parsed) {
        const value = (parsed as { code?: unknown }).code;
        if (typeof value === 'string') candidate = value;
      }
    } catch { /* JSON emas — faqat statusga tayanamiz. */ }
  } else if (raw && typeof raw === 'object' && 'code' in raw) {
    const value = (raw as { code?: unknown }).code;
    if (typeof value === 'string') candidate = value;
  }

  if (candidate === '42501' || status === 403) return 'FORBIDDEN';
  if (status === 401) return 'AUTH_REQUIRED';

  /* Ichki SQL/PostgREST nomlarini emas, formati tekshirilgan application
     code'ni qoldiramiz. Shu sabab STALE_VERSION kabi client contractlar
     saqlanadi, lekin PGRST125/SQLSTATE brauzerga chiqmaydi. */
  if (/^[A-Z][A-Z0-9_]{1,63}$/.test(candidate)
      && !/^(PGRST|SQL|HTTP|POSTGRES|PG)[A-Z0-9_]*$/.test(candidate)) {
    return candidate;
  }
  if (status === 404) return 'NOT_FOUND';
  if (candidate === '40001' || candidate === '23505' || status === 409) return 'CONFLICT';
  return 'UPSTREAM';
}

/** Xom javobni log qiladi, foydalanuvchiga xavfsiz `Response` qaytaradi. */
export function xavfsizXato(code: string, status: number, xom?: unknown): Response {
  if (xom != null) {
    try { console.error('[api xato]', code, status, typeof xom === 'string' ? xom.slice(0, 500) : xom); }
    catch { /* ignore */ }
  }
  const xabar = XABAR[code] || XABAR.UPSTREAM;
  /* `error` eski frontend kontraktlari uchun saqlanadi, lekin qiymati
     har doim whitelistdagi xavfsiz xabar bo‘ladi. */
  return Response.json({ ok: false, code, xato: xabar, error: xabar }, { status });
}

/** Supabase/uchinchi tomon javobini xom tafsilotsiz qaytaradi. */
export function xavfsizUpstream(status: number, xom?: unknown): Response {
  return xavfsizXato(xavfsizKod(xom, status), status >= 400 && status < 500 ? status : 502, xom);
}
