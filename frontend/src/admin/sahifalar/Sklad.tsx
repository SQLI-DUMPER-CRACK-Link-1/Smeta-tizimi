import { useMemo, useState } from 'react';
import { useSkladQoldiq, useSkladYoz } from '../../api/hooks';
import {
  Sahifa, Holatlar, Jadval, Nishon, KpiKarta, Qidiruv, Yon, Juft,
  Maydon, Kiritma, Tanlov, Tugma, type Ustun,
} from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';
import { ArrowDownToLine, ArrowUpFromLine, Plus } from 'lucide-react';
import type { SkladMaterial } from '../../api/types';

const QABUL_TURI = [
  { qiy: 'prarab', nom: 'Prorab / brigada' },
  { qiy: 'subpudrat', nom: 'Subpudrat tashkilot' },
  { qiy: 'blok', nom: 'Blok / obyekt' },
];

export function Sklad() {
  const soragan = useSkladQoldiq();
  const yoz = useSkladYoz();

  const [q, setQ] = useState('');
  const [filtr, setFiltr] = useState<'hammasi' | 'manfiy' | 'tugagan' | 'bor'>('hammasi');
  const [tanlangan, setTanlangan] = useState<SkladMaterial | null>(null);
  const [yangi, setYangi] = useState<{ ochiq: boolean; op: 'prixod' | 'rasxod' }>({ ochiq: false, op: 'prixod' });

  const [shakl, setShakl] = useState({
    obyomi: '', sanasi: '', turi: 'Прочее', kim: '', qabulTuri: 'prarab' as 'prarab' | 'subpudrat' | 'blok',
  });

  const hammasi = soragan.data?.materiallar ?? [];

  const satrlar = useMemo(() => {
    const s = q.trim().toUpperCase();
    return hammasi.filter((m) => {
      if (s && !m.nom.toUpperCase().includes(s)) return false;
      if (filtr === 'manfiy') return m.qoldiq < 0;
      if (filtr === 'tugagan') return m.qoldiq === 0;
      if (filtr === 'bor') return m.qoldiq > 0;
      return true;
    });
  }, [hammasi, q, filtr]);

  const stat = useMemo(() => ({
    turlari: hammasi.length,
    bor: hammasi.filter((m) => m.qoldiq > 0).length,
    tugagan: hammasi.filter((m) => m.qoldiq === 0).length,
    manfiy: hammasi.filter((m) => m.qoldiq < 0).length,
  }), [hammasi]);

  async function yozish() {
    if (!tanlangan) return;
    const obyomi = Number(String(shakl.obyomi).replace(/[^\d.-]/g, ''));
    if (!obyomi || obyomi <= 0) { toast("Hajm 0 dan katta bo'lsin"); return; }
    try {
      const r = await yoz.mutateAsync({
        operatsiya: yangi.op,
        data: {
          nomi: tanlangan.nom,
          birligi: tanlangan.birlik,
          obyomi,
          turi: shakl.turi,
          sanasi: shakl.sanasi || undefined,
          ...(yangi.op === 'prixod'
            ? { postavshik: shakl.kim }
            : { qabul_qiluvchi: shakl.kim, qabul_turi: shakl.qabulTuri }),
        },
      });
      if (r?.ok === false) { toast(r.error || 'Yozilmadi'); return; }
      toast(yangi.op === 'prixod' ? 'Kirim yozildi' : 'Chiqim yozildi');
      setYangi({ ...yangi, ochiq: false });
      setShakl({ ...shakl, obyomi: '', kim: '' });
      soragan.refetch();
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  const ustunlar: Ustun<SkladMaterial>[] = [
    { kalit: 'nom', nom: 'Material', chiz: (m) => <span className="text-text truncate block" title={m.nom}>{m.nom}</span> },
    { kalit: 'birlik', nom: 'Birlik', en: '90px', chiz: (m) => <span className="text-text-dim">{m.birlik || '—'}</span> },
    { kalit: 'kirim', nom: 'Kirim', raqam: true, en: '130px', chiz: (m) => <span className="text-text-dim"><FmtN val={m.kirim} /></span> },
    { kalit: 'chiqim', nom: 'Chiqim', raqam: true, en: '130px', chiz: (m) => <span className="text-text-dim"><FmtN val={m.chiqim} /></span> },
    {
      kalit: 'qoldiq', nom: 'Qoldiq', raqam: true, en: '140px',
      chiz: (m) => (
        <span className={m.qoldiq < 0 ? 'text-danger font-medium' : m.qoldiq === 0 ? 'text-warn' : 'text-text font-medium'}>
          <FmtN val={m.qoldiq} />
        </span>
      ),
    },
    {
      kalit: 'holat', nom: 'Holat', en: '120px',
      chiz: (m) => m.qoldiq < 0
        ? <Nishon matn="Manfiy" tur="danger" />
        : m.qoldiq === 0 ? <Nishon matn="Tugagan" tur="warn" /> : <Nishon matn="Bor" tur="ok" />,
    },
  ];

  return (
    <Sahifa
      sarlavha="Sklad"
      tavsif="Kirim minus chiqim = qoldiq. Materialga bosing — kirim yoki chiqim yozasiz"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
      amallar={<Qidiruv qiymat={q} ozgardi={setQ} placeholder="Material nomi…" />}
    >
      {/* KPI — bosilsa filtr bo'ladi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {([
          ['hammasi', 'Material turlari', stat.turlari, undefined],
          ['bor', 'Qoldiq bor', stat.bor, 'omborda mavjud'],
          ['tugagan', 'Tugagan', stat.tugagan, 'qoldiq 0'],
          ['manfiy', 'Manfiy qoldiq', stat.manfiy, stat.manfiy ? 'tekshirish kerak' : 'muammo yo‘q'],
        ] as const).map(([kalit, nom, qiy, ost]) => (
          <button
            key={kalit}
            onClick={() => setFiltr(kalit as typeof filtr)}
            className={`text-left rounded-[10px] transition-colors duration-[120ms] cursor-pointer
                        ${filtr === kalit ? 'ring-1 ring-[var(--accent)]' : ''}`}
          >
            <KpiKarta nom={nom} qiymat={qiy} ost={ost} />
          </button>
        ))}
      </div>

      {filtr !== 'hammasi' && (
        <p className="text-xs text-text-dim mb-3">
          Filtr yoqilgan — <button onClick={() => setFiltr('hammasi')} className="text-accent cursor-pointer underline">hammasini ko'rsat</button>
        </p>
      )}

      <Holatlar
        soragan={soragan}
        bosh={{ matn: 'Sklad bo‘sh', izoh: '«Приход» va «Расход» varaqlarida yozuv topilmadi.' }}
      >
        {() => satrlar.length === 0
          ? <div className="karta py-12 text-center text-text-dim text-sm">Filtrga mos material topilmadi</div>
          : <Jadval ustunlar={ustunlar} satrlar={satrlar} kalit={(m, i) => `${m.nom}|${m.birlik}|${i}`} onSatrBos={setTanlangan} />}
      </Holatlar>

      {/* ---------- Batafsil ---------- */}
      <Yon
        ochiq={!!tanlangan}
        yop={() => { setTanlangan(null); setYangi({ ...yangi, ochiq: false }); }}
        sarlavha={tanlangan?.nom ?? ''}
        tavsif={tanlangan ? `Birlik: ${tanlangan.birlik || '—'}` : undefined}
      >
        {tanlangan && (
          <>
            <section className="karta p-4">
              <Juft nom="Jami kirim" qiymat={<FmtN val={tanlangan.kirim} />} />
              <Juft nom="Jami chiqim" qiymat={<FmtN val={tanlangan.chiqim} />} />
              <Juft
                nom="Qoldiq"
                qiymat={
                  <span className={tanlangan.qoldiq < 0 ? 'text-danger' : tanlangan.qoldiq === 0 ? 'text-warn' : 'text-ok'}>
                    <FmtN val={tanlangan.qoldiq} /> {tanlangan.birlik}
                  </span>
                }
              />
            </section>

            {tanlangan.qoldiq < 0 && (
              <div className="rounded-[10px] border border-danger/25 bg-danger/[.08] p-3 text-sm text-text-dim">
                Chiqim kirimdan ko'p. Odatda bu kirim hujjati kiritilmaganini bildiradi —
                «Приход» varag'ini tekshiring.
              </div>
            )}

            {!yangi.ochiq ? (
              <div className="flex gap-3">
                <Tugma tur="primary" ikonka={<ArrowDownToLine size={16} />} onBos={() => setYangi({ ochiq: true, op: 'prixod' })}>
                  Kirim
                </Tugma>
                <Tugma ikonka={<ArrowUpFromLine size={16} />} onBos={() => setYangi({ ochiq: true, op: 'rasxod' })}>
                  Chiqim
                </Tugma>
              </div>
            ) : (
              <section className="karta p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.04em] text-text-dim">
                  {yangi.op === 'prixod' ? 'Yangi kirim (Приход)' : 'Yangi chiqim (Расход)'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Maydon nom={`Hajm (${tanlangan.birlik || 'birlik'})`}>
                    <Kiritma tur="number" qiymat={shakl.obyomi} ozgardi={(v) => setShakl({ ...shakl, obyomi: v })} />
                  </Maydon>
                  <Maydon nom="Sana" izoh="bo'sh — bugun">
                    <Kiritma tur="date" qiymat={shakl.sanasi} ozgardi={(v) => setShakl({ ...shakl, sanasi: v })} />
                  </Maydon>
                </div>
                <Maydon nom="Material turi">
                  <Kiritma qiymat={shakl.turi} ozgardi={(v) => setShakl({ ...shakl, turi: v })} />
                </Maydon>
                {yangi.op === 'rasxod' && (
                  <Maydon nom="Kimga berildi">
                    <Tanlov
                      qiymat={QABUL_TURI.find((x) => x.qiy === shakl.qabulTuri)?.nom ?? QABUL_TURI[0].nom}
                      ozgardi={(nom) => {
                        const t = QABUL_TURI.find((x) => x.nom === nom);
                        if (t) setShakl({ ...shakl, qabulTuri: t.qiy as typeof shakl.qabulTuri });
                      }}
                      variantlar={QABUL_TURI.map((x) => x.nom)}
                    />
                  </Maydon>
                )}
                <Maydon nom={yangi.op === 'prixod' ? 'Yetkazib beruvchi' : 'Nomi'}>
                  <Kiritma qiymat={shakl.kim} ozgardi={(v) => setShakl({ ...shakl, kim: v })} placeholder="ixtiyoriy" />
                </Maydon>
                <div className="flex gap-3 justify-end pt-1">
                  <Tugma onBos={() => setYangi({ ...yangi, ochiq: false })}>Bekor</Tugma>
                  <Tugma tur="primary" onBos={yozish} band={yoz.isPending} ikonka={<Plus size={16} />}>
                    {yangi.op === 'prixod' ? 'Kirim yozish' : 'Chiqim yozish'}
                  </Tugma>
                </div>
              </section>
            )}
          </>
        )}
      </Yon>
    </Sahifa>
  );
}

export default Sklad;
