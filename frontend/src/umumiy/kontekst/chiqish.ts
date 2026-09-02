/**
 * chiqish.ts — YAGONA tizimdan chiqish. Cookie + kompaniya konteksti +
 * barcha kesh tozalanadi. Har qanday qobiq shu funksiyani ishlatsin —
 * aks holda keyingi foydalanuvchi oldingi kompaniya kontekstini ko'radi.
 */
const KONTEKST_KALITLAR = ['t2_kompaniya_kontekst', 't2_active_kompaniya', 't2_global_rejim', 't2_kompaniya_id'];

export function tizimdanChiq() {
  try {
    document.cookie = 'sess=; Max-Age=0; path=/';
    for (const k of KONTEKST_KALITLAR) localStorage.removeItem(k);
  } catch { /* private mode */ }
  window.location.href = '/';
}
