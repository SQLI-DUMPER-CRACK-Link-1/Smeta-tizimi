import { useMemo, useState } from 'react';
import {
  useBuxDashboard, useXarajatlar, useXarajatYoz, useXarajatOchir,
  useTolovlar, useTolovSaqla, useShartnomalar, useShartnomaBog,
} from '../../api/hooks';
import {
  Sahifa, Holatlar, Jadval, Nishon, KpiKarta, Qidiruv, Yon, Juft,
  Maydon, Kiritma, Tanlov, Tugma, type Ustun,
} from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';
import { Plus, Trash2, Building2 } from 'lucide-react';
import type { BuxQator, Xarajat, Tolov } from '../../api/types';

const BOLIMLAR = ['Umumiy', "To'lovlar", 'Xarajatlar'] as const;
type Bolim = typeof BOLIMLAR[number];

const TOIFALAR = ['Иш ҳақи', 'Ёқилғи', 'Транспорт', 'Ижара', 'Солиқ', 'Хизмат', 'Бошқа'];

export function Buxgalteriya() {
  const [bolim, setBolim] = useState<Bolim>('Umumiy');
  const dash = useBuxDashboard();
  const xarajatlar = useXarajatlar();
  const tolovlar = useTolovlar();
  const shartnomalar = useShartnomalar();
  const bog = useShartnomaBog();
  const xarajatYoz = useXarajatYoz();
  const xarajatOchir = useXarajatOchir();
  const tolovYoz = useTolovSaqla();

  const [q, setQ] = useState('');
  const [tanlangan, setTanlangan] = useState<BuxQator | null>(null);
  const [yangiX, setYangiX] = useState({ sana: '', toifa: TOIFALAR[0], summa: '', izoh: '' });
  const [yangiT, setYangiT] = useState({ sana: '', shNo: '', summa: '', izoh: '' });

  const j = dash.data?.jami;

  const obyektMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    Object.entries(bog.data ?? {}).forEach(([ob, no]) => { (m[no] ||= []).push(ob); });
    return m;
  }, [bog.data]);

  const xarajatJami = useMemo(
    () => (xarajatlar.data ?? []).reduce((a, x) => a + (x.summa || 0), 0),
    [xarajatlar.data],
  );

  const shTolovlari = useMemo(
    () => (tolovlar.data ?? []).filter((t) => t.shNo === tanlangan?.no),
    [tolovlar.data, tanlangan],
  );

  const filtrlangan = useMemo(() => {
    const s = q.trim().toUpperCase();
    const r = dash.data?.qatorlar ?? [];
    if (!s) return r;
    return r.filter((x) => x.no.toUpperCase().includes(s) || x.nomi.toUpperCase().includes(s) || x.taraf.toUpperCase().includes(s));
  }, [dash.data, q]);

  async function xarajatQosh() {
    const summa = Number(String(yangiX.summa).replace(/[^\d.-]/g, ''));
    if (!summa) { toast('Summa kiriting'); return; }
    try {
      await xarajatYoz.mutateAsync({ sana: yangiX.sana || undefined, toifa: yangiX.toifa, summa, izoh: yangiX.izoh });
      setYangiX({ sana: '', toifa: TOIFALAR[0], summa: '', izoh: '' });
      toast('Xarajat qo\'shildi');
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  async function tolovQosh() {
    const summa = Number(String(yangiT.summa).replace(/[^\d.-]/g, ''));
    if (!summa) { toast('Summa kiriting'); return; }
    if (!yangiT.shNo) { toast('Shartnomani tanlang'); return; }
    try {
      await tolovYoz.mutateAsync({
        shNo: yangiT.shNo, summa, sana: yangiT.sana || undefined,
        obyekt: (obyektMap[yangiT.shNo] || [])[0] || '', tur: 'Тўлов', izoh: yangiT.izoh,
      });
      setYangiT({ sana: '', shNo: '', summa: '', izoh: '' });
      toast("To'lov qo'shildi");
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  const shUstunlar: Ustun<BuxQator>[] = [
    { kalit: 'no', nom: '№', en: '110px', chiz: (r) => <span className="font-medium text-text">{r.no}</span> },
    {
      kalit: 'nomi', nom: 'Shartnoma',
      chiz: (r) => (
        <div className="min-w-0">
          <div className="text-text truncate" title={r.nomi}>{r.nomi || '—'}</div>
          <div className="text-[11px] text-text-mute truncate" title={r.taraf}>{r.taraf || '—'}</div>
        </div>
      ),
    },
    { kalit: 'dog', nom: 'Shartnoma summasi', raqam: true, en: '170px', chiz: (r) => <FmtN val={r.dog_summa} /> },
    {
      kalit: 'baj', nom: 'Bajarilgan', raqam: true, en: '170px',
      chiz: (r) => (
        <div>
          <FmtN val={r.bajarilgan} />
          <div className="text-[11px] text-text-mute">{r.bajarilgan_pct}%</div>
        </div>
      ),
    },
    {
      kalit: 'tol', nom: "To'langan", raqam: true, en: '170px',
      chiz: (r) => (
        <div>
          <span className="text-ok"><FmtN val={r.tolangan} /></span>
          <div className="text-[11px] text-text-mute">{r.tolangan_pct}%</div>
        </div>
      ),
    },
    {
      kalit: 'deb', nom: 'Debitor / Avans', raqam: true, en: '170px',
      chiz: (r) => r.debitor > 0
        ? <span className="text-warn"><FmtN val={r.debitor} /></span>
        : r.avans > 0 ? <span className="text-info">−<FmtN val={r.avans} /></span>
        : <span className="text-text-mute">0</span>,
    },
  ];

  const xUstunlar: Ustun<Xarajat>[] = [
    { kalit: 'sana', nom: 'Sana', en: '120px', chiz: (x) => <span className="text-text-dim tabular-nums">{x.sana}</span> },
    { kalit: 'toifa', nom: 'Toifa', en: '150px', chiz: (x) => <Nishon matn={x.toifa} tur="neytral" /> },
    { kalit: 'izoh', nom: 'Izoh', chiz: (x) => <span className="text-text truncate block" title={x.izoh}>{x.izoh || '—'}</span> },
    { kalit: 'summa', nom: 'Summa', raqam: true, en: '160px', chiz: (x) => <span className="text-text font-medium"><FmtN val={x.summa} /></span> },
    {
      kalit: 'am', nom: '', en: '60px',
      chiz: (x) => (
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`${x.summa} — o'chirilsinmi?`)) xarajatOchir.mutate(x.row); }}
          title="O'chirish"
          className="h-7 w-7 grid place-items-center rounded-lg text-text-mute hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  const tUstunlar: Ustun<Tolov>[] = [
    { kalit: 'sana', nom: 'Sana', en: '120px', chiz: (t) => <span className="text-text-dim tabular-nums">{t.sana}</span> },
    { kalit: 'sh', nom: 'Shartnoma', en: '130px', chiz: (t) => <span className="text-text">{t.shNo}</span> },
    { kalit: 'ob', nom: 'Obyekt', chiz: (t) => <span className="text-text-dim truncate block" title={t.obyekt}>{t.obyekt || '—'}</span> },
    { kalit: 'izoh', nom: 'Izoh', chiz: (t) => <span className="text-text-mute truncate block">{t.izoh || '—'}</span> },
    { kalit: 'summa', nom: 'Summa', raqam: true, en: '160px', chiz: (t) => <span className="text-ok font-medium"><FmtN val={t.summa} /></span> },
  ];

  return (
    <Sahifa
      sarlavha="Buxgalteriya"
      tavsif="Shartnomalar, to'lovlar va xarajatlar — barcha moliyaviy ma'lumot bir joyda"
      yangilangan={dash.dataUpdatedAt}
      onYangila={() => { dash.refetch(); tolovlar.refetch(); xarajatlar.refetch(); }}
      yangilanmoqda={dash.isFetching}
      amallar={bolim === 'Umumiy' ? <Qidiruv qiymat={q} ozgardi={setQ} placeholder="№, nomi yoki taraf…" /> : undefined}
    >
      {/* KPI — hamma bo'limda ko'rinadi */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <KpiKarta nom="Shartnoma summasi" qiymat={<FmtN val={j?.dog} qisqa />} ost="so'm" />
        <KpiKarta nom="Bajarilgan" qiymat={<FmtN val={j?.bajarilgan} qisqa />} ost={j?.dog ? `${Math.round(((j.bajarilgan || 0) / j.dog) * 100)}%` : undefined} />
        <KpiKarta nom="To'langan" qiymat={<FmtN val={j?.tolangan} qisqa />} />
        <KpiKarta nom="Debitor" qiymat={<FmtN val={j?.debitor} qisqa />} ost="bizga qarz" />
        <KpiKarta nom="Xarajatlar" qiymat={<FmtN val={xarajatJami} qisqa />} ost={`${(xarajatlar.data ?? []).length} ta yozuv`} />
      </div>

      {/* Bo'lim tanlash */}
      <div className="flex gap-2 mb-4">
        {BOLIMLAR.map((b) => (
          <button
            key={b}
            onClick={() => setBolim(b)}
            className={`h-9 px-4 rounded-[10px] border text-sm font-medium transition-colors duration-[120ms] cursor-pointer
              ${bolim === b ? 'bg-accent text-white border-transparent' : 'karta text-text-dim hover:text-text'}`}
          >
            {b}
          </button>
        ))}
      </div>

      {bolim === 'Umumiy' && (
        <Holatlar soragan={dash} bosh={{ matn: 'Shartnoma topilmadi' }}>
          {() => <Jadval ustunlar={shUstunlar} satrlar={filtrlangan} kalit={(r, i) => r.no || String(i)} onSatrBos={setTanlangan} />}
        </Holatlar>
      )}

      {bolim === "To'lovlar" && (
        <div className="space-y-4">
          <section className="karta p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Yangi to'lov</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Maydon nom="Shartnoma">
                <Tanlov
                  qiymat={yangiT.shNo}
                  ozgardi={(v) => setYangiT({ ...yangiT, shNo: v })}
                  variantlar={['', ...(shartnomalar.data ?? []).map((s) => s.no)]}
                />
              </Maydon>
              <Maydon nom="Sana"><Kiritma tur="date" qiymat={yangiT.sana} ozgardi={(v) => setYangiT({ ...yangiT, sana: v })} /></Maydon>
              <Maydon nom="Summa"><Kiritma tur="number" qiymat={yangiT.summa} ozgardi={(v) => setYangiT({ ...yangiT, summa: v })} /></Maydon>
              <Maydon nom="Izoh"><Kiritma qiymat={yangiT.izoh} ozgardi={(v) => setYangiT({ ...yangiT, izoh: v })} placeholder="ixtiyoriy" /></Maydon>
            </div>
            <Tugma tur="primary" onBos={tolovQosh} band={tolovYoz.isPending} ikonka={<Plus size={16} />}>Qo'shish</Tugma>
          </section>
          <Holatlar soragan={tolovlar} bosh={{ matn: "To'lov yo'q", izoh: 'Yuqoridagi formadan qo‘shing.' }}>
            {() => <Jadval ustunlar={tUstunlar} satrlar={tolovlar.data ?? []} kalit={(t, i) => `${t.row}|${i}`} />}
          </Holatlar>
        </div>
      )}

      {bolim === 'Xarajatlar' && (
        <div className="space-y-4">
          <section className="karta p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Yangi xarajat</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Maydon nom="Toifa"><Tanlov qiymat={yangiX.toifa} ozgardi={(v) => setYangiX({ ...yangiX, toifa: v })} variantlar={TOIFALAR} /></Maydon>
              <Maydon nom="Sana"><Kiritma tur="date" qiymat={yangiX.sana} ozgardi={(v) => setYangiX({ ...yangiX, sana: v })} /></Maydon>
              <Maydon nom="Summa"><Kiritma tur="number" qiymat={yangiX.summa} ozgardi={(v) => setYangiX({ ...yangiX, summa: v })} /></Maydon>
              <Maydon nom="Izoh"><Kiritma qiymat={yangiX.izoh} ozgardi={(v) => setYangiX({ ...yangiX, izoh: v })} placeholder="ixtiyoriy" /></Maydon>
            </div>
            <Tugma tur="primary" onBos={xarajatQosh} band={xarajatYoz.isPending} ikonka={<Plus size={16} />}>Qo'shish</Tugma>
          </section>
          <Holatlar soragan={xarajatlar} bosh={{ matn: 'Xarajat yozilmagan', izoh: 'Yuqoridagi formadan qo‘shing.' }}>
            {() => <Jadval ustunlar={xUstunlar} satrlar={xarajatlar.data ?? []} kalit={(x, i) => `${x.row}|${i}`} />}
          </Holatlar>
        </div>
      )}

      {/* Shartnoma batafsil */}
      <Yon
        ochiq={!!tanlangan}
        yop={() => setTanlangan(null)}
        sarlavha={tanlangan?.no ?? ''}
        tavsif={tanlangan?.nomi}
      >
        {tanlangan && (
          <>
            <section className="karta p-4">
              <Juft nom="Taraf" qiymat={<span className="text-text-dim">{tanlangan.taraf || '—'}</span>} />
              <Juft nom="Shartnoma summasi" qiymat={<FmtN val={tanlangan.dog_summa} />} />
              <Juft nom="Bajarilgan" qiymat={<><FmtN val={tanlangan.bajarilgan} /> <span className="text-text-mute">({tanlangan.bajarilgan_pct}%)</span></>} />
              <Juft nom="To'langan" qiymat={<span className="text-ok"><FmtN val={tanlangan.tolangan} /> <span className="text-text-mute">({tanlangan.tolangan_pct}%)</span></span>} />
              <Juft
                nom={tanlangan.debitor > 0 ? 'Debitor (bizga qarz)' : 'Avans (oldindan)'}
                qiymat={<span className={tanlangan.debitor > 0 ? 'text-warn' : 'text-info'}>
                  <FmtN val={tanlangan.debitor > 0 ? tanlangan.debitor : tanlangan.avans} />
                </span>}
              />
            </section>

            {(obyektMap[tanlangan.no] || []).length > 0 && (
              <section>
                <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-2">Obyektlar</h4>
                <ul className="space-y-1">
                  {(obyektMap[tanlangan.no] || []).map((ob) => (
                    <li key={ob} className="flex items-center gap-2 text-sm text-text">
                      <Building2 size={14} className="text-accent flex-shrink-0" />
                      <span className="truncate" title={ob}>{ob}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-2">
                To'lovlar ({shTolovlari.length})
              </h4>
              {shTolovlari.length === 0
                ? <p className="text-sm text-text-mute">Hali to'lov yo'q.</p>
                : (
                  <div className="karta divide-y divide-border max-h-64 overflow-y-auto">
                    {shTolovlari.map((t) => (
                      <div key={t.row} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="text-text tabular-nums">{t.sana}</div>
                          {t.izoh && <div className="text-[11px] text-text-mute truncate">{t.izoh}</div>}
                        </div>
                        <span className="text-ok tabular-nums flex-shrink-0"><FmtN val={t.summa} /></span>
                      </div>
                    ))}
                  </div>
                )}
            </section>
          </>
        )}
      </Yon>
    </Sahifa>
  );
}

export default Buxgalteriya;
