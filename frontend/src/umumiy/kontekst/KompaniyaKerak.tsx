/**
 * KompaniyaKerak — kompaniya-scoped sahifa uchun professional bo'sh holat.
 * Xom "Avval yuqoridan kompaniya tanlang" o'rniga: nima qilish kerakligini
 * aniq aytadi va superadmin Global rejimda bo'lsa buni tushuntiradi.
 */
import { Building2, Globe, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { useKompaniya } from './KompaniyaKontekst';
import { tizimdanChiq } from './chiqish';

export function KompaniyaKerak({ nima }: { nima?: string }) {
  const k = useKompaniya();
  const obyekt = nima || 'Bu sahifa';

  if (k.yuklanmoqda) {
    return (
      <div className="p-8 text-sm text-text-dim flex items-center gap-2">
        <RefreshCw size={15} className="animate-spin" /> Kompaniya konteksti yuklanmoqda…
      </div>
    );
  }

  if (k.xato) {
    return (
      <div className="p-8 max-w-lg">
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100">
          <div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{k.xato}</span></div>
          <div className="mt-3">
            {k.authXato
              ? <button onClick={tizimdanChiq} className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 px-3 py-1.5 font-medium"><LogOut size={13} /> Chiqib, qayta kirish</button>
              : <button onClick={k.qayta} className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/15 px-3 py-1.5 font-medium"><RefreshCw size={13} /> Qayta urinish</button>}
          </div>
        </div>
      </div>
    );
  }

  // superadmin Global rejimda — kompaniya-scoped sahifa uchun kompaniya kerak
  if (k.globalRejim) {
    return (
      <div className="p-8 max-w-lg">
        <div className="rounded-lg border border-border bg-surface px-5 py-4">
          <div className="flex items-center gap-2 text-text font-medium"><Globe size={16} className="text-accent" /> Global rejim</div>
          <p className="text-[13px] text-text-dim mt-2">
            {obyekt} bitta kompaniyaga tegishli ma’lumotni ko‘rsatadi. Yuqoridagi
            <b className="text-text"> «Kontekst»</b> ro‘yxatidan kompaniyani tanlang.
          </p>
        </div>
      </div>
    );
  }

  // a'zolik yo'q
  if (!k.kompaniyalar.length) {
    return (
      <div className="p-8 max-w-lg">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-[13px] text-amber-100 flex items-start gap-2">
          <Building2 size={16} className="mt-0.5 shrink-0" />
          <div>
            Siz hali hech qaysi kompaniyaga a’zo emassiz.{' '}
            <a href="/admin/kompaniya" className="underline hover:no-underline">Kompaniya oching yoki direktordan qo‘shishini so‘rang.</a>
          </div>
        </div>
      </div>
    );
  }

  // ko'p kompaniya, tanlanmagan
  return (
    <div className="p-8 max-w-lg">
      <div className="rounded-lg border border-border bg-surface px-5 py-4">
        <div className="flex items-center gap-2 text-text font-medium"><Building2 size={16} className="text-accent" /> Kompaniya tanlanmagan</div>
        <p className="text-[13px] text-text-dim mt-2">
          {obyekt} uchun yuqoridagi <b className="text-text">«Kontekst»</b> ro‘yxatidan kompaniyani tanlang.
        </p>
      </div>
    </div>
  );
}
