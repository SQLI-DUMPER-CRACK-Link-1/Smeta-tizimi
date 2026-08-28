import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Warehouse, FileText, Pickaxe,
  ZoomIn, ZoomOut, Maximize2, Briefcase, Link as LinkIcon,
  FolderKanban, AlertTriangle, RefreshCcw, Map
} from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';
import { sbT2LoyihalarOl, sbObyektLoyihagaBiriktir, type T2Loyiha } from '../api/t2-loyiha';
import { toast } from '../umumiy/ui/Toast';

const CANVAS_W = 3000;
const CANVAS_H = 3000;
const NODE_W = 240;
const NODE_H = 60;
const GAP_X = 280;

const COLORS = {
  hq: '#8b5cf6',
  loyiha: '#0ea5e9',
  obyekt: '#10b981',
  unlinked: '#ef4444',
  sub: '#6366f1'
};

function bezier(x1: number, y1: number, x2: number, y2: number, color = '#334155', thick = 2, dashed = false) {
  const cx = (x1 + x2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
      fill="none"
      stroke={color}
      strokeWidth={thick}
      strokeDasharray={dashed ? '5,5' : 'none'}
    />
  );
}

export default function TestXarita() {
  const navigate = useNavigate();
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const [loyihalar, setLoyihalar] = useState<T2Loyiha[]>([]);
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [linkingObj, setLinkingObj] = useState<T2Obyekt | null>(null);

  const yukla = async () => {
    if (!aktKomp) return;
    setYuklanmoqda(true);
    const [rL, rO] = await Promise.all([
      sbT2LoyihalarOl(aktKomp),
      sbT2ObyektlarOlKomp(aktKomp)
    ]);
    if (rL.ok && rL.qatorlar) setLoyihalar(rL.qatorlar);
    if (rO.ok && rO.qatorlar) setObyektlar(rO.qatorlar);
    setYuklanmoqda(false);
  };

  useEffect(() => {
    yukla();
    setPan({ x: -200, y: -CANVAS_H / 2 + window.innerHeight / 2 });
  }, [aktKomp]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };

  const handleLink = async (loyihaId: number | null) => {
    if (!linkingObj) return;
    setYuklanmoqda(true);
    const r = await sbObyektLoyihagaBiriktir(linkingObj.id, loyihaId);
    if (r.ok) {
      toast('Muvaffaqiyatli biriktirildi', 'ok');
      await yukla();
    } else {
      toast(r.error || 'Xato', 'danger');
    }
    setYuklanmoqda(false);
    setLinkingObj(null);
  };

  // ----------------------------------------------------
  // LAYOUT CALCULATION
  // ----------------------------------------------------
  const nodes = [];
  const links = [];

  const startX = 400;
  let startY = CANVAS_H / 2 - 400;

  // 1. HQ Node
  const hqX = startX;
  const hqY = CANVAS_H / 2;
  nodes.push(
    <div key="hq" className="absolute shadow-[0_0_30px_rgba(139,92,246,0.3)] rounded-2xl border-2 border-violet-500 bg-surface flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform z-10"
         style={{ left: hqX, top: hqY, width: NODE_W, height: 100 }}>
      <Building2 size={32} className="text-violet-400 mb-2" />
      <div className="font-bold text-white tracking-wide">{joriy?.nom || 'Kompaniya HQ'}</div>
      <div className="text-[10px] text-violet-300">TIZIM 02 ARCHITECTURE</div>
    </div>
  );

  // 2. Map Loyihalar and their Obyekts
  const mappedObjIds = new Set<number>();
  let currentY = startY;

  loyihalar.forEach((l) => {
    const lX = hqX + GAP_X;
    const lY = currentY;
    
    nodes.push(
      <div key={'l_'+l.id} className="absolute rounded-xl border-2 border-sky-500 bg-surface p-3 flex flex-col justify-center cursor-pointer hover:border-sky-400 z-10"
           style={{ left: lX, top: lY, width: NODE_W, minHeight: NODE_H }}
           onClick={() => navigate('/admin/test/portfel')}>
        <div className="flex items-center gap-2 text-sky-400 font-bold text-[13px] mb-1">
          <FolderKanban size={16} /> {l.nom}
        </div>
        <div className="text-[11px] text-text-dim">Byudjet: {l.byudjet ? l.byudjet.toLocaleString() : '---'} UZS</div>
      </div>
    );
    links.push(<React.Fragment key={'lnk_hq_'+l.id}>{bezier(hqX + NODE_W, hqY + 50, lX, lY + NODE_H/2, COLORS.loyiha, 2)}</React.Fragment>);

    // Find objects for this Loyiha
    const projectObjs = l.obyektlar.map(lo => obyektlar.find(o => o.id === lo.obyekt_id)).filter(Boolean) as T2Obyekt[];
    
    if (projectObjs.length === 0) {
      currentY += NODE_H + 40; // spacer
    } else {
      let objStartY = currentY;
      projectObjs.forEach(po => {
        mappedObjIds.add(po.id);
        const oX = lX + GAP_X;
        const oY = objStartY;
        
        nodes.push(
          <div key={'o_'+po.id} className="absolute rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-2 flex flex-col justify-center cursor-pointer hover:border-emerald-400 z-10 group"
               style={{ left: oX, top: oY, width: NODE_W, minHeight: NODE_H }}
               onClick={() => navigate('/admin/test/daraxt?obyekt=' + encodeURIComponent(po.nom))}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-[12px]">
                <Building2 size={14} /> {po.nom}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setLinkingObj(po); }} className="opacity-0 group-hover:opacity-100 p-1 bg-white/10 hover:bg-white/20 rounded text-text-mute hover:text-white" title="Boshqa loyihaga o'tkazish">
                <LinkIcon size={12} />
              </button>
            </div>
            <div className="text-[10px] text-emerald-500/70 mt-1 flex gap-2">
               <span>Smeta: {po.qator_soni || 0} qator</span>
               <span>F2: {po.ish || 0} qator</span>
            </div>
          </div>
        );
        links.push(<React.Fragment key={'lnk_l_'+po.id}>{bezier(lX + NODE_W, lY + NODE_H/2, oX, oY + NODE_H/2, COLORS.obyekt, 1.5)}</React.Fragment>);

        // Sub-nodes for this Obyekt (Sklad, Shartnoma)
        const subX = oX + GAP_X - 40;
        nodes.push(
          <div key={'sub_sklad_'+po.id} onClick={() => navigate('/admin/test/logistika')} className="absolute rounded-lg border border-amber-500/30 bg-amber-950/20 px-2 py-1 flex items-center gap-2 cursor-pointer hover:border-amber-400 text-[10px] text-amber-400 z-10"
               style={{ left: subX, top: oY - 10, width: 140 }}>
            <Warehouse size={12}/> Sklad (WMS)
          </div>
        );
        nodes.push(
          <div key={'sub_shart_'+po.id} onClick={() => navigate('/admin/test/moliya')} className="absolute rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/20 px-2 py-1 flex items-center gap-2 cursor-pointer hover:border-fuchsia-400 text-[10px] text-fuchsia-400 z-10"
               style={{ left: subX, top: oY + 20, width: 140 }}>
            <Briefcase size={12}/> Shartnomalar
          </div>
        );
        links.push(<React.Fragment key={'lnk_sub1_'+po.id}>{bezier(oX + NODE_W, oY + NODE_H/2, subX, oY - 2, COLORS.sub, 1, true)}</React.Fragment>);
        links.push(<React.Fragment key={'lnk_sub2_'+po.id}>{bezier(oX + NODE_W, oY + NODE_H/2, subX, oY + 28, COLORS.sub, 1, true)}</React.Fragment>);

        objStartY += NODE_H + 60;
      });
      currentY = objStartY + 20;
    }
  });

  // 3. Unlinked Obyektlar
  const unlinkedObjs = obyektlar.filter(o => !mappedObjIds.has(o.id));
  if (unlinkedObjs.length > 0) {
    const unlX = hqX + GAP_X;
    const unlY = currentY + 40;
    
    nodes.push(
      <div key="unlinked_header" className="absolute rounded-xl border border-red-500 border-dashed bg-red-950/10 p-3 flex flex-col justify-center z-10"
           style={{ left: unlX, top: unlY, width: NODE_W, minHeight: NODE_H }}>
        <div className="flex items-center gap-2 text-red-400 font-bold text-[13px] mb-1">
          <AlertTriangle size={16} /> Biriktirilmagan ({unlinkedObjs.length})
        </div>
        <div className="text-[10px] text-text-dim">Bular hech qaysi Loyihaga tegishli emas</div>
      </div>
    );
    links.push(<React.Fragment key="lnk_hq_unl">{bezier(hqX + NODE_W, hqY + 50, unlX, unlY + NODE_H/2, COLORS.unlinked, 2, true)}</React.Fragment>);

    let uY = unlY + NODE_H + 30;
    unlinkedObjs.forEach(uo => {
      nodes.push(
        <div key={'uo_'+uo.id} className="absolute rounded-xl border border-red-500/50 bg-red-950/20 p-2 flex flex-col justify-center cursor-pointer hover:border-red-400 z-10 group animate-pulse"
             style={{ left: unlX + 40, top: uY, width: NODE_W - 40, minHeight: NODE_H }}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-red-300 font-bold text-[12px]">
              <Building2 size={14} /> {uo.nom}
            </div>
            <button onClick={() => setLinkingObj(uo)} className="p-1 bg-red-500/20 hover:bg-red-500/40 rounded text-red-200" title="Loyihaga ulash">
              <LinkIcon size={12} /> Ulash
            </button>
          </div>
        </div>
      );
      links.push(<React.Fragment key={'lnk_unl_'+uo.id}>{bezier(unlX + 20, unlY + NODE_H, unlX + 40, uY + NODE_H/2, COLORS.unlinked, 1.5, true)}</React.Fragment>);
      uY += NODE_H + 20;
    });
  }

  return (
    <div className="relative w-full h-full bg-[#030712] overflow-hidden select-none">
      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />

      {/* TEPADAGI TOOLBAR */}
      <div className="absolute top-4 left-6 z-50 flex items-center gap-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Map className="text-sky-400" /> Arxitektura Mindmap
        </h1>
        <div className="flex items-center bg-black/40 backdrop-blur-md rounded-lg border border-white/10 p-1 shadow-xl">
          <button onClick={yukla} className="p-1.5 hover:bg-white/10 rounded text-text-dim hover:text-white transition-colors" title="Yangilash">
             <RefreshCcw size={16} className={yuklanmoqda ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setPan({ x: -200, y: -CANVAS_H / 2 + window.innerHeight / 2 })} className="p-1.5 hover:bg-white/10 rounded text-text-dim hover:text-white transition-colors" title="Markazga qaytish">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="absolute top-16 left-6 z-50 max-w-sm text-[12px] text-text-dim bg-black/40 p-3 rounded-xl border border-white/5">
        Baza (Supabase) arxitekturasi jonli tarzda chiziladi. <b>Qizil obyektlar</b> hech qaysi loyihaga ulanmagan. Ularni <b>Ulash</b> tugmasi orqali kerakli loyihaga biriktiring. Obyektlarni boshqa loyihaga ko'chirish ham mumkin.
      </div>

      {/* ASOSIY KANVAS */}
      <motion.div
        className="absolute origin-top-left"
        style={{ width: CANVAS_W, height: CANVAS_H, x: pan.x, y: pan.y }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {links}
        </svg>
        {nodes}
      </motion.div>

      {/* LINKING MODAL */}
      {linkingObj && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl w-[450px] shadow-2xl">
            <h3 className="font-bold text-lg mb-2 text-white flex items-center gap-2">
              <LinkIcon className="text-accent" /> Loyihaga Biriktirish
            </h3>
            <p className="text-[13px] text-text-mute mb-4">
              <b className="text-emerald-400">{linkingObj.nom}</b> obyektini qaysi loyihaga biriktiramiz?
            </p>
            
            <div className="max-h-[60vh] overflow-y-auto space-y-2 mb-4">
              <button 
                onClick={() => handleLink(null)}
                className="w-full text-left px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-200 text-[13px] transition-colors"
              >
                ?" Hech qaysi loyihaga (Erkin Obyekt)
              </button>
              {loyihalar.map(l => (
                <button 
                  key={l.id} 
                  onClick={() => handleLink(l.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border bg-white/5 hover:bg-white/10 hover:border-sky-500/50 text-white text-[13px] transition-colors flex justify-between items-center"
                >
                  <span className="font-medium">{l.nom}</span>
                  <span className="text-[11px] text-sky-400">{l.obyekt_soni} ta obyekt</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setLinkingObj(null)} className="px-4 py-2 rounded-lg text-sm text-text-dim hover:bg-white/5 transition-colors">
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
