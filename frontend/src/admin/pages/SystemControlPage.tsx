/**
 * SystemControlPage.tsx — canonical /admin/system-control.
 * Wires Codex's SystemControlCenter (6 tabs) to the REAL CTRL-001 backend:
 *   /api/system-control -> Supabase t2_system_control_v1 (+ audited commands).
 * No /api/gas, no Drive/Sheets. No demo data on this production route.
 * EGALIK: Claude (integration lane).
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ServerCog, Info, ArrowRight } from 'lucide-react';
import { SystemControlCenter } from '../system-control/SystemControlCenter';
import type { SystemControlData } from '../../components/system-control';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { KompaniyaKerak } from '../../umumiy/kontekst/KompaniyaKerak';
import { useSystemControl, useGlobalSystemControl, useControlCommands } from '../../api/t2-control';

const EMPTY: SystemControlData = {
  health: [], capabilities: [], integrations: [], jobs: [], incidents: [], auditEvents: [],
  version: { environment: 'production' },
};

export default function SystemControlPage() {
  const { joriy, globalRejim } = useKompaniya();
  // T2-COMPANY-CONTROL-CLOSEOUT split: superadmin in Global rejim (no
  // company selected) sees the platform-wide view, gated server-side by
  // t2_system_control_global_v1 — never the company-scoped RPC.
  const qCompany = useSystemControl(joriy?.id);
  const qGlobal = useGlobalSystemControl(globalRejim && !joriy?.id);
  const q = globalRejim && !joriy?.id ? qGlobal : qCompany;
  const cmd = useControlCommands(joriy?.id);

  const data: SystemControlData = useMemo(() => {
    if (!q.data) return EMPTY;
    const d = q.data;
    return {
      health: d.health ?? [], capabilities: d.capabilities ?? [], integrations: d.integrations ?? [],
      jobs: d.jobs ?? [], incidents: d.incidents ?? [], auditEvents: d.auditEvents ?? [],
      version: d.version ?? { environment: 'production' },
    };
  }, [q.data]);

  if (!joriy?.id && !globalRejim) {
    return (
      <div className="bg-bg min-h-screen text-text">
        <h1 className="text-2xl font-bold flex items-center gap-2 px-6 pt-6"><ServerCog className="text-accent" /> Tizim boshqaruv markazi</h1>
        <KompaniyaKerak nima="Tizim boshqaruv markazi" />
      </div>
    );
  }

  if (!joriy?.id && globalRejim && q.isError && (q.error as any)?.code === 'AUTHORIZATION_DENIED') {
    return (
      <div className="bg-bg min-h-screen text-text">
        <h1 className="text-2xl font-bold flex items-center gap-2 px-6 pt-6"><ServerCog className="text-accent" /> Tizim boshqaruv markazi</h1>
        <div className="mx-6 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100 max-w-lg">
          Platforma darajasidagi boshqaruv markaziga ruxsatingiz yo‘q. Bu — platforma-darajasidagi
          "kill switch"; kompaniya bossi buni boshqara olmaydi.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg min-h-screen text-text">
      {q.isLoading && <div className="px-6 py-4 text-sm text-text-dim">Nazorat ma'lumotlari yuklanmoqda…</div>}
      {q.isError && (
        <div className="mx-6 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100">
          Nazorat ma'lumotini o'qib bo'lmadi: {(q.error as any)?.code || 'xato'}.
        </div>
      )}

      <SystemControlCenter
        data={data}
        demo={false}
        onToggle={(o) => {
          const cap = data.capabilities.find((c) => c.id === o.capabilityId);
          cmd.overrideSet.mutate({
            kod: o.capabilityId, scope: o.scope,
            scope_id: o.scope === 'company' ? (joriy?.id ?? null) : o.scope === 'project' ? Number(o.projectId) : null,
            holat: o.state === 'on' ? 'on' : 'off',
            sabab: 'Control Center', expected_version: cap ? Number(cap.version) : null,
          });
        }}
        onKill={(cap) => cmd.killswitch.mutate({ kod: cap.id, on: cap.enabled !== 'off', sabab: 'Control Center kill-switch' })}
        onPause={(job) => cmd.job.mutate({ job_kod: job.id, job_action: 'pause' })}
        onResume={(job) => cmd.job.mutate({ job_kod: job.id, job_action: 'resume' })}
        onRetry={(t) => { if (t.type === 'job') cmd.job.mutate({ job_kod: t.id, job_action: 'retry' }); }}
      />

      <div className="mx-6 my-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100 flex items-start gap-2 max-w-3xl">
        <Info size={16} className="mt-0.5 shrink-0" />
        Health semantikasi: Supabase DOWN = core degraded · R2 DOWN = kanonik fayl tizimi degraded ·
        Drive/Sheets DOWN = faqat replika degraded, core UP · GAS DOWN = faqat legacy/replica ko'prik degraded.
      </div>
      <Link to="/admin/_demo/system-control"
        className="mx-6 mb-8 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] hover:bg-surface-2">
        UI namuna (demo data) <ArrowRight size={14} />
      </Link>
    </div>
  );
}
