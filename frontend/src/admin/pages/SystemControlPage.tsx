/**
 * SystemControlPage.tsx — canonical /admin/system-control.
 * Codex delivered the full SystemControlCenter UI (6 tabs). The CTRL-001
 * capability-registry backend is DEFERRED-P1 (contract in
 * docs/architecture/SYSTEM_CONTROL_CENTER_V1.md, no migration yet), so the
 * real data feed is not available. This page shows the real health it CAN
 * derive today and routes to the demo for the full UI. No fake production data.
 * EGALIK: Claude (integration lane).
 */
import { useEffect, useState } from 'react';
import { ServerCog, Info, ArrowRight, CheckCircle2, CircleX } from 'lucide-react';
import { Link } from 'react-router-dom';

type Probe = { nom: string; holat: 'ok' | 'degraded' | 'unknown'; izoh: string };

export default function SystemControlPage() {
  const [probes, setProbes] = useState<Probe[]>([
    { nom: 'Supabase (biznes haqiqat)', holat: 'unknown', izoh: 'tekshirilmoqda…' },
    { nom: 'Cloudflare API', holat: 'unknown', izoh: 'tekshirilmoqda…' },
  ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Probe[] = [];
      try {
        const r = await fetch('/api/sessiya');
        out.push({ nom: 'Cloudflare API', holat: r.status < 500 ? 'ok' : 'degraded', izoh: 'HTTP ' + r.status });
      } catch { out.push({ nom: 'Cloudflare API', holat: 'degraded', izoh: 'aloqa yo‘q' }); }
      try {
        const r = await fetch('/api/sb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jadval: 't2_kompaniya', limit: 1 }) });
        const j = await r.json().catch(() => null);
        out.push({ nom: 'Supabase (biznes haqiqat)', holat: j && j.ok ? 'ok' : 'degraded', izoh: j && j.ok ? 'o‘qish ishlaydi' : 'o‘qish xato' });
      } catch { out.push({ nom: 'Supabase (biznes haqiqat)', holat: 'degraded', izoh: 'aloqa yo‘q' }); }
      if (alive) setProbes(out);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      <h1 className="text-2xl font-bold flex items-center gap-2"><ServerCog className="text-accent" /> Tizim boshqaruv markazi</h1>
      <p className="text-sm text-text-dim mt-1 max-w-3xl">
        Markaziy operatsion nazorat. To‘liq capability registry / kill-switch / job
        boshqaruvi CTRL-001 backend’i ulangach ishlaydi (kontrakt:
        <code> docs/architecture/SYSTEM_CONTROL_CENTER_V1.md</code>).
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 max-w-2xl">
        {probes.map((p) => (
          <div key={p.nom} className="karta p-4 flex items-center gap-3">
            {p.holat === 'ok' ? <CheckCircle2 className="text-emerald-400" size={20} />
              : p.holat === 'degraded' ? <CircleX className="text-rose-400" size={20} />
              : <span className="w-5 h-5 rounded-full border-2 border-text-mute animate-pulse" />}
            <div>
              <div className="text-[13px] font-medium">{p.nom}</div>
              <div className="text-[11px] text-text-dim">{p.izoh}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100 flex items-start gap-2 max-w-2xl">
        <Info size={16} className="mt-0.5 shrink-0" />
        Health semantikasi: Supabase DOWN = core degraded · R2 DOWN = kanonik fayl
        tizimi degraded · Drive/Sheets DOWN = faqat replika degraded, core UP ·
        GAS DOWN = faqat legacy/replica ko‘prik degraded. To‘liq panel: demo.
      </div>

      <Link to="/admin/_demo/system-control"
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] hover:bg-surface-2">
        To‘liq UI (demo data) <ArrowRight size={14} />
      </Link>
    </div>
  );
}
