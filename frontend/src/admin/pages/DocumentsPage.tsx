/**
 * DocumentsPage.tsx — canonical /admin/documents.
 * The canonical document model (FILE-TRUTH-001: t2_document_registry canonical
 * columns + private R2 + /api/hujjat-yukla|ol) is SOURCE-READY but not applied
 * to production yet. Until the release runbook is executed this page shows an
 * honest state, not demo data. EGALIK: Claude (integration lane).
 */
import { FileStack, ArrowRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DocumentsPage() {
  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileStack className="text-accent" /> Hujjatlar markazi
      </h1>
      <p className="text-sm text-text-dim mt-1 max-w-3xl">
        Kanonik hujjat modeli: Supabase reyestr + <b>maxfiy Cloudflare R2</b> (fayl haqiqat),
        Google Drive — ikkilamchi sinxron replika. GAS/Drive core oqimda emas.
      </p>

      <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100 flex items-start gap-2 max-w-2xl">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          FILE-TRUTH-001 backend’i <b>source-ready</b>, lekin productionga hali
          qo‘llanmagan (migratsiya + private R2 binding + Cloudflare deploy —
          <code> ops/releases/NEXT_MAIN_RELEASE_V1.md</code>). Release runbook
          bajarilgach bu ekran to‘liq ishlaydi: RESERVING → UPLOADING → FINALIZING
          → CANONICAL READY, keyin alohida Drive replika holati.
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/admin/_demo/documents"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] hover:bg-surface-2">
          Demo (UI oqimi) <ArrowRight size={14} />
        </Link>
        <Link to="/admin/storage"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] hover:bg-surface-2">
          Fayl saqlash (Storage) <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
