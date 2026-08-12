import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode, memo } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';

export type DaraxtTugun = {
  kalit: string;              // uid (akt) yoki "varaq#row" (smeta)
  type: string;               // rz | bl | rs | mat | ob
  nom: string;
  kod?: string;
  bir?: string;
  hajm?: number;
  summa?: number;
  belgi?: ReactNode;          // o'ng chetdagi qiymat
  children?: DaraxtTugun[];
};

const TUR_RANG: Record<string, string> = {
  bl: 'var(--t-bl, #c084fc)', rs: 'var(--t-rs, #60a5fa)', mat: 'var(--t-mat, #facc15)', ob: 'var(--t-ob, #2dd4bf)',
};
const TUR_NOM: Record<string, string> = { bl: 'ИШ', rs: 'РЕС', mat: 'МАТ', ob: 'ОБ' };

// Gap drop zone — smeta qatorlari orasiga tashlash uchun
const GapZone = memo(function GapZone({
  smetaKalit, daraja, onGapDrop,
}: {
  smetaKalit: string; daraja: number; onGapDrop: (aktKalit: string, smetaKalit: string) => void;
}) {
  const [aktiv, setAktiv] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAktiv(true); }}
      onDragLeave={() => setAktiv(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setAktiv(false);
        const aktKalit = e.dataTransfer.getData('text/plain');
        if (aktKalit) onGapDrop(aktKalit, smetaKalit);
      }}
      style={{
        height: aktiv ? 22 : 5,
        background: aktiv ? 'rgba(16,185,129,0.25)' : 'transparent',
        borderRadius: 3,
        boxShadow: aktiv ? '0 0 0 1px rgba(16,185,129,0.6)' : 'none',
        paddingLeft: 8 + daraja * 18,
        paddingRight: 10,
        margin: aktiv ? '1px 0' : '0',
        transition: 'all 100ms',
        display: 'flex',
        alignItems: 'center',
        cursor: 'copy',
      }}
    >
      {aktiv && (
        <span style={{ color: '#34d399', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', userSelect: 'none' }}>
          ↓ Shu yerga qo'shimcha qilib qo'shish
        </span>
      )}
    </div>
  );
});

const DaraxtQator = memo(function DaraxtQator({
  t, daraja, bolalari, bog, yoritilgan, drop, yopiqHas,
  sudraladi, tashlanadi, onTashla, setHover, setUstida, toggle, onBogBekor,
  onDopClick, onOtishClick, takliflar, onTaklifTanlandi, scrollRef,
}: {
  t: DaraxtTugun; daraja: number; bolalari: boolean; bog: boolean; yoritilgan: boolean; drop: boolean; yopiqHas: boolean;
  sudraladi?: boolean; tashlanadi?: boolean;
  onTashla?: (aktKalit: string, smetaKalit: string) => void;
  setHover: (k: string | null) => void; setUstida: (k: string | null) => void;
  toggle: (k: string) => void; onBogBekor?: (kalit: string) => void;
  onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;
  takliflar?: Record<string, any[]>;
  onTaklifTanlandi?: (uid: string, cand: any) => void;
  scrollRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={scrollRef}
      draggable={sudraladi && t.type !== 'rz'}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.kalit); e.dataTransfer.effectAllowed = 'link'; }}
      onDragOver={tashlanadi ? (e) => { e.preventDefault(); setUstida(t.kalit); } : undefined}
      onDragLeave={tashlanadi ? () => setUstida(null) : undefined}
      onDrop={tashlanadi ? (e) => {
        e.preventDefault();
        setUstida(null);
        const aktKalit = e.dataTransfer.getData('text/plain');
        if (aktKalit && onTashla) onTashla(aktKalit, t.kalit);
      } : undefined}
      onMouseEnter={() => setHover(t.kalit)}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (bolalari) toggle(t.kalit);
      }}
      className={`flex items-center gap-2 border-b border-border/60 text-[13px]
                  transition-colors duration-[120ms] min-h-[32px] group
                  ${drop ? 'bg-emerald-500/20 ring-1 ring-emerald-500'
                    : yoritilgan ? 'bg-[var(--accent)]/[.15] ring-1 ring-[var(--accent)]/30'
                    : bog ? 'bg-emerald-500/10 border-l-[3px] border-l-emerald-500' 
                    : t.type === 'rz' ? 'bg-[var(--surface-2)]/40 border-l-[3px] border-l-transparent'
                    : 'hover:bg-[var(--surface-2)]/40 border-l-[3px] border-l-transparent'}
                  ${sudraladi && t.type !== 'rz' ? 'cursor-grab active:cursor-grabbing' : bolalari ? 'cursor-pointer' : ''}`}
      style={{ paddingLeft: 8 + daraja * 18, paddingRight: 10 }}
    >
      <span className="w-5 flex-shrink-0 text-text-mute flex items-center justify-center">
        {bolalari && (
          <button onClick={(e) => { e.stopPropagation(); toggle(t.kalit); }} className="cursor-pointer hover:text-white transition-colors p-1 rounded hover:bg-white/10">
            {yopiqHas ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </span>

      {t.type !== 'rz' && (
        <div className="flex-shrink-0 flex items-center gap-1" style={{ width: 88 }}>
           {bog ? (
             <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform" title="Bog'langan — bosib bekor qilish">
               {onBogBekor ? (
                 <button onClick={(e) => { e.stopPropagation(); onBogBekor(t.kalit); }} className="cursor-pointer hover:text-red-400 transition-colors" title="Bekor qilish">
                   <CheckCircle2 size={16} />
                 </button>
               ) : <CheckCircle2 size={16} />}
             </span>
           ) : (
             <span className="w-6 h-6 flex items-center justify-center text-text-mute opacity-30">—</span>
           )}
           
           {/* → tugmasi: akt tarafida bog'langan bo'lsa smeta tarafiga o'tish */}
           {bog && onOtishClick && (
             <button
               onClick={(e) => { e.stopPropagation(); onOtishClick(t.kalit); }}
               className="w-6 h-6 flex items-center justify-center rounded bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25 hover:scale-110 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
               title="Bog'langan smeta qatorini ko'rsatish →"
             >
               <ArrowRight size={13} />
             </button>
           )}

           {/* + tugmasi: bog'lanmagan bo'lsa dop qilish */}
           {!bog && sudraladi && t.type !== 'rz' && onDopClick && (
             <button onClick={(e) => { e.stopPropagation(); onDopClick(t.kalit); }} className="w-6 h-6 ml-0.5 flex items-center justify-center rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:scale-110 transition-all cursor-pointer" title="Smetaga qo'shimcha ish qilib qo'shish (Dop)">
               <span className="text-[14px] font-bold leading-none">+</span>
             </button>
           )}

           {/* Takliflar (faqat chap taraf uchun) */}
           {!bog && takliflar && takliflar[t.kalit] && takliflar[t.kalit].length > 0 && onTaklifTanlandi && (
             <div className="relative group/taklif">
               <button onClick={(e) => e.stopPropagation()} className="w-6 h-6 ml-0.5 flex items-center justify-center rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:scale-110 transition-all cursor-pointer" title="Taklif qilingan variantlar">
                 <span className="text-[12px] font-bold">🎯</span>
               </button>
               <div className="absolute left-full top-0 ml-2 bg-slate-800 border border-slate-700 rounded shadow-xl p-2 z-50 hidden group-hover/taklif:block w-[400px]">
                 <div className="text-[11px] text-slate-400 mb-2 font-semibold">Takliflar ({takliflar[t.kalit].length}):</div>
                 <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1">
                   {takliflar[t.kalit].map((c: any, i: number) => (
                     <div key={i} onClick={(e) => { e.stopPropagation(); onTaklifTanlandi(t.kalit, c.varaq+'#'+c.row); }} className="bg-slate-700/50 hover:bg-emerald-500/20 border border-slate-600 hover:border-emerald-500/40 rounded p-1.5 cursor-pointer transition-colors text-[11px]">
                       <div className="font-semibold text-emerald-400 mb-1">{c.nom}</div>
                       <div className="flex justify-between text-[10px] text-slate-400">
                         <span>Varaq: {c.varaq}</span>
                         <span>Qator: {c.row}</span>
                         <span>Kod: {c.kod}</span>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           )}

           {/* Tur belgisi */}
           <span className="text-[10px] font-bold tracking-wider opacity-70 ml-0.5" style={{ color: TUR_RANG[t.type] || '#ccc' }} title={TUR_NOM[t.type]}>
              {TUR_NOM[t.type]}
           </span>
        </div>
      )}

      <div className={`min-w-0 flex-1 py-1.5 ${bog ? 'opacity-100' : 'opacity-80'}`}>
        <div className={`whitespace-normal leading-tight break-words ${t.type === 'rz' ? 'text-white font-bold tracking-wide' : bog ? 'text-emerald-50 font-medium' : 'text-slate-200'}`} title={t.nom}>
          {t.nom}
        </div>
        {(t.kod || t.bir) && (
          <div className={`text-[11px] mt-0.5 whitespace-normal ${bog ? 'text-emerald-400/60' : 'text-slate-400'}`}>
            {t.kod && <span className="mr-2 font-mono bg-black/20 px-1.5 py-0.5 rounded">{t.kod}</span>}
            <span className="italic">{t.bir}</span>
          </div>
        )}
      </div>

      <span className={`flex-shrink-0 tabular-nums text-[13px] max-w-[240px] ${bog ? 'text-emerald-400 font-bold' : 'text-slate-400 font-medium'}`}>{t.belgi}</span>
    </div>
  );
});

export function F2Daraxt({
  tugunlar, bogMi, dopMi, hover, setHover, onBogBekor,
  sudraladi, tashlanadi, onTashla, onGapDrop, bosh,
  filtr = 'hammasi',
  ochiqYopiqSignal = 0,
  onDopClick,
  onOtishClick,
  scrollToKey, takliflar, onTaklifTanlandi,
}: {
  tugunlar: DaraxtTugun[];
  bogMi: (kalit: string) => boolean;
  dopMi?: (kalit: string) => boolean;
  hover: string | null;
  setHover: (k: string | null) => void;
  onBogBekor?: (kalit: string) => void;
  sudraladi?: boolean;
  tashlanadi?: boolean;
  onTashla?: (aktKalit: string, smetaKalit: string) => void;
  onGapDrop?: (aktKalit: string, smetaKalit: string) => void;
  bosh?: string;
  filtr?: 'hammasi' | 'boglanmagan' | 'boglangan' | 'qolDop';
  ochiqYopiqSignal?: number;
  onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;
  scrollToKey?: string | null; takliflar?: Record<string, any[]>; onTaklifTanlandi?: (uid: string, cand: any) => void;
}) {
  const [yopiq, setYopiq] = useState<Set<string>>(new Set());
  const [ustida, setUstida] = useState<string | null>(null);
  const [yoritilganKey, setYoritilganKey] = useState<string | null>(null);
  const lastSignal = useRef(ochiqYopiqSignal);
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (ochiqYopiqSignal === lastSignal.current) return;
    lastSignal.current = ochiqYopiqSignal;
    
    if (ochiqYopiqSignal && ochiqYopiqSignal > 0) {
      setYopiq(new Set());
    } else if (ochiqYopiqSignal && ochiqYopiqSignal < 0) {
      const rzs = new Set<string>();
      const yur = (ns: DaraxtTugun[]) => ns.forEach(n => {
        if (n.type === 'rz' || n.children?.length) {
          rzs.add(n.kalit);
          if (n.children) yur(n.children);
        }
      });
      yur(tugunlar);
      setYopiq(rzs);
    }
  }, [ochiqYopiqSignal, tugunlar]);

  const lastScrolled = useRef<string | null>(null);

  // scrollToKey o'zgarganda — shu qatorni ochib scroll qilamiz
  useEffect(() => {
    if (!scrollToKey) {
      lastScrolled.current = null;
      return;
    }
    if (scrollToKey === lastScrolled.current) return;
    
    // Shu kalitning ota-bobolari bo'lgan yopiq daraxtni ochamiz
    const ochishKerak = new Set<string>();
    const topOta = (ns: DaraxtTugun[], targetKey: string, path: string[]): boolean => {
      for (const n of ns) {
        if (n.kalit === targetKey) {
          path.forEach(k => ochishKerak.add(k));
          return true;
        }
        if (n.children && topOta(n.children, targetKey, [...path, n.kalit])) return true;
      }
      return false;
    };
    topOta(tugunlar, scrollToKey, []);
    
    if (ochishKerak.size > 0) {
      setYopiq(p => {
        const yangi = new Set(p);
        ochishKerak.forEach(k => yangi.delete(k));
        return yangi;
      });
    }
    
    const timer = setTimeout(() => {
      const el = scrollRefs.current.get(scrollToKey);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setYoritilganKey(scrollToKey);
        lastScrolled.current = scrollToKey;
        setTimeout(() => setYoritilganKey(null), 2500);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [scrollToKey, tugunlar]);

  const toggle = (k: string) =>
    setYopiq((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const setScrollRef = useCallback((kalit: string) => (el: HTMLDivElement | null) => {
    if (el) scrollRefs.current.set(kalit, el);
    else scrollRefs.current.delete(kalit);
  }, []);

  const qatorlar = useMemo(() => {
    const out: { t: DaraxtTugun; daraja: number }[] = [];
    
    const filtrla = (ns: DaraxtTugun[]): DaraxtTugun[] => {
      const res: DaraxtTugun[] = [];
      for (const n of ns) {
        if (n.type === 'rz') {
          const fBolalar = filtrla(n.children ?? []);
          if (fBolalar.length > 0 || filtr === 'hammasi') {
            res.push({ ...n, children: fBolalar });
          }
        } else {
          const bog = bogMi(n.kalit);
          const dop = dopMi ? dopMi(n.kalit) : n.kalit.startsWith('dop_');
          
          let matches = false;
          if (filtr === 'hammasi') matches = true;
          else if (filtr === 'boglangan') matches = bog && !dop;
          else if (filtr === 'boglanmagan') matches = !bog && !dop;
          else if (filtr === 'qolDop') matches = dop;

          let fBolalar: DaraxtTugun[] = [];
          if (n.children?.length) fBolalar = filtrla(n.children);
          if (matches || fBolalar.length > 0) res.push({ ...n, children: fBolalar });
        }
      }
      return res;
    };

    const filtrlanganTugunlar = filtrla(tugunlar);
    const yur = (ns: DaraxtTugun[], d: number) => {
      ns.forEach((t) => {
        out.push({ t, daraja: d });
        if (t.children?.length && !yopiq.has(t.kalit)) yur(t.children, d + 1);
      });
    };
    yur(filtrlanganTugunlar, 0);
    return out;
  }, [tugunlar, yopiq, bogMi, filtr]);

  if (!tugunlar.length) {
    return <div className="p-6 text-center text-text-mute text-sm">{bosh ?? 'Bo\'sh'}</div>;
  }

  return (
    <div className="text-[13px]">
      {qatorlar.map(({ t, daraja }, idx) => {
        const bog = bogMi(t.kalit);
        const drop = ustida === t.kalit;
        const yoritilgan = yoritilganKey === t.kalit || (hover !== null && hover === t.kalit);
        const bolalari = !!(t.children?.length);
        const yopiqHas = yopiq.has(t.kalit);
        const prevType = idx > 0 ? qatorlar[idx - 1].t.type : null;
        
        return (
          <div key={t.kalit}>
            {/* Gap drop zone — faqat smeta tarafida, qatorlar orasida */}
            {tashlanadi && onGapDrop && t.type !== 'rz' && prevType && prevType !== 'rz' && (
              <GapZone
                smetaKalit={t.kalit}
                daraja={daraja}
                onGapDrop={onGapDrop}
              />
            )}
            
            <DaraxtQator
              t={t}
              daraja={daraja}
              bolalari={bolalari}
              bog={bog}
              yoritilgan={yoritilgan}
              drop={drop}
              yopiqHas={yopiqHas}
              sudraladi={sudraladi}
              tashlanadi={tashlanadi}
              onTashla={onTashla}
              setHover={setHover}
              setUstida={setUstida}
              toggle={toggle}
              onBogBekor={onBogBekor}
              onDopClick={onDopClick}
              onOtishClick={bog ? onOtishClick : undefined}
              scrollRef={setScrollRef(t.kalit)} takliflar={takliflar} onTaklifTanlandi={onTaklifTanlandi}
            />
          </div>
        );
      })}
    </div>
  );
}
