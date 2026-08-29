/**
 * TestAosr.tsx — АОСР (yashirin ishlar akti), 2026-08-27
 * ═══════════════════════════════════════════════════════════════════
 * Ko'chirildi: `Smeta tizimi/45_Hujjatlar.js` (akt qismi).
 *
 * Chap panel: bajarilgan (FAKT>0) ishlar — aktga bog'langanmi, "yashirin
 * ish" (akt talab qiladigan) belgisi bilan. Belgilab, o'ngdagi aktga
 * ulash mumkin.
 * O'ng panel: obyektning akt reestri + yangi akt yaratish formasi.
 */
import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Link2, Unlink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  sbAosrReestrOl, sbAosrCoverageOl, sbAosrYoz, sbAosrBekor, sbAosrBogSaqla,
  type AosrReestr, type AosrCoverage,
} from '../api/t2-aosr';
import { sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt } from '../api/supabase';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

export default function TestAosr() {
  const { joriy } = useKompaniya();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [obyektId, setObyektId] = useState<number | null>(null);
  const [reestr, setReestr] = useState<AosrReestr[]>([]);
  const [coverage, setCoverage] = useState<AosrCoverage[]>([]);
  const [belgilangan, setBelgilangan] = useState<Set<number>>(new Set());
  const [tanlanganAkt, setTanlanganAkt] = useState<number | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  const [yangiRaqam, setYangiRaqam] = useState('');
  const [yangiIsh, setYangiIsh] = useState('');
  const [yangiBoshlanish, setYangiBoshlanish] = useState('');
  const [yangiTugash, setYangiTugash] = useState('');
  const [modalOchiq, setModalOchiq] = useState(false);

  useEffect(() => {
    if (!joriy?.id) { setObyektlar([]); return; }
    sbT2ObyektlarOlKomp(joriy.id).then((r) => {
      if (r.ok && r.qatorlar) {
        setObyektlar(r.qatorlar);
        if (r.qatorlar.length > 0 && !obyektId) setObyektId(r.qatorlar[0].id);
      }
    });
  }, [joriy]);

  const yukla = () => {
    if (!obyektId) return;
    setYuklanmoqda(true);
    Promise.all([sbAosrReestrOl(obyektId), sbAosrCoverageOl(obyektId)]).then(([r, c]) => {
      setYuklanmoqda(false);
      setReestr(r.ok ? (r.qatorlar || []) : []);
      setCoverage(c.ok ? (c.qatorlar || []) : []);
      setBelgilangan(new Set());
    });
  };

  useEffect(() => { yukla(); }, [obyektId]);

  const toggleBelgi = (qatorId: number) => {
    setBelgilangan((prev) => {
      const next = new Set(prev);
      next.has(qatorId) ? next.delete(qatorId) : next.add(qatorId);
      return next;
    });
  };

  const yangiAktYarat = async () => {
    if (!obyektId || !yangiIsh.trim()) {
      toast('Ish nomini kiriting', 'warn');
      return;
    }
    const r = await sbAosrYoz({
      obyektId, raqam: yangiRaqam || undefined, ishNomi: yangiIsh,
      boshlanishSana: yangiBoshlanish || undefined, tugashSana: yangiTugash || undefined,
      operationId: yangiOperationId(),
    });
    if (r.ok) {
      toast('✓ Akt yaratildi', 'ok');
      setModalOchiq(false);
      setYangiRaqam(''); setYangiIsh(''); setYangiBoshlanish(''); setYangiTugash('');
      yukla();
    } else {
      toast(r.error || 'Xato', 'danger');
    }
  };

  const ulash = async () => {
    if (!tanlanganAkt || belgilangan.size === 0) {
      toast('Akt va kamida bitta ish tanlang', 'warn');
      return;
    }
    const r = await sbAosrBogSaqla([tanlanganAkt], Array.from(belgilangan));
    if (r.ok) {
      toast('✓ ' + (r.yangi_boglanish ?? 0) + ' ta ish ulandi', 'ok');
      yukla();
    } else {
      toast(r.error || 'Xato', 'danger');
    }
  };

  const bekorQil = async (id: number, versiya: number) => {
    const r = await sbAosrBekor(id, versiya);
    if (r.ok) { toast('Akt bekor qilindi', 'ok'); yukla(); }
    else toast(r.error || 'Xato', 'danger');
  };

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <ClipboardList /> АОСР (Яширин ишлар акти)
        </h1>
        <select
          className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white"
          value={obyektId || ''}
          onChange={(e) => setObyektId(Number(e.target.value))}
        >
          {obyektlar.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>

      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CHAP: coverage */}
          <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-3 bg-zinc-800 flex items-center justify-between">
              <h2 className="font-bold">Bajarilgan ishlar</h2>
              <button onClick={ulash}
                className="bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 disabled:opacity-40"
                disabled={!tanlanganAkt || belgilangan.size === 0}>
                <Link2 size={14} /> Tanlangan aktga ulash ({belgilangan.size})
              </button>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-zinc-800">
              {coverage.length === 0 && (
                <div className="p-4 text-center text-zinc-500 text-sm">Bajarilgan ish topilmadi</div>
              )}
              {coverage.map((c) => (
                <div key={c.qator_id}
                  className={"p-3 flex items-center gap-3 " + (c.yashirin && !c.akt_bor ? 'bg-red-900/10' : '')}>
                  <input type="checkbox" checked={belgilangan.has(c.qator_id)}
                    onChange={() => toggleBelgi(c.qator_id)} className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-200 truncate">{c.nom}</div>
                    <div className="text-xs text-zinc-500">{c.kod} · {c.fakt_hajm} {c.birlik}</div>
                  </div>
                  {c.yashirin && (
                    <span title="Yashirin ish — akt talab qilinadi"
                      className="text-amber-400"><AlertTriangle size={16} /></span>
                  )}
                  {c.akt_bor ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Akt bor
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">Aktsiz</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* O'NG: reestr */}
          <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-3 bg-zinc-800 flex items-center justify-between">
              <h2 className="font-bold">Akt reestri</h2>
              <button onClick={() => setModalOchiq(true)}
                className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1">
                <Plus size={14} /> Yangi akt
              </button>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-zinc-800">
              {reestr.length === 0 && (
                <div className="p-4 text-center text-zinc-500 text-sm">Hech qanday akt yo'q</div>
              )}
              {reestr.map((a) => (
                <div key={a.id}
                  onClick={() => setTanlanganAkt(a.id === tanlanganAkt ? null : a.id)}
                  className={"p-3 cursor-pointer " + (tanlanganAkt === a.id ? 'bg-amber-900/20 border-l-4 border-amber-500' : 'hover:bg-zinc-800/50')}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">{a.raqam || '(raqamsiz)'} — {a.ish_nomi || '-'}</div>
                      <div className="text-xs text-zinc-500">
                        {a.boshlanish_sana || '?'} — {a.tugash_sana || '?'} · {a.boglangan_ish_soni} ta ish ulangan
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); bekorQil(a.id, a.versiya); }}
                      className="text-zinc-500 hover:text-red-400 p-1" title="Bekor qilish">
                      <Unlink size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalOchiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-lg shadow-2xl p-5 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-amber-400">Yangi АОСР</h3>
            <input value={yangiRaqam} onChange={(e) => setYangiRaqam(e.target.value)}
              placeholder="Akt raqami (ixtiyoriy)"
              className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />
            <input value={yangiIsh} onChange={(e) => setYangiIsh(e.target.value)}
              placeholder="Ish nomi *"
              className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />
            <div className="flex gap-2">
              <input type="date" value={yangiBoshlanish} onChange={(e) => setYangiBoshlanish(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm flex-1" />
              <input type="date" value={yangiTugash} onChange={(e) => setYangiTugash(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm flex-1" />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setModalOchiq(false)}
                className="px-4 py-1.5 rounded border border-zinc-700 text-zinc-400 text-sm">Bekor qilish</button>
              <button onClick={yangiAktYarat}
                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium">Saqlash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
