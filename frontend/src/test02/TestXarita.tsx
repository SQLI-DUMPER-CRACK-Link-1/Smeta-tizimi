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
const CANVAS = 4000;          // virtual canvas size (px)
const OB_W   = 220;           // object node width
const OB_H   = 52;            // object node height
const SUB_W  = 210;           // sub-module leaf width
const SUB_H  = 36;            // sub-module leaf height
const SUB_GAP = 10;           // gap between leaves
const OB_GAP  = 40;           // gap between object rows (including leaves)

const HQ_X = CANVAS / 2 - 500;
const HQ_Y = CANVAS / 2;
const HQ_W = 220;
const HQ_H = 120;

const OBJ_X = HQ_X + HQ_W + 160;  // x for object nodes

/* ─────────────────────────────────────────────────────────
   COLOR MAP (tailwind class → hex for SVG stroke)
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
  { nomi: 'Boshqaruv / Analitika', color: 'violet',  Icon: BarChart3,     path: '/admin/test/dashboard' },
  { nomi: 'Moliya & Buxgalteriya', color: 'emerald', Icon: Calculator,    path: '/admin/test/tolovlar' },
  { nomi: 'Xaridlar & Birja',      color: 'cyan',    Icon: ShoppingCart,  path: '/admin/test/xaridlar' },
  { nomi: 'Markaziy Ombor',        color: 'amber',   Icon: Warehouse,     path: '/admin/test/baza' },
  { nomi: 'Avtopark / Texnika',    color: 'orange',  Icon: Truck,         path: '/admin/test/texnika' },
  { nomi: 'Kompaniya HR',          color: 'blue',    Icon: Users,         path: '/admin/test/ishchilar' },
  { nomi: 'Tizim Sozlamalari',     color: 'slate',   Icon: Settings,      path: '/admin/test/sozlamalar' },
];

const OBJ_SUBS = [
  { nomi: 'Obyekt Skladi',         color: 'amber',   Icon: Warehouse,     pathFn: (id: number, _: string) => `/admin/test/sklad?obyektId=${id}` },
  { nomi: 'Asosiy Smeta',         color: 'indigo',  Icon: FileText,      pathFn: (_: number, nom: string) => `/admin/test/daraxt?obyekt=${encodeURIComponent(nom)}` },
  { nomi: 'F2 Dalolatnoma',        color: 'rose',    Icon: Pickaxe,       pathFn: (_: number, nom: string) => `/admin/test/f2?obyekt=${encodeURIComponent(nom)}` },
  { nomi: 'Pudrat Shartnomalari',  color: 'fuchsia', Icon: Briefcase,     pathFn: (_: number, nom: string) => `/admin/test/shartnomalar?obyekt=${encodeURIComponent(nom)}` },
  { nomi: 'Obyekt HR & Tabel',     color: 'sky',     Icon: ClipboardList, pathFn: (_: number, nom: string) => `/admin/test/hr?obyekt=${encodeURIComponent(nom)}` },
  { nomi: 'Texnadzor / Sifat',     color: 'red',     Icon: ShieldCheck,   pathFn: (_: number, nom: string) => `/admin/test/nuqson?obyekt=${encodeURIComponent(nom)}` },
];

/* ─────────────────────────────────────────────────────────
   BEZIER PATH HELPER
───────────────────────────────────────────────────────── */
function bezier(x1: number, y1: number, x2: number, y2: number, color = '#334155', thick = 2) {
  const cx = (x1 + x2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
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

  // pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  // zoom
  const zoom = useMotionValue(0.7);
  const smoothZoom = useSpring(zoom, { damping: 24, stiffness: 220 });

  useEffect(() => {
    setYuklanmoqda(true);
    sbT2ObyektlarOl().then(r => {
      setObyektlar(r.qatorlar || []);
      setYuklanmoqda(false);
    });
  }, [aktKomp]);

  /* Center canvas on mount */
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
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  const onMouseUp = () => { dragging.current = false; };

  const nav = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(path);
  };

  /* ── LAYOUT MATH ── */
  const totalSubH = (OBJ_SUBS.length) * (SUB_H + SUB_GAP) - SUB_GAP;
  const obRowH = Math.max(OB_H, totalSubH);
  const rowStep = obRowH + OB_GAP;
  const totalObH = obyektlar.length * rowStep - OB_GAP;

  // HQ center Y = canvas center
  const hqCY = HQ_Y;
  // Objects start Y (vertically centered relative to HQ)
  const objStartY = hqCY - totalObH / 2;

  /* Global modules layout (above/below HQ on left side) */
  const glTotalH = GLOBAL_MODS.length * (SUB_H + SUB_GAP) - SUB_GAP;
  const glX = HQ_X - 240;
  const glStartY = hqCY - glTotalH / 2;

  const OBJ_SUB_X = OBJ_X + OB_W + 60;  // x for sub-modules

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
      {/* ── TOP BAR ── */}
      <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-center z-50 bg-bg/90 backdrop-blur-md border-b border-border">
        <h1 className="text-base font-bold text-text flex items-center gap-2">
          <Map size={18} className="text-accent" />
          Tizim_02 — Arxitektura Xaritasi
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-dim">
            {Math.round(zoom.get() * 100)}%
          </span>
          <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg">
            <button onClick={() => zoom.set(Math.max(zoom.get() - 0.15, 0.2))} className="p-1.5 hover:bg-surface-2 text-text rounded"><ZoomOut size={16}/></button>
            <button onClick={() => { zoom.set(0.7); }} className="p-1.5 hover:bg-surface-2 text-text rounded"><Maximize2 size={16}/></button>
            <button onClick={() => zoom.set(Math.min(zoom.get() + 0.15, 2.5))} className="p-1.5 hover:bg-surface-2 text-text rounded"><ZoomIn size={16}/></button>
          </div>
        </div>
      </div>

      {/* ── CANVAS ── */}
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
        {/* ════ SVG LAYER (connectors) ════ */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {/* HQ → Global modules (left side) */}
          {GLOBAL_MODS.map((m, i) => {
            const leafY = glStartY + i * (SUB_H + SUB_GAP) + SUB_H / 2;
            return bezier(
              HQ_X, hqCY,
              glX + SUB_W, leafY,
              COLORS[m.color], 2
            );
          })}

          {/* HQ → Objects */}
          {obyektlar.map((_, i) => {
            const oy = objStartY + i * rowStep + OB_H / 2;
            return bezier(
              HQ_X + HQ_W, hqCY,
              OBJ_X, oy,
              COLORS['accent'], 2.5
            );
          })}

          {/* Objects → Sub-modules */}
          {obyektlar.map((ob, i) => {
            const oy = objStartY + i * rowStep;
            const subGroupTop = oy + (OB_H / 2) - (totalSubH / 2);
            return OBJ_SUBS.map((s, j) => {
              const sy = subGroupTop + j * (SUB_H + SUB_GAP) + SUB_H / 2;
              return bezier(
                OBJ_X + OB_W, oy + OB_H / 2,
                OBJ_SUB_X, sy,
                COLORS[s.color], 1.5
              );
            });
          })}
        </svg>

        {/* ════ GLOBAL MODULES (left side) ════ */}
        {GLOBAL_MODS.map((m, i) => {
          const y = glStartY + i * (SUB_H + SUB_GAP);
          return (
            <foreignObject key={m.nomi} x={glX} y={y} width={SUB_W} height={SUB_H}>
              <div
                onClick={(e) => nav(m.path, e)}
                className="w-full h-full px-3 flex items-center justify-between gap-2 bg-surface border border-border rounded-lg text-sm cursor-pointer group transition-all hover:border-accent/60 hover:shadow-md hover:shadow-accent/10"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <m.Icon size={14} className={`text-${m.color}-500 shrink-0`} />
                  <span className="font-medium text-text group-hover:text-accent truncate text-xs">{m.nomi}</span>
                </div>
                <ChevronRight size={12} className="text-text-dim shrink-0" />
              </div>
            </foreignObject>
          );
        })}

        {/* ════ HQ NODE ════ */}
        <foreignObject x={HQ_X} y={HQ_Y - HQ_H / 2} width={HQ_W} height={HQ_H}>
          <motion.div
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}
            className="w-full h-full flex flex-col items-center justify-center bg-surface border-2 border-accent/60 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.25)] text-center p-3"
          >
            <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center mb-2">
              <Building2 size={22} className="text-accent" />
            </div>
            <h2 className="text-sm font-black text-text leading-tight">Bosh Kompaniya</h2>
            <span className="text-[10px] mt-1 px-2 py-0.5 bg-surface-2 text-text-dim rounded-full">Boshqaruv Markazi</span>
          </motion.div>
        </foreignObject>

        {/* ════ OBJECT NODES + SUB-MODULES ════ */}
        {yuklanmoqda && (
          <foreignObject x={OBJ_X} y={HQ_Y - 20} width={220} height={40}>
            <div className="text-text-dim text-sm animate-pulse">Yuklanmoqda...</div>
          </foreignObject>
        )}

        {obyektlar.map((ob, i) => {
          const oy = objStartY + i * rowStep;
          const subGroupTop = oy + (OB_H / 2) - (totalSubH / 2);

          return (
            <g key={ob.id}>
              {/* Object node */}
              <foreignObject x={OBJ_X} y={oy} width={OB_W} height={OB_H}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  onClick={(e) => nav(`/admin/test/daraxt?obyekt=${encodeURIComponent(ob.nom)}`, e)}
                  className="w-full h-full flex items-center gap-2 px-3 bg-surface border border-border rounded-xl shadow-md cursor-pointer group hover:border-accent hover:shadow-accent/20 hover:shadow-lg transition-all"
                >
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                    <HardHat size={16} className="text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-text group-hover:text-accent truncate leading-tight">{ob.nom}</p>
                    <p className="text-[10px] text-text-dim truncate">{ob.tur || 'Qurilish obyekti'}</p>
                  </div>
                </motion.div>
              </foreignObject>

              {/* Sub-module leaves */}
              {OBJ_SUBS.map((s, j) => {
                const sy = subGroupTop + j * (SUB_H + SUB_GAP);
                return (
                  <foreignObject key={s.nomi} x={OBJ_SUB_X} y={sy} width={SUB_W} height={SUB_H}>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 + j * 0.03 }}
                      onClick={(e) => nav(s.pathFn(ob.id, ob.nom), e)}
                      className={`w-full h-full px-3 flex items-center gap-2 bg-bg border border-border rounded-lg text-xs cursor-pointer group hover:border-${s.color}-500/50 hover:shadow-sm hover:shadow-${s.color}-500/10 transition-all`}
                    >
                      <s.Icon size={13} className={`text-${s.color}-500 shrink-0`} />
                      <span className={`font-medium text-text group-hover:text-${s.color}-400 truncate`}>{s.nomi}</span>
                    </motion.div>
                  </foreignObject>
                );
              })}
            </g>
          );
        })}

        {!yuklanmoqda && obyektlar.length === 0 && (
          <foreignObject x={OBJ_X} y={HQ_Y - 60} width={260} height={120}>
            <div className="w-full h-full flex items-center justify-center bg-surface border border-border rounded-xl text-text-dim text-sm text-center p-4">
              Obyektlar mavjud emas.<br />
              <span className="text-accent cursor-pointer" onClick={(e) => nav('/admin/test/settings', e)}>Tizimga qo'shing</span>
            </div>
          </foreignObject>
        )}
      </motion.div>
    </div>
  );
}
