/**
 * SUPABASE_URL ni /rest/v1/... qo'shishdan oldin normallashtiradi.
 *
 * ⚠️ 2026-09-02 — PGRST125 ("Invalid path specified in request URL") ildizi:
 * Supabase dashboardida "Project URL" (https://xxx.supabase.co) va "REST
 * API URL" (https://xxx.supabase.co/rest/v1) ikkita alohida maydon — ular
 * chalkashtirilib, SUPABASE_URL o'zgaruvchisiga ALLAQACHON /rest/v1 bilan
 * tugaydigan qiymat kiritilishi mumkin. Kod har doim o'zi /rest/v1/<jadval
 * yoki rpc/...> qo'shadi — natijada /rest/v1/rest/v1/... qo'sh yo'l hosil
 * bo'ladi va PostgREST buni yo'l sifatida tushunolmaydi (PGRST125).
 *
 * Bu funksiya ikkala shaklni ham qabul qiladi (himoya qatlami) — lekin
 * to'g'ri konfiguratsiya baribir bare Project URL bo'lishi kerak.
 */
export function supabaseBaseUrl(url: string | undefined | null): string {
  return String(url || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}
