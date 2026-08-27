/**
 * KompaniyaTanlov.tsx — TIZIM_02: qaysi kompaniya bilan ishlayapmiz
 * ═══════════════════════════════════════════════════════════════════
 *
 * `kompaniya_id` 2026-08-19 da qo'shildi (foydalanuvchi: «company id ni
 * ham birato'la hal qilib ketilishi kerak»).
 *
 * NEGA O'SHANDA: `t2_` jadvallarda o'sha payt atigi 13 qator bor edi.
 * Keyin qo'shish — butun ma'lumotni ko'chirish, har so'rovni qayta yozish
 * va migratsiya xavfi demak edi.
 *
 * ⚠️ TANLOV DOIM KO'RINADI. Sabab: bir nechta kompaniya bo'lganda
 * foydalanuvchi qaysi biriga qarab turganini BILMASA, boshqa mijozning
 * raqamini o'ziniki deb o'qishi mumkin. Bu tizimda eng qimmat xato turi
 * — jim, ko'rinmaydigan chalkashlik.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Building } from 'lucide-react';
import { sbT2KompaniyalarOl, type T2Kompaniya, type KompaniyaMavqe } from '../api/supabase';

/* ⚡ 2026-08-27 (Claude, foydalanuvchi ko'rsatmasi — "sayt 3 xil
 * rejimda ishlasin: zakazchik, pudratchi, loyihachi"): DB dagi
 * `mavqe` ustuni endi frontend TYPE'ida bor (supabase.ts) — bu yerda
 * uni ko'rinadigan qilamiz, aks holda rol tanlangan bo'lsa ham
 * foydalanuvchi qaysi rejimda turganini bilmaydi. */
const MAVQE_BELGI: Record<string, { nom: string; rang: string }> = {
  zakazchik: { nom: 'Zakazchik', rang: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  pudratchi: { nom: 'Pudratchi', rang: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  loyihachi: { nom: 'Loyihachi', rang: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
};
export function MavqeBelgisi({ mavqe }: { mavqe: KompaniyaMavqe | null | undefined }) {
  if (!mavqe) return null;
  const b = MAVQE_BELGI[mavqe] || { nom: mavqe, rang: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' };
  return (
    <span className={'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ' + b.rang}>
      {b.nom}
    </span>
  );
}

type Holat = {
  kompaniyalar: T2Kompaniya[];
  joriy: T2Kompaniya | null;
  tanla: (id: number) => void;
  yuklanmoqda: boolean;
  xato: string;
};

const Kontekst = createContext<Holat>({
  kompaniyalar: [], joriy: null, tanla: () => {}, yuklanmoqda: true, xato: '',
});

export const useKompaniya = () => useContext(Kontekst);

const SAQLASH_KALIT = 't2_kompaniya_id';

export function KompaniyaProvider({ children }: { children: ReactNode }) {
  const [kompaniyalar, setKompaniyalar] = useState<T2Kompaniya[]>([]);
  const [joriy, setJoriy] = useState<T2Kompaniya | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(true);
  const [xato, setXato] = useState('');

  useEffect(() => {
    sbT2KompaniyalarOl().then((r) => {
      setYuklanmoqda(false);
      if (!r.ok) { setXato(r.error || 'Kompaniyalar o\'qilmadi'); return; }
      const k = (r.qatorlar as T2Kompaniya[]) || [];
      setKompaniyalar(k);
      /* Avval tanlangani saqlanadi — sahifa yangilanganda yo'qolmasin */
      const saqlangan = Number(localStorage.getItem(SAQLASH_KALIT) || 0);
      const topilgan = k.find((x) => x.id === saqlangan);
      setJoriy(topilgan || k[0] || null);
    });
  }, []);

  const tanla = (id: number) => {
    const k = kompaniyalar.find((x) => x.id === id);
    if (!k) return;
    setJoriy(k);
    localStorage.setItem(SAQLASH_KALIT, String(id));
  };

  return (
    <Kontekst.Provider value={{ kompaniyalar, joriy, tanla, yuklanmoqda, xato }}>
      {children}
    </Kontekst.Provider>
  );
}

/** Qobiq tepasidagi tanlagich. Bitta kompaniya bo'lsa ham NOMI ko'rinadi. */
export function KompaniyaTanlagich() {
  const { kompaniyalar, joriy, tanla, yuklanmoqda, xato } = useKompaniya();

  if (yuklanmoqda) {
    return <span className="text-[11px] text-text-mute">kompaniya yuklanmoqda…</span>;
  }
  if (xato) {
    return <span className="text-[11px] text-danger">Kompaniya: {xato}</span>;
  }
  if (!kompaniyalar.length) {
    return <span className="text-[11px] text-warn">Kompaniya yo‘q — avval yarating</span>;
  }

  /* Bitta bo'lsa tanlash shart emas, lekin NOMI ko'rinib turishi kerak */
  if (kompaniyalar.length === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-text-dim">
        <Building size={12} /> {kompaniyalar[0].nom}
        <MavqeBelgisi mavqe={kompaniyalar[0].mavqe} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Building size={12} className="text-accent" />
      <select
        value={joriy?.id ?? ''}
        onChange={(e) => tanla(Number(e.target.value))}
        className="bg-[var(--surface-2)] border border-border rounded px-2 py-0.5
                   text-[11px] text-text outline-none focus:border-accent/50"
      >
        {kompaniyalar.map((k) => (
          <option key={k.id} value={k.id}>{k.nom}</option>
        ))}
      </select>
      <MavqeBelgisi mavqe={joriy?.mavqe} />
    </span>
  );
}
