/**
 * KompaniyaKontekst.tsx — TIZIM_02 ning YAGONA kompaniya/tenant konteksti.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * NEGA: avval 3 xil "kompaniya" tushunchasi bor edi va ular bir-biri bilan
 * gaplashmasdi:
 *   1) test02/KompaniyaTanlov — `t2_kompaniya` ni to'g'ridan o'qirdi
 *      (a'zolik filtri yo'q), faqat TestShell ichida edi;
 *   2) api/t2-men — kanonik `t2_men_v1` (ident: + a'zoliklar), faqat
 *      /admin/kompaniya sahifasida;
 *   3) sess.kompaniyalar — JWT ichidagi a'zoliklar, faqat serverda.
 *
 * Natijada `/admin/*` sahifalari (dashboard, hujjat-nazorat, participants,
 * documents, system-control) `useKompaniya()` ni chaqirardi, lekin
 * AdminShell'da PROVIDER YO'Q edi → `joriy` doim `null` →
 * "Avval yuqoridan kompaniya tanlang" — hech qachon tanlab bo'lmasdi.
 *
 * ENDI: bitta provider, App.tsx da /admin va /boss ustida turadi, kanonik
 * `t2_men_v1` (a'zoliklar) dan oziqlanadi. SUPERADMIN uchun Global rejim
 * bor — kompaniya tanlamasdan global sahifalar ishlaydi.
 *
 * Eski `import { useKompaniya } from '../test02/KompaniyaTanlov'` yo'llari
 * ISHLAYVERADI — KompaniyaTanlov endi shu fayldan re-export qiladi.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { menOl, type Men } from '../../api/t2-men';

export type KompaniyaMavqe = 'zakazchik' | 'pudratchi' | 'loyihachi' | string;

/** Kontekstda ishlatiladigan yengil kompaniya shakli (eski `T2Kompaniya`
 *  bilan mos: consumer'lar asosan `.id` va `.nom` ni ishlatadi). */
export type KompaniyaQisqa = {
  id: number;
  nom: string;
  kod: string;
  rol: string;
  is_director: boolean;
  /** Eski UI mosli­gi uchun — `t2_men_v1` bermaydi, hozircha null. */
  mavqe: KompaniyaMavqe | null;
};

type Holat = {
  /** Foydalanuvchi a'zo bo'lgan kompaniyalar (kanonik `t2_men_v1`). */
  kompaniyalar: KompaniyaQisqa[];
  /** Tanlangan kompaniya. Global rejimda `null`. */
  joriy: KompaniyaQisqa | null;
  joriyId: number | null;
  /** Kompaniyani tanlash (a'zo bo'lmagan id rad etiladi). */
  tanla: (id: number) => void;
  /** Global rejim — faqat superadmin. */
  globalRejim: boolean;
  globalGa: () => void;
  superadmin: boolean;
  kopKompaniya: boolean;
  yuklanmoqda: boolean;
  /** Foydalanuvchiga ko'rsatiladigan xato matni (xom PostgREST EMAS). */
  xato: string;
  /** Xato auth bilan bog'liqmi — "qayta kiring" ko'rsatish uchun. */
  authXato: boolean;
  qayta: () => void;
  foydalanuvchi: Men['foydalanuvchi'] | null;
};

const BOSH: Holat = {
  kompaniyalar: [], joriy: null, joriyId: null, tanla: () => {},
  globalRejim: false, globalGa: () => {}, superadmin: false, kopKompaniya: false,
  yuklanmoqda: true, xato: '', authXato: false, qayta: () => {}, foydalanuvchi: null,
};

const Kontekst = createContext<Holat>(BOSH);
export const useKompaniya = () => useContext(Kontekst);

const KEY_ID = 't2_active_kompaniya';
const KEY_GLOBAL = 't2_global_rejim';

function olLS(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function yozLS(k: string, v: string | null) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } }

/** Xom server xatosini foydalanuvchi tiliga o'giradi. */
export function kompaniyaXatoMatni(e: any): { matn: string; auth: boolean } {
  const code = String(e?.code || '');
  const msg = String(e?.message || e || '');
  if (code === 'AUTH_REQUIRED' || /401|sessiya|kiring/i.test(code + msg)) {
    return { matn: 'Sessiya muddati tugagan. Chiqib, qaytadan kiring.', auth: true };
  }
  if (code === 'ME_FAILED' || code === 'CONFIG') {
    return { matn: 'Kompaniya ma’lumotini olishda server nosozligi. Birozdan so‘ng qayta urinib ko‘ring.', auth: false };
  }
  if (code === 'ACTOR_NOT_FOUND') {
    return { matn: 'Foydalanuvchi topilmadi. Administrator bilan bog‘laning.', auth: false };
  }
  return { matn: 'Kompaniya ma’lumotini o‘qib bo‘lmadi.', auth: false };
}

export function KompaniyaProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [men, setMen] = useState<Men | null>(null);
  const [yuklanmoqda, setYuk] = useState(true);
  const [xato, setXato] = useState('');
  const [authXato, setAuthXato] = useState(false);
  const [joriyId, setJoriyId] = useState<number | null>(() => {
    const n = Number(olLS(KEY_ID) || 0); return Number.isFinite(n) && n > 0 ? n : null;
  });
  const [globalRejim, setGlobalRejim] = useState<boolean>(() => olLS(KEY_GLOBAL) === '1');

  const load = useCallback(() => {
    setYuk(true); setXato(''); setAuthXato(false);
    menOl()
      .then((m) => { setMen(m); setYuk(false); })
      .catch((e: any) => { const x = kompaniyaXatoMatni(e); setXato(x.matn); setAuthXato(x.auth); setYuk(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const kompaniyalar = useMemo<KompaniyaQisqa[]>(
    () => (men?.azoliklar ?? [])
      .filter((a) => a.faol !== false)
      .map((a) => ({ id: a.kompaniya_id, nom: a.nom, kod: a.kod, rol: a.rol, is_director: a.is_director, mavqe: null })),
    [men],
  );
  const superadmin = useMemo(
    () => (men?.azoliklar ?? []).some((a) => a.rol === 'superadmin' || a.rol === 'admin'),
    [men],
  );

  /* Saqlangan tanlovni a'zoliklar bilan solishtirish (bir marta, men kelgach). */
  useEffect(() => {
    if (!men) return;
    const valid = kompaniyalar.find((k) => k.id === joriyId);
    if (globalRejim && superadmin) return;                // global rejim saqlanadi
    if (valid) return;                                    // to'g'ri tanlov saqlanadi
    if (kompaniyalar.length === 1) {                      // yagona a'zolik — avtomatik
      setJoriyId(kompaniyalar[0].id); yozLS(KEY_ID, String(kompaniyalar[0].id));
      return;
    }
    if (kompaniyalar.length === 0 && superadmin) {        // superadmin, a'zolik yo'q -> global
      setGlobalRejim(true); yozLS(KEY_GLOBAL, '1');
      return;
    }
    if (joriyId != null) { setJoriyId(null); yozLS(KEY_ID, null); } // ko'p kompaniya, tanlov yo'q
  }, [men]); // eslint-disable-line react-hooks/exhaustive-deps

  const joriy = useMemo(
    () => (globalRejim ? null : (kompaniyalar.find((k) => k.id === joriyId) ?? null)),
    [globalRejim, kompaniyalar, joriyId],
  );

  const tanla = useCallback((id: number) => {
    if (!kompaniyalar.some((k) => k.id === id)) return;
    setJoriyId(id); setGlobalRejim(false);
    yozLS(KEY_ID, String(id)); yozLS(KEY_GLOBAL, '0');
    qc.clear();                                           // eski kompaniya keshini o'chirish
  }, [kompaniyalar, qc]);

  const globalGa = useCallback(() => {
    if (!superadmin) return;
    setGlobalRejim(true); yozLS(KEY_GLOBAL, '1');
    qc.clear();
  }, [superadmin, qc]);

  const qiymat: Holat = {
    kompaniyalar, joriy, joriyId: joriy?.id ?? null, tanla,
    globalRejim: globalRejim && superadmin,
    globalGa, superadmin,
    kopKompaniya: kompaniyalar.length > 1,
    yuklanmoqda, xato, authXato, qayta: load,
    foydalanuvchi: men?.foydalanuvchi ?? null,
  };

  return <Kontekst.Provider value={qiymat}>{children}</Kontekst.Provider>;
}
