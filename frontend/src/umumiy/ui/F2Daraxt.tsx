/**
 * F2Daraxt — Ф2 импорт ikki panelidagi IERARXIK daraxt (panel'dagi kabi).
 *
 * Razdel → Ish → Resurs/Material/Uskuna. Har daraja ochiladi/yig'iladi,
 * chuqurlik chizig'i bilan. Chap panel (AKT) — sudraladigan, o'ng panel
 * (SMETA) — tashlanadigan. Shu bilan qo'lda bog'lash ishlaydi.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  bl: 'var(--t-bl)', rs: 'var(--t-rs)', mat: 'var(--t-mat)', ob: 'var(--t-ob)',
};
const TUR_BELGI: Record<string, string> = { bl: '🔧', rs: '🔹', mat: '🧱', ob: '⚙️' };
const TUR_NOM: Record<string, string> = { bl: 'ИШ', rs: 'РЕС', mat: 'МАТ', ob: 'ОБ' };

export function F2Daraxt({
  tugunlar, bogMi, hover, setHover, onBogBekor,
  sudraladi, tashlanadi, onTashla, bosh,
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
}) {
  const [yopiq, setYopiq] = useState<Set<string>>(new Set());
  const [ustida, setUstida] = useState<string | null>(null);

  const toggle = (k: string) =>
    setYopiq((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  /** Ko'rinadigan qatorlar — yopilganlarning bolalari chiqarilmaydi */
  const qatorlar = useMemo(() => {
    const out: { t: DaraxtTugun; daraja: number }[] = [];
    const yur = (ns: DaraxtTugun[], d: number) => {
      ns.forEach((t) => {
        out.push({ t, daraja: d });
        if (t.children?.length && !yopiq.has(t.kalit)) yur(t.children, d + 1);
      });
    };
    yur(tugunlar, 0);
    return out;
  }, [tugunlar, yopiq]);

  if (!tugunlar.length) {
    return <p className="px-4 py-8 text-center text-sm text-text-mute">{bosh ?? 'Bo‘sh'}</p>;
  }

  return (
    <div>
      {qatorlar.map(({ t, daraja }) => {
        const bolalari = !!t.children?.length;
        const bog = t.type !== 'rz' && bogMi(t.kalit);
        const yoritilgan = hover === t.kalit;
        const drop = ustida === t.kalit;

        return (
          <div
            key={t.kalit}
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
            className={`flex items-center gap-2 border-b border-border/60 text-[13px]
                        transition-colors duration-[120ms] min-h-[32px]
                        ${drop ? 'bg-[var(--ok)]/20 ring-1 ring-[var(--ok)]'
                          : yoritilgan ? 'bg-[var(--accent)]/[.10]'
                          : t.type === 'rz' ? 'bg-[var(--surface-2)]/40'
                          : 'hover:bg-[var(--surface-2)]/40'}
                        ${sudraladi && t.type !== 'rz' ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{ paddingLeft: 8 + daraja * 18, paddingRight: 10 }}
          >
            {/* Ochish/yig'ish */}
            <span className="w-4 flex-shrink-0 text-text-mute">
              {bolalari && (
                <button onClick={(e) => { e.stopPropagation(); toggle(t.kalit); }} className="cursor-pointer">
                  {yopiq.has(t.kalit) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </span>

            {/* Bog'lanish belgisi */}
            {t.type !== 'rz' && (
              <span className={`w-3 flex-shrink-0 text-center ${bog ? 'text-ok' : 'text-text-mute'}`}
                    title={bog ? 'bog‘langan — bekor qilish uchun bosing' : 'bog‘lanmagan'}>
                {bog && onBogBekor
                  ? <button onClick={(e) => { e.stopPropagation(); onBogBekor(t.kalit); }} className="cursor-pointer">●</button>
                  : bog ? '●' : '○'}
              </span>
            )}

            {/* Tur nishoni */}
            {t.type !== 'rz' && (
              <span className="flex-shrink-0 text-[11px] flex items-center gap-1"
                    style={{ color: TUR_RANG[t.type] }} title={TUR_NOM[t.type]}>
                {TUR_BELGI[t.type] ?? '•'}
                <span className="hidden xl:inline opacity-80">{TUR_NOM[t.type]}</span>
              </span>
            )}

            {/* Nom + kod */}
            <div className="min-w-0 flex-1 py-1">
              <div className={`truncate ${t.type === 'rz' ? 'text-text font-medium' : 'text-text'}`} title={t.nom}>
                {t.nom}
              </div>
              {(t.kod || t.bir) && (
                <div className="text-[11px] text-text-mute truncate">
                  {t.kod && <span className="mr-2">{t.kod}</span>}{t.bir}
                </div>
              )}
            </div>

            {/* O'ng chetdagi qiymat */}
            <span className="flex-shrink-0 tabular-nums text-text-dim text-[12px]">{t.belgi}</span>
          </div>
        );
      })}
    </div>
  );
}
