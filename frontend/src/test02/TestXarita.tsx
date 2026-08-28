import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import {
  Building2, HardHat, Warehouse, FileText, Pickaxe,
  Map, ZoomIn, ZoomOut, Maximize2, Briefcase, Users, Settings,
  Calculator, BarChart3, ShoppingCart, Truck, ShieldCheck, ClipboardList,
  ChevronRight, FolderOpen, Link as LinkIcon
} from 'lucide-react';
import { sbT2ObyektlarOl, type T2Obyekt } from '../api/supabase';
import { toast } from '../umumiy/ui/Toast';

/*
   CANVAS CONSTANTS
*/
const CANVAS = 4000;
const OB_W   = 220;
const OB_H   = 52;
const SUB_W  = 210;
const SUB_H  = 36;
const SUB_GAP = 10;
const OB_GAP  = 40;

const HQ_X = CANVAS / 2 - 500;
const HQ_Y = CANVAS / 2;
const HQ_W = 220;
const HQ_H = 120;

const OBJ_X = HQ_X + HQ_W + 160;

/*
   COLOR MAP
*/
const COLORS: Record<string, string> = {
  violet:  '#8b5cf6',
  emerald: '#10b981',
  cyan:    '#06b6d4',
  amber:   '#f59e0b',
  orange:  '#f97316',
  blue:    '#3b82f6',
  slate:   '#64748b',
  indigo:  '#6366f1',
  rose:    '#f43f5e',
  fuchsia: '#d946ef',
  sky:     '#0ea5e9',
  red:     '#ef4444',
  accent:  '#3b82f6',
};

/*
   DATA
*/
const GLOBAL_MODS = [
  { id: 'boshqaruv', nomi: 'Boshqaruv / Analitika', color: 'violet',  Icon: BarChart3,     path: '/admin/test/hisobot', connectable: false },
  { id: 'moliya',    nomi: 'Moliya & Buxgalteriya', color: 'emerald', Icon: Calculator,    path: '/admin/test/tolov',   connectable: false },
  { id: 'shartnoma', nomi: 'Bosh Shartnomalar',     color: 'fuchsia', Icon: Briefcase,     path: '/admin/test/shartnomalar', connectable: false },
  { id: 'xarid',     nomi: 'Xaridlar & Birja',      color: 'cyan',    Icon: ShoppingCart,  path: '/admin/test/birja',   connectable: false },
  { id: 'sklad',     nomi: 'Markaziy Ombor',        color: 'amber',   Icon: Warehouse,     path: '/admin/test/sklad',   connectable: true },
  { id: 'texnika',   nomi: 'Avtopark / Texnika',    color: 'orange',  Icon: Truck,         path: '/admin/test/erp',     connectable: true },
  { id: 'kadrlar',   nomi: 'Kompaniya HR',          color: 'blue',    Icon: Users,         path: '/admin/test/erp',     connectable: true },
  { id: 'sozlama',   nomi: 'Tizim Sozlamalari',     color: 'slate',   Icon: Settings,      path: '/admin/test/sozlama', connectable: false },
];

const OBJ_SUBS = [
  { nomi: 'Asosiy Smeta',          color: 'indigo',  Icon: FileText,      pathFn: (_: number, nom: string) => '/admin/test/smeta?obyekt=' + nom },
  { nomi: 'F2 Dalolatnoma',        color: 'rose',    Icon: Pickaxe,       pathFn: (_: number, nom: string) => '/admin/test/smeta?obyekt=' + nom },
  { nomi: 'Obyekt Shartnomalari',  color: 'fuchsia', Icon: Briefcase,     pathFn: (id: number, _nom: string) => '/admin/test/shartnomalar?obyektId=' + id },
  { nomi: 'Texnadzor / Sifat',     color: 'red',     Icon: ShieldCheck,   pathFn: (id: number, _nom: string) => '/admin/test/erp?modul=sifat&obyektId=' + id },
  { nomi: 'Obyekt Hujjatlari',     color: 'cyan',    Icon: FolderOpen,    pathFn: (id: number, _nom: string) => '/admin/test/hujjat?obyektId=' + id },
];

/*
   BEZIER PATH HELPER
*/
function bezier(x1: number, y1: number, x2: number, y2: number, color = '#334155', thick = 2, dashed = false) {
  const cx = (x1 + x2) / 2;
  return (
    <path
      d={'M ' + x1 + ' ' + y1 + ' C ' + cx + ' ' + y1 + ', ' + cx + ' ' + y2 + ', ' + x2 + ' ' + y2}
      fill="none"
      stroke={color}
      strokeWidth={thick}
      strokeOpacity={dashed ? 0.8 : 0.6}
      strokeDasharray={dashed ? "5,5" : "none"}
      className={dashed ? "animate-pulse" : ""}
    />
  );
}

export default function TestXarita() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const zoom = useMotionValue(0.7);
  const smoothZoom = useSpring(zoom, { damping: 24, stiffness: 220 });

  // DRAG AND DROP LINKING STATE
  const [activeLinks, setActiveLinks] = useState<{sourceId: string, targetId: number}[]>([]);
  const [draftLink, setDraftLink] = useState<{sourceId: string, startX: number, startY: number, curX: number, curY: number, color: string} | null>(null);

  useEffect(() => {
    setYuklanmoqda(true);
    sbT2ObyektlarOl().then(r => {
      setObyektlar(r.qatorlar || []);
      setYuklanmoqda(false);
      // Mock some existing junction connections just to show the UI works
      if (r.qatorlar && r.qatorlar.length > 0) {
        setActiveLinks([
          { sourceId: 'sklad', targetId: r.qatorlar[0].id }
        ]);
      }
    });
  }, [aktKomp]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const { width, height } = wrapRef.current.getBoundingClientRect();
    setPan({
      x: width / 2 - CANVAS / 2 + 200,
      y: height / 2 - CANVAS / 2,
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoom.set(Math.min(Math.max(zoom.get() - e.deltaY * 0.001, 0.2), 2.5));
  }, [zoom]);

  const getSvgMousePos = (e: React.MouseEvent | React.PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (draftLink) return; // if drawing line, don't pan
    dragging.current = true;
    dragMoved.current = false;
    last.current = { x: e.clientX, y: e.clientY };
  };
  
  const onMouseMove = (e: React.MouseEvent) => {
    if (draftLink) {
      const pos = getSvgMousePos(e);
      setDraftLink(prev => prev ? { ...prev, curX: pos.x, curY: pos.y } : null);
      return;
    }
    if (!dragging.current) return;
    dragMoved.current = true;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  
  const onMouseUp = () => { 
    dragging.current = false;
    if (draftLink) {
      setDraftLink(null); // dropped in empty space
    }
  };

  const nav = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragMoved.current) return; 
    navigate(path);
  };

  // LINKING HANDLERS
  const startLink = (e: React.PointerEvent, sourceId: string, x: number, y: number, color: string) => {
    e.stopPropagation();
    // Using setPointerCapture enables tracking outside the element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pos = getSvgMousePos(e);
    setDraftLink({ sourceId, startX: x, startY: y, curX: pos.x, curY: pos.y, color });
  };

  const completeLink = (e: React.PointerEvent, targetId: number) => {
    e.stopPropagation();
    if (draftLink) {
      const exists = activeLinks.find(l => l.sourceId === draftLink.sourceId && l.targetId === targetId);
      if (!exists) {
        setActiveLinks(prev => [...prev, { sourceId: draftLink.sourceId, targetId }]);
        toast("Markaziy resurs obyektga muvaffaqiyatli bog'landi (M:N SQL)", 'ok');
      } else {
        toast("Ushbu resurs allaqachon bog'langan", 'danger');
      }
      setDraftLink(null);
    }
  };

  /* LAYOUT MATH */
  const totalSubH = (OBJ_SUBS.length) * (SUB_H + SUB_GAP) - SUB_GAP;
  const obRowH = Math.max(OB_H, totalSubH);
  const rowStep = obRowH + OB_GAP;
  const totalObH = obyektlar.length * rowStep - OB_GAP;

  const hqCY = HQ_Y;
  const objStartY = hqCY - totalObH / 2;

  const glTotalH = GLOBAL_MODS.length * (SUB_H + SUB_GAP) - SUB_GAP;
  const glX = HQ_X - 240;
  const glStartY = hqCY - glTotalH / 2;
  const OBJ_SUB_X = OBJ_X + OB_W + 60;

  // Compute positions for active links
  const getNodePos = (type: 'source'|'target', id: string | number) => {
    if (type === 'source') {
      const idx = GLOBAL_MODS.findIndex(m => m.id === id);
      return { x: glX + SUB_W, y: glStartY + idx * (SUB_H + SUB_GAP) + SUB_H / 2 };
    } else {
      const idx = obyektlar.findIndex(o => o.id === id);
      return { x: OBJ_X, y: objStartY + idx * rowStep + OB_H / 2 };
    }
  };

  return (
    <div
      ref={wrapRef}
      className="w-full h-full bg-bg relative overflow-hidden select-none"
      onWheel={handleWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
    >
      <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-center z-50 bg-bg/90 backdrop-blur-md border-b border-border shadow-sm">
        <h1 className="text-base font-bold text-text flex items-center gap-2">
          <Map size={18} className="text-accent" />
          Arxitektura Xaritasi (Resurslarni Ulash)
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-dim border border-border bg-surface px-2 py-1 rounded">
            Markaziy omborni tortib obyektga ulang
          </span>
          <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg">
            <button onClick={() => zoom.set(Math.max(zoom.get() - 0.15, 0.2))} className="p-1.5 hover:bg-surface-2 text-text rounded"><ZoomOut size={16}/></button>
            <button onClick={() => { zoom.set(0.7); }} className="p-1.5 hover:bg-surface-2 text-text rounded"><Maximize2 size={16}/></button>
            <button onClick={() => zoom.set(Math.min(zoom.get() + 0.15, 2.5))} className="p-1.5 hover:bg-surface-2 text-text rounded"><ZoomIn size={16}/></button>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: CANVAS,
          height: CANVAS,
          scale: smoothZoom,
          x: pan.x,
          y: pan.y,
        }}
      >
        <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full" style={{ overflow: 'visible' }}>
          
          {/* PATHS */}
          <g className="pointer-events-none">
            {/* Core HQ paths */}
            {GLOBAL_MODS.map((m, i) => !m.connectable && bezier(HQ_X, hqCY, glX + SUB_W, glStartY + i * (SUB_H + SUB_GAP) + SUB_H / 2, COLORS[m.color], 2))}
            {obyektlar.map((_, i) => bezier(HQ_X + HQ_W, hqCY, OBJ_X, objStartY + i * rowStep + OB_H / 2, COLORS['accent'], 2.5))}
            {obyektlar.map((_, i) => OBJ_SUBS.map((s, j) => bezier(OBJ_X + OB_W, objStartY + i * rowStep + OB_H / 2, OBJ_SUB_X, (objStartY + i * rowStep + (OB_H / 2) - (totalSubH / 2)) + j * (SUB_H + SUB_GAP) + SUB_H / 2, COLORS[s.color], 1.5)))}
            
            {/* Active Many-to-Many Links */}
            {activeLinks.map((link, idx) => {
              const src = getNodePos('source', link.sourceId);
              const tgt = getNodePos('target', link.targetId);
              const color = COLORS[GLOBAL_MODS.find(m => m.id === link.sourceId)?.color || 'accent'];
              return <React.Fragment key={idx}>{bezier(src.x, src.y, tgt.x, tgt.y, color, 4)}</React.Fragment>
            })}

            {/* Draft Link during Drag */}
            {draftLink && bezier(draftLink.startX, draftLink.startY, draftLink.curX, draftLink.curY, COLORS[draftLink.color], 4, true)}
          </g>

          {/* NODES (foreignObject) */}
          <g className="pointer-events-auto">
            {GLOBAL_MODS.map((m, i) => {
              const yPos = glStartY + i * (SUB_H + SUB_GAP);
              return (
                <foreignObject key={m.nomi} x={glX} y={yPos} width={SUB_W + (m.connectable ? 20 : 0)} height={SUB_H}>
                  <div className="w-full h-full flex items-center justify-between">
                    <div onClick={(e) => nav(m.path, e)} className="w-[210px] h-full px-3 flex items-center justify-between gap-2 bg-surface border border-border rounded-lg text-sm cursor-pointer hover:border-accent/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <m.Icon size={14} style={{ color: COLORS[m.color] }} className="shrink-0" />
                        <span className="font-medium text-text text-xs truncate">{m.nomi}</span>
                      </div>
                      <ChevronRight size={12} className="text-text-dim shrink-0" />
                    </div>
                    {m.connectable && (
                      <div 
                        onPointerDown={(e) => startLink(e, m.id, glX + SUB_W, yPos + SUB_H / 2, m.color)}
                        className="w-4 h-4 bg-surface border-2 rounded-full cursor-crosshair flex items-center justify-center shrink-0 ml-1 hover:scale-125 transition-transform"
                        style={{ borderColor: COLORS[m.color] }}
                        title="Ulash uchun torting (Drag)"
                      />
                    )}
                  </div>
                </foreignObject>
              );
            })}

            <foreignObject x={HQ_X} y={HQ_Y - HQ_H / 2} width={HQ_W} height={HQ_H}>
              <div className="w-full h-full flex flex-col items-center justify-center bg-surface border-2 border-accent/60 rounded-2xl p-3 shadow-lg">
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center mb-2">
                  <Building2 size={22} className="text-accent" />
                </div>
                <h2 className="text-sm font-black text-text leading-tight">Bosh Kompaniya</h2>
                <span className="text-[10px] mt-1 px-2 py-0.5 bg-surface-2 text-text-dim rounded-full">Boshqaruv Markazi</span>
              </div>
            </foreignObject>

            {yuklanmoqda && (
              <foreignObject x={OBJ_X} y={HQ_Y - 20} width={220} height={40}>
                <div className="text-text-dim text-sm animate-pulse">Yuklanmoqda...</div>
              </foreignObject>
            )}

            {!yuklanmoqda && obyektlar.length === 0 && (
              <foreignObject x={OBJ_X} y={HQ_Y - 60} width={260} height={120}>
                <div className="w-full h-full flex items-center justify-center bg-surface border border-border rounded-xl text-text-dim text-sm text-center p-4">
                  Obyektlar mavjud emas.<br />
                  <span className="text-accent cursor-pointer mt-1" onClick={(e) => nav('/admin/test/sozlama', e)}>Tizimga qo'shing</span>
                </div>
              </foreignObject>
            )}

            {obyektlar.map((ob, i) => {
              const oy = objStartY + i * rowStep;
              const subGroupTop = oy + (OB_H / 2) - (totalSubH / 2);
              return (
                <React.Fragment key={ob.id}>
                  <foreignObject x={OBJ_X - 16} y={oy} width={OB_W + 16} height={OB_H}>
                    <div className="w-full h-full flex items-center">
                      {/* Drop Target Port */}
                      <div 
                        onPointerUp={(e) => completeLink(e, ob.id)}
                        className={`w-4 h-4 rounded-full border-2 mr-2 shrink-0 flex items-center justify-center transition-all cursor-crosshair ${draftLink ? 'bg-accent/20 border-accent scale-150 animate-pulse' : 'bg-surface border-border'}`}
                        title="Shu obyektga ulash uchun shu yerga qo'yib yuboring"
                      />
                      <div onClick={(e) => nav('/admin/test/smeta?obyekt=' + ob.nom, e)} className="flex-1 h-full flex items-center gap-2 px-3 bg-surface border border-border rounded-xl cursor-pointer hover:border-accent">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                          <HardHat size={16} className="text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-text truncate leading-tight">{ob.nom}</p>
                          <p className="text-[10px] text-text-dim truncate">{ob.tur || 'Qurilish obyekti'}</p>
                        </div>
                      </div>
                    </div>
                  </foreignObject>
                  
                  {OBJ_SUBS.map((s, j) => (
                    <foreignObject key={s.nomi} x={OBJ_SUB_X} y={subGroupTop + j * (SUB_H + SUB_GAP)} width={SUB_W} height={SUB_H}>
                      <div onClick={(e) => nav(s.pathFn(ob.id, ob.nom), e)} className="w-full h-full px-3 flex items-center gap-2 bg-bg border border-border rounded-lg text-xs cursor-pointer hover:bg-surface">
                        <s.Icon size={13} style={{ color: COLORS[s.color] }} className="shrink-0" />
                        <span className="font-medium text-text truncate">{s.nomi}</span>
                      </div>
                    </foreignObject>
                  ))}
                </React.Fragment>
              );
            })}
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
