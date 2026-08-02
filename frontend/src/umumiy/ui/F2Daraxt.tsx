import { useMemo, useState, useEffect, type ReactNode, memo } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

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

const DaraxtQator = memo(function DaraxtQator({
  t, daraja, bolalari, bog, yoritilgan, drop, yopiqHas,
  sudraladi, tashlanadi, onTashla, setHover, setUstida, toggle, onBogBekor
}: {
  t: DaraxtTugun; daraja: number; bolalari: boolean; bog: boolean; yoritilgan: boolean; drop: boolean; yopiqHas: boolean;
  sudraladi?: boolean; tashlanadi?: boolean;
  onTashla?: (aktKalit: string, smetaKalit: string) => void;
  setHover: (k: string | null) => void; setUstida: (k: string | null) => void;
  toggle: (k: string) => void; onBogBekor?: (kalit: string) => void;
}) {
  return (
    <div
      draggable={sudraladi && t.type !== 'rz'}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.kalit); e.dataTransfer.effectAllowed = 'link'; }}
      onDragOver={tashlanadi && t.type !== 'rz' ? (e) => { e.preventDefault(); setUstida(t.kalit); } : undefined}
      onDragLeave={tashlanadi ? () => setUstida(null) : undefined}
      onDrop={tashlanadi && t.type !== 'rz' ? (e) => {
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
                    : yoritilgan ? 'bg-[var(--accent)]/[.10]'
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
        <div className="flex-shrink-0 flex items-center gap-2 w-[72px]">
           {bog ? (
             <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform" title="Bog'langan">
               {onBogBekor ? (
                 <button onClick={(e) => { e.stopPropagation(); onBogBekor(t.kalit); }} className="cursor-pointer hover:text-red-400">
                   <CheckCircle2 size={16} />
                 </button>
               ) : <CheckCircle2 size={16} />}
             </span>
           ) : (
             <span className="w-6 h-6 flex items-center justify-center text-text-mute opacity-30">—</span>
           )}
           <span className="text-[11px] font-bold tracking-wider opacity-80" style={{ color: TUR_RANG[t.type] || '#ccc' }} title={TUR_NOM[t.type]}>
              {TUR_NOM[t.type]}
           </span>
        </div>
      )}

      <div className={`min-w-0 flex-1 py-1.5 ${bog ? 'opacity-100' : 'opacity-80'}`}>
        <div className={`truncate ${t.type === 'rz' ? 'text-white font-bold tracking-wide' : bog ? 'text-emerald-50 font-medium' : 'text-slate-200'}`} title={t.nom}>
          {t.nom}
        </div>
        {(t.kod || t.bir) && (
          <div className={`text-[11px] truncate mt-0.5 ${bog ? 'text-emerald-400/60' : 'text-slate-400'}`}>
            {t.kod && <span className="mr-2 font-mono bg-black/20 px-1.5 py-0.5 rounded">{t.kod}</span>}
            <span className="italic">{t.bir}</span>
          </div>
        )}
      </div>

      <span className={`flex-shrink-0 tabular-nums text-[13px] ${bog ? 'text-emerald-400 font-bold' : 'text-slate-400 font-medium'}`}>{t.belgi}</span>
    </div>
  );
});

export function F2Daraxt({
  tugunlar, bogMi, hover, setHover, onBogBekor,
  sudraladi, tashlanadi, onTashla, bosh,
  filtr = 'hammasi',
  ochiqYopiqSignal = 0,
}: {
  tugunlar: DaraxtTugun[];
  /** shu tugun bog'langanmi (kalit bo'yicha) */
  bogMi: (kalit: string) => boolean;
  hover: string | null;
  setHover: (k: string | null) => void;
  onBogBekor?: (kalit: string) => void;
  sudraladi?: boolean;
  tashlanadi?: boolean;
  onTashla?: (aktKalit: string, smetaKalit: string) => void;
  bosh?: string;
  filtr?: 'hammasi' | 'boglanmagan' | 'boglangan';
  ochiqYopiqSignal?: number;
}) {
  const [yopiq, setYopiq] = useState<Set<string>>(new Set());
  const [ustida, setUstida] = useState<string | null>(null);

  // ochiqYopiqSignal o'zgarganda barchasini ochish yoki yopish
  useEffect(() => {
    if (ochiqYopiqSignal > 0) {
      setYopiq(new Set()); // Barchasini ochish
    } else if (ochiqYopiqSignal < 0) {
      // Barchasini yopish (faqat razdellarni)
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

  const toggle = (k: string) =>
    setYopiq((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  /** Ko'rinadigan qatorlarni filtrlash va tartiblash */
  const qatorlar = useMemo(() => {
    const out: { t: DaraxtTugun; daraja: number }[] = [];
    
    // 1-qadam: Daraxtni filtr bo'yicha chuqur tozalash (deep clone & filter)
    const filtrla = (ns: DaraxtTugun[]): DaraxtTugun[] => {
      const res: DaraxtTugun[] = [];
      for (const n of ns) {
        if (n.type === 'rz') {
          // Razdel faqat bolalari bor bo'lsa (yoki filter 'hammasi' bo'lsa) ko'rsatiladi
          const fBolalar = filtrla(n.children ?? []);
          if (fBolalar.length > 0 || filtr === 'hammasi') {
            res.push({ ...n, children: fBolalar });
          }
        } else {
          // Ish, Resurs, Material, Obyem (hammasi o'zi bog'lanishi mumkin)
          const bog = bogMi(n.kalit);
          const matches = filtr === 'hammasi' || (filtr === 'boglangan' && bog) || (filtr === 'boglanmagan' && !bog);
          
          let fBolalar: DaraxtTugun[] = [];
          if (n.children?.length) {
            fBolalar = filtrla(n.children);
          }
          
          // Agar o'zi mos kelsa YOKI bolalaridan biri mos kelsa, ro'yxatga qo'shamiz
          if (matches || fBolalar.length > 0) {
            res.push({ ...n, children: fBolalar });
          }
        }
      }
      return res;
    };

    const filtrlanganTugunlar = filtrla(tugunlar);

    // 2-qadam: Filtrlangan daraxtni yassilash (ko'rinish uchun)
    const yur = (ns: DaraxtTugun[], d: number) => {
      ns.forEach((t) => {
        out.push({ t, daraja: d });
        if (t.children?.length && !yopiq.has(t.kalit)) yur(t.children, d + 1);
      });
    };
    yur(filtrlanganTugunlar, 0);
    return out;
  }, [tugunlar, yopiq, filtr, bogMi]);

  if (!qatorlar.length) {
    return <p className="px-4 py-8 text-center text-sm text-text-mute">{bosh ?? 'Bo‘sh'}</p>;
  }

  return (
    <div className="pb-10">
      {qatorlar.map(({ t, daraja }) => (
        <DaraxtQator
          key={t.kalit}
          t={t}
          daraja={daraja}
          bolalari={!!t.children?.length}
          bog={t.type !== 'rz' && bogMi(t.kalit)}
          yoritilgan={hover === t.kalit}
          drop={ustida === t.kalit}
          yopiqHas={yopiq.has(t.kalit)}
          sudraladi={sudraladi}
          tashlanadi={tashlanadi}
          onTashla={onTashla}
          setHover={setHover}
          setUstida={setUstida}
          toggle={toggle}
          onBogBekor={onBogBekor}
        />
      ))}
    </div>
  );
}
