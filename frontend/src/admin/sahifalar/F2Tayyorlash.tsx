import { useMemo, useState, useEffect } from 'react';
import { useObyektlar, useHolat, useF2HujjatYarat, useAiSmartF2 } from '../../api/hooks';
import { Skelet } from '../../umumiy/ui/Sahifa';
import {FmtN, pulQisqa } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';
import { FileOutput, ExternalLink, ChevronDown, ChevronRight, Search, Building2, Calendar, FileText, CheckCircle, Database, Wand2, Loader2, Sparkles } from 'lucide-react';
import type { TreeNode } from '../../api/types';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { motion, AnimatePresence } from 'framer-motion';

type Barg = {
  kalit: string; varaq: string; row: number;
  rzNom: string; blNom: string; blKod: string; blBir: string;
  type: string; kod: string; nom: string; bir: string;
  narx: number; fakt: number; f2ol: number; f2mum: number;
};

const TUR_RANG: Record<string, string> = { rs: 'text-blue-400', mat: 'text-yellow-400', ob: 'text-cyan-400', bl: 'text-purple-400' };
const TUR_BELGI: Record<string, string> = { rs: '🔹', mat: '🧱', ob: '⚙️', bl: '🔧' };

function yassila(nodes: TreeNode[] = []): Barg[] {
  const out: Barg[] = [];
  const yur = (ns: TreeNode[], rzNom: string, blNom: string, blKod: string, blBir: string) => {
    (ns ?? []).forEach((n: any) => {
      if (n.type === 'rz') { yur(n.children ?? [], n.nom, '', '', ''); return; }
      if (n.type === 'bl') { yur(n.children ?? [], rzNom, n.nom, n.kod ?? '', n.birlik ?? ''); return; }
      if (n.type === 'rs' || n.type === 'mat' || n.type === 'ob') {
        out.push({
          kalit: `${n.varaq}#${n.row}`, varaq: n.varaq, row: n.row, rzNom, blNom, blKod, blBir,
          type: n.type, kod: n.kod ?? '', nom: n.nom ?? '', bir: n.birlik ?? '',
          narx: n.narx ?? 0, fakt: n.fakt ?? 0, f2ol: n.f2ol ?? 0, f2mum: n.f2mum ?? 0,
        });
      }
      if (n.children?.length) yur(n.children, rzNom, blNom, blKod, blBir);
    });
  };
  yur(nodes, '', '', '', '');
  return out;
}

export function F2Tayyorlash() {
  const obyektlar = useObyektlar();
  const [obyekt, setObyekt] = useState('');
  const [oyNom, setOyNom] = useState(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  });
  const holat = useHolat(obyekt);
  const yarat = useF2HujjatYarat();

  const [q, setQ] = useState('');
  const [tanlov, setTanlov] = useState<Record<string, number>>({});
  const [ochiq, setOchiq] = useState<Record<string, boolean>>({});
  const [natija, setNatija] = useState<{ url?: string; name?: string; jami?: number; soni?: number } | null>(null);
  
  // AI Smart F2
  const [aiText, setAiText] = useState('');
  const smartF2 = useAiSmartF2();

  useEffect(() => { setTanlov({}); setNatija(null); }, [obyekt]);

  const obNomlari = useMemo(() => Array.from(new Set((obyektlar.data ?? []).map((o) => o.obyekt.split(' - ')[0]))), [obyektlar.data]);
  const barglar = useMemo(() => yassila(holat.data?.tree ?? []).filter((b) => b.f2mum > 0.0001), [holat.data]);

  const korinadigan = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s) return barglar;
    return barglar.filter((b) => b.nom.toUpperCase().includes(s) || b.rzNom.toUpperCase().includes(s));
  }, [barglar, q]);

  const guruhlar = useMemo(() => {
    const m = new Map<string, Barg[]>();
    korinadigan.forEach((b) => {
      const k = b.rzNom || '(razdelsiz)';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    });
    return [...m.entries()];
  }, [korinadigan]);

  const jami = useMemo(() => {
    let soni = 0, summa = 0;
    Object.entries(tanlov).forEach(([k, h]) => {
      const b = barglar.find((x) => x.kalit === k);
      if (!b || !h) return;
      soni++; summa += h * b.narx;
    });
    return { soni, summa };
  }, [tanlov, barglar]);

  const mumkinJami = useMemo(() => barglar.reduce((a, b) => a + b.f2mum * b.narx, 0), [barglar]);

  function belgila(b: Barg, on: boolean) {
    setTanlov((p) => { const n = { ...p }; if (on) n[b.kalit] = b.f2mum; else delete n[b.kalit]; return n; });
  }
  function hajmOzgart(b: Barg, v: string) {
    const h = Number(String(v).replace(/[^\d.-]/g, ''));
    setTanlov((p) => ({ ...p, [b.kalit]: isFinite(h) ? h : 0 }));
  }
  function razdelBelgila(list: Barg[], on: boolean) {
    setTanlov((p) => { const n = { ...p }; list.forEach((b) => { if (on) n[b.kalit] = b.f2mum; else delete n[b.kalit]; }); return n; });
  }

  async function hujjatYarat() {
    const items = barglar
      .filter((b) => tanlov[b.kalit] > 0)
      .map((b) => ({
        rzNom: b.rzNom, blNom: b.blNom, type: b.type,
        kod: b.kod, nom: b.nom, bir: b.bir,
        hajm: tanlov[b.kalit], narx: b.narx,
      }));
    if (!items.length) { toast('Hech narsa tanlanmadi', 'danger'); return; }
    try {
      const r = await yarat.mutateAsync({ obyekt, oyNom, items });
      if (!r.ok) { toast('Hujjat yaratilmadi', 'danger'); return; }
      setNatija(r);
      toast(`Ф2 tayyor: ${r.soni} qator`, 'ok');
    } catch (e: any) { toast(`Xato: ${e.message}`, 'danger'); }
  }

  async function handleAiSmartF2() {
    if (!obyekt) { toast('Obyektni tanlang!', 'danger'); return; }
    if (!aiText.trim()) { toast("Summani kiriting (masalan: 500 mln so'm)", 'warn'); return; }
    
    try {
      const res = await smartF2.mutateAsync({ obyekt, text: aiText });
      if (res.text) {
         toast(res.text, 'warn', undefined, 5000);
      }
      if (res.ok && res.edits) {
        // Tanlovni tozalab, faqat AI berganlarini kiritamiz
        const newTanlov: Record<string, number> = {};
        res.edits.forEach(e => {
           // kalit = varaq#row
           const kalit = `${e.varaq}#${e.row}`;
           newTanlov[kalit] = e.hajmToTake;
        });
        setTanlov(newTanlov);
        toast(`✨ AI Smetani qidirdi: ${res.edits.length} ta pozitsiyadan ${pulQisqa(res.sum)} lik ish yig'ildi.`, 'ok', undefined, 4000);
      }
    } catch (e: any) {
      toast(`AI Xato: ${e.message}`, 'danger');
    }
  }

  return (
    <AuroraBackground>
      <div className="max-w-[1600px] w-full mx-auto p-6 md:p-8 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin relative z-10">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 tracking-tight drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]"
            >
              F-2 Hujjatini Tayyorlash
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-slate-300 text-base mt-3 flex items-center gap-3 font-medium"
            >
              <FileText size={18} className="text-accent" />
              Smetadan yangi Bajarilgan Ishlar (F-2) hujjatini yasash (faqat bajarish mumkin bo'lgan qoldiqdan)
            </motion.p>
          </div>
          
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-wrap items-center gap-3 w-full lg:w-auto bg-white/5 p-3 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                value={obyekt} onChange={(e) => setObyekt(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-accent/50 appearance-none min-w-[200px]"
              >
                <option value="" className="bg-slate-800 text-white">Obyektni tanlang...</option>
                {obNomlari.map(o => <option key={o} value={o} className="bg-slate-800 text-white">{o}</option>)}
              </select>
            </div>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" value={oyNom} onChange={(e) => setOyNom(e.target.value)} placeholder="07.2026"
                className="pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white w-32 outline-none focus:border-accent/50"
              />
            </div>
            <div className="relative flex-1 lg:w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidiruv..."
                className="pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white w-full outline-none focus:border-accent/50"
              />
            </div>
          </motion.div>
        </header>

        {/* AI Smart F2 Banner */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <GlassCard className="p-4 border-accent/30 bg-accent/5 flex flex-col md:flex-row items-center gap-4 group">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent flex-shrink-0 group-hover:scale-110 transition-transform">
              <Sparkles size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-lg mb-1">AI bilan Avto-F2 yasash</h3>
              <p className="text-slate-400 text-sm">Obyekt va oyni tanlab, kerakli summani sotavering. AI minglab smeta qatorlarini o'qib, o'zi optimal F-2 yig'ib beradi.</p>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2">
               <input 
                 type="text" 
                 value={aiText} 
                 onChange={(e) => setAiText(e.target.value)} 
                 placeholder="Masalan: 500 mln so'mga yasa" 
                 className="px-4 py-3 bg-black/50 border border-accent/30 rounded-xl text-white outline-none focus:border-accent w-full md:w-64 font-medium"
                 onKeyDown={(e) => e.key === 'Enter' && handleAiSmartF2()}
                 disabled={smartF2.isPending || !obyekt}
               />
               <button 
                 onClick={handleAiSmartF2}
                 aria-label="AI bilan avtomatik tanlash"
                 title="AI bilan avtomatik tanlash"
                 disabled={smartF2.isPending || !obyekt}
                 className="bg-accent hover:bg-sky-400 text-black p-3 rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all disabled:opacity-50 flex items-center justify-center"
               >
                 {smartF2.isPending ? <Loader2 size={24} className="animate-spin" /> : <Wand2 size={24} />}
               </button>
            </div>
          </GlassCard>
        </motion.div>

        {!obyekt ? (
          <div className="flex flex-col items-center justify-center h-[50vh] opacity-60">
            <Database size={64} className="text-slate-500 mb-4" />
            <p className="text-xl text-slate-300 font-medium">Yuqoridan obyektni tanlang</p>
            <p className="text-sm text-slate-500 mt-2">Shundan so'ng F-2 ga olish mumkin bo'lgan qatorlar ochiladi</p>
          </div>
        ) : holat.isLoading ? (
          <div className="p-8 max-w-4xl mx-auto"><Skelet qatorlar={8} /></div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassCard className="p-5 flex flex-col justify-center border-white/10">
                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Olish mumkin</div>
                <div className="text-2xl font-mono font-bold text-white flex items-baseline gap-2">
                  <FmtN val={barglar.length} /> <span className="text-sm text-slate-500 font-sans">qator</span>
                </div>
              </GlassCard>
              <GlassCard className="p-5 flex flex-col justify-center border-blue-500/20 bg-blue-500/5">
                <div className="text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">Mumkin summa</div>
                <div className="text-2xl font-mono font-bold text-blue-400 flex items-baseline gap-2">
                  <FmtN val={mumkinJami} qisqa /> <span className="text-sm text-blue-500/50 font-sans">so'm</span>
                </div>
              </GlassCard>
              <GlassCard className="p-5 flex flex-col justify-center border-accent/20 bg-accent/5">
                <div className="text-accent text-xs font-bold uppercase tracking-wider mb-2">Tanlandi</div>
                <div className="text-2xl font-mono font-bold text-white flex items-baseline gap-2">
                  <FmtN val={jami.soni} /> <span className="text-sm text-accent/50 font-sans">qator</span>
                </div>
              </GlassCard>
              <GlassCard className="p-5 flex flex-col justify-center border-emerald-500/20 bg-emerald-500/5">
                <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Tanlangan Summa</div>
                <div className="text-2xl font-mono font-bold text-emerald-400 flex items-baseline gap-2">
                  <FmtN val={jami.summa} qisqa /> <span className="text-sm text-emerald-500/50 font-sans">so'm</span>
                </div>
              </GlassCard>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-4 flex-wrap">
              <button 
                onClick={hujjatYarat} 
                disabled={yarat.isPending || jami.soni === 0}
                className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg text-lg ${yarat.isPending || jami.soni === 0 ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5' : 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:from-emerald-400 hover:to-blue-400 hover:shadow-emerald-500/25 active:scale-95'}`}
              >
                <FileOutput size={20} />
                {yarat.isPending ? 'Yasalmoqda...' : `F-2 Hujjatini Yasash (${jami.soni})`}
              </button>
              {jami.soni > 0 && (
                <button onClick={() => setTanlov({})} className="px-5 py-3.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 font-medium transition-colors">
                  Tanlovni tozalash
                </button>
              )}
            </div>

            {/* Success Message */}
            <AnimatePresence>
              {natija && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-center justify-between gap-4 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                        <CheckCircle size={24} />
                      </div>
                      <div>
                        <p className="text-emerald-100 font-bold text-lg">{natija.name}</p>
                        <p className="text-emerald-400/80 font-mono mt-1">
                          {natija.soni} qator · <FmtN val={natija.jami} /> so'm
                        </p>
                      </div>
                    </div>
                    {natija.url && (
                      <a href={natija.url} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-xl flex items-center gap-2 transition-colors">
                        <ExternalLink size={18} /> Hujjatni ochish
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Data Grid */}
            <div className="space-y-4 pb-20">
              {guruhlar.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-white/5 rounded-2xl border border-white/5">
                  Qidiruvga mos qator yo'q yoki obyektda F-2 ga olish mumkin bo'lgan qatorlar qolmagan.
                </div>
              ) : (
                guruhlar.map(([rz, list]) => {
                  const ochiqmi = ochiq[rz] !== false;
                  const rzSumma = list.reduce((a, b) => a + b.f2mum * b.narx, 0);
                  const tanlanganSoni = list.filter((b) => tanlov[b.kalit] > 0).length;
                  
                  return (
                    <GlassCard key={rz} className="overflow-hidden border-white/10 hover:border-white/20 transition-colors">
                      <div className="px-5 py-4 bg-white/5 border-b border-white/5 flex items-center gap-4">
                        <button onClick={() => setOchiq((p) => ({ ...p, [rz]: !ochiqmi }))} className="text-slate-400 hover:text-white transition-colors">
                          {ochiqmi ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={tanlanganSoni === list.length && list.length > 0}
                            ref={(el) => { if (el) el.indeterminate = tanlanganSoni > 0 && tanlanganSoni < list.length; }}
                            onChange={(e) => razdelBelgila(list, e.target.checked)}
                            className="w-5 h-5 rounded border-white/20 bg-black/50 text-accent focus:ring-accent focus:ring-offset-black transition-all cursor-pointer"
                          />
                          <span className="text-white font-bold tracking-wide truncate max-w-lg group-hover:text-blue-200 transition-colors">{rz}</span>
                        </label>
                        <div className="ml-auto flex items-center gap-4">
                          {tanlanganSoni > 0 && <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-bold border border-accent/30">{tanlanganSoni} / {list.length}</span>}
                          <span className="text-slate-400 font-mono text-sm"><FmtN val={rzSumma} /></span>
                        </div>
                      </div>

                      <AnimatePresence>
                        {ochiqmi && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="divide-y divide-white/5">
                            {list.map((b) => {
                              const tanlandi = tanlov[b.kalit] > 0;
                              return (
                                <div key={b.kalit} className={`px-5 py-3 flex items-center gap-4 transition-colors ${tanlandi ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'}`}>
                                  <input
                                    type="checkbox" checked={tanlandi}
                                    onChange={(e) => belgila(b, e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-accent focus:ring-accent cursor-pointer flex-shrink-0"
                                  />
                                  <span className={`flex-shrink-0 text-lg ${TUR_RANG[b.type]}`} title={b.type}>{TUR_BELGI[b.type] ?? '•'}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className={`font-medium truncate ${tanlandi ? 'text-white' : 'text-slate-300'}`} title={b.nom}>{b.nom}</div>
                                    <div className="text-xs text-slate-500 truncate mt-0.5">
                                      {b.kod && <span className="mr-2 text-slate-400 font-mono">{b.kod}</span>}
                                      {b.blNom && <span>{b.blNom}</span>}
                                    </div>
                                  </div>
                                  <div className="w-16 text-slate-400 text-sm text-right flex-shrink-0">{b.bir}</div>
                                  <div className="w-28 text-slate-300 font-mono text-right flex-shrink-0" title="Mumkin hajm">
                                    <FmtN val={b.f2mum} />
                                  </div>
                                  <div className="w-32 flex-shrink-0">
                                    <input
                                      type="number"
                                      value={tanlov[b.kalit] ?? ''}
                                      placeholder={String(b.f2mum)}
                                      onChange={(e) => hajmOzgart(b, e.target.value)}
                                      className={`w-full h-9 px-3 rounded-lg bg-black/40 border text-right font-mono text-sm outline-none transition-colors ${tanlandi ? 'border-accent/50 text-white' : 'border-white/10 text-slate-400 focus:border-white/30'}`}
                                    />
                                  </div>
                                  <div className={`w-32 text-right font-mono font-bold flex-shrink-0 ${tanlandi ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    <FmtN val={(tanlov[b.kalit] ?? 0) * b.narx} />
                                  </div>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </GlassCard>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </div>
    </AuroraBackground>
  );
}

export default F2Tayyorlash;
