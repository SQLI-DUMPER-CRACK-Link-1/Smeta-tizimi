import { yozAmali, sbOqi } from './supabase';

/* ⚡ 2026-08-28 (Claude, MASTER_REJA_ENTERPRISE_OS.md FAZA 1 — multi-tenant
 * poydevorining yetishmayotgan qismi): `t2_foydalanuvchi`/`t2_azolik`
 * jadvallari 2026-08-27 dagi "Auth Session -> User -> Tenant -> Role"
 * ishida yaratilgan edi, lekin ularni BOSHQARADIGAN RPC yo'q edi — faqat
 * GAS login orqali BIRINCHI marta avtomatik a'zolik yaratilardi
 * (`t2_kirish_royxatga_ol`). Kompaniya ichida ODAM QO'LDA yangi a'zo
 * qo'sha olmasdi, rol o'zgartira olmasdi, a'zolikni bekor qila olmasdi —
 * bu funksiyalar shu bo'shliqni yopadi.
 *
 * ⚠️ Rol nomlari GAS'dagi bilan BIR XIL bo'lishi shart (`superadmin |
 * admin | boss | rahbar | bugalter | pto | prorab`) — bu tizimning
 * global rol konvensiyasi, yangisini o'ylab topmang. */

export type AzolikRol =
  | 'superadmin' | 'admin' | 'boss' | 'rahbar' | 'bugalter' | 'pto' | 'prorab';

export type Azolik = {
  azolik_id: number; kompaniya_id: number; rol: AzolikRol; holat: string;
  yaratildi: string;
  foydalanuvchi_id: number; login: string; email: string | null; ism: string | null;
};

export function sbAzolikRoyxatOl(kompaniyaId: number) {
  return sbOqi<Azolik>({
    jadval: 't2_azolik_royxat', filtr: 'kompaniya_id=eq.' + kompaniyaId,
    tartib: 'login.asc', limit: 500,
  });
}

/** Login bo'yicha qidiradi; foydalanuvchi hali yo'q bo'lsa yangi yaratiladi. */
export function sbAzolikQosh(p: {
  kompaniyaId: number; login: string; rol: AzolikRol; email?: string; ism?: string;
}) {
  return yozAmali({
    amal: 'azolik_qosh', kompaniya_id: p.kompaniyaId, login: p.login,
    rol: p.rol, email: p.email, ism: p.ism,
  });
}

export function sbAzolikRolOzgartir(azolikId: number, yangiRol: AzolikRol) {
  return yozAmali({ amal: 'azolik_rol_ozgartir', azolik_id: azolikId, yangi_rol: yangiRol });
}

/** Soft-delete — `holat='bekor'`, foydalanuvchining o'zi (t2_foydalanuvchi) o'chirilmaydi. */
export function sbAzolikOchir(azolikId: number) {
  return yozAmali({ amal: 'azolik_ochir', azolik_id: azolikId });
}
