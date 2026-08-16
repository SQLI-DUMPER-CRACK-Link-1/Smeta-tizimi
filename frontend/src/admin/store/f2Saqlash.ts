/**
 * f2Saqlash.ts — BOG'LANISHLARNI YO'QOTMASLIK QATLAMI
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN (2026-08-15):
 * Foydalanuvchi 989 qatorni QO'LDA bog'lab chiqdi (bir necha soatlik ish),
 * «Yozish» bosdi va GAS javobi kelmadi («GAS javobi JSON emas»). Butun
 * mehnat brauzer xotirasida osilib qoldi — sahifa yangilansa YO'QOLARDI.
 *   «bu 3-marta shuncha katta ishni qilishim... shuncha ish bir tiyn bo'ldimi»
 *
 * Bu qatlam bog'lanishlarni HAR O'ZGARISHDA localStorage ga yozadi.
 * Brauzer yopilsa, sahifa yangilansa, tok o'chsa ham — ish joyida qoladi.
 *
 * MUHIM: bu FAQAT qoralama (bog'lanish holati). Haqiqat manbai — LRV_PLUS.
 * Qoralama smetaga yozilgandan keyin tozalanadi.
 */

const KALIT = 'f2_qoralama_v1';
const MAX_YOSH = 30 * 24 * 60 * 60 * 1000;   // 30 kun — undan eskisi tashlanadi

export type F2Qoralama = {
  obyekt: string;
  oyNom: string;
  faylNomi: string;
  /** akt uid → smeta joyi (qolBog) */
  qolBog: Record<string, unknown>;
  /** akt uid → qo'shimcha/zamena yozuvi (qolDop) */
  qolDop: Record<string, unknown>;
  /* ⚡⚡⚡ 2026-08-16 QO'SHILDI (Antigravity auditi C4 — TASDIQLANDI).
   * `qolBekor` — foydalanuvchi QO'LDA BEKOR QILGAN avto-mosliklar.
   * U qoralamada SAQLANMASDI: foydalanuvchi 50 ta noto'g'ri moslikni
   * bekor qiladi, brauzer yopiladi, qoralama tiklanadi — va bekor
   * qilishlar YO'QOLADI, noto'g'ri bog'lanishlar QAYTIB KELADI.
   * Ya'ni tuzatish ishi jim bekor bo'lardi. */
  qolBekor?: string[];
  /** avto-moslashtirish natijasi (qayta hisoblamaslik uchun) */
  natija: unknown;
  aktTree: unknown;
  lokalka: string | string[];
  vaqt: number;
  qatorSoni: number;
};

/** Qoralamani saqlash — jim ishlaydi, xato UI ni to'xtatmaydi */
export function qoralamaSaqla(q: Omit<F2Qoralama, 'vaqt'>): boolean {
  try {
    if (!q.obyekt || !q.oyNom) return false;
    const yozuv: F2Qoralama = { ...q, vaqt: Date.now() };
    localStorage.setItem(KALIT, JSON.stringify(yozuv));
    return true;
  } catch {
    /* Kvota to'lgan bo'lishi mumkin (aktTree katta). Aktsiz urinamiz —
     * eng qimmatlisi bog'lanishlar, daraxt fayldan qayta o'qiladi. */
    try {
      const kichik: F2Qoralama = { ...q, aktTree: null, natija: null, vaqt: Date.now() };
      localStorage.setItem(KALIT, JSON.stringify(kichik));
      return true;
    } catch { return false; }
  }
}

/** Saqlangan qoralamani o'qish (eskisi bo'lsa null) */
export function qoralamaOqi(): F2Qoralama | null {
  try {
    const x = localStorage.getItem(KALIT);
    if (!x) return null;
    const q = JSON.parse(x) as F2Qoralama;
    if (!q || !q.obyekt || !q.oyNom) return null;
    if (Date.now() - (q.vaqt || 0) > MAX_YOSH) { qoralamaOchir(); return null; }
    return q;
  } catch { return null; }
}

export function qoralamaOchir() {
  try { localStorage.removeItem(KALIT); } catch { /* muhim emas */ }
}

/** «3 daqiqa oldin» ko'rinishidagi matn */
export function qoralamaVaqti(vaqt: number): string {
  const s = Math.max(0, Math.round((Date.now() - vaqt) / 1000));
  if (s < 60) return `${s} soniya oldin`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} daqiqa oldin`;
  const soat = Math.round(m / 60);
  if (soat < 24) return `${soat} soat oldin`;
  return `${Math.round(soat / 24)} kun oldin`;
}
