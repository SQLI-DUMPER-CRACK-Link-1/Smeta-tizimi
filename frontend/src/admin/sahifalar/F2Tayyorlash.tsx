import { useMemo, useState, useEffect } from 'react';
import { useObyektlar, useHolat, useF2HujjatYarat } from '../../api/hooks';
import {
  Sahifa, Holatlar, KpiKarta, Qidiruv, Tanlov, Tugma, Kiritma, Nishon,
} from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';
import { FileOutput, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { TreeNode } from '../../api/types';

/** Ф2 ga olish mumkin bo'lgan barg qator */
type Barg = {
  kalit: string;
  varaq: string; row: number;
  rzNom: string; blNom: string;
  blKod: string; blBir: string;
  type: string; kod: string; nom: string; bir: string;
  narx: number; fakt: number; f2ol: number; f2mum: number;
};

const TUR_RANG: Record<string, string> = {
  rs: 'var(--t-rs)', mat: 'var(--t-mat)', ob: 'var(--t-ob)', bl: 'var(--t-bl)',
};
const TUR_BELGI: Record<string, string> = { rs: '🔹', mat: '🧱', ob: '⚙️', bl: '🔧' };

/** Daraxtni yassilaydi — razdel/ish konteksti bilan (panel _f2TayFlatten kabi) */
function yassila(nodes: TreeNode[] = []): Barg[] {
  const out: Barg[] = [];
  const yur = (ns: TreeNode[], rzNom: string, blNom: string, blKod: string, blBir: string) => {
    (ns ?? []).forEach((n: any) => {
      if (n.type === 'rz') { yur(n.children ?? [], n.nom, '', '', ''); return; }
      if (n.type === 'bl') { yur(n.children ?? [], rzNom, n.nom, n.kod ?? '', n.birlik ?? ''); return; }
      if (n.type === 'rs' || n.type === 'mat' || n.type === 'ob') {
        out.push({
          kalit: `${n.varaq}#${n.row}`,
          varaq: n.varaq, row: n.row, rzNom, blNom, blKod, blBir,
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
  const [tanlov, setTanlov] = useState<Record<string, number>>({});   // kalit → hajm
  const [ochiq, setOchiq] = useState<Record<string, boolean>>({});
  const [natija, setNatija] = useState<{ url?: string; name?: string; jami?: number; soni?: number } | null>(null);

  useEffect(() => { setTanlov({}); setNatija(null); }, [obyekt]);

  const obNomlari = useMemo(
    () => Array.from(new Set((obyektlar.data ?? []).map((o) => o.obyekt.split(' - ')[0]))),
    [obyektlar.data],
  );

  /** Faqat Ф2 ga olish mumkin bo'lganlar */
  const barglar = useMemo(
    () => yassila(holat.data?.tree ?? []).filter((b) => b.f2mum > 0.0001),
    [holat.data],
  );

  const korinadigan = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s) return barglar;
    return barglar.filter((b) => b.nom.toUpperCase().includes(s) || b.rzNom.toUpperCase().includes(s));
  }, [barglar, q]);

  /** Razdel bo'yicha guruhlash */
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
    setTanlov((p) => {
      const n = { ...p };
      if (on) n[b.kalit] = b.f2mum; else delete n[b.kalit];
      return n;
    });
  }
  function hajmOzgart(b: Barg, v: string) {
    const h = Number(String(v).replace(/[^\d.-]/g, ''));
    setTanlov((p) => ({ ...p, [b.kalit]: isFinite(h) ? h : 0 }));
  }
  function razdelBelgila(list: Barg[], on: boolean) {
    setTanlov((p) => {
      const n = { ...p };
      list.forEach((b) => { if (on) n[b.kalit] = b.f2mum; else delete n[b.kalit]; });
      return n;
    });
  }

  async function hujjatYarat() {
    const items = barglar
      .filter((b) => tanlov[b.kalit] > 0)
      .map((b) => ({
        rzNom: b.rzNom, blNom: b.blNom, type: b.type,
        kod: b.kod, nom: b.nom, bir: b.bir,
        hajm: tanlov[b.kalit], narx: b.narx,
      }));
    if (!items.length) { toast('Hech narsa tanlanmadi'); return; }
    try {
      const r = await yarat.mutateAsync({ obyekt, oyNom, items });
      if (!r.ok) { toast('Hujjat yaratilmadi'); return; }
      setNatija(r);
      toast(`Ф2 tayyor: ${r.soni} qator`);
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  return (
    <Sahifa
      sarlavha="Ф2 тайёрлаш"
      tavsif="Smetadan yangi Ф2 (КС-2) hujjatini yasash — faqat olish mumkin bo'lgan qoldiqdan"
      yangilangan={holat.dataUpdatedAt}
      onYangila={() => holat.refetch()}
      yangilanmoqda={holat.isFetching}
      amallar={
        <div className="flex items-center gap-3 flex-wrap">
          <Tanlov qiymat={obyekt} ozgardi={setObyekt} variantlar={['', ...obNomlari]} />
          <Kiritma qiymat={oyNom} ozgardi={setOyNom} placeholder="07.2026" />
          <Qidiruv qiymat={q} ozgardi={setQ} placeholder="Nomi yoki razdel…" />
        </div>
      }
    >
      {!obyekt ? (
        <div className="karta py-16 text-center">
          <FileOutput size={40} className="mx-auto text-text-mute mb-3" strokeWidth={1.5} />
          <p className="text-text font-medium">Obyektni tanlang</p>
          <p className="text-sm text-text-dim mt-1">Ф2 ga olish mumkin bo'lgan qatorlar ro'yxati ochiladi</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiKarta nom="Olish mumkin" qiymat={barglar.length} ost="qator" />
            <KpiKarta nom="Mumkin summa" qiymat={<FmtN val={mumkinJami} qisqa />} ost="so'm" />
            <KpiKarta nom="Tanlandi" qiymat={jami.soni} />
            <KpiKarta nom="Tanlangan summa" qiymat={<FmtN val={jami.summa} qisqa />} ost="so'm" />
          </div>

          {natija && (
            <div className="rounded-[10px] border border-ok/25 bg-ok/[.08] p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-text font-medium">✅ {natija.name}</p>
                <p className="text-sm text-text-dim tabular-nums">
                  {natija.soni} qator · <FmtN val={natija.jami} /> so'm
                </p>
              </div>
              {natija.url && (
                <a href={natija.url} target="_blank" rel="noreferrer"
                   className="h-9 px-4 inline-flex items-center gap-2 rounded-[10px] bg-accent text-white text-sm font-medium">
                  <ExternalLink size={16} /> Hujjatni ochish
                </a>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Tugma tur="primary" onBos={hujjatYarat} band={yarat.isPending || jami.soni === 0} ikonka={<FileOutput size={16} />}>
              {yarat.isPending ? 'Yasalmoqda…' : `Ф2 hujjatini yasash (${jami.soni})`}
            </Tugma>
            {jami.soni > 0 && <Tugma onBos={() => setTanlov({})}>Tanlovni tozalash</Tugma>}
          </div>

          <Holatlar
            soragan={holat}
            bosh={{ matn: 'Ф2 ga olish mumkin qator yo‘q', izoh: 'Avval FAKT kiriting — Ф2 mumkin = fakt − olingan Ф2.' }}
          >
            {() => guruhlar.length === 0 ? (
              <div className="karta py-12 text-center text-text-dim text-sm">
                {barglar.length === 0 ? 'Bu obyektda Ф2 ga olish mumkin qator yo‘q' : 'Qidiruvga mos qator yo‘q'}
              </div>
            ) : (
              <div className="space-y-3">
                {guruhlar.map(([rz, list]) => {
                  const ochiqmi = ochiq[rz] !== false;
                  const rzSumma = list.reduce((a, b) => a + b.f2mum * b.narx, 0);
                  const tanlanganSoni = list.filter((b) => tanlov[b.kalit] > 0).length;
                  return (
                    <div key={rz} className="karta overflow-hidden">
                      <div className="px-4 py-3 bg-[var(--surface-2)]/50 border-b border-border flex items-center gap-3">
                        <button onClick={() => setOchiq((p) => ({ ...p, [rz]: !ochiqmi }))}
                                className="text-text-dim hover:text-text cursor-pointer">
                          {ochiqmi ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <input
                          type="checkbox"
                          checked={tanlanganSoni === list.length && list.length > 0}
                          ref={(el) => { if (el) el.indeterminate = tanlanganSoni > 0 && tanlanganSoni < list.length; }}
                          onChange={(e) => razdelBelgila(list, e.target.checked)}
                          className="accent-[var(--accent)] cursor-pointer"
                        />
                        <span className="text-text font-medium truncate flex-1" title={rz}>{rz}</span>
                        {tanlanganSoni > 0 && <Nishon matn={`${tanlanganSoni}/${list.length}`} tur="ok" />}
                        <span className="text-sm text-text-dim tabular-nums flex-shrink-0"><FmtN val={rzSumma} /></span>
                      </div>

                      {ochiqmi && (
                        <div className="divide-y divide-border">
                          {list.map((b) => {
                            const tanlandi = tanlov[b.kalit] > 0;
                            return (
                              <div key={b.kalit}
                                   className={`px-4 py-2 flex items-center gap-3 text-[13px] transition-colors
                                               ${tanlandi ? 'bg-[var(--accent)]/[.06]' : 'hover:bg-[var(--surface-2)]/40'}`}>
                                <input
                                  type="checkbox" checked={tanlandi}
                                  onChange={(e) => belgila(b, e.target.checked)}
                                  className="accent-[var(--accent)] cursor-pointer flex-shrink-0"
                                />
                                <span className="flex-shrink-0" style={{ color: TUR_RANG[b.type] }} title={b.type}>
                                  {TUR_BELGI[b.type] ?? '•'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-text truncate" title={b.nom}>{b.nom}</div>
                                  <div className="text-[11px] text-text-mute truncate">
                                    {b.kod && <span className="mr-2">{b.kod}</span>}
                                    {b.blNom && <span className="opacity-70">{b.blNom}</span>}
                                  </div>
                                </div>
                                <span className="text-text-mute w-16 text-right flex-shrink-0">{b.bir}</span>
                                <span className="text-text-dim w-28 text-right tabular-nums flex-shrink-0" title="Ф2 ga olish mumkin">
                                  <FmtN val={b.f2mum} />
                                </span>
                                <input
                                  type="number"
                                  value={tanlov[b.kalit] ?? ''}
                                  placeholder={String(b.f2mum)}
                                  onChange={(e) => hajmOzgart(b, e.target.value)}
                                  className="input h-8 px-2 w-28 text-right tabular-nums text-[13px] flex-shrink-0"
                                  title="Olinadigan hajm"
                                />
                                <span className="text-text w-32 text-right tabular-nums flex-shrink-0">
                                  <FmtN val={(tanlov[b.kalit] ?? 0) * b.narx} />
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Holatlar>
        </>
      )}
    </Sahifa>
  );
}

export default F2Tayyorlash;
