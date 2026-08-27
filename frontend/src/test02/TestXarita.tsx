import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import {
  Building2, HardHat, Warehouse, FileText, Pickaxe,
  Map, ZoomIn, ZoomOut, Maximize2, Briefcase, Users, Settings,
  Calculator, BarChart3, ShoppingCart, Truck, ShieldCheck, ClipboardList,
  ChevronRight,
} from 'lucide-react';
import { sbT2ObyektlarOl, type T2Obyekt } from '../api/supabase';

/* ─────────────────────────────────────────────────────────
   CANVAS CONSTANTS
───────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────
   COLOR MAP
───────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────── */
const GLOBAL_MODS = [
  { nomi: 'Boshqaruv / Analitika', color: 'violet',  Icon: BarChart3,     path: '/admin/test/hisobot' },
  { nomi: 'Moliya & Buxgalteriya', color: 'emerald', Icon: Calculator,    path: '/admin/test/tolov' },
  { nomi: 'Bosh Shartnomalar',     color: 'fuchsia', Icon: Briefcase,     path: '/admin/test/shartnomalar' },
  { nomi: 'Xaridlar & Birja',      color: 'cyan',    Icon: ShoppingCart,  path: '/admin/test/birja' },
  { nomi: 'Markaziy Ombor',        color: 'amber',   Icon: Warehouse,     path: '/admin/test/sklad' },
  { nomi: 'Avtopark / Texnika',    color: 'orange',  Icon: Truck,         path: '/admin/test/erp' },
  { nomi: 'Kompaniya HR',          color: 'blue',    Icon: Users,         path: '/admin/test/erp' },
  { nomi: 'Tizim Sozlamalari',     color: 'slate',   Icon: Settings,      path: '/admin/test/sozlama' },
];

const OBJ_SUBS = [
  { nomi: 'Obyekt Skladi',         color: 'amber',   Icon: Warehouse,     pathFn: (id: number, _: string) => '/admin/test/sklad?obyektId=' + id },
  { nomi: 'Asosiy Smeta',          color: 'indigo',  Icon: FileText,      pathFn: (_: number, nom: string) => '/admin/test/f2?obyekt=' + nom },
  { nomi: 'F2 Dalolatnoma',        color: 'rose',    Icon: Pickaxe,       pathFn: (_: number, nom: string) => '/admin/test/f2?obyekt=' + nom },
  { nomi: 'Obyekt Shartnomalari',  color: 'fuchsia', Icon: Briefcase,     pathFn: (id: number, _nom: string) => '/admin/test/shartnomalar?obyektId=' + id },
  { nomi: 'Obyekt HR & Tabel',     color: 'sky',     Icon: ClipboardList, pathFn: (id: number, _nom: string) => '/admin/test/erp?modul=kadrlar&obyektId=' + id },
  { nomi: 'Texnadzor / Sifat',     color: 'red',     Icon: ShieldCheck,   pathFn: (id: number, _nom: string) => '/admin/test/erp?modul=sifat&obyektId=' + id },
];

/* ─────────────────────────────────────────────────────────
   BEZIER PATH HELPER
───────────────────────────────────────────────────────── */
function bezier(x1: number, y1: number, x2: number, y2: number, color = '#334155', thick = 2) {
  const cx = (x1 + x2) / 2;
  return (
    <path
      d={'M ' + x1 + ' ' + y1 + ' C ' + cx + ' ' + y1 + ', ' + cx + ' ' + y2 + ', ' + x2 + ' ' + y2}
      fill="none"
      stroke={color}
      strokeWidth={thick}
      strokeOpacity={0.6}
    />
  );
}

/* ─────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────── */
export default function TestXarita() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const zoom = useMotionValue(0.7);
  const smoothZoom = useSpring(zoom, { damping: 24, stiffness: 220 });

  useEffect(() => {
    setYuklanmoqda(true);
    sbT2ObyektlarOl().then(r => {
      setObyektlar(r.qatorlar || []);
      setYuklanmoqda(false);
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

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragMoved.current = false;
    last.current = { x: e.clientX, y: e.clientY };
  };
  
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    dragMoved.current = true;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  
  const onMouseUp = () => { dragging.current = false; };

  const nav = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragMoved.current) return; // ignore clicks if we dragged
    navigate(path);
  };

  /* ── LAYOUT MATH ── */
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
      <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-center z-50 bg-bg/90 backdrop-blur-md border-b border-border">
        <h1 className="text-base font-bold text-text flex items-center gap-2">
          <Map size={18} className="text-accent" />
          Tizim_02 — Arxitektura Xaritasi
        </h1>
        <div className="flex items-center gap-2">
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
        <svg className="absolute top-0 left-0 w-full h-full" style={{ overflow: 'visible' }}>
          
          {/* ════ PATHS ════ */}
          <g className="pointer-events-none">
            {GLOBAL_MODS.map((m, i) => bezier(HQ_X, hqCY, glX + SUB_W, glStartY + i * (SUB_H + SUB_GAP) + SUB_H / 2, COLORS[m.color], 2))}
            {obyektlar.map((_, i) => bezier(HQ_X + HQ_W, hqCY, OBJ_X, objStartY + i * rowStep + OB_H / 2, COLORS['accent'], 2.5))}
            {obyektlar.map((_, i) => OBJ_SUBS.map((s, j) => bezier(OBJ_X + OB_W, objStartY + i * rowStep + OB_H / 2, OBJ_SUB_X, (objStartY + i * rowStep + (OB_H / 2) - (totalSubH / 2)) + j * (SUB_H + SUB_GAP) + SUB_H / 2, COLORS[s.color], 1.5)))}
          </g>

          {/* ════ NODES (foreignObject) ════ */}
          <g className="pointer-events-auto">
            {GLOBAL_MODS.map((m, i) => (
              <foreignObject key={m.nomi} x={glX} y={glStartY + i * (SUB_H + SUB_GAP)} width={SUB_W} height={SUB_H}>
                <div onClick={(e) => nav(m.path, e)} className="w-full h-full px-3 flex items-center justify-between gap-2 bg-surface border border-border rounded-lg text-sm cursor-pointer hover:border-accent/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <m.Icon size={14} style={{ color: COLORS[m.color] }} className="shrink-0" />
                    <span className="font-medium text-text text-xs truncate">{m.nomi}</span>
                  </div>
                  <ChevronRight size={12} className="text-text-dim shrink-0" />
                </div>
              </foreignObject>
            ))}

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
                  <foreignObject x={OBJ_X} y={oy} width={OB_W} height={OB_H}>
                    <div onClick={(e) => nav('/admin/test/f2?obyekt=' + ob.nom, e)} className="w-full h-full flex items-center gap-2 px-3 bg-surface border border-border rounded-xl cursor-pointer hover:border-accent">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <HardHat size={16} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-text truncate leading-tight">{ob.nom}</p>
                        <p className="text-[10px] text-text-dim truncate">{ob.tur || 'Qurilish obyekti'}</p>
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
