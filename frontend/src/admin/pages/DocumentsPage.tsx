/**
 * DocumentsPage.tsx — canonical /admin/documents.
 * Wires Codex's DocumentCenter to the REAL FILE-TRUTH-001 backend:
 *   /api/hujjat-royxat -> Supabase t2_document_registry_v1 (canonical registry),
 *   /api/hujjat-ol     -> private Cloudflare R2 (canonical download).
 * Drive/Sheets are replica-status only; a failed Drive replica is never a
 * canonical-document failure. No demo data. EGALIK: Claude (integration lane).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Info, ArrowRight } from 'lucide-react';
import { DocumentCenter, type CenterDocument, type DocumentHealth } from '../../components/document-center';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import { hujjatRoyxatOl, hujjatYuklabOlishUrl } from '../../api/t2-hujjat-canonical';

export default function DocumentsPage() {
  const { joriy } = useKompaniya();
  const q = useQuery({
    queryKey: ['hujjatRoyxat', joriy?.id],
    queryFn: () => hujjatRoyxatOl({ kompaniyaId: joriy!.id }),
    enabled: !!joriy?.id,
    staleTime: 30_000,
    retry: (n, e: any) => e?.code !== 'AUTH_REQUIRED' && e?.code !== 'HTTP_403' && n < 2,
  });

  const documents: CenterDocument[] = useMemo(() => q.data?.documents ?? [], [q.data]);
  const health: DocumentHealth[] = useMemo(() => q.data?.health ?? [], [q.data]);
  const notApplied = (q.error as any)?.code === 'DOCUMENT_REGISTRY_FAILED';

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      {!joriy?.id && <p className="text-sm text-text-dim">Kompaniya konteksti tanlanmagan.</p>}

      {notApplied && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100 flex items-start gap-2 max-w-3xl">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            FILE-TRUTH-001 backend’i <b>source-ready</b>, lekin productionga hali
            qo‘llanmagan (migratsiyalar <code>20260902120000</code> + <code>20260906120000</code>,
            private R2 binding, Cloudflare deploy — <code>ops/releases/NEXT_MAIN_RELEASE_V1.md</code>).
          </div>
        </div>
      )}

      {joriy?.id && !notApplied && (
        <DocumentCenter
          projectName={joriy.nom + ' — barcha loyihalar'}
          documents={documents}
          health={health}
          loading={q.isLoading}
          error={q.isError && !notApplied ? String((q.error as any)?.code || 'xato') : undefined}
          noPermission={(q.error as any)?.code === 'HTTP_403'}
          onDownload={(id) => { window.open(hujjatYuklabOlishUrl(Number(id)), '_blank', 'noopener'); }}
          onOpen={(id) => { window.open(hujjatYuklabOlishUrl(Number(id)), '_blank', 'noopener'); }}
        />
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/admin/_demo/documents" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] hover:bg-surface-2">
          UI namuna (demo) <ArrowRight size={14} />
        </Link>
        <Link to="/admin/storage" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] hover:bg-surface-2">
          Fayl saqlash (Storage) <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
