import { useEffect, useMemo, useState } from 'react';
import { Search, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../../api/supabase';
import { t2NakopitelniyOl, type NakopitelniyQator, type NakopitelniyDavr, type NakopitelniyJami } from '../../api/t2-nakopitelniy';
import { nakopitelniyVedomostExportXlsx } from '../../lib/nakopitelniy-vedomost-export';
import { downloadBlob } from '../../lib/construction-document-control/export/download-helper';
import { FmtN } from '../../lib/format';

/**
 * T2-PTO-OWNER-CRITICAL-CLOSURE P0-3: the real, line-by-line PTO nakopitelniy
 * vedomost -- ISH / SMETA / FAKT / PREV F2 / CURRENT F2 / CUMULATIVE F2 /
 * REMAINING, off t2_nakopitelniy_v1 (canonical, extended with Fakt in
 * 20261011100000_t2_nakopitelniy_fakt_v1.sql). Replaces the one-line KPI
 * summary that used to stand in for this. Approved-only cumulative: a draft
 * F2 never appears in oldingi/joriy/jami -- only t2_akt.holat='tasdiqlangan'
 * rows are summed there (t2_nakopitelniy_v1's own join condition).
 */

const PAGE_SIZE = 200;

function jamiHajmSafe(q: NakopitelniyQator) { return q.smeta_hajm ?? 0; }

function Sessiya({ companyId }: { companyId: number }) {
  const [objects, setObjects] = useState<T2Obyekt[]>([]);
  const [objectId, setObjectId] = useState('');
  const [davrlar, setDavrlar] = useState<NakopitelniyDavr[]>([]);
  const [davr, setDavr] = useState('');
  const [qatorlar, setQatorlar] = useState<NakopitelniyQator[]>([]);
  const [jami, setJami] = useState<NakopitelniyJami | null>(null);
  const [obyektNom, setObyektNom] = useState('');
  const [qidiruv, setQidiruv] = useState('');
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then(r => { if (active && r.ok) setObjects((r.qatorlar || []) as T2Obyekt[]); });
    return () => { active = false; };
  }, [companyId]);

  const yukla = async (objId: number, tanlanganDavr: string) => {
    setBusy(true); setXato('');
    try {
      const r = await t2NakopitelniyOl(objId, tanlanganDavr || null);
      if (!r.ok) { setXato(r.xato || r.code || 'Yuklanmadi'); setQatorlar([]); return; }
      setQatorlar(r.qatorlar); setJami(r.jami); setDavrlar(r.davrlar); setDavr(r.davr); setObyektNom(r.obyekt.nom);
      setPage(0);
    } catch (e) { setXato(e instanceof Error ? e.message : 'Yuklanmadi'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!objectId) { setQatorlar([]); setDavrlar([]); return; }
    void yukla(Number(objectId), '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId]);

  const filtr = qidiruv.trim().toLowerCase();
  const korinadigan = useMemo(() => {
    if (!filtr) return qatorlar;
    const keep = new Set<number>();
    for (const q of qatorlar) {
      if (q.tur === 'rz') continue;
      if ((q.kod || '').toLowerCase().includes(filtr) || (q.nom || '').toLowerCase().includes(filtr)) keep.add(q.qator_id);
    }
    return qatorlar.filter(q => q.tur === 'rz' || keep.has(q.qator_id));
  }, [qatorlar, filtr]);

  // Drop RZ section headers with no visible children left after filtering.
  const gorunumRows = useMemo(() => {
    const out: NakopitelniyQator[] = [];
    for (let i = 0; i < korinadigan.length; i++) {
      const q = korinadigan[i];
      if (q.tur !== 'rz') { out.push(q); continue; }
      const next = korinadigan[i + 1];
      if (next && next.tur !== 'rz') out.push(q);
    }
    return out;
  }, [korinadigan]);

  const sahifa = gorunumRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const sahifaSoni = Math.max(1, Math.ceil(gorunumRows.length / PAGE_SIZE));

  const eksportQil = async () => {
    const bytes = await nakopitelniyVedomostExportXlsx(qatorlar, { obyektNom, davr });
    downloadBlob(new Uint8Array(bytes), `nakopitelniy_${obyektNom}_${davr}.xlsx`.replace(/\s+/g, '_'));
  };

  return (
    <div className="space-y-3 p-1">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">Obyekt
          <select aria-label="Obyekt" className="ml-2 border rounded px-2 py-1"
            value={objectId} onChange={e => setObjectId(e.target.value)}>
            <option value="">Tanlang</option>
            {objects.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </label>
        {!!davrlar.length && (
          <label className="block text-sm">Davr
            <select aria-label="Davr" className="ml-2 border rounded px-2 py-1"
              value={davr} onChange={e => void yukla(Number(objectId), e.target.value)}>
              {davrlar.map(d => <option key={d.oy} value={d.oy}>{d.oy}{d.certified ? '' : ' (qoralama)'}</option>)}
            </select>
          </label>
        )}
        {qatorlar.length > 0 && (
          <label className="block text-sm flex-1 min-w-[220px]">
            <span className="sr-only">Qidirish</span>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-mute" />
              <input aria-label="Kod yoki nom bo'yicha qidirish" className="w-full border rounded pl-7 pr-2 py-1"
                placeholder="Kod yoki nom bo'yicha qidirish…" value={qidiruv}
                onChange={e => { setQidiruv(e.target.value); setPage(0); }} />
            </div>
          </label>
        )}
        <button type="button" disabled={!objectId || busy} onClick={() => void yukla(Number(objectId), davr)}
          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm hover:border-accent/50 disabled:opacity-50">
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Yangilash
        </button>
        {qatorlar.length > 0 && (
          <button type="button" onClick={() => void eksportQil()}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-accent text-white text-sm hover:opacity-90">
            <Download size={14} /> XLSX eksport
          </button>
        )}
      </div>

      {busy && <p role="status">Yuklanmoqda…</p>}
      {xato && <p role="alert" className="text-danger flex items-center gap-1.5"><AlertTriangle size={14} /> {xato}</p>}

      {jami && (
        <div className="karta p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <div><span className="text-text-mute block">Smeta jami</span><FmtN val={jami.smeta_summa} /></div>
          <div><span className="text-text-mute block">Fakt jami</span><FmtN val={jami.fakt_summa} /></div>
          <div><span className="text-text-mute block">Jami tasdiqlangan F2</span><FmtN val={jami.jami_tasdiqlangan_summa} /></div>
          <div><span className="text-text-mute block">Faktdan F2ga mumkin</span>
            <span className={jami.f2_mumkin_summa < 0 ? 'text-danger font-semibold' : ''}><FmtN val={jami.f2_mumkin_summa} /></span>
          </div>
        </div>
      )}

      {qatorlar.length > 0 && (
        <>
          <div className="karta overflow-auto max-h-[70vh]">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-2">
                <tr className="text-text-mute text-center">
                  <th rowSpan={2} className="text-left px-2 py-1.5 sticky left-0 bg-surface-2 z-20 min-w-[160px]">Ish</th>
                  <th rowSpan={2} className="px-2 py-1.5">Birlik</th>
                  <th colSpan={3} className="px-2 py-1 border-l border-border">SMETA</th>
                  <th rowSpan={2} className="px-2 py-1.5 border-l border-border">FAKT<br />hajm</th>
                  <th colSpan={2} className="px-2 py-1 border-l border-border">OLDINGI F2</th>
                  <th colSpan={3} className="px-2 py-1 border-l border-border">JORIY F2</th>
                  <th colSpan={2} className="px-2 py-1 border-l border-border">JAMI (tasdiqlangan) F2</th>
                  <th colSpan={2} className="px-2 py-1 border-l border-border">QOLDIQ</th>
                </tr>
                <tr className="text-text-mute text-right">
                  <th className="px-2 py-1 border-l border-border">Hajm</th><th className="px-2 py-1">Narx</th><th className="px-2 py-1">Summa</th>
                  <th className="px-2 py-1 border-l border-border">Hajm</th><th className="px-2 py-1">Summa</th>
                  <th className="px-2 py-1 border-l border-border">Hajm</th><th className="px-2 py-1">Narx</th><th className="px-2 py-1">Summa</th>
                  <th className="px-2 py-1 border-l border-border">Hajm</th><th className="px-2 py-1">Summa</th>
                  <th className="px-2 py-1 border-l border-border">Smeta</th><th className="px-2 py-1">F2 mumkin</th>
                </tr>
              </thead>
              <tbody>
                {sahifa.map(q => q.tur === 'rz' ? (
                  <tr key={q.qator_id} className="bg-surface-2/70">
                    <td colSpan={14} className="px-2 py-1.5 font-semibold text-text sticky left-0 bg-surface-2/70">{q.nom}</td>
                  </tr>
                ) : (
                  <tr key={q.qator_id} className="border-t border-border/60 hover:bg-surface-2/40 text-right">
                    <td className="text-left px-2 py-1 sticky left-0 bg-surface" title={q.kod || ''}>{q.kod ? q.kod + ' ' : ''}{q.nom}</td>
                    <td className="text-center px-2 py-1">{q.birlik || '—'}</td>
                    <td className="px-2 py-1 border-l border-border tabular-nums"><FmtN val={jamiHajmSafe(q)} /></td>
                    <td className="px-2 py-1 tabular-nums">{q.smeta_narx == null ? '—' : <FmtN val={q.smeta_narx} />}</td>
                    <td className="px-2 py-1 tabular-nums"><FmtN val={q.smeta_summa ?? 0} /></td>
                    <td className="px-2 py-1 border-l border-border tabular-nums font-medium">{q.fakt_hajm ? <FmtN val={q.fakt_hajm} /> : '—'}</td>
                    <td className="px-2 py-1 border-l border-border tabular-nums">{q.oldingi_hajm ? <FmtN val={q.oldingi_hajm} /> : '—'}</td>
                    <td className="px-2 py-1 tabular-nums">{q.oldingi_summa ? <FmtN val={q.oldingi_summa} /> : '—'}</td>
                    <td className="px-2 py-1 border-l border-border tabular-nums">{q.joriy_hajm ? <FmtN val={q.joriy_hajm} /> : '—'}</td>
                    <td className="px-2 py-1 tabular-nums">{q.joriy_hajm ? <FmtN val={Math.round((q.joriy_summa / q.joriy_hajm) * 100) / 100} /> : '—'}</td>
                    <td className="px-2 py-1 tabular-nums">{q.joriy_summa ? <FmtN val={q.joriy_summa} /> : '—'}</td>
                    <td className="px-2 py-1 border-l border-border tabular-nums font-medium">{q.jami_hajm ? <FmtN val={q.jami_hajm} /> : '—'}</td>
                    <td className="px-2 py-1 tabular-nums">{q.jami_summa ? <FmtN val={q.jami_summa} /> : '—'}</td>
                    <td className="px-2 py-1 border-l border-border tabular-nums">{q.qoldiq_hajm ? <FmtN val={q.qoldiq_hajm} /> : '—'}</td>
                    <td className={'px-2 py-1 tabular-nums font-medium ' + (q.f2_mumkin_hajm < 0 ? 'text-danger' : '')}><FmtN val={q.f2_mumkin_hajm} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sahifaSoni > 1 && (
            <div className="flex items-center gap-2 text-[12px]">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">Oldingi</button>
              <span>{page + 1} / {sahifaSoni}</span>
              <button disabled={page + 1 >= sahifaSoni} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Keyingi</button>
            </div>
          )}
        </>
      )}
      {objectId && !busy && !xato && !qatorlar.length && (
        <p className="text-text-mute text-sm">Bu obyektda smeta qatori topilmadi.</p>
      )}
    </div>
  );
}

export default function NakopitelniyVedomost() {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <Sessiya key={joriy.id} companyId={joriy.id} />;
}
