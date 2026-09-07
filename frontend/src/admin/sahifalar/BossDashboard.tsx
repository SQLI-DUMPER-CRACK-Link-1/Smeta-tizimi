/**
 * BossDashboard.tsx — BOSS PANEL P0 (canonical).
 * EGALIK: Claude (dashboard read-model lane).
 *
 * Rahbar/direktor bitta ekranda kompaniya holatini ko'radi. Ma'lumot FAQAT
 * Supabase kanonik read model'dan (t2_boss_dashboard_v1). Drive/Sheets/GAS
 * chaqiruvi YO'Q. Kanonik modeli yo'q modullar halol "ulanmagan" holatini
 * ko'rsatadi — soxta raqam YO'Q.
 */
import {
  RefreshCw, TrendingUp, Wallet, FileText, FileSignature, Boxes, FolderKanban,
  AlertTriangle, HardDrive, Layers,
} from 'lucide-react';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { KompaniyaKerak } from '../../umumiy/kontekst/KompaniyaKerak';
import { useBossDashboard } from '../../api/t2-boss';

const nf = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 });
const som = (n: number | null | undefined) => (n == null ? '—' : nf.format(Math.round(n)) + ' so‘m');

const SEV: Record<string, string> = {
  critical: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  high: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  medium: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  low: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
};
const SIGNAL_ENTITY_LABEL: Record<string, string> = {
  loyiha: 'Loyiha',
  obyekt: 'Obyekt',
  qator: 'Smeta qatori',
  hujjat: 'Hujjat',
  shartnoma: 'Shartnoma',
  fakt: 'Fakt',
};
const signalEntityLabel = (value: string | null | undefined) => SIGNAL_ENTITY_LABEL[String(value ?? '').toLowerCase()] ?? 'Tegishli bo‘lim';

function Kpi({ Icon, nom, qiymat, izoh, ulangan = true }: {
  Icon: typeof Wallet; nom: string; qiymat: string; izoh?: string; ulangan?: boolean;
}) {
  return (
    <div className="karta p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-accent" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-text-dim">{nom}</div>
        {ulangan
          ? <div className="text-lg font-bold text-text truncate">{qiymat}</div>
          : <div className="text-[12px] text-text-mute italic">Ma’lumot modeli hali ulanmagan</div>}
        {izoh && ulangan && <div className="text-[10px] text-text-mute mt-0.5">{izoh}</div>}
      </div>
    </div>
  );
}

export default function BossDashboard() {
  const { joriy } = useKompaniya();
  const q = useBossDashboard(joriy?.id);

  if (!joriy?.id) return <KompaniyaKerak nima="Rahbar paneli" />;

  return (
    <div className="p-6 bg-bg min-h-screen text-text overflow-y-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="text-accent" /> Rahbar paneli
          </h1>
          <p className="text-sm text-text-dim mt-1">
            {joriy?.nom ? joriy.nom + ' — ' : ''}kanonik ma’lumot (Supabase). Drive/Sheets/GAS bog‘liqligi yo‘q.
            {q.data && <span className="text-text-mute"> · {new Date(q.data.generated_at).toLocaleString('uz-UZ')}</span>}
          </p>
        </div>
        <button onClick={() => q.refetch()} className="bg-surface border border-border hover:bg-surface-2 px-4 py-2 flex items-center gap-2 rounded-lg text-sm font-medium">
          <RefreshCw size={14} className={q.isFetching ? 'animate-spin text-accent' : ''} /> Yangilash
        </button>
      </div>

      {q.isLoading && <div className="text-text-dim text-sm">Yuklanmoqda…</div>}
      {q.isError && (
        <div className="rounded-lg bg-rose-500/8 border border-rose-500/25 px-4 py-3 text-[13px] text-rose-200 flex items-center gap-2">
          <AlertTriangle size={16} /> Rahbar paneli yuklanmadi. Birozdan so‘ng qayta urinib ko‘ring.
        </div>
      )}

      {q.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5">
            <Kpi Icon={FolderKanban} nom="Faol loyihalar" qiymat={String(q.data.kompaniya.loyiha_soni)} />
            <Kpi Icon={Boxes} nom="Faol obyektlar" qiymat={String(q.data.kompaniya.obyekt_soni)} />
            <Kpi Icon={FileSignature} nom="Shartnomalar" qiymat={som(q.data.shartnoma.jami_summa)} izoh={q.data.shartnoma.soni + ' ta, ' + q.data.shartnoma.faol + ' faol'} />
            <Kpi Icon={FileText} nom="F2 / bajarilgan ish" qiymat={som(q.data.f2.jami)} izoh={q.data.f2.soni + ' akt · ' + q.data.f2.tasdiqlangan + ' tasdiqlangan'} />
            <Kpi Icon={Wallet} nom="To‘langan" qiymat={som(q.data.moliya.jami_tolangan)} ulangan={q.data.moliya.ulangan} />
            <Kpi Icon={Wallet} nom="Debitorlik (mijoz qarzi)" qiymat={som(q.data.moliya.jami_debitor)} ulangan={q.data.moliya.ulangan} />
            <Kpi Icon={Wallet} nom="Xarajat" qiymat={som(q.data.moliya.jami_xarajat)} ulangan={q.data.moliya.ulangan} />
            <Kpi Icon={TrendingUp} nom="Sof natija" qiymat={som(q.data.moliya.sof_natija)} ulangan={q.data.moliya.ulangan} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <section className="karta p-4 lg:col-span-2">
              <h2 className="font-semibold flex items-center gap-2 mb-3"><FolderKanban size={16} className="text-accent" /> Loyihalar</h2>
              {q.data.loyihalar.length === 0 && <div className="text-[12px] text-text-dim">Loyiha yo‘q.</div>}
              <table className="w-full text-[13px]">
                <thead><tr className="text-text-dim text-left text-[11px]">
                  <th className="py-1">Loyiha</th><th>Holat</th><th className="text-right">Obyekt</th>
                  <th className="text-right">Byudjet</th><th className="text-right">Smeta jami</th>
                </tr></thead>
                <tbody>
                  {q.data.loyihalar.map((l) => (
                    <tr key={l.loyiha_id} className="border-t border-border/60">
                      <td className="py-1.5 font-medium truncate max-w-[220px]">{l.nom}</td>
                      <td className="text-text-dim">{l.holat}</td>
                      <td className="text-right tabular-nums">{l.obyekt_soni}</td>
                      <td className="text-right tabular-nums">{l.byudjet == null ? '—' : nf.format(l.byudjet)}</td>
                      <td className="text-right tabular-nums">{nf.format(Math.round(l.smeta_jami))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="karta p-4">
              <h2 className="font-semibold flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-400" /> Signallar / risklar
                <span className="ml-auto text-[11px] text-text-dim">{q.data.signal.ochiq_soni} ochiq · {q.data.signal.kritik_soni} kritik</span>
              </h2>
              <ul className="space-y-2 max-h-[420px] overflow-y-auto">
                {q.data.signal.royxat.map((s) => (
                  <li key={s.id} className={'rounded-md border px-2.5 py-1.5 text-[12px] ' + (SEV[s.severity || 'low'] || SEV.low)}>
                    <div className="font-medium truncate">{s.title || s.signal_type}</div>
                    <div className="text-[10px] opacity-70">{signalEntityLabel(s.entity_type)}{s.due_at ? ' · muddat ' + new Date(s.due_at).toLocaleDateString('uz-UZ') : ''}</div>
                  </li>
                ))}
                {q.data.signal.royxat.length === 0 && <li className="text-[12px] text-text-dim">Ochiq signal yo‘q.</li>}
              </ul>
            </section>

            <section className="karta p-4">
              <h2 className="font-semibold flex items-center gap-2 mb-3"><HardDrive size={16} className="text-accent" /> Hujjat / storage holati</h2>
              {q.data.storage.ulangan ? (
                <dl className="text-[13px] space-y-1.5">
                  <div className="flex justify-between"><dt className="text-text-dim">Hujjatlar</dt><dd>{q.data.storage.hujjat_soni}</dd></div>
                  <div className="flex justify-between"><dt className="text-text-dim">Kanonik (R2) saqlangan</dt><dd>{q.data.storage.canonical_stored}</dd></div>
                  <div className="flex justify-between"><dt className="text-text-dim">Drive replika xato</dt><dd className={q.data.storage.drive_replica_failed ? 'text-rose-300' : ''}>{q.data.storage.drive_replica_failed}</dd></div>
                </dl>
              ) : <div className="text-[12px] text-text-mute italic">{q.data.storage.izoh || 'Ma’lumot modeli hali ulanmagan'}</div>}
            </section>

            <section className="karta p-4 lg:col-span-2">
              <h2 className="font-semibold flex items-center gap-2 mb-3"><Layers size={16} className="text-text-dim" /> Hali kanonik modelga ulanmagan modullar</h2>
              <div className="flex flex-wrap gap-2">
                {q.data.ulanmagan_modullar.map((m) => (
                  <span key={m} className="px-2 py-1 rounded-md border border-border text-[11px] text-text-mute">{m}</span>
                ))}
              </div>
              <p className="text-[10px] text-text-mute mt-2">Bu bo‘limlar uchun soxta raqam ko‘rsatilmaydi — kanonik model tayyor bo‘lgach ulanadi (roadmap: docs/architecture/CONSTRUCTION_OS_MASTER_ROADMAP.md).</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
