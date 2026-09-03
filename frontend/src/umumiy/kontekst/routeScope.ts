/**
 * routeScope.ts — har bir /admin marshrutining KONTEKST SINFI.
 * ═══════════════════════════════════════════════════════════════════
 * Codex auditi (T2_COMPANY_CONTEXT_UX_AUDIT_001_CODEX.md §10, §18) asosida.
 *
 *   GLOBAL         — kompaniya konteksti KERAK EMAS (identity, registry,
 *                    platforma boshqaruvi).
 *   COMPANY_SCOPED — bitta kompaniyaga tegishli ma'lumot.
 *   PROJECT_SCOPED — kompaniya + loyiha.
 *   OBJECT_SCOPED  — kompaniya + loyiha + obyekt.
 *   USER_SCOPED    — faqat foydalanuvchi (login, o'z profili).
 *   LEGACY         — Tizim_01 / eski GAS sahifalari (arxiv navigatsiyada).
 *
 * COMPANY_SCOPED va undan chuqurroq marshrutlar kompaniya yo'q bo'lsa
 * <KompaniyaKerak/> professional bo'sh holatini ko'rsatadi — xom xato EMAS.
 * GLOBAL marshrutlar hech qachon bu qo'riqchini ko'rsatmaydi.
 */
export type RouteScope = 'GLOBAL' | 'COMPANY_SCOPED' | 'PROJECT_SCOPED' | 'OBJECT_SCOPED' | 'USER_SCOPED' | 'LEGACY';

export const ROUTE_SCOPE: Record<string, RouteScope> = {
  '/': 'USER_SCOPED',

  // GLOBAL — kompaniya tanlamasdan ishlaydi
  '/admin/kompaniya': 'GLOBAL',                 // identity + a'zoliklar + registry (t2_men_v1)
  '/admin/system-control': 'GLOBAL',            // T2-COMPANY-CONTROL-CLOSEOUT: split done — no kompaniya_id -> t2_system_control_global_v1 (platform-role gated); kompaniya_id present -> unchanged company-scoped t2_system_control_v1

  // COMPANY_SCOPED
  '/admin/dashboard': 'COMPANY_SCOPED',
  '/admin/documents': 'COMPANY_SCOPED',
  '/admin/mindmap': 'COMPANY_SCOPED',
  '/admin/test/portfel': 'COMPANY_SCOPED',
  '/admin/test/moliya': 'COMPANY_SCOPED',
  '/admin/test/logistika': 'COMPANY_SCOPED',
  '/admin/test/crm': 'COMPANY_SCOPED',
  '/admin/test/smeta': 'COMPANY_SCOPED',
  '/admin/test/zayavka': 'COMPANY_SCOPED',
  '/admin/test/erp': 'COMPANY_SCOPED',
  '/admin/test/xarita': 'COMPANY_SCOPED',
  '/admin/test/kontragent': 'COMPANY_SCOPED',
  '/admin/test/sozlama': 'COMPANY_SCOPED',

  // PROJECT_SCOPED
  '/admin/participants': 'PROJECT_SCOPED',
  '/admin/test/aosr': 'PROJECT_SCOPED',

  // OBJECT_SCOPED
  '/admin/hujjat-nazorat': 'OBJECT_SCOPED',
  '/admin/storage': 'OBJECT_SCOPED',
  '/admin/test/obyektlar': 'OBJECT_SCOPED',
  '/admin/test/saqlash': 'OBJECT_SCOPED',
};

/** GLOBAL bo'lmagan (kompaniya kerak bo'ladigan) marshrutmi? */
export function kompaniyaKerakmi(pathname: string): boolean {
  const s = ROUTE_SCOPE[pathname];
  if (!s) return false; // noma'lum/legacy — o'z-o'zini qo'riqlaydi
  return s === 'COMPANY_SCOPED' || s === 'PROJECT_SCOPED' || s === 'OBJECT_SCOPED';
}
