import { useMemo, useState, useEffect } from 'react';
import { useObyektlar, useDarajalar, useDarajalarBarcha, useDarajalarSaqla, useRazdelYasat } from '../../api/hooks';
import { Sahifa, Holatlar, KpiKarta, Qidiruv, Tanlov, Tugma, Nishon } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import { Save, RefreshCcw, Wand2, AlertTriangle } from 'lucide-react';
import type { DarajaQator } from '../../api/types';

type Qator = DarajaQator & { _kalit: string };

export function Ierarxiya() {
  const obyektlar = useObyektlar();
  const [obyekt, setObyekt] = useState('');
  const soragan = useDarajalar(obyekt);
  const barcha = useDarajalarBarcha();
  const saqla = useDarajalarSaqla();
  const yasat = useRazdelYasat();

  const [q, setQ] = useState('');
  const [faqatBosh, setFaqatBosh] = useState(false);
  const [tahrir, setTahrir] = useState<Record<string, Partial<DarajaQator>>>({});

  const obNomlari = useMemo(
    () => Array.from(new Set((obyektlar.data ?? []).map((o) => o.obyekt.split(' - ')[0]))),
    [obyektlar.data],
  );

  useEffect(() => { setTahrir({}); }, [obyekt]);

  const qatorlar: Qator[] = useMemo(
    () => (soragan.data ?? []).map((r, i) => ({ ...r, _kalit: `${r.smeta}|${r.rzNom}|${i}` })),
    [soragan.data],
  );

  /** Mavjud Д1/Д2/Д3 qiymatlari — takliflar uchun (barcha obyektlardan) */
  const takliflar = useMemo(() => {
    const d1 = new Set<string>(), d2 = new Set<string>(), d3 = new Set<string>();
    (barcha.data ?? []).forEach((r) => {
      if (r.d1) d1.add(r.d1);
      if (r.d2) d2.add(r.d2);
      if (r.d3) d3.add(r.d3);
    });
    (soragan.data ?? []).forEach((r) => {
      if (r.d1) d1.add(r.d1); if (r.d2) d2.add(r.d2); if (r.d3) d3.add(r.d3);
    });
    return { d1: [...d1].sort(), d2: [...d2].sort(), d3: [...d3].sort() };
  }, [barcha.data, soragan.data]);

  /** Bir xil razdel nomi boshqa obyektda tasniflangan bo'lsa — taklif */
  const nomTaklif = useMemo(() => {
    const m: Record<string, { d1: string; d2: string; d3: string }> = {};
    (barcha.data ?? []).forEach((r) => {
      const k = r.rzNom.trim().toUpperCase();
      if (k && r.d1 && !m[k]) m[k] = { d1: r.d1, d2: r.d2 || '', d3: r.d3 || '' };
    });
    return m;
  }, [barcha.data]);

  function joriy(r: Qator, maydon: 'd1' | 'd2' | 'd3'): string {
    const t = tahrir[r._kalit];
    return (t && t[maydon] !== undefined ? t[maydon] : r[maydon]) ?? '';
  }
  function ozgart(r: Qator, maydon: 'd1' | 'd2' | 'd3', v: string) {
    setTahrir((p) => ({ ...p, [r._kalit]: { ...p[r._kalit], [maydon]: v } }));
  }

  const korinadigan = useMemo(() => {
    const s = q.trim().toUpperCase();
    return qatorlar.filter((r) => {
      if (s && !r.rzNom.toUpperCase().includes(s) && !r.smeta.toUpperCase().includes(s)) return false;
      if (faqatBosh && joriy(r, 'd1')) return false;
      return true;
    });
  }, [qatorlar, q, faqatBosh, tahrir]);

  const stat = useMemo(() => {
    const jami = qatorlar.length;
    const tasniflangan = qatorlar.filter((r) => joriy(r, 'd1')).length;
    return { jami, tasniflangan, bosh: jami - tasniflangan, ozgargan: Object.keys(tahrir).length };
  }, [qatorlar, tahrir]);

  /** Bo'shlarni nom bo'yicha avtomat to'ldirish */
  function avtoToldir() {
    let n = 0;
    const yangi = { ...tahrir };
    qatorlar.forEach((r) => {
      if (joriy(r, 'd1')) return;
      const t = nomTaklif[r.rzNom.trim().toUpperCase()];
      if (!t) return;
      yangi[r._kalit] = { ...yangi[r._kalit], d1: t.d1, d2: t.d2, d3: t.d3 };
      n++;
    });
    setTahrir(yangi);
    toast(n ? `${n} ta razdel avtomat to'ldirildi — tekshirib saqlang` : 'Mos taklif topilmadi');
  }

  async function saqlash() {
    const rows = qatorlar
      .filter((r) => tahrir[r._kalit])
      .map((r) => ({
        obyekt, smeta: r.smeta, rzNom: r.rzNom,
        d1: joriy(r, 'd1'), d2: joriy(r, 'd2'), d3: joriy(r, 'd3'),
        d4: r.d4 || '', d5: r.d5 || '',
      }));
    if (!rows.length) { toast("O'zgarish yo'q"); return; }
    /* ⚠️ apiDarajalarSaqla obyektning BARCHA qatorlarini almashtiradi —
     * shuning uchun o'zgarmaganlarini ham yuboramiz, aks holda ular yo'qoladi. */
    const hammasi = qatorlar.map((r) => ({
      obyekt, smeta: r.smeta, rzNom: r.rzNom,
      d1: joriy(r, 'd1'), d2: joriy(r, 'd2'), d3: joriy(r, 'd3'),
      d4: r.d4 || '', d5: r.d5 || '',
    }));
    try {
      const xabar = await saqla.mutateAsync(hammasi);
      toast(String(xabar).slice(0, 120));
      setTahrir({});
      soragan.refetch();
    } catch (e: any) { toast(`Saqlanmadi: ${e.message}`); }
  }

  return (
    <Sahifa
      sarlavha="Ierarxiya"
      tavsif="Razdellarni Д1–Д3 bo'yicha tasniflash — bu tasnif Boss hisobotlariga to'g'ridan-to'g'ri ta'sir qiladi"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
      amallar={
        <div className="flex items-center gap-3 flex-wrap">
          <Tanlov qiymat={obyekt} ozgardi={setObyekt} variantlar={['', ...obNomlari]} />
          <Qidiruv qiymat={q} ozgardi={setQ} placeholder="Razdel nomi…" />
        </div>
      }
    >
      {!obyekt ? (
        <div className="karta py-16 text-center">
          <p className="text-text font-medium">Obyektni tanlang</p>
          <p className="text-sm text-text-dim mt-1">Razdellar ro'yxati va tasnifi shu obyekt bo'yicha ochiladi</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiKarta nom="Razdellar" qiymat={stat.jami} />
            <KpiKarta nom="Tasniflangan" qiymat={stat.tasniflangan} ost={stat.jami ? `${Math.round((stat.tasniflangan / stat.jami) * 100)}%` : undefined} />
            <button onClick={() => setFaqatBosh(!faqatBosh)} className={`text-left rounded-[10px] cursor-pointer ${faqatBosh ? 'ring-1 ring-[var(--warn)]' : ''}`}>
              <KpiKarta nom="Tasniflanmagan" qiymat={stat.bosh} ost={stat.bosh ? 'hisobotdan tushib qoladi' : 'hammasi joyida'} />
            </button>
            <KpiKarta nom="O'zgartirildi" qiymat={stat.ozgargan} ost={stat.ozgargan ? 'saqlanmagan' : undefined} />
          </div>

          {stat.bosh > 0 && (
            <div className="rounded-[10px] border border-warn/25 bg-warn/[.08] p-3 mb-4 text-sm text-text-dim flex items-start gap-2">
              <AlertTriangle size={16} className="text-warn flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-text">{stat.bosh} ta razdel</strong> tasniflanmagan (Д1 bo'sh).
                Ular Boss hisobotlarida ko'rinmaydi va yangi qatorlar ham tasnifsiz qo'shiladi.
              </span>
            </div>
          )}

          {/* Amallar paneli */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Tugma onBos={avtoToldir} ikonka={<Wand2 size={16} />}>Bo'shlarni avtomat to'ldirish</Tugma>
            <Tugma
              onBos={async () => {
                try { const r = await yasat.mutateAsync(obyekt); toast(r.xabar || 'Reestr yangilandi'); soragan.refetch(); }
                catch (e: any) { toast(`Xato: ${e.message}`); }
              }}
              band={yasat.isPending}
              ikonka={<RefreshCcw size={16} />}
            >
              Reestrni smetadan yangilash
            </Tugma>
            {stat.ozgargan > 0 && (
              <Tugma tur="primary" onBos={saqlash} band={saqla.isPending} ikonka={<Save size={16} />}>
                {stat.ozgargan} ta o'zgarishni saqlash
              </Tugma>
            )}
          </div>

          <datalist id="d1-lar">{takliflar.d1.map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="d2-lar">{takliflar.d2.map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="d3-lar">{takliflar.d3.map((v) => <option key={v} value={v} />)}</datalist>

          <Holatlar soragan={soragan} bosh={{ matn: 'Razdellar topilmadi', izoh: '«Reestrni smetadan yangilash» tugmasini bosing.' }}>
            {() => korinadigan.length === 0 ? (
              <div className="karta py-12 text-center text-text-dim text-sm">Filtrga mos razdel yo'q</div>
            ) : (
              <div className="karta overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <thead>
                      <tr>
                        {['Smeta', 'Razdel', 'Д1', 'Д2', 'Д3'].map((h, i) => (
                          <th key={h} className="sticky top-0 z-[1] bg-[var(--surface-2)] px-4 py-3 text-left
                                                  font-medium text-[11px] uppercase tracking-[0.04em]
                                                  text-text-dim border-b border-border"
                              style={{ width: i === 0 ? '160px' : i === 1 ? undefined : '180px' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {korinadigan.map((r) => {
                        const bosh = !joriy(r, 'd1');
                        const ozgargan = !!tahrir[r._kalit];
                        return (
                          <tr
                            key={r._kalit}
                            className="border-b border-border last:border-0 hover:bg-[var(--surface-2)]/50 transition-colors duration-[120ms]"
                            style={ozgargan ? { boxShadow: 'inset 3px 0 0 var(--warn)' } : undefined}
                          >
                            <td className="px-4 py-2 text-text-mute truncate max-w-[160px]" title={r.smeta}>{r.smeta || '—'}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {bosh && <Nishon matn="tasnifsiz" tur="warn" />}
                                <span className="text-text truncate" title={r.rzNom}>{r.rzNom}</span>
                              </div>
                            </td>
                            {(['d1', 'd2', 'd3'] as const).map((m) => (
                              <td key={m} className="px-2 py-1.5">
                                <input
                                  list={`${m}-lar`}
                                  value={joriy(r, m)}
                                  onChange={(e) => ozgart(r, m, e.target.value)}
                                  placeholder="—"
                                  className={`input h-8 px-2 text-[13px] w-full ${m === 'd1' && bosh ? 'border-warn/40' : ''}`}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Holatlar>
        </>
      )}
    </Sahifa>
  );
}

export default Ierarxiya;
